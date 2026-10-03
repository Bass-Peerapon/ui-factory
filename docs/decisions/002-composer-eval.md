# 002: ผล eval composer แบบ jev เทียบกับ llm (M4)

วันที่ 2026-10-03 · ผลดิบอยู่ที่ `evals/results/2026-10-03T16-35-07.md` · รันซ้ำด้วย `make eval`

## วิธีวัด

- 10 prompt สร้างหน้า (`evals/prompts.json`) รันละ 2 รอบต่อ composer และ 10 เคส routing
- **pass (raw)** คือ spec ผ่าน Zod catalog และกฎ placement (block อยู่ใต้ root, primitive อยู่ใน slot ที่ประกาศ)
- **pass after normalize** คือสิ่งที่ไปถึง canvas จริงหลัง `normalizeSpec`
- `llm` ใช้ `GEMINI_FAST_MODEL` และเว้นจังหวะ 4.5 วินาทีต่อ call เพื่อไม่ชน rate limit ของ free tier

## ผล

| composer | pass (raw) | pass after normalize | median latency | p90 latency | expected-block coverage | route accuracy | route median |
|---|---|---|---|---|---|---|---|
| jev | 18/20 (90%) | 20/20 | 679 ms | 915 ms | 98% | 10/10 | 308 ms |
| llm | 20/20 (100%) | 20/20 | 1,266 ms | 1,745 ms | 98% | 10/10 | 1,029 ms |

## ข้อสังเกต

- Jev เร็วกว่าประมาณ 1.9 เท่าในขั้น structure และ 3.3 เท่าในขั้น route แต่วาง block `CTA` ลงใน slot `actions` ของ `Hero` ซ้ำทั้ง 2 รอบใน prompt `minimal-waitlist`
  สาเหตุคือ json-render slot ไม่ได้จำกัดชนิดของ child จึงต้องมี `normalizeSpec` (ย้าย block กลับไปใต้ root) และ Go `ValidateSpec` ตรวจ placement ซ้ำอีกชั้น
- Jev ได้ confidence ต่อคำตอบ ใช้ทำ threshold ได้ในอนาคต ส่วน `llm` ไม่มี
- คอลัมน์ "คะแนนที่ให้เอง" ในไฟล์ผลยังว่าง ต้องเปิดดูหน้าจริงในแอปแล้วให้คะแนน 1 ถึง 5

## ตัดสินใจ

คง `COMPOSER_MODE=jev` เป็นค่าเริ่มต้น และใช้ `llm` เป็น fallback/baseline ตาม spec เดิม
นี่เป็นการวิเคราะห์ของผมจากผลวัดชุดเล็ก 20 รอบ ไม่ใช่ benchmark ที่มีนัยสำคัญทางสถิติ
