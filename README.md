# Nhà In Thiên Thiên

Website khách của tiệm in ảnh ở Xuân Lộc, Đồng Nai, và khu quản trị nội bộ giai đoạn 1 trên cùng một địa chỉ (`/admin`).

Khách chọn sản phẩm, gửi ảnh, nhận mã đơn. Đơn trên web vào thẳng sổ đơn của quán. Giá khách thấy lấy từ kênh **Tại tiệm / Web** trong bảng giá, không gõ cứng trong giao diện.

## Chạy máy local

Cần Node.js 22.

```sh
npm install
npm run dev
```

Chưa cấu hình Supabase thì ứng dụng tự tạo `data/shop.json` (không commit file này) và lưu ảnh khách trong `data/uploads`.

Tài khoản mẫu, mật khẩu chung `ThienThien#2026` (bắt buộc đổi trước khi dùng thật):

| Vai trò | Email |
|---|---|
| Chủ | chu@nhainthienthien.local |
| Sale | sale@nhainthienthien.local |
| Sản xuất | sx@nhainthienthien.local |

Sale và sản xuất không thấy giá vốn, lãi, lợi nhuận hay tổng doanh thu. Chỉ chủ thấy.

## Biến môi trường

Xem `.env.example`.

| Biến | Việc |
|---|---|
| `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` | Cơ sở dữ liệu production. Service role chỉ ở server. |
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` | Cùng dự án Supabase, dùng khi trình duyệt tải ảnh thẳng lên Storage. |
| `AUTH_SECRET` | Ký cookie đăng nhập. Ít nhất 32 ký tự. |
| `GOOGLE_DRIVE_CLIENT_EMAIL`, `GOOGLE_DRIVE_PRIVATE_KEY`, `GOOGLE_DRIVE_FOLDER_ID` | Nếu đủ ba biến, ảnh khách lên Google Drive. |
| `LOVABLE_CRON_SECRET` | Chỉ khi còn gọi cron. Cron không tự xóa ảnh. |

Thứ tự lưu ảnh:

1. Đủ biến Google Drive → upload lên thư mục Drive.
2. Không có Drive nhưng có Supabase service role → trình duyệt tải thẳng vào bucket riêng `order-originals` (không public), giống luồng cũ.
3. Không có cả hai → lưu trên đĩa máy local để chạy thử.

Bucket `order-originals` phải tồn tại trên Supabase và không được public. Ảnh gốc không bị nén lại.

## Supabase

Chạy file `supabase/migrations/20261017150000_shop_state.sql` trên dự án (SQL editor hoặc CLI). Bảng `shop_state` chỉ service role đọc được. Lần đầu app chạy sẽ ghi sổ mẫu vào đó.

Các bảng cũ của bản Lovable vẫn còn, app giai đoạn này không dùng nữa.

## Đưa lên Cloudflare

Bản build dùng Nitro, đích mặc định là Cloudflare Workers.

```sh
npm run build
npx wrangler deploy --config .output/server/wrangler.json
```

Đặt các biến ở trên trong Cloudflare (Settings → Variables), gồm `AUTH_SECRET` và khóa Supabase. Không đưa `SUPABASE_SERVICE_ROLE_KEY` ra code giao diện.

Có thể tiếp tục gắn repo với Lovable nếu muốn host cũ: push nhánh, Lovable build lại. Vẫn cần service role và migration, nếu không app sẽ không có chỗ ghi sổ trên Workers (Workers không giữ file `data/`).

Tên miền dự kiến `nhainthienthien.com`. Quản trị nằm tại `https://nhainthienthien.com/admin`, không tách subdomain.

## Số liệu

Giá bán để trống, trừ combo 4 tấm 13×18 kênh TikTok là 249.000đ (số có trong đặc tả). Giá túi bọc ảnh, carton, tem nhiệt, phí ship Facebook và định mức nam châm xe để trống. Chủ sửa trong Quản trị → Cài đặt / Kho / Bảng giá.

Lương sale phương án A: 8.000.000đ (thử việc 85%). Sản xuất: 11.000.000đ. Giờ ca 8:00–18:00. Ngày nghỉ trong tuần để trống vì JD ghi làm hằng ngày; chủ chọn ngày nghỉ trong Cài đặt. Mức trừ đi trễ và vắng để trống cho đến khi chủ nhập.

Ảnh thẻ và album tắt. Bật trong Cài đặt khi tiệm nhận làm.

Cảnh báo lãi: vàng khi lãi gộp dưới 30%, đỏ khi lỗ. Hai ngưỡng sửa được.

Kho trừ vật tư in khi đơn sang bước **In**, trừ túi / xốp / carton / băng keo / tem khi sang bước **Giao** (đóng gói xong). Không dùng thùng, không túi zip.

## Kiểm tra

```sh
npm test
npm run build
```
