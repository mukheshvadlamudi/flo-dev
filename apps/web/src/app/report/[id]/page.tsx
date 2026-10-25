import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReportView } from "@/components/report/report-view";
import { ScanProgress } from "@/components/report/scan-progress";
import { isReportId, jobs, loadReport } from "@/lib/store";

export const dynamic = "force-dynamic";

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const report = await loadReport(id);
  return {
    title: report ? `${report.projectName} audit · ${report.scores.overall}/100` : "Audit in progress",
    description: report ? `Production-readiness audit of ${report.projectName}: ${report.findings.length} findings, ${report.checklist.length} checks.` : "Flo is auditing this app.",
    robots: { index: false, follow: false },
  };
}

export default async function ReportPage({ params }: Props) {
  const { id } = await params;
  if (!isReportId(id)) notFound();
  const report = await loadReport(id);
  const job = jobs.get(id);
  if (!report && !job) notFound();
  const name = report?.projectName ?? job?.label ?? "Audit";
  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Reports" }, { label: name }]} />
      {report ? <ReportView report={report} /> : <ScanProgress id={id} label={job!.label} />}
    </>
  );
}
