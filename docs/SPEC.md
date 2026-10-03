# UI Factory: Design Spec

> สรุปจาก design session วันที่ 2026-10-03 · สถานะ: confirmed

## เป้าหมาย

Prototype ส่วนตัวสำหรับสั่งงานผ่านแชทให้ LLM agent ร่วมกับ Jev ประกอบ UI จาก component catalog ลงบน canvas แบบ Figma รันบน localhost และใช้แต่ข้อมูลสมมติ

## Architecture

| ส่วน | การตัดสินใจ |
|---|---|
| Frontend | React + Vite SPA, React Flow เป็น canvas, ทุก frame render ใน iframe (frame ที่อยู่นอกจอแสดงเป็น thumbnail) |
| Backend | Go + **adk-go** + **Gemini** (AI Studio free tier) ซ่อนการเลือก model ไว้หลัง interface |
| Composer | Node sidecar: **json-render** + **Jev** ผ่าน interface `Composer` ที่มี 2 implementation คือ `jev` และ `llm` (ใช้เป็น baseline และ fallback) |
| Schema | Zod catalog ใน `packages/catalog` เป็น source of truth แล้ว gen JSON Schema ให้ Go ใช้ |
| Storage | SQLite (`modernc.org/sqlite`) เก็บ snapshot ทุก agent turn เพื่อใช้ undo |
| Transport | SSE ส่ง JSON Patch (RFC 6902) จาก Go ไปที่ canvas |
| Auth | ไม่มี |
| Dev | `make dev` รัน 3 process พร้อมกัน ใช้ `.env` ไฟล์เดียว (ดู `.env.example`) |

## Generation pipeline

1. **Router**: Jev จำแนก intent เป็น `new_page`, `edit_selection` หรือ `set_theme`
2. **Structure**: Jev เลือก block type จาก catalog และจัด layout โดยใช้ placeholder props จากนั้น render เป็น **skeleton** ทันที
3. **Fill**: Gemini เติม props และเนื้อหาของแต่ละ block แบบขนาน ส่งเป็น patch ผ่าน SSE แต่ละ block จะเปลี่ยนจาก skeleton เป็นของจริงทีละชิ้น
4. **Validate**: ตรวจ tool call ทุกครั้งกับ catalog ถ้าไม่ผ่านให้ retry ได้สูงสุด 3 ครั้ง ถ้ายังไม่ผ่าน ให้ apply เฉพาะส่วนที่ผ่านแล้วแจ้งในแชทว่าส่วนไหนทำไม่ได้

กฎเพิ่มเติม

- **Wireframe mode** คือการหยุดหลังขั้น Structure แล้วให้ผู้ใช้กด Fill เอง
- งานสร้างหน้าใหม่ generate ทั้งก้อน ส่วนงานแก้ไขใช้ tool call (`add_node`, `update_props`, `move_node`, `remove_node`, `set_theme`, `create_frame`)
- Context ที่ส่งให้ agent ประกอบด้วย subtree ที่ถูก select, outline ของ frame (id และ type) และประวัติแชท 10 turn ล่าสุด
- ระหว่างที่ agent ทำงาน frame นั้นจะถูกล็อก ผู้ใช้กดปุ่ม Stop ได้ ซึ่งจะ rollback ไปที่ snapshot ก่อนเริ่ม turn

## Catalog และ Canvas

- Catalog มี 2 ชั้น
  - **blocks** สำเร็จรูป เริ่มที่ 10 แล้วขยายเป็น 25 ถึง 30
  - **primitives** จาก shadcn/ui ใช้ใน slot ของ block
- ทุก block **ต้องมี skeleton variant**
- Theme เป็น design tokens ระดับ project ที่ map เข้ากับ CSS variables ของ shadcn
- Device frames มี Desktop, Tablet และ Mobile
- Prototype คลิกได้ผ่าน `$state` และ actions ของ json-render รวมถึงการ navigate ข้าม frame
- Mock content ใช้ภาษาไทยเป็นค่าเริ่มต้น สลับเป็นภาษาอังกฤษได้ระดับ project
- Editor layout
  - แผงซ้าย: tabs Components และ Layers
  - แผงขวา: Props inspector ที่สร้าง form อัตโนมัติจาก schema
  - ด้านล่าง: แชท
- Export: MVP ส่งออกเป็น JSON ส่วน TSX ทำใน phase 2

## Repo

```
apps/web/            React + Vite, React Flow, iframe renderer
services/api/        Go, adk-go, SSE, SQLite
services/composer/   Node, json-render, Jev
packages/catalog/    Zod catalog (source of truth) และ JSON Schema export
evals/               10 prompt สำหรับเทียบ composer แบบ jev กับ llm
docs/                spec และ decision notes
```

## Milestones

| # | ชื่อ | Done เมื่อ |
|---|---|---|
| M1 | Render + Spike | catalog 10 blocks พร้อม skeleton และ canvas แสดง iframe frame จาก JSON ที่เขียนด้วยมือ พร้อม spike ที่ยืนยันได้ว่า `experimental_composeSpec` รับ placeholder props หรือไม่ |
| M2 | Structure | ส่ง prompt ในแชทแล้ว Jev route และวาง layout จนได้ skeleton บน canvas |
| M3 | Fill + Edit | Gemini เติมเนื้อหาผ่าน SSE แบบขนาน แก้ด้วย patch ได้ เก็บ snapshot ใน SQLite และ undo ได้ |
| M4 | Eval | รัน 10 prompt เทียบ composer แบบ jev กับ llm วัด validation pass rate, latency และคะแนนที่ให้เอง |
| M5 | Polish | แผงซ้าย, Props inspector, theme, device frames, คลิกได้, export |

## ความเสี่ยงและเรื่องที่ยังไม่ได้ตรวจสอบ

- ข้อมูล Jev มาจากแหล่งต่อไปนี้ ยังต้องอ่านต้นฉบับอีกครั้ง
  - https://json-render.dev/docs/jev
  - https://github.com/vercel-labs/json-render
  - https://openrouter.ai/blog/insights/what-is-jev/
- API Jev ของ json-render ยังเป็น `experimental_*` ต้อง pin version แบบ exact
- ยังไม่ได้ยืนยันว่า `experimental_composeSpec` รับ placeholder props ได้ (spike ใน M1) ถ้ารับไม่ได้ ให้เขียน compose layer บางๆ ของเราเอง
- ยังไม่ได้ยืนยันว่า adk-go รองรับ streaming และ tool loop ได้ครบหรือไม่ (ตรวจใน M2 และ M3)
- Gemini free tier มี rate limit ต่ำ ถ้าเจอ 429 บ่อยให้เปิด billing
- Jev ประมวลผลในสหรัฐฯ เท่านั้น จึงใช้ได้กับข้อมูลสมมติเท่านั้น

## สถานะ (อัปเดต 2026-10-03)

| # | สถานะ | หมายเหตุ |
|---|---|---|
| M1 | เสร็จ | spike ผ่าน ดู [decision 001](decisions/001-jev-compose-spike.md) |
| M2 | เสร็จ | Jev route + structure ส่ง skeleton ขึ้น canvas ใน 0.6 ถึง 0.9 วินาที |
| M3 | เสร็จ | Fill ขนานผ่าน SSE, tool-based edit ด้วย adk-go, snapshot, undo, lock, stop rollback |
| M4 | เสร็จ | ดู [decision 002](decisions/002-composer-eval.md) คอลัมน์คะแนนที่ให้เองยังรอผู้ใช้กรอก |
| M5 | เสร็จ | catalog 27 blocks, แผงซ้าย, Props inspector, theme, device frames, prototype navigate, export JSON |

ความเสี่ยงที่ปิดแล้ว

- `experimental_composeSpec` รับ placeholder props ได้ ไม่ต้องเขียน compose layer เอง
- adk-go v1.7.0 รองรับ streaming และ tool loop
- evaluator ของ library ยิง Vercel AI Gateway จึงเขียน adapter ยิง TypeSafe API ตรง

ความเสี่ยงที่ยังเปิดอยู่

- Gemini free tier (5 RPM สำหรับ `gemini-3.8-flash` และมี 503 เป็นระยะ) แก้ชั่วคราวด้วย rate limiter และ fallback ไป fast model การเปิด billing ยังเป็นการตัดสินใจของเจ้าของโปรเจกต์
- Jev วาง block ลงใน slot ได้ (2/20 ใน eval) กันด้วย `normalizeSpec` และ `ValidateSpec`
