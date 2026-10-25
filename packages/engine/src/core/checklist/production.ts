import {
  ANY_FILE,
  type CheckContext,
  type CheckDef,
  CODE_FILE,
  dep,
  fail,
  findingsFor,
  grep,
  managedEdge,
  na,
  pass,
  paths,
  plural,
  refsFromFindings,
  UI_FILE,
  unknown,
  warn,
} from "./context.js";

const backend = (ctx: CheckContext) => ctx.type.hasBackend;
const supabase = (ctx: CheckContext) => ctx.stack.database.some((d) => d.startsWith("Supabase"));

function fromFindings(ctx: CheckContext, ids: string[], okText: string, failText: (n: number) => string) {
  const f = findingsFor(ctx, ...ids);
  if (!f.length) return pass(okText);
  const critical = f.some((x) => x.severity === "critical" || x.severity === "high");
  return (critical ? fail : warn)(failText(f.length), refsFromFindings(f));
}

export const PRODUCTION_CHECKS: CheckDef[] = [
  // ───────────── Security ─────────────
  {
    id: "sec.rls",
    area: "Security",
    title: "Row Level Security on every table",
    when: supabase,
    priority: "must",
    relevance: "Your frontend talks to Supabase directly with the public anon key, so RLS policies are the only thing protecting your data.",
    howTo: "Enable RLS on every public table and write ownership policies (`auth.uid() = user_id`). Then log out and try reading each table with the anon key: every request should come back empty or 401.",
    evaluate(ctx) {
      const sql = ctx.project.files.some((f) => f.path.endsWith(".sql"));
      if (!sql) return unknown("No SQL migrations in the repo, so RLS can't be verified from code. Pull them with `supabase db pull` so they're versioned and checkable.");
      return fromFindings(ctx, ["supabase.rls-disabled", "supabase.policy-always-true", "supabase.grant-to-anon", "supabase.security-definer-rpc"], "Every table in the migrations has RLS enabled with scoped policies.", (n) => `${plural(n, "RLS / database permission problem")} found.`);
    },
  },
  {
    id: "sec.secrets",
    area: "Security",
    title: "Secrets kept out of code and the browser",
    priority: "must",
    relevance: "Leaked keys are the most common and most expensive vibe-coding incident: drained AI credits, stolen data, fraudulent charges.",
    howTo: "Rotate any leaked key, store secrets in your host's env settings, read them only in server code, and enable GitHub secret scanning + push protection.",
    evaluate: (ctx) =>
      fromFindings(ctx, ["secrets.hardcoded", "supabase.service-role-exposed", "env.secret-in-public-var", "ai.sdk-in-browser", "auth.hardcoded-jwt-secret"], "No secrets found in code or in browser-exposed variables.", (n) => `${plural(n, "secret exposure")} found.`),
  },
  {
    id: "sec.env-files",
    area: "Security",
    title: ".env files not committed",
    priority: "must",
    relevance: "A committed .env file puts every credential in git history forever. Deleting the file later doesn't remove it.",
    howTo: "Add `.env*` (but not `.env.example`) to .gitignore, `git rm --cached .env`, rotate the keys inside it, and purge history with git-filter-repo if the repo was ever shared.",
    evaluate(ctx) {
      const committed = ctx.project.allPaths.filter((p) => /(^|\/)\.env(\.(local|production|prod|development|dev|staging))?$/.test(p));
      if (committed.length) return fail(`${plural(committed.length, ".env file")} committed to the repo.`, committed.map((file) => ({ file })));
      const gi = ctx.project.files.find((f) => f.path === ".gitignore");
      if (!gi) return warn("No .gitignore, so a future .env would be committed.");
      if (!/^\s*\.env/m.test(gi.content) && !/^\s*\*\.env|\.env\*/m.test(gi.content)) return warn(".gitignore doesn't exclude .env files.", [{ file: ".gitignore" }]);
      return pass("No .env files are committed and .gitignore excludes them.");
    },
  },
  {
    id: "sec.server-auth",
    area: "Security",
    title: "Every API route checks the user",
    when: backend,
    priority: "must",
    relevance: "Hiding a button in the UI doesn't protect anything. Anyone can call your API directly with curl.",
    howTo: "Verify the session at the top of every handler (or in shared middleware), return 401 when it's missing, and scope every query to the authenticated user's id.",
    evaluate: (ctx) => fromFindings(ctx, ["auth.unprotected-api-route", "auth.jwt-not-verified", "db.client-sets-privileged-field", "db.mass-assignment"], "Server routes check the session before changing data.", (n) => `${plural(n, "route")} change data without a reliable auth check.`),
  },
  {
    id: "sec.payments",
    area: "Security",
    title: "Payment webhooks verified, prices set server-side",
    when: (ctx) => ctx.stack.payments.length > 0 || ctx.profile.handlesPayments,
    priority: "must",
    relevance: (ctx) => `You take payments${ctx.stack.payments.length ? ` with ${ctx.stack.payments.join(", ")}` : ""}. Unverified webhooks and client-side prices are how people get paid plans for free.`,
    howTo: "Verify webhook signatures, look up prices on the server from a product ID, make the webhook handler idempotent (store processed event IDs), and grant access only from the webhook.",
    evaluate(ctx) {
      const r = fromFindings(ctx, ["payments.webhook-unverified", "payments.client-controlled-amount"], "Webhooks verify signatures and amounts are set on the server.", (n) => `${plural(n, "payment flaw")} found.`);
      if (r.status !== "pass") return r;
      const webhook = grep(ctx, /constructEvent|webhook/i, CODE_FILE, 1);
      return webhook.length ? r : warn("Payments are integrated but no webhook handler was found, so access may be granted from the client-side redirect, which users can fake.");
    },
  },
  {
    id: "sec.rate-limiting",
    area: "Security",
    title: "Rate limiting on auth, forms and AI endpoints",
    when: backend,
    priority: (ctx) => (ctx.stack.ai.length ? "must" : "should"),
    relevance: (ctx) =>
      ctx.stack.ai.length
        ? `You call ${ctx.stack.ai.join(", ")} from your backend. Without per-user limits one script can run up thousands of dollars overnight.`
        : "Without limits, bots can brute-force logins, spam your forms and run up your database bill.",
    howTo: "Add `@upstash/ratelimit` (serverless) or `express-rate-limit`, keyed by user id or IP, on login, sign-up, contact forms and every AI route. Set provider-side spend caps too.",
    evaluate(ctx) {
      const d = dep(ctx, "@upstash/ratelimit", "express-rate-limit", "rate-limiter-flexible", "@fastify/rate-limit", "hono-rate-limiter", "slowapi", "@arcjet/next", "@unkey/ratelimit");
      const code = grep(ctx, /rateLimit|ratelimit|rate_limit|throttle\(/i, (f) => CODE_FILE(f) && !f.clientSide, 2);
      if (d || code.length) return pass(`Rate limiting is in place${d ? ` (${d})` : ""}.`, code);
      return fail("No rate limiting found on any endpoint.");
    },
  },
  {
    id: "sec.validation",
    area: "Security",
    title: "Input validation on the server",
    when: backend,
    priority: "must",
    relevance: "Anything the browser sends can be modified. Validating shape and size on the server stops injection, mass-assignment and crashes from malformed data.",
    howTo: "Define a zod (or valibot/pydantic) schema per endpoint and parse the body before using it: `const input = Schema.parse(await req.json())`. Share schemas with the frontend forms.",
    evaluate(ctx) {
      const d = dep(ctx, "zod", "valibot", "yup", "joi", "@sinclair/typebox", "class-validator", "superstruct", "arktype");
      const used = grep(ctx, /\.(parse|safeParse|validate)\(|z\.object\(/, (f) => CODE_FILE(f) && !f.clientSide, 2);
      if (d && used.length) return pass(`Server code validates input with ${d}.`, used);
      if (d) return warn(`${d} is installed but only used in the browser, so the server trusts its input.`);
      return fail("No input validation library is used.");
    },
  },
  {
    id: "sec.headers",
    area: "Security",
    title: "Security headers (CSP, HSTS, frame protection)",
    when: (ctx) => ctx.type.hasFrontend,
    priority: "should",
    relevance: "Headers like Content-Security-Policy and X-Frame-Options are a second line of defence against XSS and clickjacking, and are checked in every security questionnaire.",
    howTo: "Set `Content-Security-Policy`, `Strict-Transport-Security`, `X-Content-Type-Options: nosniff`, `Referrer-Policy` and `frame-ancestors 'none'` in `next.config` `headers()`, `vercel.json`, Netlify `_headers`, or with `helmet` on Express.",
    evaluate(ctx) {
      const refs = [...grep(ctx, /Content-Security-Policy|Strict-Transport-Security|X-Frame-Options|frame-ancestors|helmet\(/i, ANY_FILE, 3), ...paths(ctx, /(^|\/)(public\/)?_headers$/)];
      if (refs.length) return pass("Security headers are configured.", refs);
      return fail("No security headers configured.");
    },
    live(probe) {
      const h = probe.headers;
      const present = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy"].filter((k) => h[k]);
      if (present.length >= 4) return pass(`The live site sends ${present.length}/5 key security headers.`);
      const missing = ["content-security-policy", "strict-transport-security", "x-content-type-options", "x-frame-options", "referrer-policy"].filter((k) => !h[k]);
      return (present.length ? warn : fail)(`The live site is missing: ${missing.join(", ")}.`);
    },
  },
  {
    id: "sec.dependency-updates",
    area: "Security",
    title: "Automated dependency & vulnerability updates",
    when: (ctx) => Object.keys(ctx.project.deps).length > 0,
    priority: "should",
    relevance: "New vulnerabilities are found in popular packages every week. Without automation, nobody notices until it's exploited.",
    howTo: "Enable Dependabot (`.github/dependabot.yml`) or Renovate, and turn on GitHub secret scanning and code scanning.",
    evaluate(ctx) {
      const refs = paths(ctx, /(^|\/)\.github\/dependabot\.ya?ml$|renovate\.json5?$|\.renovaterc/);
      return refs.length ? pass("Automated dependency updates are configured.", refs) : fail("No Dependabot or Renovate config.");
    },
  },

  // ───────────── Data & database ─────────────
  {
    id: "data.migrations",
    area: "Data & database",
    title: "Schema changes tracked as migrations",
    when: (ctx) => ctx.stack.database.some((d) => !/Redis/.test(d)),
    priority: "must",
    relevance: "If the schema only exists in a dashboard, you can't review changes, roll back, recreate a staging copy or audit security policies.",
    howTo: (ctx) => (supabase(ctx) ? "Run `supabase db pull` to capture the current schema, commit `supabase/migrations/`, and make every change with `supabase migration new`." : "Use your ORM's migrations (`prisma migrate`, `drizzle-kit generate`) and commit them; never change production by hand."),
    evaluate(ctx) {
      const refs = paths(ctx, /(^|\/)(supabase\/migrations|prisma\/migrations|drizzle|migrations|alembic|db\/migrate)\//);
      if (refs.length) return pass(`${plural(ctx.project.allPaths.filter((p) => /migrations?\/.+\.(sql|ts|js|py|rb)$/.test(p)).length, "migration file")} committed.`, refs.slice(0, 2));
      if (ctx.stack.database.some((d) => d.startsWith("Firebase"))) return na("Firestore is schemaless. Keep security rules in the repo instead.");
      return fail("No migrations in the repo, so the schema lives only in the database.");
    },
  },
  {
    id: "data.backups",
    area: "Data & database",
    title: "Backups and a tested restore",
    when: (ctx) => ctx.stack.database.length > 0,
    priority: "must",
    relevance: "One bad migration, AI agent command or deleted row away from losing your customers' data. Backups you've never restored don't count.",
    howTo: (ctx) => (supabase(ctx) ? "Supabase Free has no downloadable backups. Upgrade to Pro (daily backups) or add PITR, and schedule a `supabase db dump` to object storage. Do a test restore into a fresh project once." : "Enable automated daily backups with point-in-time recovery on your database provider, and test a restore into a scratch database."),
    evaluate(ctx) {
      const refs = grep(ctx, /pg_dump|db dump|backup/i, (f) => /\.(ya?ml|sh|ts|js|json)$/.test(f.path), 2);
      return refs.length ? pass("A backup job is defined in the repo.", refs) : unknown("Backups are configured in your database dashboard, not the code. Confirm they're on and test a restore.");
    },
  },
  {
    id: "data.typed-client",
    area: "Data & database",
    title: "Typed database client",
    when: (ctx) => ctx.stack.database.length > 0 && ctx.stack.languages.includes("TypeScript"),
    priority: "later",
    relevance: "Generated types catch renamed columns and wrong shapes at build time instead of in production.",
    howTo: (ctx) => (supabase(ctx) ? "Generate types with `supabase gen types typescript --project-id <id> > src/types/database.ts` and pass them to `createClient<Database>()`." : "Use Prisma/Drizzle generated types end to end."),
    evaluate(ctx) {
      if (dep(ctx, "@prisma/client", "drizzle-orm", "kysely")) return pass("The ORM provides generated types.");
      const refs = [...paths(ctx, /database\.types\.ts$|types\/supabase\.ts$|supabase\/types\.ts$/), ...grep(ctx, /createClient<Database>/, CODE_FILE, 1)];
      return refs.length ? pass("Database types are generated.", refs) : fail("Database queries are untyped.");
    },
  },
  {
    id: "data.staging",
    area: "Data & database",
    title: "Separate staging/dev environment",
    when: (ctx) => ctx.stack.database.length > 0,
    priority: (ctx) => (ctx.profile.teamSize > 1 ? "should" : "later"),
    relevance: "Testing against the production database means one experiment can corrupt real customer data.",
    howTo: "Create a second database project for development (Supabase branching or a free project), use preview deployments, and keep production keys only in production env settings.",
    evaluate(ctx) {
      const refs = [...paths(ctx, /\.env\.(staging|development|preview)(\.example)?$|supabase\/seed\.sql$/), ...grep(ctx, /staging|preview/i, (f) => /\.github\/workflows\/|vercel\.json|netlify\.toml|fly\.toml/.test(f.path), 2)];
      return refs.length ? pass("Separate environments are configured.", refs) : unknown("No sign of a staging environment in the repo.");
    },
  },

  // ───────────── Reliability ─────────────
  {
    id: "rel.error-tracking",
    area: "Reliability",
    title: "Error tracking (Sentry or similar)",
    priority: "must",
    relevance: "Without error tracking you find out about bugs from angry customers, or never, because they just leave.",
    howTo: "Install Sentry (`npx @sentry/wizard@latest -i nextjs` / `-i reactNative`, or `@sentry/react`), upload source maps, and alert on new issues.",
    evaluate(ctx) {
      const d = dep(ctx, "@sentry/*", "@bugsnag/*", "@highlight-run/*", "logrocket", "@rollbar/*", "rollbar", "@datadog/browser-rum", "posthog-js", "@honeybadger-io/*");
      return d ? pass(`Errors are reported with ${d.replace("*", "…")}.`) : fail("No error tracking installed.");
    },
  },
  {
    id: "rel.error-boundaries",
    area: "Reliability",
    title: "Error boundaries in the UI",
    when: (ctx) => ctx.type.hasFrontend && "react" in ctx.project.deps,
    priority: "should",
    relevance: "In React, one component throwing turns the whole page white. An error boundary shows a fallback and keeps the rest working.",
    howTo: (ctx) => (ctx.stack.frameworks.includes("Next.js") ? "Add `app/error.tsx` and `app/global-error.tsx` with a friendly message and a retry button; report errors to Sentry inside them." : "Wrap routes in `<ErrorBoundary fallback={<ErrorScreen />}>` from `react-error-boundary`."),
    evaluate(ctx) {
      const refs = [...paths(ctx, /(^|\/)app\/(.*\/)?(global-)?error\.(t|j)sx$/), ...grep(ctx, /ErrorBoundary|componentDidCatch|errorElement=/, UI_FILE, 2)];
      return refs.length ? pass("Error boundaries are in place.", refs) : fail("No error boundaries, so one crash blanks the page.");
    },
  },
  {
    id: "rel.health-check",
    area: "Reliability",
    title: "Health-check endpoint",
    when: (ctx) => ctx.type.hasBackend && ctx.stack.frameworks.some((f) => ["Express", "Fastify", "Hono", "NestJS", "Django", "FastAPI", "Flask", "Rails", "Laravel", "Next.js"].includes(f)),
    priority: "should",
    relevance: "Load balancers, uptime monitors and deploy tooling need a URL that tells them whether the app (and its database) is healthy.",
    howTo: "Add `GET /api/health` that checks the DB with a cheap query and returns `{ ok: true }` (200) or 503, and point your uptime monitor at it.",
    evaluate(ctx) {
      const refs = [...paths(ctx, /health|healthz|status\/route/i), ...grep(ctx, /["'`]\/(api\/)?(health|healthz|ping|status)["'`]/, CODE_FILE, 2)];
      return refs.length ? pass("A health endpoint exists.", refs) : fail("No health-check endpoint.");
    },
  },
  {
    id: "rel.timeouts",
    area: "Reliability",
    title: "Timeouts on external calls",
    when: (ctx) => ctx.type.hasBackend && grep(ctx, /\bfetch\(|axios/, (f) => CODE_FILE(f) && !f.clientSide, 1).length > 0,
    priority: "should",
    relevance: "A slow third-party API without a timeout ties up your server (or serverless function) until it's killed, and you pay for the wait.",
    howTo: "Pass `signal: AbortSignal.timeout(10_000)` to fetch (or `timeout` to axios), and retry idempotent calls with backoff.",
    evaluate(ctx) {
      const refs = grep(ctx, /AbortSignal\.timeout|AbortController|timeout\s*:/, (f) => CODE_FILE(f) && !f.clientSide, 2);
      return refs.length ? pass("External calls set timeouts.", refs) : warn("Server-side fetch/axios calls have no timeouts.");
    },
  },
  {
    id: "rel.background-jobs",
    area: "Reliability",
    title: "Slow work runs in background jobs",
    when: (ctx) => ctx.type.hasBackend && (ctx.stack.ai.length > 0 || grep(ctx, /sendEmail|resend\.emails|sgMail|nodemailer|transporter\.sendMail/i, CODE_FILE, 1).length > 0),
    priority: (ctx) => (ctx.profile.expectedUsers >= 10_000 ? "should" : "later"),
    relevance: "Emails, AI generations and webhooks done inside the request make users wait, and are lost when the request times out.",
    howTo: "Move them to a queue: Inngest, Trigger.dev, QStash, Supabase Queues/pg_cron, or BullMQ on Redis, with retries and a dead-letter view.",
    evaluate(ctx) {
      const d = dep(ctx, "inngest", "@trigger.dev/sdk", "@upstash/qstash", "bullmq", "bull", "pg-boss", "graphile-worker", "@vercel/functions", "celery");
      return d ? pass(`Background jobs run with ${d}.`) : warn("Slow work (email/AI) runs inline in requests.");
    },
  },

  // ───────────── Observability ─────────────
  {
    id: "obs.logging",
    area: "Observability",
    title: "Structured server logs",
    when: backend,
    priority: "should",
    relevance: "When a customer says \"it didn't work\", searchable logs with a user id and request id are how you find out why in minutes, not hours.",
    howTo: "Use pino (or your platform's logger) to log JSON with `userId`, `requestId` and timing, ship it to Axiom/Better Stack/Logtail, and never log secrets.",
    evaluate(ctx) {
      const d = dep(ctx, "pino", "winston", "@logtail/*", "@axiomhq/*", "next-axiom", "bunyan", "consola", "@opentelemetry/*", "structlog");
      return d ? pass(`Structured logging with ${d.replace("*", "…")}.`) : warn("Only console.log, no structured, searchable logs.");
    },
  },
  {
    id: "obs.uptime",
    area: "Observability",
    title: "Uptime monitoring & alerts",
    priority: "should",
    relevance: "You should know your site is down before your customers tell you.",
    howTo: "Add a free monitor (Better Stack, UptimeRobot, Checkly) on the home page and `/api/health`, alerting to email/Slack/WhatsApp.",
    evaluate(ctx) {
      const refs = grep(ctx, /checkly|uptimerobot|betteruptime|betterstack|statuspage|instatus/i, ANY_FILE, 1);
      return refs.length ? pass("Uptime monitoring is configured in code.", refs) : unknown("Uptime monitors live outside the repo. Confirm one exists.");
    },
  },

  // ───────────── Delivery ─────────────
  {
    id: "del.ci",
    area: "Delivery",
    title: "CI runs checks on every push",
    priority: "should",
    relevance: "AI edits regularly break things far from the change. CI that builds, lints and tests every push catches it before your users do.",
    howTo: "Add `.github/workflows/ci.yml` that runs `npm ci`, typecheck, lint, tests and `npm run build` on every pull request; block merging when it fails.",
    evaluate(ctx) {
      const wf = ctx.project.files.filter((f) => /^\.github\/workflows\/.+\.ya?ml$/.test(f.path) || f.path === ".gitlab-ci.yml");
      if (!wf.length) return fail("No CI pipeline.");
      const all = wf.map((f) => f.content).join("\n");
      const runs = ["build", "test", "lint", "typecheck|tsc"].filter((s) => new RegExp(s).test(all));
      return runs.length >= 3 ? pass(`CI runs ${runs.join(", ")}.`, wf.map((f) => ({ file: f.path }))) : warn(`CI exists but only runs: ${runs.join(", ") || "nothing useful"}.`, wf.map((f) => ({ file: f.path })));
    },
  },
  {
    id: "del.tests",
    area: "Delivery",
    title: "Automated tests for critical flows",
    priority: (ctx) => (ctx.stack.payments.length ? "must" : "should"),
    relevance: (ctx) => `Sign-up, login${ctx.stack.payments.length ? ", checkout" : ""} and your core action should be tested so the next AI-generated change can't silently break them.`,
    howTo: "Add Playwright end-to-end tests for sign-up → core action → payment, and Vitest unit tests for pricing/permission logic. Run them in CI.",
    evaluate(ctx) {
      const { testFiles, sourceFiles } = ctx.structure;
      if (testFiles === 0) return fail(`0 tests for ${plural(sourceFiles, "source file")}.`);
      const e2e = dep(ctx, "@playwright/test", "cypress");
      const ratio = testFiles / Math.max(sourceFiles, 1);
      if (ratio < 0.05 && !e2e) return warn(`${plural(testFiles, "test file")} for ${plural(sourceFiles, "source file")} and no end-to-end tests.`);
      return pass(`${plural(testFiles, "test file")}${e2e ? ` plus ${e2e} end-to-end tests` : ""}.`);
    },
  },
  {
    id: "del.env-example",
    area: "Delivery",
    title: ".env.example documents every variable",
    when: (ctx) => ctx.structure.envVarsUsed.length > 0,
    priority: "should",
    relevance: "Missing env vars are the #1 \"works locally, broken in production\" cause in vibe-coded apps.",
    howTo: "Commit `.env.example` listing every variable with a placeholder and a comment, and validate them at startup (`@t3-oss/env-nextjs` or a zod schema) so a missing one fails the deploy, not a user request.",
    evaluate(ctx) {
      const ex = ctx.project.files.find((f) => /(^|\/)\.env\.(example|sample|template)$/.test(f.path));
      const used = ctx.structure.envVarsUsed.filter((v) => !/^(NODE_ENV|PORT|CI|VERCEL|VERCEL_\w+|NEXT_RUNTIME|DEV|PROD|MODE|BASE_URL|SSR)$/.test(v));
      if (!ex) return fail(`${plural(used.length, "env variable")} used, but there's no .env.example.`);
      const documented = new Set([...ex.content.matchAll(/^([A-Z][A-Z0-9_]+)\s*=/gm)].map((m) => m[1]!));
      const missing = used.filter((v) => !documented.has(v));
      return missing.length ? warn(`.env.example is missing ${missing.slice(0, 6).join(", ")}${missing.length > 6 ? "…" : ""}.`, [{ file: ex.path }]) : pass("Every env variable is documented.", [{ file: ex.path }]);
    },
  },
  {
    id: "del.env-validation",
    area: "Delivery",
    title: "Env vars validated at startup",
    when: (ctx) => ctx.structure.envVarsUsed.length > 3,
    priority: "later",
    relevance: "A typo in one env var otherwise surfaces as a confusing runtime error deep inside a user request.",
    howTo: "Parse env once with zod (`@t3-oss/env-nextjs` or `z.object({...}).parse(process.env)`) and import config from that module everywhere.",
    evaluate(ctx) {
      const refs = [...(dep(ctx, "@t3-oss/env-nextjs", "@t3-oss/env-core", "envalid", "env-var") ? [{ file: "package.json" }] : []), ...grep(ctx, /\.parse\(\s*process\.env|createEnv\(/, CODE_FILE, 1)];
      return refs.length ? pass("Environment is validated on startup.", refs) : warn("Env vars are read ad hoc with no validation.");
    },
  },
  {
    id: "del.strict-types",
    area: "Delivery",
    title: "TypeScript strict mode",
    when: (ctx) => ctx.stack.languages.includes("TypeScript"),
    priority: "should",
    relevance: "Lovable/Vite templates ship with `strict: false` and `noImplicitAny: false`, which lets whole classes of null/undefined bugs through.",
    howTo: "Set `\"strict\": true` in tsconfig, fix errors file by file (or with `// @ts-expect-error` + a TODO), and run `tsc --noEmit` in CI.",
    evaluate(ctx) {
      const configs = ctx.project.files.filter((f) => /(^|\/)tsconfig(\.app)?\.json$/.test(f.path) && !f.path.includes("node_modules"));
      if (!configs.length) return unknown("No tsconfig found.");
      const strict = configs.some((f) => /"strict"\s*:\s*true/.test(f.content));
      const loose = configs.find((f) => /"strict"\s*:\s*false|"noImplicitAny"\s*:\s*false|"strictNullChecks"\s*:\s*false/.test(f.content));
      if (loose) return fail("TypeScript strict checks are switched off.", [{ file: loose.path }]);
      return strict ? pass("strict mode is on.") : warn("strict mode isn't enabled.", configs.map((f) => ({ file: f.path })));
    },
  },
  {
    id: "del.lint",
    area: "Delivery",
    title: "Linting and formatting",
    priority: "later",
    relevance: "A linter catches unused variables, missing hook dependencies and unsafe patterns before they ship.",
    howTo: "Use ESLint (with `react-hooks` and `@typescript-eslint`) or Biome, plus Prettier, and run them in CI.",
    evaluate(ctx) {
      const refs = paths(ctx, /(^|\/)(eslint\.config\.(m?js|ts)|\.eslintrc(\.\w+)?|biome\.jsonc?|\.prettierrc(\.\w+)?|ruff\.toml)$/);
      return refs.length ? pass("Lint/format config found.", refs) : fail("No linter configured.");
    },
  },
  {
    id: "del.readme",
    area: "Delivery",
    title: "README with setup instructions",
    priority: (ctx) => (ctx.profile.teamSize > 1 ? "should" : "later"),
    relevance: "A new developer (or you, in six months) should get the app running in 10 minutes without asking anyone.",
    howTo: "Document prerequisites, env setup, how to run locally, run tests, run migrations and deploy.",
    evaluate(ctx) {
      const r = ctx.project.files.find((f) => /^readme\.md$/i.test(f.path));
      if (!r) return fail("No README.");
      if (/Welcome to your Lovable project|This project was bootstrapped with|create-next-app|Vite \+ React/i.test(r.content)) return fail("README is still the builder's template.", [{ file: r.path }]);
      return r.content.length > 500 ? pass("README documents the project.", [{ file: r.path }]) : warn("README is very short.", [{ file: r.path }]);
    },
  },
  {
    id: "del.preview-deploys",
    area: "Delivery",
    title: "Preview deploys and rollback",
    priority: "later",
    relevance: "Being able to click a preview URL before merging, and roll back in one click, turns scary deploys into routine ones.",
    howTo: "Connect the repo to Vercel/Netlify/Cloudflare Pages for automatic preview deploys per PR, and keep production deploys on the main branch only.",
    evaluate(ctx) {
      const edge = managedEdge(ctx);
      return edge ? pass(`${edge} provides preview deploys and instant rollback.`) : unknown("Deployment isn't configured in the repo.");
    },
  },

  // ───────────── Code structure ─────────────
  {
    id: "struct.layers",
    area: "Code structure",
    title: "Data access separated from UI components",
    when: (ctx) => ctx.type.hasFrontend,
    priority: "should",
    relevance: "When every component queries the database itself, the same logic is copied everywhere, and changing a table means hunting through dozens of files. That's the root of \"patch-work\" codebases.",
    howTo: "Move queries into `src/services/` (or `lib/data/`) functions, wrap them in hooks (`useProjects()` with TanStack Query), and keep components purely presentational.",
    evaluate(ctx) {
      const n = ctx.structure.dataAccessInUi.length;
      if (n === 0) return pass("Components don't query the database directly.");
      return (n > 3 ? fail : warn)(`${plural(n, "UI component")} query the database directly.`, ctx.structure.dataAccessInUi.slice(0, 5));
    },
  },
  {
    id: "struct.god-files",
    area: "Code structure",
    title: "No oversized \"god\" files",
    priority: "should",
    relevance: "Files over ~400 lines mix several responsibilities. AI tools edit them unreliably (the regression loops vibe coders complain about) and humans can't review them.",
    howTo: "Split by responsibility: extract subcomponents, hooks and service functions; aim for files under 250 lines.",
    evaluate(ctx) {
      const g = ctx.structure.godFiles;
      if (!g.length) return pass("No file is over 400 lines.");
      return (g.length > 3 ? fail : warn)(`${plural(g.length, "file")} over 400 lines (largest: ${g[0]!.path}, ${g[0]!.lines} lines).`, g.slice(0, 5).map((x) => ({ file: x.path, snippet: `${x.lines} lines` })));
    },
  },
  {
    id: "struct.duplication",
    area: "Code structure",
    title: "Little copy-pasted code",
    priority: "later",
    relevance: "Duplicated blocks mean a bug fixed in one place stays broken in the others.",
    howTo: "Extract the shared block into one function/component and reuse it.",
    evaluate(ctx) {
      const d = ctx.structure.duplicateBlocks;
      if (!d.length) return pass("No significant duplicated blocks.");
      return (d.length > 5 ? fail : warn)(`${plural(d.length, "duplicated block")} across files.`, d.slice(0, 5).map((x) => ({ file: x.a, line: x.aLine, snippet: `also in ${x.b}:${x.bLine}` })));
    },
  },
  {
    id: "struct.type-safety",
    area: "Code structure",
    title: "Minimal use of `any`",
    when: (ctx) => ctx.stack.languages.includes("TypeScript"),
    priority: "later",
    relevance: "Each `any` switches off the compiler for that value, so wrong data shapes reach production.",
    howTo: "Replace `any` with real types or `unknown` + a zod parse at the boundary.",
    evaluate(ctx) {
      const n = ctx.structure.anyCount;
      if (n <= 5) return pass(`${plural(n, "use")} of any.`);
      return (n > 30 ? fail : warn)(`${plural(n, "use")} of \`any\`.`);
    },
  },
];

