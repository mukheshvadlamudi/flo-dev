"use client";

import type { ArchitecturePlan } from "@flo/engine";
import { Check, Copy, Sparkles, TriangleAlert } from "lucide-react";
import { motion } from "motion/react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import { CodeRefList } from "./code-ref";
import { CHANGE } from "./format";

const TIER = { prototype: "Prototype · < 500 users", launch: "Launch · < 10k users", growth: "Growth · 10k–100k users", scale: "Scale · 100k+ users" };
const CORE = ["Hosting + CDN", "Frontend", "API / server logic", "Auth", "Database"];

export function Architecture({ plan }: { plan: ArchitecturePlan }) {
  const [copied, setCopied] = useState(false);
  const core = CORE.map((l) => plan.components.find((c) => c.layer === l)).filter((c) => !!c);
  const side = plan.components.filter((c) => !CORE.includes(c.layer));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-2">
        <span className="rounded-full border border-line bg-raised px-3 py-1 font-mono text-xs">{TIER[plan.tier]}</span>
        <span className={cn("inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs", plan.author === "claude" ? "bg-accent-soft text-accent" : "bg-sunken text-muted")}>
          {plan.author === "claude" && <Sparkles className="size-3" />}
          {plan.author === "claude" ? "Tailored by Claude" : "Rule-based plan"}
        </span>
      </div>
      <p className="max-w-3xl text-[15px] leading-relaxed text-muted">{plan.summary}</p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div className="rounded-2xl border border-line bg-sunken p-5">
          <p className="text-xs font-medium tracking-wide text-faint uppercase">Request path</p>
          <div className="mt-4 flex flex-col items-stretch">
            <Node layer="Visitors" text="Browser / mobile" change="keep" muted />
            {core.map((c, i) => (
              <motion.div key={c.layer} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.06 }}>
                <Connector />
                <Node layer={c.layer} text={c.recommended} current={c.current} change={c.change} />
              </motion.div>
            ))}
          </div>
        </div>
        <div className="rounded-2xl border border-line bg-sunken p-5">
          <p className="text-xs font-medium tracking-wide text-faint uppercase">Supporting services</p>
          <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
            {side.map((c, i) => (
              <motion.div key={c.layer} initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.04 }}>
                <Node layer={c.layer} text={c.recommended} current={c.current} change={c.change} />
              </motion.div>
            ))}
          </div>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-line">
        <table className="w-full text-left text-sm">
          <thead className="bg-sunken text-xs text-faint">
            <tr>
              <th className="px-4 py-2.5 font-medium">Layer</th>
              <th className="hidden px-4 py-2.5 font-medium md:table-cell">You have</th>
              <th className="px-4 py-2.5 font-medium">Recommended</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line bg-raised">
            {plan.components.map((c) => (
              <tr key={c.layer} className="align-top">
                <td className="px-4 py-3">
                  <p className="font-medium whitespace-nowrap">{c.layer}</p>
                  <span className={cn("mt-1 inline-block rounded px-1.5 text-[10.5px] font-medium", CHANGE[c.change]?.cls)}>{CHANGE[c.change]?.label}</span>
                </td>
                <td className="hidden px-4 py-3 text-muted md:table-cell">{c.current}</td>
                <td className="px-4 py-3">
                  <p>{c.recommended}</p>
                  <p className="mt-1 text-[13px] text-faint">{c.why}</p>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {plan.antiPatterns.length > 0 && (
        <div>
          <p className="text-sm font-medium">Patch-work patterns to unwind</p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            {plan.antiPatterns.map((a) => (
              <div key={a.title} className="rounded-xl border border-high/20 bg-high/5 p-4">
                <p className="flex items-center gap-2 text-sm font-medium">
                  <TriangleAlert className="size-4 text-high" />
                  {a.title}
                </p>
                <p className="mt-1.5 text-[13px] leading-relaxed text-muted">{a.detail}</p>
                <CodeRefList refs={a.refs.slice(0, 3)} />
              </div>
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Target folder structure</p>
          <button
            onClick={() => {
              void navigator.clipboard.writeText(plan.folderStructure);
              setCopied(true);
              setTimeout(() => setCopied(false), 1500);
            }}
            className="inline-flex items-center gap-1 text-xs text-muted hover:text-fg"
          >
            {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
            {copied ? "Copied" : "Copy"}
          </button>
        </div>
        <pre className="mt-3 overflow-x-auto rounded-xl border border-line bg-sunken p-4 font-mono text-[12.5px] leading-relaxed text-muted">{plan.folderStructure}</pre>
      </div>
    </div>
  );
}

function Node({ layer, text, current, change, muted }: { layer: string; text: string; current?: string; change: string; muted?: boolean }) {
  const ch = CHANGE[change];
  return (
    <div className={cn("rounded-xl border bg-raised px-3.5 py-2.5", change === "add" ? "border-accent/40" : change === "replace" ? "border-high/40" : "border-line", muted && "opacity-70")}>
      <div className="flex items-center justify-between gap-2">
        <p className="text-[13px] font-medium">{layer}</p>
        {!muted && ch && <span className={cn("rounded px-1.5 text-[10px] font-medium", ch.cls)}>{ch.label}</span>}
      </div>
      <p className="mt-0.5 line-clamp-2 text-xs text-muted" title={text}>
        {text}
      </p>
      {current && change !== "keep" && <p className="mt-1 truncate font-mono text-[10.5px] text-faint">now: {current}</p>}
    </div>
  );
}

function Connector() {
  return (
    <div className="flex justify-center py-0.5" aria-hidden>
      <div className="relative h-5 w-px bg-line-strong">
        <motion.span className="absolute -left-[2px] size-[5px] rounded-full bg-accent" animate={{ top: ["-10%", "100%"] }} transition={{ duration: 1.6, repeat: Infinity, ease: "easeInOut" }} />
      </div>
    </div>
  );
}
