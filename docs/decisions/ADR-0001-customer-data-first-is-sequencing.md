# ADR-0001 — "Customer Data First" คือ sequencing mandate ไม่ใช่ scope exclusion

**สถานะ:** Accepted

## Context

Top management ออก requirement ว่า **"Customer Data First"** สำหรับ CRM Phase 1
ประโยคนี้ตีความได้สองแบบที่นำไปสู่แผนคนละทาง:

- **Sequencing mandate** — ทำ Customer Master ให้แน่นก่อน เรื่องอื่นค่อยว่ากัน
  แต่ไม่ได้ห้ามงานอื่นที่ไม่แย่ง resource
- **Exclusion mandate** — scope ที่อนุมัติคือ Customer Master เท่านั้น
  งานอื่นทุกอย่างรวมถึง activity log ถือเป็น scope creep

ความต่างนี้สำคัญ เพราะถ้าเป็น exclusion การเสนอทำ activity log แม้เพียงตารางเล็ก
ก็คือการฝ่าฝืนสิ่งที่ผู้บริหาร sign-off ไว้ และหน้าที่จะเปลี่ยนจาก "ออกแบบระบบ"
เป็น "ขอลายเซ็นยอมรับความเสี่ยง data gap"

## Decision

ตีความเป็น **sequencing mandate** — Customer Master คือ priority หลักของ Phase 1
งานอื่นทำได้ถ้าไม่แย่ง scope / budget / timeline ไปจาก Customer Master

## Consequences

- เปิดทางให้พิจารณา activity capture ต่อได้ (ผลของการพิจารณานั้นอยู่ใน ADR-0002)
- ยังต้องยืนยันการตีความนี้กับผู้ออก mandate ถ้ามี scope document เป็นลายลักษณ์อักษร
  ที่ระบุตรงข้าม ADR นี้เป็นโมฆะทันทีและต้องกลับไปใช้เส้นทาง exclusion
- ข้อจำกัดจริงที่เหลือหลังจากตีความแบบนี้ไม่ใช่ budget แต่เป็น **timeline** และ
  **master control** ซึ่งกลายเป็นเกณฑ์ตัดสินหลักของ ADR ถัดๆ ไป
