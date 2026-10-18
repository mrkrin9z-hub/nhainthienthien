import assert from "node:assert/strict";
import test from "node:test";

import {
  applyShelfOffers,
  cloneChannelPrices,
  offersFromShopeeItem,
  offersFromTiktokProduct,
  shopeeListPage,
  shopCodeForSeller,
  tiktokSearchPage,
  type ShelfShop,
} from "./catalog-sync.ts";
import type { ChannelPrice, Group, Sku } from "./types.ts";

function group(): Group {
  return {
    id: "trang_guong",
    name: "Ảnh ép gỗ tráng gương bo viền",
    slug: "trang-guong",
    category: "Ảnh gỗ",
    description: "Giữ",
    turnaround: "Trong ngày",
    sort: 1,
    gate: null,
  };
}

function sku(code: string): Sku {
  return {
    id: code,
    code,
    groupId: "trang_guong",
    name: "13×18 cm",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 1,
    piecesPerPack: null,
    sort: 1,
  };
}

function shop(): ShelfShop {
  const gloss = sku("TG-13x18-C1");
  const wood = sku("EG-13x18-C1");
  const prices: ChannelPrice[] = (["tai_tiem", "facebook", "tiktok", "shopee"] as const).flatMap((channel) => [
    { skuId: gloss.id, channel, price: channel === "tai_tiem" ? 35000 : null, status: channel === "tai_tiem" ? "dang_ban" : "nhap", note: "" },
    { skuId: wood.id, channel, price: null, status: "nhap", note: "" },
  ]);
  return { groups: [group()], skus: [gloss, wood], prices, skuMaps: [] };
}

test("đọc trang sản phẩm TikTok và Shopee", () => {
  assert.deepEqual(tiktokSearchPage({ products: [{ id: "1729592969712207008" }, { id: "x" }], next_page_token: "next" }), {
    ids: ["1729592969712207008"],
    next: "next",
  });
  assert.deepEqual(shopeeListPage({ item: [{ item_id: 99 }], has_next_page: true, next_offset: 20 }), {
    ids: ["99"],
    nextOffset: 20,
  });
  assert.equal(shopeeListPage({ item: [], has_next_page: false }).nextOffset, null);
  const tiktok = offersFromTiktokProduct({
    title: "Ảnh ép gỗ",
    status: "ACTIVATE",
    skus: [
      {
        id: "1729592969712207012",
        seller_sku: "TG-13x18-C1",
        price: { currency: "VND", sale_price: "39000" },
        sales_attributes: [{ name: "Khổ", value_name: "13x18" }],
      },
      { id: "1729592969712207013", seller_sku: "OFF", status_info: { status: "DEACTIVATED" }, price: { sale_price: "1" } },
    ],
  });
  assert.equal(tiktok[0]?.price, 39000);
  assert.equal(tiktok[0]?.variantName, "13x18");
  assert.equal(tiktok[1]?.active, false);
  assert.equal(offersFromTiktokProduct({ title: "Ẩn", status: "SELLER_DEACTIVATED", skus: [] }).length, 0);
  const shopee = offersFromShopeeItem(
    { item_id: 10, item_name: "Ảnh", has_model: true },
    {
      tier_variation: [{ option_list: [{ option: "15x21" }] }],
      model: [{ model_id: 77, model_sku: "TG-15x21", tier_index: [0], price_info: [{ current_price: 39000, original_price: 45000 }] }],
    },
  );
  assert.equal(shopee[0]?.sellerSku, "TG-15x21");
  assert.equal(shopee[0]?.price, 39000);
  assert.equal(shopee[0]?.variantName, "15x21");
  const plain = offersFromShopeeItem({ item_id: 8, item_name: "Khung", item_sku: "KHUNG", has_model: false, price_info: [{ current_price: 20000 }] }, null);
  assert.equal(plain[0]?.platformSkuId, "8");
  assert.equal(shopCodeForSeller("EG-1"), null);
  assert.equal(shopCodeForSeller("13x18"), null);
  assert.equal(shopCodeForSeller("TG-13x18-C1"), "TG-13x18-C1");
});

test("SKU sàn khớp mã tiệm thì chỉ sửa giá kênh đó", () => {
  const state = shop();
  const first = applyShelfOffers(state, [
    {
      channel: "tiktok",
      sellerSku: "TG-13x18-C1",
      platformSkuId: "1729592969712207012",
      productName: "Tên sàn khác",
      variantName: "13x18",
      price: 42000,
      active: true,
    },
    {
      channel: "shopee",
      sellerSku: "EG-MOI",
      platformSkuId: "55",
      productName: "Ảnh",
      variantName: "",
      price: 10000,
      active: true,
    },
  ]);
  assert.equal(first.created, 0);
  assert.equal(first.priced, 1);
  assert.equal(first.skipped.length, 1);
  const gloss = state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tiktok");
  const walk = state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem");
  assert.equal(gloss?.price, 42000);
  assert.equal(gloss?.status, "dang_ban");
  assert.equal(walk?.price, 35000);
  assert.equal(state.groups[0]?.name, "Ảnh ép gỗ tráng gương bo viền");
  assert.equal(state.groups[0]?.turnaround, "Trong ngày");
  assert.equal(state.skuMaps.some((row) => row.externalSku === "TG-13x18-C1" && row.skuId === "TG-13x18-C1"), true);
  const again = applyShelfOffers(state, [
    {
      channel: "tiktok",
      sellerSku: "TG-13x18-C1",
      platformSkuId: "1729592969712207012",
      productName: "Tên sàn khác",
      variantName: "13x18",
      price: 42000,
      active: true,
    },
  ]);
  assert.equal(again.priced, 0);
  assert.equal(again.created, 0);
  assert.equal(state.skus.length, 2);
});

test("SKU sàn mới vào web, giá lẻ và Facebook để trống", () => {
  const state = shop();
  const result = applyShelfOffers(state, [
    {
      channel: "shopee",
      sellerSku: "KHUNG-20",
      platformSkuId: "88",
      productName: "Khung gỗ",
      variantName: "20x30",
      price: 59000,
      active: true,
    },
    {
      channel: "tiktok",
      sellerSku: "",
      platformSkuId: "1729592969712207999",
      productName: "Album",
      variantName: "",
      price: 99000,
      active: true,
    },
  ]);
  assert.equal(result.created, 2);
  const khung = state.skus.find((item) => item.code === "KHUNG-20");
  assert.ok(khung);
  assert.equal(khung?.widthCm, 20);
  assert.equal(khung?.code.startsWith("EG-"), false);
  const walk = state.prices.find((row) => row.skuId === khung?.id && row.channel === "tai_tiem");
  const facebook = state.prices.find((row) => row.skuId === khung?.id && row.channel === "facebook");
  const shopee = state.prices.find((row) => row.skuId === khung?.id && row.channel === "shopee");
  assert.equal(walk?.price, null);
  assert.equal(walk?.status, "nhap");
  assert.equal(facebook?.status, "nhap");
  assert.equal(shopee?.price, 59000);
  assert.equal(state.groups.some((item) => item.name === "Khung gỗ" && item.turnaround === ""), true);
  assert.equal(state.groups[0]?.description, "Giữ");
  const album = state.skus.find((item) => item.code.startsWith("TT-"));
  assert.ok(album);
  assert.equal(album?.code.startsWith("EG-"), false);
});

test("nhân bản giá sàn sang kênh lẻ, không ghi đè giá đã nhập", () => {
  const state = shop();
  applyShelfOffers(state, [
    {
      channel: "tiktok",
      sellerSku: "TG-13x18-C1",
      platformSkuId: "1729592969712207012",
      productName: "Ảnh",
      variantName: "13x18",
      price: 42000,
      active: true,
    },
  ]);
  const filled = cloneChannelPrices(state, { groupId: "trang_guong", from: "tiktok", to: "facebook", overwrite: false });
  assert.equal(filled.copied, 1);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "facebook")?.price, 42000);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tiktok")?.price, 42000);
  const kept = cloneChannelPrices(state, { groupId: "trang_guong", from: "tiktok", to: "tai_tiem", overwrite: false });
  assert.equal(kept.kept, 1);
  assert.equal(kept.copied, 0);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem")?.price, 35000);
  const replaced = cloneChannelPrices(state, { groupId: "trang_guong", from: "tiktok", to: "tai_tiem", overwrite: true });
  assert.equal(replaced.copied, 1);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem")?.price, 42000);
});
