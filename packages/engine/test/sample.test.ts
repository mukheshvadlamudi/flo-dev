import { describe, expect, it } from "vitest";
import { projectFromFiles, SAMPLE_ASSETS, sampleClinicFiles, scanProject } from "../src/index.js";

const report = await scanProject({
  project: projectFromFiles("sample", sampleClinicFiles(), SAMPLE_ASSETS),
  projectName: "smile-dental",
  sourceLabel: "sample",
  useAi: false,
});
const ruleIds = new Set(report.findings.map((f) => f.ruleId));
const check = (id: string) => report.checklist.find((c) => c.id === id);

describe("sample Lovable clinic app", () => {
  it("detects the stack and builder", () => {
    expect(report.stack.frameworks).toEqual(expect.arrayContaining(["React", "Vite"]));
    expect(report.stack.database).toContain("Supabase (Postgres)");
    expect(report.stack.payments).toContain("Stripe");
    expect(report.stack.builder).toBe("Lovable");
  });

  it("classifies it as a local business site", () => {
    expect(report.projectType.primary).toBe("local-business");
    expect(report.projectType.kinds).not.toContain("ecommerce");
  });

  it("finds the planted security holes", () => {
    for (const id of [
      "secrets.hardcoded",
      "supabase.service-role-exposed",
      "env.secret-in-public-var",
      "ai.sdk-in-browser",
      "supabase.rls-disabled",
      "supabase.policy-always-true",
      "supabase.grant-to-anon",
      "supabase.security-definer-rpc",
      "payments.webhook-unverified",
      "payments.client-controlled-amount",
      "db.client-sets-privileged-field",
      "db.mass-assignment",
      "web.xss-raw-html",
    ]) {
      expect(ruleIds, id).toContain(id);
    }
  });

  it("flags only the tables that lack RLS", () => {
    const tables = report.findings.filter((f) => f.ruleId === "supabase.rls-disabled").map((f) => f.title);
    expect(tables.join()).toContain("public.appointments");
    expect(tables.join()).toContain("public.payments");
    expect(tables.join()).not.toContain("public.profiles");
  });

  it("finds the planted bugs and performance problems", () => {
    for (const id of ["bug.async-useeffect", "bug.swallowed-error", "perf.n-plus-one", "perf.unpaginated-query", "perf.undebounced-search"]) {
      expect(ruleIds, id).toContain(id);
    }
  });

  it("never prints the secrets it finds", () => {
    const text = JSON.stringify(report.findings);
    const files = sampleClinicFiles();
    const stripe = files[".env"]!.match(/STRIPE_SECRET_KEY=(\S+)/)![1]!;
    expect(text).not.toContain(stripe);
    expect(text).not.toContain(files["src/integrations/supabase/client.ts"]!.match(/"(eyJ[^"]+)"/)![1]!);
  });

  it("runs the website checklist with code evidence", () => {
    expect(check("seo.unique-titles")?.status).toBe("fail");
    expect(check("seo.meta-descriptions")?.evidence).toMatch(/template default/);
    expect(check("seo.og-images")?.evidence).toMatch(/Lovable/);
    expect(check("seo.local-business-schema")?.status).toBe("fail");
    expect(check("conv.real-reviews")?.status).toBe("fail");
    expect(check("conv.click-to-call")?.status).toBe("fail");
    expect(check("conv.cta-above-fold")?.status).not.toBe("fail");
    expect(check("comp.analytics")?.status).toBe("pass");
    expect(check("comp.cookie-consent")?.status).toBe("fail");
    expect(check("perf.image-weight")?.refs[0]?.file).toBe("public/hero.jpg");
    expect(check("data.indexes")?.evidence).toMatch(/appointments\.user_id/);
  });

  it("skips checks that don't apply", () => {
    expect(check("data.pooling")?.status).toBe("pass");
    expect(report.checklist.every((c) => c.status !== "na")).toBe(true);
  });

  it("scores a leaky app as failing and puts security first in the roadmap", () => {
    expect(report.scores.grade).toBe("F");
    expect(report.scores.overall).toBeLessThan(50);
    expect(report.roadmap[0]?.phase).toBe("Fix now");
    expect(report.architecture.components.find((c) => c.layer === "Frontend")?.change).toBe("replace");
  });
});
