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

test("chat và đơn là live; lịch là bridge", () => {
  const items = ADMIN_MODULE_GROUPS.flatMap((group) => group.items);
  assert.equal(items.find((item) => item.to === "/admin/chat")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/don-hang")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/album")?.mode, "live");
  assert.equal(items.find((item) => item.to === "/admin/studio/lich")?.mode, "bridge");
  assert.ok(STUDIO_BRIDGES.lich);
  assert.match(studioManageUrl("/manage/calendar"), /studiobase\.vn\/manage\/calendar/);
});

test("sale thấy chat và đơn, không thấy kết nối", () => {
  const sale = modulesForRole("sale").flatMap((group) => group.items).map((item) => item.to);
  assert.ok(sale.includes("/admin/chat"));
  assert.ok(sale.includes("/admin/don-hang"));
  assert.ok(!sale.includes("/admin/ket-noi"));
});
