# Third-party notices

## nexu-io/open-design

- Source: https://github.com/nexu-io/open-design (commit `53231d4`, 2026-09-30)
- License: Apache License 2.0, copy at [third_party/open-design/LICENSE](third_party/open-design/LICENSE)

Portions of UI Factory are adapted from open-design. No source files were copied verbatim. What was adapted and changed:

| Our file | Adapted from | Changes |
|---|---|---|
| `packages/catalog/src/designSystems.ts` | `design-systems/{shadcn,vercel,clean,editorial,warm-editorial,dashboard,corporate,friendly,luxury,neobrutalism,publication,linear-app}/tokens.css` and `DESIGN.md` | Token values mapped onto a shadcn-style theme, rgba borders flattened to hex, dashboard and friendly accents darkened for white-text contrast, Thai-capable font stacks added, posture rules rewritten and shortened |
| `services/api/internal/lint/lint.go` | `craft/anti-ai-slop.md`, `apps/daemon/src/lint-artifact.ts` (rule ideas) | Re-implemented for json-render props: filler copy, emoji, invented hype metrics (with Thai patterns), copy length budgets, one solid button per slot |
| `services/api/internal/pipeline/fill.go` (`fillSystem`), `services/composer/src/jev.ts` (`pageGuidance`) | `craft/anti-ai-slop.md`, `craft/color.md`, `craft/typography.md` | Condensed into short prompt rules for content fill and page composition |
| `apps/web/src/frame/frame.css`, `apps/web/src/frame/theme.ts` | `craft/typography.md`, `od-next-strategy/.../task-profiles/prototype.md` (density tiers) | Type rules applied as CSS, CJK leading overrides extended to Thai, density tiers mapped to section spacing variables |
| `apps/web/src/editor/DesignSystemPicker.tsx` | `apps/web/src/components/DesignSystemPicker.tsx`, `DirectionCardsPicker` (UX only) | New implementation; only the interaction pattern (cards with swatches and a type sample) was followed |

## pbakaus/impeccable

- Source: https://github.com/pbakaus/impeccable (main, cloned 2026-10-06)
- License: Apache License 2.0, copy at [third_party/impeccable/LICENSE](third_party/impeccable/LICENSE)

No source files were copied. Rules were re-implemented for a catalog-based renderer; the detector is run unmodified through `npx impeccable detect`.

| Our file | Adapted from | Changes |
|---|---|---|
| `packages/catalog/src/normalize.ts` (`craftSpec`), `services/api/internal/pipeline/critique.go` | `skill/reference/craft-floor.md` (identical card grids, hero-metric, eyebrow ban, spacing rhythm), `mode-persuade.md`, `mode-operate.md` | Applied to block order and props of a json-render spec instead of HTML; findings written in Thai with an edit prompt |
| `services/composer/src/planning.ts`, `jev.ts` (`pageGuidance`), `apps/web/src/editor/Chat.tsx` | `skill/reference/new-work.md`, `mode-*.md` (persuade / operate / read) | Mode became one Jev choice question in the brief form |
| `services/api/internal/pipeline/fill.go` (`fillSystem`) | `craft-floor.md` (copy), `clarify.md` | Condensed into prompt rules |
| `apps/web/src/frame/frame.css`, `blocks-shared.tsx` (`Photo`) | `craft-floor.md` (browser surfaces, real imagery or none, one elevation) | Written as CSS and a flat placeholder that names the intended photo |
| `packages/catalog/src/designSystems.ts` | detector rule `low-contrast` | Primary and muted-foreground darkened on the same hue to pass 4.5:1 |
| `scripts/design-audit.mjs` | `impeccable detect --json` | Wrapper that renders fixtures or project frames and summarizes findings |

open-design notes that its craft files are themselves adapted from [refero_skill](https://github.com/referodesign/refero_skill) (MIT).
