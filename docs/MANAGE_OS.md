# Manage OS cho xưởng in Thiên Thiên

## Quyết định

UI vận hành xưởng in **độc lập**. StudioBase chỉ dùng để **ủy quyền Facebook** (app Meta sẵn có), không lấy tin nhắn / đơn / catalog StudioBase.

**Kênh bán = nhánh** (`tai_tiem` offline, `facebook` online, `tiktok`, `shopee`) — không có màn chi nhánh/bộ phận riêng.

## Đã lược

Chiến dịch, chi nhánh, bộ phận, TB nội bộ, tài liệu, hướng dẫn admin. **Không còn bridge “Mở trên StudioBase”.**

## Live lõi

Chat **local**, đơn, khách, thu, nhắc khách, SX/giao/lịch/công việc, SP, **gói dịch vụ (bán tại xưởng)**, giá, kho, album, NV/chấm công/lương, **nhóm quyền**, ví/chi/KPI/mục tiêu, **SePay webhook tự thu**, kết nối (Facebook login qua StudioBase), sao lưu, **thông báo PC/PWA**, nhật ký, đánh giá, cài đặt, **tin mẫu local**.

## SePay

`POST /api/public/sepay` — khớp mã CK (= mã đơn VietQR `TTyymmdd-nnn`) → ghi thu. Cấu hình ở `/admin/sepay`.

## Code

- Menu: `src/admin-os/modules.ts`
- Chat local: `src/domain/shop-chat.ts`
- SePay: `src/domain/sepay.ts`, `src/routes/api/public/sepay.ts`
- Quyền menu: `roleModules` + `modulesForRole(role, me.modules)`
