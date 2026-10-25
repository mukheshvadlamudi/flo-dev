import { createHash } from "node:crypto";
import type { CodeRef, Project, StructureReport } from "./types.js";
import { isCommentLine, isTestFile, JS_EXT, redact } from "./rules/helpers.js";

const SOURCE = /\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro|py|rb|go|php)$/;
const GOD_FILE_LINES = 400;
const DUP_WINDOW = 8;

const LAYERS: { name: string; re: RegExp; hint: string }[] = [
  { name: "UI components", re: /(^|\/)components\//, hint: "Reusable presentational components" },
  { name: "Pages / routes", re: /(^|\/)(pages|app|routes|views|screens)\//, hint: "One file per screen; thin, composes components" },
  { name: "Data access / services", re: /(^|\/)(services|repositories|repos|queries|data|db|server|actions)\//, hint: "All database and API calls live here, not in components" },
  { name: "Shared lib / utils", re: /(^|\/)(lib|utils|helpers|shared)\//, hint: "Pure helpers, clients, formatting" },
  { name: "Types / schemas", re: /(^|\/)(types|schemas|models|validators|validation)\/|\.d\.ts$|schema\.(t|j)s$/, hint: "Typed contracts and validation (zod) shared by client and server" },
  { name: "Hooks / state", re: /(^|\/)(hooks|stores?|state|context)\//, hint: "Data fetching hooks (TanStack Query) and client state" },
  { name: "Database migrations", re: /(^|\/)(migrations|supabase\/migrations|prisma\/migrations|drizzle)\//, hint: "Versioned schema changes, never edit the DB by hand" },
  { name: "Tests", re: /(\.|_)(test|spec)\.[a-z]+$|(^|\/)(__tests__|tests?|e2e)\//, hint: "Unit tests for logic, a few end-to-end tests for money paths" },
];

function routeFromPath(p: string, isNext: boolean): string | undefined {
  let m = isNext ? p.match(/(?:^|\/)app\/(.*\/)?(page|route)\.(t|j)sx?$/) : null;
  if (m) {
    const r = "/" + (m[1] ?? "").replace(/\/?$/, "").replace(/\([^)]*\)\/?/g, "");
    return (r.replace(/\/+/g, "/").replace(/\/$/, "") || "/") + (m[2] === "route" ? " (API)" : "");
  }
  m = isNext ? p.match(/(?:^|\/)pages\/(.*)\.(t|j)sx?$/) : null;
  if (m && !/^_/.test(m[1]!.split("/").pop()!)) {
    const r = "/" + m[1]!.replace(/(^|\/)index$/, "");
    return r.startsWith("/api") ? `${r} (API)` : r;
  }
  return undefined;
}

export function analyzeStructure(project: Project): StructureReport {
  const source = project.files.filter((f) => SOURCE.test(f.path));
  const sizes = source.map((f) => ({ path: f.path, lines: f.lines.length })).sort((a, b) => b.lines - a.lines);

  // Duplicate detection: hash normalised windows of N non-trivial lines across files.
  const windows = new Map<string, { file: string; line: number }>();
  const dupes: StructureReport["duplicateBlocks"] = [];
  const reported = new Set<string>();
  for (const f of source) {
    if (isTestFile(f)) continue;
    const norm = f.lines.map((l) => l.trim().replace(/\s+/g, " "));
    for (let i = 0; i + DUP_WINDOW <= norm.length; i++) {
      const block = norm.slice(i, i + DUP_WINDOW);
      if (block.filter((l) => l.length > 12 && !/^[})\];,]+$/.test(l) && !/^(import|export \{|\/\/|\*)/.test(l)).length < DUP_WINDOW - 1) continue;
      const hash = createHash("sha1").update(block.join("\n")).digest("hex");
      const prev = windows.get(hash);
      if (!prev) {
        windows.set(hash, { file: f.path, line: i + 1 });
        continue;
      }
      if (prev.file === f.path && Math.abs(prev.line - (i + 1)) < DUP_WINDOW) continue;
      const pair = [prev.file, f.path].sort().join("|");
      if (reported.has(pair)) continue;
      reported.add(pair);
      dupes.push({ a: prev.file, aLine: prev.line, b: f.path, bLine: i + 1, lines: DUP_WINDOW });
    }
  }

  const dataAccessInUi: CodeRef[] = [];
  for (const f of source) {
    if (!f.clientSide || !/\.(jsx|tsx|vue|svelte)$/.test(f.path) || isTestFile(f)) continue;
    if (/(^|\/)(services|queries|hooks|lib|api|data)\//.test(f.path)) continue;
    const idx = f.lines.findIndex((l) => !isCommentLine(l) && /supabase\s*\.from\(|prisma\.|\bfetch\(\s*["'`]https?:|firestore|collection\(\s*db/.test(l));
    if (idx >= 0) dataAccessInUi.push({ file: f.path, line: idx + 1, snippet: redact(f.lines[idx] ?? "") });
  }

  const envVars = new Set<string>();
  for (const f of project.files) {
    for (const m of f.content.matchAll(/(?:process\.env|import\.meta\.env|Deno\.env\.get\(\s*["'])\.?([A-Z][A-Z0-9_]{2,})/g)) envVars.add(m[1]!);
    if (/(^|\/)\.env(\.example|\.sample)?$/.test(f.path)) {
      for (const m of f.content.matchAll(/^([A-Z][A-Z0-9_]{2,})\s*=/gm)) envVars.add(m[1]!);
    }
  }

  const isNext = "next" in project.deps;
  const routes = [...new Set(project.allPaths.map((p) => routeFromPath(p, isNext)).filter((r): r is string => !!r))].sort();
  for (const f of project.files) {
    if (!JS_EXT.test(f.path)) continue;
    for (const m of f.content.matchAll(/<Route\s+[^>]*path=["']([^"']+)["']/g)) routes.push(m[1]!);
    for (const m of f.content.matchAll(/\{\s*path\s*:\s*["'](\/[^"']*|\*)["']/g)) routes.push(m[1]!);
  }

  return {
    totalFiles: project.files.length,
    totalLines: source.reduce((n, f) => n + f.lines.length, 0),
    largestFiles: sizes.slice(0, 8),
    godFiles: sizes.filter((s) => s.lines >= GOD_FILE_LINES && !/\.(d\.ts)$|generated|types\/supabase|database\.types/.test(s.path)),
    duplicateBlocks: dupes.slice(0, 15),
    todoCount: source.reduce((n, f) => n + f.lines.filter((l) => /\b(TODO|FIXME|HACK|XXX)\b/.test(l)).length, 0),
    anyCount: source.filter((f) => /\.tsx?$/.test(f.path)).reduce((n, f) => n + (f.content.match(/:\s*any\b|as any\b|<any>/g) ?? []).length, 0),
    testFiles: source.filter(isTestFile).length,
    sourceFiles: source.filter((f) => !isTestFile(f)).length,
    dataAccessInUi,
    layers: LAYERS.map((l) => ({ name: l.name, hint: l.hint, present: project.allPaths.some((p) => l.re.test(p)) })),
    envVarsUsed: [...envVars].sort(),
    routes: [...new Set(routes)].slice(0, 80),
  };
}
