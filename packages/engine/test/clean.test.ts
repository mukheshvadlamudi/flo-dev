import { describe, expect, it } from "vitest";
import { projectFromFiles, scanProject } from "../src/index.js";

const files: Record<string, string> = {
  "package.json": JSON.stringify({
    name: "tidy",
    dependencies: { next: "16.0.0", react: "19.0.0", "@supabase/supabase-js": "2", "@supabase/ssr": "1", stripe: "16", zod: "4", "@sentry/nextjs": "9", "@upstash/ratelimit": "2", "@tanstack/react-query": "5" },
    devDependencies: { vitest: "3", "@playwright/test": "1", typescript: "5" },
  }),
  "vercel.json": "{}",
  ".gitignore": ".env*\n!.env.example\n",
  ".env.example": "NEXT_PUBLIC_SUPABASE_URL=\nNEXT_PUBLIC_SUPABASE_ANON_KEY=\nSTRIPE_SECRET_KEY=\nSTRIPE_WEBHOOK_SECRET=\n",
  "tsconfig.json": '{ "compilerOptions": { "strict": true } }',
  "eslint.config.mjs": "export default [];",
  ".github/workflows/ci.yml": "steps:\n  - run: npm run lint\n  - run: npx tsc --noEmit\n  - run: npm test\n  - run: npm run build\n",
  ".github/dependabot.yml": "version: 2\n",
  "app/layout.tsx": 'export const metadata = { title: { template: "%s · Tidy", default: "Tidy — invoices" }, description: "Send invoices in seconds and get paid twice as fast." };\nexport default function L({ children }) { return <html><body>{children}</body></html>; }\n',
  "app/page.tsx": 'import Link from "next/link";\nexport const metadata = { title: "Home" };\nexport default function Page() { return <main><h1>Invoices</h1><Link href="/signup">Start free</Link></main>; }\n',
  "app/not-found.tsx": "export default function NotFound() { return <p>Not found</p>; }\n",
  "app/error.tsx": '"use client";\nexport default function E() { return <p>Error</p>; }\n',
  "app/robots.ts": 'export default function robots() { return { rules: { userAgent: "*", allow: "/" }, sitemap: "https://tidy.app/sitemap.xml" }; }\n',
  "app/sitemap.ts": "export default function sitemap() { return []; }\n",
  "app/opengraph-image.tsx": "export default function OG() { return null; }\n",
  "app/privacy/page.tsx": 'export const metadata = { title: "Privacy" };\nexport default function P() { return <p>Privacy</p>; }\n',
  "app/terms/page.tsx": 'export const metadata = { title: "Terms" };\nexport default function T() { return <p>Terms</p>; }\n',
  "app/api/health/route.ts": "export function GET() { return Response.json({ ok: true }); }\n",
  "app/api/stripe/webhook/route.ts": `import Stripe from "stripe";
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
export async function POST(req: Request) {
  const event = stripe.webhooks.constructEvent(await req.text(), req.headers.get("stripe-signature")!, process.env.STRIPE_WEBHOOK_SECRET!);
  if (event.type === "checkout.session.completed") { /* grant access */ }
  return new Response("ok");
}
`,
  "app/api/invoices/route.ts": `import { z } from "zod";
import { createClient } from "@/server/supabase";
const Body = z.object({ amount: z.number().int() });
export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response("Unauthorized", { status: 401 });
  const input = Body.parse(await req.json());
  const { error } = await supabase.from("invoices").insert({ amount: input.amount, user_id: user.id });
  if (error) throw error;
  return Response.json({ ok: true });
}
`,
  "server/supabase.ts": 'import { createServerClient } from "@supabase/ssr";\nimport { Ratelimit } from "@upstash/ratelimit";\nexport async function createClient() { return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: {} }); }\n',
  "supabase/migrations/001_init.sql": `create table public.invoices (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users,
  amount bigint not null
);
alter table public.invoices enable row level security;
create policy "own invoices" on public.invoices for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index on public.invoices (user_id);
`,
  "tests/invoice.test.ts": "test('x', () => {});\n",
  "README.md": "# Tidy\n\n" + "Setup instructions. ".repeat(40),
};

describe("well-built Next.js SaaS", async () => {
  const report = await scanProject({ project: projectFromFiles("tidy", files), projectName: "tidy", sourceLabel: "test", useAi: false });

  it("has no critical or high security findings", () => {
    const bad = report.findings.filter((f) => f.category === "security" && (f.severity === "critical" || f.severity === "high"));
    expect(bad).toEqual([]);
  });

  it("passes the checks it implements", () => {
    const status = (id: string) => report.checklist.find((c) => c.id === id)?.status;
    for (const id of ["sec.rls", "sec.secrets", "sec.env-files", "sec.server-auth", "sec.payments", "sec.rate-limiting", "sec.validation", "data.migrations", "data.indexes", "rel.error-tracking", "rel.error-boundaries", "rel.health-check", "del.ci", "del.strict-types", "seo.unique-titles", "seo.meta-descriptions", "seo.custom-404", "seo.robots", "seo.sitemap", "seo.og-images", "comp.privacy-policy", "perf.code-splitting", "perf.cdn"]) {
      expect(status(id), id).toBe("pass");
    }
  });

  it("scores well", () => {
    expect(report.scores.security).toBeGreaterThanOrEqual(85);
    expect(report.scores.overall).toBeGreaterThan(65);
  });

  it("does not run local-business checks on a SaaS", () => {
    expect(report.projectType.primary).toBe("saas-app");
    expect(report.checklist.find((c) => c.id === "seo.local-business-schema")).toBeUndefined();
    expect(report.checklist.find((c) => c.id === "conv.map-directions")).toBeUndefined();
  });
});
