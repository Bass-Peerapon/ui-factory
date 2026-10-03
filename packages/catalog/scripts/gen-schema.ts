// Generates JSON Schema from the Zod catalog (the source of truth) for the Go API.
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { catalogJsonSchema } from "../src/index";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../../..");
const out = JSON.stringify(catalogJsonSchema(), null, 2) + "\n";
for (const target of [
  "packages/catalog/schema/catalog.schema.json",
  "services/api/internal/catalog/catalog.schema.json",
]) {
  const file = resolve(root, target);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, out);
  console.log("wrote", target);
}
