import { Plus } from "lucide-react";

export const FAQS = [
  {
    q: "Is it safe to connect my repository?",
    a: "Flo clones your repo read-only into a temporary folder, analyses it and deletes it when the scan ends. Private-repo tokens are used once to clone and never stored. Any secrets we find are redacted in the report — we show the file and line, never the key.",
  },
  {
    q: "What does Flo actually check?",
    a: "Security holes (exposed keys, missing Supabase RLS, unverified payment webhooks, SQL injection, XSS), common AI-generated bugs, performance problems (N+1 queries, missing indexes, no pagination, heavy images), production basics (backups, error tracking, CI, rate limits) and — for public sites — SEO and conversion basics like titles, sitemaps, schema, reviews and a clear call-to-action.",
  },
  {
    q: "Does it work with Lovable, Bolt, Cursor and v0 projects?",
    a: "Yes. Flo was built around the patterns those tools produce: Vite + React + Supabase from Lovable and Bolt, Next.js from v0 and Cursor, plus Firebase, Prisma, Stripe and more. Connect the GitHub repo your builder syncs to.",
  },
  {
    q: "Is the advice generic?",
    a: "No. Every check reads your code and shows its evidence. Checks that don't apply are skipped (a SaaS dashboard won't be told to add a Google Map), and the architecture is sized to the users, team and budget you tell us — so a side project isn't told to buy Kubernetes.",
  },
  {
    q: "Will it fix the problems for me?",
    a: "The report tells you exactly what to change and where, in order. If you'd rather have it done, book an expert audit: an engineer verifies the findings and fixes the critical ones at a fixed price.",
  },
  {
    q: "How long does a scan take?",
    a: "Usually under a minute. Large repos take a little longer, and the Claude architecture review adds about 30–60 seconds.",
  },
];

export function Faq() {
  return (
    <div className="divide-y divide-line overflow-hidden rounded-2xl border border-line bg-raised">
      {FAQS.map((f) => (
        <details key={f.q} className="group">
          <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 text-[15px] font-medium transition hover:bg-sunken/60 [&::-webkit-details-marker]:hidden">
            {f.q}
            <Plus className="size-4 shrink-0 text-faint transition-transform duration-300 group-open:rotate-45" />
          </summary>
          <p className="px-5 pb-5 text-[14.5px] leading-relaxed text-muted">{f.a}</p>
        </details>
      ))}
    </div>
  );
}
