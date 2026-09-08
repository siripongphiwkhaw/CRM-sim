# ADR-0005 — แยก identity-resolved activity ออกจาก aggregate marketing data

**สถานะ:** Accepted — ยืนยันตารางสถานะ identity แล้ว
**เกี่ยวข้อง:** ADR-0004

## Context

แหล่งข้อมูล B2C ที่ระบุไว้ (Social, Supermetrics, D2C website, EC mall,
brand loyalty campaign) ไม่ได้เป็นข้อมูลชนิดเดียวกัน มันปนกันอยู่สองชนิด:

| Source | ระบุตัวคนได้? | ใช้กับ Loyalty ได้? |
|---|---|---|
| D2C website | ได้ (login / email / เบอร์) | ได้เต็มที่ |
| Brand loyalty campaign | ได้ (สมัครเข้าแคมเปญ) | ได้ |
| EC mall (Shopee / Lazada) | **มักไม่ได้** — ชื่อ/เบอร์ผู้ซื้อถูก mask | ได้เฉพาะเมื่อลูกค้าอัปโหลดใบเสร็จ / เคลมเอง |
| Social | ไม่ได้ (เป็น engagement metric) | ไม่ได้ |
| Supermetrics | ไม่ได้ (เป็น ad / campaign aggregate) | ไม่ได้ |

ถ้าเอาสองชนิดนี้ยัดรวมเป็น "Activity Master" ก้อนเดียว จะได้ตารางที่ใช้ไม่ได้ทั้ง
สองงาน — Loyalty query ไม่ได้เพราะเจอ row ที่ไม่มีเจ้าของ ส่วน Marketing ก็ใช้
ไม่สะดวกเพราะโครงถูกบิดไปรองรับ person-level

## Decision (เสนอ)

แยกเป็น **สองชั้นที่เป็นคนละเรื่องกัน** และห้ามเรียกทั้งสองอย่างว่า "Activity"
ในเอกสารเดียวกัน:

1. **Identity-resolved activity** — ผูกกับลูกค้าได้ ใช้กับ Loyalty ได้
   อยู่ภายใต้ PDPA consent รายบุคคล
2. **Marketing performance data** — ระดับ aggregate ไม่ผูกบุคคล
   ไม่แตะ PDPA รายคน และ **ไม่เข้า Loyalty เด็ดขาด**

## Consequences

- ตัดความเสี่ยงที่ข้อมูล aggregate จะหลุดเข้าไปในเส้นทางคำนวณแต้ม
- ทำให้ขอบเขต PDPA ชัด — consent รายบุคคลบังคับใช้เฉพาะชั้นที่ 1
- **สมมติฐานที่ควรตรวจสอบ:** เหตุผลที่ทีม Loyalty ยัง confirm activity model
  ไม่ได้ อาจไม่ใช่เพราะทำงานช้า แต่เพราะนิยามคำว่า "activity" ยังปนกันอยู่
  แบบนี้ — เขาจึงไม่รู้ว่ากำลังถูกถามถึงชั้นไหน
- ต้องยืนยันสถานะ EC mall ก่อนสรุป ADR นี้ เพราะถ้า EC mall ระบุตัวผู้ซื้อได้จริง
  ในบริบทของบริษัท สัดส่วนข้อมูลที่ใช้กับ Loyalty ได้จะเปลี่ยนไปมาก
