# UI Factory

Prototype ส่วนตัวสำหรับสั่งงานผ่านแชทให้ LLM agent ร่วมกับ Jev ประกอบ UI จาก component catalog ลงบน canvas แบบ Figma รันบน localhost และใช้ข้อมูลสมมติเท่านั้น
รายละเอียดการออกแบบอยู่ที่ [docs/SPEC.md](docs/SPEC.md)

## เริ่มใช้งาน

ต้องมี Go 1.27+, Node 22+ และ pnpm 10

```sh
cp .env.example .env   # ใส่ GEMINI_API_KEY, JEV_API_KEY และชื่อ model
make install
make dev               # api :8080, composer :8081, web :5173
```

เปิด http://localhost:5173 โปรเจกต์แรกจะมีหน้าตัวอย่าง (ร้านกาแฟ) ที่เขียนด้วยมือจาก `packages/catalog/fixtures/coffee-landing.json`

ตัวอย่างการใช้งาน

- `ทำหน้า landing page คลินิกทันตกรรม มีราคาแพ็กเกจ รีวิว และฟอร์มนัดหมาย` สร้างเฟรมใหม่ ถ้าคำสั่งยังกว้างเกินไป เช่น `ทำหน้าร้านกาแฟ` ระบบจะถามประเภทหน้า, อุปกรณ์, design system, โทน และ density โดยมีค่าแนะนำจาก Jev ให้แล้ว
- `ทำ flow สมัครสมาชิกแอปออมเงิน บนมือถือ` หรือเลือกจากแท็บ Patterns จะได้หลายเฟรมที่เชื่อมปุ่มต่อกัน เปิดดูแบบคลิกได้ด้วย Prototype
- กด `C` บน canvas แล้วคลิก element เพื่อปักคอมเมนต์ ส่งหลายอันพร้อมกันได้ AI จะแก้เฉพาะจุดที่คอมเมนต์
- เลือก Hero แล้วพิมพ์ `ทำหัวข้อให้สั้นลง และเพิ่มปุ่มทดลองฟรี` แก้ด้วย tool call
- เลือก design system และ density ที่แถบด้านบน ปุ่มนาฬิกาบน toolbar ของ canvas เปิด version history
- ติ๊ก Wireframe ก่อนส่ง เพื่อหยุดหลังวางโครง แล้วกด Fill หรือ Fill ทั้งหมดเอง

## โครงสร้าง

```
apps/web/            React + Vite, React Flow canvas, iframe renderer (json-render + shadcn/ui)
services/api/        Go: REST + SSE, adk-go edit agent, Gemini fill, SQLite snapshots
services/composer/   Node: json-render experimental_composeSpec + Jev, และ llm baseline
packages/catalog/    Zod catalog (source of truth), JSON Schema export, fixtures
evals/               10 prompt + 10 routing case เทียบ composer jev กับ llm
docs/                spec และ decision notes
```

## Generation pipeline

| ขั้น | ทำที่ | รายละเอียด |
|---|---|---|
| Router | composer | Jev choice question จัด intent เป็น `new_page`, `new_flow`, `edit_selection`, `set_theme` โดยเทียบกับหัวข้อของหน้าที่เปิดอยู่ |
| Brief | composer | Jev ตอบ noul ว่าคำสั่งชัดพอหรือยัง และตอบ choice ที่ใช้เป็นค่าแนะนำของ form ทั้งหมดใน call เดียว |
| Plan (flow) | composer | Jev เลือก 1 ใน 8 flow pattern และอุปกรณ์ ถ้าไม่ตรง pattern ไหน Gemini จะแตกหน้าเอง |
| Structure | composer | `experimental_composeSpec` เลือก candidate ที่มี placeholder props (`skeleton: true`) แล้ว `normalizeSpec` ซ่อม placement ก่อนส่งกลับ |
| Fill | api | Gemini เติม props ทีละ block แบบขนาน (structured output ตาม JSON Schema ของ block) แต่ละ block ส่งเป็น JSON Patch ทาง SSE ทันทีที่เสร็จ |
| Edit | api | adk-go `llmagent` เรียก tool `add_node`, `update_props`, `move_node`, `remove_node`, `set_theme`, `create_frame`, `set_navigation` |
| Validate | api | ทุก tool call และทุกผล Fill ตรวจกับ catalog ถ้าไม่ผ่านส่ง error กลับให้ model แก้ได้ `AGENT_MAX_RETRIES` ครั้ง เกินนั้น apply เฉพาะส่วนที่ผ่านและแจ้งในแชท |

ทุก turn บันทึก snapshot ก่อนเริ่มลง SQLite ทำให้ Undo ได้ ระหว่าง turn เฟรมถูกล็อก ปุ่ม Stop ยกเลิกงานและ rollback กลับ snapshot

## คำสั่งที่ใช้บ่อย

| คำสั่ง | ใช้ทำอะไร |
|---|---|
| `make dev` | รันทั้ง 3 process |
| `make gen` | gen JSON Schema ใหม่หลังแก้ catalog (Go embed ไฟล์นี้ ต้อง restart api) |
| `make test` | Go tests และตรวจ fixtures กับ catalog |
| `make typecheck` | TypeScript ทุก package และ `go vet` |
| `make eval` | รัน eval composer (ใช้ `.env` เดียวกัน) ผลอยู่ที่ `evals/results/latest.md` |

## ข้อจำกัดที่รู้แล้ว

- **Gemini free tier**: `gemini-3.8-flash` ได้ 5 requests/นาที และเจอ 503 (high demand) เป็นระยะ ระบบมี rate limiter ต่อ model และ fallback ไป `GEMINI_FAST_MODEL` เมื่อเจอ 429/503
  หน้าที่มี 7 blocks เติมเสร็จใน 3 ถึง 5 วินาที แต่หน้า 27 blocks ใช้ประมาณ 67 วินาทีเพราะติด limit ถ้าต้องการเร็วกว่านี้ต้องเปิด billing แล้วปรับ `GEMINI_RPM`
- **Jev** ประมวลผลในสหรัฐฯ ใช้กับข้อมูลสมมติเท่านั้น และ API ของ json-render ยังเป็น `experimental_*` จึง pin `0.21.0` แบบ exact
- json-render slot ไม่จำกัดชนิดของ child Jev จึงวาง block ลงใน slot ได้บ้าง (2/20 ใน eval) `normalizeSpec` และ Go `ValidateSpec` กันไว้แล้ว
- Export เป็น JSON ส่วน TSX อยู่ใน phase 2 ตาม spec
- ไม่มี auth ใช้บน localhost เท่านั้น

## Decision notes

- [001 Spike experimental_composeSpec กับ placeholder props](docs/decisions/001-jev-compose-spike.md)
- [002 ผล eval composer jev เทียบกับ llm](docs/decisions/002-composer-eval.md)
- [003 ยกระดับตามแนวทาง open-design](docs/decisions/003-open-design-uplift.md) (ส่วนที่ดัดแปลงจาก open-design ดู [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md))
