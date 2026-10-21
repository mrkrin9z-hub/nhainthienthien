# Manage OS cho xưởng in Thiên Thiên

## Quyết định

**Clone vận hành StudioBase** (chat, đơn, ví, NV, quyền, báo cáo…) với UI riêng tối ưu **in ấn**. Data/nghiệp vụ bám StudioBase; app Thiên Thiên giữ domain xưởng (cost, BOM, QR gửi ảnh, album, kho…).

## Mapping thuật ngữ

| StudioBase | Xưởng in |
|---|---|
| Ngày chụp | Ngày nhận / hẹn in |
| Đã chụp | Đã nhận file |
| Gửi ảnh gốc | Khách duyệt / chọn size |
| Chỉnh sửa | Xử lý trước in |
| Đã gửi in | Đưa vào máy in |
| Đã giao | Giao khách |

## Kiến trúc

```
UI Thiên Thiên (shell + brand)
  ├─ live modules → Workers/KV domain xưởng + Partner Chat API
  └─ bridge modules → deep-link StudioBase Manage (OAuth / gói / push / ads)
```

- Partner Chat API: inbox + tạo đơn gắn hội thoại — xem `docs/STUDIOBASE_CHAT.md`
- **Không** OAuth Meta/Zalo trong app; **không** garment / AI tools studio-chụp
- **Giữ** QR khách gửi ảnh, album, thu→ví NV, sản xuất, kho…

## Bản đồ module (`src/admin-os/modules.ts`)

| Nhóm | Live (app) | Bridge (Manage) |
|---|---|---|
| Kinh doanh | Chat, Đơn, Khách, Thu, Nhắc khách | Chiến dịch |
| Sản xuất | SX, Giao, Lịch, Công việc, SP, Giá, Kho, Album | — |
| Vận hành | NV, Chấm công, Lương, Nhóm quyền, Bộ phận, Cửa hàng, Tài khoản | — |
| Tài chính | Ví, Chi phí, Báo cáo chi, Thu chi, Báo cáo, KPI, Mục tiêu, SePay stub | — |
| Hệ thống | Kết nối, Sao lưu, Nhật ký, Đánh giá, TB nội bộ, Tài liệu, Hướng dẫn, Cài đặt | Tin mẫu, Push, Gói |

Ẩn: `/manage/garments`, `/manage/tools`.

## Phase

1. ✅ Chat + đơn từ hội thoại (Partner API) + QR/upload/album domain xưởng  
2. ✅ Lịch / Công việc + chi nhánh / bộ phận / nhóm quyền local (`shop_state`)  
3. ✅ Mục tiêu KPI + cấu hình SePay stub (webhook path; OAuth đầy đủ vẫn Manage)  
4. ✅ Đánh giá ĐH, TB nội bộ, tài liệu, hướng dẫn local; tin mẫu / push / gói vẫn bridge  

## Code

- Menu: `src/admin-os/modules.ts`
- Bridge còn lại: `src/admin-os/bridges.ts`, `src/routes/admin.studio.$slug.tsx`
- Org: `src/domain/org-desk.ts`, `/admin/chi-nhanh`, `/admin/bo-phan`, `/admin/nhom-quyen`
- Lịch / công việc: `src/routes/admin.lich.tsx`, `src/routes/admin.cong-viec.tsx`, `src/domain/ops-desk.ts`
- Chat: `src/routes/admin.chat.tsx`, `src/server/studiobase.ts`
