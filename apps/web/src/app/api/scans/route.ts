import { NextResponse } from "next/server";
import { z } from "zod";
import { parseGitHubUrl } from "@flo/engine";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { canStart, startScan } from "@/lib/runner";

export const runtime = "nodejs";

const Body = z
  .object({
    repo: z.string().trim().max(300).optional(),
    token: z.string().trim().max(300).optional(),
    liveUrl: z.string().trim().max(300).optional(),
    sample: z.boolean().optional(),
    profile: z
      .object({
        expectedUsers: z.number().int().min(0).max(100_000_000).optional(),
        teamSize: z.number().int().min(1).max(10_000).optional(),
        monthlyBudgetUsd: z.number().min(0).max(10_000_000).optional(),
        productDescription: z.string().max(500).optional(),
        kindOverride: z.enum(["local-business", "marketing-site", "saas-app", "ecommerce", "api", "mobile-app"]).optional(),
        compliance: z.array(z.string().max(40)).max(10).optional(),
        handlesPayments: z.boolean().optional(),
        handlesPII: z.boolean().optional(),
        realtime: z.boolean().optional(),
      })
      .default({}),
  })
  .refine((b) => b.sample || (b.repo && parseGitHubUrl(b.repo)), { message: "Enter a GitHub repository URL like https://github.com/owner/repo." })
  .refine((b) => !b.liveUrl || /^(https?:\/\/)?[a-z0-9.-]+\.[a-z]{2,}(:\d+)?(\/.*)?$/i.test(b.liveUrl), { message: "The live URL doesn't look like a website address." });

export async function POST(req: Request) {
  const limit = rateLimit(`scan:${clientIp(req)}`, 6, 10 * 60 * 1000);
  if (!limit.ok) return NextResponse.json({ error: `Too many scans. Try again in ${limit.retryAfter}s.` }, { status: 429, headers: { "retry-after": String(limit.retryAfter) } });

  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch (err) {
    const msg = err instanceof z.ZodError ? err.issues[0]?.message : "Invalid request.";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
  if (!canStart()) return NextResponse.json({ error: "Flo is busy with other scans. Try again in a minute." }, { status: 503 });

  const id = startScan({ repo: body.repo, token: body.token || undefined, liveUrl: body.liveUrl, sample: body.sample, profile: body.profile });
  return NextResponse.json({ id }, { status: 202 });
}
