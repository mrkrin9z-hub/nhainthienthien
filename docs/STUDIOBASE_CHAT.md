# Chat + đơn in (StudioBase Partner Chat)

Ứ dụng inbox tư vấn và **tạo đơn gắn hội thoại** cho xưởng in Thiên Thiên. Kênh Fanpage/Zalo kết nối trên StudioBase; app chỉ dùng API key.

## Map thuật ngữ

| StudioBase | UI xưởng in |
|---|---|
| Ngày chụp (`photo_date`) | Ngày nhận / hẹn in (`is_photo_date_tbd` nếu chưa chốt) |
| Đã chụp | Đã nhận file từ khách |
| Gửi ảnh gốc | Khách duyệt file / chọn size |
| Chỉnh sửa | Retouch trước in |
| Đã gửi in | Đưa vào máy in |
| Đã có hình / giao | In xong / đã giao |

## Cấu hình

1. StudioBase → `/manage/settings/partner-chat` tạo API key.
2. Thiên Thiên → **Quản trị → Kết nối → StudioBase Partner Chat** lưu:
   - Chat API key
   - Supabase anon / publishable key
   - Webhook secret (tuỳ chọn)
3. Đăng ký webhook HTTPS: `{origin}/api/public/studiobase-webhook`  
   Header: `X-StudioBase-Signature: sha256=<HMAC-SHA256(raw_body, secret)>`

Env dự phòng (không bắt buộc nếu đã lưu KV): `STUDIOBASE_CHAT_API_KEY`, `STUDIOBASE_ANON_KEY`, `STUDIOBASE_WEBHOOK_SECRET`.

## App

- Menu **Chat** (`/admin/chat`) — owner & sale
- Layout 3 cột: hội thoại | khung chat | panel thông tin/đơn
- Poll 5–8s; webhook ghi nhận idempotent (client vẫn poll)

## Code

- Client API: `src/server/studiobase.ts`
- Server fn: `src/lib/chat.functions.ts`
- UI: `src/routes/admin.chat.tsx`
- Webhook: `src/routes/api/public/studiobase-webhook.ts`
