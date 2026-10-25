#!/usr/bin/env node
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { parseArgs } from "node:util";
import { scanProject } from "./core/scan.js";
import { cloneGitHub, parseGitHubUrl, resolveLocal } from "./core/source.js";
import { toMarkdown } from "./core/report/markdown.js";
import type { ProjectKind } from "./core/types.js";

const HELP = `flo: production-readiness audit for vibe-coded apps

Usage:
  flo <path | github-url> [options]

Options:
  --url <https://…>     Also probe the live site (404s, headers, meta tags)
  --users <n>           Expected monthly users (default 1000)
  --team <n>            Team size (default 1)
  --budget <usd>        Monthly infra budget in USD (default 50)
  --kind <kind>         Force the project type: local-business | marketing-site | saas-app | ecommerce | api | mobile-app
  --about <text>        One line about the product
  --no-ai               Skip the Claude review even if ANTHROPIC_API_KEY is set
  --json <file>         Write the full report as JSON
  --md <file>           Write the report as Markdown
  -h, --help            Show this help`;

async function main() {
  const { values, positionals } = parseArgs({
    allowPositionals: true,
    options: {
      url: { type: "string" },
      users: { type: "string" },
      team: { type: "string" },
      budget: { type: "string" },
      kind: { type: "string" },
      about: { type: "string" },
      "no-ai": { type: "boolean" },
      json: { type: "string" },
      md: { type: "string" },
      help: { type: "boolean", short: "h" },
    },
  });
  const target = positionals[0];
  if (values.help || !target) {
    console.log(HELP);
    process.exit(target ? 0 : 1);
  }

  // An existing local folder wins over the "owner/repo" GitHub shorthand.
  const source = !existsSync(target) && parseGitHubUrl(target) ? await cloneGitHub(target, process.env.GITHUB_TOKEN) : await resolveLocal(target);
  try {
    const report = await scanProject({
      dir: source.dir,
      projectName: source.name,
      sourceLabel: source.label,
      commit: source.commit,
      liveUrl: values.url,
      allowPrivateLive: true,
      useAi: !values["no-ai"],
      profile: {
        ...(values.users ? { expectedUsers: Number(values.users) } : {}),
        ...(values.team ? { teamSize: Number(values.team) } : {}),
        ...(values.budget ? { monthlyBudgetUsd: Number(values.budget) } : {}),
        ...(values.kind ? { kindOverride: values.kind as ProjectKind } : {}),
        ...(values.about ? { productDescription: values.about } : {}),
      },
      onEvent: (e) => process.stderr.write(`  ${Math.round(e.progress * 100).toString().padStart(3)}%  ${e.message}\n`),
    });
    const md = toMarkdown(report);
    if (values.json) await writeFile(values.json, JSON.stringify(report, null, 2));
    if (values.md) await writeFile(values.md, md);
    if (!values.json && !values.md) console.log(md);
    else console.error(`\nScore ${report.scores.overall}/100 (${report.scores.grade}). ${report.findings.length} findings, ${report.checklist.filter((c) => c.status === "fail").length} failing checks.`);
    if (report.ai.error) console.error(`note: ${report.ai.error}`);
  } finally {
    await source.cleanup();
  }
}

main().catch((err) => {
  console.error(`flo: ${err instanceof Error ? err.message : err}`);
  process.exit(1);
});
