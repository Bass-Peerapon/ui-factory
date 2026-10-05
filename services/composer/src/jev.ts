import {
  experimental_composeSpec,
  type Experimental_CompositionEvaluator,
} from "@json-render/core";
import { catalog, compositionCandidates } from "@ui-factory/catalog";
import { env } from "./env";
import { briefQuestions, customPages, deviceCriteria, pagesFromPattern, patternCriteria, sufficientQuestion } from "./planning";
import { intents, routeInstructions, routeState, type BriefResult, type PlanResult, type Composer, type Intent, type RouteInput, type StructureEvent, type StructureInput } from "./types";

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

type RawAnswer = { choice: string; confidence?: number; noul?: number };
const fetchSystemOneRaw = (state: unknown, questions: Record<string, unknown>, signal?: AbortSignal) =>
  systemOne(state, questions, signal) as unknown as Promise<{ answers: Record<string, RawAnswer> }>;

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

/** Page-composition guidance; the anti-template rule follows open-design's craft/anti-ai-slop.md. */
export const pageGuidance =
  "Build a focused page for the request with only the sections it needs. Marketing pages start with a Navbar and end with a Footer (4 to 7 sections in between). " +
  "Pick the layout variant that fits the domain. Avoid the default template rhythm Hero, FeatureGrid, Pricing, FAQ, CTA; " +
  "include at least one distinctive section that suits the content, such as ImageText, Steps, Quote, LogoCloud, Gallery, Timeline or ComparisonTable. " +
  "App screens (sign-in, sign-up, confirmations, dashboards, forms, settings) are not marketing pages: no Footer, no Hero, no marketing sections; dashboards and admin screens may start with a Navbar. " +
  "Put Button primitives into `actions` slots and Input, Textarea or Checkbox primitives into `fields` slots.";

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

  async plan(prompt: string, signal?: AbortSignal): Promise<PlanResult> {
    const t0 = performance.now();
    const res = await systemOne(
      { request: prompt },
      {
        pattern: { type: "choice", instructions: "Which UX flow pattern does `request` describe?", criteria: patternCriteria },
        device: { type: "choice", instructions: "Which device is `request` designed for?", criteria: deviceCriteria },
      },
      signal,
    );
    const pattern = res.answers.pattern.choice;
    const pages = pattern === "custom" ? await customPages(prompt, signal) : pagesFromPattern(pattern, prompt);
    return {
      pattern,
      device: res.answers.device.choice as PlanResult["device"],
      ...pages,
      confidence: res.answers.pattern.confidence ?? null,
      ms: Math.round(performance.now() - t0),
    };
  }

  /** One Jev call answers every clarify question, giving the form its recommended defaults. */
  async brief(prompt: string, signal?: AbortSignal): Promise<BriefResult> {
    const t0 = performance.now();
    const questions: Record<string, unknown> = {
      sufficient: { type: "noul", instructions: sufficientQuestion },
      ...Object.fromEntries(Object.entries(briefQuestions).map(([k, q]) => [k, { type: "choice", ...q }])),
    };
    const r = await fetchSystemOneRaw({ request: prompt }, questions, signal);
    const answers = Object.fromEntries(
      Object.keys(briefQuestions).map((k) => [k, { value: r.answers[k].choice, confidence: r.answers[k].confidence ?? null }]),
    ) as BriefResult["answers"];
    return { sufficient: r.answers.sufficient.noul ?? 0, answers, ms: Math.round(performance.now() - t0) };
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
        next: pageGuidance,
      },
    })) {
      const ms = Math.round(performance.now() - t0);
      if (ev.type === "step") yield { type: "step", spec: ev.spec, ms };
      else yield { type: "complete", spec: ev.spec, stopReason: ev.stopReason, ms, evaluations: ev.steps.length };
    }
  }
}
