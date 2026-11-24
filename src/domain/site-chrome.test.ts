import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isPublicSitePath, isStaffPath } from "./site-chrome.ts";

test("ZaloFab ẩn trên mọi route admin/staff, hiện trên trang khách", () => {
  for (const path of [
    "/admin",
    "/admin/",
    "/admin/don-hang",
    "/admin/don-hang/DH-1",
    "/orders",
    "/orders/create",
    "/q",
    "/q?v=1",
    "/q_/don/abc",
  ]) {
    assert.equal(isStaffPath(path), true, path);
    assert.equal(isPublicSitePath(path), false, path);
  }
  for (const path of ["/", "/gui-anh", "/gui-anh/phieu", "/dat-in", "/gio-hang", "/san-pham", "/tra-cuu", "/chinh-sach", "/u/abc"]) {
    assert.equal(isStaffPath(path), false, path);
    assert.equal(isPublicSitePath(path), true, path);
  }
});

test("ZaloFab dùng isStaffPath, không chỉ /admin", () => {
  const src = readFileSync(new URL("../components/site/zalo-fab.tsx", import.meta.url), "utf8");
  assert.match(src, /isStaffPath\(/);
  assert.doesNotMatch(src, /pathname\.startsWith\("\/admin"\)/);
});
