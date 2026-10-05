// Compares the jev and llm composers on 10 page prompts and 10 routing cases.
// Usage: pnpm eval -- --runs 2 --only jev
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { catalog, componentDefs, isComponentName, normalizeSpec, type Spec } from "@ui-factory/catalog";
import { createComposer, loadEnv, type Composer, type Intent } from "@ui-factory/composer";
import prompts from "./prompts.json" with { type: "json" };

loadEnv();
const here = dirname(fileURLToPath(import.meta.url));
const { values } = parseArgs({ args: process.argv.slice(2).filter((a) => a !== "--"), options: { runs: { type: "string", default: "1" }, only: { type: "string" } } });
const runs = Number(values.runs);
const modes = (values.only ? [values.only] : ["jev", "llm"]) as ("jev" | "llm")[];
// The llm composer shares the Gemini free tier (about 15 requests/minute on the fast model).
const llmPaceMs = 4500;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Same tree rules as the Go API: Page root, blocks under the root, primitives in declared slots. */
function treeIssues(spec: Spec): string[] {
  const issues: string[] = [];
  const root = spec.elements[spec.root];
  if (!root || root.type !== "Page") issues.push("root is not Page");
  for (const [id, el] of Object.entries(spec.elements)) {
    if (!isComponentName(el.type)) { issues.push(`${id}: unknown type ${el.type}`); continue; }
    const kind = componentDefs[el.type].kind;
    for (const c of el.children ?? []) {
      const child = spec.elements[c];
      if (!child) issues.push(`${id}: missing child ${c}`);
      else if (id !== spec.root || componentDefs[child.type as keyof typeof componentDefs]?.kind !== "block")
        issues.push(`${c} (${child.type}) placed in children of ${el.type}`);
    }
    for (const [slot, keys] of Object.entries(el.slots ?? {})) {
      const allowed = (componentDefs[el.type].slots ?? []) as readonly string[];
      if (!allowed.includes(slot)) issues.push(`${id}: unknown slot ${slot}`);
      for (const c of keys) {
        const child = spec.elements[c];
        if (child && componentDefs[child.type as keyof typeof componentDefs]?.kind !== "primitive")
          issues.push(`${c} (${child.type}) is not a primitive but sits in slot ${slot}`);
      }
    }
    if (kind === "primitive" && (el.children?.length ?? 0) > 0) issues.push(`${id}: primitive has children`);
  }
  const top = root?.children ?? [];
  const footerAt = top.findIndex((k) => spec.elements[k]?.type === "Footer");
  if (footerAt >= 0 && footerAt !== top.length - 1) issues.push("Footer is not the last section");
  const navAt = top.findIndex((k) => spec.elements[k]?.type === "Navbar");
  if (navAt > 0 && spec.elements[top[0]]?.type !== "Banner") issues.push("Navbar is not the first section");
  return issues;
}

interface StructureRow {
  mode: string; id: string; run: number; ms: number; stopReason: string; valid: boolean;
  issues: string[]; repaired: boolean; blocks: string[]; elements: number; coverage: number; error?: string;
}

async function evalStructure(c: Composer, p: (typeof prompts.structure)[number], run: number): Promise<StructureRow> {
  const t0 = performance.now();
  try {
    let final: Spec | null = null;
    let stopReason = "";
    for await (const ev of c.structure({ prompt: p.prompt, signal: AbortSignal.timeout(60_000) })) {
      if (ev.type === "complete") { final = ev.spec; stopReason = ev.stopReason; }
    }
    const ms = Math.round(performance.now() - t0);
    if (!final) return { mode: c.name, id: p.id, run, ms, stopReason, valid: false, repaired: false, issues: ["no spec"], blocks: [], elements: 0, coverage: 0 };
    const schemaOk = (catalog.validate(final) as { success: boolean }).success;
    const issues = treeIssues(final);
    const fixed = normalizeSpec(final).spec;
    const repaired = (catalog.validate(fixed) as { success: boolean }).success && treeIssues(fixed).length === 0;
    const blocks = (final.elements[final.root]?.children ?? []).map((k) => final!.elements[k]?.type);
    const coverage = p.expect.filter((t) => blocks.includes(t)).length / p.expect.length;
    return { mode: c.name, id: p.id, run, ms, stopReason, valid: schemaOk && issues.length === 0, repaired, issues: schemaOk ? issues : ["catalog schema", ...issues], blocks, elements: Object.keys(final.elements).length, coverage };
  } catch (e) {
    return { mode: c.name, id: p.id, run, ms: Math.round(performance.now() - t0), stopReason: "error", valid: false, repaired: false, issues: [], blocks: [], elements: 0, coverage: 0, error: (e as Error).message };
  }
}

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? (s.length % 2 ? s[(s.length - 1) / 2] : (s[s.length / 2 - 1] + s[s.length / 2]) / 2) : 0;
};
const p90 = (xs: number[]) => [...xs].sort((a, b) => a - b)[Math.max(0, Math.ceil(xs.length * 0.9) - 1)] ?? 0;
const pct = (x: number) => `${Math.round(x * 100)}%`;

const structureRows: StructureRow[] = [];
const routeRows: { mode: string; prompt: string; expect: Intent; got: string; ms: number; confidence: number | null }[] = [];

for (const mode of modes) {
  const c = createComposer(mode);
  for (let run = 1; run <= runs; run++) {
    for (const p of prompts.structure) {
      const row = await evalStructure(c, p, run);
      structureRows.push(row);
      console.log(`${mode} run${run} ${p.id}: ${row.valid ? "valid" : "INVALID"} ${row.ms}ms ${row.blocks.join(",")}${row.error ? " ERROR " + row.error : ""}`);
      if (mode === "llm") await sleep(llmPaceMs);
    }
  }
  for (const r of prompts.route) {
    try {
      const res = await c.route({ prompt: r.prompt, selection: r.selection, frameHasContent: r.currentPage !== "", currentPage: r.currentPage });
      routeRows.push({ mode, prompt: r.prompt, expect: r.expect as Intent, got: res.intent, ms: res.ms, confidence: res.confidence });
    } catch (e) {
      routeRows.push({ mode, prompt: r.prompt, expect: r.expect as Intent, got: "error: " + (e as Error).message, ms: 0, confidence: null });
    }
    if (mode === "llm") await sleep(llmPaceMs);
  }
}

// --- report -----------------------------------------------------------------
const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const lines: string[] = [];
lines.push(`# Composer eval ${stamp}`, "");
lines.push(`Runs per prompt: ${runs}. Pass = catalog schema valid and tree rules hold (blocks under the root, primitives in declared slots). "After normalize" is what reaches the canvas. Coverage = expected blocks present.`, "");
lines.push("## Summary", "", "| composer | structure pass (raw) | pass after normalize | median latency | p90 latency | expected-block coverage | route accuracy | route median |", "|---|---|---|---|---|---|---|---|");
for (const mode of modes) {
  const s = structureRows.filter((r) => r.mode === mode);
  const rt = routeRows.filter((r) => r.mode === mode);
  lines.push(`| ${mode} | ${s.filter((r) => r.valid).length}/${s.length} (${pct(s.filter((r) => r.valid).length / s.length)}) | ${s.filter((r) => r.repaired).length}/${s.length} | ${median(s.map((r) => r.ms))} ms | ${p90(s.map((r) => r.ms))} ms | ${pct(s.reduce((a, r) => a + r.coverage, 0) / s.length)} | ${rt.filter((r) => r.got === r.expect).length}/${rt.length} | ${median(rt.map((r) => r.ms))} ms |`);
}
lines.push("", "## Structure (คะแนนที่ให้เอง: กรอก 1 ถึง 5 ในคอลัมน์ score หลังเปิดดูผลในแอป)", "", "| prompt | composer | run | pass | ms | stop | blocks | elements | coverage | score | notes |", "|---|---|---|---|---|---|---|---|---|---|---|");
for (const r of structureRows) {
  lines.push(`| ${r.id} | ${r.mode} | ${r.run} | ${r.valid ? "✓" : "✗"} | ${r.ms} | ${r.stopReason} | ${r.blocks.join(" › ")} | ${r.elements} | ${pct(r.coverage)} |  | ${[r.error, ...r.issues].filter(Boolean).join("; ").replace(/\|/g, "/")} |`);
}
lines.push("", "## Routing", "", "| prompt | expect | composer | got | confidence | ms |", "|---|---|---|---|---|---|");
for (const r of routeRows) {
  lines.push(`| ${r.prompt} | ${r.expect} | ${r.mode} | ${r.got === r.expect ? r.got : `**${r.got}**`} | ${r.confidence ?? "n/a"} | ${r.ms} |`);
}
const md = lines.join("\n") + "\n";
mkdirSync(resolve(here, "results"), { recursive: true });
writeFileSync(resolve(here, `results/${stamp}.md`), md);
writeFileSync(resolve(here, `results/${stamp}.json`), JSON.stringify({ structure: structureRows, route: routeRows }, null, 2));
writeFileSync(resolve(here, "results/latest.md"), md);
console.log("\n" + lines.slice(0, 8).join("\n"));
console.log(`\nwrote evals/results/${stamp}.md`);
