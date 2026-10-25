import "server-only";
import { randomUUID } from "node:crypto";
import { cloneGitHub, projectFromFiles, SAMPLE_ASSETS, sampleClinicFiles, scanProject, type ScanEvent, type UserProfile } from "@flo/engine";
import { type Job, jobs, saveReport } from "./store";

const MAX_CONCURRENT = 3;

export interface ScanRequest {
  repo?: string;
  token?: string;
  liveUrl?: string;
  sample?: boolean;
  profile: Partial<UserProfile>;
}

export function runningCount(): number {
  return [...jobs.values()].filter((j) => j.status === "running" || j.status === "queued").length;
}

export function canStart(): boolean {
  return runningCount() < MAX_CONCURRENT;
}

function emit(job: Job, e: ScanEvent) {
  job.events.push(e);
  for (const l of job.listeners) l(e);
}

/** Starts a scan in the background and returns its id immediately. The id doubles as the report id. */
export function startScan(req: ScanRequest): string {
  const id = randomUUID();
  const job: Job = { id, status: "queued", label: req.sample ? "Sample: Smile Dental (Lovable)" : req.repo ?? "", events: [], createdAt: Date.now(), listeners: new Set() };
  jobs.set(id, job);
  void run(job, req);
  // Forget finished jobs after an hour; the saved report stays on disk.
  setTimeout(() => jobs.delete(id), 60 * 60 * 1000).unref?.();
  return id;
}

async function run(job: Job, req: ScanRequest) {
  job.status = "running";
  let cleanup = async () => {};
  try {
    let scanInput;
    if (req.sample) {
      emit(job, { stage: "source", message: "Loading the sample Lovable app", progress: 0.05 });
      scanInput = { project: projectFromFiles("smile-dental", sampleClinicFiles(), SAMPLE_ASSETS), projectName: "smile-dental", sourceLabel: "Sample · Lovable dental clinic app" };
    } else {
      emit(job, { stage: "source", message: `Cloning ${req.repo}`, progress: 0.04 });
      const src = await cloneGitHub(req.repo!, req.token);
      cleanup = src.cleanup;
      scanInput = { dir: src.dir, projectName: src.name, sourceLabel: src.label, commit: src.commit };
    }
    const report = await scanProject({
      ...scanInput,
      profile: req.profile,
      liveUrl: req.liveUrl || undefined,
      onEvent: (e) => emit(job, e.stage === "done" ? { ...e, stage: "architecture", message: "Writing your report", progress: 0.97 } : e),
    });
    report.id = job.id;
    await saveReport(report);
    job.status = "done";
    emit(job, { stage: "done", message: "Report ready", progress: 1 });
  } catch (err) {
    job.status = "error";
    job.error = err instanceof Error ? err.message : "The scan failed.";
    emit(job, { stage: "error", message: job.error, progress: 1 });
  } finally {
    await cleanup().catch(() => {});
  }
}
