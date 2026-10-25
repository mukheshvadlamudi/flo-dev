"use client";

import type { Finding, Severity } from "@flo/engine";
import { ChevronRight, ExternalLink, ShieldAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { CodeRefList } from "./code-ref";
import { SEV, SEVERITIES } from "./format";

const CATS: Record<Finding["category"], string> = { security: "Security", bug: "Bugs", performance: "Performance", reliability: "Reliability", maintainability: "Maintainability" };

export function Findings({ findings, repoUrl, commit }: { findings: Finding[]; repoUrl?: string; commit?: string }) {
  const [sev, setSev] = useState<Severity | "all">("all");
  const [cat, setCat] = useState<Finding["category"] | "all">("all");
  const counts = useMemo(() => Object.fromEntries(SEVERITIES.map((s) => [s, findings.filter((f) => f.severity === s).length])) as Record<Severity, number>, [findings]);
  const cats = useMemo(() => [...new Set(findings.map((f) => f.category))], [findings]);
  const shown = findings.filter((f) => (sev === "all" || f.severity === sev) && (cat === "all" || f.category === cat));

  if (!findings.length) {
    return (
      <div className="grid place-items-center rounded-2xl border border-dashed border-line py-14 text-center">
        <ShieldAlert className="size-6 text-pass" />
        <p className="mt-3 font-medium">No issues found by the rules</p>
        <p className="mt-1 text-sm text-muted">Still review the checklist below: some risks only show up as missing safeguards.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex flex-wrap gap-2">
        <Chip active={sev === "all"} onClick={() => setSev("all")}>
          All <span className="text-faint">{findings.length}</span>
        </Chip>
        {SEVERITIES.filter((s) => counts[s]).map((s) => (
          <Chip key={s} active={sev === s} onClick={() => setSev(s)}>
            <span className={cn("size-1.5 rounded-full", SEV[s].dot)} />
            {SEV[s].label} <span className="text-faint">{counts[s]}</span>
          </Chip>
        ))}
        {cats.length > 1 && <span className="mx-1 hidden w-px bg-line sm:block" />}
        {cats.length > 1 &&
          cats.map((c) => (
            <Chip key={c} active={cat === c} onClick={() => setCat(cat === c ? "all" : c)}>
              {CATS[c]}
            </Chip>
          ))}
      </div>
      <motion.ul layout className="mt-4 space-y-2">
        <AnimatePresence initial={false}>
          {shown.map((f, i) => (
            <FindingCard key={`${f.ruleId}:${f.file}:${f.line}:${i}`} f={f} repoUrl={repoUrl} commit={commit} />
          ))}
        </AnimatePresence>
      </motion.ul>
    </div>
  );
}

function FindingCard({ f, repoUrl, commit }: { f: Finding; repoUrl?: string; commit?: string }) {
  const [open, setOpen] = useState(false);
  const s = SEV[f.severity];
  return (
    <motion.li layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="overflow-hidden rounded-xl border border-line bg-raised">
      <button onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex w-full items-start gap-3 px-4 py-3.5 text-left transition hover:bg-sunken/60">
        <span className={cn("mt-0.5 inline-flex shrink-0 items-center gap-1.5 rounded-md border px-1.5 py-0.5 text-[11px] font-medium", s.bg, s.text)}>
          <span className={cn("size-1.5 rounded-full", s.dot)} />
          {s.label}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14.5px] leading-snug font-medium">{f.title}</span>
          {f.file && (
            <span className="mt-1 block truncate font-mono text-xs text-faint">
              {f.file}
              {f.line ? `:${f.line}` : ""}
            </span>
          )}
        </span>
        <ChevronRight className={cn("mt-1 size-4 shrink-0 text-faint transition-transform", open && "rotate-90")} />
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.4 }} className="overflow-hidden">
            <div className="grid gap-4 border-t border-line px-4 py-4 text-sm leading-relaxed md:grid-cols-2">
              <div>
                <p className="text-xs font-medium tracking-wide text-faint uppercase">Why it matters</p>
                <p className="mt-1.5 text-muted">{f.why}</p>
              </div>
              <div>
                <p className="text-xs font-medium tracking-wide text-faint uppercase">How to fix</p>
                <p className="mt-1.5 text-fg">{f.fix}</p>
                {f.references?.map((r) => (
                  <a key={r} href={r} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted hover:text-fg">
                    Docs <ExternalLink className="size-3" />
                  </a>
                ))}
              </div>
              {f.file && (
                <div className="md:col-span-2">
                  <CodeRefList refs={[{ file: f.file, line: f.line, snippet: f.snippet }]} repoUrl={repoUrl} commit={commit} />
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.li>
  );
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button onClick={onClick} aria-pressed={active} className={cn("inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] transition", active ? "border-fg/20 bg-fg text-bg [&_.text-faint]:text-bg/60" : "border-line bg-raised text-muted hover:text-fg")}>
      {children}
    </button>
  );
}
