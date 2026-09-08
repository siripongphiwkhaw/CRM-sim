# Architecture Decision Records — Activity Master / CRM Phase 1

บันทึกการตัดสินใจเชิงสถาปัตยกรรมสำหรับคำถาม "ควรมี Activity Master ใน CRM ตั้งแต่
Phase 1 หรือไม่ ในเมื่อฝั่ง Loyalty ยังไม่ confirm activity model"

เอกสารชุดนี้เกิดจาก grilling session — แต่ละ ADR บันทึก *เหตุผล* ที่ตัดสินใจ ไม่ใช่แค่
ผลลัพธ์ เพื่อให้คนที่มาอ่านทีหลัง (โดยเฉพาะตอน FY2028 ที่ B2C mastership ย้ายมา CRM)
รู้ว่าอะไรคือสมมติฐานที่รองรับการตัดสินใจนั้นอยู่ และถ้าสมมติฐานเปลี่ยน ต้องรื้อข้อไหน

## สถานะ

| ADR | เรื่อง | สถานะ |
|---|---|---|
| [0001](ADR-0001-customer-data-first-is-sequencing.md) | ตีความ "Customer Data First" เป็น sequencing ไม่ใช่ scope exclusion | Accepted |
| [0002](ADR-0002-no-activity-master-in-crm-phase-1.md) | **ไม่สร้าง Activity Master ใน CRM Phase 1** — Fabric CDP ยังเป็น B2C activity store | Accepted |
| [0003](ADR-0003-no-retroactive-point-earning.md) | ไม่คำนวณแต้มย้อนหลัง — Loyalty นับแต้มจาก go-live ของตัวเอง | Accepted |
| [0004](ADR-0004-loyalty-reads-via-activity-contract.md) | Loyalty อ่าน activity ผ่าน canonical contract ไม่ต่อตรงกับ source | Proposed |
| [0005](ADR-0005-separate-identity-resolved-from-aggregate.md) | แยก identity-resolved activity ออกจาก aggregate marketing data | Accepted |
| [0006](ADR-0006-crm-owns-staff-generated-activity.md) | **CRM เป็นเจ้าของ staff-generated activity** — จำกัดขอบเขตของ 0002 | Accepted |
| [0007](ADR-0007-no-staff-activity-logging-in-phase-1.md) | Phase 1 ไม่รวมการบันทึก staff activity — เลื่อนไป phase ถัดไป | Accepted |
| [0008](ADR-0008-lead-management-is-b2b-only.md) | Lead Management เป็น B2B เท่านั้น — lead activity เกาะกับ lead ไม่ใช่ customer | Accepted |

คำศัพท์ที่ใช้ในเอกสารชุดนี้: ดู [glossary](../glossary.md)

## สมมติฐานหลักที่ทุก ADR ตั้งอยู่บน

ถ้าข้อใดข้อหนึ่งเปลี่ยน ต้องกลับมาทบทวน ADR-0002 เป็นอันดับแรก

1. Fabric CDP เก็บ raw B2C event ระดับรายการอยู่แล้ว retention เกิน 3 เดือน
2. ธุรกิจไม่ต้องการแต้มย้อนหลังสำหรับช่วงก่อน Loyalty go-live
3. Budget ไม่ใช่ข้อจำกัด — ข้อจำกัดจริงคือ **timeline** และ **master control**
4. FY2028 CRM จะขึ้นเป็น B2C master และ Fabric CDP ย้ายมาเป็น JNZ CDP module
