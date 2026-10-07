// Design systems adapted from nexu-io/open-design (Apache-2.0), design-systems/<id>/tokens.css and DESIGN.md.
// Changes: token values mapped onto our shadcn-style theme, rgba borders flattened to hex on the
// background, Thai-capable font stacks added, posture rules condensed. See THIRD_PARTY_NOTICES.md.
// Primary and muted-foreground were later darkened (same hue) until they pass WCAG AA 4.5:1 on every
// surface, after impeccable's detector flagged them; scripts/check-contrast.ts keeps them there.
// Shadcn (the default system) and Linear set type in IBM Plex instead of Geist and Inter, which impeccable's
// detector flags as overused (rule overused-font); Vercel keeps Geist because the face is the brand.
import { fontStacks as stack } from "./fonts";
import type { Theme } from "./theme";

export interface DesignSystem {
  id: string;
  name: string;
  category: string;
  /** One line shown in the picker. */
  summary: string;
  /** Posture rules appended to the Fill and Edit prompts. */
  rules: string[];
  theme: Theme;
}

const ds = (d: DesignSystem) => d;

export const designSystems: DesignSystem[] = [
  ds({
    id: "shadcn", name: "Shadcn", category: "Modern & Minimal",
    summary: "Monochrome, utility-first, black primary on white",
    rules: [
      "Monochrome UI: hierarchy comes from weight and size, not color.",
      "Primary buttons are solid near-black; every other action is outline or ghost.",
      "Thin 1px borders and subtle elevation; no gradients.",
    ],
    theme: {
      designSystem: "shadcn", primary: "#111111", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#111827",
      muted: "#f5f5f5", mutedForeground: "#606f86", accent: "#f4f4f5", border: "#e5e7eb", radius: 0.5,
      font: "sans", displayFont: stack.plex, bodyFont: stack.plex, density: "standard",
    },
  }),
  ds({
    id: "vercel", name: "Vercel", category: "Developer Tools",
    summary: "Stark black and white with a precise blue link color",
    rules: [
      "Large tight headlines over generous white space; content speaks for itself.",
      "Accent blue only for one primary action or link per screen.",
      "Use grids with hairline dividers instead of cards with shadows.",
    ],
    theme: {
      designSystem: "vercel", primary: "#000000", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#0a0a0a",
      muted: "#fafafa", mutedForeground: "#666666", accent: "#f2f2f2", border: "#eaeaea", radius: 0.375,
      font: "sans", displayFont: stack.geist, bodyFont: stack.geist, density: "relaxed",
    },
  }),
  ds({
    id: "clean", name: "Clean", category: "Modern & Minimal",
    summary: "Ample whitespace, limited palette, legible type",
    rules: [
      "Reduce visual clutter: at most one decorative element per section.",
      "Neutral grey surfaces separate sections; the accent stays near-black.",
      "Favour short copy and clear labels over long descriptions.",
    ],
    theme: {
      designSystem: "clean", primary: "#111111", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#111111",
      muted: "#f7f7f7", mutedForeground: "#6c6c6c", accent: "#f0f0f0", border: "#d9d9d9", radius: 0.5,
      font: "sans", displayFont: stack.anuphan, bodyFont: stack.anuphan, density: "relaxed",
    },
  }),
  ds({
    id: "editorial", name: "Editorial", category: "Creative & Artistic",
    summary: "Magazine serif typography on warm paper",
    rules: [
      "Serif display headlines with a clear reading rhythm; body copy reads like an article.",
      "Rust accent sparingly: one kicker or one CTA per screen.",
      "Structured grids, pull quotes and generous section spacing.",
    ],
    theme: {
      designSystem: "editorial", primary: "#9a5a2f", primaryForeground: "#ffffff", background: "#fbf7f0", foreground: "#1f1a16",
      muted: "#f3ece1", mutedForeground: "#6f645c", accent: "#efe6d8", border: "#ded3c5", radius: 0.5,
      font: "serif", displayFont: stack.notoSerif, bodyFont: stack.sarabun, density: "relaxed",
    },
  }),
  ds({
    id: "warm-editorial", name: "Warm Editorial", category: "Starter",
    summary: "Soft cream surfaces, serif headlines, rounded corners",
    rules: [
      "Warm, human tone in copy; avoid corporate jargon.",
      "Serif headlines with sans body; rounded generous cards.",
      "One warm accent; neutrals carry most of the page.",
    ],
    theme: {
      designSystem: "warm-editorial", primary: "#9b5b32", primaryForeground: "#ffffff", background: "#fbf6ee", foreground: "#201914",
      muted: "#f4ece0", mutedForeground: "#6f635a", accent: "#efe4d4", border: "#ded2c3", radius: 1,
      font: "serif", displayFont: stack.trirong, bodyFont: stack.anuphan, density: "relaxed",
    },
  }),
  ds({
    id: "dashboard", name: "Dashboard", category: "Professional & Corporate",
    summary: "Data-dense product UI with a sky-blue signal color",
    rules: [
      "Information density is the feature: compact spacing, tabular numbers, no decoration.",
      "Sky accent marks only the current state or the primary action.",
      "Use semantic colors (success, danger) for data, never for decoration.",
    ],
    theme: {
      designSystem: "dashboard", primary: "#0275b1", primaryForeground: "#ffffff", background: "#f4f7fb", foreground: "#111827",
      muted: "#eaf0f7", mutedForeground: "#5c6b81", accent: "#e6eef8", border: "#d8e2ee", radius: 0.75,
      font: "sans", displayFont: stack.chakra, bodyFont: stack.plex, density: "compact",
    },
  }),
  ds({
    id: "corporate", name: "Corporate", category: "Professional & Corporate",
    summary: "Trustworthy enterprise blue, structured grids",
    rules: [
      "Structured, predictable layouts; proof (logos, numbers, case studies) near the top.",
      "Blue accent for the primary action only; secondary actions are outline.",
      "Formal but plain-language copy; no hype adjectives.",
    ],
    theme: {
      designSystem: "corporate", primary: "#2563eb", primaryForeground: "#ffffff", background: "#f5f8ff", foreground: "#101828",
      muted: "#eaf0fb", mutedForeground: "#5f697e", accent: "#e3ebfb", border: "#d7e0ef", radius: 1,
      font: "sans", displayFont: stack.baiJamjuree, bodyFont: stack.plex, density: "standard",
    },
  }),
  ds({
    id: "friendly", name: "Friendly", category: "Creative & Artistic",
    summary: "Playful orange on sunny cream, very rounded",
    rules: [
      "Conversational, upbeat microcopy with specific verbs.",
      "Rounded shapes and soft surfaces; orange only for the main action.",
      "Illustration-like placeholders are fine; keep text short and warm.",
    ],
    theme: {
      designSystem: "friendly", primary: "#c2490a", primaryForeground: "#ffffff", background: "#fff8d7", foreground: "#1d1836",
      muted: "#fff1b8", mutedForeground: "#6f6587", accent: "#ffeeb0", border: "#eadfba", radius: 1.25,
      font: "rounded", displayFont: stack.mitr, bodyFont: stack.anuphan, density: "standard",
    },
  }),
  ds({
    id: "luxury", name: "Luxury", category: "Professional & Corporate",
    summary: "Near-black canvas, gold accent, high-contrast serif",
    rules: [
      "Dark, quiet canvas; let large serif headlines and space create the premium feel.",
      "Gold accent at most twice per screen; never as large fills.",
      "Few words per section; evocative, specific copy.",
    ],
    theme: {
      designSystem: "luxury", primary: "#c6a15b", primaryForeground: "#080706", background: "#0f0e0c", foreground: "#fff8ea",
      muted: "#151310", mutedForeground: "#9f927c", accent: "#1c1915", border: "#3a3020", radius: 0.875,
      font: "serif", displayFont: stack.playfair, bodyFont: stack.sarabun, density: "relaxed",
    },
  }),
  ds({
    id: "neobrutalism", name: "Neobrutalism", category: "Bold & Expressive",
    summary: "Heavy type, hard borders, vivid orange on warm yellow",
    rules: [
      "Bold, chunky display type and thick borders; flat colors, no gradients.",
      "High contrast and raw layouts; one vivid accent.",
      "Short punchy copy.",
    ],
    theme: {
      designSystem: "neobrutalism", primary: "#c1451d", primaryForeground: "#ffffff", background: "#fff4cf", foreground: "#2a1810",
      muted: "#fffaf0", mutedForeground: "#83614d", accent: "#ffe9a8", border: "#2a1810", radius: 0.25,
      font: "sans", displayFont: stack.kanit, bodyFont: stack.prompt, density: "standard",
    },
  }),
  ds({
    id: "publication", name: "Publication", category: "Creative & Artistic",
    summary: "Print-inspired, square corners, red accent",
    rules: [
      "Editorial grid with strong typographic contrast between headline and body.",
      "Square corners everywhere; rules and dividers instead of cards.",
      "Red accent for one kicker or link per screen.",
    ],
    theme: {
      designSystem: "publication", primary: "#c1121f", primaryForeground: "#ffffff", background: "#ffffff", foreground: "#0b0b0b",
      muted: "#f6f6f6", mutedForeground: "#666666", accent: "#efefef", border: "#d6d6d6", radius: 0,
      font: "serif", displayFont: stack.kanit, bodyFont: stack.taviraj, density: "standard",
    },
  }),
  ds({
    id: "linear-app", name: "Linear (dark)", category: "Productivity & SaaS",
    summary: "Dark-mode precision, luminance hierarchy, indigo signal",
    rules: [
      "Dark canvas; hierarchy through text luminance (bright headline, dim body).",
      "Hairline borders and subtle surfaces instead of shadows.",
      "Indigo accent only for the primary action and one highlight.",
    ],
    theme: {
      designSystem: "linear-app", primary: "#5e6ad2", primaryForeground: "#ffffff", background: "#08090a", foreground: "#f7f8f8",
      muted: "#191a1b", mutedForeground: "#8a8f98", accent: "#1c1d1f", border: "#1d1e20", radius: 0.5,
      font: "sans", displayFont: stack.plex, bodyFont: stack.plex, density: "standard",
    },
  }),
];

export const designSystemById = Object.fromEntries(designSystems.map((d) => [d.id, d]));
