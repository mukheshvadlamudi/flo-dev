import { CheckCircle2 } from "lucide-react";
import { ButtonLink } from "@/components/ui";
import { SITE } from "@/lib/site";

export const metadata = { title: "Thanks — we'll be in touch", robots: { index: false } };

export default function ThankYou() {
  return (
    <div className="mx-auto flex min-h-[70dvh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <CheckCircle2 className="size-10 text-accent" />
      <h1 className="mt-5 text-3xl font-semibold tracking-tight">Got it. We'll reply {SITE.responseTime}.</h1>
      <p className="mt-3 text-muted">
        Watch your inbox for an email from {SITE.email}. While you wait, run a free scan so we can start from your report.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/#audit">Run a free scan</ButtonLink>
        <ButtonLink href="/sample" variant="secondary">
          See a sample report
        </ButtonLink>
      </div>
    </div>
  );
}
