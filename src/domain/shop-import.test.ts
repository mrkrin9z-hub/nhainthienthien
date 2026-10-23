import assert from "node:assert/strict";
import test from "node:test";

import { sheetMargin } from "./calc.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import { amountDue, codExpected, remainOf } from "./money.ts";
import { inactiveSkuRows, parseMasterSheet, sheetCodeToApp } from "./price-import.ts";
import { buildSeed, DEFAULT_SETTINGS } from "./seed.ts";
import { repairMojibake } from "./text-repair.ts";

test("mã bảng giá 22/10 khớp mã app", () => {
  assert.equal(sheetCodeToApp("TG-13x18-1"), "TG-13x18-C1");
  assert.equal(sheetCodeToApp("TG-13x18-C4"), "TG-13x18-C4");
  assert.equal(sheetCodeToApp("LUA-6x9-10"), "LUA-6x9-10");
  assert.equal(sheetCodeToApp("NCT-6x9-10"), "NCT-6x9-10");
  assert.equal(sheetCodeToApp("NC-12x25-1"), "NX-12x25-C1");
  const rows = parseMasterSheet();
  assert.equal(rows.length, 76);
  assert.equal(rows.find((row) => row.code === "LUA-6x9-10")?.list, null);
  assert.equal(rows.find((row) => row.code === "TG-13x18-C1")?.common, 37000);
});

test("lãi tính lại từ giá và vốn, không lấy cột lãi cũ", () => {
  const settings = DEFAULT_SETTINGS;
  const walk = sheetMargin("tai_tiem", 37000, 6757, settings);
  const facebook = sheetMargin("facebook", 37000, 6757, settings);
  const market = sheetMargin("tiktok", 37000, 6757, settings);
  assert.equal(walk.profit, 27505);
  assert.equal(facebook.profit, 15805);
  assert.equal(market.profit, 7625);
  const overridden = sheetMargin("tai_tiem", 35000, 6757, settings);
  assert.equal(overridden.profit, 35000 - 6757 - Math.round(35000 * 0.044) - Math.round(35000 * 0.03));
});

test("sổ cũ được nhập một lần, sổ không có giá thì không đụng", async () => {
  const seeded = await buildSeed();
  const legacy = structuredClone(seeded);
  legacy.settings.catalogImport20261022 = false;
  legacy.settings.breakevenMonth = 49100000;
  const gloss = legacy.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem");
  assert.ok(gloss);
  gloss.price = 37000;
  gloss.status = "dang_ban";
  legacy.groups.find((group) => group.id === "trang_guong")!.name = "Ảnh ép gỗ tráng gương bo viền";
  legacy.orders.push({
    id: "test-order",
    code: "TT261022-001",
    channel: "tai_tiem",
    source: "manual",
    customerId: "c-test",
    status: "huy",
    fulfillment: "pickup",
    address: "",
    customerNote: "Táº¡o Ä‘Æ¡n",
    internalNote: "",
    dueDate: null,
    marketplaceCode: "",
    items: [{ id: "i", skuId: "TG-13x18-C1", name: "Ảnh ép gỗ tráng gương bo viền â 13×18", skuCode: "TG-13x18-C1", quantity: 1, unitPrice: 35000, lineTotal: 35000 }],
    subtotal: 35000,
    total: 59000,
    depositRequired: 0,
    depositPaid: 0,
    depositMethod: "",
    depositBy: null,
    printDeducted: false,
    packDeducted: false,
    stockWarning: "Trá»« kho khi in",
    accessTokenHash: "",
    accessToken: "",
    idempotencyKey: null,
    createdAt: "2026-10-22T00:00:00.000Z",
    updatedAt: "2026-10-22T00:00:00.000Z",
    completedAt: null,
    files: [],
    history: [{ at: "2026-10-22T00:00:00.000Z", from: null, to: "huy", by: null, note: "Táº¡o Ä‘Æ¡n táº¡i quáº§y" }],
  });
  legacy.customers.push({
    id: "c-test",
    name: "TEST AUDIT",
    phone: "0900000099",
    phoneNormalized: "0900000099",
    address: "",
    addresses: [],
    note: "",
    createdAt: "2026-10-22T00:00:00.000Z",
  });
  legacy.staff.find((person) => person.role === "owner")!.name = "Chủ tiệm";
  legacy.staff.find((person) => person.role === "sale")!.name = "Nhân viên sale";
  legacy.staff.find((person) => person.role === "production")!.name = "Nhân viên sản xuất";
  legacy.settings.hrApproved20261022 = false;
  legacy.settings.menuLinks20261022 = false;
  legacy.settings.kpiTargets = [25000000, 40000000, 49100000, 49100000];
  for (const row of legacy.roleModules) {
    row.modules = row.modules.filter((path) => path !== "/admin/don-moi" && path !== "/admin/cod" && path !== "/admin/nhap-don");
  }
  assert.equal(applyStoreMigrations(legacy), true);
  assert.equal(legacy.settings.catalogImport20261022, true);
  assert.equal(legacy.settings.breakevenMonth, 45126608);
  assert.equal(legacy.settings.fixedCosts.find((row) => row.key === "luong_sx")?.amount, 5500000);
  assert.equal(legacy.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem")?.price, 37000);
  assert.equal(legacy.prices.find((row) => row.skuId === "TG-13x18-C4" && row.channel === "facebook")?.price, 100000);
  assert.equal(legacy.prices.find((row) => row.skuId === "NX-9x19-C1" && row.channel === "tai_tiem")?.status, "nhap");
  assert.equal(legacy.groups.find((group) => group.id === "trang_guong")?.name, "Ảnh ép gỗ tráng gương để bàn");
  assert.equal(legacy.orders.at(-1)?.isTest, true);
  assert.match(legacy.orders.at(-1)?.customerNote ?? "", /Tạo đơn/);
  assert.match(legacy.orders.at(-1)?.items[0]?.name ?? "", /để bàn — 13×18/);
  assert.equal(legacy.materials.find((row) => row.id === "tui")?.packPrice, 500);
  assert.equal(legacy.materials.find((row) => row.id === "giay-pp")?.stock, 0);
  assert.deepEqual(legacy.settings.kpiTargets, [25000000, 20000000, 40000000, 60000000]);
  assert.equal(legacy.settings.hrDraft?.pendingOwnerApproval, false);
  assert.deepEqual(
    legacy.staff.map((person) => person.name),
    ["Admin", "Sale", "Sản xuất"],
  );
  assert.ok(legacy.roleModules.find((row) => row.role === "owner")?.modules.includes("/admin/don-moi"));
  assert.ok(legacy.roleModules.find((row) => row.role === "sale")?.modules.includes("/admin/cod"));
  assert.equal(legacy.roleModules.find((row) => row.role === "production")?.modules.includes("/admin/don-moi"), false);
  assert.match(legacy.prices.find((row) => row.skuId === "TG-13x18-C3" && row.channel === "tai_tiem")?.note ?? "", /89\.000/);
  const inactive = inactiveSkuRows(legacy.skus, legacy.prices, legacy.groups);
  assert.equal(inactive.length, 28);
  assert.equal(applyStoreMigrations(legacy), false);

  const bare = {
    settings: {
      showZalo: false,
      zaloDefaultMigrated: true,
      groupListed: { ep_go: false, trang_guong: true },
      sepay: { enabled: false, apiKey: "", accountHint: "", webhookPath: "/api/public/sepay", note: "" },
      notifyPrefs: { lateOrders: true, marketplaceNew: true, feedbackReprint: true, cashHandover: true },
      shopChannels: [
        { id: "tai_tiem" as const, enabled: true, label: "Tại tiệm" },
        { id: "facebook" as const, enabled: true, label: "Facebook" },
        { id: "tiktok" as const, enabled: true, label: "TikTok" },
        { id: "shopee" as const, enabled: true, label: "Shopee" },
      ],
    },
    groups: [{ id: "trang_guong", name: "Tên chủ đã sửa", description: "x", turnaround: "" }],
    roleModules: [{ role: "owner" as const, modules: ["/admin"] }],
    packages: [],
    sepaySeen: [],
  };
  applyStoreMigrations(bare);
  assert.equal(bare.groups[0]?.name, "Tên chủ đã sửa");
  assert.equal(bare.settings.catalogImport20261022, undefined);
  assert.equal(bare.settings.shopChannels?.find((row) => row.id === "tai_tiem")?.label, "Tại tiệm");
  assert.equal(bare.settings.shopChannels?.some((row) => row.id === "mo_home"), true);
  assert.equal(applyStoreMigrations(bare), false);
});

test("chữ hỏng được sửa, tiếng Việt đúng thì giữ", () => {
  assert.equal(repairMojibake("Táº¡o Ä‘Æ¡n táº¡i quáº§y"), "Tạo đơn tại quầy");
  assert.equal(repairMojibake("Ảnh ép gỗ tráng gương bo viền â 13×18"), "Ảnh ép gỗ tráng gương bo viền — 13×18");
  assert.equal(repairMojibake("Ảnh ép gỗ tráng gương để bàn"), "Ảnh ép gỗ tráng gương để bàn");
});

test("đơn hủy và đơn thử không còn nợ, COD không vượt số còn lại", () => {
  assert.equal(remainOf({ status: "huy", total: 59000, depositPaid: 0 }), 0);
  assert.equal(amountDue({ status: "giao", total: 59000, depositPaid: 0, discount: 4000, shipping: { customerShip: 10000 } }), 65000);
  const over = { status: "giao", total: 59000, depositPaid: 0, shipping: { codAmount: 99000 } };
  assert.equal(codExpected(over), 59000);
  assert.equal(codExpected({ ...over, status: "huy", isTest: true }), 0);
});
