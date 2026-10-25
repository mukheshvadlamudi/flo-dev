export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type Category =
  | "security"
  | "bug"
  | "architecture"
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

export type CheckStatus = "pass" | "fail" | "warn" | "unknown";

export type ReadinessArea =
  | "Security"
  | "Data & database"
  | "Reliability"
  | "Scalability & performance"
  | "Observability"
  | "Delivery & operations"
  | "Code structure";

export interface ReadinessCheck {
  id: string;
  area: ReadinessArea;
  title: string;
  status: CheckStatus;
  evidence: string;
  howTo: string;
  /** How much the item matters before launch: must = blocker, should = soon, later = at scale. */
  priority: "must" | "should" | "later";
}

export interface StructureReport {
  totalFiles: number;
  totalLines: number;
  largestFiles: { path: string; lines: number }[];
  godFiles: { path: string; lines: number }[];
  duplicateBlocks: { a: string; b: string; lines: number }[];
  todoCount: number;
  anyCount: number;
  testFiles: number;
  dataAccessInUi: string[];
  layers: { name: string; present: boolean }[];
  envVarsUsed: string[];
}

export type ScaleTier = "prototype" | "launch" | "growth" | "scale";

export interface UserProfile {
  /** Expected monthly active users in the next 6–12 months. */
  expectedUsers: number;
  teamSize: number;
  monthlyBudgetUsd: number;
  /** Free text about the product, e.g. "B2B invoicing SaaS for clinics". */
  productDescription?: string;
  compliance: string[];
  realtime: boolean;
  handlesPayments: boolean;
  handlesPII: boolean;
}

export interface ArchitectureComponent {
  layer: string;
  recommendation: string;
  why: string;
  current?: string;
}

export interface ArchitecturePlan {
  tier: ScaleTier;
  summary: string;
  components: ArchitectureComponent[];
  antiPatterns: string[];
  folderStructure: string;
}

export interface RoadmapStep {
  phase: "Fix now" | "Before launch" | "First month" | "When you grow";
  title: string;
  detail: string;
  source: string;
}

export interface Scores {
  overall: number;
  security: number;
  readiness: number;
  structure: number;
  grade: "A" | "B" | "C" | "D" | "F";
}

export interface AuditReport {
  id: string;
  createdAt: string;
  projectName: string;
  source: string;
  stack: Stack;
  findings: Finding[];
  readiness: ReadinessCheck[];
  structure: StructureReport;
  architecture: ArchitecturePlan;
  roadmap: RoadmapStep[];
  scores: Scores;
  profile: UserProfile;
  /** Markdown from Claude, present only when an API key is configured. */
  aiAdvice?: string;
  aiError?: string;
}
