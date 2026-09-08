# ADR-0004 — Loyalty อ่าน activity ผ่าน canonical contract ไม่ต่อตรงกับ source

**สถานะ:** Proposed — รอยืนยันว่ามีทีมที่เป็นเจ้าของ contract layer นี้ได้
**เกี่ยวข้อง:** ADR-0002

## Context

Loyalty เป็น **B2C เท่านั้น ไม่เกี่ยวกับ SAP** และรับข้อมูลฝั่ง B2C จากหลายทาง:
Social, Supermetrics, D2C website, EC mall, และ loyalty campaign ของแต่ละแบรนด์

ประเด็นคือ **แหล่งข้อมูล B2C จะเปลี่ยนตัวเองใน FY2028** — วันนี้ master อยู่ที่
Fabric CDP แต่ FY2028 จะย้ายมาเป็น JNZ CDP module ใน CRM

ถ้า Loyalty เขียน integration ต่อตรงเข้า Fabric มันจะได้ระบบที่ทำเสร็จเร็วภายใน
3 เดือน แต่ต้องจ่ายค่า re-integration เต็มจำนวนอีกครั้งใน FY2028 — และตอนนั้น
Loyalty จะมีแต้มจริงของลูกค้าจริงอยู่ในระบบแล้ว การย้าย data source ใต้ระบบที่
แบกภาระทางการเงินอยู่ เสี่ยงและแพงกว่าการทำให้ถูกตั้งแต่ตอนนี้หลายเท่า

## Decision (เสนอ)

นิยาม **canonical activity contract** หนึ่งชุดใน Phase 1 แล้วให้ Loyalty อ่านจาก
contract นี้อย่างเดียว ส่วนใครเป็นคนป้อนข้อมูลเข้า contract เป็นเรื่องของ layer
ข้างล่าง — วันนี้คือ Fabric, FY2028 สลับเป็น CRM CDP module โดย Loyalty ไม่ต้องแก้

field ขั้นต่ำที่ควรอยู่ใน contract:
`customer_ref`, `cust_type`, `event_type`, `channel`, `brand`, `amount`,
`occurred_at`, `source_system`, `source_ref`

## Consequences

- **ต้นทุนตอนนี้แทบเป็นศูนย์** เพราะเป็นการนิยาม schema บนกระดาษ ไม่ใช่การ build
  store → ไม่กิน timeline ไม่กิน budget ไม่สร้าง master ซ้อน
- ป้องกันค่า re-integration ก้อนใหญ่ตอน FY2028
- **ผลพลอยได้ที่สำคัญ:** การทำ contract บังคับให้ทีม Loyalty ต้องระบุให้ได้ว่า
  ตัวเองต้องการ field อะไรบ้าง ซึ่งแก้ปัญหา "Loyalty ยังไม่ confirm model"
  ไปในตัว — เพราะไม่ต้องรอ model เต็มของเขา แค่รอ *contract* ก็เดินต่อได้
- ต้องมีเจ้าของ contract ที่ชัดเจน (data architect / integration team)
  ถ้าไม่มีใครเป็นเจ้าของ contract จะเน่าและกลายเป็น point-to-point อยู่ดี
