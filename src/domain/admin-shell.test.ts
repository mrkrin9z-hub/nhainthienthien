import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

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

test("admin có việc hằng ngày và đơn dạng cột", () => {
  const shell = readFileSync(new URL("../routes/admin.tsx", import.meta.url), "utf8");
  assert.match(shell, /admin-desk/);
  assert.match(shell, /Thiên Thiên/);
  assert.match(shell, /aria-label="Mục quản trị"/);
  const orders = readFileSync(new URL("../routes/admin.don-hang.index.tsx", import.meta.url), "utf8");
  assert.match(orders, /Dạng cột/);
  assert.match(orders, /Danh sách/);
  const form = readFileSync(new URL("../routes/admin.don-moi.tsx", import.meta.url), "utf8");
  assert.match(form, /Tạo đơn mới/);
  assert.match(form, /Danh sách sản phẩm/);
  assert.match(form, /md:grid-cols-2/);
  assert.match(form, /Thu tiền lần 1/);
  assert.match(form, /Lưu đơn/);
  assert.match(readFileSync(new URL("../components/admin/staff-desk.tsx", import.meta.url), "utf8"), /Thêm nhân viên/);
  assert.match(readFileSync(new URL("../components/admin/staff-desk.tsx", import.meta.url), "utf8"), /Phân quyền/);
  assert.match(readFileSync(new URL("../routes/admin.san-xuat.tsx", import.meta.url), "utf8"), /Lệnh sản xuất/);
  const money = readFileSync(new URL("../components/admin/sections.tsx", import.meta.url), "utf8");
  assert.match(money, /Thu tiền/);
  assert.match(money, /Chi phí/);
  assert.match(money, /Ví tiền/);
  assert.match(money, /Báo cáo chi/);
  assert.match(readFileSync(new URL("../routes/admin.chi-phi.tsx", import.meta.url), "utf8"), /Nhập chi phí mới/);
  assert.match(readFileSync(new URL("../routes/admin.chi-phi.tsx", import.meta.url), "utf8"), /Danh sách chi phí/);
  assert.match(readFileSync(new URL("../routes/admin.vi.tsx", import.meta.url), "utf8"), /Tạo giao dịch/);
  assert.match(readFileSync(new URL("../routes/admin.thu.tsx", import.meta.url), "utf8"), /Không còn đơn cần thu/);
  assert.match(readFileSync(new URL("../routes/admin.bao-cao-chi.tsx", import.meta.url), "utf8"), /Báo cáo chi phí/);
  const dash = readFileSync(new URL("../routes/admin.index.tsx", import.meta.url), "utf8");
  assert.match(dash, /clockedInAt/);
  assert.match(dash, /Asia\/Ho_Chi_Minh/);
});
