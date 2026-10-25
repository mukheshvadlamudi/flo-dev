import { randomUUID } from "node:crypto";
import { adviseWithClaude, ADVISOR_MODEL } from "./advisor.js";
import { buildRoadmap, planArchitecture } from "./architecture.js";
import { runChecklist } from "./checklist/index.js";
import { classifyProject } from "./classify.js";
import { probeLiveSite } from "./live.js";
import { runRules } from "./rules/index.js";
import { computeScores } from "./scoring.js";
import { detectStack } from "./stack.js";
import { analyzeStructure } from "./structure.js";
import type { AuditReport, Project, ScanEvent, UserProfile } from "./types.js";
import { loadProject } from "./walker.js";

export const DEFAULT_PROFILE: UserProfile = {
  expectedUsers: 1000,
  teamSize: 1,
  monthlyBudgetUsd: 50,
  compliance: [],
  realtime: false,
  handlesPayments: false,
  handlesPII: true,
};

export interface ScanOptions {
  /** Directory on disk, or a pre-loaded project (tests, uploads). */
  dir?: string;
  project?: Project;
  projectName: string;
  sourceLabel: string;
  commit?: string;
  profile?: Partial<UserProfile>;
  liveUrl?: string;
  /** Allow live URLs on private networks (CLI / local development only). */
  allowPrivateLive?: boolean;
  /** Set false to skip the Claude review even when a key is configured. */
  useAi?: boolean;
  apiKey?: string;
  onEvent?: (e: ScanEvent) => void;
}

export async function scanProject(opts: ScanOptions): Promise<AuditReport> {
  const started = Date.now();
  const emit = (stage: ScanEvent["stage"], message: string, progress: number) => opts.onEvent?.({ stage, message, progress });
  const profile: UserProfile = { ...DEFAULT_PROFILE, ...opts.profile };

  emit("read", "Reading files", 0.1);
  const project = opts.project ?? (await loadProject(opts.dir!));
  if (project.files.length === 0) throw new Error("No source files found in this repository.");

  emit("stack", `Detecting stack across ${project.files.length} files`, 0.2);
  const stack = detectStack(project);
  const projectType = classifyProject(project, stack, profile.kindOverride);
  if (stack.payments.length) profile.handlesPayments = true;

  emit("rules", "Hunting for security holes and bugs", 0.35);
  const findings = runRules(project, projectType);
  const structure = analyzeStructure(project);

  let live;
  if (opts.liveUrl) {
    emit("live", `Probing ${opts.liveUrl}`, 0.5);
    live = await probeLiveSite(opts.liveUrl, { allowPrivate: opts.allowPrivateLive });
  }

  emit("checklist", "Running the production-readiness checklist", 0.6);
  const checklist = runChecklist({ project, stack, type: projectType, structure, findings, profile }, live);

  emit("architecture", "Planning the target architecture", 0.7);
  let architecture = planArchitecture(stack, projectType, profile, structure, findings, checklist);
  let roadmap = buildRoadmap(findings, checklist);

  const ai: AuditReport["ai"] = { used: false };
  if (opts.useAi !== false) {
    emit("ai", "Claude is reviewing the architecture for your goals", 0.78);
    const res = await adviseWithClaude({ project, stack, type: projectType, profile, structure, findings, checklist, plan: architecture, roadmap }, opts.apiKey);
    if (res.advice) {
      const a = res.advice;
      architecture = {
        ...architecture,
        summary: a.architectureSummary,
        components: a.components.length ? a.components : architecture.components,
        antiPatterns: a.antiPatterns.length ? a.antiPatterns.map((p) => ({ title: p.title, detail: p.detail, refs: p.files.map((file) => ({ file })) })) : architecture.antiPatterns,
        author: "claude",
      };
      if (a.roadmap.length) roadmap = a.roadmap;
      Object.assign(ai, { used: true, model: ADVISOR_MODEL, verdict: a.verdict });
    } else {
      ai.error = res.error;
    }
  }

  const scores = computeScores(findings, checklist);
  emit("done", "Report ready", 1);
  return {
    id: randomUUID(),
    version: 1,
    createdAt: new Date().toISOString(),
    projectName: opts.projectName,
    source: opts.sourceLabel,
    commit: opts.commit,
    durationMs: Date.now() - started,
    stack,
    projectType,
    findings,
    checklist,
    structure,
    architecture,
    roadmap,
    scores,
    profile,
    live,
    ai,
  };
}
