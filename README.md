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

## Hướng dẫn dùng cho anh

1. Mở `/admin`. Lần đầu đăng nhập bằng tài khoản mẫu ở bảng trên. Trang sẽ bắt đặt mật khẩu mới (ít nhất 8 ký tự) trước khi vào sổ.
2. Vào **Tài khoản**, bật mã 6 số (2 lớp). Lần sau đăng nhập nhập thêm mã trong app xác thực.
3. Vào **Cài đặt → Tài khoản** để thêm nhân viên. Chọn vai trò chủ, sale hoặc sản xuất. Đưa mật khẩu tạm và bảo họ đổi ở lần đăng nhập đầu.
4. Vào **Bảng giá** để nhập giá bán còn trống. Vào **Kho** để nhập giá mua vật tư. Vào **Báo cáo** để sửa chi phí cố định từng tháng. Chi phí phát sinh (điện, sửa máy,…) ghi ở **Chi phí và lợi nhuận**. Lãi ròng = lãi gộp − chi phí cố định − chi phí phát sinh.
5. Đang một người sale thì để **Cài đặt → Cách tính hoa hồng** là **Toàn tiệm**. Khi có từ hai sale, chuyển sang **Theo đơn người đó xử lý**. Hoa hồng tính theo tháng: đến 100 triệu lấy 3%, phần 100–200 triệu lấy 5%, phần trên 200 triệu lấy 7%. Ví dụ 49,1 triệu thì hoa hồng 1.473.000đ.
6. Đơn TikTok: vào **Nhập đơn sàn**, chọn TikTok, tải file CSV hoặc Excel từ Seller Center. Lần đầu gắn mã SKU trên sàn với mã trong tiệm, rồi nhập. Đơn Shopee làm tương tự.
7. In tem 100×150: mở đơn tại tiệm hoặc Facebook, bấm **In tem 100×150**, rồi in từ trình duyệt. Đơn TikTok và Shopee dùng tem của sàn, không in tem này.

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

Lương sale phương án A: 8.000.000đ (thử việc 85%). Sản xuất: 11.000.000đ. Giờ ca 8:00–18:00. Ngày nghỉ trong tuần để trống vì hợp đồng ghi làm hằng ngày; chủ chọn ngày nghỉ trong Cài đặt. Mức trừ đi trễ và vắng để trống cho đến khi chủ nhập. Hoa hồng sale mặc định tính trên doanh thu đã thu của cả tiệm. Chủ đổi sang theo đơn từng người trong Cài đặt khi có từ hai sale.

Ảnh thẻ và album tắt. Bật trong Cài đặt khi tiệm nhận làm. Số Zalo `0778662227` hiện trên web; tắt ở ô **Hiện số Zalo trên web** trong Cài đặt.

Cảnh báo lãi: vàng khi lãi gộp dưới 30%, đỏ khi lỗ. Hai ngưỡng sửa được.

Kho trừ vật tư in khi đơn sang bước **In**, trừ túi / xốp / carton / băng keo / tem khi sang bước **Giao** (đóng gói xong). Lùi bước hoặc hủy thì hoàn đúng số đã trừ. Không dùng thùng, không túi zip. Nam châm xe chỉ còn size 9×19 và 17×22.

## Sau bản sửa deploy Workers

Worker đọc `ASSETS_KV` từ binding `cloudflare:workers`, không từ tham số `env` của `fetch` (lớp bọc chỉ truyền request). Deploy lại worker là đủ nếu khóa file tĩnh đã nạp. Xóa khối `assets` trong `.output/server/wrangler.json` khi API upload static không chạy.

Lần đăng nhập đầu của tài khoản mẫu bắt đổi mật khẩu ngay trên trang quản trị. Chủ bật mã 6 số ở **Tài khoản**. Nhật ký, sao lưu và **Kết nối** chỉ chủ xem.

Sao lưu hằng ngày dùng khóa cố định `shop_backup:YYYY-MM-DD` theo giờ Việt Nam (ghi đè, không tạo thêm bản khi list KV bị trễ), giữ 30 ngày. **Sao lưu ngay** ghi `shop_backup:manual:<mốc>` và giữ 10 bản. Khôi phục không đổi tài khoản, mật khẩu hay mã 2 lớp.

Ảnh bìa có số Zalo in sẵn đã bỏ. Ảnh sản phẩm trên web là ảnh mẫu cho đến khi chủ hoặc sale tải ảnh thật ở **Ảnh web** (lưu KV, tối đa 2MB).

Đơn TikTok/Shopee nhập từ file CSV hoặc XLSX ở **Nhập đơn sàn**. Tiêu đề khớp gần đúng. Dòng mô tả TikTok bị bỏ. Địa chỉ Shopee lấy nguyên cột Địa chỉ nhận hàng, quốc gia để cuối. TikTok ghép cả phường/xã. Số bị che vẫn nhập. Hai người cùng một số che không gộp, trừ khi cùng tài khoản sàn hoặc trùng cả tên và địa chỉ. File sàn không ghi đè tên và địa chỉ đã nhập tại tiệm; địa chỉ mới được thêm vào danh sách. COD khi giao hoặc khi nhận bằng số tiền người mua trả, gồm phí ship. Tiền dòng là tiền sàn. Đơn Đã hủy không vào sổ.

**Khách** gộp theo số điện thoại thật, kể cả khác kênh. Số bị che giữ riêng theo tài khoản sàn. Khách chỉ còn đơn hủy được ẩn, bật lại được. Có thẻ, ghi chú, tổng đã chi, cờ khách quay lại (mặc định từ 2 đơn). **Nhắc khách** liệt kê đơn cuối cách đây ít nhất 60 ngày và ngày giỗ trong 7 ngày tới. Tin nhắn chép tay, không tự gửi. Sale xem khách, không xem giá vốn.

**Báo cáo** (chủ): doanh thu, lãi gộp, chi phí cố định (mặc định 29.400.000đ/tháng), chi phí phát sinh ghi riêng, lãi ròng = lãi gộp − cố định − phát sinh, hòa vốn, theo ngày/tuần/tháng, kênh, khổ và hàng bán nhiều. **Kho** ước mức dùng 30 ngày và báo đặt hàng khi số ngày tồn dưới ngưỡng từng vật tư (mặc định 7). **KPI**, **Tổng quan**, **Lương** và file Excel lương dùng cùng một cách tính hoa hồng. Tháng của lương, hoa hồng, KPI, báo cáo, đối soát COD và sao lưu lấy theo giờ Việt Nam. Sale chỉ thấy KPI của mình.

Có thể thêm trang quản trị vào Màn hình chính trên iPhone. Khi mất mạng, máy hiện trang nhắc mở lại.

**Giao hàng** ghi hãng, mã vận đơn, phí ship và COD. **Đối soát COD** cộng theo hãng trong tháng. Tem 100×150mm in từ trình duyệt cho đơn tại tiệm và Facebook. Sản xuất không xuất Excel đơn hoặc tồn kho.

## Kiểm tra

```sh
npm ci
npm test
npm run build
```
