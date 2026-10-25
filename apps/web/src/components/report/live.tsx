import type { LiveProbe } from "@flo/engine";
import { Check, Globe, X } from "lucide-react";
import { cn } from "@/lib/utils";

const HEADERS = [
  ["content-security-policy", "Content-Security-Policy"],
  ["strict-transport-security", "HSTS"],
  ["x-content-type-options", "X-Content-Type-Options"],
  ["x-frame-options", "X-Frame-Options"],
  ["referrer-policy", "Referrer-Policy"],
  ["content-encoding", "Compression"],
] as const;

export function LivePanel({ live }: { live: LiveProbe }) {
  if (!live.ok) {
    return (
      <div className="rounded-2xl border border-high/25 bg-high/5 p-5 text-sm">
        <p className="font-medium">We couldn't reach {live.url}</p>
        <p className="mt-1 text-muted">{live.error ?? "The site didn't respond."} Code checks still ran; live checks were skipped.</p>
      </div>
    );
  }
  const h = live.html;
  return (
    <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
      <div className="rounded-2xl border border-line bg-raised p-5">
        <p className="flex items-center gap-2 font-mono text-xs text-muted">
          <Globe className="size-3.5" />
          {live.finalUrl} · HTTP {live.status} · {live.timingMs} ms
        </p>
        <p className="mt-4 text-xs text-faint">How Google shows it</p>
        <div className="mt-2 rounded-xl bg-sunken p-4">
          <p className="truncate text-[17px] text-low">{h?.title ?? "(no title)"}</p>
          <p className="mt-1 line-clamp-2 text-[13px] text-muted">{h?.description ?? "(no meta description, so Google picks random text from the page)"}</p>
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
          <Stat k="Unknown URL returns" v={live.notFound ? `HTTP ${live.notFound.status}` : "—"} ok={live.notFound?.status === 404} />
          <Stat k="robots.txt" v={live.robots ? `HTTP ${live.robots.status}` : "—"} ok={live.robots?.status === 200} />
          <Stat k="sitemap.xml" v={live.sitemap ? `HTTP ${live.sitemap.status}` : "—"} ok={live.sitemap?.status === 200} />
          <Stat k="Images missing alt" v={h ? `${h.imgWithoutAlt} / ${h.imgTotal}` : "—"} ok={h?.imgWithoutAlt === 0} />
          <Stat k="Blocking scripts" v={h ? String(h.blockingScripts) : "—"} ok={h?.blockingScripts === 0} />
          <Stat k="Structured data" v={h?.jsonLdTypes.length ? h.jsonLdTypes.slice(0, 2).join(", ") : "none"} ok={!!h?.jsonLdTypes.length} />
        </dl>
      </div>
      <div className="rounded-2xl border border-line bg-raised p-5">
        <p className="text-sm font-medium">Response headers</p>
        <ul className="mt-3 space-y-2">
          {HEADERS.map(([k, label]) => (
            <li key={k} className="flex items-center justify-between gap-3 text-[13px]">
              <span className="flex items-center gap-2">
                {live.headers[k] ? <Check className="size-3.5 text-pass" /> : <X className="size-3.5 text-critical" />}
                {label}
              </span>
              <span className="truncate font-mono text-[11px] text-faint">{live.headers[k]?.slice(0, 32) ?? "missing"}</span>
            </li>
          ))}
        </ul>
        {h?.ogImage && (
          <>
            <p className="mt-5 text-xs text-faint">Social share image</p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={h.ogImage} alt="Open Graph preview of the live site" className="mt-2 aspect-[1.91/1] w-full rounded-lg border border-line object-cover" loading="lazy" />
          </>
        )}
      </div>
    </div>
  );
}

function Stat({ k, v, ok }: { k: string; v: string; ok?: boolean }) {
  return (
    <div className="rounded-lg bg-sunken px-3 py-2">
      <dt className="text-[11px] text-faint">{k}</dt>
      <dd className={cn("mt-0.5 truncate font-mono text-[13px]", ok ? "text-pass" : "text-fg")}>{v}</dd>
    </div>
  );
}
