import assert from "node:assert/strict";
import test from "node:test";

import { applyStoreMigrations } from "./migrate-shop.ts";
import { applyOrderDesk, deskAlerts, deskTabMeta, deskTabOf, estimateNet, listStatusChoices, maskBuyer, shipModeOf } from "./order-desk.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";

test("danh sách chỉ đưa bước kế, không nhảy", () => {
  assert.deepEqual(listStatusChoices({ status: "nhan_don", role: "owner", channel: "tai_tiem" }), ["thiet_ke", "huy"]);
  assert.deepEqual(listStatusChoices({ status: "in", role: "owner", channel: "tai_tiem" }), ["cho_duyet", "dong_goi", "huy"]);
  assert.equal(listStatusChoices({ status: "in", role: "owner", channel: "tai_tiem" }).includes("xong"), false);
  assert.deepEqual(listStatusChoices({ status: "in", role: "production", channel: "tai_tiem" }), ["dong_goi"]);
  assert.deepEqual(listStatusChoices({ status: "nhan_don", role: "production", channel: "facebook" }), []);
  assert.deepEqual(listStatusChoices({ status: "dong_goi", role: "production", channel: "mo_home" }), ["in", "giao"]);
  assert.deepEqual(listStatusChoices({ status: "xong", role: "sale", channel: "tai_tiem" }), []);
  assert.deepEqual(listStatusChoices({ status: "xong", role: "owner", channel: "tai_tiem" }), ["giao"]);
});

test("bốn tab làm việc, không nhảy bước xưởng", () => {
  assert.equal(deskTabOf({ status: "nhan_don" }), "can_lam");
  assert.equal(deskTabOf({ status: "thiet_ke" }), "can_lam");
  assert.equal(deskTabOf({ status: "dong_goi" }), "can_gui");
  assert.equal(deskTabOf({ status: "giao" }), "dang_giao");
  assert.equal(deskTabOf({ status: "xong" }), "xong_huy");
  assert.equal(deskTabOf({ status: "huy" }), "xong_huy");
  assert.equal(deskTabOf({ status: "giao", deskIssue: "giao_that_bai" }), "dang_giao");
  assert.equal(deskTabOf({ status: "nhan_don", deskIssue: "tra_hang" }), "can_lam");
  assert.equal(deskTabOf({ status: "xong", deskIssue: "tra_hang" }), "xong_huy");
  assert.equal(deskTabMeta("can_lam").label, "Cần làm");
  assert.equal(deskTabMeta("can_gui").label, "Cần gửi");
  assert.equal(deskTabMeta("xong_huy").label, "Xong/Hủy");
  assert.equal(shipModeOf({ channel: "tiktok", fulfillment: "delivery" }), "san");
  assert.equal(shipModeOf({ channel: "tai_tiem", fulfillment: "pickup" }), "pickup");
  assert.equal(shipModeOf({ channel: "facebook", fulfillment: "delivery" }), "tu_giao");
  assert.equal(maskBuyer("Nguyễn An"), "N***n");
  const net = estimateNet(100_000, "tiktok", DEFAULT_SETTINGS, null);
  assert.equal(net, 100_000 - Math.round(100_000 * 0.27) - 11_000);
  assert.equal(estimateNet(100_000, "tiktok", DEFAULT_SETTINGS, 80_000), 80_000);
});

test("thẻ cảnh báo 24 giờ, quá hạn, hủy và trả hàng", () => {
  const now = Date.parse("2026-10-24T08:00:00.000Z");
  const cards = deskAlerts(
    [
      { status: "dong_goi", channel: "tiktok", shipBy: "2026-10-24T20:00:00.000Z", tracking: "" },
      { status: "nhan_don", channel: "shopee", autoCancelAt: "2026-10-24T18:00:00.000Z", tracking: "JT1" },
      { status: "in", channel: "tiktok", shipBy: "2026-10-23T08:00:00.000Z", tracking: "" },
      { status: "huy", channel: "tai_tiem", tracking: "" },
      { status: "giao", channel: "shopee", tracking: "", deskIssue: null },
      { status: "giao", channel: "facebook", tracking: "", deskIssue: "tra_hang" },
    ],
    now,
  );
  const count = (id: string) => cards.find((card) => card.id === id)?.count;
  assert.equal(count("ship_24h"), 1);
  assert.equal(count("cancel_24h"), 1);
  assert.equal(count("overdue_ship"), 1);
  assert.equal(count("cancelled"), 1);
  assert.equal(count("ship_problem"), 1);
  assert.equal(count("return_request"), 1);
});

test("migration gắn cách giao cho 6 đơn cũ và không đổi bước", () => {
  const orders = [
    { code: "TT261022-001", status: "huy", channel: "tai_tiem", fulfillment: "delivery", isTest: true, total: 10, marketplaceCode: "", items: [{ name: "A", quantity: 1 }] },
    { code: "TT261020-001", status: "dong_goi", channel: "tai_tiem", fulfillment: "pickup", total: 20, marketplaceCode: "", items: [{ name: "B", quantity: 2 }] },
    { code: "TT261018-003", status: "nhan_don", channel: "tai_tiem", fulfillment: "delivery", total: 30, marketplaceCode: "", items: [{ name: "C", quantity: 1 }] },
    { code: "TT261018-002", status: "xong", channel: "tai_tiem", fulfillment: "pickup", total: 40, marketplaceCode: "", items: [{ name: "D", quantity: 1 }] },
    { code: "TT261018-001", status: "huy", channel: "tai_tiem", fulfillment: "pickup", isTest: true, total: 50, marketplaceCode: "", items: [{ name: "E", quantity: 1 }] },
    { code: "TT261017-001", status: "huy", channel: "shopee", fulfillment: "delivery", isTest: true, total: 60, marketplaceCode: "SP1", items: [{ name: "F", quantity: 1 }] },
  ];
  const before = orders.map((order) => `${order.code}:${order.status}:${order.total}:${order.items[0]?.quantity}:${order.isTest ?? ""}`);
  const state = {
    settings: { showZalo: false, zaloDefaultMigrated: true },
    groups: [],
    orders,
  };
  assert.equal(applyStoreMigrations(state), true);
  assert.equal(state.settings.orderDesk20261024, true);
  assert.deepEqual(
    state.orders.map((order) => `${order.code}:${order.status}:${order.total}:${order.items[0]?.quantity}:${order.isTest ?? ""}`),
    before,
  );
  assert.equal(state.orders[1]?.shipMode, "pickup");
  assert.equal(state.orders[0]?.shipMode, "tu_giao");
  assert.equal(state.orders[5]?.shipMode, "san");
  assert.equal(state.orders[5]?.channelOrderId, "SP1");
  assert.equal(applyOrderDesk(state), false);
  assert.equal(applyStoreMigrations(state), false);
});
