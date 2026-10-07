// Every design system keeps text readable on its own surfaces (WCAG AA 4.5:1), the floor impeccable's
// detector checks on rendered frames (rule low-contrast).
import { designSystems } from "../src/index";

const lum = (hex: string) => {
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const f = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b);
};
const ratio = (a: string, b: string) => {
  const [x, y] = [lum(a), lum(b)].sort((m, n) => n - m);
  return (x + 0.05) / (y + 0.05);
};

let failed = 0;
for (const { id, theme: t } of designSystems) {
  const pairs: [string, string, string][] = [
    ["mutedForeground on background", t.mutedForeground, t.background],
    ["mutedForeground on muted", t.mutedForeground, t.muted],
    ["mutedForeground on accent", t.mutedForeground, t.accent],
    ["primaryForeground on primary", t.primaryForeground, t.primary],
    ["foreground on background", t.foreground, t.background],
  ];
  if (lum(t.background) > 0.5) pairs.push(["primary on background", t.primary, t.background]);
  for (const [name, fg, bg] of pairs) {
    const r = ratio(fg, bg);
    if (r < 4.5) {
      failed++;
      console.log(`FAIL ${id}: ${name} ${r.toFixed(2)}:1`);
    }
  }
}
if (failed) process.exit(1);
console.log(`ok   contrast (${designSystems.length} design systems)`);
