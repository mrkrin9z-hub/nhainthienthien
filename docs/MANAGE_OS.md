# Manage OS cho xưởng in Thiên Thiên

## Quyết định

Dừng clone/vá UI từng màn theo studiobase.vn/manage.

Hướng đúng: **lấy luồng Manage (PhotoShare / StudioBase) làm nền vận hành**, rồi tối ưu thiết kế + gắn domain xưởng in (cost, BOM, kênh sàn, sản xuất, giao hàng).

## Nguồn Manage

Repo: https://github.com/mrkrin9z-hub/photosharevn/

## Blocker quyền truy cập (2026-10-20)

Cloud Agent **chưa clone được** repo trên:

- Token chỉ gắn environment `nhainthienthien` → `photosharevn` trả 404
- Repo private (GitHub web cũng 404 với token hiện tại)

Cần một trong các cách:

1. Invite GitHub App / bot Cursor vào `photosharevn` (Read)
2. Thêm `github.com/mrkrin9z-hub/photosharevn` vào Cloud Agent environment (multi-repo)
3. Tạm Public repo
4. Upload zip nhánh có `/manage` lên Drive

Sau khi có quyền: clone → khảo sát `/manage` → port shell/luồng vào `src/admin-os` + adapters domain xưởng.

## Kiến trúc 3 lớp

```
┌─────────────────────────────────────────┐
│  Admin shell (UX Manage)                │
│  menu · list+dialog · filter · ví NV    │
├─────────────────────────────────────────┤
│  Adapters                               │
│  map route/DTO Manage ↔ domain xưởng    │
├─────────────────────────────────────────┤
│  Domain Thiên Thiên (giữ nguyên lõi)    │
│  cost · BOM · kênh · SX · ví · Workers  │
└─────────────────────────────────────────┘
```

- **Không** merge schema/DB studio vào Workers/KV.
- **Không** mang lịch chụp, trang phục, chiến dịch marketing studio, Fanpage social.
- **Có** cost/BOM, trạng thái sản xuất, giao/COD, kênh marketplace — đây là phần studio không có.

## Bản đồ module

| Manage                         | Thiên Thiên                         | Ghi chú                          |
| ------------------------------ | ----------------------------------- | -------------------------------- |
| `/manage/dashboard`            | `/admin`                            | Chấm công + KPI xưởng            |
| `/manage/orders` (+ create)    | `/admin/don-hang`                   | Chưa thu, picker SP, thu → ví NV |
| `/manage/products`             | `/admin/san-pham`, `/gia`, cost     | Thêm cost/BOM                    |
| `/manage/customers`            | `/admin/khach`                      | CRM in                           |
| `/manage/wallet`               | `/admin/vi`                         | Thu → ví NV → nộp két            |
| `/manage/expenses`             | `/admin/chi-phi`, thu chi           | Giữ                              |
| `/manage/statistics`           | `/admin/bao-cao`                    | Giữ                              |
| `/manage/activity-log`         | `/admin/nhat-ky`                    | Giữ                              |
| *(không có trên studio)*       | `/admin/san-xuat`, giao, kho        | Module xưởng                     |
| calendar / garments / campaigns| —                                   | Bỏ                               |

## Thứ tự port (khi có source)

1. Nhận source Manage.
2. Tách shell UI khỏi data studio; viết adapters sang `src/domain` + `src/server/service.ts`.
3. Port theo module: **Orders → Wallet → Products+Cost → Production → Expenses → Reports**.
4. Cutover: một PR thay admin shell; đóng các nhánh vá UI nhỏ.

## Trong repo này (chờ source)

- `src/admin-os/modules.ts` — nguồn sự thật duy nhất cho menu/module (bắt đầu gom shell).
- Tiếp tục **không** thêm patch UI Manage lẻ tẻ trên nhánh cũ trừ hotfix nghiệp vụ xưởng.
