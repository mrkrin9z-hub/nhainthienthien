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
  └─ bridge modules → deep-link StudioBase Manage (phase 2–4)
```

- Partner Chat API: inbox + tạo đơn gắn hội thoại — xem `docs/STUDIOBASE_CHAT.md`
- **Không** OAuth Meta/Zalo trong app; **không** garment / AI tools studio-chụp
- **Giữ** QR khách gửi ảnh, album, thu→ví NV, sản xuất, kho…

## Bản đồ module (`src/admin-os/modules.ts`)

| Nhóm | Live (app) | Bridge (Manage) |
|---|---|---|
| Kinh doanh | Chat, Đơn, Khách, Thu, Nhắc khách | Chiến dịch |
| Sản xuất | SX, Giao, SP, Giá, Kho, Album | Lịch, Công việc |
| Vận hành | NV, Chấm công, Lương, Tài khoản | Nhóm quyền, Bộ phận, Cửa hàng |
| Tài chính | Ví, Chi phí, Thu chi, Báo cáo, KPI | Mục tiêu, SePay |
| Hệ thống | Kết nối, Sao lưu, Nhật ký, Cài đặt | Tin mẫu, Push, Đánh giá, TB nội bộ, Tài liệu, Gói, Hướng dẫn |

Ẩn: `/manage/garments`, `/manage/tools`.

## Phase

1. ✅ Chat + đơn từ hội thoại (Partner API) + QR/upload/album domain xưởng  
2. Staff/roles/branches + list đơn lifecycle đầy đủ (API hoặc bridge)  
3. Ví SePay + thống kê sâu  
4. Drive/tin mẫu/social/HĐĐT/push…

## Code

- Menu: `src/admin-os/modules.ts`
- Bridge: `src/admin-os/bridges.ts`, `src/routes/admin.studio.$slug.tsx`
- Chat: `src/routes/admin.chat.tsx`, `src/server/studiobase.ts`
