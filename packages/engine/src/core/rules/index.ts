import type { Finding, Project, ProjectType, Rule, Severity } from "../types.js";
import * as bugs from "./bugs.js";
import * as database from "./database.js";
import * as secrets from "./secrets.js";
import * as web from "./web.js";

export const RULES: Rule[] = [
  ...Object.values(secrets),
  ...Object.values(database),
  ...Object.values(web),
  ...Object.values(bugs),
];

/** Hard cap per rule so one noisy pattern can't bury the rest of the report. */
const MAX_HITS_PER_RULE = 12;

const SEVERITY_ORDER: Record<Severity, number> = { critical: 0, high: 1, medium: 2, low: 3, info: 4 };

export function runRules(project: Project, type: ProjectType, rules: Rule[] = RULES): Finding[] {
  const findings: Finding[] = [];
  for (const rule of rules) {
    if (rule.appliesTo && !rule.appliesTo.some((k) => type.kinds.includes(k))) continue;
    let hits;
    try {
      hits = rule.check(project);
    } catch (err) {
      // A rule bug must never take down the whole scan.
      console.error(`[flo] rule ${rule.id} failed:`, err);
      continue;
    }
    const seen = new Set<string>();
    for (const hit of hits) {
      const key = `${hit.file}:${hit.line}`;
      if (seen.has(key)) continue;
      seen.add(key);
      if (seen.size > MAX_HITS_PER_RULE) break;
      findings.push({
        ruleId: rule.id,
        title: hit.title ?? rule.title,
        severity: hit.severity ?? rule.severity,
        category: rule.category,
        file: hit.file,
        line: hit.line,
        snippet: hit.snippet,
        why: rule.why,
        fix: rule.fix,
        references: rule.references,
      });
    }
  }
  return findings.sort(
    (a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity] || (a.file ?? "").localeCompare(b.file ?? "") || (a.line ?? 0) - (b.line ?? 0),
  );
}
