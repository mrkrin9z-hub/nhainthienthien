import assert from "node:assert/strict";
import test from "node:test";

import { quoteSku, rollMeters } from "./calc.ts";
import { linesForSku, materialOptionsForScale, sizeSheetMaterialId } from "./group-supply.ts";
import { businessReport } from "./report.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";
import { syncOrderStock } from "./stock.ts";
import type { GroupSupply, Material, Order, ShopState, Sku } from "./types.ts";

function material(id: string, name: string, unit: string, packSize: number, packPrice: number, stock: number): Material {
  return { id, name, buyLabel: unit, unit, packSize, packPrice, stock, minStock: null, supplier: "", pendingPrice: null };
}

test("tạo nhóm, tạo sản phẩm theo khổ, bán trừ gỗ giấy gương mực và hiện giá vốn", () => {
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
  const ink = Math.round(((13 * 18) / 10000) * 10 * 10000) / 10000;
  assert.equal(lines.find((line) => line.materialId === "giay-pp")?.qty, paper);
  assert.equal(lines.find((line) => line.materialId === "mang")?.qty, film);
  assert.equal(lines.find((line) => line.materialId === "muc-1")?.qty, ink);
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
  assert.equal(stock("muc-1"), Math.round((500 - ink * 2) * 10000) / 10000);

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
  assert.ok((quote.material ?? 0) > 1900);
  assert.equal(quote.profit !== null, true);
  assert.equal(typeof quote.marginPercent, "number");

  order.status = "xong";
  order.completedAt = "2026-10-24T03:00:00.000Z";
  const report = businessReport(state, "2026-10", "month", "tai_tiem");
  assert.equal(report.revenue, 100000);
  assert.equal(report.orderCount, 1);
  assert.equal(report.incomplete, false);
  assert.equal(report.gross !== null, true);
});

test("mực tính lọ chưa có ml thì không trừ kho", () => {
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
