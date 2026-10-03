# 001: Spike `experimental_composeSpec` กับ placeholder props

วันที่ 2026-10-03 · สถานะ: ผ่าน

## คำถาม

`experimental_composeSpec` ของ `@json-render/core` รับ candidate ที่ props เป็น placeholder ได้หรือไม่ ถ้าไม่ได้ต้องเขียน compose layer เอง

## ผล

- รับได้ candidate เป็น recipe ที่แอปเป็นเจ้าของ Jev แค่ "เลือกและจัดวาง" ไม่แก้ props เลย ดังนั้น placeholder props (`"…"` และ `skeleton: true`) ถูกส่งต่อเข้า spec ตรงตัว
- เงื่อนไขเดียวคือ placeholder ต้องผ่าน Zod schema ของ catalog เพราะ schema defaults จะไม่ถูก apply กับ candidate
- Jev วาง Button ลงใน named slot (`Hero.slots.actions`) ได้เอง
- Strategy `batch` ใช้ 2 evaluation (select, layout) รวม 0.9 วินาที กับ prompt ภาษาไทย
- ไม่ต้องเขียน compose layer เอง

## ข้อค้นพบที่ต่างจาก spec เดิม

- npm `@json-render/core@0.21.0` publish API Jev แล้ว ไม่ต้อง build จาก source pin เป็น `0.21.0` แบบ exact
- `experimental_createEvaluator` ที่มากับ library ยิงไปที่ Vercel AI Gateway (`ai-gateway.vercel.sh`) และต้องใช้ Gateway key ส่วน key ที่เรามีเป็นของ TypeSafe โดยตรง
  จึงเขียน evaluator adapter ของเราเองตาม type `Experimental_CompositionEvaluator` ให้ยิง `POST {JEV_BASE_URL}/systemone` แทน (ดู `services/composer/src/jev.ts`)
- adk-go `v1.7.0` มี `runner.Run` ที่คืน `iter.Seq2` (streaming) และ `llmagent` ที่วน tool loop ให้ ความเสี่ยงเรื่องนี้ปิดได้

## แหล่งอ้างอิง

- https://json-render.dev/docs/jev
- type definitions ใน `@json-render/core@0.21.0/dist/index.d.ts`
- https://docs.typesafe.ai/api
