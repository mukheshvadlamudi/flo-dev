import type { Project, ProjectKind, ProjectType, Stack } from "./types.js";

function count(project: Project, re: RegExp, files?: (p: string) => boolean): number {
  let n = 0;
  for (const f of project.files) {
    if (files && !files(f.path)) continue;
    if (/(^|\/)(node_modules|test|tests|__tests__)\//.test(f.path)) continue;
    if (re.test(f.content)) n++;
  }
  return n;
}

const UI = (p: string) => /\.(jsx|tsx|vue|svelte|astro|html|md|mdx)$/.test(p);

/**
 * Decides what kind of product this codebase is, from code signals only, so the
 * checklist can skip items that don't apply (a SaaS dashboard needs no Google Maps embed).
 */
export function classifyProject(project: Project, stack: Stack, override?: ProjectKind): ProjectType {
  const signals: string[] = [];
  const score: Record<ProjectKind, number> = {
    "local-business": 0,
    "marketing-site": 0,
    "saas-app": 0,
    ecommerce: 0,
    api: 0,
    "mobile-app": 0,
  };

  const hasFrontend = project.files.some((f) => f.clientSide) || project.allPaths.some((p) => /(^|\/)index\.html$/.test(p));
  const hasBackend =
    stack.database.length > 0 ||
    project.allPaths.some((p) => /(^|\/)(api|server|backend|supabase\/functions)\//.test(p) || /route\.(t|j)s$/.test(p)) ||
    stack.frameworks.some((f) => ["Express", "Fastify", "Hono", "NestJS", "Django", "FastAPI", "Flask", "Rails", "Laravel"].includes(f));

  const tel = count(project, /href=["'{`]*tel:|\(\d{3}\)\s?\d{3}[-\s]\d{4}|\+\d{1,3}[\s-]\d{2,5}[\s-]\d{3,5}([\s-]\d{3,5})?/, UI);
  const address = count(project, /\b(street|st\.|road|rd\.|avenue|ave\.|suite|floor|pincode|zip|postcode)\b.{0,40}\d|\d{1,5}\s+\w+\s+(street|road|avenue|lane|blvd)/i, UI);
  const hours = count(project, /opening hours|business hours|mon(day)?\s*[-–]\s*(fri|sat)|open\s+(daily|today)|\b\d{1,2}(:\d{2})?\s*(am|pm)\s*[-–]\s*\d{1,2}/i, UI);
  const localWords = count(project, /\b(clinic|dental|dentist|salon|spa|restaurant|cafe|plumb|electrician|roofing|law firm|attorney|gym|studio|bakery|repair|cleaning|real estate|realtor|physio|vet)\b/i, UI);
  const booking = count(project, /book (an? )?(appointment|consultation|table|call)|get a (free )?quote|request a quote|enquir(e|y)/i, UI);
  if (tel > 0) signals.push("phone numbers / tel: links");
  if (address > 0) signals.push("street address");
  if (hours > 0) signals.push("opening hours");
  if (localWords > 0) signals.push("local-service vocabulary");
  if (booking > 0) signals.push("booking / quote / enquiry CTAs");
  // Vocabulary alone isn't enough (a SaaS can talk about clinics); a local business publishes how to reach it.
  const contact = (tel > 0 ? 2 : 0) + (address > 0 ? 2 : 0) + (hours > 0 ? 2 : 0);
  if (contact > 0) score["local-business"] += contact + Math.min(localWords, 3) + (booking > 0 ? 1 : 0);

  const cart = count(project, /\b(add to cart|addToCart|shopping cart|useCart|cartItems|CartProvider|shopify|medusa|woocommerce|product\.price|products\.map)\b/i);
  if (cart > 0) signals.push("cart / checkout / product catalogue");
  score.ecommerce += Math.min(cart, 4) * 2;

  const authUi = stack.auth.length > 0 || count(project, /sign ?in|log ?in|sign ?up|dashboard/i, UI) > 1;
  const dashboard = project.allPaths.some((p) => /(dashboard|settings|account|workspace|admin)/i.test(p));
  if (stack.auth.length > 0) signals.push(`auth (${stack.auth.join(", ")})`);
  if (dashboard) signals.push("dashboard / settings routes");
  if (stack.payments.length > 0) signals.push(`payments (${stack.payments.join(", ")})`);
  score["saas-app"] += (stack.auth.length > 0 ? 3 : authUi ? 1 : 0) + (dashboard ? 2 : 0) + (stack.database.length > 0 ? 2 : 0) + (stack.payments.length > 0 && cart === 0 ? 2 : 0);

  const landing = count(project, /\b(hero|testimonial|pricing|features|faq|get started|book a demo|join (the )?waitlist|cta)\b/i, UI);
  if (landing > 0) signals.push("landing-page sections (hero, pricing, testimonials…)");
  score["marketing-site"] += Math.min(landing, 4) + (hasBackend ? 0 : 2);

  if (stack.frameworks.includes("Expo / React Native")) {
    score["mobile-app"] += 8;
    signals.push("React Native / Expo");
  }
  if (!hasFrontend && hasBackend) {
    score.api += 6;
    signals.push("backend only, no UI");
  }

  const ranked = (Object.entries(score) as [ProjectKind, number][]).filter(([, s]) => s >= 3).sort((a, b) => b[1] - a[1]);
  let kinds = ranked.map(([k]) => k);
  if (kinds.length === 0) kinds = [hasBackend && !hasFrontend ? "api" : hasBackend ? "saas-app" : "marketing-site"];
  // A local business site is a marketing site too; keep both so marketing checks still run.
  if (kinds.includes("local-business") && !kinds.includes("marketing-site")) kinds.push("marketing-site");
  if (override) kinds = [override, ...kinds.filter((k) => k !== override)];

  return { primary: kinds[0]!, kinds, signals, hasFrontend, hasBackend };
}

export const KIND_LABELS: Record<ProjectKind, string> = {
  "local-business": "Local business website",
  "marketing-site": "Marketing / landing site",
  "saas-app": "SaaS web app",
  ecommerce: "E-commerce store",
  api: "API / backend service",
  "mobile-app": "Mobile app",
};
