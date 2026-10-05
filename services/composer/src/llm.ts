import { componentDefs, placeholderProps, type ComponentDef, type ComponentName, type Spec } from "@ui-factory/catalog";
import { pageGuidance } from "./jev";
import { briefQuestions, customPages, deviceCriteria, pagesFromPattern, patternCriteria, sufficientQuestion } from "./planning";
import { geminiJSON } from "./gemini";
import { intents, routeInstructions, routeState, type BriefResult, type PlanResult, type Composer, type Intent, type RouteInput, type StructureEvent, type StructureInput } from "./types";

const names = Object.keys(componentDefs) as ComponentName[];
const blockNames = names.filter((n) => componentDefs[n].kind === "block");
const primitiveNames = names.filter((n) => componentDefs[n].kind === "primitive");
// Block choices are "Type" or "Type.variant", mirroring the Jev candidates.
const blockChoices = blockNames.flatMap((n) => {
  const v = (componentDefs[n] as ComponentDef).variants;
  return v ? v.map((x) => `${n}.${x.value}`) : [n];
});
const catalogText = names
  .filter((n) => componentDefs[n].kind !== "layout")
  .map((n) => {
    const d = componentDefs[n] as ComponentDef;
    const variants = d.variants ? `\n    layouts: ${d.variants.map((v) => `${n}.${v.value} = ${v.description}`).join("; ")}` : "";
    return `- ${n} [${d.kind}]${d.slots ? ` slots=${d.slots.join(",")}` : ""}: ${d.description}${variants}`;
  })
  .join("\n");

interface Layout {
  sections: { type: string; slots?: { name: string; items: string[] }[] }[];
}

const layoutSchema = {
  type: "object",
  properties: {
    sections: {
      type: "array",
      minItems: 1,
      maxItems: 12,
      items: {
        type: "object",
        properties: {
          type: { type: "string", enum: blockChoices },
          slots: {
            type: "array",
            items: {
              type: "object",
              properties: {
                name: { type: "string" },
                items: { type: "array", items: { type: "string", enum: primitiveNames } },
              },
              required: ["name", "items"],
            },
          },
        },
        required: ["type"],
      },
    },
  },
  required: ["sections"],
};

/** LLM-only baseline: Gemini picks blocks, then the skeleton is assembled from catalog placeholders. */
export class LLMComposer implements Composer {
  readonly name = "llm" as const;

  async route(input: RouteInput, signal?: AbortSignal) {
    const t0 = performance.now();
    const r = await geminiJSON<{ intent: Intent }>({
      system: routeInstructions + " Answer with one intent.\n" +
        Object.entries(intents).map(([k, v]) => `- ${k}: ${v}`).join("\n"),
      prompt: JSON.stringify(routeState(input)),
      schema: { type: "object", properties: { intent: { type: "string", enum: Object.keys(intents) } }, required: ["intent"] },
      signal,
    });
    return { intent: r.intent, confidence: null, ms: Math.round(performance.now() - t0) };
  }

  async plan(prompt: string, signal?: AbortSignal): Promise<PlanResult> {
    const t0 = performance.now();
    const r = await geminiJSON<{ pattern: string; device: PlanResult["device"] }>({
      system: "Pick the UX flow pattern and device for the request.\nPatterns:\n" +
        Object.entries(patternCriteria).map(([k, v]) => `- ${k}: ${v}`).join("\n") +
        "\nDevices:\n" + Object.entries(deviceCriteria).map(([k, v]) => `- ${k}: ${v}`).join("\n"),
      prompt,
      schema: {
        type: "object",
        properties: {
          pattern: { type: "string", enum: Object.keys(patternCriteria) },
          device: { type: "string", enum: Object.keys(deviceCriteria) },
        },
        required: ["pattern", "device"],
      },
      signal,
    });
    const pages = r.pattern === "custom" ? await customPages(prompt, signal) : pagesFromPattern(r.pattern, prompt);
    return { pattern: r.pattern, device: r.device, ...pages, confidence: null, ms: Math.round(performance.now() - t0) };
  }

  async brief(prompt: string, signal?: AbortSignal): Promise<BriefResult> {
    const t0 = performance.now();
    const props = Object.fromEntries(
      Object.entries(briefQuestions).map(([k, q]) => [k, { type: "string", enum: Object.keys(q.criteria), description: q.instructions }]),
    );
    const r = await geminiJSON<Record<string, string> & { sufficient: boolean }>({
      system: "Infer sensible defaults for a page brief. `sufficient`: " + sufficientQuestion + "\n" +
        Object.entries(briefQuestions).map(([k, q]) => `${k}: ` + Object.entries(q.criteria).map(([a, b]) => `${a} = ${b}`).join("; ")).join("\n"),
      prompt: JSON.stringify({ request: prompt }),
      schema: { type: "object", properties: { sufficient: { type: "boolean" }, ...props }, required: ["sufficient", ...Object.keys(props)] },
      signal,
    });
    const answers = Object.fromEntries(Object.keys(briefQuestions).map((k) => [k, { value: r[k], confidence: null }])) as BriefResult["answers"];
    return { sufficient: r.sufficient ? 1 : 0, answers, ms: Math.round(performance.now() - t0) };
  }

  async *structure(input: StructureInput): AsyncGenerator<StructureEvent> {
    const t0 = performance.now();
    const layout = await geminiJSON<Layout>({
      system:
        "You plan page layouts for a UI builder. Choose blocks from the catalog in display order. " +
        pageGuidance + " Only use slot names listed for that block.\n\nCatalog:\n" + catalogText,
      prompt: input.prompt,
      schema: layoutSchema,
      signal: input.signal,
    });

    const max = input.maxElements ?? 24;
    const spec: Spec = {
      root: "node_0",
      elements: { node_0: { type: "Page", props: placeholderProps("Page"), children: [] } },
      state: {},
    };
    let n = 1;
    const add = (type: ComponentName, variant?: string) => {
      const id = `node_${n++}`;
      spec.elements[id] = { type, props: { ...placeholderProps(type), ...(variant ? { variant } : {}) }, children: [] };
      return id;
    };
    let stopReason = "finish";
    for (const section of layout.sections) {
      if (n >= max) { stopReason = "limit"; break; }
      const [typeName, variant] = section.type.split(".");
      if (!blockNames.includes(typeName as ComponentName)) continue;
      const type = typeName as ComponentName;
      const id = add(type, variant);
      spec.elements.node_0.children!.push(id);
      const allowed = componentDefs[type].slots ?? [];
      for (const slot of section.slots ?? []) {
        if (!allowed.includes(slot.name)) continue;
        for (const item of slot.items) {
          if (n >= max) break;
          const pid = add(item as ComponentName);
          const el = spec.elements[id];
          el.slots = { ...el.slots, [slot.name]: [...(el.slots?.[slot.name] ?? []), pid] };
        }
      }
      yield { type: "step", spec: structuredClone(spec), ms: Math.round(performance.now() - t0) };
    }
    yield { type: "complete", spec, stopReason, ms: Math.round(performance.now() - t0), evaluations: 1 };
  }
}
