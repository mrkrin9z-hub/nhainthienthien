# Nhà In Thiên Thiên

Website khách của tiệm in ảnh ở Xuân Lộc, Đồng Nai, và khu quản trị nội bộ giai đoạn 1 trên cùng một địa chỉ (`/admin`).

Khách chọn sản phẩm, gửi ảnh, nhận mã đơn. Đơn trên web vào thẳng sổ đơn của quán. Giá khách thấy lấy từ kênh **Tại tiệm / Web** trong bảng giá, không gõ cứng trong giao diện.

## Chạy máy local

Cần **Node.js 22 trở lên**. Node 20 dừng với lỗi `native WebSocket not found`. File `.nvmrc` ghi `22`.

```sh
nvm use
npm install
npm run dev
```

Chưa cấu hình Supabase và không có binding `SHOP_KV` thì ứng dụng tự tạo `data/shop.json` (không commit) và lưu ảnh khách trong `data/uploads`.

Tài khoản mẫu, mật khẩu chung `ThienThien#2026` (bắt buộc đổi trước khi dùng thật):

| Vai trò | Email |
|---|---|
| Chủ | chu@nhainthienthien.local |
| Sale | sale@nhainthienthien.local |
| Sản xuất | sx@nhainthienthien.local |

Sale và sản xuất không thấy giá vốn, lãi, lợi nhuận hay tổng doanh thu. Chỉ chủ thấy.

## Chỗ ghi sổ và ảnh

Thứ tự sổ đơn:

1. Có `SUPABASE_URL` và `SUPABASE_SERVICE_ROLE_KEY` → bảng `shop_state`.
2. Có binding Cloudflare `SHOP_KV` → khóa `shop_state` (có kiểm tra số phiên bản).
3. Máy local → file `data/shop.json`.

Workers không có (1) và (2) thì báo lỗi, không ghi đĩa (ghi đĩa trên Workers bị `operation not permitted`).

Thứ tự ảnh khách. Trình duyệt luôn gửi ảnh về `/api/public/upload` của chính server này, không tải thẳng lên dự án Supabase nào.

1. Đủ 3 biến Google Drive → thư mục Drive.
2. Có binding R2 `ORDER_FILES` → bucket đó.
3. Có `SHOP_KV` mà không có R2 → khóa `upload:<id>` nếu ảnh không quá 10MB.
4. Có Supabase service role → bucket `order-originals` (server ghi, bucket không public).
5. Máy local → `data/uploads`.

Ảnh gốc được giữ **6 tháng sau khi đơn xong** rồi xoá (`fileRetentionDays`, mặc định 180). Video đóng gói giữ `videoRetentionDays` ngày (mặc định 30) kể từ lúc tải lên. App tự quét khi có người mở catalog. Cron `POST /api/public/cleanup-files` cũng xoá, nếu đặt `LOVABLE_CRON_SECRET`.

## Biến môi trường

Xem `.env.example`. File `.env` không commit.

| Biến | Việc |
|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` | Sổ đơn trên Supabase. Không cần nếu dùng KV. |
| `AUTH_SECRET` | Ký cookie đăng nhập. Ít nhất 32 ký tự. Nên đặt trước khi dùng thật. |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Ảnh lên Drive nếu đủ ba biến. |
| `LOVABLE_CRON_SECRET` | Chỉ khi gọi cron dọn file. |

## Supabase

Chạy file `supabase/migrations/20261017150000_shop_state.sql` trên dự án (SQL editor hoặc CLI). Bảng `shop_state` chỉ service role đọc được. Lần đầu app chạy sẽ ghi sổ mẫu vào đó.

## Đưa lên Cloudflare Workers, không cần khóa ngoài

Mục tiêu: `workers.dev` chỉ với tài khoản Cloudflare. Không cần Supabase hay Google.

1. Cài Wrangler và đăng nhập: `npx wrangler login`
2. Tạo KV và lấy id:

```sh
npx wrangler kv namespace create SHOP_KV
```

3. Mở `wrangler.jsonc`, thay `00000000000000000000000000000000` bằng id vừa in ra (cả `id` và `preview_id` nếu chỉ có một namespace).
4. Tạo bucket ảnh:

```sh
npx wrangler r2 bucket create nhainthienthien-files
```

Binding trong `wrangler.jsonc` là `ORDER_FILES`. Ảnh nhỏ vẫn vào KV nếu bỏ binding này, nhưng ảnh trên 10MB cần R2.

5. Build và deploy. Nitro gộp `wrangler.jsonc` vào file sinh ra:

```sh
npm run build
npx wrangler deploy --config .output/server/wrangler.json
```

Id KV giữ chỗ sẽ bị Cloudflare từ chối. Phải thay id thật ở bước 3 rồi build lại.

Không bắt buộc biến môi trường cho bản chạy thử. Đặt `AUTH_SECRET` (Cloudflare → Settings → Variables) trước khi cho nhân viên đăng nhập thật. Cookie dùng khóa mẫu nếu bỏ trống.

Tên miền dự kiến `nhainthienthien.com`. Quản trị nằm tại `/admin`.

## Số liệu

Giá bán để trống, trừ combo 4 tấm 13×18 kênh TikTok là 249.000đ — số duy nhất có trong đặc tả. File bảng giá theo kênh không có trong repo, nên kênh **Tại tiệm / Web** vẫn trống và trang khách hiện **Liên hệ** cho đến khi chủ nhập giá trong Quản trị → Bảng giá. Không lấy giá thử của bản cũ.

Giá túi bọc ảnh, carton, tem nhiệt, phí ship Facebook và định mức nam châm xe để trống. Chủ sửa trong Quản trị → Cài đặt / Kho / Bảng giá.

Lương sale phương án A: 8.000.000đ (thử việc 85%). Sản xuất: 11.000.000đ. Giờ ca 8:00–18:00. Ngày nghỉ trong tuần để trống vì JD ghi làm hằng ngày; chủ chọn ngày nghỉ trong Cài đặt. Mức trừ đi trễ và vắng để trống cho đến khi chủ nhập.

Ảnh thẻ và album tắt. Bật trong Cài đặt khi tiệm nhận làm. Số Zalo `0778662227` hiện trên web; tắt ở ô **Hiện số Zalo trên web** trong Cài đặt.

Cảnh báo lãi: vàng khi lãi gộp dưới 30%, đỏ khi lỗ. Hai ngưỡng sửa được.

Kho trừ vật tư in khi đơn sang bước **In**, trừ túi / xốp / carton / băng keo / tem khi sang bước **Giao** (đóng gói xong). Lùi bước hoặc hủy thì hoàn đúng số đã trừ. Không dùng thùng, không túi zip. Nam châm xe chỉ còn size 9×19 và 17×22.

## Kiểm tra

```sh
npm test
npm run build
```
