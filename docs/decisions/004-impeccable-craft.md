# 004: นำกฎ craft ของ impeccable มาใช้กับ pipeline แบบ catalog

วันที่ 2026-10-06 · สถานะ: เสร็จ

## ที่มา

ผู้ใช้เห็นว่า UI ที่ generate ลง canvas ยังไม่สวยพอ และอยากรู้ว่าใช้ [pbakaus/impeccable](https://github.com/pbakaus/impeccable) (Apache-2.0) ได้หรือไม่

impeccable เป็น skill สำหรับ coding agent ที่เขียน HTML/CSS เอง แต่ agent ของเราประกอบหน้าจาก catalog จึงติดตั้ง skill ตรงๆ ไม่ได้ ใช้ได้ 3 ส่วน คือกฎใน `craft-floor.md`, การแยก mode ของหน้า (`mode-*.md`) และ detector แบบ deterministic (`impeccable detect`)

## สิ่งที่ทำ

| ชั้น | ทำอะไร |
|---|---|
| Catalog | `eyebrow` ของ Hero และ ImageText เป็น optional และ fill ไม่เขียนให้อีก (impeccable ห้าม eyebrow เด็ดขาด) เพิ่ม `imageAlt` ให้ Hero และ ImageText ใช้บรรยายภาพที่ควรถ่าย |
| Renderer | placeholder รูปเปลี่ยนจาก gradient เป็นพื้นเรียบที่บอกว่าควรเป็นภาพอะไร, ใช้ border หรือ shadow อย่างใดอย่างหนึ่ง, theme ส่วนของ browser (selection, caret, focus ring, scrollbar, ตัวเลขในตาราง), ตัด opacity ของข้อความบนพื้นสี |
| Design systems | ปรับ muted-foreground ของ 8 ชุดและ primary ของ 3 ชุด (Dashboard, Friendly, Neobrutalism)ให้ผ่าน WCAG AA 4.5:1 โดยคง hue เดิม และมี `scripts/check-contrast.ts` อยู่ใน `make test` |
| Brief | เพิ่มคำถาม mode: persuade (ชวนให้ตัดสินใจ), operate (ใช้ทำงาน), read (อ่านหาข้อมูล) Jev ตอบเป็นค่าแนะนำใน call เดิม ค่านี้ส่งต่อไปยัง composer และ fill |
| Composer | `pageGuidance` เพิ่มกฎ mode, ใช้ grid การ์ดได้ไม่เกินหนึ่งชุด และห้ามวาง Stats ใต้ Hero |
| Normalize | `craftSpec` แก้แบบ deterministic: grid การ์ดชุดที่สองขึ้นไปเปลี่ยนเป็น list หรือ spotlight และ Stats ที่อยู่ใต้ Hero ย้ายลงไปหลัง section ถัดไป |
| Critic | `pipeline/critique.go` ตรวจทุกเฟรมหลัง fill โดยไม่เรียก model ได้แก่ action ในส่วนแรกของหน้า persuade, section การตลาดในหน้า operate, grid การ์ดซ้ำ, hero-metric, section ชนิดเดียวกันติดกัน และ eyebrow ผลแสดงในขั้น "ตรวจคุณภาพ" พร้อมปุ่ม "แก้ตามผลตรวจ" ที่ส่ง prompt ให้ edit agent |
| Audit | `make audit` render fixture ทุกตัวด้วย design system ทั้ง 12 ชุด (หรือทุกเฟรมของโปรเจกต์ด้วย `PROJECT=<id>`) แล้วรัน `impeccable detect` ผลอยู่ที่ `evals/results/design-audit-latest.md` |

## ผลวัด

`make audit` บน 2 fixtures × 12 design systems (24 เฟรม)

| | ก่อน | หลัง |
|---|---|---|
| findings ทั้งหมด | 102 | 9 |
| low-contrast | 81 | 0 |
| cramped-padding | 12 | 0 |
| cream-palette | 6 | 6 |
| overused-font | 3 | 3 |

ที่เหลือเป็นสิ่งที่ตั้งใจเลือก ได้แก่ พื้นครีมของ Editorial, Warm Editorial และ Friendly กับฟอนต์ Geist ของ Shadcn, Vercel และ Linear ซึ่งเป็นตัวตนของ design system นั้น ตรงกับหลัก "the brief wins" ของ impeccable

## ข้อจำกัด

- critic ตรวจได้เฉพาะโครงและ props ส่วนเรื่องที่ต้องดูภาพ (สมดุล, จังหวะ, ความเข้ากับธุรกิจ) ยังต้องใช้ `make audit` หรือคนตรวจ
- ไม่ได้รัน detector ทุก turn เพราะต้องเปิด headless browser ใช้เวลาหลายวินาทีต่อเฟรม
- ยังไม่ได้รัน `make eval` รอบใหม่ (ใช้ quota ของ Jev และ Gemini) รอบถัดไปควรวัดว่า mode ที่ Jev แนะนำตรงกับประเภทหน้าแค่ไหน
