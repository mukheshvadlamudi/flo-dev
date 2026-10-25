import type { Project, RuleHit, SourceFile } from "../types.js";

export const CODE_EXT = /\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro|py|rb|go|php)$/;
export const JS_EXT = /\.(jsx?|tsx?|mjs|cjs|vue|svelte|astro)$/;

export function isCode(f: SourceFile): boolean {
  return CODE_EXT.test(f.path);
}

export function isTestFile(f: SourceFile): boolean {
  return /(\.|_)(test|spec)\.[a-z]+$/.test(f.path) || /(^|\/)(__tests__|__mocks__|tests?|e2e|cypress)\//.test(f.path);
}

/** True for lines that are only a comment, so commented-out code is not reported. */
export function isCommentLine(line: string): boolean {
  return /^\s*(\/\/|#|\*|\/\*|--)/.test(line);
}

/** Masks anything that looks like a credential so reports never leak the secret they found. */
export function redact(line: string): string {
  let out = line.trim();
  out = out.replace(/eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g, "eyJ…[redacted JWT]");
  out = out.replace(
    /\b(sk|rk|pk)_(live|test)_[A-Za-z0-9]{6,}|sk-(ant-|proj-)?[A-Za-z0-9_-]{12,}|AKIA[0-9A-Z]{12,}|gh[pousr]_[A-Za-z0-9]{20,}|github_pat_[A-Za-z0-9_]{20,}|xox[abpr]-[A-Za-z0-9-]{10,}|AIza[0-9A-Za-z_-]{20,}|SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}|re_[A-Za-z0-9]{16,}|whsec_[A-Za-z0-9]{10,}/g,
    (m) => m.slice(0, Math.min(8, m.length)) + "…[redacted]",
  );
  out = out.replace(
    /((?:secret|password|passwd|api[_-]?key|token|private[_-]?key)["']?\s*[:=]\s*["'])([^"']{4,})(["'])/gi,
    (_m, a: string, _b: string, c: string) => `${a}…[redacted]${c}`,
  );
  return out.length > 220 ? out.slice(0, 217) + "…" : out;
}

export interface LineScanOptions {
  files?: (f: SourceFile) => boolean;
  /** Skip the line when this also matches it (e.g. a safe usage on the same line). */
  unless?: RegExp;
  /** Skip the whole file when its content matches (e.g. it imports a sanitizer). */
  fileUnless?: RegExp;
  includeTests?: boolean;
  includeComments?: boolean;
}

export function scanLines(project: Project, pattern: RegExp, opts: LineScanOptions = {}): RuleHit[] {
  const hits: RuleHit[] = [];
  for (const f of project.files) {
    if (opts.files ? !opts.files(f) : !isCode(f)) continue;
    if (!opts.includeTests && isTestFile(f)) continue;
    if (opts.fileUnless && opts.fileUnless.test(f.content)) continue;
    f.lines.forEach((line, i) => {
      if (!opts.includeComments && isCommentLine(line)) return;
      if (!pattern.test(line)) return;
      if (opts.unless && opts.unless.test(line)) return;
      hits.push({ file: f.path, line: i + 1, snippet: redact(line) });
    });
  }
  return hits;
}

/** 1-based line number of a character offset in a file. */
export function lineAt(f: SourceFile, index: number): number {
  return f.content.slice(0, index).split(/\r?\n/).length;
}

export function hitAt(f: SourceFile, index: number): RuleHit {
  const line = lineAt(f, index);
  return { file: f.path, line, snippet: redact(f.lines[line - 1] ?? "") };
}

export function decodeJwtPayload(token: string): Record<string, unknown> | undefined {
  const part = token.split(".")[1];
  if (!part) return undefined;
  try {
    return JSON.parse(Buffer.from(part, "base64url").toString("utf8")) as Record<string, unknown>;
  } catch {
    return undefined;
  }
}
