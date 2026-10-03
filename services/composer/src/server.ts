import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { catalog } from "@ui-factory/catalog";
import { env, loadEnv } from "./env";
import { createComposer } from "./index";

loadEnv();
const defaultMode = env("COMPOSER_MODE", "jev");
const composers = { jev: createComposer("jev"), llm: createComposer("llm") };
const pick = (mode?: string) => composers[(mode ?? defaultMode) === "llm" ? "llm" : "jev"];

async function readJSON(req: IncomingMessage): Promise<Record<string, any>> {
  let body = "";
  for await (const chunk of req) body += chunk;
  return body ? JSON.parse(body) : {};
}

function send(res: ServerResponse, status: number, data: unknown) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(data));
}

const server = createServer(async (req, res) => {
  const ac = new AbortController();
  res.on("close", () => ac.abort());
  try {
    if (req.method === "GET" && req.url === "/health") return send(res, 200, { ok: true, mode: defaultMode });

    if (req.method === "POST" && req.url === "/route") {
      const b = await readJSON(req);
      const r = await pick(b.mode).route(
        { prompt: String(b.prompt), selection: String(b.selection ?? "nothing"), frameHasContent: !!b.frameHasContent },
        ac.signal,
      );
      return send(res, 200, { ...r, composer: pick(b.mode).name });
    }

    if (req.method === "POST" && req.url === "/structure") {
      const b = await readJSON(req);
      res.writeHead(200, { "Content-Type": "application/x-ndjson" });
      try {
        for await (const ev of pick(b.mode).structure({ prompt: String(b.prompt), maxElements: b.maxElements, signal: ac.signal })) {
          if (ev.type === "complete" && ev.spec) {
            const v = catalog.validate(ev.spec) as { success: boolean; error?: { issues?: unknown } };
            res.write(JSON.stringify({ ...ev, valid: v.success, issues: v.success ? undefined : v.error?.issues }) + "\n");
          } else {
            res.write(JSON.stringify(ev) + "\n");
          }
        }
      } catch (e) {
        res.write(JSON.stringify({ type: "error", error: (e as Error).message }) + "\n");
      }
      return res.end();
    }
    send(res, 404, { error: "not found" });
  } catch (e) {
    if (!res.headersSent) send(res, 500, { error: (e as Error).message });
    else res.end();
  }
});

const port = Number(env("COMPOSER_PORT", "8081"));
server.listen(port, () => console.log(`composer listening on :${port} (default mode ${defaultMode})`));
