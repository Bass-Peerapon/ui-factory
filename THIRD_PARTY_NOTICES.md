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

open-design notes that its craft files are themselves adapted from [refero_skill](https://github.com/referodesign/refero_skill) (MIT).
