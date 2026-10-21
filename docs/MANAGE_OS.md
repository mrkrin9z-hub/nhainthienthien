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
  └─ deep-link StudioBase chỉ khi bắt buộc OAuth / VAPID / billing
```

- Partner Chat API: inbox + tạo đơn gắn hội thoại — xem `docs/STUDIOBASE_CHAT.md`
- **Không** OAuth Meta/Zalo trong app; **không** garment / AI tools studio-chụp
- **Giữ** QR khách gửi ảnh, album, thu→ví NV, sản xuất, kho…

## Bản đồ module (`src/admin-os/modules.ts`)

Tất cả mục menu Manage OS là **live** trong app. Deep-link StudioBase chỉ còn nút phụ trong:

| Màn app | Deep-link Manage |
|---|---|
| Tin mẫu & kênh | `/manage/messages/settings` (OAuth Fanpage/Zalo) |
| Thông báo đẩy | `/manage/settings/notifications` (VAPID / Web Push) |
| Gói dịch vụ | `/manage/subscription` |
| SePay | `/manage/settings/sepay` (tuỳ chọn) |

Ẩn: `/manage/garments`, `/manage/tools`.

## Phase

1. ✅ Chat + đơn từ hội thoại (Partner API) + QR/upload/album  
2. ✅ Lịch / Công việc + chi nhánh / bộ phận / nhóm quyền  
3. ✅ Mục tiêu KPI + SePay stub  
4. ✅ Đánh giá, TB nội bộ, tài liệu, hướng dẫn, chiến dịch, tin mẫu local, prefs thông báo, gói (matrix + deep-link)  

## Code

- Menu: `src/admin-os/modules.ts`
- Deep-link helper: `src/admin-os/bridges.ts` (`studioManageUrl`)
- Org + extend: `src/domain/org-desk.ts`
- Chat: `src/routes/admin.chat.tsx`, `src/server/studiobase.ts`
