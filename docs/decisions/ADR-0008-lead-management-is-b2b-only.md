# ADR-0008 — Lead Management เป็น B2B เท่านั้น และกิจกรรมติดตามเกาะกับ lead ไม่ใช่ customer

**สถานะ:** Accepted — confirm กับ user แล้ว
**เกี่ยวข้อง:** ADR-0007 (ไม่มี staff activity ใน Phase 1)

## Context

มีข้อกังวลว่า ADR-0007 จะขัดกับ Lead Management ที่อยู่ใน scope เพราะ
Lead Management โดยธรรมชาติคืองานติดตาม — ถ้าไม่มีที่บันทึกกิจกรรมของพนักงาน
จะเหลือแค่รายชื่อ lead ที่เปลี่ยนสถานะได้ แต่ไม่มีใครรู้ว่าเกิดอะไรขึ้นระหว่างทาง

## Decision

**Lead Management อยู่ฝั่ง B2B เท่านั้น** และ requirement ถูก confirm กับ user แล้ว
เดินหน้าได้ ไม่มีอะไรติด

ความขัดแย้งกับ ADR-0007 ไม่เกิดขึ้นจริง เพราะ **lead ไม่ใช่ customer**:
กิจกรรมติดตาม lead เป็นของ *lead record* ภายในโมดูล Lead Management
ไม่ได้เป็น activity บน Customer Master ซึ่งเป็นสิ่งที่ ADR-0007 เลื่อนออกไป

## Consequences

- ADR-0007 ยังยืนได้ — ทั้งสอง ADR พูดถึงคนละ entity
- ขอบเขตของ activity แต่ละแบบชัดขึ้น:
  - **Lead activity** — ก่อนเป็นลูกค้า, ฝั่ง B2B, อยู่ในโมดูล Lead Management → **Phase 1**
  - **Customer activity (staff-generated)** — หลังเป็นลูกค้าแล้ว, บน Customer Master → **เลื่อน (ADR-0007)**
- Lead Management เป็น B2B ล้วน จึงไม่แตะ Loyalty (ซึ่งเป็น B2C ล้วน) และไม่แตะ
  Fabric CDP (ซึ่งถือ B2C behavioral event) → เดินขนานได้โดยไม่มี dependency

## คำถามที่ยังค้าง

- **ตอน lead แปลงเป็นลูกค้า ใครเป็นคนสร้าง customer record?** ฝั่ง B2B มี SAP
  เป็น master อยู่แล้ว แต่ lead เกิดใน CRM — จุดแปลงสภาพนี้จึงเป็นรอยต่อของ
  master control ที่ต้องนิยามให้ชัดใน Phase 1
- ประวัติการติดตามของ lead จะตามไปกับลูกค้าหลังแปลงสภาพหรือไม่ ถ้าไม่ตามไป
  ทีมที่ดูแลบัญชีจะเสีย context ช่วงก่อนปิดการขาย ซึ่งมักเป็นช่วงที่มีค่าที่สุด
