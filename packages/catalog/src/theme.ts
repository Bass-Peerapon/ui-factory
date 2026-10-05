import { z } from "zod";
import { designSystems } from "./designSystems";
import { fontStacks } from "./fonts";

const fontStack = z.enum(Object.values(fontStacks) as [string, ...string[]]);

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/, "must be #rrggbb");

/** Project-level design tokens. Mapped to shadcn/ui CSS variables by the renderer. */
export const ThemeSchema = z.object({
  primary: hex,
  primaryForeground: hex,
  background: hex,
  foreground: hex,
  muted: hex,
  mutedForeground: hex,
  accent: hex,
  border: hex,
  radius: z.number().min(0).max(1.5).describe("corner radius in rem"),
  font: z.enum(["sans", "serif", "mono", "rounded"]),
  // Added with design systems; optional so older projects stay valid.
  designSystem: z.string().optional(),
  displayFont: fontStack.optional(),
  bodyFont: fontStack.optional(),
  density: z.enum(["relaxed", "standard", "compact"]).optional().describe("section spacing tier"),
});
export type Theme = z.infer<typeof ThemeSchema>;

/** Theme presets are the design systems' themes; `neutral` stays as an alias of shadcn. */
export const themePresets: Record<string, Theme> = {
  neutral: designSystems[0].theme,
  ...Object.fromEntries(designSystems.map((d) => [d.id, d.theme])),
};

export const LocaleSchema = z.enum(["th", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const DEVICES = {
  desktop: { width: 1280, label: "Desktop" },
  tablet: { width: 768, label: "Tablet" },
  mobile: { width: 390, label: "Mobile" },
} as const;
export type Device = keyof typeof DEVICES;
