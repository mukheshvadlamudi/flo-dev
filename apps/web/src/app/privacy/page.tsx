import { Prose } from "@/components/legal/prose";
import { SITE } from "@/lib/site";

export const metadata = { title: "Privacy policy", description: "How Flo handles your code, tokens and personal data.", alternates: { canonical: "/privacy" } };

export default function Privacy() {
  return (
    <Prose title="Privacy policy" updated="25 October 2026">
      <p>This policy explains what Flo collects when you use the site and the scanner, why, and the choices you have. Have it reviewed by a lawyer before relying on it for your jurisdiction.</p>
      <h2>Your code</h2>
      <ul>
        <li>We clone your repository read-only into a temporary folder, analyse it, and delete the clone as soon as the scan finishes.</li>
        <li>GitHub tokens you provide are used once to clone and are never written to disk or logs.</li>
        <li>Reports store file paths, line numbers and short redacted snippets — never the secrets themselves.</li>
        <li>If an Anthropic API key is configured, a summary of the findings and short excerpts of configuration files are sent to Anthropic to generate architecture advice. Anthropic does not train on API data by default.</li>
      </ul>
      <h2>Live site checks</h2>
      <p>If you give us a URL, we request a handful of public pages (home page, robots.txt, sitemap.xml and one non-existent path) exactly like a browser would.</p>
      <h2>Enquiries</h2>
      <p>When you contact us we store your name, email and message to reply and deliver the service, and keep them for up to 24 months.</p>
      <h2>Analytics</h2>
      <p>We may use privacy-friendly analytics to understand which pages are useful. We don't sell personal data.</p>
      <h2>Your rights</h2>
      <p>You can ask us to access, correct or delete your data, including any saved report, by emailing {SITE.email}. We reply {SITE.responseTime}.</p>
    </Prose>
  );
}
