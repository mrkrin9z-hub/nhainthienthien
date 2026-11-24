import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { groupIsListed, walkInPublicOffers } from "./calc.ts";
import { buildWebProduct, slugifyProductName, suggestProductCode } from "./web-product.ts";

const empty = { slugs: [] as string[], ids: [] as string[], codes: [] as string[], sorts: [] as number[] };

test("mã gợi ý: lẻ theo nhóm+khổ, combo kiểu Combo13x18-02", () => {
  assert.equal(suggestProductCode({ category: "Tráng gương", widthCm: 13, heightCm: 18, sheets: 1 }), "TG-13X18");
  assert.equal(suggestProductCode({ category: "Tráng gương", widthCm: 13, heightCm: 18, sheets: 2 }), "COMBO13X18-02");
});

test("thêm sản phẩm thì trang chủ thấy giá tại tiệm", () => {
  assert.equal(slugifyProductName("  Ảnh Canvas Đẹp  "), "anh-canvas-dep");
  const built = buildWebProduct(
    {
      name: "Ảnh canvas 20×30",
      category: "Ảnh gỗ",
      description: "In trên khung gỗ.",
      turnaround: "",
      sizes: [{ widthCm: 20, heightCm: 30, sheets: 1, price: 89000 }],
    },
    { slugs: ["trang-guong"], ids: ["trang_guong"], codes: ["TG-20x30-1"], sorts: [1] },
  );
  assert.equal(built.group.slug, "anh-canvas-20-30");
  assert.equal(built.group.gate, null);
  assert.equal(built.skus.length, 1);
  assert.equal(built.skus[0]?.sheets, 1);
  const settings = { showAnhThe: false, showAlbum: false, groupListed: { [built.group.id]: true } };
  const offers = walkInPublicOffers({
    settings: settings as never,
    groups: [built.group],
    skus: built.skus,
    prices: built.prices,
  });
  assert.equal(offers.length, 1);
  assert.equal(offers[0]?.price, 89000);
  assert.equal(groupIsListed(settings as never, built.group), true);

  const again = buildWebProduct(
    { name: "Ảnh canvas 20×30", category: "Ảnh gỗ", description: "", turnaround: "", sizes: [{ widthCm: 10, heightCm: 15, sheets: 1, price: 25000 }] },
    { slugs: [built.group.slug], ids: [built.group.id], codes: built.skus.map((sku) => sku.code), sorts: [built.group.sort] },
  );
  assert.equal(again.group.slug, "anh-canvas-20-30-2");
  assert.notEqual(again.group.id, built.group.id);
});

test("từ chối gộp nhiều khổ vào một mã", () => {
  assert.throws(
    () =>
      buildWebProduct(
        {
          name: "Nam châm",
          category: "Nam châm",
          description: "",
          turnaround: "",
          sizes: [
            { widthCm: 6, heightCm: 9, sheets: 1, price: 10000 },
            { widthCm: 6, heightCm: 9, sheets: 5, price: 45000 },
          ],
        },
        empty,
      ),
    /một khổ hoặc một combo/,
  );
});

test("trang quản trị quản lý sản phẩm + giá kênh, không gắn trang chủ/ảnh", () => {
  const page = readFileSync(new URL("../routes/admin.san-pham.tsx", import.meta.url), "utf8");
  const editor = readFileSync(new URL("../components/admin/product-editor.tsx", import.meta.url), "utf8");
  const modules = readFileSync(new URL("../admin-os/modules.ts", import.meta.url), "utf8");
  const home = readFileSync(new URL("../routes/index.tsx", import.meta.url), "utf8");
  assert.match(page, /ProductEditor/);
  assert.match(page, /importWebProducts|Xuất file mẫu/);
  assert.match(page, /Mỗi mã = một khổ/);
  assert.match(page, /Quản lý nhóm/);
  assert.match(page, /deleteWebProductFn/);
  assert.match(page, /categoryFilter/);
  assert.match(page, /Tìm mã, tên, nhóm/);
  assert.match(editor, /createWebProduct/);
  assert.match(editor, /updateWebProduct/);
  assert.match(editor, /suggestProductCode/);
  assert.match(editor, /getProductCategories/);
  assert.doesNotMatch(editor, /Hiện trên trang chủ/);
  assert.doesNotMatch(editor, /Ảnh đại diện/);
  assert.doesNotMatch(editor, /Thêm khổ/);
  assert.match(modules, /Quản lý sản phẩm/);
  assert.doesNotMatch(modules, /Bảng giá 6 kênh/);
  assert.match(home, /catalogQueryOptions/);
  assert.match(home, /id="gian-hang"/);
});

test("sản phẩm mới nhận giá từng kênh", () => {
  const built = buildWebProduct(
    {
      name: "Ảnh lụa 6x9 lẻ",
      category: "Ảnh lụa",
      description: "In lẻ",
      turnaround: "",
      listed: true,
      sizes: [
        {
          widthCm: 6,
          heightCm: 9,
          sheets: 1,
          price: 3000,
          minTotal: 30000,
          prices: { facebook: 3000, ctv: 2700, mo_home: 2400 },
        },
      ],
    },
    { slugs: [], ids: [], codes: [], sorts: [0] },
  );
  assert.equal(built.group.slug, "anh-lua-6x9-le");
  const byChannel = Object.fromEntries(built.prices.map((row) => [row.channel, row]));
  assert.equal(byChannel["tai_tiem"]?.price, 3000);
  assert.equal(byChannel["tai_tiem"]?.minTotal, 30000);
  assert.equal(byChannel["facebook"]?.price, 3000);
  assert.equal(byChannel["ctv"]?.price, 2700);
  assert.equal(byChannel["mo_home"]?.price, 2400);
  assert.equal(byChannel["tiktok"]?.price, null);
  assert.equal(byChannel["tiktok"]?.status, "nhap");
  assert.deepEqual(built.skus[0]?.soldOn, ["tai_tiem", "facebook", "ctv", "mo_home"]);
});

test("combo là sản phẩm riêng với mã riêng", () => {
  const built = buildWebProduct(
    {
      name: "Tráng gương Combo 13×18 · 2 tấm",
      code: "Combo13x18-02",
      category: "Tráng gương",
      description: "",
      turnaround: "",
      sizes: [
        {
          widthCm: 13,
          heightCm: 18,
          sheets: 2,
          price: 80000,
          quotes: {
            tai_tiem: { price: 80000, sold: true },
            facebook: { price: 80000, sold: true },
            tiktok: { price: null, sold: false },
            shopee: { price: null, sold: false },
            ctv: { price: null, sold: false },
            mo_home: { price: null, sold: false },
          },
        },
      ],
    },
    empty,
  );
  assert.equal(built.skus.length, 1);
  assert.equal(built.skus[0]?.sheets, 2);
  assert.match(built.skus[0]!.code.toUpperCase(), /COMBO13X18-02/);
  assert.equal(built.prices.find((row) => row.channel === "tai_tiem")?.price, 80000);
});

test("tạo sản phẩm ghi đủ giá 6 kênh và không lấy giá CTV làm giá công khai", () => {
  const built = buildWebProduct(
    {
      name: "Ảnh thử 13×18",
      category: "Ảnh gỗ",
      description: "",
      turnaround: "",
      sizes: [
        {
          widthCm: 13,
          heightCm: 18,
          sheets: 1,
          price: 37000,
          quotes: {
            tai_tiem: { price: 37000, sold: true, minTotal: null },
            facebook: { price: 37000, sold: true },
            tiktok: { price: 39000, sold: true },
            shopee: { price: 39000, sold: true },
            ctv: { price: 33000, sold: true },
            mo_home: { price: 25000, sold: true },
          },
        },
      ],
    },
    empty,
  );
  const byChannel = Object.fromEntries(built.prices.map((row) => [row.channel, row]));
  assert.equal(byChannel["tai_tiem"]?.price, 37000);
  assert.equal(byChannel["tiktok"]?.price, 39000);
  assert.equal(byChannel["ctv"]?.price, 33000);
  assert.equal(byChannel["mo_home"]?.price, 25000);
  const settings = { showAnhThe: false, showAlbum: false, groupListed: { [built.group.id]: true } };
  const offers = walkInPublicOffers({ settings: settings as never, groups: [built.group], skus: built.skus, prices: built.prices });
  assert.equal(offers[0]?.price, 37000);
});
