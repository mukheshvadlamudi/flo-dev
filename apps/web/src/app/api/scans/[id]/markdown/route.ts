import { clientIp, rateLimit } from "@/lib/rate-limit";
import { toMarkdown } from "@flo/engine";
import { loadReport } from "@/lib/store";

export const runtime = "nodejs";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!rateLimit(`md:${clientIp(req)}`, 60, 60 * 1000).ok) return new Response("Too many requests", { status: 429 });
  const report = await loadReport(id);
  if (!report) return new Response("Not found", { status: 404 });
  const name = report.projectName.replace(/[^a-z0-9-_]/gi, "-");
  return new Response(toMarkdown(report), {
    headers: { "content-type": "text/markdown; charset=utf-8", "content-disposition": `attachment; filename="flo-audit-${name}.md"` },
  });
}
