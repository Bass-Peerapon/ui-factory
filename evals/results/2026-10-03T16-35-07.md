# Composer eval 2026-10-03T16-35-07

Runs per prompt: 2. Pass = catalog schema valid and tree rules hold (blocks under the root, primitives in declared slots). "After normalize" is what reaches the canvas. Coverage = expected blocks present.

## Summary

| composer | structure pass (raw) | pass after normalize | median latency | p90 latency | expected-block coverage | route accuracy | route median |
|---|---|---|---|---|---|---|---|
| jev | 18/20 (90%) | 20/20 | 679 ms | 915 ms | 98% | 10/10 | 307.5 ms |
| llm | 20/20 (100%) | 20/20 | 1265.5 ms | 1745 ms | 98% | 10/10 | 1029 ms |

## Structure (คะแนนที่ให้เอง: กรอก 1 ถึง 5 ในคอลัมน์ score หลังเปิดดูผลในแอป)

| prompt | composer | run | pass | ms | stop | blocks | elements | coverage | score | notes |
|---|---|---|---|---|---|---|---|---|---|---|
| coffee-landing | jev | 1 | ✓ | 1064 | finish | Navbar › Hero › FeatureGrid › Pricing › Testimonials › CTA › Footer | 11 | 100% |  |  |
| dental-booking | jev | 1 | ✓ | 915 | finish | Navbar › ContactForm › Footer | 8 | 50% |  |  |
| saas-pricing | jev | 1 | ✓ | 1031 | finish | Navbar › Hero › Pricing › FAQ › Footer | 10 | 100% |  |  |
| fitness-signup | jev | 1 | ✓ | 606 | finish | Navbar › ContactForm › Footer | 8 | 100% |  |  |
| edtech-course | jev | 1 | ✓ | 766 | finish | Navbar › Hero › FeatureGrid › Stats › Testimonials › CTA › Footer | 11 | 100% |  |  |
| bank-feature | jev | 1 | ✓ | 809 | finish | Navbar › Hero › FeatureGrid › CTA › Footer | 8 | 100% |  |  |
| event-registration | jev | 1 | ✓ | 677 | finish | Navbar › Hero › FAQ › ContactForm › Footer | 13 | 100% |  |  |
| hotel-promo | jev | 1 | ✓ | 609 | finish | Navbar › Hero › FeatureGrid › Testimonials › CTA › Footer | 9 | 100% |  |  |
| minimal-waitlist | jev | 1 | ✗ | 618 | finish | Navbar › Hero › ContactForm › Footer | 8 | 100% |  | node_3 (CTA) is not a primitive but sits in slot actions |
| logistics-b2b | jev | 1 | ✓ | 723 | finish | Navbar › Hero › FeatureGrid › Stats › Testimonials › CTA › ContactForm › Footer | 16 | 100% |  |  |
| coffee-landing | jev | 2 | ✓ | 606 | finish | Navbar › Hero › Pricing › FeatureGrid › Testimonials › CTA › Footer | 11 | 100% |  |  |
| dental-booking | jev | 2 | ✓ | 716 | finish | Navbar › Hero › ContactForm › Footer | 9 | 100% |  |  |
| saas-pricing | jev | 2 | ✓ | 650 | finish | Navbar › Hero › Pricing › FAQ › Footer | 10 | 100% |  |  |
| fitness-signup | jev | 2 | ✓ | 782 | finish | Navbar › ContactForm › Footer | 8 | 100% |  |  |
| edtech-course | jev | 2 | ✓ | 615 | finish | Navbar › Hero › Stats › Testimonials › CTA › Footer | 10 | 100% |  |  |
| bank-feature | jev | 2 | ✓ | 606 | finish | Navbar › Hero › FeatureGrid › CTA › Footer | 8 | 100% |  |  |
| event-registration | jev | 2 | ✓ | 621 | finish | Navbar › Hero › FAQ › ContactForm › Footer | 13 | 100% |  |  |
| hotel-promo | jev | 2 | ✓ | 681 | finish | Navbar › Hero › FeatureGrid › Testimonials › CTA › Footer | 9 | 100% |  |  |
| minimal-waitlist | jev | 2 | ✗ | 751 | finish | Navbar › Hero › ContactForm › Footer | 8 | 100% |  | node_3 (CTA) is not a primitive but sits in slot actions |
| logistics-b2b | jev | 2 | ✓ | 634 | finish | Navbar › Hero › FeatureGrid › Stats › Testimonials › CTA › ContactForm › Footer | 16 | 100% |  |  |
| coffee-landing | llm | 1 | ✓ | 1276 | finish | Navbar › Hero › FeatureGrid › Pricing › Testimonials › Footer | 8 | 100% |  |  |
| dental-booking | llm | 1 | ✓ | 1794 | finish | Navbar › Hero › FeatureGrid › ContactForm › Footer | 11 | 100% |  |  |
| saas-pricing | llm | 1 | ✓ | 1510 | finish | Navbar › Hero › Pricing › FAQ › Footer | 7 | 100% |  |  |
| fitness-signup | llm | 1 | ✓ | 1028 | finish | Navbar › ContactForm › Footer | 7 | 100% |  |  |
| edtech-course | llm | 1 | ✓ | 1641 | finish | Navbar › Hero › Stats › FeatureGrid › Testimonials › CTA › Footer | 10 | 100% |  |  |
| bank-feature | llm | 1 | ✓ | 1229 | finish | Navbar › Hero › FeatureGrid › Stats › CTA › Footer | 9 | 100% |  |  |
| event-registration | llm | 1 | ✓ | 1255 | finish | Navbar › Hero › FeatureGrid › FAQ › ContactForm › Footer | 12 | 100% |  |  |
| hotel-promo | llm | 1 | ✓ | 1519 | finish | Navbar › Hero › FeatureGrid › Testimonials › ContactForm › Footer | 13 | 67% |  |  |
| minimal-waitlist | llm | 1 | ✓ | 1332 | finish | Navbar › Hero › ContactForm › Footer | 8 | 100% |  |  |
| logistics-b2b | llm | 1 | ✓ | 1951 | finish | Navbar › Hero › Stats › FeatureGrid › Testimonials › ContactForm › Footer | 14 | 100% |  |  |
| coffee-landing | llm | 2 | ✓ | 1232 | finish | Navbar › Hero › FeatureGrid › Pricing › Testimonials › ContactForm › Footer | 13 | 100% |  |  |
| dental-booking | llm | 2 | ✓ | 1029 | finish | Navbar › Hero › ContactForm › Footer | 10 | 100% |  |  |
| saas-pricing | llm | 2 | ✓ | 1235 | finish | Navbar › Pricing › FAQ › Footer | 5 | 100% |  |  |
| fitness-signup | llm | 2 | ✓ | 1233 | finish | Navbar › Hero › ContactForm › Footer | 9 | 100% |  |  |
| edtech-course | llm | 2 | ✓ | 1436 | finish | Navbar › Hero › Stats › Testimonials › CTA › Footer | 9 | 100% |  |  |
| bank-feature | llm | 2 | ✓ | 1128 | finish | Navbar › Hero › FeatureGrid › Stats › Pricing › Testimonials › FAQ › CTA › ContactForm › Footer | 17 | 100% |  |  |
| event-registration | llm | 2 | ✓ | 1745 | finish | Navbar › Hero › FeatureGrid › FAQ › ContactForm › Footer | 12 | 100% |  |  |
| hotel-promo | llm | 2 | ✓ | 1030 | finish | Navbar › Hero › FeatureGrid › Testimonials › CTA › Footer | 9 | 100% |  |  |
| minimal-waitlist | llm | 2 | ✓ | 1222 | finish | Navbar › Hero › ContactForm › Footer | 8 | 100% |  |  |
| logistics-b2b | llm | 2 | ✓ | 1562 | finish | Navbar › Hero › Stats › FeatureGrid › Testimonials › ContactForm › Footer | 14 | 100% |  |  |

## Routing

| prompt | expect | composer | got | confidence | ms |
|---|---|---|---|---|---|
| หน้า landing page แอปออกกำลังกาย มีฟีเจอร์ ราคา และ FAQ | new_page | jev | new_page | 0.95 | 386 |
| ทำหน้า pricing สำหรับแอปนี้ | new_page | jev | new_page | 0.99 | 260 |
| เพิ่มส่วนราคาให้หน่อย | edit_selection | jev | edit_selection | 1 | 354 |
| ทำหัวข้อให้สั้นลง | edit_selection | jev | edit_selection | 1 | 307 |
| เปลี่ยนเป็นโทนเขียว | set_theme | jev | set_theme | 0.95 | 308 |
| สร้างหน้าสมัครสมาชิก | new_page | jev | new_page | 1 | 408 |
| ลบ FAQ ออก | edit_selection | jev | edit_selection | 1 | 280 |
| เปลี่ยนข้อความทั้งหน้าเป็นร้านชานม | edit_selection | jev | edit_selection | 0.9 | 455 |
| ทำหน้า checkout ของร้าน | new_page | jev | new_page | 1 | 266 |
| dark mode please | set_theme | jev | set_theme | 1 | 264 |
| หน้า landing page แอปออกกำลังกาย มีฟีเจอร์ ราคา และ FAQ | new_page | llm | new_page | n/a | 1120 |
| ทำหน้า pricing สำหรับแอปนี้ | new_page | llm | new_page | n/a | 1020 |
| เพิ่มส่วนราคาให้หน่อย | edit_selection | llm | edit_selection | n/a | 1028 |
| ทำหัวข้อให้สั้นลง | edit_selection | llm | edit_selection | n/a | 1128 |
| เปลี่ยนเป็นโทนเขียว | set_theme | llm | set_theme | n/a | 1030 |
| สร้างหน้าสมัครสมาชิก | new_page | llm | new_page | n/a | 1350 |
| ลบ FAQ ออก | edit_selection | llm | edit_selection | n/a | 991 |
| เปลี่ยนข้อความทั้งหน้าเป็นร้านชานม | edit_selection | llm | edit_selection | n/a | 1104 |
| ทำหน้า checkout ของร้าน | new_page | llm | new_page | n/a | 976 |
| dark mode please | set_theme | llm | set_theme | n/a | 961 |
