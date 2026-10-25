import "server-only";
import { projectFromFiles, SAMPLE_ASSETS, sampleClinicFiles, scanProject, type AuditReport } from "@flo/engine";
import { cache } from "react";

/** The real engine output for the bundled sample app. No AI call, so it's fast and free. */
export const getSampleReport = cache(async (): Promise<AuditReport> => {
  const report = await scanProject({
    project: projectFromFiles("smile-dental", sampleClinicFiles(), SAMPLE_ASSETS),
    projectName: "smile-dental",
    sourceLabel: "Sample · Lovable dental clinic app",
    useAi: false,
    profile: { expectedUsers: 2000, teamSize: 1, monthlyBudgetUsd: 50 },
  });
  return { ...report, id: "00000000-0000-4000-8000-000000000000" };
});
