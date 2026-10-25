import { Breadcrumbs } from "@/components/breadcrumbs";
import { ReportView } from "@/components/report/report-view";
import { getSampleReport } from "@/lib/sample";

export const metadata = {
  title: "Sample report: a Lovable app, audited",
  description: "A real Flo report for a sample Lovable + Supabase + Stripe clinic app: exposed keys, missing RLS, fake-able payments, SEO gaps and a step-by-step plan to fix them.",
  alternates: { canonical: "/sample" },
};

export default async function SamplePage() {
  const report = await getSampleReport();
  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Sample report" }]} />
      <ReportView report={report} isSample />
    </>
  );
}
