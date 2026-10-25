"use client";

import type { AuditReport } from "@flo/engine";
import { ArrowUpRight, Check, Download, Link2, Printer, Sparkles } from "lucide-react";
import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { Architecture } from "./architecture";
import { Checklist } from "./checklist";
import { repoUrlFrom } from "./code-ref";
import { Findings } from "./findings";
import { KIND_LABELS, SEV, SEVERITIES } from "./format";
import { LivePanel } from "./live";
import { Roadmap } from "./roadmap";
import { MiniScore, ScoreRing } from "./score-ring";

function fallbackVerdict(r: AuditReport): string {
  const crit = r.findings.filter((f) => f.severity === "critical");
  const high = r.findings.filter((f) => f.severity === "high");
  const blockers = r.checklist.filter((c) => c.priority === "must" && c.status === "fail");
  if (crit.length) return `Not ready for real users yet. ${crit.length} critical issue${crit.length > 1 ? "s" : ""} could leak data or money — start with "${crit[0]!.title}". After that, ${blockers.length} launch blocker${blockers.length === 1 ? "" : "s"} remain on the checklist.`;
  if (high.length) return `Close, but ${high.length} high-severity issue${high.length > 1 ? "s" : ""} need fixing before launch, beginning with "${high[0]!.title}".`;
  if (blockers.length) return `No serious vulnerabilities found. ${blockers.length} launch blocker${blockers.length === 1 ? "" : "s"} left on the checklist, starting with "${blockers[0]!.title}".`;
  return "In good shape. Work through the first-month items to harden it before you scale.";
}

const SECTIONS = [
  { id: "findings", label: "Findings" },
  { id: "checklist", label: "Checklist" },
  { id: "architecture", label: "Architecture" },
  { id: "roadmap", label: "Roadmap" },
  { id: "live", label: "Live site" },
];

export function ReportView({ report: r, isSample = false }: { report: AuditReport; isSample?: boolean }) {
  const repoUrl = repoUrlFrom(r.source);
  const [copied, setCopied] = useState(false);
  const [active, setActive] = useState("findings");
  const counts = Object.fromEntries(SEVERITIES.map((s) => [s, r.findings.filter((f) => f.severity === s).length]));
  const stack = [...r.stack.frameworks, ...r.stack.database, ...r.stack.auth, ...r.stack.payments, ...r.stack.ai, ...r.stack.hosting].filter((v, i, a) => a.indexOf(v) === i);
  const sections = SECTIONS.filter((s) => s.id !== "live" || r.live);

  useEffect(() => {
    const io = new IntersectionObserver((entries) => entries.forEach((e) => e.isIntersecting && setActive(e.target.id)), { rootMargin: "-30% 0px -60% 0px" });
    sections.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) io.observe(el);
    });
    return () => io.disconnect();
  }, [sections]);

  return (
    <div className="mx-auto max-w-6xl px-4 pb-24 sm:px-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <p className="font-mono text-xs text-faint">
            {r.source}
            {r.commit ? ` @ ${r.commit}` : ""} · {new Date(r.createdAt).toLocaleString()} · {(r.durationMs / 1000).toFixed(1)}s
          </p>
          <h1 className="mt-2 truncate text-3xl font-semibold tracking-tight sm:text-4xl">{r.projectName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-1.5">
            <span className="rounded-full bg-fg px-2.5 py-0.5 text-xs font-medium text-bg" title={r.projectType.signals.join(" · ")}>
              {KIND_LABELS[r.projectType.primary]}
            </span>
            {r.stack.builder && <span className="rounded-full border border-accent/40 bg-accent-soft px-2.5 py-0.5 text-xs text-accent">Built with {r.stack.builder}</span>}
            {stack.map((s) => (
              <span key={s} className="rounded-full border border-line bg-raised px-2.5 py-0.5 text-xs text-muted">
                {s}
              </span>
            ))}
          </div>
        </div>
        <div className="no-print flex shrink-0 flex-wrap gap-2">
          <a href={isSample ? undefined : `/api/scans/${r.id}/markdown`} aria-disabled={isSample} className={cn("inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-[13px] text-muted transition hover:text-fg", isSample && "pointer-events-none opacity-50")}>
            <Download className="size-3.5" /> Markdown
          </a>
          <button onClick={() => window.print()} className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-[13px] text-muted transition hover:text-fg">
            <Printer className="size-3.5" /> PDF
          </button>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(location.href);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line bg-raised px-3.5 text-[13px] text-muted transition hover:text-fg"
          >
            {copied ? <Check className="size-3.5" /> : <Link2 className="size-3.5" />} {copied ? "Copied" : "Share"}
          </button>
        </div>
      </motion.div>

      {/* Overview */}
      <div className="mt-8 grid gap-4 lg:grid-cols-[auto_1fr]">
        <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.05 }} className="flex flex-col items-center justify-center gap-5 rounded-3xl border border-line bg-raised p-6 shadow-card sm:flex-row lg:flex-col">
          <ScoreRing value={r.scores.overall} grade={r.scores.grade} />
          <div className="grid grid-cols-2 gap-x-6 gap-y-4">
            <MiniScore label="Security" value={r.scores.security} />
            <MiniScore label="Readiness" value={r.scores.readiness} />
            <MiniScore label="Structure" value={r.scores.structure} />
            <MiniScore label="Growth" value={r.scores.growth} />
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }} className="flex flex-col rounded-3xl border border-line bg-raised p-6 shadow-card">
          <p className="flex items-center gap-2 text-xs font-medium text-faint uppercase">
            {r.ai.used ? <Sparkles className="size-3.5 text-accent" /> : null}
            {r.ai.used ? "Claude's verdict" : "Verdict"}
          </p>
          <p className="mt-3 text-lg leading-relaxed text-balance sm:text-xl">{r.ai.verdict ?? fallbackVerdict(r)}</p>
          {!r.ai.used && r.ai.error && <p className="mt-2 text-xs text-faint">{r.ai.error}</p>}
          <div className="mt-auto grid grid-cols-3 gap-2 pt-6 sm:grid-cols-5">
            {SEVERITIES.map((s) => (
              <div key={s} className="rounded-xl bg-sunken px-3 py-2.5">
                <p className={cn("font-mono text-2xl font-semibold tabular-nums", counts[s] ? SEV[s].text : "text-faint")}>{counts[s]}</p>
                <p className="text-[11px] text-faint">{SEV[s].label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-3 gap-2 text-center text-[11px] text-faint">
            <p>
              <span className="block font-mono text-sm text-fg">{r.structure.totalFiles}</span>files read
            </p>
            <p>
              <span className="block font-mono text-sm text-fg">{r.checklist.length}</span>checks run
            </p>
            <p>
              <span className="block font-mono text-sm text-fg">{r.roadmap.length}</span>roadmap steps
            </p>
          </div>
        </motion.div>
      </div>

      {/* Section nav */}
      <nav className="no-print sticky top-14 z-30 -mx-4 mt-10 border-b border-line bg-bg/80 px-4 backdrop-blur-xl sm:-mx-6 sm:px-6" aria-label="Report sections">
        <div className="flex gap-1 overflow-x-auto">
          {sections.map((s) => (
            <a key={s.id} href={`#${s.id}`} className={cn("relative px-3 py-3 text-[13px] whitespace-nowrap transition", active === s.id ? "text-fg" : "text-muted hover:text-fg")}>
              {s.label}
              {active === s.id && <motion.span layoutId="section-underline" className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-fg" />}
            </a>
          ))}
        </div>
      </nav>

      <Section id="findings" title="Security & bug findings" sub="Every finding points to the exact file and line, with secrets redacted.">
        <Findings findings={r.findings} repoUrl={repoUrl} commit={r.commit} />
      </Section>
      <Section id="checklist" title="Production checklist" sub={`${r.checklist.length} checks picked for a ${KIND_LABELS[r.projectType.primary].toLowerCase()}. Checks that don't apply to you are skipped.`}>
        <Checklist items={r.checklist} repoUrl={repoUrl} commit={r.commit} />
      </Section>
      <Section id="architecture" title="Recommended architecture" sub={`Sized for ~${r.profile.expectedUsers.toLocaleString()} users, a team of ${r.profile.teamSize} and about $${r.profile.monthlyBudgetUsd}/month.`}>
        <Architecture plan={r.architecture} />
      </Section>
      <Section id="roadmap" title="Your step-by-step roadmap" sub="Tick steps off as you go. Progress is saved in this browser.">
        <Roadmap steps={r.roadmap} reportId={r.id} />
      </Section>
      {r.live && (
        <Section id="live" title="Live site checks" sub="What your deployed site actually returns to browsers and search engines.">
          <LivePanel live={r.live} />
        </Section>
      )}

      <div className="no-print mt-16 flex flex-col items-start justify-between gap-4 rounded-3xl border border-line bg-raised p-6 shadow-card sm:flex-row sm:items-center sm:p-8">
        <div>
          <p className="text-lg font-semibold">Want an engineer to fix this for you?</p>
          <p className="mt-1 text-sm text-muted">Fixed price, starting from the Fix-now list. We reply within 24 hours.</p>
        </div>
        <Link href={`/expert-audit?report=${isSample ? "" : r.id}`} className="inline-flex h-11 items-center gap-2 rounded-full bg-fg px-5 text-sm font-medium text-bg transition hover:shadow-[0_0_0_4px_var(--glow)]">
          Get it fixed <ArrowUpRight className="size-4" />
        </Link>
      </div>
    </div>
  );
}

function Section({ id, title, sub, children }: { id: string; title: string; sub: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32 pt-14">
      <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
      <p className="mt-1 mb-6 text-sm text-muted">{sub}</p>
      {children}
    </section>
  );
}
