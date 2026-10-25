# Flo: product notes

## The idea

Many non-developers now ship apps with AI builders. Those apps work in a demo, but underneath they usually have exposed keys, open databases, fake-able payments, AI-generated bugs, no production basics, and a codebase that becomes patch-work after a few weeks of prompting. Flo connects to the codebase and tells the owner, in plain language and with file-and-line evidence:

1. what is dangerous right now (security and bugs),
2. what a senior engineer would have set up (production checklist),
3. what the architecture should look like **for their scale and budget**, and
4. what to do, in order (roadmap).

This is pick #1 from the research ("AI build-and-rescue desk"). The free scan is the lead magnet and the proof asset. The paid tiers are the services that research showed can close fast ($199 audit, $750 sprint, $300–500/month monitoring).

## Coverage map: inputs → checks

### Website launch list (from the gathered notes)

| Item | Check ID | How it's detected |
|---|---|---|
| Custom 404 page | `seo.custom-404` | `app/not-found`, `pages/404`, catch-all route; live: real 404 status vs soft 404 |
| Clear CTA above the fold | `conv.cta-above-fold` | CTA verbs in hero/home component (top of file) |
| Internal links | `seo.internal-links` | Distinct internal `href`/`to` targets vs `#anchor`-only one-pagers |
| Thank-you page after enquiry | `conv.thank-you-page` | Only when forms exist; thank-you route or redirect vs toast/alert |
| Breadcrumbs | `seo.breadcrumbs` | Only when nested routes exist; component or `BreadcrumbList` |
| Case study section | `conv.case-studies` | Routes or sections for case studies, results, portfolio |
| 5 FAQs | `seo.faq` | Counts questions in FAQ data/accordions, plus `FAQPage` schema |
| Response-time promise | `conv.response-time` | "reply within X hours" style copy |
| Sticky mobile CTA | `conv.sticky-mobile-cta` | `fixed bottom-0` + `md:hidden` patterns |
| robots.txt | `seo.robots` | File or `app/robots.ts`; flags `Disallow: /`; live fetch |
| Unique page titles | `seo.unique-titles` | Per-page metadata, duplicate titles, SPA shared-title problem; live title |
| Meta descriptions | `seo.meta-descriptions` | Present and not template defaults ("Lovable Generated Project") |
| Social share images | `seo.og-images` | `opengraph-image`/`og:image`; flags Lovable default and relative URLs |
| Map + directions | `conv.map-directions` | Local businesses only; Maps embed + directions link |
| Real customer reviews | `conv.real-reviews` | Flags stock names and pravatar/randomuser avatars; prefers embedded sources |
| Alt text on images | `seo.alt-text` | `<img>`/`<Image>` without `alt`; live count |
| LocalBusiness schema | `seo.local-business-schema` | Local businesses only; JSON-LD types in code and on the live page |
| Privacy policy page | `comp.privacy-policy` | Route exists, not just a dead footer link |
| Google Analytics | `comp.analytics` (+ `comp.cookie-consent`) | GA4/GTM/Plausible/PostHog etc.; consent banner when tracking loads |

Extra checks in the same family: `seo.sitemap`, `conv.click-to-call`, `comp.terms`.

### Performance list (from the Instagram reel)

| Item | Check ID |
|---|---|
| Cache API responses | `perf.api-caching` |
| Load balancer | `scale.load-balancer` (also flags in-memory sessions and local-disk uploads) |
| Index the database | `data.indexes` (parses SQL/Prisma for unindexed foreign keys) |
| Compress images | `perf.image-weight` (real file sizes) |
| Loading skeletons | `perf.loading-skeletons` |
| Cache expensive queries / server-side caching | `perf.server-cache` |
| N+1 database queries | `perf.n-plus-one` (+ rule) |
| Debounce input handlers | `perf.debounce` (+ rule) |
| Split code into chunks | `perf.code-splitting` |
| Add CDN | `perf.cdn` (+ live CDN headers) |
| Paginate large lists | `perf.pagination` (+ rule) |
| Lighthouse audit | `perf.lighthouse` |
| Compress API payloads | `perf.compression` (+ live `content-encoding`) |
| Unnecessary re-renders | `perf.rerenders` |
| Minify JS and CSS | `perf.minify` |
| Lazy loading | `perf.lazy-images` |
| Defer non-critical scripts | `perf.defer-scripts` (+ live head parsing) |
| Unused dependencies | `perf.unused-deps` |
| Database connection pooling | `data.pooling` |

Each item is **gated** by relevance and **sized** by the owner's goals. For example, Redis and load balancing are "At scale" items for a 1k-user app and "Launch blocker" items for a 100k-user app.

## Design direction

The look is calm, precise and dark-first, closer to Linear, Vercel and Rauno's "Devouring Details" than to typical SaaS templates. It uses one signature accent (electric lime), Geist and Geist Mono, a hairline border system, subtle grain, and spring motion only where it helps meaning: score rings counting up, a border beam on the main input, cursor spotlight cards, and data flowing along the architecture connectors. There is a full light theme, and it respects reduced motion. [Skiper UI](https://skiper-ui.com/) components are shadcn-registry compatible; most are paid ($129). The app uses the same stack (Tailwind v4, Motion, lucide), so Pro components can be dropped in later with `npx shadcn add @skiper-ui/skiperN`.

Flo passes its own checklist. It has a custom 404, robots and sitemap, per-page metadata, a generated OG image, breadcrumbs with `BreadcrumbList`, 6 FAQs with `FAQPage`, a response-time promise, a sticky mobile CTA, a thank-you page after enquiries, privacy and terms pages, optional GA4, security headers, CI and Dependabot.

## Roadmap

1. **GitHub App + accounts:** one-click repo connect instead of tokens, saved reports, re-scan on push, and a PR comment with the score delta.
2. **Auto-fix PRs:** Claude drafts fixes for mechanical findings (RLS migrations, webhook verification, metadata, robots/sitemap) as a pull request for review.
3. **Monitoring retainer:** weekly re-scans and live probes with alerts. This is the $300–500/month tier.
4. **Deeper analysis:** AST-based data-flow for injection rules, a Supabase project connector (read RLS from the live database, not just migrations), Lighthouse via headless Chrome, and dependency CVE lookup.
5. **Scale:** move scans into isolated workers (queue + sandbox) and reports into Postgres.
