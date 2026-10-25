import { NextResponse } from "next/server";
import { z } from "zod";
import { verifyHuman } from "@/lib/bot-check";
import { clientIp, rateLimit } from "@/lib/rate-limit";
import { saveEnquiry } from "@/lib/store";

export const runtime = "nodejs";

const Body = z.object({
  name: z.string().trim().min(1, "Please add your name.").max(120),
  email: z.email("Please enter a valid email.").max(200),
  repo: z.string().trim().max(300).optional().default(""),
  plan: z.enum(["audit", "sprint", "retainer"]).default("audit"),
  message: z.string().trim().max(2000).optional().default(""),
  reportId: z.string().max(60).optional().default(""),
  human: z.string().max(4096).optional(),
});

export async function POST(req: Request) {
  if (!rateLimit(`enquiry:${clientIp(req)}`, 5, 60 * 60 * 1000).ok) return NextResponse.json({ error: "Too many requests." }, { status: 429 });
  const parsed = Body.safeParse(await req.json().catch(() => ({})));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid form." }, { status: 400 });
  const { human, ...enquiry } = parsed.data;
  if (!(await verifyHuman(human, clientIp(req)))) return NextResponse.json({ error: "Please complete the quick human check and try again." }, { status: 403 });
  await saveEnquiry(enquiry);
  return NextResponse.json({ ok: true });
}
