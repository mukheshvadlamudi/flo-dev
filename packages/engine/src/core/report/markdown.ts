import { KIND_LABELS } from "../classify.js";
import type { AuditReport, CheckStatus, Severity } from "../types.js";

const SEV: Record<Severity, string> = { critical: "🔴 Critical", high: "🟠 High", medium: "🟡 Medium", low: "🔵 Low", info: "⚪ Info" };
const STATUS: Record<CheckStatus, string> = { pass: "✅", fail: "❌", warn: "⚠️", unknown: "❔", na: "n/a" };

export function toMarkdown(r: AuditReport): string {
  const out: string[] = [];
  out.push(`# Flo audit: ${r.projectName}`, "");
  out.push(`**Score ${r.scores.overall}/100 (${r.scores.grade})** · Security ${r.scores.security} · Readiness ${r.scores.readiness} · Structure ${r.scores.structure}${r.scores.growth === null ? "" : ` · Growth ${r.scores.growth}`}`, "");
  out.push(`Source: ${r.source}${r.commit ? ` @ ${r.commit}` : ""} · ${KIND_LABELS[r.projectType.primary]} · ${new Date(r.createdAt).toUTCString()}`, "");
  if (r.ai.verdict) out.push(`> ${r.ai.verdict}`, "");
  const stack = [...r.stack.frameworks, ...r.stack.database, ...r.stack.auth, ...r.stack.payments, ...r.stack.hosting];
  out.push(`**Stack:** ${stack.join(" · ") || "unknown"}${r.stack.builder ? ` (built with ${r.stack.builder})` : ""}`, "");

  out.push("## Findings", "");
  if (!r.findings.length) out.push("No issues found by the static rules.", "");
  for (const f of r.findings) {
    out.push(`### ${SEV[f.severity]}: ${f.title}`);
    if (f.file) out.push(`\`${f.file}${f.line ? `:${f.line}` : ""}\``);
    if (f.snippet) out.push("```", f.snippet, "```");
    out.push(`**Why:** ${f.why}`, "", `**Fix:** ${f.fix}`, "");
  }

  out.push("## Production checklist", "", "| | Area | Check | Evidence |", "|---|---|---|---|");
  for (const c of r.checklist) out.push(`| ${STATUS[c.status]} | ${c.area} | ${c.title} | ${c.evidence.replace(/\|/g, "\\|")} |`);
  out.push("");

  out.push(`## Architecture (${r.architecture.tier} tier)`, "", r.architecture.summary, "", "| Layer | Now | Recommended | Why |", "|---|---|---|---|");
  for (const c of r.architecture.components) out.push(`| ${c.layer} | ${c.current} | ${c.recommended} | ${c.why} |`);
  out.push("", "### Suggested structure", "```", r.architecture.folderStructure, "```", "");

  out.push("## Roadmap", "");
  for (const phase of ["Fix now", "Before launch", "First month", "When you grow"] as const) {
    const steps = r.roadmap.filter((s) => s.phase === phase);
    if (!steps.length) continue;
    out.push(`### ${phase}`);
    for (const s of steps) out.push(`- [ ] **${s.title}** (${s.effort}): ${s.detail}`);
    out.push("");
  }
  return out.join("\n");
}
