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

test("mọi module Manage OS đã live; không còn bridge trên menu", () => {
  const items = ADMIN_MODULE_GROUPS.flatMap((group) => group.items);
  assert.ok(items.every((item) => item.mode === "live"));
  assert.equal(items.find((item) => item.to === "/admin/chien-dich")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/tin-mau")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/thong-bao")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/goi")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/chi-nhanh")?.mode, "live");
  assert.deepEqual(Object.keys(STUDIO_BRIDGES), []);
  assert.match(studioManageUrl("/manage/subscription"), /studiobase\.vn\/manage\/subscription/);
});

test("sale thấy chat, tin mẫu và đánh giá; không thấy kết nối", () => {
  const sale = modulesForRole("sale").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(sale.includes("/admin/chat"));
  assert.ok(sale.includes("/admin/don-hang"));
  assert.ok(sale.includes("/admin/danh-gia"));
  assert.ok(sale.includes("/admin/tin-mau"));
  assert.ok(sale.includes("/admin/huong-dan"));
  assert.ok(!sale.includes("/admin/ket-noi"));
  assert.ok(!sale.includes("/admin/chi-nhanh"));
  assert.ok(!sale.includes("/admin/goi"));
});

test("owner thấy org, chiến dịch, gói, thông báo", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(owner.includes("/admin/bao-cao-chi"));
  assert.ok(owner.includes("/admin/chi-nhanh"));
  assert.ok(owner.includes("/admin/chien-dich"));
  assert.ok(owner.includes("/admin/tin-mau"));
  assert.ok(owner.includes("/admin/thong-bao"));
  assert.ok(owner.includes("/admin/goi"));
  assert.ok(owner.includes("/admin/sepay"));
});
