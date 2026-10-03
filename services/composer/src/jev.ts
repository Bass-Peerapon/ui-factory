import {
  experimental_composeSpec,
  type Experimental_CompositionEvaluator,
} from "@json-render/core";
import { catalog, compositionCandidates } from "@ui-factory/catalog";
import { env } from "./env";
import { intents, routeInstructions, routeState, type Composer, type Intent, type RouteInput, type StructureEvent, type StructureInput } from "./types";

interface SystemOneResponse {
  answers: Record<string, { choice: string; confidence?: number }>;
  usage?: { input_tokens?: number };
}

/** Calls TypeSafe's System One endpoint directly (the library evaluator targets Vercel AI Gateway). */
async function systemOne(
  state: unknown,
  questions: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<SystemOneResponse> {
  for (let attempt = 0; ; attempt++) {
    const r = await fetch(`${env("JEV_BASE_URL")}/systemone`, {
      method: "POST",
      headers: { Authorization: `Bearer ${env("JEV_API_KEY")}`, "Content-Type": "application/json" },
      body: JSON.stringify({ model: env("JEV_MODEL"), state, questions }),
      signal,
    });
    if ((r.status === 429 || r.status === 529) && attempt < 3) {
      await new Promise((res) => setTimeout(res, 500 * 2 ** attempt));
      continue;
    }
    if (!r.ok) throw new Error(`jev HTTP ${r.status}: ${(await r.text()).slice(0, 300)}`);
    return (await r.json()) as SystemOneResponse;
  }
}

export const jevEvaluator: Experimental_CompositionEvaluator = async ({ state, questions, signal }) => {
  const res = await systemOne(state, questions, signal);
  const answers = Object.fromEntries(
    Object.entries(questions).map(([name, q]) => {
      const a = res.answers[name];
      if (!a || !Object.hasOwn(q.criteria, a.choice)) throw new Error("Jev returned a choice outside the offered criteria");
      return [name, { choice: a.choice, confidence: a.confidence }];
    }),
  );
  return { answers, usage: { inputTokens: res.usage?.input_tokens } };
};

const candidates = compositionCandidates();

export class JevComposer implements Composer {
  readonly name = "jev" as const;

  async route(input: RouteInput, signal?: AbortSignal) {
    const t0 = performance.now();
    const res = await systemOne(
      routeState(input),
      { intent: { type: "choice", instructions: routeInstructions, criteria: intents } },
      signal,
    );
    const a = res.answers.intent;
    return { intent: a.choice as Intent, confidence: a.confidence ?? null, ms: Math.round(performance.now() - t0) };
  }

  async *structure(input: StructureInput): AsyncGenerator<StructureEvent> {
    const t0 = performance.now();
    for await (const ev of experimental_composeSpec({
      catalog,
      candidates,
      prompt: input.prompt,
      evaluate: jevEvaluator,
      maxElements: input.maxElements ?? 24,
      signal: input.signal,
      instructions: {
        root: "The root is always the Page layout.",
        next:
          "Build a complete, conventional page for the request: usually a Navbar first and a Footer last. " +
          "Put Button primitives into `actions` slots and Input, Textarea or Checkbox primitives into a ContactForm `fields` slot.",
      },
    })) {
      const ms = Math.round(performance.now() - t0);
      if (ev.type === "step") yield { type: "step", spec: ev.spec, ms };
      else yield { type: "complete", spec: ev.spec, stopReason: ev.stopReason, ms, evaluations: ev.steps.length };
    }
  }
}
