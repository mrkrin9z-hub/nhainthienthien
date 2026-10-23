import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_BRIDGES } from "../admin-os/bridges.ts";
import { ADMIN_MODULE_GROUPS, MANAGE_SKIP, modulesForRole } from "../admin-os/modules.ts";

test("menu đủ nhóm việc hằng ngày và ẩn garment/tools", () => {
  const titles = ADMIN_MODULE_GROUPS.map((group) => group.title);
  assert.deepEqual(titles, ["Đơn hàng", "Nhân sự", "Thu chi", "Báo cáo", "Kho", "Cài đặt"]);
  const orders = ADMIN_MODULE_GROUPS.find((group) => group.title === "Đơn hàng")?.items.map((item) => item.label) ?? [];
  assert.deepEqual(orders, ["Nhận đơn", "Nhập/Tạo đơn", "In đơn (K80)", "Giao đơn"]);
  const people = ADMIN_MODULE_GROUPS.find((group) => group.title === "Nhân sự")?.items.map((item) => item.label) ?? [];
  assert.deepEqual(people, ["Việc cần làm", "Chấm công", "Check công", "Check lương", "Check thưởng"]);
  const money = ADMIN_MODULE_GROUPS.find((group) => group.title === "Thu chi")?.items.map((item) => item.label) ?? [];
  assert.deepEqual(money, ["Nhập thu", "Chuyển nộp", "Nhập chi", "Duyệt chi", "Công nợ"]);
  const stock = ADMIN_MODULE_GROUPS.find((group) => group.title === "Kho")?.items.map((item) => item.label) ?? [];
  assert.deepEqual(stock, ["Tồn kho sản phẩm", "Nhập sản phẩm", "Nhập vật tư", "Tồn kho vật tư"]);
  assert.deepEqual([...MANAGE_SKIP].sort(), ["/manage/garments", "/manage/tools"].sort());
});

test("không còn bridge StudioBase; menu việc không kéo trang phụ", () => {
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  assert.ok(!paths.includes("/admin/chien-dich"));
  assert.ok(!paths.includes("/admin/chi-nhanh"));
  assert.ok(!paths.includes("/admin/bo-phan"));
  assert.ok(!paths.includes("/admin/studio/tin-mau"));
  assert.ok(!paths.includes("/admin/tin-mau"));
  assert.ok(!paths.includes("/admin/goi"));
  assert.ok(!paths.includes("/admin/sepay"));
  assert.ok(!paths.includes("/admin/danh-gia"));
  assert.ok(!paths.includes("/admin/nhac-khach"));
  assert.ok(!paths.includes("/admin/cong-viec"));
  assert.ok(!paths.includes("/admin/chat"));
  assert.ok(!paths.includes("/admin/lich"));
  assert.ok(paths.includes("/admin/nhom-quyen"));
  assert.ok(paths.includes("/admin/in-don"));
  assert.ok(paths.includes("/admin/chuyen-nop"));
  assert.ok(paths.includes("/admin/duyet-chi"));
  assert.deepEqual(STUDIO_BRIDGES, {});
  const modes = ADMIN_MODULE_GROUPS.flatMap((g) => g.items).map((i) => i.mode);
  assert.ok(modes.every((mode) => mode === "live" || mode === undefined));
  assert.ok(!modes.includes("bridge" as never));
});

test("modulesForRole tôn trọng danh sách allowed", () => {
  const sale = modulesForRole("sale").flatMap((g) => g.items).map((i) => i.label);
  assert.ok(sale.includes("Nhận đơn"));
  assert.ok(sale.includes("Check thưởng"));
  assert.ok(sale.includes("Nhập chi"));
  assert.ok(!sale.includes("Duyệt chi"));
  assert.ok(!sale.includes("Nhập sản phẩm"));
  const trimmed = modulesForRole("sale", ["/admin/don-hang", "/admin/thu"]).flatMap((g) => g.items).map((i) => i.to);
  assert.deepEqual(trimmed.sort(), ["/admin/don-hang", "/admin/thu"].sort());
});

test("owner thấy nhóm quyền và duyệt chi; không thấy SePay, gói hay chat", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(!owner.includes("/admin/sepay"));
  assert.ok(!owner.includes("/admin/goi"));
  assert.ok(!owner.includes("/admin/danh-gia"));
  assert.ok(!owner.includes("/admin/thong-bao"));
  assert.ok(!owner.includes("/admin/tin-mau"));
  assert.ok(owner.includes("/admin/nhom-quyen"));
  assert.ok(owner.includes("/admin/duyet-chi"));
  assert.ok(!owner.includes("/admin/chi-nhanh"));
  assert.ok(!owner.includes("/admin/studio/tin-mau"));
});
