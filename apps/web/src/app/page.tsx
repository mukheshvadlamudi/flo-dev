import { CHECKS, RULES, type ChecklistArea } from "@flo/engine";
import { ArrowRight, Check, FileSearch, GitBranch, Lock, Map, ShieldCheck, Sparkles } from "lucide-react";
import Link from "next/link";
import { FAQS, Faq } from "@/components/faq";
import { AREA_ICON, SEV, STATUS } from "@/components/report/format";
import { ScoreRing } from "@/components/report/score-ring";
import { Reveal } from "@/components/reveal";
import { ScanForm } from "@/components/scan-form";
import { SpotlightCard } from "@/components/spotlight-card";
import { StickyMobileCta } from "@/components/sticky-cta";
import { ButtonLink, Pill, SectionHeading } from "@/components/ui";
import { getSampleReport } from "@/lib/sample";
import { SITE } from "@/lib/site";
import { cn } from "@/lib/utils";

export const metadata = {
  title: { absolute: "Flo: make your vibe-coded app production-ready" },
  description: SITE.description,
};

const BUILDERS = ["Lovable", "Bolt", "Cursor", "v0", "Replit", "Claude Code", "Supabase", "Firebase", "Stripe", "Next.js", "Vite", "Prisma", "Vercel", "Netlify"];

const AREA_COPY: Partial<Record<ChecklistArea, string>> = {
  Security: "Exposed keys, missing RLS, fake-able webhooks, unprotected routes.",
  "Data & database": "Migrations, indexes, pooling, backups, typed queries.",
  Performance: "N+1 queries, pagination, caching, CDN, images, bundles.",
  Reliability: "Error tracking, boundaries, health checks, timeouts, queues.",
  Delivery: "CI, tests, strict types, env docs, preview deploys.",
  "Code structure": "God files, copy-paste patches, data access in UI.",
  "SEO & discoverability": "Titles, descriptions, sitemap, schema, 404s, alt text.",
  "Conversion & trust": "CTA above the fold, real reviews, thank-you page, sticky mobile CTA.",
};

const STATS = [
  { n: "52%", t: "of Supabase-backed Lovable apps in one scan had publicly readable tables", src: "https://medium.com/@jacobp96/i-scanned-over-50-lovable-apps-for-security-vulnerabilities-d05b2ad94006" },
  { n: "18,697", t: "user records exposed by a single showcased vibe-coded app", src: "https://vibegraveyard.ai/story/lovable-showcased-edtech-app-18k-users-exposed/" },
  { n: "3 : 1", t: "help requests for every rescuer offering to fix vibe-coded apps on Reddit", src: "https://bigideasdb.com/best-vibe-code-rescue-services-2026" },
];

const PLANS = [
  { name: "Self-serve scan", price: "Free", per: "", desc: "The full automated report for any public or private repo.", features: ["Security, bugs, performance & SEO checks", "Architecture sized to your goals", "Step-by-step roadmap", "Markdown & PDF export"], cta: "Run free audit", href: "/#audit", featured: false },
  { name: "Expert audit", price: "$199", per: "one-off", desc: "An engineer verifies every finding and fixes the critical ones.", features: ["Everything in the free scan", "Human-verified findings", "Up to 3 critical fixes as a pull request", "30-min walkthrough call", "Delivered in 48 hours"], cta: "Book expert audit", href: "/expert-audit?plan=audit", featured: true },
  { name: "Production sprint", price: "$750", per: "fixed", desc: "We take your app from demo to launch-ready.", features: ["Fix-now & before-launch roadmap", "Auth, payments & deploy hardening", "CI, error tracking & backups set up", "SEO & conversion basics"], cta: "Plan a sprint", href: "/expert-audit?plan=sprint", featured: false },
];

export default async function Home() {
  const sample = await getSampleReport();
  const topFindings = sample.findings.filter((f) => f.severity === "critical").slice(0, 4);
  const sampleChecks = ["seo.unique-titles", "conv.real-reviews", "data.indexes", "perf.image-weight", "comp.analytics"].map((id) => sample.checklist.find((c) => c.id === id)!).filter(Boolean);
  const areas = (Object.keys(AREA_COPY) as ChecklistArea[]).map((a) => ({ area: a, checks: CHECKS.filter((c) => c.area === a) }));
  const totalChecks = RULES.length + CHECKS.length;

  const jsonLd = [
    { "@context": "https://schema.org", "@type": "SoftwareApplication", name: "Flo", applicationCategory: "DeveloperApplication", operatingSystem: "Web", description: SITE.description, url: SITE.url, offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } },
    { "@context": "https://schema.org", "@type": "FAQPage", mainEntity: FAQS.map((f) => ({ "@type": "Question", name: f.q, acceptedAnswer: { "@type": "Answer", text: f.a } })) },
  ];

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="dot-grid pointer-events-none absolute inset-0" aria-hidden />
        <div className="pointer-events-none absolute top-[-20%] left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] opacity-60 blur-2xl" aria-hidden />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 pt-20 pb-16 text-center sm:px-6 sm:pt-28">
          <Reveal>
            <Pill className="gap-2 py-1 pr-3">
              <span className="rounded-full bg-accent px-1.5 text-[10px] font-semibold text-accent-ink">NEW</span>
              For apps built with Lovable, Bolt, Cursor & v0
            </Pill>
          </Reveal>
          <Reveal delay={0.05}>
            <h1 className="text-gradient mt-6 max-w-4xl text-[42px] leading-[1.02] font-semibold tracking-[-0.035em] text-balance sm:text-6xl md:text-7xl">Your AI built the demo. Flo gets it production‑ready.</h1>
          </Reveal>
          <Reveal delay={0.1}>
            <p className="mx-auto mt-6 max-w-2xl text-[17px] leading-relaxed text-pretty text-muted sm:text-lg">
              Connect your repo. In about a minute Flo finds the security holes, bugs and missing production basics in your code, then hands you an architecture sized to your goals and a step-by-step plan to launch. No patch-work.
            </p>
          </Reveal>
          <Reveal delay={0.15} className="mt-10 flex w-full justify-center">
            <ScanForm />
          </Reveal>
          <Reveal delay={0.2}>
            <ul className="mt-8 flex flex-wrap justify-center gap-x-6 gap-y-2 text-[13px] text-faint">
              {["Read-only clone, deleted after the scan", "Tokens never stored", "Secrets redacted in reports"].map((t) => (
                <li key={t} className="flex items-center gap-1.5">
                  <Lock className="size-3.5" /> {t}
                </li>
              ))}
            </ul>
          </Reveal>
        </div>

        {/* Real product shot */}
        <Reveal delay={0.1} className="relative mx-auto max-w-6xl px-4 pb-24 sm:px-6">
          <div className="rounded-[28px] border border-line bg-raised/60 p-2 shadow-card backdrop-blur">
            <div className="overflow-hidden rounded-[22px] border border-line bg-bg">
              <div className="flex items-center gap-2 border-b border-line px-4 py-3">
                <span className="size-2.5 rounded-full bg-line-strong" />
                <span className="size-2.5 rounded-full bg-line-strong" />
                <span className="size-2.5 rounded-full bg-line-strong" />
                <span className="ml-3 truncate font-mono text-xs text-faint">flo.dev/report/smile-dental</span>
              </div>
              <div className="grid gap-6 p-5 sm:p-8 lg:grid-cols-[auto_1fr_1fr]">
                <div className="flex flex-col items-center gap-3">
                  <ScoreRing value={sample.scores.overall} grade={sample.scores.grade} size={150} />
                  <p className="text-center text-xs text-faint">
                    {sample.findings.length} findings · {sample.checklist.length} checks
                  </p>
                </div>
                <div>
                  <p className="text-xs font-medium text-faint uppercase">Fix now</p>
                  <ul className="mt-3 space-y-2">
                    {topFindings.map((f) => (
                      <li key={`${f.ruleId}:${f.file}:${f.line}`} className="rounded-xl border border-line bg-raised px-3.5 py-2.5">
                        <p className="flex items-center gap-2 text-[13.5px] font-medium">
                          <span className={cn("size-1.5 shrink-0 rounded-full", SEV[f.severity].dot)} />
                          <span className="truncate">{f.title}</span>
                        </p>
                        <p className="mt-0.5 truncate pl-3.5 font-mono text-[11px] text-faint">
                          {f.file}:{f.line}
                        </p>
                      </li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-faint uppercase">Checklist</p>
                  <ul className="mt-3 divide-y divide-line rounded-xl border border-line bg-raised">
                    {sampleChecks.map((c) => (
                      <li key={c.id} className="flex items-start gap-3 px-3.5 py-2.5">
                        <span className={cn("mt-0.5 w-14 shrink-0 rounded py-0.5 text-center text-[10.5px] font-medium", STATUS[c.status].bg, STATUS[c.status].text)}>{STATUS[c.status].label}</span>
                        <span className="min-w-0">
                          <span className="block text-[13px] font-medium">{c.title}</span>
                          <span className="block truncate text-[12px] text-muted">{c.evidence}</span>
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </div>
          <p className="mt-4 text-center text-[13px] text-faint">
            Real output from scanning a sample Lovable app, not a mockup.{" "}
            <Link href="/sample" className="text-muted underline-offset-4 hover:text-fg hover:underline">
              Open the full sample report →
            </Link>
          </p>
        </Reveal>
      </section>

      {/* Builders marquee */}
      <section className="border-y border-line py-6" aria-label="Works with">
        <div className="relative overflow-hidden [mask-image:linear-gradient(90deg,transparent,black_12%,black_88%,transparent)]">
          <div className="marquee flex w-max gap-10">
            {[...BUILDERS.map((b) => `a:${b}`), ...BUILDERS.map((b) => `b:${b}`)].map((k) => (
              <span key={k} aria-hidden={k.startsWith("b:")} className="font-mono text-sm whitespace-nowrap text-faint">
                {k.slice(2)}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Problem */}
      <section className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
        <SectionHeading eyebrow="The problem" title="Vibe-coded apps work in the demo. Then real users arrive." sub="AI builders optimise for “it runs”, not for security, scale or a codebase you can keep changing. The gaps are predictable, so Flo checks for them." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {STATS.map((s, i) => (
            <Reveal key={s.n} delay={i * 0.06}>
              <SpotlightCard className="h-full p-6">
                <p className="font-mono text-4xl font-semibold tracking-tight">{s.n}</p>
                <p className="mt-3 text-[14.5px] leading-relaxed text-muted">{s.t}</p>
                <a href={s.src} target="_blank" rel="noreferrer" className="mt-4 inline-block text-xs text-faint hover:text-fg">
                  Source ↗
                </a>
              </SpotlightCard>
            </Reveal>
          ))}
        </div>
      </section>

      {/* What we check */}
      <section id="checks" className="scroll-mt-20 border-t border-line bg-sunken/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading eyebrow="What we check" title={`${totalChecks} checks a senior engineer would run.`} sub="Each one reads your actual code and shows the evidence. Checks that don't fit your kind of product are skipped, so a dashboard isn't told to add a map and a local clinic isn't told to buy a queue." />
          <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {areas.map(({ area, checks }, i) => {
              const Icon = AREA_ICON[area];
              return (
                <Reveal key={area} delay={(i % 4) * 0.05} className={cn([0, 5, 6, 7].includes(i) && "lg:col-span-2")}>
                  <SpotlightCard className="h-full p-5">
                    <div className="flex items-center justify-between">
                      <span className="grid size-9 place-items-center rounded-xl border border-line bg-sunken">
                        <Icon className="size-4.5" />
                      </span>
                      <span className="font-mono text-xs text-faint">{area === "Security" ? checks.length + RULES.filter((r) => r.category === "security").length : checks.length} checks</span>
                    </div>
                    <p className="mt-4 font-medium">{area}</p>
                    <p className="mt-1 text-[13.5px] leading-relaxed text-muted">{AREA_COPY[area]}</p>
                    <ul className="mt-4 flex flex-wrap gap-1.5">
                      {checks.slice(0, [0, 5, 6, 7].includes(i) ? 6 : 3).map((c) => (
                        <li key={c.id} className="rounded-md bg-sunken px-2 py-0.5 text-[11px] text-muted">
                          {c.title}
                        </li>
                      ))}
                    </ul>
                  </SpotlightCard>
                </Reveal>
              );
            })}
          </div>
        </div>
      </section>

      {/* How it works */}
      <section id="how" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading eyebrow="How it works" title="From repo to roadmap in about a minute." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {[
            { icon: GitBranch, t: "Connect your repo", d: "Paste a GitHub URL (add a read-only token for private repos) and, optionally, your live site and goals: users, team, budget." },
            { icon: FileSearch, t: "Flo reads everything", d: "Static rules trace secrets, RLS, webhooks, queries and structure; the live probe tests real 404s, headers and meta tags; Claude reviews the architecture for your scale." },
            { icon: Map, t: "Get your plan", d: "A scored report with file-and-line evidence, a right-sized architecture, and a roadmap ordered Fix now → Before launch → First month → When you grow." },
          ].map((s, i) => (
            <Reveal key={s.t} delay={i * 0.07}>
              <div className="relative h-full rounded-2xl border border-line bg-raised p-6 shadow-card">
                <span className="font-mono text-xs text-faint">0{i + 1}</span>
                <s.icon className="mt-4 size-5" />
                <p className="mt-3 text-[17px] font-medium">{s.t}</p>
                <p className="mt-2 text-[14px] leading-relaxed text-muted">{s.d}</p>
              </div>
            </Reveal>
          ))}
        </div>
        <Reveal className="mt-4">
          <div className="grid gap-4 rounded-2xl border border-line bg-raised p-6 shadow-card md:grid-cols-[1fr_1.2fr] md:items-center">
            <div>
              <p className="flex items-center gap-2 text-sm font-medium">
                <Sparkles className="size-4 text-accent" /> Advice sized to you, not a generic checklist
              </p>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">A 300-user booking tool on $20/month gets “stay on Supabase + Vercel, fix RLS, add backups”. A 100k-user SaaS gets pooling, Redis, queues and load-balanced, stateless servers. Same scanner, different plan.</p>
            </div>
            <ul className="grid gap-2 text-[13px] sm:grid-cols-2">
              {["Load balancing & stateless servers", "Database indexes & pooling", "Caching (client, CDN, Redis)", "Background jobs & queues", "Rate limits & spend caps", "Backups & restore tests", "CI, tests & preview deploys", "Clean folder structure"].map((x) => (
                <li key={x} className="flex items-center gap-2 text-muted">
                  <Check className="size-3.5 text-accent" /> {x}
                </li>
              ))}
            </ul>
          </div>
        </Reveal>
      </section>

      {/* Pricing */}
      <section id="pricing" className="scroll-mt-20 border-t border-line bg-sunken/40">
        <div className="mx-auto max-w-6xl px-4 py-24 sm:px-6">
          <SectionHeading center eyebrow="Pricing" title="Free to scan. Fixed price if you want it fixed." sub="No subscriptions to start. Every paid plan begins from your free report." />
          <div className="mt-12 grid gap-4 lg:grid-cols-3">
            {PLANS.map((p, i) => (
              <Reveal key={p.name} delay={i * 0.06}>
                <div className={cn("relative flex h-full flex-col rounded-3xl border p-6 shadow-card", p.featured ? "border-fg/20 bg-fg text-bg" : "border-line bg-raised")}>
                  {p.featured && <span className="absolute -top-3 left-6 rounded-full bg-accent px-2.5 py-0.5 text-[11px] font-semibold text-accent-ink">Most popular</span>}
                  <p className="font-medium">{p.name}</p>
                  <p className="mt-4 flex items-baseline gap-1.5">
                    <span className="text-4xl font-semibold tracking-tight">{p.price}</span>
                    <span className={cn("text-sm", p.featured ? "text-bg/60" : "text-faint")}>{p.per}</span>
                  </p>
                  <p className={cn("mt-2 text-[14px]", p.featured ? "text-bg/70" : "text-muted")}>{p.desc}</p>
                  <ul className="mt-6 flex-1 space-y-2.5 text-[14px]">
                    {p.features.map((f) => (
                      <li key={f} className="flex gap-2">
                        <Check className={cn("mt-0.5 size-4 shrink-0", p.featured ? "text-accent" : "text-pass")} /> {f}
                      </li>
                    ))}
                  </ul>
                  <ButtonLink href={p.href} variant={p.featured ? "secondary" : "primary"} className={cn("mt-8 w-full", p.featured && "border-transparent bg-bg text-fg")}>
                    {p.cta} <ArrowRight className="size-4" />
                  </ButtonLink>
                </div>
              </Reveal>
            ))}
          </div>
          <p className="mt-6 text-center text-[13px] text-faint">We reply to every enquiry {SITE.responseTime}.</p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="mx-auto max-w-3xl scroll-mt-20 px-4 py-24 sm:px-6">
        <SectionHeading center eyebrow="FAQ" title="Questions, answered." />
        <div className="mt-10">
          <Faq />
        </div>
      </section>

      {/* Final CTA */}
      <section className="mx-auto max-w-6xl px-4 pb-28 sm:px-6">
        <div className="relative overflow-hidden rounded-[32px] border border-line bg-raised p-8 text-center shadow-card sm:p-14">
          <div className="pointer-events-none absolute inset-x-0 -top-40 mx-auto h-80 w-[600px] rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" aria-hidden />
          <ShieldCheck className="relative mx-auto size-8 text-accent" />
          <h2 className="text-gradient relative mt-4 text-3xl font-semibold tracking-tight text-balance sm:text-5xl">Find out what your AI forgot.</h2>
          <p className="relative mx-auto mt-4 max-w-lg text-muted">Free, about a minute, and you keep the report.</p>
          <ButtonLink href="/#audit" size="lg" className="relative mt-8">
            Run a free audit <ArrowRight className="size-4" />
          </ButtonLink>
        </div>
      </section>

      <StickyMobileCta />
    </>
  );
}
