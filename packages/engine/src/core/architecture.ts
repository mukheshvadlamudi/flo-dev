import type {
  ArchitectureComponent,
  ArchitecturePlan,
  ChecklistItem,
  Finding,
  ProjectType,
  RoadmapPhase,
  RoadmapStep,
  ScaleTier,
  Stack,
  StructureReport,
  UserProfile,
} from "./types.js";

export function tierFor(users: number): ScaleTier {
  if (users < 500) return "prototype";
  if (users < 10_000) return "launch";
  if (users < 100_000) return "growth";
  return "scale";
}

const TIER_SUMMARY: Record<ScaleTier, string> = {
  prototype: "Keep it simple: one managed platform, one database, no extra moving parts. Spend the time on security basics and getting real users.",
  launch: "Stay on managed services, but add the production basics: migrations, backups, error tracking, rate limits and CI. No Kubernetes, no microservices.",
  growth: "Your bottlenecks will be the database and slow synchronous work. Add pooling, indexes, caching and a job queue before adding servers.",
  scale: "Plan for horizontal scale: stateless app servers behind a load balancer, read replicas, Redis, queues, and per-service observability.",
};

const listOr = (xs: string[], fallback: string) => (xs.length ? xs.join(" + ") : fallback);

export function planArchitecture(stack: Stack, type: ProjectType, profile: UserProfile, structure: StructureReport, findings: Finding[], checklist: ChecklistItem[]): ArchitecturePlan {
  const tier = tierFor(profile.expectedUsers);
  const big = tier === "growth" || tier === "scale";
  const tight = profile.monthlyBudgetUsd < 50;
  const isSupabase = stack.database.some((d) => d.startsWith("Supabase"));
  const isFirebase = stack.database.some((d) => d.startsWith("Firebase"));
  const next = stack.frameworks.includes("Next.js");
  const spa = !next && stack.frameworks.some((f) => ["React", "Vite", "Vue"].includes(f));
  const publicSite = type.kinds.some((k) => ["local-business", "marketing-site", "ecommerce"].includes(k));
  const failed = (id: string) => checklist.find((c) => c.id === id && (c.status === "fail" || c.status === "warn"));
  const c: ArchitectureComponent[] = [];

  if (type.hasFrontend) {
    const hostingNow = listOr(stack.hosting.filter((h) => h !== "Docker"), "not defined in repo");
    if (spa && publicSite) {
      c.push({ layer: "Frontend", current: `${listOr(stack.frameworks.filter((f) => ["React", "Vite", "Vue"].includes(f)), "SPA")} (client-rendered)`, recommended: "Next.js (or Astro) for public pages, keep the SPA for the logged-in app", why: "Client-rendered SPAs send search engines an empty HTML shell, so every route shares one title/description. Pre-rendering public pages fixes SEO and first-load speed.", change: "replace" });
    } else {
      c.push({ layer: "Frontend", current: listOr(stack.frameworks.filter((f) => !["Express", "Fastify", "Hono", "NestJS", "tRPC"].includes(f)), "unknown"), recommended: "Keep the current framework", why: "Rewrites rarely pay off; fix structure inside the framework you have.", change: "keep" });
    }
    c.push({ layer: "Hosting + CDN", current: hostingNow, recommended: big ? "Vercel / Cloudflare Pages (global CDN, autoscaling) with caching headers on static assets" : "Vercel, Netlify or Cloudflare Pages (free tier, CDN + preview deploys included)", why: "Managed hosting gives you CDN, TLS, load balancing, preview deploys and rollbacks with zero ops work.", change: stack.hosting.some((h) => ["Vercel", "Netlify", "Cloudflare"].includes(h)) ? "keep" : "add" });
  }

  if (type.hasBackend || stack.database.length) {
    const apiNow = isSupabase ? `Supabase client from the browser${structure.routes.some((r) => r.includes("(API)")) ? " + API routes" : ""}` : listOr(stack.frameworks.filter((f) => ["Express", "Fastify", "Hono", "NestJS", "tRPC", "Next.js", "Django", "FastAPI", "Flask", "Rails", "Laravel"].includes(f)), "none");
    const trustedNeeded = stack.payments.length > 0 || stack.ai.length > 0 || findings.some((f) => f.ruleId === "db.client-sets-privileged-field");
    c.push({
      layer: "API / server logic",
      current: apiNow,
      recommended: isSupabase
        ? trustedNeeded
          ? "Browser → Supabase (RLS) for simple CRUD; Edge Functions / server routes for payments, AI calls, emails and anything privileged"
          : "Browser → Supabase with strict RLS; move business rules into Postgres functions or Edge Functions as they appear"
        : next
          ? "Next.js Route Handlers / Server Actions with a shared auth + validation wrapper"
          : "One API service with shared auth, validation (zod) and error middleware",
      why: "Anything that touches money, secrets, or another user's data must run on the server, where the user can't modify it.",
      change: trustedNeeded && isSupabase ? "add" : "keep",
    });
  }

  if (stack.auth.length || type.kinds.includes("saas-app")) {
    c.push({ layer: "Auth", current: listOr(stack.auth, "none detected"), recommended: stack.auth.length ? `${stack.auth[0]} with server-side session checks and HttpOnly cookies` : isSupabase ? "Supabase Auth with @supabase/ssr cookies" : "Clerk, Better Auth or Auth.js — never hand-rolled", why: "Auth is the most attacked part of any app; use a provider and verify the session on the server on every request.", change: stack.auth.length ? "keep" : "add" });
  }

  if (stack.database.length || type.hasBackend) {
    const db = stack.database.filter((d) => !/Redis/.test(d));
    c.push({ layer: "Database", current: listOr(db, "none"), recommended: isFirebase && type.kinds.includes("saas-app") && big ? "Postgres (Supabase/Neon) for relational data; keep Firestore only for realtime documents" : db.length ? `${db[0]} with migrations in git, RLS/least-privilege roles and indexes on every foreign key` : "Managed Postgres (Supabase or Neon)", why: "Relational data with constraints and migrations keeps the app consistent as features pile up.", change: db.length ? "keep" : "add" });
    if (big || failed("data.pooling")) {
      c.push({ layer: "Connection pooling", current: failed("data.pooling") ? "direct connections" : "pooled", recommended: isSupabase ? "Supavisor transaction pooler (port 6543) for all serverless DB access" : "PgBouncer / provider pooler; one client per process", why: "Serverless functions open a connection per invocation and exhaust Postgres limits during spikes.", change: failed("data.pooling") ? "add" : "keep" });
    }
    c.push({ layer: "Backups", current: "unknown (dashboard setting)", recommended: tight && tier === "prototype" ? "Weekly `pg_dump` to object storage via a scheduled GitHub Action" : "Daily automated backups + point-in-time recovery; quarterly restore test", why: "The cheapest insurance you'll ever buy against a bad migration or AI agent command.", change: "add" });
  }

  const hasCache = stack.database.some((d) => /Redis/.test(d));
  c.push({ layer: "Caching", current: hasCache ? "Redis" : failed("perf.api-caching") ? "none" : "client-side query cache", recommended: big ? "TanStack Query on the client + Redis (Upstash) for expensive queries + CDN caching for public pages" : "TanStack Query on the client and Cache-Control headers on public data; add Redis later", why: "Most screens re-request identical data. Caching is cheaper than scaling the database.", change: big && !hasCache ? "add" : tier === "prototype" ? "later" : "add" });

  if (stack.ai.length || stack.payments.length || big) {
    c.push({ layer: "Background jobs", current: failed("rel.background-jobs") ? "inline in requests" : "—", recommended: "Inngest / Trigger.dev / QStash (serverless) or BullMQ (containers) with retries", why: "Emails, AI generations and webhook processing shouldn't make users wait or be lost on timeouts.", change: big ? "add" : "later" });
  }

  if (type.hasBackend) {
    c.push({ layer: "Load balancing & scaling", current: stack.hosting.length ? stack.hosting.join(", ") : "single instance / unknown", recommended: tier === "scale" ? "2+ stateless instances per region behind a load balancer, autoscaling on CPU/latency, read replicas for the DB" : "Platform-managed autoscaling (serverless). Keep servers stateless so you can add instances later", why: "Horizontal scaling only works when no session or file lives in one server's memory or disk.", change: tier === "scale" ? "add" : "keep" });
    c.push({ layer: "Rate limiting / abuse", current: failed("sec.rate-limiting") ? "none" : "present", recommended: stack.ai.length ? "Per-user + per-IP limits on AI and auth routes (Upstash Ratelimit), provider spend caps, Cloudflare WAF on the domain" : "Per-IP limits on auth and forms; Cloudflare in front of the domain", why: "Bots find new apps within days; unthrottled AI routes are a blank cheque.", change: failed("sec.rate-limiting") ? "add" : "keep" });
  }

  c.push({ layer: "Observability", current: failed("rel.error-tracking") ? "none" : "error tracking", recommended: big ? "Sentry (errors + performance), structured logs to Axiom/Better Stack, uptime checks, product analytics" : "Sentry free tier + uptime monitor + analytics", why: "You can't fix what you can't see.", change: failed("rel.error-tracking") ? "add" : "keep" });
  c.push({ layer: "CI/CD", current: stack.hasCI ? "CI configured" : "manual / builder deploys", recommended: "GitHub Actions: typecheck, lint, tests, build on every PR; preview deploys; migrations applied in the pipeline", why: "Stops AI-generated regressions before they reach users.", change: stack.hasCI ? "keep" : "add" });

  const antiPatterns: ArchitecturePlan["antiPatterns"] = [];
  if (structure.dataAccessInUi.length > 2) antiPatterns.push({ title: "Database queries scattered through UI components", detail: `${structure.dataAccessInUi.length} components query the database directly. Centralise them in a data layer so rules live in one place.`, refs: structure.dataAccessInUi.slice(0, 4) });
  if (structure.godFiles.length) antiPatterns.push({ title: "Oversized files", detail: `${structure.godFiles.length} files exceed 400 lines; AI edits to these cause regression loops.`, refs: structure.godFiles.slice(0, 4).map((g) => ({ file: g.path, snippet: `${g.lines} lines` })) });
  if (findings.some((f) => f.ruleId === "db.client-sets-privileged-field" || f.ruleId === "supabase.service-role-exposed")) antiPatterns.push({ title: "Trusting the browser with privileged decisions", detail: "Billing state or admin access is decided in client code. Move those writes to the server.", refs: findings.filter((f) => f.ruleId === "db.client-sets-privileged-field" || f.ruleId === "supabase.service-role-exposed").slice(0, 3).map((f) => ({ file: f.file ?? "", line: f.line, snippet: f.snippet })) });
  if (structure.duplicateBlocks.length > 3) antiPatterns.push({ title: "Copy-paste patches", detail: `${structure.duplicateBlocks.length} duplicated blocks — typical of fixes applied by prompting instead of refactoring.`, refs: structure.duplicateBlocks.slice(0, 3).map((d) => ({ file: d.a, line: d.aLine, snippet: `duplicated in ${d.b}` })) });
  if (!structure.layers.find((l) => l.name === "Database migrations")?.present && stack.database.length) antiPatterns.push({ title: "Schema lives only in the dashboard", detail: "Without migrations in git, nobody can review or reproduce database changes.", refs: [] });

  return { tier, summary: TIER_SUMMARY[tier], components: c, antiPatterns, folderStructure: folderTree(stack, type), author: "rules" };
}

function folderTree(stack: Stack, type: ProjectType): string {
  if (stack.frameworks.includes("Next.js")) {
    return `src/
├─ app/
│  ├─ (marketing)/        # public pages: page.tsx + metadata per route
│  ├─ (app)/              # logged-in screens, protected in layout.tsx
│  ├─ api/                # route handlers (webhooks, health)
│  ├─ not-found.tsx  error.tsx  robots.ts  sitemap.ts
├─ components/
│  ├─ ui/                 # shadcn primitives
│  └─ <feature>/          # feature components, presentational
├─ server/
│  ├─ db/                 # queries & repositories (only place that talks to the DB)
│  ├─ services/           # business logic: billing, emails, AI
│  └─ auth.ts             # getUser() / requireUser()
├─ lib/                   # env.ts (zod-validated), utils, clients
└─ types/                 # generated DB types, shared zod schemas
supabase/migrations/      # or prisma/ — schema in git
tests/ (unit)  e2e/ (Playwright)`;
  }
  if (type.hasFrontend) {
    return `src/
├─ pages/                 # one file per route, thin
├─ components/
│  ├─ ui/                 # shadcn primitives
│  └─ <feature>/          # presentational components
├─ features/<feature>/
│  ├─ api.ts              # all Supabase/API calls for this feature
│  ├─ hooks.ts            # useX() wrappers with TanStack Query
│  └─ schema.ts           # zod schemas shared with forms
├─ lib/                   # supabase client, env.ts, utils
└─ types/database.ts      # supabase gen types
supabase/
├─ migrations/            # every schema + RLS change, in git
└─ functions/             # Edge Functions: payments, webhooks, AI
e2e/                      # Playwright tests for sign-up → pay`;
  }
  return `src/
├─ routes/        # HTTP layer only: parse, validate, call service
├─ services/      # business logic
├─ db/            # queries, migrations
├─ middleware/    # auth, rate limit, errors
├─ jobs/          # background workers
└─ config/env.ts  # validated configuration
tests/`;
}

const EFFORT: Record<string, RoadmapStep["effort"]> = {
  "secrets.hardcoded": "minutes",
  "supabase.service-role-exposed": "hours",
  "env.secret-in-public-var": "hours",
  "supabase.rls-disabled": "hours",
  "payments.webhook-unverified": "hours",
  "seo.robots": "minutes",
  "seo.sitemap": "minutes",
  "seo.og-images": "minutes",
  "seo.meta-descriptions": "minutes",
  "comp.analytics": "minutes",
  "conv.click-to-call": "minutes",
  "conv.response-time": "minutes",
  "seo.custom-404": "minutes",
  "sec.env-files": "minutes",
  "struct.layers": "days",
  "struct.god-files": "days",
  "del.tests": "days",
  "seo.unique-titles": "hours",
};

export function buildRoadmap(findings: Finding[], checklist: ChecklistItem[]): RoadmapStep[] {
  const steps: RoadmapStep[] = [];
  const byRule = new Map<string, Finding[]>();
  for (const f of findings) byRule.set(f.ruleId, [...(byRule.get(f.ruleId) ?? []), f]);
  const covered = new Set<string>();

  for (const [ruleId, fs] of byRule) {
    const worst = fs[0]!;
    if (worst.severity === "info") continue;
    const phase: RoadmapPhase = worst.severity === "critical" || (worst.severity === "high" && worst.category === "security") ? "Fix now" : worst.severity === "high" || worst.severity === "medium" ? "Before launch" : "First month";
    const where = fs.length > 1 ? ` (${fs.length} places, starting with ${worst.file}${worst.line ? `:${worst.line}` : ""})` : worst.file ? ` (${worst.file}${worst.line ? `:${worst.line}` : ""})` : "";
    steps.push({ phase, title: worst.title.replace(/ in \S+$/, ""), detail: `${worst.fix}${where}`, resolves: [ruleId], effort: EFFORT[ruleId] ?? "hours" });
    covered.add(ruleId);
  }

  const RELATED: Record<string, string[]> = {
    "sec.rls": ["supabase.rls-disabled", "supabase.policy-always-true"],
    "sec.secrets": ["secrets.hardcoded", "supabase.service-role-exposed", "env.secret-in-public-var"],
    "sec.payments": ["payments.webhook-unverified"],
    "sec.server-auth": ["auth.unprotected-api-route"],
    "perf.n-plus-one": ["perf.n-plus-one"],
    "perf.pagination": ["perf.unpaginated-query"],
    "perf.debounce": ["perf.undebounced-search"],
    "perf.lazy-images": ["perf.unoptimized-images"],
  };
  for (const item of checklist) {
    if (item.status === "pass" || (item.status === "unknown" && item.priority !== "must")) continue;
    if ((RELATED[item.id] ?? []).some((r) => covered.has(r))) continue;
    const phase: RoadmapPhase = item.priority === "must" ? (item.area === "Security" ? "Fix now" : "Before launch") : item.priority === "should" ? "First month" : "When you grow";
    steps.push({ phase, title: item.status === "unknown" ? `Confirm: ${item.title.toLowerCase()}` : item.title, detail: item.howTo, resolves: [item.id], effort: EFFORT[item.id] ?? (item.priority === "later" ? "days" : "hours") });
  }

  const order: RoadmapPhase[] = ["Fix now", "Before launch", "First month", "When you grow"];
  return steps.sort((a, b) => order.indexOf(a.phase) - order.indexOf(b.phase));
}
