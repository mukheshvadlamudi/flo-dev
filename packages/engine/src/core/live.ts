import { lookup } from "node:dns/promises";
import net from "node:net";
import type { LiveProbe } from "./types.js";

const MAX_BYTES = 2 * 1024 * 1024;
const TIMEOUT_MS = 10_000;
const MAX_REDIRECTS = 4;
const UA = "FloAuditBot/0.1 (+https://flo.dev/bot)";

function isPrivateIp(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number) as [number, number];
    return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const v6 = ip.toLowerCase();
  if (v6.startsWith("::ffff:")) return isPrivateIp(v6.slice(7));
  return v6 === "::1" || v6 === "::" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe80");
}

/** Rejects URLs that would make the server call itself or an internal network (SSRF). */
export async function assertPublicUrl(raw: string, allowPrivate = false): Promise<URL> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    throw new Error("Not a valid URL.");
  }
  if (!["http:", "https:"].includes(url.protocol)) throw new Error("Only http and https URLs can be scanned.");
  if (url.username || url.password) throw new Error("URLs with credentials are not allowed.");
  if (allowPrivate) return url;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (/^(localhost|.*\.local|.*\.internal|metadata\.google\.internal)$/i.test(host)) throw new Error("Private hosts can't be scanned.");
  const addrs = net.isIP(host) ? [{ address: host }] : await lookup(host, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error("That host resolves to a private network address.");
  return url;
}

interface Fetched {
  status: number;
  headers: Record<string, string>;
  body: string;
  finalUrl: string;
}

async function safeFetch(start: string, allowPrivate: boolean, wantBody = true): Promise<Fetched> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const url = await assertPublicUrl(current, allowPrivate);
    const res = await fetch(url, {
      redirect: "manual",
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { "user-agent": UA, accept: "text/html,application/xhtml+xml,*/*;q=0.8", "accept-encoding": "gzip, br" },
    });
    const headers: Record<string, string> = {};
    res.headers.forEach((v, k) => (headers[k] = v));
    if (res.status >= 300 && res.status < 400 && headers.location) {
      current = new URL(headers.location, url).toString();
      await res.body?.cancel();
      continue;
    }
    let body = "";
    if (wantBody && res.body) {
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let size = 0;
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        body += decoder.decode(value, { stream: true });
        if (size > MAX_BYTES) {
          await reader.cancel();
          break;
        }
      }
    } else {
      await res.body?.cancel();
    }
    return { status: res.status, headers, body, finalUrl: url.toString() };
  }
  throw new Error("Too many redirects.");
}

const attr = (tag: string, name: string) => tag.match(new RegExp(`\\b${name}\\s*=\\s*["']([^"']*)["']`, "i"))?.[1];

function metaContent(html: string, key: string): string | undefined {
  for (const m of html.matchAll(/<meta\b[^>]*>/gi)) {
    const tag = m[0];
    const k = attr(tag, "name") ?? attr(tag, "property");
    if (k?.toLowerCase() === key) return attr(tag, "content")?.trim();
  }
  return undefined;
}

export function parseHtml(html: string, pageUrl: string): NonNullable<LiveProbe["html"]> {
  const origin = new URL(pageUrl).origin;
  const title = html.match(/<title[^>]*>([^<]*)<\/title>/i)?.[1]?.trim();
  const jsonLdTypes: string[] = [];
  for (const m of html.matchAll(/<script[^>]+application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    for (const t of m[1]!.matchAll(/"@type"\s*:\s*(\[[^\]]*\]|"[^"]+")/g)) {
      jsonLdTypes.push(...t[1]!.replace(/[[\]"]/g, "").split(",").map((s) => s.trim()).filter(Boolean));
    }
  }
  const imgs = [...html.matchAll(/<img\b[^>]*>/gi)].map((m) => m[0]);
  let links = 0;
  for (const m of html.matchAll(/<a\b[^>]*href=["']([^"'#]+)["']/gi)) {
    try {
      if (new URL(m[1]!, pageUrl).origin === origin) links++;
    } catch {
      /* ignore malformed hrefs */
    }
  }
  const scripts = [...html.matchAll(/<script\b[^>]*>/gi)].map((m) => m[0]);
  const head = html.split(/<\/head>/i)[0] ?? "";
  const blockingScripts = [...head.matchAll(/<script\b[^>]*\bsrc=[^>]*>/gi)].filter((m) => !/\b(async|defer)\b|type=["']module["']/i.test(m[0])).length;
  return {
    title,
    description: metaContent(html, "description"),
    ogImage: metaContent(html, "og:image"),
    canonical: html.match(/<link[^>]+rel=["']canonical["'][^>]*>/i)?.[0].match(/href=["']([^"']+)/)?.[1],
    jsonLdTypes: [...new Set(jsonLdTypes)],
    imgWithoutAlt: imgs.filter((t) => !/\balt\s*=/.test(t)).length,
    imgTotal: imgs.length,
    links,
    scripts: scripts.length,
    blockingScripts,
    bytes: html.length,
  };
}

export async function probeLiveSite(rawUrl: string, opts: { allowPrivate?: boolean } = {}): Promise<LiveProbe> {
  const allowPrivate = opts.allowPrivate ?? false;
  const started = Date.now();
  const url = /^https?:\/\//i.test(rawUrl) ? rawUrl : `https://${rawUrl}`;
  try {
    const home = await safeFetch(url, allowPrivate);
    const base = new URL(home.finalUrl);
    const random = `/flo-404-check-${Math.random().toString(36).slice(2, 10)}`;
    const [robots, sitemap, missing] = await Promise.allSettled([
      safeFetch(new URL("/robots.txt", base).toString(), allowPrivate),
      safeFetch(new URL("/sitemap.xml", base).toString(), allowPrivate, false),
      safeFetch(new URL(random, base).toString(), allowPrivate),
    ]);
    const homeHtml = parseHtml(home.body, home.finalUrl);
    let notFound: LiveProbe["notFound"];
    if (missing.status === "fulfilled") {
      const t = parseHtml(missing.value.body, missing.value.finalUrl).title ?? "";
      // A custom page usually carries the site's own branding/title, not a bare host error.
      const customPage = missing.value.body.length > 1500 && !/^(404|not found|page not found|404: not found|404 not found)$/i.test(t.trim());
      notFound = { status: missing.value.status, customPage };
    }
    return {
      url,
      ok: home.status < 400,
      status: home.status,
      finalUrl: home.finalUrl,
      headers: home.headers,
      html: homeHtml,
      robots: robots.status === "fulfilled" ? { status: robots.value.status, body: robots.value.body.slice(0, 4000) } : undefined,
      sitemap: sitemap.status === "fulfilled" ? { status: sitemap.value.status } : undefined,
      notFound,
      timingMs: Date.now() - started,
      ...(home.status >= 400 ? { error: `The site returned HTTP ${home.status}.` } : {}),
    };
  } catch (err) {
    return { url, ok: false, error: err instanceof Error ? err.message : String(err), headers: {}, timingMs: Date.now() - started };
  }
}
