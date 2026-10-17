import assert from "node:assert/strict";
import test from "node:test";

import { comboPriceError, commissionOf, depositFor, formulaQty, quoteSku, rollMeters, stockNeeds } from "./calc.ts";
import { buildSeed, DEFAULT_SETTINGS } from "./seed.ts";
import type { BomLine, Material, Settings, Sku } from "./types.ts";

test("hoa hồng 49.100.000đ là 1.473.000đ", () => {
  const amount = commissionOf(49100000, DEFAULT_SETTINGS.commissionTiers);
  assert.equal(amount, 1473000);
});

test("combo sau không được đắt hơn trên mỗi tấm", () => {
  assert.equal(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 2, price: 180000 }]), null);
  assert.match(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 2, price: 220000 }]) ?? "", /Combo 2/);
});

test("giấy 13x18 xếp vừa khổ 61cm", () => {
  const meters = rollMeters(13, 18, 61, 0.1);
  assert.ok(meters && meters > 0 && meters < 0.2);
});

test("cọc Facebook từ 300.000đ hoặc khổ 40x60", () => {
  const base = { settings: DEFAULT_SETTINGS, channel: "facebook" as const };
  assert.equal(depositFor({ ...base, total: 200000, items: [{ size: "13x18" }] }), 0);
  assert.equal(depositFor({ ...base, total: 300000, items: [{ size: "13x18" }] }), 150000);
  assert.equal(depositFor({ ...base, total: 100000, items: [{ size: "40x60" }] }), 50000);
  assert.equal(depositFor({ ...base, total: 400000, items: [{ size: "13x18" }], channel: "tai_tiem" }), 0);
});

test("máy tính giá: lỗ thì đỏ, dưới 30% thì vàng, thiếu số thì không bịa lãi", () => {
  const sku: Sku = {
    id: "x",
    code: "x",
    groupId: "ep_go",
    name: "x",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 1,
    piecesPerPack: null,
    sort: 1,
  };
  const materials: Material[] = [
    {
      id: "go",
      name: "gỗ",
      buyLabel: "tấm",
      unit: "tấm",
      packSize: 1,
      packPrice: 100000,
      stock: 0,
      minStock: null,
      supplier: "",
      pendingPrice: null,
    },
  ];
  const boms: BomLine[] = [
    { id: "b", skuId: "x", materialId: "go", phase: "print", scope: "sheet", qty: 1, formula: "manual" },
  ];
  const loss = quoteSku({ sku, price: 1000, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(loss.tone, "red");
  const low = quoteSku({ sku, price: 150000, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(low.tone, "yellow");
  assert.ok((low.marginPercent ?? 100) < 30 && (low.profit ?? 0) > 0);
  const missing = quoteSku({ sku, price: null, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(missing.profit, null);
  assert.equal(missing.tone, "unknown");
});

test("đóng gói không trừ lúc in, và túi tính theo số tấm", () => {
  const sku: Sku = {
    id: "EG-13x18-C2",
    code: "EG-13x18-C2",
    groupId: "ep_go",
    name: "2 tấm",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 2,
    piecesPerPack: null,
    sort: 1,
  };
  const boms: BomLine[] = [
    { id: "1", skuId: sku.id, materialId: "giay-pp", phase: "print", scope: "sheet", qty: 0.05, formula: "pp" },
    { id: "2", skuId: sku.id, materialId: "tui", phase: "pack", scope: "sheet", qty: 1, formula: "bag" },
    { id: "3", skuId: sku.id, materialId: "xop", phase: "pack", scope: "parcel", qty: 0.2, formula: "foam" },
  ];
  const print = stockNeeds([{ sku, quantity: 1 }], boms, "print");
  assert.deepEqual(print.needs.map((row) => row.materialId), ["giay-pp"]);
  assert.equal(print.needs[0]?.qty, 0.1);
  const pack = stockNeeds([{ sku, quantity: 1 }], boms, "pack");
  const bag = pack.needs.find((row) => row.materialId === "tui");
  const foam = pack.needs.find((row) => row.materialId === "xop");
  assert.equal(bag?.qty, 2);
  assert.equal(foam?.qty, 0.2);
});

test("seed chỉ chứa số có trong đặc tả", async () => {
  const state = await buildSeed();
  const knownPrices = state.prices.filter((row) => row.price !== null);
  assert.deepEqual(knownPrices.map((row) => [row.skuId, row.channel, row.price]), [["TG-13x18-C4", "tiktok", 249000]]);
  const priceOf = (id: string) => state.materials.find((row) => row.id === id)?.packPrice;
  assert.equal(priceOf("giay-pp"), 702000);
  assert.equal(priceOf("go-13x18"), 1900);
  assert.equal(priceOf("go-60x90"), 39600);
  assert.equal(priceOf("tui"), null);
  assert.equal(priceOf("carton"), null);
  assert.equal(priceOf("tem"), null);
  assert.equal(state.settings.fbShipping, null);
  assert.equal(state.settings.lateDeductionPerMinute, null);
  assert.equal(state.settings.showAnhThe, false);
  assert.equal(state.settings.showAlbum, false);
  assert.equal(state.settings.showZalo, true);
  assert.equal(state.settings.fileRetentionDays, 180);
  assert.equal(state.settings.saleBase, 8000000);
  assert.equal(state.settings.productionBase, 11000000);
  const fixed = state.settings.fixedCosts.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(fixed, 29375000);
  assert.equal(state.skus.some((row) => row.code.includes("10x25")), false);
  const car = state.boms.find((row) => row.skuId === "NX-9x19-C1");
  assert.equal(car?.qty, null);
  const bag = formulaQty("bag", state.skus[0]!, state.settings);
  assert.equal(bag, 1);
  const tape = formulaQty("tape", state.skus[0]!, state.settings);
  assert.equal(tape, 0.05);
  assert.equal(state.settings.groupListed.ep_go, true);
  assert.equal(state.settings.groupListed.anh_the, false);
  const settings: Settings = state.settings;
  assert.equal(settings.marginYellowPercent, 30);
  assert.equal(settings.weeklyOff.length, 0);
});
