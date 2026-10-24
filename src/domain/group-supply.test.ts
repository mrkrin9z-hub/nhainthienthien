import assert from "node:assert/strict";
import test from "node:test";

import { quoteSku, rollMeters } from "./calc.ts";
import { ensureInkExpenseModel, linesForSku, materialOptionsForScale, sizeSheetMaterialId } from "./group-supply.ts";
import { inkPurchaseExpense } from "./money.ts";
import { businessReport } from "./report.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";
import { syncOrderStock } from "./stock.ts";
import type { GroupSupply, Material, Order, ShopState, Sku } from "./types.ts";

function material(id: string, name: string, unit: string, packSize: number, packPrice: number, stock: number): Material {
  return { id, name, buyLabel: unit, unit, packSize, packPrice, stock, minStock: null, supplier: "", pendingPrice: null };
}

test("tạo nhóm, tạo sản phẩm theo khổ, bán trừ gỗ giấy gương và không trừ mực", () => {
  const settings = { ...DEFAULT_SETTINGS, wasteRate: 0, walkinCommissionPercent: 0 };
  const supplies: GroupSupply[] = [
    { id: "go", groupId: "anh-go", materialId: "go", phase: "print", scale: "size_sheet", qty: 1 },
    { id: "giay", groupId: "anh-go", materialId: "giay-pp", phase: "print", scale: "roll_m", qty: null, rollWidthCm: 61 },
    { id: "mang", groupId: "anh-go", materialId: "mang", phase: "print", scale: "roll_m", qty: null, rollWidthCm: 62 },
    { id: "muc", groupId: "anh-go", materialId: "muc-1", phase: "print", scale: "area_ml", qty: 10 },
  ];
  const sku: Sku = {
    id: "AG-13x18-C1",
    code: "AG-13x18-C1",
    groupId: "anh-go",
    name: "13×18",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 1,
    piecesPerPack: null,
    sort: 1,
  };
  const state = {
    settings,
    materials: [
      material("go-13x18", "Tấm gỗ 13x18", "tấm", 1, 1900, 10),
      material("giay-pp", "Giấy PP", "m", 50, 50000, 20),
      material("mang", "Màng tráng gương", "m", 50, 62000, 20),
      material("muc-1", "Mực màu 1", "ml", 100, 200000, 500),
    ],
    boms: [],
    groupSupplies: supplies,
    sizeOverrides: [],
    skus: [sku],
    movements: [],
    orders: [],
    expenses: [],
    monthlyFixed: [],
    wasteReports: [],
  } as unknown as ShopState;

  const lines = linesForSku(state, sku);
  assert.equal(lines.find((line) => line.materialId === "go-13x18")?.qty, 1);
  const paper = rollMeters(13, 18, 61, 0);
  const film = rollMeters(13, 18, 62, 0);
  assert.equal(lines.find((line) => line.materialId === "giay-pp")?.qty, paper);
  assert.equal(lines.find((line) => line.materialId === "mang")?.qty, film);
  assert.equal(lines.some((line) => line.materialId.startsWith("muc")), false);
  assert.equal(state.boms.length, 0);

  const order = {
    id: "o1",
    code: "TT-TEST",
    channel: "tai_tiem",
    fulfillment: "pickup",
    items: [{ skuId: sku.id, quantity: 2, lineTotal: 100000, name: sku.name }],
    printDeducted: false,
    packDeducted: false,
    stockWarning: "",
    status: "nhan_don",
    isTest: false,
    createdAt: "2026-10-24T02:00:00.000Z",
    updatedAt: "2026-10-24T02:00:00.000Z",
    completedAt: null,
    total: 100000,
  } as Order;
  state.orders.push(order);
  syncOrderStock(state, order, "in", "owner");

  const stock = (id: string) => state.materials.find((row) => row.id === id)?.stock;
  assert.equal(stock("go-13x18"), 8);
  assert.equal(stock("giay-pp"), Math.round((20 - (paper ?? 0) * 2) * 10000) / 10000);
  assert.equal(stock("mang"), Math.round((20 - (film ?? 0) * 2) * 10000) / 10000);
  assert.equal(stock("muc-1"), 500);

  const quote = quoteSku({
    sku,
    price: 50000,
    channel: "tai_tiem",
    settings,
    boms: lines,
    materials: state.materials,
    affiliate: false,
  });
  assert.equal(quote.materialIncomplete, false);
  assert.equal(quote.ink, 0);
  assert.equal(quote.lines.some((line) => line.name.startsWith("Mực")), false);
  assert.ok((quote.material ?? 0) > 1900);
  assert.equal(quote.profit !== null, true);
  assert.equal(typeof quote.marginPercent, "number");

  order.status = "xong";
  order.completedAt = "2026-10-24T03:00:00.000Z";
  const bought = inkPurchaseExpense({
    materialName: "Mực màu 1",
    packs: 1,
    packPrice: 5000,
    at: "2026-10-24T10:00:00.000Z",
    by: "owner",
  });
  assert.ok(bought);
  state.expenses.push({ ...bought, id: "ink-buy" });
  state.expenses.push({
    id: "ink-chi",
    name: "Mực in tháng",
    amount: 1000,
    note: "",
    at: "2026-10-24T11:00:00.000Z",
    month: "2026-10",
    category: "muc_in",
    wallet: "tien_mat",
    by: "owner",
  });
  const report = businessReport(state, "2026-10", "month", "nha_in");
  assert.equal(report.revenue, 100000);
  assert.equal(report.orderCount, 1);
  assert.equal(report.incomplete, false);
  assert.equal(report.gross !== null, true);
  assert.equal(report.extraSum, 6000);
  assert.deepEqual(
    report.extras.map((row) => row.name),
    ["Nhập Mực màu 1", "Mực in tháng"],
  );
});

test("bán không trừ mực dù nhóm còn dòng ml cũ", () => {
  const settings = { ...DEFAULT_SETTINGS, wasteRate: 0 };
  const sku: Sku = {
    id: "AG-13x18-C1",
    code: "AG-13x18-C1",
    groupId: "anh-go",
    name: "13×18",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 1,
    piecesPerPack: null,
    sort: 1,
  };
  const state = {
    settings,
    materials: [material("muc-1", "Mực màu 1", "lọ", 1, 0, 4)],
    boms: [],
    groupSupplies: [{ id: "muc", groupId: "anh-go", materialId: "muc-1", phase: "print", scale: "area_ml", qty: 8 }],
    sizeOverrides: [],
    skus: [sku],
    movements: [],
    orders: [],
  } as unknown as ShopState;
  assert.equal(linesForSku(state, sku).find((line) => line.materialId === "muc-1")?.qty ?? null, null);
  const order = {
    id: "o2",
    code: "TT-INK",
    channel: "tai_tiem",
    fulfillment: "pickup",
    items: [{ skuId: sku.id, quantity: 1, lineTotal: 10000, name: sku.name }],
    printDeducted: false,
    packDeducted: false,
    stockWarning: "",
    status: "nhan_don",
    isTest: false,
    createdAt: "2026-10-24T02:00:00.000Z",
    updatedAt: "2026-10-24T02:00:00.000Z",
    completedAt: null,
    total: 10000,
  } as Order;
  state.orders.push(order);
  syncOrderStock(state, order, "in", "owner");
  assert.equal(state.materials.find((row) => row.id === "muc-1")?.stock, 4);
});

test("mực đang tính ml về lọ và ra khỏi định mức, lọ đã đếm thì giữ", () => {
  const state = {
    settings: { ...DEFAULT_SETTINGS, inkExpense20261024: false },
    materials: [
      { id: "muc-1", name: "Mực màu 1", unit: "ml", packSize: null, buyLabel: "ml", stock: -0.1872, packPrice: null },
      { id: "muc-2", name: "Mực màu 2", unit: "lọ", packSize: 1, buyLabel: "một lọ", stock: 3, packPrice: 120000 },
    ],
    boms: [{ id: "b", skuId: "s", materialId: "muc-1", phase: "print", scope: "sheet", qty: 0.2, formula: "group" }],
    groupSupplies: [{ id: "g", groupId: "anh-go", materialId: "muc-1", phase: "print", scale: "area_ml", qty: 10 }],
    sizeOverrides: [{ id: "o", groupId: "anh-go", size: "13x18", materialId: "muc-1", phase: "print", qty: 1 }],
  };
  assert.equal(ensureInkExpenseModel(state as never), true);
  assert.equal(state.groupSupplies.length, 0);
  assert.equal(state.sizeOverrides.length, 0);
  assert.equal(state.boms.length, 0);
  assert.equal(state.materials[0]?.unit, "lọ");
  assert.equal(state.materials[0]?.packSize, 1);
  assert.equal(state.materials[0]?.stock, 0);
  assert.equal(state.materials[1]?.stock, 3);
  assert.equal(state.materials[1]?.packPrice, 120000);
  assert.equal(state.settings.inkExpense20261024, true);
  assert.equal(ensureInkExpenseModel(state as never), false);
});

test("tấm theo khổ hiện tiền tố gỗ, không liệt từng khổ", () => {
  const materials = [
    { id: "go-13x18", name: "Tấm gỗ 13x18" },
    { id: "go-20x30", name: "Tấm gỗ 20x30" },
    { id: "giay-pp", name: "Giấy PP" },
  ];
  assert.equal(sizeSheetMaterialId("go-13x18"), "go");
  assert.equal(sizeSheetMaterialId("go"), "go");
  const wood = materialOptionsForScale(materials, "size_sheet", "go");
  assert.deepEqual(wood, [{ id: "go", name: "Gỗ (tấm theo khổ)" }]);
  const paper = materialOptionsForScale(materials, "roll_m", "giay-pp");
  assert.equal(paper.some((item) => item.id === "giay-pp"), true);
  assert.equal(paper.some((item) => item.id === "go-13x18"), true);
});
