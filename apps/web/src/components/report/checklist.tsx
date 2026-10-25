"use client";

import type { ChecklistArea, ChecklistItem } from "@flo/engine";
import { ChevronRight, Globe } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CodeRefList } from "./code-ref";
import { AREA_ICON, AREAS, STATUS } from "./format";
import { Chip } from "./findings";

const PRIORITY = { must: { label: "Launch blocker", cls: "text-critical" }, should: { label: "First weeks", cls: "text-medium" }, later: { label: "At scale", cls: "text-faint" } };

export function Checklist({ items, repoUrl, commit }: { items: ChecklistItem[]; repoUrl?: string; commit?: string }) {
  const areas = useMemo(() => AREAS.filter((a) => items.some((i) => i.area === a)), [items]);
  const [area, setArea] = useState<ChecklistArea | "all">("all");
  const [showPassing, setShowPassing] = useState(false);
  const scoped = items.filter((i) => area === "all" || i.area === area);
  const shown = scoped.filter((i) => showPassing || i.status !== "pass");
  const rank = { fail: 0, warn: 1, unknown: 2, pass: 3, na: 4 } as const;
  const pr = { must: 0, should: 1, later: 2 } as const;
  shown.sort((a, b) => rank[a.status] - rank[b.status] || pr[a.priority] - pr[b.priority]);

  return (
    <div>
      <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1">
        <Chip active={area === "all"} onClick={() => setArea("all")}>
          All areas <span className="text-faint">{items.length}</span>
        </Chip>
        {areas.map((a) => {
          const Icon = AREA_ICON[a];
          const list = items.filter((i) => i.area === a);
          const ok = list.filter((i) => i.status === "pass").length;
          return (
            <Chip key={a} active={area === a} onClick={() => setArea(a)}>
              <Icon className="size-3.5" />
              <span className="whitespace-nowrap">{a}</span>
              <span className="text-faint tabular-nums">
                {ok}/{list.length}
              </span>
            </Chip>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-between text-xs text-faint">
        <span>
          {scoped.filter((i) => i.status === "pass").length} passing · {scoped.filter((i) => i.status === "fail").length} missing · {scoped.filter((i) => i.status === "warn").length} partial · {scoped.filter((i) => i.status === "unknown").length} to verify
        </span>
        <label className="inline-flex cursor-pointer items-center gap-2">
          <input type="checkbox" checked={showPassing} onChange={(e) => setShowPassing(e.target.checked)} className="accent-[var(--accent)]" />
          Show passing
        </label>
      </div>
      <motion.ul layout className="mt-3 divide-y divide-line overflow-hidden rounded-xl border border-line bg-raised">
        {shown.map((i) => (
          <Row key={i.id} item={i} repoUrl={repoUrl} commit={commit} />
        ))}
        {!shown.length && <li className="px-4 py-10 text-center text-sm text-muted">Everything in this area passes. Nice.</li>}
      </motion.ul>
    </div>
  );
}

function Row({ item, repoUrl, commit }: { item: ChecklistItem; repoUrl?: string; commit?: string }) {
  const [open, setOpen] = useState(false);
  const s = STATUS[item.status];
  return (
    <motion.li layout>
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="grid w-full grid-cols-[auto_1fr_auto] items-start gap-3 px-4 py-3 text-left transition hover:bg-sunken/60">
        <span className={cn("mt-0.5 w-[62px] rounded-md py-0.5 text-center text-[11px] font-medium", s.bg, s.text)}>{s.label}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-x-2 text-[14px] font-medium">
            {item.title}
            {item.source !== "code" && (
              <span className="inline-flex items-center gap-1 rounded bg-sunken px-1.5 text-[10px] font-normal text-muted">
                <Globe className="size-2.5" /> live
              </span>
            )}
          </span>
          <span className="mt-0.5 block text-[13px] text-muted">{item.evidence}</span>
        </span>
        <span className="flex items-center gap-2">
          {item.status !== "pass" && <span className={cn("hidden text-[11px] sm:inline", PRIORITY[item.priority].cls)}>{PRIORITY[item.priority].label}</span>}
          <ChevronRight className={cn("size-4 text-faint transition-transform", open && "rotate-90")} />
        </span>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="overflow-hidden">
            <div className="grid gap-4 px-4 pb-4 text-sm leading-relaxed sm:pl-[94px] md:grid-cols-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-faint uppercase">Why it matters for you</p>
                <p className="mt-1.5 text-muted">{item.relevance}</p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-faint uppercase">{item.status === "pass" ? "Keep it that way" : "How to do it"}</p>
                <p className="mt-1.5">{item.howTo}</p>
              </div>
              {item.refs.length > 0 && (
                <div className="md:col-span-2">
                  <CodeRefList refs={item.refs} repoUrl={repoUrl} commit={commit} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}
