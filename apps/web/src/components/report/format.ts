import type { ChecklistArea, CheckStatus, ProjectKind, Severity } from "@flo/engine";
import { Activity, Boxes, Database, Gauge, Megaphone, Rocket, Scale, Search, ShieldCheck, Wrench } from "lucide-react";

export const SEVERITIES: Severity[] = ["critical", "high", "medium", "low", "info"];

export const SEV: Record<Severity, { label: string; text: string; bg: string; dot: string }> = {
  critical: { label: "Critical", text: "text-critical", bg: "bg-critical/10 border-critical/25", dot: "bg-critical" },
  high: { label: "High", text: "text-high", bg: "bg-high/10 border-high/25", dot: "bg-high" },
  medium: { label: "Medium", text: "text-medium", bg: "bg-medium/10 border-medium/25", dot: "bg-medium" },
  low: { label: "Low", text: "text-low", bg: "bg-low/10 border-low/25", dot: "bg-low" },
  info: { label: "Info", text: "text-info", bg: "bg-info/10 border-info/25", dot: "bg-info" },
};

export const STATUS: Record<CheckStatus, { label: string; text: string; bg: string }> = {
  pass: { label: "Pass", text: "text-pass", bg: "bg-pass/10" },
  fail: { label: "Missing", text: "text-critical", bg: "bg-critical/10" },
  warn: { label: "Partial", text: "text-medium", bg: "bg-medium/10" },
  unknown: { label: "Verify", text: "text-low", bg: "bg-low/10" },
  na: { label: "N/A", text: "text-faint", bg: "bg-sunken" },
};

export const AREA_ICON: Record<ChecklistArea, typeof ShieldCheck> = {
  Security: ShieldCheck,
  "Data & database": Database,
  Performance: Gauge,
  Reliability: Activity,
  Observability: Search,
  Delivery: Rocket,
  "Code structure": Boxes,
  "SEO & discoverability": Search,
  "Conversion & trust": Megaphone,
  "Compliance & analytics": Scale,
};

export const AREAS: ChecklistArea[] = ["Security", "Data & database", "Performance", "Reliability", "Observability", "Delivery", "Code structure", "SEO & discoverability", "Conversion & trust", "Compliance & analytics"];

export const KIND_LABELS: Record<ProjectKind, string> = {
  "local-business": "Local business website",
  "marketing-site": "Marketing / landing site",
  "saas-app": "SaaS web app",
  ecommerce: "E-commerce store",
  api: "API / backend service",
  "mobile-app": "Mobile app",
};

export const CHANGE: Record<string, { label: string; cls: string }> = {
  keep: { label: "Keep", cls: "text-pass bg-pass/10" },
  add: { label: "Add", cls: "text-accent bg-accent-soft" },
  replace: { label: "Replace", cls: "text-high bg-high/10" },
  later: { label: "Later", cls: "text-faint bg-sunken" },
};

export const scoreColor = (n: number) => (n >= 80 ? "var(--pass)" : n >= 65 ? "var(--medium)" : n >= 50 ? "var(--high)" : "var(--critical)");

export { Wrench };
