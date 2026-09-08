# ADR-0002 — ไม่สร้าง Activity Master ใน CRM Phase 1

**สถานะ:** Accepted — แต่ถูกจำกัดขอบเขตโดย ADR-0006
**เกี่ยวข้อง:** ADR-0001 (sequencing), ADR-0003 (ไม่มีแต้มย้อนหลัง)

## Context

คำถามตั้งต้นคือ CRM Phase 1 ควรมี Activity Master ผูกกับ Customer Master เลยไหม
ทั้งที่ฝั่ง Loyalty (go-live +3 เดือน) ยังไม่ confirm activity table/model

ข้อโต้แย้งหลักที่สนับสนุนให้ "ทำเลย" คือ **ความสูญเสียที่กู้คืนไม่ได้** — ถ้า CRM
go-live แล้วไม่เก็บ activity เลย ช่วง 3 เดือนก่อน Loyalty เปิดจะไม่มี behavioral data
สะสม และข้อมูลพฤติกรรมย้อนหลังเป็นสิ่งที่สร้างใหม่ไม่ได้

**ข้อโต้แย้งนั้นตกไป** เมื่อได้ข้อเท็จจริงเพิ่ม 2 ข้อ:

1. **Fabric CDP เก็บ raw B2C event ระดับรายการอยู่แล้ว** retention ครอบคลุมเกิน
   3 เดือน (สังเกตได้จากการที่ Segment Builder ฝั่ง B2C ทำงานอยู่แล้ว ซึ่งต้องมี
   behavioral data ป้อน) → ไม่มีข้อมูลใดสูญหาย
2. **ธุรกิจไม่ต้องการแต้มย้อนหลัง** (ADR-0003) → ไม่ต้องการความละเอียดระดับการเงิน

เมื่อไม่มีข้อมูลสูญหายและไม่ต้องการ financial-grade แล้ว use case ที่เหลือมีเพียง
analytics/segmentation ซึ่ง **Fabric ทำอยู่แล้วและทำได้ดีกว่า CRM**

ปัจจัยชี้ขาดเพิ่มเติมคือแผน mastership:

- **วันนี้:** B2B master = SAP, B2C master = Fabric CDP
- **FY2028:** CRM ขึ้นเป็น B2C master และ Fabric CDP ย้ายมาเป็น JNZ CDP module ใน CRM

การสร้าง Activity Master ใน CRM ตอนนี้จึงเท่ากับ **รัน B2C master ซ้อนกันสองที่
ยาวประมาณสองปี** จนถึง FY2028 ซึ่งเป็นกรณีที่แย่ที่สุดของ master control

## Decision

**CRM Phase 1 จะไม่สร้าง Activity Master** — Fabric CDP ยังคงเป็นเจ้าของ
B2C activity store ต่อไปจนถึงการย้าย mastership ใน FY2028

สิ่งที่ CRM ต้องมีสำหรับงาน service คือ **มุมมอง (view) ใน Customer 360 ที่อ่าน
activity มาจาก Fabric** ไม่ใช่ตารางที่ CRM เป็นเจ้าของและเขียนเอง

## Consequences

**ผลดี**

- ไม่กระทบ timeline ของ CRM Phase 1 ซึ่งเป็นข้อจำกัดจริงข้อหนึ่ง
- ไม่เกิด master ซ้อนสองที่ → ไม่มีภาระ reconciliation ตลอด 2 ปีข้างหน้า
- ไม่เสียงบไปกับ store ที่จะถูกรื้อทิ้งหรือรวมร่างอยู่ดีตอน FY2028
- CRM ไม่ต้องไปรับภาระ ingest ข้อมูลจาก Social / Supermetrics / EC mall
  ซึ่งเป็นงานของ CDP โดยธรรมชาติ

**ผลเสีย / สิ่งที่ต้องยอมรับ**

- CRM ต้องพึ่ง Fabric สำหรับ Customer 360 → เกิด dependency ด้าน availability
  และ freshness ที่ต้องมีข้อตกลงกำกับ (ยังไม่ได้นิยาม — เป็นงานค้าง)
- ตอน FY2028 ที่ activity ย้ายเข้ามาอยู่ใน CRM จะมีงาน migration ก้อนหนึ่งรออยู่
  ซึ่ง ADR-0004 พยายามลดต้นทุนส่วนนี้ล่วงหน้า

**เงื่อนไขที่ทำให้ต้องรื้อ ADR นี้**

- ถ้าพบว่า Fabric ไม่ได้เก็บ event ระดับรายการจริง (เก็บแค่ aggregate/profile)
- ถ้าธุรกิจเปลี่ยนใจต้องการแต้มย้อนหลัง (ADR-0003 พลิก)
- ถ้าแผน FY2028 ถูกเลื่อนออกไปมากจนช่วงรัน master ซ้อนสั้นกว่าที่คิด
