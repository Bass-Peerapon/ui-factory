import { z } from "zod";

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
});
export type Theme = z.infer<typeof ThemeSchema>;

export const themePresets: Record<string, Theme> = {
  neutral: {
    primary: "#18181b", primaryForeground: "#fafafa", background: "#ffffff", foreground: "#09090b",
    muted: "#f4f4f5", mutedForeground: "#71717a", accent: "#f4f4f5", border: "#e4e4e7", radius: 0.5, font: "sans",
  },
  coffee: {
    primary: "#6f4e37", primaryForeground: "#fff8f0", background: "#fffaf5", foreground: "#2b1d14",
    muted: "#f3e9df", mutedForeground: "#7a6455", accent: "#e8d5c4", border: "#e6d8cb", radius: 0.75, font: "serif",
  },
  ocean: {
    primary: "#0369a1", primaryForeground: "#f0f9ff", background: "#ffffff", foreground: "#0c1a26",
    muted: "#eff6fb", mutedForeground: "#55707f", accent: "#e0f2fe", border: "#d6e6f0", radius: 0.6, font: "sans",
  },
  forest: {
    primary: "#15803d", primaryForeground: "#f0fdf4", background: "#fbfdfb", foreground: "#0f1f14",
    muted: "#ecf5ee", mutedForeground: "#5b7262", accent: "#dcfce7", border: "#d5e6da", radius: 1, font: "rounded",
  },
  midnight: {
    primary: "#a78bfa", primaryForeground: "#1e1b2e", background: "#0f0e17", foreground: "#ece9f7",
    muted: "#1d1b2b", mutedForeground: "#a19cb8", accent: "#2a2640", border: "#2e2a44", radius: 0.5, font: "sans",
  },
};

export const LocaleSchema = z.enum(["th", "en"]);
export type Locale = z.infer<typeof LocaleSchema>;

export const DEVICES = {
  desktop: { width: 1280, label: "Desktop" },
  tablet: { width: 768, label: "Tablet" },
  mobile: { width: 390, label: "Mobile" },
} as const;
export type Device = keyof typeof DEVICES;
