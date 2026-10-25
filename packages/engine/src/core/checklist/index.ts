import type { ChecklistItem, LiveProbe } from "../types.js";
import type { CheckContext, CheckDef, Verdict } from "./context.js";
import { PERFORMANCE_CHECKS } from "./performance.js";
import { PRODUCTION_CHECKS } from "./production.js";
import { WEB_CHECKS } from "./web.js";

export type { CheckContext } from "./context.js";

export const CHECKS: CheckDef[] = [...PRODUCTION_CHECKS, ...PERFORMANCE_CHECKS, ...WEB_CHECKS];

const resolve = <T>(v: T | ((ctx: CheckContext) => T), ctx: CheckContext): T =>
  typeof v === "function" ? (v as (ctx: CheckContext) => T)(ctx) : v;

/** Returns true when the item is relevant to this project at all. */
function applies(def: CheckDef, ctx: CheckContext): boolean {
  if (def.appliesTo && !def.appliesTo.some((k) => ctx.type.kinds.includes(k))) return false;
  return def.when ? def.when(ctx) : true;
}

export function runChecklist(ctx: CheckContext, live?: LiveProbe): ChecklistItem[] {
  const items: ChecklistItem[] = [];
  for (const def of CHECKS) {
    if (!applies(def, ctx)) continue;
    let verdict: Verdict;
    let source: ChecklistItem["source"] = "code";
    try {
      verdict = def.evaluate(ctx);
      if (live?.ok && def.live) {
        const refined = def.live(live, verdict, ctx);
        if (refined) {
          source = refined === verdict ? "code" : verdict.status === "unknown" ? "live" : "code+live";
          verdict = refined;
        }
      }
    } catch (err) {
      console.error(`[flo] check ${def.id} failed:`, err);
      continue;
    }
    if (verdict.status === "na") continue;
    items.push({
      id: def.id,
      area: def.area,
      title: def.title,
      status: verdict.status,
      evidence: verdict.evidence,
      refs: verdict.refs ?? [],
      howTo: resolve(def.howTo, ctx),
      priority: resolve(def.priority, ctx),
      relevance: resolve(def.relevance, ctx),
      source,
    });
  }
  return items;
}
