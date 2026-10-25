"use client";

import type { RoadmapPhase, RoadmapStep } from "@flo/engine";
import { Check } from "lucide-react";
import { motion } from "motion/react";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";

const PHASES: { phase: RoadmapPhase; hint: string; color: string }[] = [
  { phase: "Fix now", hint: "Security holes and data-loss risks. Do these today.", color: "var(--critical)" },
  { phase: "Before launch", hint: "Must-haves before real users and real money.", color: "var(--high)" },
  { phase: "First month", hint: "Make it solid, findable and measurable.", color: "var(--medium)" },
  { phase: "When you grow", hint: "Scale work, worth doing once traffic arrives.", color: "var(--low)" },
];
const EFFORT = { minutes: "~15 min", hours: "~2–4 h", days: "1–3 days" };

export function Roadmap({ steps, reportId }: { steps: RoadmapStep[]; reportId: string }) {
  const key = `flo-roadmap-${reportId}`;
  const [done, setDone] = useState<Record<string, boolean>>({});
  useEffect(() => {
    try {
      setDone(JSON.parse(localStorage.getItem(key) ?? "{}"));
    } catch {
      /* storage blocked */
    }
  }, [key]);
  const toggle = (id: string) =>
    setDone((d) => {
      const next = { ...d, [id]: !d[id] };
      try {
        localStorage.setItem(key, JSON.stringify(next));
      } catch {
        /* storage blocked */
      }
      return next;
    });

  const total = steps.length;
  const completed = steps.filter((s, i) => done[stepId(s, i)]).length;

  return (
    <div>
      <div className="flex items-center gap-4">
        <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-sunken">
          <motion.div className="h-full rounded-full bg-accent" animate={{ width: `${total ? (completed / total) * 100 : 0}%` }} transition={{ type: "spring", bounce: 0 }} />
        </div>
        <span className="font-mono text-xs text-muted tabular-nums">
          {completed}/{total} done
        </span>
      </div>
      <div className="mt-6 space-y-10">
        {PHASES.map(({ phase, hint, color }) => {
          const list = steps.map((s, i) => [s, stepId(s, i)] as const).filter(([s]) => s.phase === phase);
          if (!list.length) return null;
          return (
            <section key={phase} className="relative pl-7">
              <span className="absolute top-1.5 left-0 size-3 rounded-full ring-4 ring-bg" style={{ background: color }} />
              <span className="absolute top-6 bottom-0 left-[5.5px] w-px bg-line" />
              <h3 className="text-[15px] font-semibold">
                {phase} <span className="ml-1 font-mono text-xs font-normal text-faint">{list.length}</span>
              </h3>
              <p className="text-[13px] text-muted">{hint}</p>
              <ul className="mt-3 space-y-2">
                {list.map(([s, id]) => (
                  <li key={id}>
                    <label className={cn("flex cursor-pointer gap-3 rounded-xl border border-line bg-raised px-4 py-3 transition hover:border-line-strong", done[id] && "opacity-55")}>
                      <input type="checkbox" checked={!!done[id]} onChange={() => toggle(id)} className="peer sr-only" />
                      <span className={cn("mt-0.5 grid size-[18px] shrink-0 place-items-center rounded-md border transition peer-focus-visible:ring-2 peer-focus-visible:ring-accent", done[id] ? "border-accent bg-accent text-accent-ink" : "border-line-strong")}>
                        {done[id] && <Check className="size-3" strokeWidth={3} />}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="flex flex-wrap items-baseline justify-between gap-x-3">
                          <span className={cn("text-[14px] font-medium", done[id] && "line-through")}>{s.title}</span>
                          <span className="font-mono text-[11px] text-faint">{EFFORT[s.effort]}</span>
                        </span>
                        <span className="mt-1 block text-[13px] leading-relaxed text-muted">{s.detail}</span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
      </div>
    </div>
  );
}

const stepId = (s: RoadmapStep, i: number) => `${s.resolves.join("+") || s.title}-${i}`;
