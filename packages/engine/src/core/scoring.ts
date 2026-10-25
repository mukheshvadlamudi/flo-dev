import type { ChecklistArea, ChecklistItem, Finding, Scores, Severity } from "./types.js";

const PENALTY: Record<Severity, number> = { critical: 25, high: 12, medium: 5, low: 2, info: 0 };
const WEIGHT = { must: 3, should: 2, later: 1 } as const;
const CREDIT = { pass: 1, warn: 0.5, unknown: 0.5, fail: 0, na: 1 } as const;

function areaScore(items: ChecklistItem[], areas: ChecklistArea[]): number | null {
  const scoped = items.filter((i) => areas.includes(i.area));
  if (!scoped.length) return null;
  let got = 0;
  let max = 0;
  for (const i of scoped) {
    max += WEIGHT[i.priority];
    got += WEIGHT[i.priority] * CREDIT[i.status];
  }
  return Math.round((got / max) * 100);
}

function penaltyScore(findings: Finding[], categories: Finding["category"][]): number {
  // Repeated hits of one rule count less than distinct problems.
  const byRule = new Map<string, Finding[]>();
  for (const f of findings.filter((x) => categories.includes(x.category))) byRule.set(f.ruleId, [...(byRule.get(f.ruleId) ?? []), f]);
  let penalty = 0;
  for (const hits of byRule.values()) {
    const worst = hits.reduce((a, b) => (PENALTY[b.severity] > PENALTY[a.severity] ? b : a));
    penalty += PENALTY[worst.severity] + Math.min(hits.length - 1, 4) * PENALTY[worst.severity] * 0.2;
  }
  return Math.max(0, Math.round(100 - penalty));
}

export function computeScores(findings: Finding[], checklist: ChecklistItem[]): Scores {
  const securityFindings = penaltyScore(findings, ["security"]);
  const securityChecks = areaScore(checklist, ["Security"]);
  const security = securityChecks === null ? securityFindings : Math.round(securityFindings * 0.7 + securityChecks * 0.3);
  const readiness = areaScore(checklist, ["Data & database", "Reliability", "Observability", "Delivery", "Performance"]) ?? 50;
  const growth = areaScore(checklist, ["SEO & discoverability", "Conversion & trust", "Compliance & analytics"]);
  const structureChecks = areaScore(checklist, ["Code structure"]) ?? 70;
  const structure = Math.round(structureChecks * 0.6 + penaltyScore(findings, ["bug", "maintainability", "reliability", "performance"]) * 0.4);

  const parts: [number, number][] = [
    [security, 0.4],
    [readiness, 0.3],
    [structure, 0.15],
    ...(growth === null ? [] : ([[growth, 0.15]] as [number, number][])),
  ];
  const totalWeight = parts.reduce((n, [, w]) => n + w, 0);
  let overall = Math.round(parts.reduce((n, [s, w]) => n + s * w, 0) / totalWeight);
  // An app with a critical hole is not production-ready, whatever else it does well.
  if (findings.some((f) => f.severity === "critical")) overall = Math.min(overall, 49);
  else if (findings.some((f) => f.severity === "high" && f.category === "security")) overall = Math.min(overall, 69);

  const grade = overall >= 90 ? "A" : overall >= 80 ? "B" : overall >= 65 ? "C" : overall >= 50 ? "D" : "F";
  return { overall, security, readiness, growth, structure, grade };
}
