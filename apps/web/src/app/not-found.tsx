import { ArrowLeft } from "lucide-react";
import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <div className="relative mx-auto flex min-h-[70dvh] max-w-xl flex-col items-center justify-center px-4 text-center">
      <p className="font-mono text-[96px] leading-none font-semibold tracking-tighter text-line-strong sm:text-[140px]">404</p>
      <h1 className="mt-4 text-2xl font-semibold tracking-tight">This page doesn't exist.</h1>
      <p className="mt-2 text-muted">Reports expire if the link is old, or the address may have a typo.</p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <ButtonLink href="/">
          <ArrowLeft className="size-4" /> Back home
        </ButtonLink>
        <ButtonLink href="/#audit" variant="secondary">
          Run a new audit
        </ButtonLink>
        <ButtonLink href="/sample" variant="ghost">
          Sample report
        </ButtonLink>
      </div>
    </div>
  );
}
