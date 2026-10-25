import type { Rule, RuleHit } from "../types.js";
import { isCode, isCommentLine, isTestFile, JS_EXT, redact, scanLines } from "./helpers.js";

const jsOnly = (f: { path: string }) => JS_EXT.test(f.path);

export const asyncForEach: Rule = {
  id: "bug.async-foreach",
  title: "`forEach(async …)` does not wait for the work",
  severity: "high",
  category: "bug",
  why: "Array.forEach ignores returned promises. The code after it runs before the writes finish, errors are unhandled, and requests fire all at once.",
  fix: "Use `for (const item of items) { await … }` for sequential work, or `await Promise.all(items.map(async …))` for parallel work.",
  check: (p) => scanLines(p, /\.forEach\(\s*async\b/, { files: jsOnly }),
};

export const asyncUseEffect: Rule = {
  id: "bug.async-useeffect",
  title: "Async function passed directly to useEffect",
  severity: "medium",
  category: "bug",
  why: "useEffect expects a cleanup function, not a promise. Async effects can't be cancelled, so a slow response can overwrite newer state (race conditions) or update an unmounted component.",
  fix: "Define an async function inside the effect, call it, and ignore stale results with an `ignore` flag or AbortController in the cleanup. Better: use TanStack Query for data fetching.",
  check: (p) => scanLines(p, /useEffect\(\s*async\b/, { files: jsOnly }),
};

export const missingAwaitSupabase: Rule = {
  id: "bug.missing-await",
  title: "Database call result used without `await`",
  severity: "high",
  category: "bug",
  why: "Supabase/Prisma queries return promises. Destructuring `{ data }` without await gives `undefined`, so the UI silently shows nothing or the write never completes.",
  fix: "Add `await` (inside an async function) and handle the `error` value.",
  check: (p) =>
    scanLines(p, /(const|let)\s*\{[^}]*\bdata\b[^}]*\}\s*=\s*(?!await)\s*(supabase|client|db)\s*\.(from|rpc|auth)/, { files: jsOnly }),
};

export const ignoredSupabaseError: Rule = {
  id: "bug.ignored-db-error",
  title: "Database errors are ignored",
  severity: "low",
  category: "reliability",
  why: "Supabase returns `{ data, error }` instead of throwing. Reading only `data` means RLS denials, network failures and constraint violations look like an empty result.",
  fix: "Destructure `error` and handle it: `if (error) throw error` in server code, or show a toast in the UI and report it to error tracking.",
  check(project) {
    const hits = scanLines(project, /const\s*\{\s*data(\s*:\s*\w+)?\s*\}\s*=\s*await\s+supabase/, { files: jsOnly });
    return hits.length > 0 ? [{ ...hits[0]!, title: `Database errors are ignored in ${hits.length} place${hits.length === 1 ? "" : "s"}` }, ...hits.slice(1)] : [];
  },
};

export const emptyCatch: Rule = {
  id: "bug.swallowed-error",
  title: "Errors swallowed by an empty catch",
  severity: "medium",
  category: "reliability",
  why: "Empty catch blocks hide failures. Payments, sign-ups or saves can fail with no log, no alert and no message to the user.",
  fix: "Log the error with context, report it to Sentry (or similar), and show the user what happened. Only swallow errors you have decided are safe to ignore — and comment why.",
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!isCode(f) || isTestFile(f)) continue;
      for (const m of f.content.matchAll(/catch\s*(\(\s*\w*\s*\))?\s*\{\s*\}|except[^:\n]*:\s*\n\s*pass\b/g)) {
        const line = f.content.slice(0, m.index ?? 0).split(/\r?\n/).length;
        hits.push({ file: f.path, line, snippet: redact(f.lines[line - 1] ?? "") });
      }
    }
    return hits;
  },
};

export const indexAsKey: Rule = {
  id: "bug.index-as-key",
  title: "List rendered with the array index as `key`",
  severity: "low",
  category: "bug",
  why: "When items are added, removed or re-ordered, React reuses the wrong component state — inputs show the wrong value, animations jump.",
  fix: "Use a stable id from the data (`key={item.id}`).",
  check: (p) => scanLines(p, /key=\{\s*(i|idx|index)\s*\}/, { files: (f) => /\.(jsx|tsx)$/.test(f.path) }),
};

export const floatMoney: Rule = {
  id: "bug.float-money",
  title: "Money handled as floating-point numbers",
  severity: "low",
  category: "bug",
  why: "0.1 + 0.2 !== 0.3. Totals, taxes and refunds drift by cents, which breaks reconciliation with your payment provider.",
  fix: "Store and compute money in integer minor units (cents/paise) and format only for display.",
  check: (p) => scanLines(p, /parseFloat\([^)]*(price|amount|total|cost|fee)/i),
};

export const consoleLogNoise: Rule = {
  id: "maint.console-logs",
  title: "Debug console.log left in the code",
  severity: "info",
  category: "maintainability",
  why: "Leftover logs clutter production consoles, can leak data, and hide the real errors you need to see.",
  fix: "Remove them or replace with a structured logger behind a log level.",
  check(project) {
    const hits = scanLines(project, /console\.log\(/, { files: (f) => jsOnly(f) && !f.path.includes("scripts/") });
    if (hits.length < 15) return [];
    return [{ ...hits[0]!, title: `${hits.length} console.log calls left in the code` }];
  },
};

export const nPlusOne: Rule = {
  id: "perf.n-plus-one",
  title: "Database query inside a loop (N+1 queries)",
  severity: "medium",
  category: "performance",
  why: "One query per item means 100 items = 101 round-trips. It feels fine with test data and collapses with real users.",
  fix: "Fetch everything in one query: `.in('id', ids)`, a join/`select('*, author(*)')`, Prisma `include`, or a DataLoader.",
  check(project) {
    const hits: RuleHit[] = [];
    const query = /await\s+(supabase\s*\.from|prisma\.\w+\.|db\.(select|query)|\w+\.find(One|Many|First|Unique)?\(|fetch\()/;
    for (const f of project.files) {
      if (!jsOnly(f) || isTestFile(f)) continue;
      let loopDepth = 0;
      let braceAtLoop: number[] = [];
      let depth = 0;
      f.lines.forEach((line, i) => {
        if (isCommentLine(line)) return;
        const opensLoop = /\bfor\s*\(.*\b(of|in)\b|\bwhile\s*\(|\.map\(\s*async|\.forEach\(\s*async/.test(line);
        if (opensLoop) {
          loopDepth++;
          braceAtLoop.push(depth);
        }
        if (loopDepth > 0 && query.test(line) && !opensLoop) {
          hits.push({ file: f.path, line: i + 1, snippet: redact(line) });
        }
        depth += (line.match(/\{/g) ?? []).length - (line.match(/\}/g) ?? []).length;
        while (loopDepth > 0 && depth <= braceAtLoop[braceAtLoop.length - 1]! && !opensLoop) {
          braceAtLoop.pop();
          loopDepth--;
        }
      });
      braceAtLoop = [];
    }
    return hits;
  },
};

export const unboundedQuery: Rule = {
  id: "perf.unpaginated-query",
  title: "List query without a limit or pagination",
  severity: "low",
  category: "performance",
  why: "`select('*')` with no `.range()`/`.limit()` returns every row. Pages get slower every week as data grows, and you pay egress for data nobody sees.",
  fix: "Paginate with `.range(from, to)` (or cursor pagination on an indexed column), select only the columns you render, and add infinite scroll or page controls.",
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!jsOnly(f) || isTestFile(f)) continue;
      f.lines.forEach((line, i) => {
        if (!/\.from\(\s*["'`]\w+["'`]\s*\)\s*\.select\(/.test(line)) return;
        const statement = f.lines.slice(i, i + 6).join(" ");
        const end = statement.indexOf(";");
        const stmt = end >= 0 ? statement.slice(0, end) : statement;
        if (/\.(range|limit|single|maybeSingle|eq\(\s*["'`]id["'`])\(?/.test(stmt)) return;
        hits.push({ file: f.path, line: i + 1, snippet: redact(line) });
      });
    }
    return hits;
  },
};

export const selectStar: Rule = {
  id: "perf.select-star",
  title: "Queries fetch every column (`select('*')`)",
  severity: "info",
  category: "performance",
  why: "Fetching all columns sends more data than the screen needs and can leak columns you add later (e.g. internal notes).",
  fix: "Select only the columns you use: `.select('id, title, created_at')`.",
  check(project) {
    const hits = scanLines(project, /\.select\(\s*["'`]\*["'`]\s*\)/, { files: jsOnly });
    if (hits.length < 3) return [];
    return [{ ...hits[0]!, title: `${hits.length} queries fetch every column with select('*')` }];
  },
};

export const syncHeavyImport: Rule = {
  id: "perf.heavy-dependency",
  title: "Heavy library shipped to the browser",
  severity: "low",
  category: "performance",
  why: "Large libraries (moment, full lodash, full icon packs) bloat the bundle, slowing first load on mobile.",
  fix: "Swap moment for date-fns/dayjs, import lodash functions individually (`lodash/debounce`) or use native methods, and lazy-load rarely used heavy components with `React.lazy`/`next/dynamic`.",
  check: (p) =>
    scanLines(p, /from\s+["'](moment|lodash|aws-sdk|firebase)["']|import\s+\*\s+as\s+\w+\s+from\s+["'](lucide-react|react-icons|@mui\/icons-material)["']/, {
      files: (f) => f.clientSide,
    }),
};

export const unoptimizedImg: Rule = {
  id: "perf.unoptimized-images",
  title: "Images not lazy-loaded or optimised",
  severity: "low",
  category: "performance",
  why: "Full-size images loaded eagerly are the #1 cause of slow Largest Contentful Paint on vibe-coded landing pages.",
  fix: "Use `next/image` (Next.js) or add `loading=\"lazy\"`, explicit width/height and modern formats (WebP/AVIF) to `<img>` below the fold.",
  check(project) {
    const usesNextImage = "next" in project.deps;
    const hits = scanLines(project, /<img\b(?![^>]*\bloading=)/, {
      files: (f) => /\.(jsx|tsx|html|vue|svelte|astro)$/.test(f.path),
    });
    if (hits.length === 0) return [];
    const title = usesNextImage
      ? `${hits.length} raw <img> tag${hits.length === 1 ? "" : "s"} instead of next/image`
      : `${hits.length} <img> tag${hits.length === 1 ? "" : "s"} without loading="lazy"`;
    return [{ ...hits[0]!, title }, ...hits.slice(1, 5)];
  },
};

export const inputNoDebounce: Rule = {
  id: "perf.undebounced-search",
  title: "Search input queries on every keystroke",
  severity: "low",
  category: "performance",
  why: "Firing a request per keystroke multiplies database load and causes out-of-order results.",
  fix: "Debounce the handler (250–400 ms) with `useDebounce`/`lodash/debounce`, and cancel stale requests.",
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!f.clientSide || isTestFile(f)) continue;
      if (/debounce|useDeferredValue|throttle/i.test(f.content)) continue;
      const hasSearchQuery = /\.(ilike|like|textSearch)\(|search/i.test(f.content) && /onChange=/.test(f.content) && /(supabase|fetch\(|axios)/.test(f.content);
      if (!hasSearchQuery) continue;
      const idx = f.lines.findIndex((l) => /onChange=/.test(l));
      hits.push({ file: f.path, line: idx + 1, snippet: redact(f.lines[idx] ?? "") });
    }
    return hits;
  },
};
