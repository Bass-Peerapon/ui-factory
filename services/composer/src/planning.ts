import { designSystems, flowPatternById, flowPatterns } from "@ui-factory/catalog";
import { geminiJSON } from "./gemini";
import type { BriefResult, PlanPage, PlanResult } from "./types";

export const deviceCriteria = {
  desktop: "a website or web app used on a computer",
  tablet: "an app for tablets or kiosks",
  mobile: "a phone app or mobile-first screens",
};

export const patternCriteria: Record<string, string> = {
  ...Object.fromEntries(flowPatterns.map((p) => [p.id, `${p.name}: ${p.description}`])),
  custom: "None of these patterns fits; the request lists its own set of screens.",
};

export const briefQuestions = {
  pageType: {
    instructions: "What kind of page does `request` ask for?",
    criteria: {
      landing: "marketing or landing page for a product, service or business",
      pricing: "pricing or plans page",
      signup: "sign-in, sign-up or account form",
      dashboard: "app dashboard or back-office screen with data",
      shop: "online shop, product listing or product detail",
      content: "blog, article, news or documentation",
      event: "event, seminar or registration page",
      portfolio: "portfolio, agency or personal brand page",
      booking: "booking, reservation or appointment page",
    },
  },
  // Impeccable's surface modes (pbakaus/impeccable, skill/reference/mode-persuade.md, mode-operate.md, mode-read.md).
  mode: {
    instructions: "What is the page in `request` for?",
    criteria: {
      persuade: "convince a visitor to act: marketing, landing, pricing, shop, event, booking or portfolio pages",
      operate: "get a task done: sign-in, forms, dashboards, back office, settings and app screens",
      read: "read or look something up: articles, documentation, news, menus or policies",
    },
  },
  tone: {
    instructions: "Which tone fits the business in `request`?",
    criteria: {
      formal: "formal and trustworthy (finance, government, enterprise, health)",
      friendly: "friendly and warm (local shops, education, community)",
      premium: "premium and refined (luxury, hospitality, fashion, design)",
      playful: "playful and energetic (kids, games, food, lifestyle)",
      technical: "precise and technical (developer tools, SaaS, data)",
    },
  },
  density: {
    instructions: "How dense should the layout be for `request`?",
    criteria: {
      relaxed: "airy, lots of whitespace (brands, editorial, premium)",
      standard: "balanced (most marketing pages)",
      compact: "information dense (dashboards, admin, data tools)",
    },
  },
  designSystem: {
    instructions: "Which visual design system suits the business in `request`?",
    criteria: Object.fromEntries(designSystems.map((d) => [d.id, `${d.name}: ${d.summary}`])),
  },
  platform: { instructions: "Which device is `request` designed for?", criteria: deviceCriteria },
} as const;

export const sufficientQuestion =
  "Does `request` say what the page is for and what it must contain, so a designer could start without asking questions?";

/** Expands a chosen pattern into concrete pages that carry the user's request as context. */
export function pagesFromPattern(id: string, prompt: string): Pick<PlanResult, "pages" | "links"> {
  const p = flowPatternById[id];
  return {
    pages: p.pages.map((pg) => ({ key: pg.key, name: pg.name, brief: `${pg.brief} Context: ${prompt}` })),
    links: p.links,
  };
}

/** Custom flows: Gemini lists the screens; links follow the listed order. */
export async function customPages(prompt: string, signal?: AbortSignal): Promise<Pick<PlanResult, "pages" | "links">> {
  const r = await geminiJSON<{ pages: PlanPage[] }>({
    system:
      "Split the request into the screens of one connected product flow (2 to 6 screens, in user order). " +
      "For each give a short key (kebab-case), a short screen name in the request's language, and a composition brief in English naming the sections it needs. " +
      "Marketing screens use Navbar and Footer; app screens skip Footer.",
    prompt,
    schema: {
      type: "object",
      properties: {
        pages: {
          type: "array",
          minItems: 2,
          maxItems: 6,
          items: {
            type: "object",
            properties: { key: { type: "string" }, name: { type: "string" }, brief: { type: "string" } },
            required: ["key", "name", "brief"],
          },
        },
      },
      required: ["pages"],
    },
    signal,
  });
  const pages = r.pages.map((p, i) => ({ ...p, key: p.key || `screen-${i + 1}`, brief: `${p.brief} Context: ${prompt}` }));
  return { pages, links: pages.slice(1).map((p, i) => [pages[i].key, p.key] as [string, string]) };
}

export type { BriefResult };
