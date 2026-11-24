import assert from "node:assert/strict";
import test from "node:test";

import { buildPublicCatalog, familySlugOf, isRetiredDraftSku, visibleAdminSkus } from "./public-catalog.ts";
import { splitLegacyProductGroups } from "./catalog-split.ts";
import type { ChannelPrice, Group, Settings, ShopState, Sku } from "./types.ts";

const settings = { groupListed: { nam_cham_xe: true, trang_guong: true }, showAnhThe: false, showAlbum: false } as unknown as Settings;

function group(partial: Partial<Group> & Pick<Group, "id" | "name" | "slug">): Group {
  return { category: "Nam châm", description: "", turnaround: "", sort: 1, gate: null, ...partial };
}

function sku(partial: Partial<Sku> & Pick<Sku, "id" | "groupId">): Sku {
  return {
    code: partial.id,
    name: partial.name ?? partial.id,
    size: partial.size ?? "12x25",
    widthCm: partial.widthCm ?? 12,
    heightCm: partial.heightCm ?? 25,
    sheets: partial.sheets ?? 1,
    piecesPerPack: null,
    sort: partial.sort ?? 1,
    soldOn: partial.soldOn ?? [],
    ...partial,
  };
}

function price(skuId: string, channel: ChannelPrice["channel"], value: number | null, status: ChannelPrice["status"] = "dang_ban"): ChannelPrice {
  return { skuId, channel, price: value, status, note: "" };
}

test("familySlugOf dùng slug khi chưa tách", () => {
  assert.equal(familySlugOf({ slug: "nam-cham-xe" }), "nam-cham-xe");
  assert.equal(familySlugOf({ slug: "nx-12x25-c1", familySlug: "nam-cham-xe" }), "nam-cham-xe");
});

test("isRetiredDraftSku: 9x19 nháp bị ẩn khi cùng nhóm với 12x25 đang bán", () => {
  const live = sku({ id: "NX-12x25-C1", groupId: "nam_cham_xe", sort: 157, soldOn: ["tai_tiem"], widthCm: 12, heightCm: 25 });
  const draft = sku({ id: "NX-9x19-C1", groupId: "nam_cham_xe", sort: 96, soldOn: [], widthCm: 9, heightCm: 19, size: "9x19" });
  const prices = [price("NX-12x25-C1", "tai_tiem", 65000), price("NX-9x19-C1", "tai_tiem", 50000, "nhap")];
  assert.equal(isRetiredDraftSku(draft, prices, [live, draft]), true);
  assert.equal(isRetiredDraftSku(live, prices, [live, draft]), false);
  assert.deepEqual(visibleAdminSkus("nam_cham_xe", [draft, live], prices).map((item) => item.id), ["NX-12x25-C1"]);
});

test("buildPublicCatalog gom nhiều mã cùng familySlug thành một trang, giữ slug cũ", () => {
  const state = {
    settings,
    groups: [
      group({ id: "nam_cham_xe", name: "Nam châm Lái Mới 12×25", slug: "nam-cham-xe", familySlug: "nam-cham-xe", sort: 2 }),
      group({ id: "nx_12x25_c1", name: "Nam châm Lái Mới 12×25 cm", slug: "nam-cham-lai-moi-12x25-cm", familySlug: "nam-cham-xe", category: "Nam châm", sort: 2 }),
    ],
    skus: [
      sku({ id: "NX-9x19-C1", groupId: "nam_cham_xe", sort: 96, soldOn: [], widthCm: 9, heightCm: 19, size: "9x19" }),
      sku({ id: "NX-12x25-C1", groupId: "nx_12x25_c1", sort: 1, soldOn: ["tai_tiem", "facebook"], widthCm: 12, heightCm: 25 }),
    ],
    prices: [
      price("NX-9x19-C1", "tai_tiem", 50000, "nhap"),
      price("NX-12x25-C1", "tai_tiem", 65000),
    ],
  };
  const catalog = buildPublicCatalog(state, { cover: (slug) => (slug === "nam-cham-xe" ? "/cover/nx" : null), gallery: () => [] });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.slug, "nam-cham-xe");
  assert.equal(catalog[0]?.name, "Nam châm Lái Mới 12×25");
  assert.equal(catalog[0]?.cover_path, "/cover/nx");
  assert.deepEqual(catalog[0]?.variants.map((item) => [item.id, item.price]), [["NX-12x25-C1", 65000]]);
});

test("buildPublicCatalog trước khi tách: mỗi group vẫn một trang", () => {
  const state = {
    settings,
    groups: [
      group({ id: "nam_cham_xe", name: "Nam châm Lái Mới 12×25", slug: "nam-cham-xe", sort: 2 }),
      group({ id: "trang_guong", name: "Ảnh tráng gương", slug: "trang-guong", category: "Ảnh gỗ", sort: 1 }),
    ],
    skus: [
      sku({ id: "NX-9x19-C1", groupId: "nam_cham_xe", sort: 96, soldOn: [], widthCm: 9, heightCm: 19, size: "9x19" }),
      sku({ id: "NX-12x25-C1", groupId: "nam_cham_xe", sort: 157, soldOn: ["tai_tiem"], widthCm: 12, heightCm: 25 }),
      sku({ id: "TG-13x18-C1", groupId: "trang_guong", sort: 1, soldOn: ["tai_tiem"], widthCm: 13, heightCm: 18, size: "13x18" }),
    ],
    prices: [
      price("NX-9x19-C1", "tai_tiem", 50000, "nhap"),
      price("NX-12x25-C1", "tai_tiem", 65000),
      price("TG-13x18-C1", "tai_tiem", 37000),
    ],
  };
  const catalog = buildPublicCatalog(state, { cover: () => null, gallery: () => [] });
  assert.deepEqual(catalog.map((item) => item.slug), ["trang-guong", "nam-cham-xe"]);
  assert.deepEqual(catalog.find((item) => item.slug === "nam-cham-xe")?.variants.map((item) => item.id), ["NX-12x25-C1"]);
});

test("splitLegacyProductGroups tách mỗi mã một group, giữ shell slug cũ", () => {
  const state = {
    settings: { ...settings, groupListed: { trang_guong: true } },
    groups: [group({ id: "trang_guong", name: "Ảnh tráng gương 4K HD", slug: "trang-guong", category: "Ảnh gỗ", sort: 1 })],
    skus: [
      sku({ id: "EG-13x18-C1", code: "EG-13x18-C1", groupId: "trang_guong", sort: 1, soldOn: [], widthCm: 13, heightCm: 18, size: "13x18" }),
      sku({ id: "TG-13x18-C1", code: "TG-13x18-C1", groupId: "trang_guong", sort: 103, soldOn: ["tai_tiem"], widthCm: 13, heightCm: 18, size: "13x18", name: "13×18 cm" }),
      sku({ id: "TG-13x18-C2", code: "TG-13x18-C2", groupId: "trang_guong", sort: 104, soldOn: ["tai_tiem"], widthCm: 13, heightCm: 18, size: "13x18", sheets: 2, name: "13×18 cm · 2 tấm" }),
    ],
    prices: [
      price("EG-13x18-C1", "tai_tiem", null, "nhap"),
      price("TG-13x18-C1", "tai_tiem", 37000),
      price("TG-13x18-C2", "tai_tiem", 69000),
    ],
  } as unknown as ShopState;
  const result = splitLegacyProductGroups(state);
  assert.equal(result.shells[0], "trang_guong");
  assert.equal(result.created.length, 2);
  const child = state.groups.find((item) => item.id === result.created[0]?.groupId);
  assert.equal(child?.familySlug, "trang-guong");
  assert.equal(state.groups.find((item) => item.id === "trang_guong")?.slug, "trang-guong");
  assert.equal(state.skus.find((item) => item.id === "TG-13x18-C1")?.groupId, result.created.find((row) => row.skuId === "TG-13x18-C1")?.groupId);
  assert.equal(state.skus.find((item) => item.id === "EG-13x18-C1")?.groupId, "trang_guong");
  const catalog = buildPublicCatalog(state, { cover: (slug) => (slug === "trang-guong" ? "/c" : null), gallery: () => [] });
  assert.equal(catalog.length, 1);
  assert.equal(catalog[0]?.slug, "trang-guong");
  assert.equal(catalog[0]?.cover_path, "/c");
  assert.deepEqual(catalog[0]?.variants.map((item) => item.price), [37000, 69000]);
});

test("nhóm chỉ còn 1 mã đang bán (nam châm 12x25) thì không tách, 9x19 vẫn ẩn", () => {
  const state = {
    settings: { ...settings, groupListed: { nam_cham_xe: true } },
    groups: [group({ id: "nam_cham_xe", name: "Nam châm Lái Mới 12×25", slug: "nam-cham-xe", sort: 2 })],
    skus: [
      sku({ id: "NX-9x19-C1", code: "NX-9x19-C1", groupId: "nam_cham_xe", sort: 96, soldOn: [], widthCm: 9, heightCm: 19, size: "9x19" }),
      sku({ id: "NX-12x25-C1", code: "NX-12x25-C1", groupId: "nam_cham_xe", sort: 157, soldOn: ["tai_tiem"], widthCm: 12, heightCm: 25 }),
    ],
    prices: [price("NX-9x19-C1", "tai_tiem", 50000, "nhap"), price("NX-12x25-C1", "tai_tiem", 65000)],
  } as unknown as ShopState;
  const result = splitLegacyProductGroups(state);
  assert.deepEqual(result.created, []);
  assert.deepEqual(result.skipped, ["nam_cham_xe"]);
  assert.deepEqual(visibleAdminSkus("nam_cham_xe", state.skus, state.prices).map((item) => item.id), ["NX-12x25-C1"]);
});
