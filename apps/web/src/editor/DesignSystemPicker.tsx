import { GOOGLE_FONTS, designSystems, type Theme } from "@ui-factory/catalog";
import { AlignJustify, Check, ChevronDown, Menu, Palette, Rows3, Search, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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

type Density = NonNullable<Theme["density"]>;
export const densities: { value: Density; label: string; hint: string; icon: typeof Menu }[] = [
  { value: "relaxed", label: "โปร่ง", hint: "พื้นที่หายใจมาก", icon: Menu },
  { value: "standard", label: "ปกติ", hint: "สมดุล", icon: Rows3 },
  { value: "compact", label: "แน่น", hint: "ข้อมูลมากขึ้น", icon: AlignJustify },
];

export function Swatches({ t, size = 14 }: { t: Theme; size?: number }) {
  return (
    <span className="flex items-center gap-1">
      {[t.border, t.mutedForeground, t.primary, t.foreground].map((c, i) => (
        <span key={i} className="rounded-full" style={{ background: c, width: size, height: size, boxShadow: "inset 0 0 0 1px rgb(0 0 0 / .08)" }} />
      ))}
    </span>
  );
}

export function DensityControl({ disabled }: { disabled: boolean }) {
  const density = useEditor((s) => s.doc?.theme.density ?? "standard");
  return (
    <div className="seg" title="Density: ระยะห่างของ section">
      {densities.map((d) => (
        <button
          key={d.value}
          disabled={disabled}
          className={density === d.value ? "is-on" : ""}
          onClick={() => void runOp("set_theme", { tokens: { density: d.value } })}
        >
          {d.label}
        </button>
      ))}
    </div>
  );
}

export function DesignSystemButton({ disabled }: { disabled: boolean }) {
  const theme = useEditor((s) => s.doc?.theme);
  const [open, setOpen] = useState(false);
  if (!theme) return null;
  const current = designSystems.find((d) => d.id === theme.designSystem);
  return (
    <>
      <button className="btn !h-9 gap-2.5" disabled={disabled} onClick={() => setOpen(true)} title="Design system">
        <span className="max-w-36 truncate">{current?.name ?? "Custom"}</span>
        <Swatches t={theme} />
        <ChevronDown size={14} className="text-[var(--ed-muted)]" />
      </button>
      {open && <DesignSystemModal theme={theme} onClose={() => setOpen(false)} />}
    </>
  );
}

function DesignSystemModal({ theme, onClose }: { theme: Theme; onClose: () => void }) {
  const [pick, setPick] = useState(theme.designSystem ?? designSystems[0].id);
  const [density, setDensity] = useState<Density>(theme.density ?? "standard");
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const categories = useMemo(() => [...new Set(designSystems.map((d) => d.category))], []);
  const list = designSystems.filter(
    (d) => (!cat || d.category === cat) && (!q || `${d.name} ${d.category} ${d.summary}`.toLowerCase().includes(q.toLowerCase())),
  );
  const chosen = designSystems.find((d) => d.id === pick);

  useEffect(() => {
    linkFonts();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    addEventListener("keydown", onKey);
    return () => removeEventListener("keydown", onKey);
  }, [onClose]);

  const apply = async () => {
    if (pick !== theme.designSystem) await runOp("set_theme", { preset: pick });
    if (pick !== theme.designSystem || density !== (theme.density ?? "standard")) await runOp("set_theme", { tokens: { density } });
    onClose();
  };

  return (
    <div className="scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label="Design system">
        <div className="flex items-start gap-3 px-6 pt-5 pb-4">
          <Palette size={26} className="mt-0.5 text-[var(--ed-strong)]" />
          <div>
            <div className="text-[18px] font-semibold text-[var(--ed-strong)]">Design system</div>
            <div className="text-[13px] text-[var(--ed-muted)]">เลือก visual language สำหรับทุกเฟรมในโปรเจกต์</div>
          </div>
          <div className="search ml-auto w-64">
            <Search size={15} />
            <input className="field !h-9" placeholder="ค้นหา design system" value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          <button className="icon-btn" onClick={onClose} title="ปิด"><X size={18} /></button>
        </div>
        <div className="flex flex-wrap gap-2 px-6 pb-4">
          <button className={`chip chip-pill ${cat === null ? "is-on" : ""}`} onClick={() => setCat(null)}>ทั้งหมด</button>
          {categories.map((c) => (
            <button key={c} className={`chip chip-pill ${cat === c ? "is-on" : ""}`} onClick={() => setCat(c)}>{c}</button>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 auto-rows-max grid-cols-4 content-start gap-3 overflow-auto px-6 pb-5">
          {list.map((d) => {
            const on = d.id === pick;
            const inUse = d.id === theme.designSystem;
            return (
              <button key={d.id} onClick={() => setPick(d.id)} className={`card card-hover relative overflow-hidden p-0 text-left ${on ? "is-on" : ""}`}>
                <div className="h-[104px] p-3" style={{ background: d.theme.background, color: d.theme.foreground }}>
                  <Swatches t={d.theme} size={16} />
                  <div className="mt-3 flex items-end justify-between">
                    <span style={{ fontFamily: d.theme.displayFont, fontSize: 30, lineHeight: 1, fontWeight: 600 }}>Aa ก</span>
                    <span
                      className="px-2.5 py-1 text-[11px] font-semibold"
                      style={{ background: d.theme.primary, color: d.theme.primaryForeground, borderRadius: `${Math.min(d.theme.radius, 0.5)}rem` }}
                    >
                      Button
                    </span>
                  </div>
                </div>
                <div className="flex items-center gap-2 border-t border-[var(--ed-border)] px-3 py-2.5">
                  <div className="min-w-0">
                    <div className="truncate font-semibold text-[var(--ed-strong)]">{d.name}</div>
                    <div className="truncate text-[11.5px] text-[var(--ed-muted)]">{d.category}</div>
                  </div>
                  {inUse && <span className="tag ml-auto"><Check size={11} /> กำลังใช้</span>}
                </div>
                {on && (
                  <span className="absolute top-2 right-2 grid size-5 place-items-center rounded-full bg-[var(--ed-brand)] text-white">
                    <Check size={12} strokeWidth={3} />
                  </span>
                )}
              </button>
            );
          })}
          {list.length === 0 && <p className="col-span-4 py-8 text-center text-[var(--ed-muted)]">ไม่พบ design system</p>}
        </div>
        <div className="border-t border-[var(--ed-border)] px-6 py-4">
          <div className="mb-3 flex items-center gap-2.5">
            <Rows3 size={18} />
            <div>
              <div className="font-semibold text-[var(--ed-strong)]">Density</div>
              <div className="text-[12px] text-[var(--ed-muted)]">ระยะห่างของ section และความหนาแน่นของเนื้อหา</div>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            {densities.map((d) => (
              <button key={d.value} onClick={() => setDensity(d.value)} className={`card card-hover flex items-center gap-3 p-3 text-left ${density === d.value ? "is-on !bg-[var(--ed-brand-soft)]" : ""}`}>
                <span className="grid size-9 place-items-center rounded-lg border border-[var(--ed-border)] bg-[var(--ed-panel)] text-[var(--ed-muted)]"><d.icon size={17} /></span>
                <span className="min-w-0 flex-1">
                  <span className={`block font-semibold ${density === d.value ? "text-[var(--ed-brand-ink)]" : "text-[var(--ed-strong)]"}`}>{d.label}</span>
                  <span className="block text-[12px] text-[var(--ed-muted)]">{d.hint}</span>
                </span>
                <span className={`size-4 rounded-full border-2 ${density === d.value ? "border-[var(--ed-brand)] bg-[radial-gradient(var(--ed-brand)_40%,transparent_45%)]" : "border-[var(--ed-border-strong)]"}`} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2 border-t border-[var(--ed-border)] bg-[var(--ed-panel-2)] px-6 py-3.5">
          <span className="text-[11.5px] text-[var(--ed-muted)]">ดัดแปลงจาก design systems ของ open-design (Apache-2.0)</span>
          <button className="btn ml-auto" onClick={onClose}>ยกเลิก</button>
          <button className="btn btn-primary" onClick={() => void apply()}>ใช้ {chosen?.name}</button>
        </div>
      </div>
    </div>
  );
}
