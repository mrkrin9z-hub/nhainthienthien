# Fanpage Nhà In + quyền Meta App

Hai hệ thống **độc lập**.

| | Thiên Thiên | StudioBase |
|---|---|---|
| Chat / tin nhắn | Local — chỉ Fanpage Nhà In | **Không** kéo inbox sang |
| Đơn, khách, ví | Local | Không |
| Meta Developer App | Không cần đăng ký mới | Cho mượn **quyền app Meta** đã duyệt |

## Cách nối đúng

1. Dùng app Meta đã được cấp quyền (App ID lưu ở Kết nối — không phải Partner Chat inbox).
2. Lấy **Page access token** của Fanpage **Nhà In Thiên Thiên** (page của mình).
3. Thiên Thiên → **Kết nối → Fanpage Nhà In** → dán token → **Nối Fanpage**.
4. Trên Meta: Callback URL = `{origin}/api/public/meta-webhook`, Verify Token = token app hiển thị sau khi nối.
5. Menu **Chat** chỉ hiện hội thoại của page đó (Graph API + webhook → KV local).

## Không làm

- Không gọi Partner Chat API để list hội thoại StudioBase.
- Không deep-link Manage StudioBase cho inbox vận hành.

## Code

- Meta page: `src/domain/meta-page.ts`, `src/server/meta-messenger.ts`
- Webhook: `src/routes/api/public/meta-webhook.ts`
- Chat UI: `src/routes/admin.chat.tsx`
