# Flo

**Production-readiness audits for vibe-coded apps.** Connect a GitHub repo (and optionally the live URL). Flo reads the code, finds the security holes, bugs and missing production basics, checks the public site's SEO and conversion basics, then gives back an architecture sized to the owner's goals and a step-by-step roadmap.

It is built for apps made with Lovable, Bolt, Cursor, v0, Replit and Claude Code: Vite + React + Supabase, Next.js, Firebase, Prisma, Stripe and so on.

```
apps/web          Next.js 16 app: landing page, scan flow, report dashboard, API
packages/engine   The analyser: rules, checklist, live probe, planner, Claude advisor, CLI
docs/PRODUCT.md   Product notes: positioning, pricing, coverage map, roadmap
```

## Quick start

```bash
npm install
npm run dev            # builds the engine, then starts http://localhost:3000
```

Click **"Scan a sample Lovable app"** to see a full report without a repo. To scan your own app, paste a public GitHub URL, or add a read-only token for a private repo.

Optional environment (`apps/web/.env.local`, see `apps/web/.env.example`):

| Variable | What it does |
|---|---|
| `ANTHROPIC_API_KEY` | Enables the Claude review (`claude-opus-5-5`). Claude rewrites the architecture and roadmap for the specific codebase and the owner's goals. Without it, Flo uses its rule-based planner. |
| `NEXT_PUBLIC_SITE_URL` | Public URL, used for canonical links, sitemap and OG images. |
| `NEXT_PUBLIC_GA_ID` | Google Analytics 4 ID. |
| `FLO_DATA_DIR` | Where reports and enquiries are saved as JSON. Default: `apps/web/.flo-data`. |

### CLI

```bash
npm run build -w @flo/engine
node packages/engine/dist/cli.js https://github.com/owner/repo --users 5000 --url https://app.example.com --md report.md
node packages/engine/dist/cli.js ./path/to/local/app --no-ai
```

## How a scan works

1. **Source:** shallow clone into a temp dir. A token, if given, is passed as an HTTP header through git env config, so it never appears in argv, the remote URL or logs. The clone is deleted afterwards.
2. **Read:** text files up to 512 KB. Images, fonts and video are sized but never read. `node_modules`, build output and similar folders are skipped.
3. **Stack and project type:** dependencies, files and content signals decide frameworks, database, auth, payments, hosting and the AI builder used. The project is classified (local business, marketing site, SaaS, e-commerce, API, mobile) so that **only relevant checks run**.
4. **Rules (43):** line- and statement-level detectors with file:line evidence. Every snippet is redacted so the report never contains the secret it found. Examples: hardcoded keys, Supabase `service_role` in the browser (found by decoding JWTs), tables without RLS, `using (true)` policies, `SECURITY DEFINER` RPCs, unverified Stripe webhooks, client-set prices, mass assignment, SQL and command injection, XSS, SSRF, N+1 queries, `forEach(async)`, async `useEffect`.
5. **Checklist (74):** each item returns pass, fail, partial or verify, with evidence, refs, why it matters for this project, and how to fix it. Items cover security, data, performance, reliability, observability, delivery and code structure, plus SEO, conversion and compliance for public sites.
6. **Live probe (optional):** SSRF-guarded fetches of the home page, `robots.txt`, `sitemap.xml` and a random path (to catch soft 404s), plus security, compression and CDN headers and meta, OG, JSON-LD and alt-text parsing. Live results refine the code verdicts.
7. **Plan:** a deterministic planner sizes the architecture by expected users, team and budget (prototype, launch, growth or scale) and builds the roadmap (Fix now, Before launch, First month, When you grow). With an API key, Claude receives the structured analysis plus key file excerpts and returns a schema-validated plan (structured outputs, server-side refusal fallback). It falls back to the rule plan on any error.
8. **Score:** security, readiness, structure and growth sub-scores. Any critical finding caps the overall score at 49.

## Development

```bash
npm test                  # engine tests (vitest): sample app, clean app, SSRF guard, HTML parsing
npm run typecheck
npm run build
```

`packages/engine/src/fixtures/sample-clinic.ts` is a deliberately broken Lovable-style app (credential-shaped strings are assembled at runtime). It drives the tests, the landing-page preview and `/sample`.

### Adding a check

- **Finding rule** (an issue at a code location): add a `Rule` to `packages/engine/src/core/rules/*.ts`.
- **Checklist item** (a safeguard that should exist): add a `CheckDef` to `packages/engine/src/core/checklist/*.ts`. Use `appliesTo` and `when` so it only runs where it makes sense, and `live` if the deployed site can confirm it.

## Protecting Flo from being copied

- **Keep this repository private.** Everything below assumes the source isn't public.
- The engine (rules, checks, prompts, scoring) runs only on the server. It's never bundled for the browser, and production builds ship no source maps.
- API responses are `private, no-store` and `noindex`. Report reads and downloads are rate-limited per IP so reports can't be bulk-scraped, and report IDs are unguessable UUIDs.
- Set `NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` (Cloudflare Turnstile, free) to require a usually-invisible human check on scans and enquiries. This stops scripts using Flo as a free scanning API.
- The Terms forbid reverse-engineering, scraping and competitive use, and `LICENSE` is proprietary (all rights reserved).
- What can't be prevented: anyone can see the public pages and the content of reports they're given. The defensible parts are the engine and the speed you improve it.

## Security notes for running Flo itself

- Scans run in-process with a 3-scan concurrency cap and per-IP rate limits (in-memory; use Redis or Upstash with several instances).
- Live probing blocks private, loopback, link-local and metadata addresses and re-checks every redirect hop. The DNS check isn't pinned to the connection, so for a public multi-tenant deployment run scans in an isolated worker with egress rules.
- Reports are stored as JSON files keyed by an unguessable UUID and marked `noindex`. Add accounts before storing reports for paying users.
