import assert from "node:assert/strict";
import test from "node:test";

import { rowsFromUpload } from "./sheet.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";
import { applyPriceDrafts, parsePriceRows } from "./price-sheet.ts";
import type { BomLine, ChannelPrice, Group, Material, Sku } from "./types.ts";

const group: Group = {
  id: "trang_guong",
  name: "Ảnh ép gỗ tráng gương bo viền",
  slug: "trang-guong",
  category: "Ảnh gỗ",
  description: "Giữ nguyên",
  turnaround: "Trong ngày",
  sort: 1,
  gate: null,
};

function sku(code: string, sheets = 1): Sku {
  return {
    id: code,
    code,
    groupId: "trang_guong",
    name: sheets === 1 ? "13×18 cm" : `13×18 cm · ${sheets} tấm`,
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets,
    piecesPerPack: null,
    sort: sheets,
  };
}

function shop() {
  const gloss = sku("TG-13x18-C1");
  const wood = sku("EG-13x18-C1");
  const skus = [wood, gloss];
  const prices: ChannelPrice[] = ["tai_tiem", "facebook", "tiktok", "shopee"].map((channel) => ({
    skuId: gloss.id,
    channel: channel as ChannelPrice["channel"],
    price: channel === "tai_tiem" ? 35000 : null,
    status: channel === "tai_tiem" ? "dang_ban" : "nhap",
    note: "Giá chủ đã sửa",
  }));
  const materials = [{ id: "giay-pp" }, { id: "go-13x18" }] as Material[];
  const boms: BomLine[] = [
    { id: "TG-13x18-C1:giay-pp:print", skuId: gloss.id, materialId: "giay-pp", phase: "print", scope: "sheet", qty: 1, formula: "pp" },
    { id: "EG-13x18-C1:go-13x18:print", skuId: wood.id, materialId: "go-13x18", phase: "print", scope: "sheet", qty: 1, formula: "wood" },
  ];
  return {
    groups: [group],
    skus,
    prices,
    boms,
    materials,
    settings: DEFAULT_SETTINGS,
  };
}

test("đọc excel giá và tạo khổ, lần sau chỉ cập nhật giá", () => {
  const csv = new TextEncoder().encode("Rộng,Cao,Số tấm,Giá tại tiệm,Facebook\n25,35,1,99.000,120000\n13,18,1,39000,\n");
  const drafts = parsePriceRows(rowsFromUpload("bang-gia.csv", csv));
  assert.equal(drafts[0]?.prices.tai_tiem, 99000);
  assert.equal(drafts[0]?.prices.facebook, 120000);
  assert.equal(drafts[1]?.prices.facebook, undefined);

  const state = shop();
  const first = applyPriceDrafts(state, "trang_guong", drafts);
  assert.deepEqual(first, { created: 1, updated: 1 });
  const created = state.skus.find((item) => item.code === "TG-25x35-C1");
  assert.ok(created);
  assert.equal(created?.name, "25×35 cm");
  assert.equal(state.groups[0]?.name, "Ảnh ép gỗ tráng gương bo viền");
  assert.equal(state.skus.find((item) => item.code === "TG-13x18-C1")?.name, "13×18 cm");
  assert.equal(state.prices.find((item) => item.skuId === "TG-13x18-C1" && item.channel === "tai_tiem")?.price, 39000);
  assert.equal(state.prices.find((item) => item.skuId === "TG-13x18-C1" && item.channel === "tai_tiem")?.note, "Giá chủ đã sửa");
  assert.equal(state.prices.find((item) => item.skuId === "TG-25x35-C1" && item.channel === "tai_tiem")?.price, 99000);
  assert.ok(state.boms.some((item) => item.skuId === "TG-25x35-C1" && item.materialId === "giay-pp"));
  assert.equal(state.boms.some((item) => item.skuId === "TG-25x35-C1" && item.formula === "wood"), false);
  assert.equal(state.skus.filter((item) => item.code.startsWith("EG-")).length, 1);

  const again = applyPriceDrafts(state, "trang_guong", drafts);
  assert.deepEqual(again, { created: 0, updated: 2 });
  assert.equal(state.skus.filter((item) => item.code === "TG-25x35-C1").length, 1);
  assert.equal(state.skus.find((item) => item.code === "TG-13x18-C1")?.name, "13×18 cm");
});

test("từ chối mã EG mới và combo đắt hơn", () => {
  const state = shop();
  assert.throws(
    () =>
      applyPriceDrafts(state, "trang_guong", [
        { code: "EG-25x35-C1", widthCm: 25, heightCm: 35, sheets: 1, prices: { tai_tiem: 99000 } },
      ]),
    /Không tạo mã EG/,
  );
  assert.throws(
    () =>
      applyPriceDrafts(state, "trang_guong", [
        { code: null, widthCm: 13, heightCm: 18, sheets: 2, prices: { tai_tiem: 90000 } },
      ]),
    /giá mỗi tấm cao hơn/,
  );
  assert.equal(state.skus.length, 2);
});
