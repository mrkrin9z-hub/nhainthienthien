import assert from "node:assert/strict";
import test from "node:test";

import { backupKeysToDrop, canExport, canViewPriceBoard, canViewProfit, payrollForActor, staticAssetPath } from "./guard.ts";
import { buildSeed } from "./seed.ts";
import { hotp, verifyTotp } from "./totp.ts";

const SECRET = new TextEncoder().encode("12345678901234567890");

test("TOTP khớp vector RFC 6238", async () => {
  assert.equal(await hotp(SECRET, Math.floor(59 / 30)), "287082");
  assert.equal(await hotp(SECRET, Math.floor(1111111109 / 30)), "081804");
  assert.equal(await hotp(SECRET, Math.floor(2000000000 / 30)), "279037");
  const secret = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";
  assert.equal(await verifyTotp(secret, "287082", 59_000), true);
  assert.equal(await verifyTotp(secret, "000000", 59_000), false);
  assert.equal(await verifyTotp(secret, "287082", 89_000), true);
});

test("quyền trang chủ, bảng giá, xuất file", () => {
  assert.equal(canViewProfit("owner"), true);
  assert.equal(canViewProfit("sale"), false);
  assert.equal(canViewProfit("production"), false);
  assert.equal(canViewPriceBoard("sale"), true);
  assert.equal(canViewPriceBoard("production"), false);
  assert.equal(canExport("sale", "profit"), false);
  assert.equal(canExport("sale", "payroll"), false);
  assert.equal(canExport("owner", "profit"), true);
  assert.equal(canExport("production", "orders"), false);
  assert.equal(canExport("production", "stock"), false);
  assert.equal(canExport("sale", "orders"), true);
  assert.equal(canExport("sale", "stock"), true);
});

test("lương người khác không lọt, và không kèm doanh thu", () => {
  const rows = [
    {
      staffId: "staff-sale",
      name: "Sale",
      role: "sale" as const,
      base: 8000000,
      commission: 1000,
      kpiBonus: 0,
      deduction: null,
      net: null,
      lateMinutes: 0,
      absentDays: 0,
      kpiPercent: 10,
      revenue: 49100000,
    },
    {
      staffId: "staff-sx",
      name: "SX",
      role: "production" as const,
      base: 11000000,
      commission: 0,
      kpiBonus: 0,
      deduction: 0,
      net: 11000000,
      lateMinutes: 0,
      absentDays: 0,
      kpiPercent: null,
      revenue: 0,
    },
  ];
  const sale = payrollForActor("sale", "staff-sale", rows);
  assert.equal(sale.length, 1);
  assert.equal(sale[0]?.staffId, "staff-sale");
  assert.equal("revenue" in sale[0]!, false);
  assert.equal(sale[0]?.base, 8000000);
  const sx = payrollForActor("production", "staff-sx", rows);
  assert.equal(sx.length, 1);
  assert.equal(sx[0]?.net, 11000000);
  assert.equal(payrollForActor("owner", "staff-owner", rows).length, 2);
});

test("sao lưu ngày và bản tay tách nhau", () => {
  const daily = Array.from({ length: 32 }, (_, i) => `shop_backup:2026-01-${String(i + 1).padStart(2, "0")}`);
  const manual = Array.from({ length: 12 }, (_, i) => `shop_backup:manual:2026-02-${String(i + 1).padStart(2, "0")}T00-00-00-000Z`);
  const legacy = ["shop_backup:2026-10-17T15-49-24-005Z"];
  const drop = backupKeysToDrop([...daily, ...manual, ...legacy, "other"]);
  assert.equal(drop.filter((key) => key.startsWith("shop_backup:2026-01")).length, 2);
  assert.equal(drop.includes(daily[0]!), true);
  assert.equal(drop.includes(daily[31]!), false);
  assert.equal(drop.filter((key) => key.includes(":manual:")).length, 2);
  assert.equal(drop.includes(legacy[0]!), true);
  assert.equal(drop.includes("other"), false);
});

test("file tĩnh KV không thay trang chủ", () => {
  assert.equal(staticAssetPath("/"), null);
  assert.equal(staticAssetPath("/index.html"), null);
  assert.equal(staticAssetPath("/assets/app.js"), "/assets/app.js");
  assert.equal(staticAssetPath("/brand/logo-vuong.png"), "/brand/logo-vuong.png");
  assert.equal(staticAssetPath("/admin"), null);
  assert.equal(staticAssetPath("/brand/../shop.json"), null);
});

test("tài khoản mẫu bắt đổi mật khẩu và chưa bật 2FA", async () => {
  const state = await buildSeed();
  assert.ok(state.staff.every((person) => person.mustChangePassword));
  assert.ok(state.staff.every((person) => person.totpEnabled !== true));
});
