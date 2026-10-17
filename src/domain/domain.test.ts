import assert from "node:assert/strict";
import test from "node:test";

import {
  comboPriceError,
  comboWarnings,
  commissionOf,
  depositFor,
  formulaQty,
  quoteSku,
  rollMeters,
  round4,
  stockNeeds,
  walkInPublicOffers,
} from "./calc.ts";
import { buildSeed, DEFAULT_SETTINGS, hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "./seed.ts";
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

test("seed dùng giá chủ duyệt và catalog khách không hiện Liên hệ khi đã có giá tại tiệm", async () => {
  const state = await buildSeed();
  const price = (code: string, channel: string) =>
    state.prices.find((row) => row.skuId === code && row.channel === channel)?.price ?? null;
  assert.equal(price("TG-13x18-C1", "tai_tiem"), 35000);
  assert.equal(price("TG-13x18-C4", "tiktok"), 249000);
  assert.equal(price("AT-20x30-C1", "tai_tiem"), 59000);
  assert.equal(price("AT-20x30-C1", "tiktok"), 130000);
  assert.equal(price("GK-20x30-C1", "tiktok"), 130000);
  assert.equal(price("NCT-6x9-10", "tiktok"), 99000);
  assert.equal(price("NCT-6x9-1", "tai_tiem"), 10000);
  assert.equal(price("NCT-6x9-1", "tiktok"), null);
  assert.equal(price("TG-13x18-C2", "tiktok"), null);
  assert.equal(price("NX-9x19-C1", "tai_tiem"), 50000);
  assert.equal(price("NX-17x22-C1", "tiktok"), 95000);
  assert.equal(price("EG-40x60-C1", "tai_tiem"), 149000);
  assert.equal(price("EG-13x18-C1", "tai_tiem"), null);
  assert.equal(state.prices.filter((row) => row.price !== null).length, 279);
  const offers = walkInPublicOffers(state);
  assert.ok(offers.length > 0);
  for (const offer of offers) {
    assert.equal(offer.requires_quote, false, offer.code);
    assert.equal(typeof offer.price, "number");
    assert.ok((offer.price ?? 0) > 0, offer.code);
  }
  const offered = new Set(offers.map((row) => row.code));
  assert.equal(offered.has("TG-13x18-C1"), true);
  assert.equal(offered.has("EG-13x18-C1"), false);
  assert.equal(offered.has("NCT-6x9-1"), true);
  assert.equal(offered.has("LUA-6x9-10"), false);
  assert.deepEqual(
    comboWarnings(
      state.skus.filter((sku) => sku.groupId === "trang_guong"),
      state.prices,
      "tai_tiem",
    ),
    [],
  );
  assert.ok(
    comboWarnings(
      state.skus.filter((sku) => sku.groupId === "lua"),
      state.prices,
      "tai_tiem",
    ).length > 0,
  );
  const pack = state.skus.find((sku) => sku.code === "NCT-6x9-10");
  assert.ok(pack);
  assert.equal(pack.sheets, 10);
  assert.equal(formulaQty("magnet-6x9", pack, state.settings), round4(1 / 96));
  const magnet = stockNeeds([{ sku: pack, quantity: 1 }], state.boms, "print").needs.find(
    (row) => row.materialId === "nam-cham",
  );
  assert.equal(magnet?.qty, round4(1 / 96) * 10);
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
  assert.equal(fixed, 29400000);
  assert.equal(state.skus.some((row) => row.code.includes("10x25")), false);
  const car = state.boms.find((row) => row.skuId === "NX-9x19-C1");
  assert.equal(car?.qty, null);
  const bag = formulaQty("bag", state.skus[0]!, state.settings);
  assert.equal(bag, 1);
  const tape = formulaQty("tape", state.skus[0]!, state.settings);
  assert.equal(tape, 0.05);
  assert.equal(state.settings.groupListed.ep_go, true);
  assert.equal(state.settings.groupListed.trang_guong, true);
  assert.equal(state.settings.groupListed.anh_the, false);
  assert.equal(state.settings.groupListed.lua, false);
  assert.equal(state.settings.groupListed.tkb, false);
  const settings: Settings = state.settings;
  assert.equal(settings.marginYellowPercent, 30);
  assert.equal(settings.weeklyOff.length, 0);
});

test("mật khẩu ghi số vòng PBKDF2 và vẫn đọc hash cũ", async () => {
  const hash = await hashPassword("ThienThien#2026", "salt-moi");
  assert.equal(hash.split("$")[1], String(PBKDF2_ITERATIONS));
  assert.match(hash, /^pbkdf2\$100000\$salt-moi\$[0-9a-f]{64}$/);
  assert.equal(await verifyPassword("ThienThien#2026", hash), true);
  assert.equal(await verifyPassword("sai", hash), false);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("ThienThien#2026"), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode("salt-cu"), iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const legacy = `pbkdf2$salt-cu$${hex}`;
  assert.equal(await verifyPassword("ThienThien#2026", legacy), true);
  assert.equal(await verifyPassword("sai", legacy), false);
  assert.equal(await verifyPassword("ThienThien#2026", "pbkdf2$120001$salt-cu$00"), false);
  assert.equal(await verifyPassword("ThienThien#2026", "khong-phai-hash"), false);
});
