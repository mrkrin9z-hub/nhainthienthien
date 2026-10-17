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
3. Có `SHOP_KV` mà không có R2 → khóa `upload:<id>` nếu ảnh không quá 10MB. Trang đặt in hiện câu **Mỗi ảnh tối đa 10MB** và báo lỗi rõ khi ảnh vượt mức (API trả 400, không 500).
4. Có Supabase service role → bucket `order-originals` (server ghi, bucket không public).
5. Máy local → `data/uploads`, cùng mức 10MB khi không có R2, Drive hay Supabase.

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
4. Ảnh khách đi vào `SHOP_KV` (tối đa 10MB mỗi ảnh). Tài khoản chưa bật R2 thì **không** khai báo `r2_buckets` — binding đó làm deploy lỗi. Khi R2 bật, thêm vào `wrangler.jsonc` rồi build lại:

```jsonc
"r2_buckets": [{ "binding": "ORDER_FILES", "bucket_name": "nhainthienthien-files" }]
```

5. File tĩnh (CSS, JS, ảnh thương hiệu). Nếu không upload được Assets qua API, tạo namespace thứ hai và nạp từ đĩa:

```sh
npx wrangler kv namespace create ASSETS_KV
```

Thay `11111111111111111111111111111111` trong `wrangler.jsonc` bằng id đó. Nitro vẫn ghi binding `ASSETS` vào `.output/server/wrangler.json`. Nếu API upload static không chạy, xóa khối `assets` trong file đó trước khi deploy. Khi binding `ASSETS` không có, worker lấy file từ `ASSETS_KV`: pathname là khóa (`/assets/...`, `/brand/...`). Đường `/` vẫn do SSR trả, không lấy `index.html` trong KV.

```sh
npm run build
node scripts/pack-assets-kv.mjs
npx wrangler kv bulk put .output/assets-kv.json --namespace-id <id ASSETS_KV>
```

6. Build và deploy. Nitro gộp `wrangler.jsonc` vào file sinh ra:

```sh
npm run build
npx wrangler deploy --config .output/server/wrangler.json
```

Id KV giữ chỗ sẽ bị Cloudflare từ chối. Phải thay id thật ở bước 3 rồi build lại.

Không bắt buộc biến môi trường cho bản chạy thử. Đặt `AUTH_SECRET` (Cloudflare → Settings → Variables) trước khi cho nhân viên đăng nhập thật. Cookie dùng khóa mẫu nếu bỏ trống.

Tên miền dự kiến `nhainthienthien.com`. Quản trị nằm tại `/admin`.

## Số liệu

Giá bán lấy từ bảng chủ duyệt ngày 17/10/2026 (sheet Gia của bảng theo kênh, khớp bảng trực tiếp, Facebook và combo FINAL). Kênh **Tại tiệm / Web** là giá trang khách. Mã chưa có số để trạng thái nháp, nên trang khách không hiện **Liên hệ** cho sản phẩm đã có giá tại tiệm. Không lấy giá thử của bản cũ.

Giá túi bọc ảnh, carton, tem nhiệt, phí ship Facebook thật và định mức nam châm xe để trống. Chính sách ship khách ghi trong file Facebook (25.000 / 40.000) không ghi vào cài đặt. Chủ sửa trong Quản trị → Cài đặt / Kho / Bảng giá.

Ảnh tráng gương hiện trên web. Ép gỗ chỉ có giá từ 40×60. Ảnh thờ và giấy khen chỉ có giá tấm lẻ (ảnh thờ từ 20×30; giấy khen A5, A4, A3). Thời khóa biểu và ảnh lụa có giá trong sổ nhưng nhóm đang ẩn. Nam châm xe chỉ còn 9×19 và 17×22. Gói lụa một vài mức không giảm giá mỗi tấm — sổ giữ đúng số trong file và cảnh báo combo.

Lương sale phương án A: 8.000.000đ (thử việc 85%). Sản xuất: 11.000.000đ. Giờ ca 8:00–18:00. Ngày nghỉ trong tuần để trống vì JD ghi làm hằng ngày; chủ chọn ngày nghỉ trong Cài đặt. Mức trừ đi trễ và vắng để trống cho đến khi chủ nhập.

Ảnh thẻ và album tắt. Bật trong Cài đặt khi tiệm nhận làm. Số Zalo `0778662227` hiện trên web; tắt ở ô **Hiện số Zalo trên web** trong Cài đặt.

Cảnh báo lãi: vàng khi lãi gộp dưới 30%, đỏ khi lỗ. Hai ngưỡng sửa được.

Kho trừ vật tư in khi đơn sang bước **In**, trừ túi / xốp / carton / băng keo / tem khi sang bước **Giao** (đóng gói xong). Lùi bước hoặc hủy thì hoàn đúng số đã trừ. Không dùng thùng, không túi zip. Nam châm xe chỉ còn size 9×19 và 17×22.

## Sau bản sửa deploy Workers

Worker đọc `ASSETS_KV` từ binding `cloudflare:workers`, không từ tham số `env` của `fetch` (lớp bọc chỉ truyền request). Deploy lại worker là đủ nếu khóa file tĩnh đã nạp. Xóa khối `assets` trong `.output/server/wrangler.json` khi API upload static không chạy.

Lần đăng nhập đầu của tài khoản mẫu bắt đổi mật khẩu ngay trên trang quản trị. Chủ bật mã 6 số ở **Tài khoản**. Nhật ký, sao lưu và **Kết nối** chỉ chủ xem.

Sao lưu hằng ngày dùng khóa cố định `shop_backup:YYYY-MM-DD` theo giờ Việt Nam (ghi đè, không tạo thêm bản khi list KV bị trễ), giữ 30 ngày. **Sao lưu ngay** ghi `shop_backup:manual:<mốc>` và giữ 10 bản. Khôi phục không đổi tài khoản, mật khẩu hay mã 2 lớp.

Ảnh bìa có số Zalo in sẵn đã bỏ. Ảnh sản phẩm trên web là ảnh mẫu cho đến khi chủ hoặc sale tải ảnh thật ở **Ảnh web** (lưu KV, tối đa 2MB).

Đơn TikTok/Shopee nhập từ file CSV hoặc XLSX ở **Nhập đơn sàn**. Cột nhận: mã đơn, SKU người bán, tên, số lượng, người nhận, điện thoại, địa chỉ, hãng, mã vận đơn, phí ship, COD. SKU sàn map sang mã tiệm; dòng chưa map không tạo đơn. Đơn vào trạng thái Nhận đơn, kho trừ khi chuyển In và Giao. API sau này dùng cùng cổng `MarketplaceOrderAdapter`, chưa gọi.

**Giao hàng** ghi hãng, mã vận đơn, phí ship và COD. **Đối soát COD** cộng theo hãng trong tháng. Tem 100×150mm in từ trình duyệt cho đơn tại tiệm và Facebook. Sản xuất không xuất Excel đơn hoặc tồn kho.

## Kiểm tra

```sh
npm ci
npm test
npm run build
```
