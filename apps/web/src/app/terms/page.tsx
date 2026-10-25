import { Prose } from "@/components/legal/prose";
import { SITE } from "@/lib/site";

export const metadata = { title: "Terms of service", description: "The terms for using Flo's scanner and paid services.", alternates: { canonical: "/terms" } };

export default function Terms() {
  return (
    <Prose title="Terms of service" updated="25 October 2026">
      <p>By using Flo you agree to these terms. Have them reviewed by a lawyer before relying on them for your jurisdiction.</p>
      <h2>Only scan what you own</h2>
      <p>Only submit repositories and websites you own or have written permission to test. Scanning other people's apps without permission is not allowed.</p>
      <h2>The report is guidance, not a guarantee</h2>
      <p>Automated analysis can miss issues and report false positives. A clean report does not mean an app is secure. Paid audits include human verification but are still limited to the agreed scope.</p>
      <h2>Paid services and refunds</h2>
      <p>Fixed-price work is agreed in writing before it starts. If we don't deliver what was agreed, you get a full refund.</p>
      <h2>Contact</h2>
      <p>Questions: {SITE.email}.</p>
    </Prose>
  );
}
