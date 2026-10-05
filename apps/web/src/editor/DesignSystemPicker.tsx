import { GOOGLE_FONTS, designSystems, type Theme } from "@ui-factory/catalog";
import { Check, ChevronDown, Palette } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { runOp } from "./api";
import { useEditor } from "./store";

// Load the fonts once so the picker can preview each system's display face.
let fontsLinked = false;
function linkFonts() {
  if (fontsLinked) return;
  fontsLinked = true;
  const l = document.createElement("link");
  l.rel = "stylesheet";
  l.href = `https://fonts.googleapis.com/css2?${GOOGLE_FONTS.map((f) => `family=${f}`).join("&")}&display=swap`;
  document.head.appendChild(l);
}

const densities: { value: NonNullable<Theme["density"]>; label: string }[] = [
  { value: "relaxed", label: "โปร่ง" },
  { value: "standard", label: "ปกติ" },
  { value: "compact", label: "แน่น" },
];

function Swatches({ t }: { t: Theme }) {
  return (
    <span className="flex overflow-hidden rounded-sm border border-[var(--ed-border)]">
      {[t.background, t.muted, t.foreground, t.primary].map((c, i) => (
        <span key={i} className="h-4 w-3" style={{ background: c }} />
      ))}
    </span>
  );
}

export function DesignSystemPicker({ disabled }: { disabled: boolean }) {
  const theme = useEditor((s) => s.doc?.theme);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const current = designSystems.find((d) => d.id === theme?.designSystem);

  useEffect(() => {
    if (!open) return;
    linkFonts();
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    addEventListener("mousedown", close);
    return () => removeEventListener("mousedown", close);
  }, [open]);

  if (!theme) return null;
  return (
    <div ref={ref} className="relative flex items-center gap-2">
      <button className="btn" disabled={disabled} onClick={() => setOpen(!open)} title="Design system">
        <Palette size={14} />
        <span className="max-w-32 truncate">{current?.name ?? "Custom"}</span>
        <Swatches t={theme} />
        <ChevronDown size={13} />
      </button>
      <div className="flex overflow-hidden rounded-md border border-[var(--ed-border)]" title="Density: ระยะห่างของ section">
        {densities.map((d) => (
          <button
            key={d.value}
            disabled={disabled}
            onClick={() => void runOp("set_theme", { tokens: { density: d.value } })}
            className={`h-7 border-0 px-2 text-[12px] ${
              (theme.density ?? "standard") === d.value ? "bg-[var(--ed-text)] text-[var(--ed-panel)]" : "bg-[var(--ed-panel)] text-[var(--ed-muted)]"
            }`}
          >
            {d.label}
          </button>
        ))}
      </div>
      {open && (
        <div className="panel absolute top-9 left-0 z-50 grid w-[640px] grid-cols-3 gap-2 rounded-xl border p-3 shadow-xl">
          {designSystems.map((d) => {
            const active = d.id === theme.designSystem;
            return (
              <button
                key={d.id}
                onClick={() => {
                  void runOp("set_theme", { preset: d.id });
                  setOpen(false);
                }}
                className={`relative overflow-hidden rounded-lg border p-0 text-left transition ${
                  active ? "border-[var(--ed-accent)] ring-2 ring-[var(--ed-accent)]/30" : "border-[var(--ed-border)] hover:border-[var(--ed-muted)]"
                }`}
              >
                <div className="flex h-20 items-end justify-between p-3" style={{ background: d.theme.background, color: d.theme.foreground }}>
                  <span style={{ fontFamily: d.theme.displayFont, fontSize: 28, lineHeight: 1, fontWeight: 600 }}>Aa ก</span>
                  <span
                    className="rounded px-2 py-1 text-[11px] font-semibold"
                    style={{ background: d.theme.primary, color: d.theme.primaryForeground, borderRadius: `${d.theme.radius}rem` }}
                  >
                    Button
                  </span>
                </div>
                <div className="space-y-0.5 border-t border-[var(--ed-border)] p-2.5">
                  <div className="flex items-center gap-1.5 font-semibold">
                    {d.name}
                    {active && <Check size={13} className="text-[var(--ed-accent)]" />}
                  </div>
                  <div className="line-clamp-2 text-[11px] leading-snug text-[var(--ed-muted)]">{d.summary}</div>
                </div>
              </button>
            );
          })}
          <p className="col-span-3 px-1 pt-1 text-[11px] text-[var(--ed-muted)]">
            ดัดแปลงจาก design systems ของ open-design (Apache-2.0)
          </p>
        </div>
      )}
    </div>
  );
}
