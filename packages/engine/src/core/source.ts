import { execFile } from "node:child_process";
import { mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

export interface ResolvedSource {
  dir: string;
  label: string;
  name: string;
  commit?: string;
  cleanup(): Promise<void>;
}

const GITHUB = /^(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100}?)(?:\.git)?(?:\/tree\/([A-Za-z0-9._\/-]{1,200}))?\/?$/;

export function parseGitHubUrl(input: string): { owner: string; repo: string; ref?: string } | undefined {
  const short = input.trim().match(/^([A-Za-z0-9-]{1,39})\/([A-Za-z0-9._-]{1,100})$/);
  if (short) return { owner: short[1]!, repo: short[2]! };
  const m = input.trim().match(GITHUB);
  if (!m) return undefined;
  return { owner: m[1]!, repo: m[2]!, ref: m[3] };
}

/**
 * Shallow-clones a GitHub repo into a temp dir. The token (for private repos) is
 * passed as an HTTP header via env config, so it never appears in argv, the
 * remote URL or error messages.
 */
export async function cloneGitHub(input: string, token?: string): Promise<ResolvedSource> {
  const gh = parseGitHubUrl(input);
  if (!gh) throw new Error("Enter a GitHub repository URL like https://github.com/owner/repo.");
  const dir = await mkdtemp(path.join(os.tmpdir(), "flo-"));
  const cleanup = () => rm(dir, { recursive: true, force: true });
  const env: NodeJS.ProcessEnv = { ...process.env, GIT_TERMINAL_PROMPT: "0", GIT_ASKPASS: "echo" };
  if (token) {
    const basic = Buffer.from(`x-access-token:${token}`).toString("base64");
    env.GIT_CONFIG_COUNT = "1";
    env.GIT_CONFIG_KEY_0 = "http.https://github.com/.extraheader";
    env.GIT_CONFIG_VALUE_0 = `AUTHORIZATION: basic ${basic}`;
  }
  const args = ["clone", "--depth", "1", "--single-branch", "--no-tags", "--filter=blob:limit=2m"];
  if (gh.ref) args.push("--branch", gh.ref);
  args.push(`https://github.com/${gh.owner}/${gh.repo}.git`, dir);
  try {
    await run("git", args, { env, timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  } catch (err) {
    await cleanup();
    const msg = String((err as { stderr?: string }).stderr ?? err);
    if (/not found|Authentication failed|could not read Username|403/i.test(msg)) {
      throw new Error(token ? "GitHub refused access with that token. Check it has read access to this repo." : "Repository not found. If it's private, add a GitHub token with read access.");
    }
    throw new Error("Couldn't clone the repository. Check the URL and try again.");
  }
  let commit: string | undefined;
  try {
    commit = (await run("git", ["-C", dir, "rev-parse", "--short", "HEAD"])).stdout.trim();
  } catch {
    /* not fatal */
  }
  return { dir, label: `github.com/${gh.owner}/${gh.repo}${gh.ref ? `@${gh.ref}` : ""}`, name: gh.repo, commit, cleanup };
}

export async function resolveLocal(dir: string): Promise<ResolvedSource> {
  const abs = path.resolve(dir);
  const info = await stat(abs).catch(() => undefined);
  if (!info?.isDirectory()) throw new Error(`Not a directory: ${dir}`);
  return { dir: abs, label: abs, name: path.basename(abs), cleanup: async () => {} };
}
