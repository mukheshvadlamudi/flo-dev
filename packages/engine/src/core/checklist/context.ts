import type {
  ChecklistArea,
  ChecklistItem,
  CheckStatus,
  CodeRef,
  Finding,
  LiveProbe,
  Project,
  ProjectKind,
  ProjectType,
  SourceFile,
  Stack,
  StructureReport,
  UserProfile,
} from "../types.js";
import { isCommentLine, isTestFile, redact } from "../rules/helpers.js";

export interface CheckContext {
  project: Project;
  stack: Stack;
  type: ProjectType;
  structure: StructureReport;
  findings: Finding[];
  profile: UserProfile;
}

export interface Verdict {
  status: CheckStatus;
  evidence: string;
  refs?: CodeRef[];
}

export interface CheckDef {
  id: string;
  area: ChecklistArea;
  title: string;
  /** Kinds this item applies to. Omitted = every project. */
  appliesTo?: ProjectKind[];
  /** Extra applicability test, e.g. "only when the project has a backend". */
  when?: (ctx: CheckContext) => boolean;
  priority: ChecklistItem["priority"] | ((ctx: CheckContext) => ChecklistItem["priority"]);
  relevance: string | ((ctx: CheckContext) => string);
  howTo: string | ((ctx: CheckContext) => string);
  evaluate(ctx: CheckContext): Verdict;
  /** Refines the verdict with what the deployed site actually returns. */
  live?(probe: LiveProbe, code: Verdict, ctx: CheckContext): Verdict | undefined;
}

export const WEB_KINDS: ProjectKind[] = ["local-business", "marketing-site", "saas-app", "ecommerce"];
export const PUBLIC_KINDS: ProjectKind[] = ["local-business", "marketing-site", "ecommerce"];

export const UI_FILE = (f: SourceFile) => /\.(jsx|tsx|vue|svelte|astro|html|mdx?)$/.test(f.path) && !isTestFile(f);
export const CODE_FILE = (f: SourceFile) => /\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro|py|rb|go|php)$/.test(f.path) && !isTestFile(f);
export const ANY_FILE = (f: SourceFile) => !isTestFile(f) && !f.path.endsWith("package-lock.json");

export function grep(ctx: CheckContext, re: RegExp, filter: (f: SourceFile) => boolean = CODE_FILE, limit = 5): CodeRef[] {
  const refs: CodeRef[] = [];
  for (const f of ctx.project.files) {
    if (!filter(f)) continue;
    for (let i = 0; i < f.lines.length; i++) {
      const line = f.lines[i]!;
      if (isCommentLine(line) || !re.test(line)) continue;
      refs.push({ file: f.path, line: i + 1, snippet: redact(line) });
      if (refs.length >= limit) return refs;
    }
  }
  return refs;
}

export function grepCount(ctx: CheckContext, re: RegExp, filter: (f: SourceFile) => boolean = CODE_FILE): number {
  const global = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
  let n = 0;
  for (const f of ctx.project.files) if (filter(f)) n += (f.content.match(global) ?? []).length;
  return n;
}

export function paths(ctx: CheckContext, re: RegExp): CodeRef[] {
  return ctx.project.allPaths.filter((p) => re.test(p)).slice(0, 5).map((file) => ({ file }));
}

export function dep(ctx: CheckContext, ...names: string[]): string | undefined {
  return names.find((n) => n in ctx.project.deps || (n.endsWith("*") && Object.keys(ctx.project.deps).some((d) => d.startsWith(n.slice(0, -1)))));
}

export function findingsFor(ctx: CheckContext, ...ruleIds: string[]): Finding[] {
  return ctx.findings.filter((f) => ruleIds.includes(f.ruleId));
}

export function refsFromFindings(fs: Finding[]): CodeRef[] {
  return fs.slice(0, 5).map((f) => ({ file: f.file ?? "", line: f.line, snippet: f.snippet }));
}

export const has = (ctx: CheckContext, k: ProjectKind) => ctx.type.kinds.includes(k);

/** Managed platforms that put a CDN, TLS and load balancing in front of the app for you. */
export function managedEdge(ctx: CheckContext): string | undefined {
  return ctx.stack.hosting.find((h) => ["Vercel", "Netlify", "Cloudflare", "Firebase Hosting"].includes(h));
}

export const pass = (evidence: string, refs: CodeRef[] = []): Verdict => ({ status: "pass", evidence, refs });
export const fail = (evidence: string, refs: CodeRef[] = []): Verdict => ({ status: "fail", evidence, refs });
export const warn = (evidence: string, refs: CodeRef[] = []): Verdict => ({ status: "warn", evidence, refs });
export const unknown = (evidence: string, refs: CodeRef[] = []): Verdict => ({ status: "unknown", evidence, refs });
export const na = (evidence: string): Verdict => ({ status: "na", evidence, refs: [] });

export const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;
