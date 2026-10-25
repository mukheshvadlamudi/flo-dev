import type { Rule, RuleHit, Severity } from "../types.js";
import { decodeJwtPayload, hitAt, isCommentLine, isTestFile, redact, scanLines } from "./helpers.js";

const PLACEHOLDER = /(your[_-]|xxx|<[a-z_ -]+>|changeme|example|placeholder|dummy|\.\.\.|\*\*\*)/i;

const SECRET_PATTERNS: { name: string; re: RegExp; severity: Severity }[] = [
  { name: "Stripe live secret key", re: /\b(sk|rk)_live_[A-Za-z0-9]{16,}/, severity: "critical" },
  { name: "Stripe test secret key", re: /\bsk_test_[A-Za-z0-9]{16,}/, severity: "high" },
  { name: "Stripe webhook secret", re: /\bwhsec_[A-Za-z0-9]{16,}/, severity: "high" },
  { name: "Anthropic API key", re: /\bsk-ant-[A-Za-z0-9_-]{20,}/, severity: "critical" },
  { name: "OpenAI API key", re: /\bsk-(proj-)?[A-Za-z0-9_-]{32,}/, severity: "critical" },
  { name: "AWS access key", re: /\bAKIA[0-9A-Z]{16}\b/, severity: "critical" },
  { name: "GitHub token", re: /\b(gh[pousr]_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{40,})/, severity: "critical" },
  { name: "Slack token", re: /\bxox[abpr]-[A-Za-z0-9-]{20,}/, severity: "high" },
  { name: "SendGrid API key", re: /\bSG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,}/, severity: "high" },
  { name: "Resend API key", re: /\bre_[A-Za-z0-9]{20,}/, severity: "high" },
  { name: "Private key", re: /-----BEGIN (RSA |EC |OPENSSH |DSA |)PRIVATE KEY-----/, severity: "critical" },
  { name: "Google API key", re: /\bAIza[0-9A-Za-z_-]{35}\b/, severity: "medium" },
  { name: "Database URL with password", re: /\b(postgres(ql)?|mysql|mongodb(\+srv)?):\/\/[^:\s/]+:[^@\s]{4,}@/, severity: "critical" },
];

const GENERIC = /\b(secret|password|passwd|api[_-]?key|auth[_-]?token|access[_-]?token|private[_-]?key)\b["']?\s*[:=]\s*["'][^"'\s]{12,}["']/i;

export const hardcodedSecrets: Rule = {
  id: "secrets.hardcoded",
  title: "Hardcoded secret in source code",
  severity: "critical",
  category: "security",
  why: "Anything committed to the repo is readable by everyone with access to it, by every build log and, for frontend code, by every visitor. Bots scrape public repos for keys within minutes.",
  fix: "Revoke and rotate the key now (assume it is compromised), move it to an environment variable or secret manager, and read it only in server code. Purge it from git history with git-filter-repo if the repo was ever public.",
  references: ["https://owasp.org/Top10/A02_2021-Cryptographic_Failures/"],
  check(project) {
    const hits: RuleHit[] = [];
    for (const f of project.files) {
      if (/\.(example|sample|md)$/.test(f.path) || /\.env\.(example|sample|template)$/.test(f.path)) continue;
      if (f.path.endsWith("package-lock.json")) continue;
      f.lines.forEach((line, i) => {
        if (PLACEHOLDER.test(line)) return;
        for (const p of SECRET_PATTERNS) {
          if (!p.re.test(line)) continue;
          const exposed = f.clientSide ? " (in code shipped to the browser)" : "";
          hits.push({
            file: f.path,
            line: i + 1,
            snippet: redact(line),
            title: `${p.name} committed to the repo${exposed}`,
            severity: f.path.startsWith(".env") && p.severity === "medium" ? "high" : p.severity,
          });
          return;
        }
        if (!isTestFile(f) && !isCommentLine(line) && GENERIC.test(line) && !/process\.env|import\.meta\.env|os\.environ|getenv/.test(line)) {
          hits.push({ file: f.path, line: i + 1, snippet: redact(line), title: "Hardcoded credential-like value", severity: "high" });
        }
      });
    }
    return hits;
  },
};

export const supabaseServiceRole: Rule = {
  id: "supabase.service-role-exposed",
  title: "Supabase service_role key exposed",
  severity: "critical",
  category: "security",
  why: "The service_role key bypasses every Row Level Security policy. Anyone who has it can read, change or delete every row in every table.",
  fix: "Rotate the service_role key in Supabase → Project Settings → API. Only use it in server code (Edge Functions, API routes) loaded from a server-only env var. The browser must use the anon key plus RLS.",
  references: ["https://supabase.com/docs/guides/api/api-keys"],
  check(project) {
    const hits: RuleHit[] = [];
    const jwt = /eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}/g;
    for (const f of project.files) {
      for (const m of f.content.matchAll(jwt)) {
        const payload = decodeJwtPayload(m[0]);
        if (payload?.role === "service_role") {
          hits.push({ ...hitAt(f, m.index ?? 0), title: "Supabase service_role JWT committed to the repo" });
        }
      }
      if (f.clientSide) {
        f.lines.forEach((line, i) => {
          if (isCommentLine(line)) return;
          if (/service[_-]?role/i.test(line)) {
            hits.push({ file: f.path, line: i + 1, snippet: redact(line), title: "service_role key referenced in browser code" });
          }
        });
      }
    }
    return hits;
  },
};

export const publicEnvSecret: Rule = {
  id: "env.secret-in-public-var",
  title: "Secret stored in a public (browser-exposed) env variable",
  severity: "critical",
  category: "security",
  why: "VITE_, NEXT_PUBLIC_, EXPO_PUBLIC_ and REACT_APP_ variables are inlined into the JavaScript bundle at build time. Anyone can read them in DevTools.",
  fix: "Rename the variable without the public prefix, rotate the key, and move the code that uses it into a server route or Edge Function that the frontend calls.",
  check(project) {
    return scanLines(
      project,
      /\b(VITE|NEXT_PUBLIC|EXPO_PUBLIC|REACT_APP|PUBLIC)_[A-Z0-9_]*(SECRET|SERVICE_ROLE|PRIVATE|PASSWORD|OPENAI|ANTHROPIC|GEMINI|GROQ|STRIPE_SECRET|STRIPE_SK|SK_|WEBHOOK|DATABASE_URL|ADMIN)[A-Z0-9_]*/,
      { files: (f) => /\.(jsx?|tsx?|mjs|vue|svelte|astro)$/.test(f.path) || f.path.split("/").pop()!.startsWith(".env") },
    );
  },
};

export const aiKeyInBrowser: Rule = {
  id: "ai.sdk-in-browser",
  title: "LLM API called directly from the browser",
  severity: "high",
  category: "security",
  why: "Calling OpenAI/Anthropic/Gemini from the frontend ships your API key to every visitor. People will use it to run their own workloads on your bill.",
  fix: "Move the call behind a server route or Edge Function, authenticate the user there, and add per-user rate limits and spend caps.",
  check(project) {
    return scanLines(project, /dangerouslyAllowBrowser\s*:\s*true|new\s+(OpenAI|Anthropic|GoogleGenerativeAI)\(/, {
      files: (f) => f.clientSide,
    });
  },
};
