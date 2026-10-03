import { env } from "./env";

/** Minimal Gemini REST client for structured JSON output. */
export async function geminiJSON<T>(opts: {
  model?: string;
  system: string;
  prompt: string;
  schema: unknown;
  signal?: AbortSignal;
}): Promise<T> {
  const model = opts.model ?? env("GEMINI_FAST_MODEL");
  const body = {
    systemInstruction: { parts: [{ text: opts.system }] },
    contents: [{ role: "user", parts: [{ text: opts.prompt }] }],
    generationConfig: {
      responseMimeType: "application/json",
      responseJsonSchema: opts.schema,
      thinkingConfig: { thinkingLevel: "LOW" },
    },
  };
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-goog-api-key": env("GEMINI_API_KEY") },
      body: JSON.stringify(body),
      signal: opts.signal,
    });
    if ((r.status === 429 || r.status >= 500) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 800 * 2 ** attempt));
      continue;
    }
    if (!r.ok) throw new Error(`gemini ${model} HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    const j = (await r.json()) as { candidates?: { content?: { parts?: { text?: string; thought?: boolean }[] } }[] };
    const text = j.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text ?? "").join("") ?? "";
    return JSON.parse(text) as T;
  }
}
