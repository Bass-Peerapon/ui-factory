import type { Theme } from "@ui-factory/catalog";

const fonts: Record<Theme["font"], string> = {
  sans: '"IBM Plex Sans Thai", system-ui, sans-serif',
  serif: '"Noto Serif Thai", Georgia, serif',
  mono: '"IBM Plex Mono", "IBM Plex Sans Thai", monospace',
  rounded: '"Mitr", "IBM Plex Sans Thai", system-ui, sans-serif',
};

/** Maps project design tokens onto shadcn/ui CSS variables. */
export function applyTheme(t: Theme) {
  const vars: Record<string, string> = {
    "--background": t.background,
    "--foreground": t.foreground,
    "--primary": t.primary,
    "--primary-foreground": t.primaryForeground,
    "--secondary": t.muted,
    "--secondary-foreground": t.foreground,
    "--muted": t.muted,
    "--muted-foreground": t.mutedForeground,
    "--accent": t.accent,
    "--accent-foreground": t.foreground,
    "--border": t.border,
    "--input": t.border,
    "--ring": t.primary,
    "--radius": `${t.radius}rem`,
    "--font": fonts[t.font],
  };
  const root = document.documentElement.style;
  for (const [k, v] of Object.entries(vars)) root.setProperty(k, v);
}
