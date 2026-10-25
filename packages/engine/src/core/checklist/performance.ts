import {
  ANY_FILE,
  type CheckContext,
  type CheckDef,
  CODE_FILE,
  dep,
  fail,
  findingsFor,
  grep,
  grepCount,
  managedEdge,
  na,
  pass,
  paths,
  plural,
  refsFromFindings,
  UI_FILE,
  unknown,
  warn,
  WEB_KINDS,
} from "./context.js";

const frontend = (ctx: CheckContext) => ctx.type.hasFrontend;
const backend = (ctx: CheckContext) => ctx.type.hasBackend;
const bigAudience = (ctx: CheckContext) => ctx.profile.expectedUsers >= 10_000;
const scalePriority = (ctx: CheckContext) => (ctx.profile.expectedUsers >= 50_000 ? "should" : "later") as "should" | "later";

/** Packages used only via config, CLI or types, which never appear in an import. */
const IMPLICIT_DEPS = /^(@types\/|typescript$|eslint|prettier|@eslint|tailwindcss|@tailwindcss|postcss|autoprefixer|vite$|@vitejs|vitest|jest|@testing-library|ts-node|tsx$|nodemon|concurrently|husky|lint-staged|next$|react-dom$|react$|supabase$|prisma$|drizzle-kit|wrangler|vercel$|netlify-cli|@biomejs|turbo$|rimraf|cross-env|dotenv-cli|lovable-tagger|tailwindcss-animate|tw-animate-css|@playwright|playwright|cypress|sharp$|globals$|typescript-eslint|@next\/|eslint-config|@swc|esbuild|rollup|webpack|babel|@babel)/;

export const PERFORMANCE_CHECKS: CheckDef[] = [
  {
    id: "perf.cdn",
    area: "Performance",
    title: "CDN in front of static assets",
    when: frontend,
    priority: "should",
    relevance: "A CDN serves your JS, CSS and images from a location near each visitor. Without one, users far from your server wait on every request.",
    howTo: "Deploy the frontend to Vercel/Netlify/Cloudflare Pages (CDN included), or put Cloudflare / CloudFront in front of your server and serve `/assets/*` with `Cache-Control: public, max-age=31536000, immutable`.",
    evaluate(ctx) {
      const edge = managedEdge(ctx);
      if (edge) return pass(`Hosted on ${edge}, which serves assets from a global CDN.`);
      if (ctx.stack.hosting.length) return warn(`Hosting (${ctx.stack.hosting.join(", ")}) doesn't include a CDN by default.`);
      return unknown("No hosting config in the repo, so the CDN setup can't be confirmed from code.");
    },
    live(probe) {
      const h = probe.headers;
      const cdn = h["cf-ray"] ? "Cloudflare" : h["x-vercel-cache"] || h["x-vercel-id"] ? "Vercel" : h["x-nf-request-id"] ? "Netlify" : h["x-amz-cf-id"] ? "CloudFront" : h["x-served-by"]?.includes("cache") ? "Fastly" : h["x-cache"] ? "a CDN" : undefined;
      return cdn ? pass(`The live site is served through ${cdn}.`) : warn("No CDN headers on the live response.");
    },
  },
  {
    id: "perf.compression",
    area: "Performance",
    title: "Compressed responses (gzip / Brotli)",
    priority: "should",
    relevance: "Compression shrinks HTML, JS and JSON API payloads by 60–80%, the cheapest speed-up there is, especially on mobile data.",
    howTo: "Managed hosts do this automatically. On Express add `app.use(compression())`; on nginx enable `gzip on; brotli on;` for text, JS, CSS and JSON.",
    evaluate(ctx) {
      if (managedEdge(ctx)) return pass(`${managedEdge(ctx)} compresses responses automatically.`);
      const d = dep(ctx, "compression", "@fastify/compress", "hono") ?? grep(ctx, /gzip on|brotli|compress\(\)/i, ANY_FILE, 1)[0]?.file;
      if (d) return pass(`Compression is configured (${d}).`);
      return ctx.type.hasBackend ? warn("No compression middleware found on the server.") : unknown("Depends on your host. Check the live site.");
    },
    live(probe) {
      const enc = probe.headers["content-encoding"];
      return enc ? pass(`The live site responds with content-encoding: ${enc}.`) : fail("The live home page is served uncompressed.");
    },
  },
  {
    id: "perf.code-splitting",
    area: "Performance",
    title: "Code split into chunks per route",
    when: frontend,
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "Without splitting, a visitor to your landing page downloads the code for every dashboard screen too.",
    howTo: "Load routes lazily: `const Dashboard = lazy(() => import('./pages/Dashboard'))` wrapped in `<Suspense>`; use `next/dynamic` for heavy client components (charts, editors, maps).",
    evaluate(ctx) {
      if (ctx.stack.frameworks.some((f) => ["Next.js", "Remix", "Nuxt", "SvelteKit", "Astro"].includes(f))) return pass("The framework splits code per route automatically.");
      const lazy = grep(ctx, /React\.lazy\(|\blazy\(\s*\(\)\s*=>\s*import|import\(\s*["'`]\.|defineAsyncComponent/, CODE_FILE);
      const routes = ctx.structure.routes.length;
      if (lazy.length) return pass(`Routes/components are lazy-loaded (${plural(lazy.length, "dynamic import")}).`, lazy);
      return routes > 3 ? fail(`${plural(routes, "route")} are bundled into one file; nothing is lazy-loaded.`) : warn("No lazy loading yet, which is fine while the app is small.");
    },
  },
  {
    id: "perf.lazy-images",
    area: "Performance",
    title: "Lazy-loaded, optimised images",
    when: frontend,
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "Images are usually the heaviest thing on a page and the biggest factor in Largest Contentful Paint (a Core Web Vital Google ranks on).",
    howTo: "Use `next/image`, or `<img loading=\"lazy\" decoding=\"async\" width height>` for below-the-fold images; keep the hero image eager with `fetchpriority=\"high\"`.",
    evaluate(ctx) {
      const total = grepCount(ctx, /<img\b/, UI_FILE);
      const nextImage = grepCount(ctx, /from\s+["']next\/image["']/, UI_FILE);
      const raw = findingsFor(ctx, "perf.unoptimized-images");
      if (total === 0 && nextImage === 0) return na("No images in the markup.");
      if (raw.length === 0) return pass(nextImage ? "Images use next/image." : "Images are lazy-loaded.");
      return warn(raw[0]!.title + ".", refsFromFindings(raw));
    },
  },
  {
    id: "perf.image-weight",
    area: "Performance",
    title: "Compressed image files",
    when: (ctx) => ctx.project.assets.some((a) => /\.(png|jpe?g|gif|webp|avif)$/i.test(a.path)),
    priority: "should",
    relevance: "Uncompressed PNG/JPEG photos straight from a phone or AI image tool are often 1–5 MB each.",
    howTo: "Convert photos to WebP/AVIF at the size they're displayed (e.g. `npx @squoosh/cli --webp auto`, or `sharp`), keep each under ~200 KB, and serve responsive sizes with `srcset` / next/image.",
    evaluate(ctx) {
      const heavy = ctx.project.assets.filter((a) => /\.(png|jpe?g|gif)$/i.test(a.path) && a.bytes > 300 * 1024).sort((a, b) => b.bytes - a.bytes);
      if (!heavy.length) return pass("No image file is larger than 300 KB.");
      const totalMb = (heavy.reduce((n, a) => n + a.bytes, 0) / 1024 / 1024).toFixed(1);
      return fail(`${plural(heavy.length, "image")} over 300 KB (${totalMb} MB total).`, heavy.slice(0, 5).map((a) => ({ file: a.path, snippet: `${Math.round(a.bytes / 1024)} KB` })));
    },
  },
  {
    id: "perf.loading-skeletons",
    area: "Performance",
    title: "Loading skeletons for data views",
    appliesTo: ["saas-app", "ecommerce"],
    when: frontend,
    priority: "should",
    relevance: "Your app loads data after the page renders. Skeletons make waits feel shorter and stop layout jumps (CLS) when data arrives.",
    howTo: "Render `<Skeleton>` placeholders shaped like the content while loading (shadcn/ui has one); in Next.js add `loading.tsx` next to data-heavy pages.",
    evaluate(ctx) {
      const refs = [...paths(ctx, /(^|\/)loading\.(t|j)sx$|skeleton/i), ...grep(ctx, /<Skeleton\b|animate-pulse|<Suspense\s+fallback/, UI_FILE)];
      if (refs.length) return pass("Skeleton / suspense loading states are used.", refs.slice(0, 4));
      const spinners = grep(ctx, /isLoading|loading\s*\?|Loading\.\.\.|<Spinner|animate-spin/, UI_FILE, 3);
      return spinners.length ? warn("Loading states are spinners or text only.", spinners) : fail("No loading states found for data views.");
    },
  },
  {
    id: "perf.debounce",
    area: "Performance",
    title: "Debounced input handlers",
    when: frontend,
    priority: "later",
    relevance: "Search boxes and filters that query on every keystroke multiply database load and show out-of-order results.",
    howTo: "Debounce search/filter handlers by ~300 ms (`useDebouncedValue`, `lodash/debounce`) and cancel in-flight requests.",
    evaluate(ctx) {
      const f = findingsFor(ctx, "perf.undebounced-search");
      if (f.length) return fail(`${plural(f.length, "search input")} query on every keystroke.`, refsFromFindings(f));
      const d = grep(ctx, /debounce|useDeferredValue|throttle/i, CODE_FILE, 2);
      return d.length ? pass("Input handlers are debounced.", d) : na("No live-search inputs found.");
    },
  },
  {
    id: "perf.pagination",
    area: "Performance",
    title: "Large lists are paginated",
    when: backend,
    priority: (ctx) => (bigAudience(ctx) ? "must" : "should"),
    relevance: "Unbounded queries get slower every week as your tables grow, and eventually time out.",
    howTo: "Use `.range(from, to)` / `LIMIT … OFFSET`, or cursor pagination on an indexed column (`where created_at < $cursor order by created_at desc limit 20`) for feeds.",
    evaluate(ctx) {
      const f = findingsFor(ctx, "perf.unpaginated-query");
      if (f.length) return fail(`${f.length} list ${f.length === 1 ? "query" : "queries"} with no limit or range.`, refsFromFindings(f));
      const p = grep(ctx, /\.range\(|\.limit\(|LIMIT\s+\d|take\s*:|cursor/i, CODE_FILE, 2);
      return p.length ? pass("List queries are bounded.", p) : na("No list queries found.");
    },
  },
  {
    id: "perf.n-plus-one",
    area: "Performance",
    title: "No N+1 database queries",
    when: backend,
    priority: "should",
    relevance: "Querying inside a loop turns one page load into dozens of database round-trips: invisible with test data, painful with real users.",
    howTo: "Batch with `.in('id', ids)`, embed relations (`select('*, author:profiles(*)')`), use Prisma `include`, or a DataLoader.",
    evaluate(ctx) {
      const f = findingsFor(ctx, "perf.n-plus-one");
      return f.length ? fail(`${f.length} ${f.length === 1 ? "query runs" : "queries run"} inside loops.`, refsFromFindings(f)) : pass("No queries inside loops were found.");
    },
  },
  {
    id: "data.indexes",
    area: "Data & database",
    title: "Database indexes on foreign keys and filters",
    when: (ctx) => ctx.project.files.some((f) => /\.(sql|prisma)$/.test(f.path)),
    priority: (ctx) => (bigAudience(ctx) ? "must" : "should"),
    relevance: "Postgres does not index foreign keys automatically. Every `where user_id = …` (including the ones your RLS policies run on every request) becomes a full table scan as data grows.",
    howTo: "Add `create index on <table> (user_id);` for each foreign key and column used in filters, RLS policies or `order by`. Check slow queries in Supabase → Database → Query Performance.",
    evaluate(ctx) {
      const fkCols: { table: string; col: string; file: string; line: number }[] = [];
      const indexed = new Set<string>();
      for (const f of ctx.project.files) {
        if (f.path.endsWith(".sql")) {
          let table = "";
          f.lines.forEach((line, i) => {
            const t = line.match(/create\s+table\s+(?:if\s+not\s+exists\s+)?(?:"?\w+"?\.)?"?(\w+)"?/i);
            if (t) table = t[1]!.toLowerCase();
            const c = line.match(/^\s*"?(\w+_id)"?\s+(uuid|bigint|int|integer|text)\b/i);
            if (table && c && c[1]!.toLowerCase() !== "id") fkCols.push({ table, col: c[1]!.toLowerCase(), file: f.path, line: i + 1 });
            if (/\);\s*$/.test(line)) table = table && line.trim() === ");" ? "" : table;
          });
          for (const m of f.content.matchAll(/create\s+(?:unique\s+)?index\s+(?:concurrently\s+)?(?:if\s+not\s+exists\s+)?(?:\w+\s+)?on\s+(?:"?\w+"?\.)?"?(\w+)"?\s*(?:using\s+\w+\s*)?\(\s*"?(\w+)"?/gi)) {
            indexed.add(`${m[1]!.toLowerCase()}.${m[2]!.toLowerCase()}`);
          }
          for (const m of f.content.matchAll(/(?:primary\s+key|unique)\s*\(\s*"?(\w+)"?/gi)) indexed.add(`*.${m[1]!.toLowerCase()}`);
        }
        if (f.path.endsWith(".prisma")) {
          let model = "";
          for (const line of f.lines) {
            const mm = line.match(/^\s*model\s+(\w+)/);
            if (mm) model = mm[1]!.toLowerCase();
            const fk = line.match(/^\s*(\w+Id)\s+(String|Int|BigInt)/);
            if (model && fk) fkCols.push({ table: model, col: fk[1]!.toLowerCase(), file: f.path, line: f.lines.indexOf(line) + 1 });
            const idx = line.match(/@@(index|unique)\(\[\s*(\w+)/);
            if (model && idx) indexed.add(`${model}.${idx[2]!.toLowerCase()}`);
            if (model && fk && /@unique/.test(line)) indexed.add(`${model}.${fk[1]!.toLowerCase()}`);
          }
        }
      }
      if (!fkCols.length) return na("No foreign-key columns found in the schema files.");
      const missing = fkCols.filter((c) => !indexed.has(`${c.table}.${c.col}`) && !indexed.has(`*.${c.col}`));
      if (!missing.length) return pass(`All ${plural(fkCols.length, "foreign-key column")} are indexed.`);
      return fail(`${missing.length} of ${plural(fkCols.length, "foreign-key column")} have no index (${missing.slice(0, 3).map((m) => `${m.table}.${m.col}`).join(", ")}${missing.length > 3 ? "…" : ""}).`, missing.slice(0, 5).map((m) => ({ file: m.file, line: m.line, snippet: `${m.table}.${m.col}` })));
    },
  },
  {
    id: "data.pooling",
    area: "Data & database",
    title: "Database connection pooling",
    when: (ctx) => ctx.type.hasBackend && ctx.stack.database.some((d) => /Postgres|Supabase|MySQL/.test(d)),
    priority: (ctx) => (bigAudience(ctx) ? "must" : "should"),
    relevance: "Serverless functions open a new database connection per invocation. Postgres allows only a few dozen to a few hundred, so a traffic spike exhausts them and every request fails.",
    howTo: "For direct Postgres access use the pooler URL (Supabase: port 6543 / `pooler.supabase.com`, `?pgbouncer=true` for Prisma), Neon's serverless driver, or Prisma Accelerate. Create one client per process, not per request.",
    evaluate(ctx) {
      const direct = dep(ctx, "pg", "postgres", "mysql2", "@prisma/client", "drizzle-orm", "kysely", "typeorm", "sequelize");
      if (!direct) return pass("Database access goes through supabase-js (PostgREST), which pools connections for you.");
      const pooled = grep(ctx, /pooler\.supabase\.com|:6543|pgbouncer=true|prisma:\/\/|accelerate|@neondatabase\/serverless|new Pool\(|createPool\(|max:\s*\d+/i, ANY_FILE, 3);
      if (pooled.length) return pass("A connection pool / pooler is configured.", pooled);
      const perRequest = grep(ctx, /new (PrismaClient|Client)\(/, CODE_FILE, 5);
      if (perRequest.length > 1) return fail(`Database clients are created in ${plural(perRequest.length, "place")}, likely one per request.`, perRequest);
      return warn(`Using ${direct} directly with no pooler URL found.`, perRequest);
    },
  },
  {
    id: "perf.api-caching",
    area: "Performance",
    title: "Cache API responses",
    when: (ctx) => ctx.type.hasBackend && ctx.type.hasFrontend,
    priority: "should",
    relevance: "Most screens re-request the same data on every navigation. Client and HTTP caching remove those round-trips entirely.",
    howTo: "On the client use TanStack Query / SWR with a sensible `staleTime`. On the server set `Cache-Control: s-maxage=60, stale-while-revalidate=300` for public data, or Next.js `revalidate` / `\"use cache\"`.",
    evaluate(ctx) {
      const client = dep(ctx, "@tanstack/react-query", "swr", "@apollo/client", "@reduxjs/toolkit");
      const server = grep(ctx, /revalidate\s*[:=]|unstable_cache|["']use cache["']|Cache-Control|s-maxage|staleTime/, CODE_FILE, 3);
      if (client && server.length) return pass(`Client cache (${client}) and HTTP/server caching are configured.`, server);
      if (client) return warn(`${client} caches on the client, but no server/HTTP cache headers were found.`);
      if (server.length) return warn("Server caching found, but the client refetches without a cache layer.", server);
      return fail("No API response caching on the client or server.");
    },
  },
  {
    id: "perf.server-cache",
    area: "Performance",
    title: "Cache expensive queries server-side",
    when: backend,
    priority: scalePriority,
    relevance: (ctx) => `At ~${ctx.profile.expectedUsers.toLocaleString()} expected users, repeated expensive work (aggregations, AI calls, third-party APIs) should be computed once and reused.`,
    howTo: "Add Redis (Upstash works on serverless) or your platform KV: cache by key with a TTL, invalidate on writes. Use Postgres materialized views for heavy dashboards.",
    evaluate(ctx) {
      const d = dep(ctx, "@upstash/redis", "ioredis", "redis", "@vercel/kv", "lru-cache", "node-cache", "keyv", "@keyv/redis");
      const n = grep(ctx, /unstable_cache|["']use cache["']|materialized view|KV\.(get|put)|caches\.default/i, ANY_FILE, 2);
      if (d || n.length) return pass(`Server-side cache in use${d ? ` (${d})` : ""}.`, n);
      return ctx.profile.expectedUsers < 5000 ? warn("No server-side cache yet. That's fine at your current scale, plan it before growth.") : fail("No server-side cache for expensive queries.");
    },
  },
  {
    id: "scale.load-balancer",
    area: "Performance",
    title: "Load balancing & stateless servers",
    when: backend,
    priority: scalePriority,
    relevance: (ctx) => `To handle ${ctx.profile.expectedUsers.toLocaleString()} users you need more than one server instance behind a load balancer, which only works if no state lives in server memory or on local disk.`,
    howTo: "Serverless/managed platforms scale and load-balance for you. On VPS/containers run 2+ instances behind a load balancer (Fly, Render, AWS ALB, nginx), and move sessions to the DB/Redis and uploads to object storage (S3, R2, Supabase Storage).",
    evaluate(ctx) {
      const stateful = [
        ...grep(ctx, /express-session(?![\s\S]*store)|new MemoryStore|session\(\s*\{(?![^}]*store)/, CODE_FILE, 2),
        ...grep(ctx, /multer\(\s*\{\s*dest|diskStorage|fs\.(writeFile|createWriteStream)\([^)]*upload/i, CODE_FILE, 2),
        ...grep(ctx, /setInterval\(|const\s+\w+\s*=\s*new Map\(\)\s*;?\s*\/\/.*(cache|session)/i, (f) => CODE_FILE(f) && !f.clientSide, 1),
      ];
      const platform = ctx.stack.hosting.find((h) => ["Vercel", "Netlify", "Cloudflare", "Fly.io", "Render", "Railway", "Firebase Hosting", "AWS (CDK/SAM/Amplify)"].includes(h));
      const serverlessOnly = ctx.stack.database.some((d) => d.startsWith("Supabase") || d.startsWith("Firebase")) && !ctx.stack.frameworks.some((f) => ["Express", "Fastify", "NestJS", "Django", "Rails", "Laravel", "Flask", "FastAPI"].includes(f));
      if (stateful.length) return fail("State lives in server memory or on local disk, so a second instance would break sessions/uploads.", stateful);
      if (platform || serverlessOnly) return pass(`${platform ?? "Serverless backend (Supabase/Firebase)"} handles load balancing and autoscaling.`);
      return bigAudience(ctx) ? warn("No load-balanced deployment config found.") : unknown("Hosting isn't defined in the repo.");
    },
  },
  {
    id: "perf.defer-scripts",
    area: "Performance",
    title: "Non-critical scripts deferred",
    when: frontend,
    appliesTo: WEB_KINDS,
    priority: "should",
    relevance: "Third-party scripts (analytics, chat widgets, pixels) loaded synchronously block the page from rendering.",
    howTo: "Add `async`/`defer` to third-party `<script>` tags, or use Next.js `<Script strategy=\"afterInteractive\">` / `\"lazyOnload\"` for chat widgets.",
    evaluate(ctx) {
      const blocking: { file: string; line: number; snippet: string }[] = [];
      for (const f of ctx.project.files) {
        if (!/\.(html|tsx|jsx|astro)$/.test(f.path)) continue;
        f.lines.forEach((l, i) => {
          if (/<script\b[^>]*\bsrc=["']https?:/.test(l) && !/\b(async|defer)\b|type=["']module["']/.test(l)) blocking.push({ file: f.path, line: i + 1, snippet: l.trim().slice(0, 160) });
        });
      }
      const nextScript = grep(ctx, /<Script\b(?![^>]*strategy=)/, UI_FILE, 3);
      if (blocking.length) return fail(`${plural(blocking.length, "third-party script")} block rendering.`, blocking.slice(0, 5));
      if (nextScript.length) return warn("next/script used without an explicit strategy.", nextScript);
      return pass("No render-blocking third-party scripts found.");
    },
    live(probe, code) {
      if (!probe.html) return undefined;
      return probe.html.blockingScripts > 0 ? fail(`${plural(probe.html.blockingScripts, "render-blocking script")} on the live home page.`, code.refs) : code.status === "fail" ? code : pass("No render-blocking scripts on the live home page.");
    },
  },
  {
    id: "perf.minify",
    area: "Performance",
    title: "Minified JS and CSS",
    when: frontend,
    priority: "later",
    relevance: "Minification removes whitespace and dead code, typically 30–50% smaller bundles.",
    howTo: "Use a bundler (Vite, Next.js, Astro) for production builds. They minify by default. Don't ship hand-written, unminified `<script src=\"app.js\">` files.",
    evaluate(ctx) {
      const bundler = ctx.stack.frameworks.find((f) => ["Next.js", "Vite", "Remix", "Nuxt", "SvelteKit", "Astro", "Expo / React Native"].includes(f)) ?? dep(ctx, "webpack", "esbuild", "parcel", "rollup");
      if (bundler) return pass(`${bundler} minifies production builds.`);
      const big = ctx.project.files.filter((f) => /\.(js|css)$/.test(f.path) && f.content.length > 30_000 && f.lines.length > 200);
      return big.length ? fail("Large unminified JS/CSS files are served directly.", big.slice(0, 3).map((f) => ({ file: f.path }))) : unknown("No build tool detected.");
    },
  },
  {
    id: "perf.rerenders",
    area: "Performance",
    title: "Unnecessary re-renders",
    when: (ctx) => ctx.type.hasFrontend && ("react" in ctx.project.deps || "react-native" in ctx.project.deps),
    priority: "later",
    relevance: "Context providers that create a new object every render, and giant components holding all state, re-render the whole tree on every keystroke.",
    howTo: "Memoise context values (`useMemo(() => ({ user, setUser }), [user])`), split large components, keep state close to where it's used, and check with React DevTools Profiler (\"Highlight updates\").",
    evaluate(ctx) {
      const inlineCtx = grep(ctx, /<\w+(\.Provider|Provider)\s+value=\{\{/, UI_FILE, 5);
      const giant = ctx.structure.godFiles.filter((g) => /\.(t|j)sx$/.test(g.path));
      if (inlineCtx.length) return fail(`${inlineCtx.length === 1 ? "1 context provider passes" : `${inlineCtx.length} context providers pass`} a new object every render.`, inlineCtx);
      if (giant.length) return warn(`${plural(giant.length, "component file")} over 400 lines hold too much state.`, giant.slice(0, 4).map((g) => ({ file: g.path, snippet: `${g.lines} lines` })));
      return pass("No obvious re-render hotspots.");
    },
  },
  {
    id: "perf.unused-deps",
    area: "Performance",
    title: "No unused dependencies",
    when: (ctx) => Object.keys(ctx.project.deps).length > 0,
    priority: "later",
    relevance: "AI builders install packages and never remove them. Unused deps slow installs and builds, can end up in the bundle, and add security surface.",
    howTo: "Remove them with `npm uninstall <pkg>`; confirm with `npx knip` or `npx depcheck`.",
    evaluate(ctx) {
      const pkg = ctx.project.packageJson;
      if (!pkg?.dependencies) return na("No root package.json dependencies.");
      const corpus = ctx.project.files.filter((f) => !f.path.endsWith("package.json") && !f.path.endsWith("package-lock.json")).map((f) => f.content).join("\n");
      const unused = Object.keys(pkg.dependencies).filter((d) => {
        if (IMPLICIT_DEPS.test(d)) return false;
        const esc = d.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&");
        return !new RegExp(`["'\`](npm:|jsr:)?${esc}(@[^"'\`/]*)?(/[^"'\`]*)?["'\`]`).test(corpus);
      });
      if (!unused.length) return pass("Every dependency is imported somewhere.");
      return (unused.length > 4 ? fail : warn)(`${unused.length} ${unused.length === 1 ? "dependency" : "dependencies"} never imported: ${unused.slice(0, 8).join(", ")}${unused.length > 8 ? "…" : ""}.`, [{ file: "package.json" }]);
    },
  },
  {
    id: "perf.lighthouse",
    area: "Performance",
    title: "Lighthouse audit in CI",
    when: frontend,
    appliesTo: WEB_KINDS,
    priority: "later",
    relevance: "Performance regresses silently as features land. A Lighthouse budget in CI catches it on the pull request that caused it.",
    howTo: "Run Lighthouse once now (Chrome DevTools → Lighthouse, aim for 90+ on mobile), then add `treosh/lighthouse-ci-action` to CI with a performance budget.",
    evaluate(ctx) {
      const refs = [...grep(ctx, /lighthouse|lhci|unlighthouse|pagespeed/i, ANY_FILE, 2), ...(dep(ctx, "@lhci/cli", "lighthouse") ? [{ file: "package.json" }] : [])];
      return refs.length ? pass("Lighthouse runs in the toolchain.", refs) : fail("No Lighthouse/performance budget in CI.");
    },
  },
];

