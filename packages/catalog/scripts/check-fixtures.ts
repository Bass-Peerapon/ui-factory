// Validates hand-written fixture specs against the catalog.
import { readdirSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalog } from "../src/index";

const dir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures");
let failed = 0;
for (const f of readdirSync(dir).filter((f) => f.endsWith(".json"))) {
  const r = catalog.validate(JSON.parse(readFileSync(resolve(dir, f), "utf8")));
  console.log(r.success ? "ok  " : "FAIL", f);
  if (!r.success) { failed++; console.log(JSON.stringify(r.error?.issues ?? r, null, 2).slice(0, 2000)); }
}
process.exit(failed ? 1 : 0);
