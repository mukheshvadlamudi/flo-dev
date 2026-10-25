export const SITE = {
  name: "Flo",
  url: (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  tagline: "Production-readiness audits for vibe-coded apps",
  description:
    "Connect your GitHub repo and Flo finds the security holes, bugs and missing production basics in apps built with Lovable, Bolt, Cursor and v0 — then gives you a step-by-step plan to launch.",
  email: "hello@flo.dev",
  responseTime: "within 24 hours",
};
