import "server-only";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { AuditReport, ScanEvent } from "@flo/engine";

const DATA_DIR = process.env.FLO_DATA_DIR || path.join(process.cwd(), ".flo-data");
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  status: JobStatus;
  label: string;
  events: ScanEvent[];
  error?: string;
  createdAt: number;
  listeners: Set<(e: ScanEvent) => void>;
}

// Survives Next.js hot reloads in development.
const g = globalThis as unknown as { __floJobs?: Map<string, Job> };
export const jobs: Map<string, Job> = (g.__floJobs ??= new Map());

export const isReportId = (id: string) => UUID.test(id);

export async function saveReport(report: AuditReport): Promise<void> {
  const dir = path.join(DATA_DIR, "reports");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${report.id}.json`), JSON.stringify(report));
}

export async function loadReport(id: string): Promise<AuditReport | undefined> {
  if (!isReportId(id)) return undefined;
  try {
    return JSON.parse(await readFile(path.join(DATA_DIR, "reports", `${id}.json`), "utf8")) as AuditReport;
  } catch {
    return undefined;
  }
}

export async function saveEnquiry(data: Record<string, string>): Promise<void> {
  const dir = path.join(DATA_DIR, "enquiries");
  await mkdir(dir, { recursive: true });
  await writeFile(path.join(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.json`), JSON.stringify({ ...data, at: new Date().toISOString() }));
}
