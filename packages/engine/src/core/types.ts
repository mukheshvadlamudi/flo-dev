export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Category =
  | "security"
  | "bug"
  | "performance"
  | "reliability"
  | "maintainability";

export interface SourceFile {
  /** Path relative to the project root, always with forward slashes. */
  path: string;
  content: string;
  lines: string[];
  ext: string;
  /** True when the file ships to the browser (React components, Vite/Next client code). */
  clientSide: boolean;
}

export interface Project {
  root: string;
  files: SourceFile[];
  /** Every path seen, including skipped binaries and oversized files. */
  allPaths: string[];
  /** Images, video and fonts with their size, for weight checks. Contents are never read. */
  assets: { path: string; bytes: number }[];
  packageJson?: PackageJson;
  /** Union of dependencies and devDependencies across every package.json. */
  deps: Record<string, string>;
}

export interface PackageJson {
  name?: string;
  scripts?: Record<string, string>;
  dependencies?: Record<string, string>;
  devDependencies?: Record<string, string>;
}

export interface CodeRef {
  file: string;
  line?: number;
  snippet?: string;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  category: Category;
  file?: string;
  line?: number;
  /** The offending line, with any secret values redacted. */
  snippet?: string;
  why: string;
  fix: string;
  references?: string[];
}

export interface Rule {
  id: string;
  title: string;
  severity: Severity;
  category: Category;
  why: string;
  fix: string;
  references?: string[];
  /** Limit the rule to some kinds of project; omitted means it always runs. */
  appliesTo?: ProjectKind[];
  check(project: Project): RuleHit[];
}

export interface RuleHit {
  file?: string;
  line?: number;
  snippet?: string;
  /** Overrides the rule title when a hit needs a more specific one. */
  title?: string;
  severity?: Severity;
}

export interface Stack {
  languages: string[];
  frameworks: string[];
  database: string[];
  orm: string[];
  auth: string[];
  payments: string[];
  hosting: string[];
  ai: string[];
  builder?: string;
  hasTests: boolean;
  hasCI: boolean;
  hasDocker: boolean;
  packageManager?: string;
}

export type ProjectKind =
  | "local-business"
  | "marketing-site"
  | "saas-app"
  | "ecommerce"
  | "api"
  | "mobile-app";

export interface ProjectType {
  primary: ProjectKind;
  /** Every kind that applies, primary first. A SaaS usually also has a marketing site. */
  kinds: ProjectKind[];
  /** Human-readable signals that led to the classification. */
  signals: string[];
  hasFrontend: boolean;
  hasBackend: boolean;
}

export type CheckStatus = "pass" | "fail" | "warn" | "unknown" | "na";

export type ChecklistArea =
  | "Security"
  | "Data & database"
  | "Performance"
  | "Reliability"
  | "Observability"
  | "Delivery"
  | "Code structure"
  | "SEO & discoverability"
  | "Conversion & trust"
  | "Compliance & analytics";

export interface ChecklistItem {
  id: string;
  area: ChecklistArea;
  title: string;
  status: CheckStatus;
  /** One sentence on what was (or wasn't) found. */
  evidence: string;
  refs: CodeRef[];
  howTo: string;
  /** must = launch blocker, should = first weeks, later = once traffic grows. */
  priority: "must" | "should" | "later";
  /** Why this item matters for this specific project (or why it doesn't). */
  relevance: string;
  /** Where the verdict came from: the code, the live site, or both. */
  source: "code" | "live" | "code+live";
}

export interface StructureReport {
  totalFiles: number;
  totalLines: number;
  largestFiles: { path: string; lines: number }[];
  godFiles: { path: string; lines: number }[];
  duplicateBlocks: { a: string; aLine: number; b: string; bLine: number; lines: number }[];
  todoCount: number;
  anyCount: number;
  testFiles: number;
  sourceFiles: number;
  dataAccessInUi: CodeRef[];
  layers: { name: string; present: boolean; hint: string }[];
  envVarsUsed: string[];
  routes: string[];
}

export type ScaleTier = "prototype" | "launch" | "growth" | "scale";

export interface UserProfile {
  /** Expected monthly active users in the next 6–12 months. */
  expectedUsers: number;
  teamSize: number;
  monthlyBudgetUsd: number;
  /** Free text about the product, e.g. "B2B invoicing SaaS for clinics". */
  productDescription?: string;
  /** Overrides the detected project kind when the user knows better. */
  kindOverride?: ProjectKind;
  compliance: string[];
  realtime: boolean;
  handlesPayments: boolean;
  handlesPII: boolean;
}

export interface ArchitectureComponent {
  layer: string;
  current: string;
  recommended: string;
  why: string;
  change: "keep" | "add" | "replace" | "later";
}

export interface ArchitecturePlan {
  tier: ScaleTier;
  summary: string;
  components: ArchitectureComponent[];
  antiPatterns: { title: string; detail: string; refs: CodeRef[] }[];
  folderStructure: string;
  /** "rules" for the deterministic planner, "claude" when the model rewrote it. */
  author: "rules" | "claude";
}

export type RoadmapPhase = "Fix now" | "Before launch" | "First month" | "When you grow";

export interface RoadmapStep {
  phase: RoadmapPhase;
  title: string;
  detail: string;
  /** IDs of the findings or checklist items this step resolves. */
  resolves: string[];
  effort: "minutes" | "hours" | "days";
}

export interface Scores {
  overall: number;
  security: number;
  readiness: number;
  /** Null when no SEO / conversion items apply (e.g. a pure API). */
  growth: number | null;
  structure: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface LiveProbe {
  url: string;
  ok: boolean;
  error?: string;
  status?: number;
  finalUrl?: string;
  headers: Record<string, string>;
  html?: { title?: string; description?: string; ogImage?: string; canonical?: string; jsonLdTypes: string[]; imgWithoutAlt: number; imgTotal: number; links: number; scripts: number; blockingScripts: number; bytes: number };
  robots?: { status: number; body?: string };
  sitemap?: { status: number };
  notFound?: { status: number; customPage: boolean };
  timingMs?: number;
}

export interface ScanEvent {
  stage: "source" | "read" | "stack" | "rules" | "checklist" | "live" | "architecture" | "ai" | "done" | "error";
  message: string;
  progress: number;
}

export interface AuditReport {
  id: string;
  version: 1;
  createdAt: string;
  projectName: string;
  source: string;
  commit?: string;
  durationMs: number;
  stack: Stack;
  projectType: ProjectType;
  findings: Finding[];
  checklist: ChecklistItem[];
  structure: StructureReport;
  architecture: ArchitecturePlan;
  roadmap: RoadmapStep[];
  scores: Scores;
  profile: UserProfile;
  live?: LiveProbe;
  ai: { used: boolean; model?: string; verdict?: string; error?: string };
}
