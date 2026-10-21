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

test("phase 2–4 org/finance/docs là live; OAuth tin mẫu vẫn bridge", () => {
  const items = ADMIN_MODULE_GROUPS.flatMap((group) => group.items);
  assert.equal(items.find((item) => item.to === "/admin/chat")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/lich")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/cong-viec")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/chi-nhanh")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/bo-phan")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/nhom-quyen")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/muc-tieu")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/sepay")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/danh-gia")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/thong-bao-noi-bo")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/tai-lieu")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/huong-dan")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/studio/tin-mau")?.mode, "bridge");
  assert.equal(items.find((item) => item.to === "/admin/studio/goi")?.mode, "bridge");
  assert.ok(STUDIO_BRIDGES["tin-mau"]);
  assert.ok(!STUDIO_BRIDGES["nhom-quyen"]);
  assert.ok(!STUDIO_BRIDGES["chi-nhanh"]);
  assert.match(studioManageUrl("/manage/messages/settings"), /studiobase\.vn\/manage\/messages\/settings/);
});

test("sale thấy chat và đơn, không thấy kết nối", () => {
  const sale = modulesForRole("sale").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(sale.includes("/admin/chat"));
  assert.ok(sale.includes("/admin/don-hang"));
  assert.ok(sale.includes("/admin/danh-gia"));
  assert.ok(sale.includes("/admin/huong-dan"));
  assert.ok(!sale.includes("/admin/ket-noi"));
  assert.ok(!sale.includes("/admin/chi-nhanh"));
});

test("owner thấy báo cáo chi và org trên menu", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(owner.includes("/admin/bao-cao-chi"));
  assert.ok(owner.includes("/admin/chi-phi"));
  assert.ok(owner.includes("/admin/nhan-vien"));
  assert.ok(owner.includes("/admin/cham-cong"));
  assert.ok(owner.includes("/admin/luong"));
  assert.ok(owner.includes("/admin/chi-nhanh"));
  assert.ok(owner.includes("/admin/bo-phan"));
  assert.ok(owner.includes("/admin/nhom-quyen"));
  assert.ok(owner.includes("/admin/muc-tieu"));
  assert.ok(owner.includes("/admin/sepay"));
});
