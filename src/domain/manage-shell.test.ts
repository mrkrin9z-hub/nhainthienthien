import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_BRIDGES } from "../admin-os/bridges.ts";
import { ADMIN_MODULE_GROUPS, MANAGE_SKIP, modulesForRole } from "../admin-os/modules.ts";

test("menu đủ nhóm vận hành và ẩn garment/tools", () => {
  const titles = ADMIN_MODULE_GROUPS.map((group) => group.title);
  assert.deepEqual(titles, ["Tổng quan", "Bán hàng", "Sản xuất", "Sản phẩm & Giá", "Tài chính", "Nhân sự", "Hệ thống"]);
  const selling = ADMIN_MODULE_GROUPS.find((group) => group.title === "Bán hàng")?.items.map((item) => item.label) ?? [];
  assert.ok(selling.includes("Đơn hàng"));
  assert.ok(selling.includes("Lên đơn"));
  assert.ok(selling.includes("Giao hàng"));
  assert.ok(selling.includes("COD"));
  assert.ok(selling.includes("Khách hàng"));
  assert.ok(selling.includes("Chat"));
  const making = ADMIN_MODULE_GROUPS.find((group) => group.title === "Sản xuất")?.items.map((item) => item.to) ?? [];
  assert.ok(making.includes("/admin/cong-viec"));
  assert.ok(making.includes("/admin/lich"));
  assert.ok(making.includes("/admin/kho"));
  assert.deepEqual([...MANAGE_SKIP].sort(), ["/manage/garments", "/manage/tools"].sort());
});

test("không còn bridge StudioBase; tin mẫu local", () => {
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  assert.ok(!paths.includes("/admin/chien-dich"));
  assert.ok(!paths.includes("/admin/chi-nhanh"));
  assert.ok(!paths.includes("/admin/bo-phan"));
  assert.ok(!paths.includes("/admin/studio/tin-mau"));
  assert.ok(paths.includes("/admin/tin-mau"));
  assert.ok(paths.includes("/admin/goi"));
  assert.ok(paths.includes("/admin/sepay"));
  assert.ok(paths.includes("/admin/nhom-quyen"));
  assert.ok(paths.includes("/admin/thong-bao"));
  assert.ok(paths.includes("/admin/chat"));
  assert.deepEqual(STUDIO_BRIDGES, {});
  const modes = ADMIN_MODULE_GROUPS.flatMap((g) => g.items).map((i) => i.mode);
  assert.ok(modes.every((mode) => mode === "live" || mode === undefined));
  assert.ok(!modes.includes("bridge" as never));
});

test("modulesForRole tôn trọng danh sách allowed", () => {
  const sale = modulesForRole("sale").flatMap((g) => g.items).map((i) => i.to);
  assert.ok(sale.includes("/admin/chat"));
  assert.ok(sale.includes("/admin/goi"));
  assert.ok(sale.includes("/admin/tin-mau"));
  assert.ok(!sale.includes("/admin/sepay"));
  const trimmed = modulesForRole("sale", ["/admin", "/admin/chat"]).flatMap((g) => g.items).map((i) => i.to);
  assert.deepEqual(trimmed.sort(), ["/admin", "/admin/chat"].sort());
});

test("owner thấy SePay, gói, nhóm quyền; không thấy chi nhánh", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(owner.includes("/admin/sepay"));
  assert.ok(owner.includes("/admin/goi"));
  assert.ok(owner.includes("/admin/nhom-quyen"));
  assert.ok(owner.includes("/admin/thong-bao"));
  assert.ok(owner.includes("/admin/tin-mau"));
  assert.ok(!owner.includes("/admin/chi-nhanh"));
  assert.ok(!owner.includes("/admin/studio/tin-mau"));
});
