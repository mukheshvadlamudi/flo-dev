"use client";

import { ArrowRight, Loader2 } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useState } from "react";
import { Turnstile } from "@/components/turnstile";
import { cn } from "@/lib/utils";

const PLANS = [
  { id: "audit", label: "Expert audit · $199" },
  { id: "sprint", label: "Production sprint · $750" },
  { id: "retainer", label: "Monitoring retainer" },
] as const;

export function EnquiryForm() {
  const params = useSearchParams();
  const router = useRouter();
  const [plan, setPlan] = useState<string>(PLANS.some((p) => p.id === params.get("plan")) ? params.get("plan")! : "audit");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [human, setHuman] = useState("");
  const onHuman = useCallback((t: string) => setHuman(t), []);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/enquiry", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: form.get("name"), email: form.get("email"), repo: form.get("repo"), message: form.get("message"), plan, reportId: params.get("report") ?? "", human: human || undefined }),
    });
    if (res.ok) {
      router.push(`/thank-you?plan=${plan}`);
      return;
    }
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    setError(data.error ?? "Something went wrong. Please email us instead.");
    setBusy(false);
  }

  const input = "h-11 w-full rounded-xl border border-line bg-sunken px-3.5 text-sm outline-none placeholder:text-faint focus:border-line-strong";
  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3" role="radiogroup" aria-label="Plan">
        {PLANS.map((p) => (
          <button type="button" role="radio" aria-checked={plan === p.id} key={p.id} onClick={() => setPlan(p.id)} className={cn("rounded-xl border px-3 py-2.5 text-left text-[13px] transition", plan === p.id ? "border-fg bg-fg text-bg" : "border-line bg-raised text-muted hover:text-fg")}>
            {p.label}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Name</span>
          <input name="name" required maxLength={120} autoComplete="name" className={input} />
        </label>
        <label className="block">
          <span className="mb-1.5 block text-xs font-medium">Email</span>
          <input name="email" type="email" required maxLength={200} autoComplete="email" className={input} />
        </label>
      </div>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">Repository or app URL</span>
        <input name="repo" maxLength={300} placeholder="github.com/you/app" className={cn(input, "font-mono")} />
      </label>
      <label className="block">
        <span className="mb-1.5 block text-xs font-medium">What do you need?</span>
        <textarea name="message" rows={4} maxLength={2000} placeholder="Launch date, what's broken, anything we should know." className={cn(input, "h-auto py-3")} />
      </label>
      <Turnstile onToken={onHuman} />
      {error && (
        <p role="alert" className="text-sm text-critical">
          {error}
        </p>
      )}
      <button disabled={busy} className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-full bg-fg text-sm font-medium text-bg transition hover:shadow-[0_0_0_4px_var(--glow)] disabled:opacity-60">
        {busy && <Loader2 className="size-4 animate-spin" />} Send enquiry <ArrowRight className="size-4" />
      </button>
      <p className="text-center text-xs text-faint">
        We reply within 24 hours. By sending this you agree to our{" "}
        <a href="/privacy" className="underline underline-offset-2">
          privacy policy
        </a>
        .
      </p>
    </form>
  );
}
