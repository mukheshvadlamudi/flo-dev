import { Check } from "lucide-react";
import { Suspense } from "react";
import { Breadcrumbs } from "@/components/breadcrumbs";
import { Card } from "@/components/ui";
import { EnquiryForm } from "./enquiry-form";

export const metadata = {
  title: "Book an expert audit",
  description: "An engineer verifies your Flo report and fixes the critical issues in your vibe-coded app at a fixed price. Reply within 24 hours.",
  alternates: { canonical: "/expert-audit" },
};

export default function ExpertAuditPage() {
  return (
    <>
      <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Expert audit" }]} />
      <div className="mx-auto grid max-w-6xl gap-10 px-4 pb-24 sm:px-6 lg:grid-cols-[1fr_1.1fr]">
        <div>
          <h1 className="text-gradient text-4xl font-semibold tracking-tight text-balance sm:text-5xl">Get it fixed by an engineer.</h1>
          <p className="mt-4 text-[17px] leading-relaxed text-muted">Flo tells you what's wrong. If you'd rather not fix it yourself, we verify every finding by hand and ship the fixes as a pull request, at a fixed price agreed upfront.</p>
          <ul className="mt-8 space-y-3 text-[15px]">
            {["Every finding checked by a human, false positives removed", "Critical fixes delivered as a reviewed pull request", "A 30-minute walkthrough of your architecture plan", "Reply within 24 hours, delivery in 48"].map((t) => (
              <li key={t} className="flex gap-3">
                <Check className="mt-0.5 size-5 shrink-0 text-accent" /> {t}
              </li>
            ))}
          </ul>
        </div>
        <Card className="p-6 sm:p-8">
          <Suspense>
            <EnquiryForm />
          </Suspense>
        </Card>
      </div>
    </>
  );
}
