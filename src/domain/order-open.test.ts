import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { isMergedWoodAlias, lineAmountAfterDiscount } from "./calc.ts";
import { addSkusToLines, deskLineAmountAfterDiscount, deskSaveItems, normalizeDeskDiscount, normalizeDeskLines, skuTitle } from "./desk-lines.ts";
import { findOrderByRef, staffOrderHref } from "./find-order.ts";
import { filterPickerRows, pickerCatalog, pickerGroupNames, PICKER_SEARCH_WRAP_CLASS, PICKER_TOOLBAR_CLASS, PICKER_TYPE_SELECT_CLASS } from "./product-picker.ts";
import type { Channel, Order, ShopState } from "./types.ts";
import { orderDetail } from "./views.ts";

const fixturePath = join(dirname(fileURLToPath(import.meta.url)), "fixtures/tt261124-001-open.json");
const fixture = JSON.parse(readFileSync(fixturePath, "utf8")) as {
  settings: ShopState["settings"];
  staff: ShopState["staff"];
  groups: ShopState["groups"];
  skus: ShopState["skus"];
  prices: ShopState["prices"];
  materials: ShopState["materials"];
  boms: ShopState["boms"];
  groupSupplies: ShopState["groupSupplies"];
  sizeOverrides: ShopState["sizeOverrides"];
  customers: ShopState["customers"];
  orders: Order[];
  reprints: ShopState["reprints"];
};

function shopFromFixture(): ShopState {
  return {
    ...fixture,
    movements: [],
    counts: [],
    audits: [],
  } as unknown as ShopState;
}

test("tìm đơn TT261124-001 theo mã hoặc UUID, không phân biệt hoa thường", () => {
  const orders = fixture.orders;
  const byCode = findOrderByRef(orders, "TT261124-001");
  const byLower = findOrderByRef(orders, "tt261124-001");
  const byId = findOrderByRef(orders, "f9da79ce-b5b4-4c30-a20b-1680458e8783");
  const padded = findOrderByRef(orders, "  TT261124-001  ");
  assert.equal(byCode?.code, "TT261124-001");
  assert.equal(byLower?.id, byCode?.id);
  assert.equal(byId?.code, "TT261124-001");
  assert.equal(padded?.id, byCode?.id);
  assert.equal(findOrderByRef(orders, ""), undefined);
  assert.equal(findOrderByRef(orders, "KHÔNG-CÓ"), undefined);
  assert.equal(findOrderByRef(undefined, "TT261124-001"), undefined);
  assert.equal(staffOrderHref("TT261124-001"), "/admin/don-hang/TT261124-001");
  assert.equal(staffOrderHref("f9da79ce-b5b4-4c30-a20b-1680458e8783"), "/admin/don-hang/f9da79ce-b5b4-4c30-a20b-1680458e8783");
});

test("orderDetail không vỡ với đơn thật thiếu item.discount (tạo trước TT-13)", () => {
  const state = shopFromFixture();
  const order = findOrderByRef(state.orders, "TT261124-001");
  assert.ok(order);
  assert.equal(order.items[0]?.discount, undefined);
  assert.equal(order.discount, null);

  for (const role of ["owner", "sale", "production"] as const) {
    const detail = orderDetail(state, order, role);
    assert.equal(detail.code, "TT261124-001");
    assert.equal(detail.id, order.id);
    assert.equal(detail.items.length, 1);
    assert.equal(detail.items[0]?.skuId, "AT-20x30-C1");
    assert.equal(detail.history.length, 2);
    assert.equal(detail.files.length, 1);
    assert.equal(detail.customerName, "Ccccv");
    if (role === "production") {
      assert.equal(detail.items[0]?.unitPrice, null);
    } else {
      assert.equal(detail.items[0]?.unitPrice, 56000);
      assert.equal(detail.total, 56000);
    }
    if (role === "owner") {
      assert.ok(Array.isArray(detail.quote));
      assert.equal(detail.quote?.length, 1);
      assert.ok(detail.quote?.[0]);
    }
  }
});

test("normalize dòng bàn đơn: thiếu discount / groupName / name không throw", () => {
  const lines = normalizeDeskLines([
    { key: "1", skuId: "AT-20x30-C1", unitPrice: 56000, quantity: 1, variant: undefined, discount: undefined },
  ]);
  assert.equal(lines[0]?.discount, "");
  assert.equal(lines[0]?.variant, "");
  assert.equal(normalizeDeskDiscount(undefined), "");
  assert.equal(normalizeDeskDiscount(null), "");
  assert.equal(normalizeDeskDiscount(0), "");
  assert.equal(normalizeDeskDiscount("0"), "");
  assert.equal(normalizeDeskDiscount(5000), "5000");
  assert.equal(skuTitle({ groupName: "Ảnh thờ ép gỗ", name: "20×30 cm" }), "Ảnh thờ ép gỗ · 20×30 cm");
  assert.equal(skuTitle({ name: "20×30 cm" }), "20×30 cm");
  assert.equal(skuTitle({}), "");
  assert.equal(skuTitle(undefined), "");
  assert.equal(isMergedWoodAlias({} as { code: string }), false);
  assert.equal(isMergedWoodAlias({ code: "EG-1" }), true);
  assert.equal(isMergedWoodAlias({ code: "AT-20x30-C1" }), false);
});

test("mở picker, tìm, chọn, sửa SL/giảm giá rồi dựng payload lưu", () => {
  const catalog = [
    {
      id: "AT-20x30-C1",
      code: "AT-20x30-C1",
      name: "20×30 cm",
      groupName: "Ảnh thờ ép gỗ",
      label: "AT-20x30-C1 · Ảnh thờ ép gỗ · 20×30 cm",
      prices: { tai_tiem: 56000 } as Partial<Record<Channel, number | null>>,
    },
    {
      id: "missing-price",
      code: "X",
      name: "Chưa giá",
      groupName: "Khác",
      label: "X",
      prices: { tai_tiem: null } as Partial<Record<Channel, number | null>>,
    },
  ];
  assert.equal(pickerCatalog(null).length, 0);
  assert.deepEqual(pickerGroupNames(catalog), ["Ảnh thờ ép gỗ", "Khác"]);
  const visible = filterPickerRows(catalog, { q: "", group: "all", showUnpriced: false, channel: "tai_tiem" });
  assert.deepEqual(visible.map((sku) => sku.id), ["AT-20x30-C1"]);
  const searched = filterPickerRows(catalog, { q: "20x30", group: "all", showUnpriced: true, channel: "tai_tiem" });
  assert.equal(searched.length, 1);
  assert.equal(searched[0]?.id, "AT-20x30-C1");
  const byGroup = filterPickerRows(catalog, { q: "", group: "Ảnh thờ ép gỗ", showUnpriced: true, channel: "tai_tiem" });
  assert.equal(byGroup.length, 1);

  let keys = 0;
  const lines = addSkusToLines([], ["AT-20x30-C1"], catalog, "tai_tiem", () => `k${++keys}`);
  assert.equal(lines.length, 1);
  assert.equal(lines[0]?.unitPrice, "56000");
  assert.equal(lines[0]?.discount, "");
  const withQty = [{ ...lines[0]!, quantity: 2, discount: "5.000" }];
  const amount = deskLineAmountAfterDiscount({
    unit: 56000,
    quantity: 2,
    discount: withQty[0]!.discount,
    hasSku: true,
  });
  assert.equal(amount, lineAmountAfterDiscount(56000, 2, null, 5000));
  assert.equal(amount, 107000);
  const payload = deskSaveItems(
    [{ ...withQty[0]!, sku: catalog[0], unit: 56000, priceTouched: false }],
    "",
  );
  assert.deepEqual(payload, [
    { skuId: "AT-20x30-C1", quantity: 2, variant: "", unitPrice: 56000, discount: 5000 },
  ]);
});

test("toolbar modal chọn sản phẩm: mobile 2 hàng full-width, sm mới xếp ngang", () => {
  assert.match(PICKER_TOOLBAR_CLASS, /flex-col/);
  assert.match(PICKER_TOOLBAR_CLASS, /sm:flex-row/);
  assert.match(PICKER_SEARCH_WRAP_CLASS, /w-full/);
  assert.match(PICKER_SEARCH_WRAP_CLASS, /min-w-0/);
  assert.match(PICKER_SEARCH_WRAP_CLASS, /sm:flex-1/);
  assert.equal(/(^|\s)flex-1(\s|$)/.test(PICKER_SEARCH_WRAP_CLASS), false);
  assert.match(PICKER_TYPE_SELECT_CLASS, /w-full/);
  assert.match(PICKER_TYPE_SELECT_CLASS, /min-w-0/);
  assert.match(PICKER_TYPE_SELECT_CLASS, /sm:w-auto/);
  assert.match(PICKER_TYPE_SELECT_CLASS, /sm:min-w-\[10rem\]/);
});
