import type { SourceFile } from "../types.js";
import {
  ANY_FILE,
  type CheckContext,
  type CheckDef,
  dep,
  fail,
  grep,
  grepCount,
  has,
  na,
  pass,
  paths,
  plural,
  PUBLIC_KINDS,
  UI_FILE,
  unknown,
  warn,
  WEB_KINDS,
} from "./context.js";
import { redact } from "../rules/helpers.js";

const HOME_FILE = /(^|\/)((src\/)?app\/(\([^)]*\)\/)?page\.(t|j)sx|(src\/)?pages\/(index|Index|Home|home)\.(t|j)sx|src\/(App|app)\.(t|j)sx|index\.html|src\/pages\/index\.astro|src\/routes\/\+page\.svelte)$/;

function homeAndHero(ctx: CheckContext): SourceFile[] {
  const home = ctx.project.files.filter((f) => HOME_FILE.test(f.path) && !f.path.startsWith("node_modules"));
  const hero = ctx.project.files.filter((f) => /(^|\/)[^/]*hero[^/]*\.(tsx|jsx|vue|svelte|astro)$/i.test(f.path));
  // Follow imports from the home page into CTA-ish components (ScanForm, SignupCta, HeroSection…).
  const imported: SourceFile[] = [];
  for (const h of home) {
    for (const m of h.content.matchAll(/import\s+\{?\s*([\w,\s]+?)\s*\}?\s+from\s+["']([@.~][^"']+)["']/g)) {
      if (!/hero|cta|form|signup|waitlist|book/i.test(m[1]!)) continue;
      const base = m[2]!.split("/").pop()!.toLowerCase();
      const file = ctx.project.files.find((f) => f.path.toLowerCase().replace(/\.(t|j)sx?$/, "").endsWith(`/${base}`) && UI_FILE(f));
      if (file && !hero.includes(file)) imported.push(file);
    }
  }
  return [...hero, ...imported, ...home];
}

const CTA_WORDS = /\b(audit my|run (a )?free|start (a )?free (trial|audit|scan)|get started|start (free|now|your)|book( a| an| now| online)?|schedule|call (us|now)|contact us|get (a|your) (free )?(quote|estimate|demo|consultation)|request (a )?(quote|demo|callback)|sign up|try (it )?(free|now)|buy now|shop now|order now|join( the)? waitlist|enquire|get in touch|talk to (us|sales)|claim)\b/i;

/** Pulls `title: "…"` style strings from Next metadata, Helmet and <title> tags. */
function collectTitles(ctx: CheckContext): { title: string; file: string; line: number }[] {
  const out: { title: string; file: string; line: number }[] = [];
  for (const f of ctx.project.files) {
    if (!UI_FILE(f) && !/\.(t|j)s$/.test(f.path)) continue;
    const isMeta = /export\s+(const\s+metadata|async\s+function\s+generateMetadata)|<Helmet|useHead|<svelte:head|<title>|document\.title|<SEO\b|<Head>/.test(f.content);
    if (!isMeta) continue;
    f.lines.forEach((line, i) => {
      const m =
        line.match(/<title>([^<{]+)<\/title>/) ??
        line.match(/document\.title\s*=\s*["'`]([^"'`$]+)["'`]/) ??
        line.match(/(?:^|[{,\s])(?:title|default)\s*:\s*["'`]([^"'`$]{3,})["'`]/) ??
        line.match(/<SEO[^>]*title=["']([^"']+)["']/);
      if (m) out.push({ title: m[1]!.trim(), file: f.path, line: i + 1 });
    });
  }
  return out;
}

function pageCount(ctx: CheckContext): number {
  return ctx.structure.routes.filter((r) => !r.includes("(API)") && r !== "*").length;
}

export const WEB_CHECKS: CheckDef[] = [
  // ───────────── SEO & discoverability ─────────────
  {
    id: "seo.custom-404",
    area: "SEO & discoverability",
    title: "Custom 404 page",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "Broken links and mistyped URLs happen. A branded 404 that links back home keeps the visitor instead of losing them, and must return a real 404 status so Google doesn't index it.",
    howTo: (ctx) =>
      ctx.stack.frameworks.includes("Next.js")
        ? "Add `app/not-found.tsx` with your nav, a short message and links to the home page and top pages."
        : "Add a catch-all route (`<Route path=\"*\" element={<NotFound />} />`) with links back to key pages, and configure your host to serve it with a 404 status (e.g. Vercel `rewrites` + `404.html`, Netlify `/* /index.html 200` only for SPA routes).",
    evaluate(ctx) {
      const files = paths(ctx, /(^|\/)(app\/not-found|pages\/404|src\/pages\/404|404)\.(tsx|jsx|ts|js|html|astro|vue|svelte)$|(^|\/)src\/pages\/NotFound\.(t|j)sx$|\+error\.svelte$/);
      if (files.length) return pass(`Found a dedicated 404 page (${files[0]!.file}).`, files);
      const routes = grep(ctx, /path=["']\*["']|path:\s*["'](\*|\/:pathMatch\(\.\*\)\*)["']|<Route\s+path=["']\*["']/, UI_FILE);
      if (routes.length) return pass("A catch-all route renders a not-found screen.", routes);
      return fail("No 404 page or catch-all route found — unknown URLs show the host's default error or a blank page.");
    },
    live(probe, code) {
      if (!probe.notFound) return undefined;
      if (probe.notFound.status === 404) return probe.notFound.customPage ? pass("The live site returns HTTP 404 with a custom page for unknown URLs.") : warn("The live site returns 404 but with the host's default page.");
      return { status: "warn", evidence: `Unknown URLs return HTTP ${probe.notFound.status} (a "soft 404") — search engines may index error pages.${code.status === "pass" ? " The page exists in code but the status code is wrong." : ""}`, refs: code.refs };
    },
  },
  {
    id: "seo.robots",
    area: "SEO & discoverability",
    title: "robots.txt",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "robots.txt tells crawlers what to index and where your sitemap is. Missing or wrong, it can hide the whole site from Google.",
    howTo: (ctx) =>
      ctx.stack.frameworks.includes("Next.js")
        ? "Add `app/robots.ts` returning `{ rules: { userAgent: '*', allow: '/', disallow: ['/api/', '/dashboard'] }, sitemap: 'https://yourdomain.com/sitemap.xml' }`."
        : "Add `public/robots.txt` with `User-agent: *`, `Allow: /`, `Disallow` lines for private areas, and a `Sitemap:` line.",
    evaluate(ctx) {
      const f = paths(ctx, /(^|\/)(public\/|static\/)?robots\.txt$|(^|\/)app\/robots\.(t|j)s$/);
      if (!f.length) return fail("No robots.txt or app/robots.ts in the repo.");
      const file = ctx.project.files.find((x) => x.path === f[0]!.file);
      if (file && /Disallow:\s*\/\s*$/m.test(file.content) && !/Allow:\s*\/\S/.test(file.content)) return fail("robots.txt blocks the entire site (`Disallow: /`).", f);
      if (file && !/sitemap/i.test(file.content)) return warn("robots.txt exists but doesn't point to a sitemap.", f);
      return pass("robots.txt is present.", f);
    },
    live(probe) {
      if (!probe.robots) return undefined;
      if (probe.robots.status !== 200) return fail(`The live /robots.txt returns HTTP ${probe.robots.status}.`);
      if (/Disallow:\s*\/\s*$/m.test(probe.robots.body ?? "")) return fail("The live robots.txt blocks the entire site.");
      return pass("The live /robots.txt is served.");
    },
  },
  {
    id: "seo.sitemap",
    area: "SEO & discoverability",
    title: "XML sitemap",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "A sitemap gets new pages indexed in days instead of weeks, and is required for Google Search Console.",
    howTo: (ctx) => (ctx.stack.frameworks.includes("Next.js") ? "Add `app/sitemap.ts` that lists every public route (and dynamic pages from your DB)." : "Generate `public/sitemap.xml` at build time (e.g. `vite-plugin-sitemap`, `next-sitemap`, `@astrojs/sitemap`) and submit it in Google Search Console."),
    evaluate(ctx) {
      const f = paths(ctx, /(^|\/)(public\/)?sitemap(-index)?\.xml$|(^|\/)app\/sitemap\.(t|j)s$/);
      if (f.length) return pass("A sitemap is generated.", f);
      const d = dep(ctx, "next-sitemap", "vite-plugin-sitemap", "@astrojs/sitemap", "sitemap");
      if (d) return pass(`Sitemap generated with ${d}.`);
      return fail("No sitemap found.");
    },
    live(probe) {
      if (!probe.sitemap) return undefined;
      return probe.sitemap.status === 200 ? pass("The live /sitemap.xml is served.") : fail(`The live /sitemap.xml returns HTTP ${probe.sitemap.status}.`);
    },
  },
  {
    id: "seo.unique-titles",
    area: "SEO & discoverability",
    title: "Unique page titles",
    appliesTo: WEB_KINDS,
    priority: "must",
    relevance: "The page title is the blue link in Google results. If every page shares one title, Google can't tell them apart and click-through drops.",
    howTo: (ctx) =>
      ctx.stack.frameworks.includes("Next.js")
        ? "Export `metadata` (or `generateMetadata`) from every `page.tsx`, and use a template in the root layout: `title: { template: '%s · Brand', default: 'Brand — what you do' }`."
        : "This is a single-page app, so every route shares index.html's title. Set a title per route with `react-helmet-async` (`<Helmet><title>…</title></Helmet>`) or migrate marketing pages to a framework that pre-renders HTML (Next.js, Astro) so crawlers see each title.",
    evaluate(ctx) {
      const titles = collectTitles(ctx);
      const pages = pageCount(ctx);
      if (ctx.stack.frameworks.includes("Next.js")) {
        const pageFiles = ctx.project.files.filter((f) => /(^|\/)app\/(.*\/)?page\.(t|j)sx$/.test(f.path));
        const withMeta = pageFiles.filter((f) => /export\s+(const\s+metadata|(async\s+)?function\s+generateMetadata)/.test(f.content));
        const missing = pageFiles.filter((f) => !withMeta.includes(f));
        if (pageFiles.length && !missing.length) return pass(`All ${plural(pageFiles.length, "page")} export their own metadata.`, withMeta.slice(0, 5).map((f) => ({ file: f.path })));
        if (withMeta.length) return warn(`${missing.length} of ${plural(pageFiles.length, "page")} don't set their own title.`, missing.slice(0, 5).map((f) => ({ file: f.path })));
      }
      if (titles.length === 0) return fail("No page titles found in the code.");
      const byTitle = new Map<string, typeof titles>();
      for (const t of titles) byTitle.set(t.title.toLowerCase(), [...(byTitle.get(t.title.toLowerCase()) ?? []), t]);
      const dupes = [...byTitle.values()].filter((v) => v.length > 1 && new Set(v.map((x) => x.file)).size > 1);
      const refs = titles.slice(0, 5).map((t) => ({ file: t.file, line: t.line, snippet: t.title }));
      if (dupes.length) return fail(`The title "${dupes[0]![0]!.title}" is reused on ${dupes[0]!.length} pages.`, dupes[0]!.map((t) => ({ file: t.file, line: t.line, snippet: t.title })));
      const spa = !ctx.stack.frameworks.some((f) => ["Next.js", "Remix", "Nuxt", "SvelteKit", "Astro"].includes(f));
      const perRoute = titles.filter((t) => !/index\.html$/.test(t.file)).length;
      if (spa && pages > 1 && perRoute === 0) return fail(`Only index.html sets a title, so all ${pages} routes share "${titles[0]!.title}".`, refs);
      if (pages > 1 && titles.length < Math.min(pages, 3)) return warn(`${plural(titles.length, "title")} found for ${plural(pages, "page")}.`, refs);
      return pass(`${plural(titles.length, "distinct title")} found.`, refs);
    },
    live(probe, code) {
      if (!probe.html) return undefined;
      if (!probe.html.title) return fail("The live home page has no <title>.");
      if (/^(vite \+ react|react app|create next app|lovable|my v0 project|untitled)/i.test(probe.html.title)) return fail(`The live home page still has the template title "${probe.html.title}".`);
      return code.status === "fail" ? code : pass(`Live home page title: "${probe.html.title}".`, code.refs);
    },
  },
  {
    id: "seo.meta-descriptions",
    area: "SEO & discoverability",
    title: "Meta descriptions",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "The description is the grey snippet under your link in search results — it's your ad copy. Without it Google picks random text from the page.",
    howTo: "Write a 140–160 character description per page that says who it's for and the outcome, e.g. `description: 'Same-day dental appointments in Pune. Book online in 60 seconds.'`.",
    evaluate(ctx) {
      const refs = grep(ctx, /<meta\s+name=["']description["']|(?:^|[{,\s])description\s*:\s*["'`][^"'`]{20,}|<Helmet[\s\S]*description|name:\s*["']description["']/, (f) => UI_FILE(f) || /\.(t|j)s$/.test(f.path), 8);
      if (!refs.length) return fail("No meta description found.");
      const generic = refs.find((r) => /Lovable Generated Project|Generated by create next app|Web site created using create-react-app|vite/i.test(r.snippet ?? ""));
      if (generic) return fail("The meta description is still the template default.", [generic]);
      const pages = pageCount(ctx);
      if (pages > 3 && refs.length < 3) return warn(`Only ${plural(refs.length, "description")} for ${plural(pages, "page")}.`, refs);
      return pass(`${plural(refs.length, "meta description")} found.`, refs);
    },
    live(probe) {
      if (!probe.html) return undefined;
      const d = probe.html.description;
      if (!d) return fail("The live home page has no meta description.");
      if (/Lovable Generated Project|create next app|create-react-app/i.test(d)) return fail(`The live description is the template default: "${d}".`);
      return d.length < 70 ? warn(`The live description is short (${d.length} chars): "${d}".`) : pass(`Live description (${d.length} chars) is set.`);
    },
  },
  {
    id: "seo.og-images",
    area: "SEO & discoverability",
    title: "Social share images (Open Graph)",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "When someone shares your link on WhatsApp, LinkedIn or X, the og:image is the preview. No image = a grey box nobody clicks.",
    howTo: (ctx) =>
      ctx.stack.frameworks.includes("Next.js")
        ? "Add `app/opengraph-image.tsx` (generated with `next/og`) or a 1200×630 `opengraph-image.png`, plus `twitter-image`. Set `metadataBase` so URLs are absolute."
        : "Add `<meta property=\"og:image\" content=\"https://yourdomain.com/og.png\">` (absolute URL, 1200×630), plus `og:title`, `og:description` and `twitter:card=summary_large_image` in index.html.",
    evaluate(ctx) {
      const files = paths(ctx, /(^|\/)app\/(.*\/)?(opengraph|twitter)-image\.(tsx|jsx|png|jpe?g)$/);
      if (files.length) return pass("Open Graph images are generated per route.", files);
      const meta = grep(ctx, /og:image|openGraph\s*:\s*\{[^}]*images|images\s*:\s*\[\s*["'{]/, (f) => UI_FILE(f) || /\.(t|j)s$/.test(f.path));
      if (!meta.length) return fail("No og:image found.");
      const lovable = meta.find((r) => /lovable\.dev\/opengraph|lovable\.app/i.test(r.snippet ?? ""));
      if (lovable) return fail("og:image still points to Lovable's default preview image.", [lovable]);
      const relative = meta.find((r) => /content=["']\/(?!\/)/.test(r.snippet ?? ""));
      if (relative) return warn("og:image uses a relative URL; most platforms need an absolute https:// URL.", [relative]);
      return pass("og:image is set.", meta);
    },
    live(probe) {
      if (!probe.html) return undefined;
      if (!probe.html.ogImage) return fail("The live home page has no og:image.");
      if (/lovable/i.test(probe.html.ogImage)) return fail("The live og:image is Lovable's default preview.");
      return pass("The live page has an og:image.");
    },
  },
  {
    id: "seo.alt-text",
    area: "SEO & discoverability",
    title: "Alt text on images",
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "Alt text is read by screen readers (an accessibility requirement under the ADA/EAA) and is how Google Images understands your photos.",
    howTo: "Give every meaningful image a short description (`alt=\"Dr. Mehta treating a patient\"`). Use `alt=\"\"` only for purely decorative images.",
    evaluate(ctx) {
      const total = grepCount(ctx, /<(img|Image)\b/, UI_FILE);
      if (total === 0) return na("No images in the markup.");
      const missing: { file: string; line: number; snippet: string }[] = [];
      for (const f of ctx.project.files) {
        if (!UI_FILE(f)) continue;
        for (const m of f.content.matchAll(/<(img|Image)\b[^>]*?\/?>/gs)) {
          if (/\balt\s*=/.test(m[0])) continue;
          const line = f.content.slice(0, m.index ?? 0).split(/\r?\n/).length;
          missing.push({ file: f.path, line, snippet: redact(f.lines[line - 1] ?? "") });
        }
      }
      const empty = grepCount(ctx, /<(img|Image)\b[^>]*alt=["']{2}/, UI_FILE);
      if (missing.length) return fail(`${missing.length} of ${plural(total, "image")} have no alt attribute.`, missing.slice(0, 5));
      if (empty > total / 2) return warn(`${empty} of ${total} images use an empty alt — fine for decoration, not for content images.`);
      return pass(`All ${plural(total, "image")} have alt text.`);
    },
    live(probe, code) {
      if (!probe.html || probe.html.imgTotal === 0) return undefined;
      if (probe.html.imgWithoutAlt > 0) return fail(`${probe.html.imgWithoutAlt} of ${probe.html.imgTotal} images on the live home page have no alt.`, code.refs);
      return code.status === "fail" ? code : pass(`All ${probe.html.imgTotal} images on the live home page have alt text.`);
    },
  },
  {
    id: "seo.internal-links",
    area: "SEO & discoverability",
    title: "Internal links between pages",
    appliesTo: PUBLIC_KINDS,
    priority: "should",
    relevance: "Internal links spread ranking power from your home page to service pages and help visitors find the next step. One-page sites with only anchor links rank for far fewer searches.",
    howTo: "Link every page from the nav or footer, link related services/posts to each other in the body copy with descriptive anchor text (\"teeth whitening in Pune\", not \"click here\"), and give each service its own page.",
    evaluate(ctx) {
      const targets = new Set<string>();
      for (const f of ctx.project.files) {
        if (!UI_FILE(f)) continue;
        for (const m of f.content.matchAll(/(?:href|to)=\{?["'`](\/[a-z0-9][^"'`#?]*)["'`]/gi)) targets.add(m[1]!.replace(/\/$/, ""));
      }
      const anchors = grepCount(ctx, /href=["']#[a-z]/i, UI_FILE);
      const pages = pageCount(ctx);
      if (targets.size >= 5) return pass(`${plural(targets.size, "internal link target")} found (e.g. ${[...targets].slice(0, 3).join(", ")}).`);
      if (targets.size === 0 && anchors > 0) return fail(`The site is a single page that only links to #sections (${plural(anchors, "anchor link")}). Each service deserves its own indexable page.`);
      if (pages <= 1) return warn("Only one page found — create pages for each service, location or use-case and link them together.");
      return warn(`Only ${plural(targets.size, "internal link target")} across ${plural(pages, "page")}.`);
    },
    live(probe, code) {
      if (!probe.html) return undefined;
      return probe.html.links < 3 ? warn(`The live home page has only ${plural(probe.html.links, "internal link")}.`, code.refs) : undefined;
    },
  },
  {
    id: "seo.breadcrumbs",
    area: "SEO & discoverability",
    title: "Breadcrumbs",
    appliesTo: ["ecommerce", "local-business", "marketing-site", "saas-app"],
    when: (ctx) => ctx.structure.routes.some((r) => r.split("/").filter(Boolean).length >= 2 && !r.includes("(API)")) || has(ctx, "ecommerce"),
    priority: "later",
    relevance: "You have nested pages (e.g. /services/x or /blog/y). Breadcrumbs show visitors where they are and, with BreadcrumbList schema, replace the URL in Google results with a readable path.",
    howTo: "Add a `<Breadcrumbs>` component on nested pages (shadcn/ui has one) and output matching `BreadcrumbList` JSON-LD.",
    evaluate(ctx) {
      const refs = grep(ctx, /Breadcrumb|BreadcrumbList|aria-label=["']breadcrumb/i, UI_FILE);
      return refs.length ? pass("Breadcrumbs are implemented.", refs) : fail("Nested pages have no breadcrumbs.");
    },
  },
  {
    id: "seo.local-business-schema",
    area: "SEO & discoverability",
    title: "LocalBusiness schema (JSON-LD)",
    appliesTo: ["local-business"],
    priority: "must",
    relevance: "This looks like a local business site. LocalBusiness structured data (name, address, phone, hours, geo) is what Google uses for the map pack and \"near me\" results.",
    howTo: "Add a `<script type=\"application/ld+json\">` with `@type` set to your most specific type (Dentist, Restaurant, Plumber…), plus `name`, `address`, `telephone`, `openingHoursSpecification`, `geo`, `url` and `sameAs` (your Google Business Profile). Validate with Google's Rich Results Test.",
    evaluate(ctx) {
      const refs = grep(ctx, /["']@type["']\s*:\s*["'](LocalBusiness|Dentist|Restaurant|MedicalClinic|Physician|Plumber|Electrician|HomeAndConstructionBusiness|LegalService|Attorney|AutoRepair|BeautySalon|HairSalon|DaySpa|HealthClub|Store|ProfessionalService|RealEstateAgent|FoodEstablishment|CafeOrCoffeeShop|Bakery|LodgingBusiness|Hotel|VeterinaryCare)["']/, ANY_FILE);
      if (refs.length) return pass("LocalBusiness structured data is present.", refs);
      const anyLd = grep(ctx, /application\/ld\+json/, ANY_FILE);
      return anyLd.length ? warn("JSON-LD exists, but not a LocalBusiness type.", anyLd) : fail("No LocalBusiness schema found.");
    },
    live(probe) {
      if (!probe.html) return undefined;
      const t = probe.html.jsonLdTypes;
      return t.some((x) => /LocalBusiness|Dentist|Restaurant|Clinic|Physician|Plumber|Store|Service|Salon|Agent/.test(x)) ? pass(`Live page exposes JSON-LD: ${t.join(", ")}.`) : fail(t.length ? `Live JSON-LD types: ${t.join(", ")} — no LocalBusiness.` : "The live page has no JSON-LD.");
    },
  },
  {
    id: "seo.faq",
    area: "SEO & discoverability",
    title: "FAQ section (5+ questions)",
    appliesTo: ["local-business", "marketing-site", "saas-app", "ecommerce"],
    priority: "should",
    relevance: "Five real customer questions answered on the page handle objections before a sales call, and are the passages AI search (ChatGPT, AI Overviews) quotes.",
    howTo: "Add an FAQ with at least 5 questions customers actually ask (price, timing, guarantees, process, location), and mark it up with `FAQPage` JSON-LD.",
    evaluate(ctx) {
      const faqFiles = ctx.project.files.filter((f) => UI_FILE(f) || /\.(t|j)s$/.test(f.path)).filter((f) => /faq/i.test(f.path) || /\bFAQ|Frequently asked/i.test(f.content));
      if (!faqFiles.length) return fail("No FAQ section found.");
      let questions = 0;
      for (const f of faqFiles) {
        questions += (f.content.match(/\b(question|q)\s*:\s*["'`]/gi) ?? []).length;
        questions += (f.content.match(/<(AccordionTrigger|summary|dt)\b/g) ?? []).length;
        if (questions === 0) questions += f.lines.filter((l) => /^\s*["'`>]?[A-Z][^"'`<>]{8,}\?\s*["'`<]?/.test(l)).length;
      }
      const schema = grep(ctx, /FAQPage/, ANY_FILE);
      const refs = [{ file: faqFiles[0]!.path }, ...schema];
      if (questions >= 5) return pass(`FAQ with ~${questions} questions${schema.length ? " and FAQPage schema" : " (add FAQPage schema too)"}.`, refs);
      return warn(`FAQ found but only ~${plural(questions, "question")}; aim for at least 5.`, refs);
    },
  },

  // ───────────── Conversion & trust ─────────────
  {
    id: "conv.cta-above-fold",
    area: "Conversion & trust",
    title: "Clear call-to-action above the fold",
    appliesTo: ["local-business", "marketing-site", "saas-app", "ecommerce"],
    priority: "must",
    relevance: "Most visitors decide in a few seconds and never scroll. The first screen needs one obvious next step (Book, Call, Get a quote, Start free).",
    howTo: "Put one primary button in the hero with a specific verb + outcome (\"Book a free consultation\"), a secondary option beside it (\"Call 98xxx\"), and repeat the CTA after each major section.",
    evaluate(ctx) {
      const files = homeAndHero(ctx);
      if (!files.length) return unknown("Couldn't find the home page or hero component.");
      for (const f of files) {
        const top = f.lines.slice(0, Math.min(f.lines.length, /hero/i.test(f.path) ? f.lines.length : 200));
        const idx = top.findIndex((l, i) => CTA_WORDS.test(l) && /<(Button|button|a|Link)\b|href=|onClick|>\s*[A-Z]/.test((top[i - 1] ?? "") + l));
        if (idx >= 0) return pass(`Hero has a CTA: "${top[idx]!.trim().replace(/<[^>]+>/g, "").slice(0, 60)}".`, [{ file: f.path, line: idx + 1, snippet: redact(top[idx]!) }]);
      }
      const anywhere = grep(ctx, CTA_WORDS, UI_FILE, 3);
      if (anywhere.length) return warn("CTAs exist, but none were found in the hero / first screen.", anywhere);
      return fail("No clear call-to-action wording found on the home page.", [{ file: files[0]!.path }]);
    },
  },
  {
    id: "conv.sticky-mobile-cta",
    area: "Conversion & trust",
    title: "Sticky mobile CTA",
    appliesTo: ["local-business", "marketing-site", "ecommerce"],
    priority: "should",
    relevance: "Most local and landing-page traffic is mobile. A thumb-reachable \"Call / Book\" bar that stays on screen typically lifts enquiries noticeably.",
    howTo: "Add a bar shown only on small screens: `<div className=\"fixed inset-x-0 bottom-0 z-50 flex gap-2 p-3 md:hidden\">` with Call and Book buttons, and pad the page bottom so it doesn't cover content.",
    evaluate(ctx) {
      const refs = grep(ctx, /(fixed|sticky)[^"'`]*bottom-0[^"'`]*(md|lg|sm):hidden|(md|lg|sm):hidden[^"'`]*(fixed|sticky)[^"'`]*bottom-0|position:\s*(fixed|sticky)[^}]*bottom:\s*0/, UI_FILE);
      if (refs.length) return pass("A mobile-only fixed bottom bar exists.", refs);
      const fixedBottom = grep(ctx, /(fixed|sticky)[^"'`]*bottom-(0|4)/, UI_FILE);
      if (fixedBottom.length) return warn("A fixed bottom element exists, but it isn't mobile-only — check it's a CTA, not just a toast.", fixedBottom);
      return fail("No sticky CTA for mobile visitors.");
    },
  },
  {
    id: "conv.thank-you-page",
    area: "Conversion & trust",
    title: "Thank-you page after an enquiry",
    appliesTo: ["local-business", "marketing-site", "saas-app", "ecommerce"],
    when: (ctx) => ctx.project.files.some((f) => UI_FILE(f) && /<form\b|onSubmit=|useForm\(|handleSubmit/.test(f.content)),
    priority: "should",
    relevance: "You have forms. A dedicated thank-you page confirms the enquiry landed, sets expectations (\"we'll call within 2 hours\"), and gives Google Analytics / ad platforms a URL to count as a conversion.",
    howTo: "On successful submit, redirect to `/thank-you` that repeats the response-time promise, offers a next step (WhatsApp, calendar link) and fires the conversion event.",
    evaluate(ctx) {
      const p = paths(ctx, /(thank|thanks|success|confirmation|submitted)[^/]*(\/page)?\.(t|j)sx|\/(thank-you|thanks|success)\//i);
      const r = grep(ctx, /(navigate|push|redirect|href\s*=|location\.href\s*=)\(?\s*["'`]\/(thank|thanks|success|confirmation)/i, UI_FILE);
      if (p.length || r.length) return pass("Forms lead to a thank-you / confirmation page.", [...p, ...r]);
      const toast = grep(ctx, /toast\(|alert\(|setSubmitted\(true\)|isSubmitted/i, UI_FILE, 3);
      return toast.length ? warn("Submissions only show a toast/inline message — there's no trackable thank-you URL.", toast) : fail("No confirmation after form submit was found.");
    },
  },
  {
    id: "conv.response-time",
    area: "Conversion & trust",
    title: "Response-time promise",
    appliesTo: ["local-business", "marketing-site"],
    priority: "should",
    relevance: "People enquire with several providers. A concrete promise (\"We reply within 2 business hours\") next to the form beats competitors who say nothing.",
    howTo: "Add one specific line near every form and on the thank-you page, and make sure you can keep it (set up instant email/WhatsApp alerts for new leads).",
    evaluate(ctx) {
      const refs = grep(ctx, /(reply|respond|response|get back|call you back|hear from us)[^.]{0,30}(within|in under|in less than)\s+(\d+|an?|one|two|24)\s*(minutes?|mins?|hours?|hrs?|business (hours|days?)|day)|same[- ]day (response|reply|callback)|within 24 ?h/i, UI_FILE);
      return refs.length ? pass("A response-time promise is on the site.", refs) : fail("No response-time promise found.");
    },
  },
  {
    id: "conv.case-studies",
    area: "Conversion & trust",
    title: "Case study / results section",
    appliesTo: ["local-business", "marketing-site", "saas-app"],
    priority: (ctx) => (has(ctx, "saas-app") && !has(ctx, "marketing-site") ? "later" : "should"),
    relevance: "Case studies with real numbers (\"cut no-shows 38%\") are the strongest proof you can do the job — stronger than any feature list.",
    howTo: "Add 2–3 short case studies: the client, the problem, what you did, and a measurable result with a photo or logo. Give each its own page for SEO.",
    evaluate(ctx) {
      const refs = [...paths(ctx, /case-?stud|success-?stor|portfolio|our-?work|projects?\//i), ...grep(ctx, /case stud(y|ies)|success stor(y|ies)|our work|client results|before (&|and) after/i, UI_FILE)];
      return refs.length ? pass("A case study / results section exists.", refs.slice(0, 5)) : fail("No case studies or results section found.");
    },
  },
  {
    id: "conv.real-reviews",
    area: "Conversion & trust",
    title: "Real customer reviews",
    appliesTo: ["local-business", "marketing-site", "saas-app", "ecommerce"],
    priority: "must",
    relevance: "Visitors check reviews before they enquire. AI builders fill sites with invented testimonials (\"Sarah Johnson, CEO\") — visitors spot them, and fake reviews break FTC/ASCI rules.",
    howTo: "Replace placeholder testimonials with real ones (name, photo, business, with permission), embed your Google reviews (e.g. via a widget or the Places API), and link to your Google Business Profile.",
    evaluate(ctx) {
      const section = grep(ctx, /testimonial|customer reviews?|what (our )?(clients|customers|patients|users) say|trustpilot|google reviews|<Review\b|reviews\s*=\s*\[|★★/i, UI_FILE, 5);
      if (!section.length) return fail("No reviews or testimonials on the site.");
      const fake = grep(ctx, /\b(John|Jane) (Doe|Smith)\b|Lorem ipsum|Sarah Johnson|Michael Chen|Emily (Davis|Rodriguez)|pravatar\.cc|randomuser\.me|i\.pravatar|ui-avatars\.com|placeholder\.(com|svg)/i, UI_FILE);
      if (fake.length) return fail("Testimonials look like AI/template placeholders (stock names or random avatar services).", fake);
      const embedded = dep(ctx, "react-google-reviews", "@trustpilot/*") ?? grep(ctx, /trustpilot|elfsight|google\.com\/maps\/place|places\.googleapis|reviews\.io|\.from\(["']reviews["']\)/i, ANY_FILE, 1)[0]?.file;
      if (embedded) return pass("Reviews come from a real source (embedded / database).", section);
      return warn("Testimonials are hardcoded — make sure they're real, attributable and used with permission; consider embedding Google reviews.", section);
    },
  },
  {
    id: "conv.map-directions",
    area: "Conversion & trust",
    title: "Map + directions",
    appliesTo: ["local-business"],
    priority: "should",
    relevance: "Local customers want to know how far you are and how to get there. An embedded map with a Directions link removes a step before they visit or call.",
    howTo: "Embed a Google Map of your Business Profile (`<iframe src=\"https://www.google.com/maps/embed?pb=…\" loading=\"lazy\">`) and add a \"Get directions\" button linking to `https://www.google.com/maps/dir/?api=1&destination=<your address>`.",
    evaluate(ctx) {
      const map = grep(ctx, /google\.com\/maps\/embed|maps\.googleapis|@vis\.gl\/react-google-maps|react-leaflet|mapbox|<iframe[^>]*maps/i, ANY_FILE);
      const dir = grep(ctx, /maps\/dir\/|maps\.app\.goo\.gl|goo\.gl\/maps|maps\.google\.com\/\?|directions/i, UI_FILE);
      if (map.length && dir.length) return pass("Map embed and directions link are present.", [...map, ...dir].slice(0, 4));
      if (map.length) return warn("A map is embedded but there's no \"Get directions\" link.", map);
      if (dir.length) return warn("There's a directions link but no embedded map.", dir);
      return fail("No map or directions on the site.");
    },
  },
  {
    id: "conv.click-to-call",
    area: "Conversion & trust",
    title: "Click-to-call phone link",
    appliesTo: ["local-business"],
    priority: "should",
    relevance: "On mobile, a tappable phone number is often the fastest path to a booking for local services.",
    howTo: "Wrap every phone number in `<a href=\"tel:+91XXXXXXXXXX\">` and add a WhatsApp link (`https://wa.me/91XXXXXXXXXX`) if you use it.",
    evaluate(ctx) {
      const refs = grep(ctx, /href=\{?["'`]tel:/i, UI_FILE);
      return refs.length ? pass("Phone numbers are tappable (tel: links).", refs) : fail("Phone numbers aren't wrapped in tel: links.");
    },
  },

  // ───────────── Compliance & analytics ─────────────
  {
    id: "comp.privacy-policy",
    area: "Compliance & analytics",
    title: "Privacy policy page",
    appliesTo: WEB_KINDS,
    priority: (ctx) => (ctx.profile.handlesPII || ctx.stack.auth.length > 0 ? "must" : "should"),
    relevance: (ctx) =>
      `You ${ctx.stack.auth.length ? "store user accounts" : "collect contact details through forms"}${ctx.stack.ai.length ? " and send data to AI providers" : ""}. GDPR, India's DPDP Act and CCPA require a privacy policy, and Google Ads, Stripe and app stores reject sites without one.`,
    howTo: "Publish `/privacy` covering what you collect, why, which processors you share it with (hosting, analytics, payments, AI), retention, and how to request deletion. Link it in the footer and next to every form.",
    evaluate(ctx) {
      const p = paths(ctx, /privacy/i);
      const link = grep(ctx, /href=["'`]\/privacy|to=["'`]\/privacy|Privacy Policy/i, UI_FILE);
      if (p.length) return pass("A privacy policy page exists.", p);
      if (link.length) return warn("The footer links to a privacy policy, but no privacy page exists in the code.", link);
      return fail("No privacy policy page.");
    },
  },
  {
    id: "comp.terms",
    area: "Compliance & analytics",
    title: "Terms of service",
    appliesTo: ["saas-app", "ecommerce"],
    priority: (ctx) => (ctx.stack.payments.length ? "must" : "should"),
    relevance: "You take sign-ups or payments. Terms set refund rules, acceptable use and liability limits — payment providers ask for them during review.",
    howTo: "Publish `/terms` (refunds, cancellation, acceptable use, liability, governing law) and link it from sign-up and checkout.",
    evaluate(ctx) {
      const p = paths(ctx, /terms|tos\b|conditions/i);
      return p.length ? pass("A terms page exists.", p) : fail("No terms of service page.");
    },
  },
  {
    id: "comp.analytics",
    area: "Compliance & analytics",
    title: "Analytics installed (Google Analytics or similar)",
    appliesTo: WEB_KINDS,
    priority: "must",
    relevance: "Without analytics you can't tell which pages, ads or channels bring enquiries, so every marketing decision is a guess.",
    howTo: (ctx) =>
      ctx.stack.frameworks.includes("Next.js")
        ? "Add `<GoogleAnalytics gaId=\"G-XXXX\" />` from `@next/third-parties/google` in the root layout (or Plausible/PostHog), and mark form submits / thank-you page views as conversions."
        : "Add the GA4 gtag snippet (loaded `async`) or Plausible/PostHog, and send an event on form submit / thank-you page.",
    evaluate(ctx) {
      const d = dep(ctx, "@next/third-parties", "react-ga4", "react-ga", "@vercel/analytics", "posthog-js", "plausible-tracker", "next-plausible", "@plausible/analytics", "mixpanel-browser", "@amplitude/analytics-browser", "@segment/analytics-next", "@umami/node");
      const tag = grep(ctx, /googletagmanager\.com|gtag\(|\bG-[A-Z0-9]{8,12}\b|\bGTM-[A-Z0-9]{5,8}\b|plausible\.io|umami\.is|usefathom|clarity\.ms|posthog/, ANY_FILE, 3);
      const tagName = tag[0]?.snippet?.match(/googletagmanager|gtag|G-[A-Z0-9]+|GTM-|plausible|umami|fathom|clarity|posthog/)?.[0];
      if (d || tag.length) return pass(`Analytics found: ${[d, tagName && /^G-|gtag|googletag|GTM/.test(tagName) ? "Google Analytics" : tagName].filter(Boolean).join(", ")}.`, tag);
      return fail("No analytics found.");
    },
    live(probe, code) {
      if (!probe.html) return undefined;
      return code;
    },
  },
  {
    id: "comp.cookie-consent",
    area: "Compliance & analytics",
    title: "Cookie consent for tracking",
    appliesTo: WEB_KINDS,
    when: (ctx) => ctx.project.files.some((f) => /googletagmanager|gtag\(|fbq\(|connect\.facebook\.net|hotjar|clarity\.ms|linkedin.*insight/i.test(f.content)),
    priority: (ctx) => (ctx.profile.compliance.some((c) => /gdpr|eu|uk/i.test(c)) ? "must" : "should"),
    relevance: "You load tracking scripts (GA / pixels). EU/UK visitors must opt in first, and Google requires Consent Mode v2 for ads measurement in the EEA.",
    howTo: "Add a consent banner (e.g. vanilla-cookieconsent, Cookiebot) that defaults `gtag('consent', 'default', { analytics_storage: 'denied', ad_storage: 'denied' })` and updates on accept.",
    evaluate(ctx) {
      const refs = grep(ctx, /cookieconsent|react-cookie-consent|cookiebot|onetrust|klaro|gtag\(\s*["']consent["']|CookieBanner|CookieConsent/i, ANY_FILE);
      return refs.length ? pass("A consent mechanism is in place.", refs) : fail("Tracking scripts load without a consent banner.");
    },
  },
];
