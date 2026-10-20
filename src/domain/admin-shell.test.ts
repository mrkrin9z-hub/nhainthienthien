import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { marketplaceEditLocked, orderRevisionBlock } from "./order-edit.ts";

test("đơn đã trừ kho hoặc đã xong thì không sửa sản phẩm", () => {
  assert.equal(orderRevisionBlock({ status: "nhan_don", printDeducted: false, packDeducted: false }, true), null);
  assert.match(orderRevisionBlock({ status: "in", printDeducted: true, packDeducted: false }, true) ?? "", /đã trừ kho/);
  assert.equal(orderRevisionBlock({ status: "in", printDeducted: true, packDeducted: false }, false), null);
  assert.match(orderRevisionBlock({ status: "xong", printDeducted: false, packDeducted: false }, false) ?? "", /Mở lại đơn/);
});

test("cài đặt chia nhóm nhưng không bỏ sót ô số", () => {
  const src = readFileSync(new URL("../routes/admin.cai-dat.tsx", import.meta.url), "utf8");
  const groupBlock = src.slice(src.indexOf("const FIELD_GROUPS"), src.indexOf("const NUMBER_FIELDS"));
  const fieldBlock = src.slice(src.indexOf("const NUMBER_FIELDS"), src.indexOf("function SettingsPage"));
  const groupKeys = [...groupBlock.matchAll(/"([A-Za-z][A-Za-z0-9]*)"/g)].map((match) => match[1]).sort();
  const fieldKeys = [...fieldBlock.matchAll(/key: "([^"]+)"/g)].map((match) => match[1]).sort();
  assert.deepEqual(groupKeys, fieldKeys);
  assert.match(src, /Phí sàn/);
  assert.match(src, /Lưu cài đặt/);
});

test("đơn TikTok và Shopee không sửa khách, sản phẩm hay thu tiền", () => {
  assert.equal(marketplaceEditLocked("tiktok"), true);
  assert.equal(marketplaceEditLocked("shopee"), true);
  assert.equal(marketplaceEditLocked("tai_tiem"), false);
  assert.equal(marketplaceEditLocked("facebook"), false);
});

test("admin có việc hằng ngày và đơn dạng cột", () => {
  const shell = readFileSync(new URL("../routes/admin.tsx", import.meta.url), "utf8");
  assert.match(shell, /admin-desk/);
  assert.match(shell, /Thiên Thiên/);
  assert.match(shell, /aria-label="Mục quản trị"/);
  const orders = readFileSync(new URL("../routes/admin.don-hang.index.tsx", import.meta.url), "utf8");
  assert.match(orders, /Dạng cột/);
  assert.match(orders, /Danh sách/);
  assert.match(orders, /Chưa thu/);
  assert.match(orders, /Tạo đơn hàng mới/);
  const form = readFileSync(new URL("../components/admin/order-desk.tsx", import.meta.url), "utf8");
  assert.match(readFileSync(new URL("../routes/admin.don-moi.tsx", import.meta.url), "utf8"), /Tạo đơn mới/);
  assert.match(form, /Danh sách sản phẩm/);
  assert.match(form, /md:grid-cols-2/);
  assert.match(form, /Thu tiền lần 1/);
  assert.match(form, /Lưu đơn/);
  assert.match(form, /ProductPickerDialog/);
  assert.match(form, /cộng vào ví của bạn/);
  assert.match(readFileSync(new URL("../components/admin/product-picker.tsx", import.meta.url), "utf8"), /Chọn sản phẩm/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Ví của tôi/);
  const detail = readFileSync(new URL("../routes/admin.don-hang.$code.tsx", import.meta.url), "utf8");
  assert.match(detail, /Khách hàng/);
  assert.match(detail, /Hình ảnh/);
  assert.match(detail, /Tình trạng/);
  assert.match(detail, /OrderDesk/);
  assert.match(form, /Cập nhật/);
  assert.match(readFileSync(new URL("../components/admin/staff-desk.tsx", import.meta.url), "utf8"), /Thêm nhân viên/);
  assert.match(readFileSync(new URL("../components/admin/staff-desk.tsx", import.meta.url), "utf8"), /Phân quyền/);
  assert.match(readFileSync(new URL("../routes/admin.san-xuat.tsx", import.meta.url), "utf8"), /Lệnh sản xuất/);
  const money = readFileSync(new URL("../components/admin/sections.tsx", import.meta.url), "utf8");
  assert.match(money, /Thu tiền/);
  assert.match(money, /Chi phí/);
  assert.match(money, /Ví tiền/);
  assert.match(money, /Báo cáo chi/);
  assert.match(readFileSync(new URL("../routes/admin.chi-phi.tsx", import.meta.url), "utf8"), /Tạo khoản chi/);
  assert.match(readFileSync(new URL("../routes/admin.chi-phi.tsx", import.meta.url), "utf8"), /Danh sách chi phí/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Tạo giao dịch/);
  assert.match(readFileSync(new URL("../routes/admin.thu.tsx", import.meta.url), "utf8"), /Không còn đơn cần thu/);
  assert.match(readFileSync(new URL("../routes/admin.thu.tsx", import.meta.url), "utf8"), /Cộng vào ví của/);
  assert.match(readFileSync(new URL("../routes/admin.thu.tsx", import.meta.url), "utf8"), /Nộp tiền mặt/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Két tiệm/);
  const modules = readFileSync(new URL("../admin-os/modules.ts", import.meta.url), "utf8");
  assert.match(modules, /label: "Chat"/);
  assert.match(modules, /label: "Thu tiền"/);
  assert.match(modules, /label: "Ví tiền"/);
  assert.match(modules, /managePath: "\/manage\/orders"/);
  assert.match(modules, /MANAGE_SKIP/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Nhân viên đang giữ/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Trong ví cửa hàng/);
  assert.match(modules, /Kinh doanh/);
  assert.match(modules, /Tài chính/);
  assert.match(shell, /modulesForRole/);
  assert.match(readFileSync(new URL("../routes/admin.bao-cao-chi.tsx", import.meta.url), "utf8"), /Báo cáo chi phí/);
  const prices = readFileSync(new URL("../routes/admin.gia.tsx", import.meta.url), "utf8");
  assert.match(prices, /Tạo từ Excel/);
  assert.match(prices, /Tạo khổ giá/);
  assert.match(readFileSync(new URL("../routes/admin.kho.tsx", import.meta.url), "utf8"), /cursor-pointer/);
  assert.match(readFileSync(new URL("../components/admin/list-page.tsx", import.meta.url), "utf8"), /Hiển thị/);
  for (const file of ["admin.don-hang.index.tsx", "admin.kho.tsx", "admin.gia.tsx", "admin.thu.tsx", "admin.chi-phi.tsx", "admin.san-pham.tsx", "admin.san-xuat.tsx", "admin.khach.index.tsx", "admin.khach.$id.tsx", "admin.cai-dat.tsx"]) {
    assert.match(readFileSync(new URL(`../routes/${file}`, import.meta.url), "utf8"), /ListPager/);
  }
  const dash = readFileSync(new URL("../routes/admin.index.tsx", import.meta.url), "utf8");
  assert.match(dash, /clockedInAt/);
  assert.match(dash, /Asia\/Ho_Chi_Minh/);
});
