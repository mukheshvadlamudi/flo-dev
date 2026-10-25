import type { Project, Stack } from "./types.js";

type Detector = { label: string; deps?: string[]; files?: RegExp[]; content?: RegExp };

const FRAMEWORKS: Detector[] = [
  { label: "Next.js", deps: ["next"] },
  { label: "React", deps: ["react"] },
  { label: "Vite", deps: ["vite"] },
  { label: "Remix", deps: ["@remix-run/react", "@react-router/dev"] },
  { label: "Vue", deps: ["vue"] },
  { label: "Nuxt", deps: ["nuxt"] },
  { label: "SvelteKit", deps: ["@sveltejs/kit"] },
  { label: "Astro", deps: ["astro"] },
  { label: "Expo / React Native", deps: ["expo", "react-native"] },
  { label: "Express", deps: ["express"] },
  { label: "Fastify", deps: ["fastify"] },
  { label: "Hono", deps: ["hono"] },
  { label: "NestJS", deps: ["@nestjs/core"] },
  { label: "tRPC", deps: ["@trpc/server"] },
  { label: "Django", files: [/(^|\/)manage\.py$/] },
  { label: "FastAPI", files: [/requirements\.txt$/, /pyproject\.toml$/], content: /fastapi/i },
  { label: "Flask", files: [/requirements\.txt$/, /pyproject\.toml$/], content: /\bflask\b/i },
  { label: "Rails", files: [/(^|\/)Gemfile$/], content: /rails/ },
  { label: "Laravel", files: [/(^|\/)artisan$/, /composer\.json$/], content: /laravel/ },
];

const DATABASES: Detector[] = [
  { label: "Supabase (Postgres)", deps: ["@supabase/supabase-js", "@supabase/ssr"], files: [/(^|\/)supabase\/(config\.toml|migrations\/)/] },
  { label: "Firebase / Firestore", deps: ["firebase", "firebase-admin"] },
  { label: "PostgreSQL", deps: ["pg", "postgres", "@neondatabase/serverless", "@vercel/postgres"] },
  { label: "MySQL", deps: ["mysql", "mysql2"] },
  { label: "MongoDB", deps: ["mongodb", "mongoose"] },
  { label: "SQLite", deps: ["better-sqlite3", "sqlite3", "@libsql/client"] },
  { label: "Redis", deps: ["redis", "ioredis", "@upstash/redis"] },
  { label: "Convex", deps: ["convex"] },
  { label: "PocketBase", deps: ["pocketbase"] },
];

const ORMS: Detector[] = [
  { label: "Prisma", deps: ["prisma", "@prisma/client"] },
  { label: "Drizzle", deps: ["drizzle-orm"] },
  { label: "TypeORM", deps: ["typeorm"] },
  { label: "Sequelize", deps: ["sequelize"] },
  { label: "Kysely", deps: ["kysely"] },
  { label: "Mongoose", deps: ["mongoose"] },
];

const AUTH: Detector[] = [
  { label: "Supabase Auth", content: /supabase\.auth\./ },
  { label: "Clerk", deps: ["@clerk/nextjs", "@clerk/clerk-react", "@clerk/express"] },
  { label: "Auth.js / NextAuth", deps: ["next-auth", "@auth/core"] },
  { label: "Better Auth", deps: ["better-auth"] },
  { label: "Lucia", deps: ["lucia"] },
  { label: "Firebase Auth", content: /getAuth\(|firebase\/auth/ },
  { label: "Auth0", deps: ["@auth0/nextjs-auth0", "@auth0/auth0-react"] },
  { label: "Custom JWT", deps: ["jsonwebtoken", "jose"] },
  { label: "Passport", deps: ["passport"] },
];

const PAYMENTS: Detector[] = [
  { label: "Stripe", deps: ["stripe", "@stripe/stripe-js", "@stripe/react-stripe-js"] },
  { label: "Lemon Squeezy", deps: ["@lemonsqueezy/lemonsqueezy.js"] },
  { label: "Paddle", deps: ["@paddle/paddle-js", "@paddle/paddle-node-sdk"] },
  { label: "Razorpay", deps: ["razorpay"] },
  { label: "Polar", deps: ["@polar-sh/sdk"] },
  { label: "Dodo Payments", deps: ["dodopayments"] },
];

const HOSTING: Detector[] = [
  { label: "Vercel", files: [/(^|\/)vercel\.json$/] },
  { label: "Netlify", files: [/(^|\/)netlify\.toml$/] },
  { label: "Fly.io", files: [/(^|\/)fly\.toml$/] },
  { label: "Render", files: [/(^|\/)render\.yaml$/] },
  { label: "Railway", files: [/(^|\/)railway\.(json|toml)$/] },
  { label: "Cloudflare", files: [/(^|\/)wrangler\.(toml|json|jsonc)$/] },
  { label: "Firebase Hosting", files: [/(^|\/)firebase\.json$/] },
  { label: "Heroku", files: [/(^|\/)Procfile$/] },
  { label: "AWS (CDK/SAM/Amplify)", files: [/(^|\/)(cdk\.json|template\.ya?ml|amplify\/)/] },
  { label: "Docker", files: [/(^|\/)Dockerfile$/, /docker-compose\.ya?ml$/] },
];

const AI: Detector[] = [
  { label: "Anthropic", deps: ["@anthropic-ai/sdk"] },
  { label: "OpenAI", deps: ["openai"] },
  { label: "Vercel AI SDK", deps: ["ai"] },
  { label: "LangChain", deps: ["langchain", "@langchain/core"] },
  { label: "Google Gemini", deps: ["@google/generative-ai", "@google/genai"] },
];

function match(project: Project, detectors: Detector[]): string[] {
  const found: string[] = [];
  for (const d of detectors) {
    const depHit = d.deps?.some((dep) => dep in project.deps) ?? false;
    let fileHit = false;
    if (d.files) {
      const candidates = project.allPaths.filter((p) => d.files!.some((re) => re.test(p)));
      if (d.content) {
        fileHit = candidates.some((p) => {
          const f = project.files.find((x) => x.path === p);
          return f ? d.content!.test(f.content) : false;
        });
      } else {
        fileHit = candidates.length > 0;
      }
    } else if (d.content && !d.deps) {
      fileHit = project.files.some((f) => d.content!.test(f.content));
    }
    if (depHit || fileHit) found.push(d.label);
  }
  return found;
}

function detectBuilder(project: Project): string | undefined {
  const has = (re: RegExp) => project.allPaths.some((p) => re.test(p));
  const text = project.files
    .filter((f) => /(^|\/)(README\.md|index\.html|package\.json)$/.test(f.path))
    .map((f) => f.content)
    .join("\n");
  if ("lovable-tagger" in project.deps || /lovable\.(dev|app)/i.test(text)) return "Lovable";
  if (has(/(^|\/)\.bolt\//) || /bolt\.new/i.test(text)) return "Bolt";
  if (has(/(^|\/)\.replit$/) || has(/(^|\/)replit\.nix$/)) return "Replit";
  if (/v0\.(dev|app)/i.test(text)) return "v0";
  if (has(/(^|\/)\.cursor\//) || has(/\.cursorrules$/)) return "Cursor";
  if (has(/(^|\/)CLAUDE\.md$/)) return "Claude Code";
  if (/base44/i.test(text)) return "Base44";
  return undefined;
}

export function detectStack(project: Project): Stack {
  const exts = new Set(project.files.map((f) => f.ext));
  const languages: string[] = [];
  if (exts.has(".ts") || exts.has(".tsx")) languages.push("TypeScript");
  if (exts.has(".js") || exts.has(".jsx") || exts.has(".mjs")) languages.push("JavaScript");
  if (exts.has(".py")) languages.push("Python");
  if (exts.has(".go")) languages.push("Go");
  if (exts.has(".rb")) languages.push("Ruby");
  if (exts.has(".php")) languages.push("PHP");
  if (exts.has(".sql")) languages.push("SQL");

  const paths = project.allPaths;
  const hasTests =
    paths.some((p) => /(\.|_)(test|spec)\.[a-z]+$/.test(p) || /(^|\/)(__tests__|tests?|e2e)\//.test(p)) ||
    ["vitest", "jest", "@playwright/test", "cypress", "mocha"].some((d) => d in project.deps);
  const hasCI = paths.some((p) =>
    /^\.github\/workflows\/.+\.ya?ml$/.test(p) || /^\.gitlab-ci\.yml$/.test(p) || /^\.circleci\//.test(p),
  );

  let packageManager: string | undefined;
  if (paths.includes("pnpm-lock.yaml")) packageManager = "pnpm";
  else if (paths.includes("bun.lockb") || paths.includes("bun.lock")) packageManager = "bun";
  else if (paths.includes("yarn.lock")) packageManager = "yarn";
  else if (paths.includes("package-lock.json")) packageManager = "npm";

  return {
    languages,
    frameworks: match(project, FRAMEWORKS),
    database: match(project, DATABASES),
    orm: match(project, ORMS),
    auth: match(project, AUTH),
    payments: match(project, PAYMENTS),
    hosting: match(project, HOSTING),
    ai: match(project, AI),
    builder: detectBuilder(project),
    hasTests,
    hasCI,
    hasDocker: paths.some((p) => /(^|\/)Dockerfile$/.test(p)),
    packageManager,
  };
}
