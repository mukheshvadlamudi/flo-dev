import type { ScanEvent } from "@flo/engine";
import { isReportId, jobs, loadReport } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Server-sent events: replays progress so far, then streams new events until the scan ends. */
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!isReportId(id)) return new Response("Not found", { status: 404 });
  const job = jobs.get(id);
  const encoder = new TextEncoder();
  const send = (c: ReadableStreamDefaultController, e: ScanEvent) => c.enqueue(encoder.encode(`data: ${JSON.stringify(e)}\n\n`));

  const stream = new ReadableStream({
    async start(controller) {
      if (!job) {
        const done = await loadReport(id);
        send(controller, done ? { stage: "done", message: "Report ready", progress: 1 } : { stage: "error", message: "This scan no longer exists.", progress: 1 });
        controller.close();
        return;
      }
      for (const e of job.events) send(controller, e);
      if (job.status === "done" || job.status === "error") {
        controller.close();
        return;
      }
      const listener = (e: ScanEvent) => {
        send(controller, e);
        if (e.stage === "done" || e.stage === "error") {
          job.listeners.delete(listener);
          controller.close();
        }
      };
      job.listeners.add(listener);
      req.signal.addEventListener("abort", () => job.listeners.delete(listener));
    },
  });
  return new Response(stream, { headers: { "content-type": "text/event-stream", "cache-control": "no-cache, no-transform", connection: "keep-alive" } });
}
