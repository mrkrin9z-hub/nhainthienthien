# Facebook login qua StudioBase (không dùng data StudioBase)

Hai hệ thống **độc lập**.

| | Thiên Thiên | StudioBase |
|---|---|---|
| Chat / tin nhắn | Local (KV / ShopState) | Không kéo sang |
| Đơn, khách, ví… | Local | Không kéo sang |
| Facebook Developer App | Không cần đăng ký mới | Cho mượn app Meta để **ủy quyền login / nối Fanpage** |

## Cấu hình

1. Chủ lấy khóa ủy quyền tại StudioBase (Partner / khóa Meta app).
2. Thiên Thiên → **Quản trị → Kết nối → Facebook login (qua StudioBase)**:
   - Khóa ủy quyền StudioBase
   - Webhook secret (tuỳ chọn)
   - Token trang Facebook (local)
3. Webhook (nếu dùng): `{origin}/api/public/studiobase-webhook`  
   Sự kiện Meta chỉ được **ghi vào chat local**, không mở inbox StudioBase.

## App

- Menu **Chat** (`/admin/chat`) — inbox Thiên Thiên (owner & sale)
- Menu **Tin mẫu** (`/admin/tin-mau`) — local
- Không còn màn “Mở trên StudioBase” / bridge Manage cho chi nhánh, lịch, …

## Code

- Chat local: `src/domain/shop-chat.ts`, `src/lib/chat.functions.ts`, `src/routes/admin.chat.tsx`
- Ủy quyền: `src/server/studiobase.ts` (không còn Partner Chat list/send)
- Webhook → local: `src/routes/api/public/studiobase-webhook.ts`
