"use client";

import type { AuditReport, ScanEvent } from "@flo/engine";
import { Check, Loader2, X } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { ReportView } from "./report-view";

const STEPS: { stage: ScanEvent["stage"]; label: string }[] = [
  { stage: "source", label: "Fetching your code" },
  { stage: "read", label: "Reading every file" },
  { stage: "stack", label: "Detecting stack & project type" },
  { stage: "rules", label: "Hunting security holes & bugs" },
  { stage: "live", label: "Testing the live site" },
  { stage: "checklist", label: "Running the production checklist" },
  { stage: "architecture", label: "Planning your architecture" },
  { stage: "ai", label: "Claude reviews it for your goals" },
];

export function ScanProgress({ id, label }: { id: string; label: string }) {
  const [events, setEvents] = useState<ScanEvent[]>([]);
  const [report, setReport] = useState<AuditReport | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const es = new EventSource(`/api/scans/${id}/events`);
    es.onmessage = async (m) => {
      const e = JSON.parse(m.data) as ScanEvent;
      setEvents((prev) => [...prev, e]);
      if (e.stage === "error") {
        setError(e.message);
        es.close();
      }
      if (e.stage === "done") {
        es.close();
        const res = await fetch(`/api/scans/${id}`);
        const data = (await res.json()) as { report?: AuditReport; error?: string };
        if (data.report) setReport(data.report);
        else setError(data.error ?? "Couldn't load the report.");
      }
    };
    es.onerror = () => {
      es.close();
      // The stream can drop on deploys or proxies; fall back to polling the result.
      void fetch(`/api/scans/${id}`)
        .then((r) => r.json())
        .then((d: { status?: string; report?: AuditReport; error?: string }) => (d.report ? setReport(d.report) : d.status === "error" && setError(d.error ?? "The scan failed.")));
    };
    return () => es.close();
  }, [id]);

  if (report) {
    return (
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
        <ReportView report={report} />
      </motion.div>
    );
  }

  const seen = new Set(events.map((e) => e.stage));
  // Furthest step reached so far; error events don't move it.
  const reached = Math.max(-1, ...events.map((e) => STEPS.findIndex((x) => x.stage === e.stage)));
  const last = events.at(-1);
  const progress = last?.progress ?? 0.02;
  const visible = STEPS.filter((s) => s.stage !== "live" || seen.has("live")).filter((s) => s.stage !== "ai" || seen.has("ai") || !seen.has("done"));

  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-md flex-col justify-center px-4">
      <p className="font-mono text-xs text-faint">{label}</p>
      <h1 className="mt-2 text-2xl font-semibold tracking-tight">{error ? "The scan stopped" : <span className="shimmer-text">Auditing your app…</span>}</h1>
      <div className="mt-6 h-1 overflow-hidden rounded-full bg-sunken">
        <motion.div className={cn("h-full rounded-full", error ? "bg-critical" : "bg-accent")} animate={{ width: `${Math.max(progress * 100, 3)}%` }} transition={{ type: "spring", bounce: 0, duration: 0.8 }} />
      </div>
      <ul className="mt-8 space-y-3">
        <AnimatePresence initial={false}>
          {visible.map((s, i) => {
            const mine = STEPS.findIndex((x) => x.stage === s.stage);
            const state = last?.stage === "done" || mine < reached ? "done" : mine === reached && !error ? "active" : "idle";
            return (
              <motion.li key={s.stage} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.03 }} className="flex items-center gap-3 text-sm">
                <span className={cn("grid size-5 place-items-center rounded-full border", state === "done" ? "border-accent bg-accent text-accent-ink" : state === "active" ? "border-fg" : "border-line-strong")}>
                  {state === "done" ? <Check className="size-3" strokeWidth={3} /> : state === "active" ? <Loader2 className="size-3 animate-spin" /> : null}
                </span>
                <span className={cn(state === "idle" ? "text-faint" : "text-fg")}>{state === "active" && last ? last.message : s.label}</span>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
      {error && (
        <div className="mt-8 rounded-xl border border-critical/25 bg-critical/5 p-4 text-sm">
          <p className="flex items-center gap-2 font-medium">
            <X className="size-4 text-critical" /> {error}
          </p>
          <Link href="/#audit" className="mt-3 inline-block text-muted underline-offset-4 hover:text-fg hover:underline">
            Try another repository
          </Link>
        </div>
      )}
    </div>
  );
}
