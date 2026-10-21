import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_BRIDGES, studioManageUrl } from "../admin-os/bridges.ts";
import { ADMIN_MODULE_GROUPS, MANAGE_SKIP, modulesForRole } from "../admin-os/modules.ts";

test("menu đủ nhóm vận hành và ẩn garment/tools", () => {
  const titles = ADMIN_MODULE_GROUPS.map((group) => group.title);
  assert.ok(titles.includes("Kinh doanh"));
  assert.ok(titles.includes("Sản xuất"));
  assert.ok(titles.includes("Vận hành"));
  assert.ok(titles.includes("Tài chính"));
  assert.ok(titles.includes("Hệ thống"));
  assert.deepEqual([...MANAGE_SKIP].sort(), ["/manage/garments", "/manage/tools"].sort());
});

test("đã lược chiến dịch, chi nhánh, bộ phận, TB nội bộ, tài liệu, hướng dẫn", () => {
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  assert.ok(!paths.includes("/admin/chien-dich"));
  assert.ok(!paths.includes("/admin/chi-nhanh"));
  assert.ok(!paths.includes("/admin/bo-phan"));
  assert.ok(!paths.includes("/admin/thong-bao-noi-bo"));
  assert.ok(!paths.includes("/admin/tai-lieu"));
  assert.ok(!paths.includes("/admin/huong-dan"));
  assert.ok(paths.includes("/admin/goi"));
  assert.ok(paths.includes("/admin/sepay"));
  assert.ok(paths.includes("/admin/nhom-quyen"));
  assert.ok(paths.includes("/admin/thong-bao"));
  assert.equal(paths.includes("/admin/studio/tin-mau"), true);
  assert.equal(ADMIN_MODULE_GROUPS.flatMap((g) => g.items).find((i) => i.to === "/admin/studio/tin-mau")?.mode, "bridge");
  assert.ok(STUDIO_BRIDGES["tin-mau"]);
  assert.match(studioManageUrl("/manage/messages/settings"), /studiobase\.vn\/manage\/messages\/settings/);
});

test("modulesForRole tôn trọng danh sách allowed", () => {
  const sale = modulesForRole("sale").flatMap((g) => g.items).map((i) => i.to);
  assert.ok(sale.includes("/admin/chat"));
  assert.ok(sale.includes("/admin/goi"));
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
  assert.ok(!owner.includes("/admin/chi-nhanh"));
});
