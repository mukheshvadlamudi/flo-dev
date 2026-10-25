import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import type { PackageJson, Project, SourceFile } from "./types.js";

const IGNORED_DIRS = new Set([
  "node_modules",
  ".git",
  "dist",
  "build",
  ".next",
  ".nuxt",
  ".output",
  ".vercel",
  ".netlify",
  ".turbo",
  ".cache",
  "coverage",
  "out",
  "vendor",
  "__pycache__",
  ".venv",
  "venv",
  ".svelte-kit",
  ".expo",
  "Pods",
]);

const TEXT_EXTENSIONS = new Set([
  ".js", ".jsx", ".ts", ".tsx", ".mjs", ".cjs", ".vue", ".svelte", ".astro",
  ".py", ".rb", ".go", ".php", ".java", ".kt", ".rs", ".cs",
  ".sql", ".prisma", ".graphql",
  ".rules", ".json", ".yaml", ".yml", ".toml", ".ini", ".env", ".example",
  ".html", ".css", ".scss", ".md", ".sh", ".txt",
]);

const SPECIAL_NAMES = new Set([
  "Dockerfile", "Procfile", "Makefile", ".gitignore", ".dockerignore",
  ".env", ".env.local", ".env.production", ".env.development", ".npmrc",
]);

const MAX_FILE_BYTES = 512 * 1024;
const MAX_FILES = 5000;

const CLIENT_DIR_HINTS = [
  /(^|\/)src\/(components|pages|hooks|views|app)\//,
  /(^|\/)components\//,
  /(^|\/)public\//,
  /(^|\/)client\//,
  /(^|\/)frontend\//,
];

const SERVER_DIR_HINTS = [
  /(^|\/)supabase\/functions\//,
  /(^|\/)(api|server|backend|functions|netlify\/functions)\//,
  /(^|\/)app\/.*\/route\.(t|j)s$/,
  /(^|\/)pages\/api\//,
  /\.server\.(t|j)sx?$/,
  /(^|\/)middleware\.(t|j)s$/,
];

export function isClientSide(relPath: string, content: string): boolean {
  if (!/\.(jsx?|tsx?|vue|svelte|astro|mjs)$/.test(relPath)) return false;
  if (SERVER_DIR_HINTS.some((re) => re.test(relPath))) return false;
  if (/^\s*["']use server["']/m.test(content)) return false;
  if (/^\s*["']use client["']/m.test(content)) return true;
  if (/\.(jsx|tsx|vue|svelte)$/.test(relPath)) return true;
  if (CLIENT_DIR_HINTS.some((re) => re.test(relPath))) return true;
  // Vite / CRA style code reads its env through import.meta.env, which only exists in the bundle.
  return /import\.meta\.env/.test(content);
}

function wantFile(name: string): boolean {
  if (SPECIAL_NAMES.has(name) || name.startsWith(".env")) return true;
  return TEXT_EXTENSIONS.has(path.extname(name).toLowerCase());
}

export async function loadProject(root: string): Promise<Project> {
  const absRoot = path.resolve(root);
  const files: SourceFile[] = [];
  const allPaths: string[] = [];

  async function walk(dir: string): Promise<void> {
    if (files.length >= MAX_FILES) return;
    const entries = await readdir(dir, { withFileTypes: true });
    entries.sort((a, b) => a.name.localeCompare(b.name));
    for (const entry of entries) {
      const abs = path.join(dir, entry.name);
      const rel = path.relative(absRoot, abs).split(path.sep).join("/");
      if (entry.isSymbolicLink()) continue;
      if (entry.isDirectory()) {
        if (IGNORED_DIRS.has(entry.name)) continue;
        allPaths.push(rel + "/");
        await walk(abs);
        continue;
      }
      if (!entry.isFile()) continue;
      allPaths.push(rel);
      if (!wantFile(entry.name) || files.length >= MAX_FILES) continue;
      const info = await stat(abs);
      if (info.size > MAX_FILE_BYTES) continue;
      const content = await readFile(abs, "utf8");
      if (content.includes("\u0000")) continue;
      files.push({
        path: rel,
        content,
        lines: content.split(/\r?\n/),
        ext: path.extname(entry.name).toLowerCase(),
        clientSide: isClientSide(rel, content),
      });
    }
  }

  await walk(absRoot);
  return buildProject(absRoot, files, allPaths);
}

/** Builds a project from in-memory files; used by tests and by uploads. */
export function projectFromFiles(
  root: string,
  input: Record<string, string>,
): Project {
  const files: SourceFile[] = Object.entries(input).map(([p, content]) => ({
    path: p,
    content,
    lines: content.split(/\r?\n/),
    ext: path.extname(p).toLowerCase(),
    clientSide: isClientSide(p, content),
  }));
  return buildProject(root, files, Object.keys(input));
}

function buildProject(root: string, files: SourceFile[], allPaths: string[]): Project {
  const deps: Record<string, string> = {};
  let rootPkg: PackageJson | undefined;
  for (const f of files) {
    if (!f.path.endsWith("package.json")) continue;
    let pkg: PackageJson;
    try {
      pkg = JSON.parse(f.content) as PackageJson;
    } catch {
      continue;
    }
    if (f.path === "package.json") rootPkg = pkg;
    Object.assign(deps, pkg.devDependencies ?? {}, pkg.dependencies ?? {});
  }
  return { root, files, allPaths, packageJson: rootPkg, deps };
}
