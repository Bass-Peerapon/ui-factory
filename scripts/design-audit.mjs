#!/usr/bin/env node
// Runs impeccable's deterministic detector (pbakaus/impeccable, Apache-2.0) on rendered frames and writes
// a summary to evals/results/design-audit-latest.md. Needs the web dev server (make dev) running.
//
//   node scripts/design-audit.mjs                  every fixture x every design system
//   node scripts/design-audit.mjs --project <id>   every frame of a saved project (api must run too)
import { execFile } from "node:child_process";
import { mkdirSync, readdirSync, writeFileSync } from "node:fs";
import { promisify } from "node:util";

const run = promisify(execFile);
const WEB = process.env.WEB_URL ?? `http://localhost:${process.env.WEB_PORT ?? 5173}`;
const API = process.env.VITE_API_URL ?? "http://localhost:8080";
const DESIGN_SYSTEMS = [
  "shadcn", "vercel", "clean", "editorial", "warm-editorial", "dashboard",
  "corporate", "friendly", "luxury", "neobrutalism", "publication", "linear-app",
];

async function targets() {
  const i = process.argv.indexOf("--project");
  if (i > 0) {
    const id = process.argv[i + 1];
    const { doc } = await (await fetch(`${API}/api/projects/${id}`)).json();
    return doc.frameOrder.map((f) => ({
      label: doc.frames[f].name,
      url: `${WEB}/frame.html?project=${id}&f=${f}`,
    }));
  }
  const fixtures = readdirSync("packages/catalog/fixtures").filter((f) => f.endsWith(".json")).map((f) => f.slice(0, -5));
  return fixtures.flatMap((fx) =>
    DESIGN_SYSTEMS.map((ds) => ({ label: `${fx} / ${ds}`, url: `${WEB}/frame.html?fixture=${fx}&ds=${ds}` })),
  );
}

async function detect(url) {
  try {
    await run("npx", ["-y", "impeccable@latest", "detect", "--json", url], { maxBuffer: 64 << 20 });
    return [];
  } catch (e) {
    if (e.code === 2) return JSON.parse(e.stdout); // exit 2 = findings
    throw new Error(`detect failed for ${url}: ${e.stderr || e.message}`);
  }
}

const rows = [];
const byRule = new Map();
for (const t of await targets()) {
  const findings = await detect(t.url);
  const counts = {};
  for (const f of findings) {
    counts[f.antipattern] = (counts[f.antipattern] ?? 0) + 1;
    const r = byRule.get(f.antipattern) ?? { name: f.name, category: f.category, total: 0, targets: new Set(), sample: f.snippet };
    r.total++;
    r.targets.add(t.label);
    byRule.set(f.antipattern, r);
  }
  rows.push({ ...t, total: findings.length, counts });
  console.log(`${String(findings.length).padStart(3)}  ${t.label}`);
}

const md = [
  `# Design audit (impeccable detect)`,
  ``,
  `${new Date().toISOString()} · ${rows.length} frames · ${rows.reduce((n, r) => n + r.total, 0)} findings`,
  ``,
  `## By rule`,
  ``,
  `| rule | category | findings | frames | example |`,
  `|---|---|---|---|---|`,
  ...[...byRule.entries()]
    .sort((a, b) => b[1].total - a[1].total)
    .map(([id, r]) => `| ${id} | ${r.category} | ${r.total} | ${r.targets.size} | ${String(r.sample ?? "").replaceAll("|", "\\|").slice(0, 90)} |`),
  ``,
  `## By frame`,
  ``,
  `| frame | findings | rules |`,
  `|---|---|---|`,
  ...rows.map((r) => `| ${r.label} | ${r.total} | ${Object.entries(r.counts).map(([k, v]) => `${k} ${v}`).join(", ")} |`),
  ``,
].join("\n");
mkdirSync("evals/results", { recursive: true });
writeFileSync("evals/results/design-audit-latest.md", md);
console.log("wrote evals/results/design-audit-latest.md");
