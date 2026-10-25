import { NextResponse } from "next/server";
import { isReportId, jobs, loadReport } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isReportId(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const report = await loadReport(id);
  if (report) return NextResponse.json({ status: "done", report });
  const job = jobs.get(id);
  if (!job) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json({ status: job.status, events: job.events, error: job.error, label: job.label });
}
