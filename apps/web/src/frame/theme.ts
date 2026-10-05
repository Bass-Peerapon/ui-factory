import { GOOGLE_FONTS, fontStacks, type Theme } from "@ui-factory/catalog";

const legacyFonts: Record<Theme["font"], string> = {
  sans: fontStacks.plex,
  serif: fontStacks.notoSerif,
  mono: '"IBM Plex Mono", "IBM Plex Sans Thai", monospace',
  rounded: fontStacks.mitr,
};

// Section spacing tiers (desktop / phone), after open-design's relaxed, standard and compact density.
const density = {
  relaxed: { section: "7rem", sectionSm: "4.5rem", gap: "2rem" },
  standard: { section: "5.5rem", sectionSm: "3.5rem", gap: "1.5rem" },
  compact: { section: "3.5rem", sectionSm: "2.5rem", gap: "1rem" },
};

let fontsLoaded = false;
function loadFonts() {
  if (fontsLoaded) return;
  fontsLoaded = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS.map((f) => `family=${f}`).join("&")}&display=swap`;
  document.head.appendChild(link);
}

/** Maps project design tokens onto shadcn/ui CSS variables. */
export function applyTheme(t: Theme, locale: "th" | "en") {
  loadFonts();
  const body = t.bodyFont ?? legacyFonts[t.font];
  const d = density[t.density ?? "standard"];
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
    "--font": body,
    "--font-display": t.displayFont ?? body,
    "--section-y": d.section,
    "--section-y-sm": d.sectionSm,
    "--gap": d.gap,
  };
  const root = document.documentElement;
  for (const [k, v] of Object.entries(vars)) root.style.setProperty(k, v);
  root.lang = locale;
  root.dataset.ds = t.designSystem ?? "custom";
}
