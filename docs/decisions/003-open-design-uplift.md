# 003: ยกระดับคุณภาพ UI ตามแนวทาง open-design โดยคง catalog + Jev

วันที่ 2026-10-05 · สถานะ: Phase 1 เสร็จ

## ที่มา

ผู้ใช้ต้องการคุณภาพ UI แบบ nexu-io/open-design เฉพาะส่วน generate UI ผมเสนอ 3 ทาง (HTML อิสระแบบ open-design, catalog เดิมแล้วยกระดับ, hybrid) ผู้ใช้เลือก **catalog เดิมแล้วยกระดับ** และใช้ design system ที่คัดมา 12 ชุด

open-design ให้ model เขียน HTML ทั้งหน้า คุณภาพมาจากกฎ craft, design system ในรูป token contract และ linter (ดู `THIRD_PARTY_NOTICES.md`)

## Phase 1 ที่ทำ

| เรื่อง | ทำอะไร |
|---|---|
| Design systems | 12 ชุดใน `packages/catalog/src/designSystems.ts` theme มี `designSystem`, `displayFont`, `bodyFont`, `density` (optional เพื่อให้โปรเจกต์เก่ายังผ่าน schema) |
| Typography | display/body font แยกกัน, ใช้ 3 น้ำหนัก, หัวข้อภาษาอังกฤษใช้ negative tracking ส่วนภาษาไทยใช้ leading 1.35 ถึง 1.45 และไม่มี tracking (ขยายกฎ CJK ของ open-design มาใช้กับไทย) |
| Accent discipline | icon, ตัวเลข และ check mark เปลี่ยนเป็นสี neutral เหลือ accent ไว้ที่ปุ่มหลักและ eyebrow |
| Layout variants | Hero 4 แบบ, FeatureGrid 3, Testimonials 2, CTA 3 เป็น candidate แยกที่ใช้ `resource` ร่วมกัน Jev เลือก layout ได้ |
| Page guidance | Jev และ llm ได้กฎว่าไม่ใช้โครง Hero, Features, Pricing, FAQ, CTA ซ้ำทุกหน้า และต้องมี section ที่แปลกออกไปอย่างน้อยหนึ่งอัน |
| Fill prompt | กฎการเขียน, budget ความยาวต่อ prop และกฎท่าทีของ design system |
| Linter | `internal/lint` ตรวจ filler, emoji, hype metric, ความยาวเกิน ถ้าเจอจะ retry พร้อม feedback และถ้ายังไม่ผ่านใช้ผลที่ผ่าน schema แทน skeleton ปุ่มทึบเกิน 1 ต่อ slot จะถูกลดเป็น outline แบบ deterministic |
| Normalize | Banner และ Navbar อยู่บนสุด ส่วน Footer อยู่ล่างสุดเสมอ |

## ผลวัด (eval 1 รอบ, `evals/results/2026-10-05T07-53-32.md`)

- Jev ผ่าน validation ดิบ 10/10 (เดิม 18/20) median 765 ms
- ทั้ง 10 หน้าของ Jev มี section ที่ไม่ใช่โครง template เช่น ImageText, Steps, Quote, Timeline, ContactInfo
- ข้อจำกัดใหม่: Jev วาง Footer ก่อน section ที่เพิ่มท้ายใน 6/10 หน้า normalize ซ่อมให้แล้ว และ eval รอบถัดไปจะนับเป็นปัญหาของผลดิบ

## ผลกระทบ

- props ของ Hero เปลี่ยน (`align` และ `showImage` ถูกแทนด้วย `variant`) DB ทดสอบเดิมย้ายไปที่ `data/ui-factory.v1-backup.db`
- preset theme เดิม (neutral, coffee, ocean, forest, midnight) ถูกแทนด้วย design system โดย `neutral` ยังเป็น alias ของ shadcn
