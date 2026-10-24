import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_BRIDGES } from "../admin-os/bridges.ts";
import { ADMIN_MODULE_GROUPS, MANAGE_SKIP, modulesForRole } from "../admin-os/modules.ts";

test("menu bảy mục phẳng, không còn in bill và giao hàng riêng", () => {
  const titles = ADMIN_MODULE_GROUPS.map((group) => group.title);
  assert.deepEqual(titles, ["Tổng quan", "Đơn hàng", "Sản xuất", "Sản phẩm", "Kho vật tư", "Tiền", "Thống kê báo cáo", "Thống kê khách hàng", "Nhân sự", "Cài đặt"]);
  const labels = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.label);
  assert.deepEqual(labels, titles);
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  assert.deepEqual(paths, ["/admin", "/admin/don-hang", "/admin/san-xuat", "/admin/gia", "/admin/kho", "/admin/thu", "/admin/bao-cao", "/admin/khach", "/admin/viec", "/admin/cai-dat"]);
  assert.equal(paths.includes("/admin/in-don"), false);
  assert.equal(paths.includes("/admin/giao-hang"), false);
  assert.deepEqual([...MANAGE_SKIP].sort(), ["/manage/garments", "/manage/tools"].sort());
});

test("không còn bridge StudioBase; menu không kéo trang phụ", () => {
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  for (const hidden of [
    "/admin/chien-dich",
    "/admin/chi-nhanh",
    "/admin/bo-phan",
    "/admin/studio/tin-mau",
    "/admin/tin-mau",
    "/admin/goi",
    "/admin/sepay",
    "/admin/danh-gia",
    "/admin/nhac-khach",
    "/admin/cong-viec",
    "/admin/chat",
    "/admin/lich",
    "/admin/in-don",
    "/admin/chuyen-nop",
    "/admin/duyet-chi",
  ]) {
    assert.equal(paths.includes(hidden), false, hidden);
  }
  assert.deepEqual(STUDIO_BRIDGES, {});
  const modes = ADMIN_MODULE_GROUPS.flatMap((g) => g.items).map((i) => i.mode);
  assert.ok(modes.every((mode) => mode === "live" || mode === undefined));
  assert.ok(!modes.includes("bridge" as never));
});

test("modulesForRole tôn trọng role và danh sách allowed", () => {
  const sale = modulesForRole("sale").flatMap((g) => g.items).map((i) => i.label);
  assert.deepEqual(sale, ["Tổng quan", "Đơn hàng", "Sản phẩm", "Kho vật tư", "Tiền", "Thống kê khách hàng", "Nhân sự"]);
  const production = modulesForRole("production").flatMap((g) => g.items).map((i) => i.label);
  assert.deepEqual(production, ["Tổng quan", "Đơn hàng", "Sản xuất", "Kho vật tư", "Nhân sự"]);
  const trimmed = modulesForRole("sale", ["/admin/don-hang", "/admin/thu"]).flatMap((g) => g.items).map((i) => i.to);
  assert.deepEqual(trimmed, ["/admin/don-hang", "/admin/thu"]);
});

test("owner thấy đủ bảy mục; không thấy SePay, gói hay chat trên menu", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.deepEqual(owner, ["/admin", "/admin/don-hang", "/admin/san-xuat", "/admin/gia", "/admin/kho", "/admin/thu", "/admin/bao-cao", "/admin/khach", "/admin/viec", "/admin/cai-dat"]);
  assert.equal(owner.includes("/admin/sepay"), false);
  assert.equal(owner.includes("/admin/goi"), false);
  assert.equal(owner.includes("/admin/danh-gia"), false);
  assert.equal(owner.includes("/admin/thong-bao"), false);
  assert.equal(owner.includes("/admin/tin-mau"), false);
});
