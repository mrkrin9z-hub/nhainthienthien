# Manage OS cho xưởng in Thiên Thiên

## Quyết định

Clone vận hành StudioBase với UI in ấn. **Kênh bán = nhánh** (`tai_tiem` offline, `facebook` online, `tiktok`, `shopee`) — không có màn chi nhánh/bộ phận riêng.

## Đã lược

Chiến dịch, chi nhánh, bộ phận, TB nội bộ, tài liệu, hướng dẫn admin. Tin mẫu local — dùng StudioBase Chat / Manage.

## Live lõi

Chat, đơn, khách, thu, nhắc khách, SX/giao/lịch/công việc, SP, **gói dịch vụ (bán tại xưởng)**, giá, kho, album, NV/chấm công/lương, **nhóm quyền (ẩn menu)**, ví/chi/KPI/mục tiêu, **SePay webhook tự thu**, kết nối, sao lưu, **thông báo PC/PWA**, nhật ký, đánh giá, cài đặt.

## Deep-link

| Màn | StudioBase |
|---|---|
| Tin mẫu & kênh | `/manage/messages/settings` + chat.studiobase.vn |

## SePay

`POST /api/public/sepay` — khớp mã CK (= mã đơn VietQR `TTyymmdd-nnn`) → ghi thu `SePay / chuyển khoản`. Cấu hình API Key + bật ở `/admin/sepay`. Trên SePay: tiền tố `TT`, Money in.

## Code

- Menu: `src/admin-os/modules.ts`
- SePay: `src/domain/sepay.ts`, `src/routes/api/public/sepay.ts`
- Quyền menu: `roleModules` + `modulesForRole(role, me.modules)`
