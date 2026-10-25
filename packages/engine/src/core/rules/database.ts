import type { Rule, RuleHit } from "../types.js";
import { hitAt, redact, scanLines } from "./helpers.js";

const sqlFiles = (path: string) => /\.sql$/i.test(path);

/** Strips SQL line and block comments so commented-out statements are ignored. */
function stripSqlComments(sql: string): string {
  return sql.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, " ")).replace(/--[^\n]*/g, (m) => " ".repeat(m.length));
}

function normalizeTable(name: string): string {
  const clean = name.replace(/"/g, "").toLowerCase();
  return clean.includes(".") ? clean : `public.${clean}`;
}

export const rlsMissing: Rule = {
  id: "supabase.rls-disabled",
  title: "Table created without Row Level Security",
  severity: "critical",
  category: "security",
  why: "In Supabase every table in the public schema is reachable through the REST API with the anon key that ships in your frontend. Without RLS, anyone can read and often write the whole table. Independent scans found ~half of vibe-coded Supabase apps had publicly readable tables.",
  fix: "Run `alter table <name> enable row level security;` and add policies that scope rows to `auth.uid()`, e.g. `create policy \"own rows\" on <name> for all using (auth.uid() = user_id) with check (auth.uid() = user_id);`. Then test with the anon key from a logged-out browser.",
  references: ["https://supabase.com/docs/guides/database/postgres/row-level-security"],
  check(project) {
    const created = new Map<string, RuleHit>();
    const secured = new Set<string>();
    for (const f of project.files) {
      if (!sqlFiles(f.path)) continue;
      const sql = stripSqlComments(f.content);
      for (const m of sql.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?((?:"?[\w]+"?\.)?"?[\w]+"?)/gi)) {
        const table = normalizeTable(m[1]!);
        if (!table.startsWith("public.")) continue;
        if (!created.has(table)) created.set(table, { ...hitAt(f, m.index ?? 0), title: `Table \`${table}\` has no Row Level Security` });
      }
      for (const m of sql.matchAll(/alter\s+table\s+(?:if\s+exists\s+)?(?:only\s+)?((?:"?[\w]+"?\.)?"?[\w]+"?)\s+enable\s+row\s+level\s+security/gi)) {
        secured.add(normalizeTable(m[1]!));
      }
    }
    return [...created.entries()].filter(([t]) => !secured.has(t)).map(([, hit]) => hit);
  },
};

export const permissivePolicy: Rule = {
  id: "supabase.policy-always-true",
  title: "RLS policy allows everyone (`using (true)`)",
  severity: "high",
  category: "security",
  why: "A policy whose condition is `true` turns RLS off for that operation. Write policies with `true` let any visitor insert, edit or delete other users' data.",
  fix: "Replace `true` with an ownership check such as `auth.uid() = user_id`, and restrict the role with `to authenticated`. Keep `using (true)` only for data that is genuinely public and read-only.",
  references: ["https://supabase.com/docs/guides/database/postgres/row-level-security#policies"],
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!sqlFiles(f.path)) continue;
      const sql = stripSqlComments(f.content);
      for (const m of sql.matchAll(/create\s+policy[\s\S]*?;/gi)) {
        const stmt = m[0];
        if (!/(using|with\s+check)\s*\(\s*true\s*\)/i.test(stmt)) continue;
        const readOnly = /\bfor\s+select\b/i.test(stmt);
        hits.push({
          ...hitAt(f, m.index ?? 0),
          severity: readOnly ? "medium" : "high",
          title: readOnly ? "Public read policy (`using (true)`). Confirm this data is meant to be public" : "Write policy allows anyone (`true`)",
        });
      }
    }
    return hits;
  },
};

export const securityDefiner: Rule = {
  id: "supabase.security-definer-rpc",
  title: "SECURITY DEFINER function callable through the API",
  severity: "high",
  category: "security",
  why: "SECURITY DEFINER functions run with the owner's rights and skip RLS. Functions in the public schema are exposed as RPC endpoints to anyone holding the anon key, so a missing check inside the function becomes a data leak.",
  fix: "Prefer SECURITY INVOKER. If definer rights are needed, move the function to a private schema, add `set search_path = ''`, check `auth.uid()` inside it, and `revoke execute on function … from anon, public`.",
  references: ["https://supabase.com/docs/guides/database/functions#security-definer-vs-invoker"],
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (!sqlFiles(f.path)) continue;
      const sql = stripSqlComments(f.content);
      const starts = [...sql.matchAll(/create\s+(?:or\s+replace\s+)?function\b/gi)].map((m) => m.index ?? 0);
      for (const [n, start] of starts.entries()) {
        // A function body runs until the next CREATE FUNCTION (or 8 KB), which covers $$-quoted bodies.
        const stmt = sql.slice(start, Math.min(starts[n + 1] ?? sql.length, start + 8192));
        if (!/security\s+definer/i.test(stmt)) continue;
        const pinnedPath = /set\s+search_path/i.test(stmt);
        const checksUser = /auth\.uid\(\)|auth\.jwt\(\)|auth\.role\(\)/i.test(stmt);
        if (pinnedPath && checksUser) continue;
        hits.push({
          ...hitAt(f, start),
          severity: checksUser ? "medium" : "high",
          title: checksUser ? "SECURITY DEFINER function without a pinned search_path" : "SECURITY DEFINER function with no auth check",
        });
      }
    }
    return hits;
  },
};

export const anonGrants: Rule = {
  id: "supabase.grant-to-anon",
  title: "Write privileges granted to the anon role",
  severity: "high",
  category: "security",
  why: "The anon role is what every unauthenticated visitor uses. Granting it insert/update/delete (or ALL) makes RLS the only thing standing between strangers and your data.",
  fix: "Revoke the grant (`revoke insert, update, delete on <table> from anon;`) and grant write access to `authenticated` only, behind RLS policies.",
  check(project) {
    return scanLines(project, /grant\s+(all|insert|update|delete|truncate)[^;]*\bto\s+[^;]*\banon\b/i, {
      files: (f) => sqlFiles(f.path),
    });
  },
};

export const firebaseOpenRules: Rule = {
  id: "firebase.open-rules",
  title: "Firebase security rules allow public access",
  severity: "critical",
  category: "security",
  why: "`allow read, write: if true` (or a rule with no condition) lets anyone on the internet read and overwrite your Firestore/Storage data with the public config in your app.",
  fix: "Require authentication and ownership, e.g. `allow read, write: if request.auth != null && request.auth.uid == resource.data.ownerId;`. Test the rules with the Firebase emulator before deploying.",
  references: ["https://firebase.google.com/docs/rules/insecure-rules"],
  check(project) {
    return scanLines(project, /allow\s+[\w, ]+(:\s*if\s+true\b|;\s*$)|\.(read|write)"\s*:\s*true/, {
      files: (f) => /(firestore|storage|database)\.rules(\.json)?$|database\.rules\.json$/.test(f.path),
    });
  },
};

export const massAssignment: Rule = {
  id: "db.mass-assignment",
  title: "Request body written straight into the database",
  severity: "high",
  category: "security",
  why: "Passing the whole request body to insert/update lets a user set fields you never meant them to, like `role`, `is_admin`, `credits`, `user_id` of someone else.",
  fix: "Validate the body with a schema (zod, valibot, pydantic) and copy only the allowed fields. Set `user_id` from the authenticated session, never from the client.",
  check(project) {
    return scanLines(
      project,
      /\.(insert|update|upsert|create|updateOne|insertOne|findByIdAndUpdate)\(\s*(\{\s*data\s*:\s*)?(req\.body|request\.body|await\s+req(uest)?\.json\(\)|body)\s*[,)}]/,
    );
  },
};

export const sqlInjection: Rule = {
  id: "db.sql-injection",
  title: "SQL built with string interpolation",
  severity: "critical",
  category: "security",
  why: "Interpolating user input into SQL lets an attacker change the query: dumping tables, bypassing login or dropping data.",
  fix: "Use parameterised queries (`$1` placeholders, Prisma `$queryRaw` tagged templates, Drizzle `sql` templates). Never use `$queryRawUnsafe`/`sql.unsafe` with user input.",
  references: ["https://owasp.org/Top10/A03_2021-Injection/"],
  check(project) {
    const hits = scanLines(
      project,
      /\b(query|execute|exec|raw|queryRawUnsafe|executeRawUnsafe|unsafe|prepare|all|run|get)\s*\(\s*`[^`]*\b(select|insert|update|delete|where|from)\b[^`]*\$\{/i,
    );
    hits.push(
      ...scanLines(project, /\b(query|execute|raw)\s*\(\s*["'][^"']*\b(select|insert|update|delete|where)\b[^"']*["']\s*\+/i),
      ...scanLines(project, /\.execute\(\s*f["']|\.execute\(\s*["'][^"']*%s?["']\s*%|cursor\.execute\([^)]*\.format\(/, {
        files: (f) => f.path.endsWith(".py"),
      }),
    );
    return dedupe(hits);
  },
};

function dedupe(hits: RuleHit[]): RuleHit[] {
  const seen = new Set<string>();
  return hits.filter((h) => {
    const key = `${h.file}:${h.line}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export const clientSidePrivilege: Rule = {
  id: "db.client-sets-privileged-field",
  title: "Browser code writes a billing or permission field",
  severity: "critical",
  category: "security",
  why: "If the frontend can set `is_paid`, `plan`, `credits` or `role`, so can anyone with DevTools. This is how paywalls in vibe-coded apps get bypassed.",
  fix: "Only change these fields from trusted server code (a verified Stripe webhook or an Edge Function), and add an RLS policy or column privilege that blocks the client from updating them.",
  check(project) {
    return scanLines(
      project,
      /\.(update|upsert|insert)\(\s*\{[^}]*\b(is_?paid|paid|is_?premium|premium|is_?pro|plan|tier|subscription(_status)?|credits|balance|role|is_?admin)\s*:/i,
      { files: (f) => f.clientSide },
    ).map((h) => ({ ...h, snippet: redact(h.snippet ?? "") }));
  },
};
