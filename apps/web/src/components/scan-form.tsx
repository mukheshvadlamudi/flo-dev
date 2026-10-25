"use client";

import { ArrowRight, ChevronDown, Globe, KeyRound, Loader2, Sparkles } from "lucide-react";
import { GithubIcon } from "./github-icon";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { cn } from "@/lib/utils";

const KINDS = [
  ["", "Detect automatically"],
  ["saas-app", "SaaS / web app"],
  ["local-business", "Local business site"],
  ["marketing-site", "Marketing / landing site"],
  ["ecommerce", "Online store"],
  ["api", "API / backend"],
  ["mobile-app", "Mobile app"],
] as const;

const USERS = [100, 1_000, 10_000, 50_000, 250_000, 1_000_000];
const fmt = (n: number) => (n >= 1_000_000 ? `${n / 1_000_000}M` : n >= 1000 ? `${n / 1000}k` : String(n));

export function ScanForm({ compact = false }: { compact?: boolean }) {
  const router = useRouter();
  const [repo, setRepo] = useState("");
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [liveUrl, setLiveUrl] = useState("");
  const [kind, setKind] = useState("");
  const [usersIdx, setUsersIdx] = useState(1);
  const [team, setTeam] = useState(1);
  const [budget, setBudget] = useState(50);
  const [about, setAbout] = useState("");
  const [payments, setPayments] = useState(false);
  const [gdpr, setGdpr] = useState(false);
  const [busy, setBusy] = useState<"repo" | "sample" | null>(null);
  const [error, setError] = useState("");

  async function submit(sample: boolean) {
    setError("");
    if (!sample && !repo.trim()) {
      setError("Paste a GitHub repository URL to start.");
      return;
    }
    setBusy(sample ? "sample" : "repo");
    try {
      const res = await fetch("/api/scans", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          sample,
          repo: sample ? undefined : repo.trim(),
          token: token.trim() || undefined,
          liveUrl: liveUrl.trim() || undefined,
          profile: {
            expectedUsers: USERS[usersIdx],
            teamSize: team,
            monthlyBudgetUsd: budget,
            productDescription: about.trim() || undefined,
            kindOverride: kind || undefined,
            handlesPayments: payments || undefined,
            compliance: gdpr ? ["GDPR"] : [],
          },
        }),
      });
      const data = (await res.json()) as { id?: string; error?: string };
      if (!res.ok || !data.id) throw new Error(data.error ?? "Something went wrong.");
      router.push(`/report/${data.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setBusy(null);
    }
  }

  return (
    <form
      id="audit"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(false);
      }}
      className={cn("w-full scroll-mt-28", compact ? "max-w-xl" : "max-w-2xl")}
    >
      <div className="beam rounded-[22px] bg-raised p-1.5 shadow-card">
        <div className="flex flex-col gap-1.5 sm:flex-row sm:items-center">
          <label className="flex min-w-0 flex-1 items-center gap-3 rounded-2xl px-3.5 py-2.5">
            <GithubIcon className="size-5 shrink-0 text-faint" />
            <span className="sr-only">GitHub repository URL</span>
            <input
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="github.com/you/your-app"
              autoComplete="off"
              spellCheck={false}
              className="w-full min-w-0 bg-transparent font-mono text-[15px] text-fg outline-none placeholder:text-faint"
            />
          </label>
          <button
            type="submit"
            disabled={busy !== null}
            className="group inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-2xl bg-fg px-5 text-[15px] font-medium text-bg transition hover:shadow-[0_0_0_4px_var(--glow)] active:scale-[0.98] disabled:opacity-60"
          >
            {busy === "repo" ? <Loader2 className="size-4 animate-spin" /> : null}
            Audit my app
            <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
          </button>
        </div>

        <AnimatePresence initial={false}>
          {open && (
            <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ type: "spring", bounce: 0, duration: 0.45 }} className="overflow-hidden">
              <div className="grid gap-4 border-t border-line px-3.5 pt-4 pb-3 sm:grid-cols-2">
                <Field label="Live site URL" hint="We'll test the deployed site too: real 404s, headers, meta tags.">
                  <IconInput icon={<Globe className="size-4" />} value={liveUrl} onChange={setLiveUrl} placeholder="https://yourapp.com" />
                </Field>
                <Field label="GitHub token (private repos)" hint="Read-only token. Used once to clone, never stored.">
                  <IconInput icon={<KeyRound className="size-4" />} value={token} onChange={setToken} placeholder="github_pat_…" type="password" />
                </Field>
                <Field label="What are you building?">
                  <select value={kind} onChange={(e) => setKind(e.target.value)} className="h-10 w-full rounded-xl border border-line bg-sunken px-3 text-sm text-fg outline-none focus:border-line-strong">
                    {KINDS.map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={`Expected users in 12 months: ${fmt(USERS[usersIdx]!)}`} hint="We size the architecture to this — no over-engineering.">
                  <input type="range" min={0} max={USERS.length - 1} value={usersIdx} onChange={(e) => setUsersIdx(Number(e.target.value))} className="h-10 w-full accent-[var(--accent)]" />
                </Field>
                <Field label="Team size">
                  <input type="number" min={1} max={500} value={team} onChange={(e) => setTeam(Math.max(1, Number(e.target.value) || 1))} className="h-10 w-full rounded-xl border border-line bg-sunken px-3 text-sm outline-none focus:border-line-strong" />
                </Field>
                <Field label="Monthly infra budget (USD)">
                  <input type="number" min={0} step={10} value={budget} onChange={(e) => setBudget(Math.max(0, Number(e.target.value) || 0))} className="h-10 w-full rounded-xl border border-line bg-sunken px-3 text-sm outline-none focus:border-line-strong" />
                </Field>
                <Field label="One line about the product" className="sm:col-span-2">
                  <input value={about} onChange={(e) => setAbout(e.target.value)} maxLength={200} placeholder="e.g. Booking app for physiotherapy clinics in Pune" className="h-10 w-full rounded-xl border border-line bg-sunken px-3 text-sm outline-none placeholder:text-faint focus:border-line-strong" />
                </Field>
                <div className="flex flex-wrap gap-4 sm:col-span-2">
                  <Toggle checked={payments} onChange={setPayments} label="Takes payments" />
                  <Toggle checked={gdpr} onChange={setGdpr} label="Has EU/UK users (GDPR)" />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-2 px-1 text-[13px]">
        <button type="button" onClick={() => setOpen((o) => !o)} className="inline-flex items-center gap-1 text-muted transition hover:text-fg" aria-expanded={open}>
          <ChevronDown className={cn("size-4 transition-transform", open && "rotate-180")} />
          {open ? "Hide options" : "Live URL, private repo & your goals"}
        </button>
        <button type="button" onClick={() => void submit(true)} disabled={busy !== null} className="inline-flex items-center gap-1.5 text-muted transition hover:text-fg disabled:opacity-60">
          {busy === "sample" ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5 text-accent" />}
          No repo handy? Scan a sample Lovable app
        </button>
      </div>
      <AnimatePresence>
        {error && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} role="alert" className="mt-2 px-1 text-[13px] text-critical">
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </form>
  );
}

function Field({ label, hint, children, className }: { label: string; hint?: string; children: React.ReactNode; className?: string }) {
  return (
    <label className={cn("block", className)}>
      <span className="mb-1.5 block text-xs font-medium text-fg">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-[11px] text-faint">{hint}</span>}
    </label>
  );
}

function IconInput({ icon, value, onChange, placeholder, type = "text" }: { icon: React.ReactNode; value: string; onChange: (v: string) => void; placeholder: string; type?: string }) {
  return (
    <span className="flex h-10 items-center gap-2 rounded-xl border border-line bg-sunken px-3 text-faint focus-within:border-line-strong">
      {icon}
      <input type={type} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} autoComplete="off" spellCheck={false} className="w-full bg-transparent font-mono text-[13px] text-fg outline-none placeholder:text-faint" />
    </span>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 text-sm text-muted">
      <span className={cn("relative h-5 w-9 rounded-full border border-line-strong transition", checked ? "bg-accent" : "bg-sunken")}>
        <motion.span layout transition={{ type: "spring", stiffness: 500, damping: 32 }} className={cn("absolute top-0.5 size-3.5 rounded-full", checked ? "right-0.5 bg-accent-ink" : "left-0.5 bg-faint")} />
      </span>
      {label}
    </button>
  );
}
