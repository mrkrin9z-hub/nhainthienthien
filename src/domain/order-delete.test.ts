import assert from "node:assert/strict";
import test from "node:test";

import { detachOrder } from "./order-delete.ts";

test("detachOrder xóa theo mã hoặc id và gỡ liên kết, không đụng orders khác", () => {
  const state = {
    orders: [
      { id: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", code: "DH0001" },
      { id: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb", code: "DH0002" },
    ],
    albums: [{ id: "al1", orderId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa", updatedAt: "old" }],
    reprints: [{ id: "rp1", orderId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }],
    wasteReports: [{ id: "w1", orderId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" }],
    paymentQrTokens: [
      { id: "qr1", orderId: "aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa" },
      { id: "qr2", orderId: "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb" },
    ],
  };
  const first = detachOrder(state as never, "dh0001");
  assert.equal(first.order.code, "DH0001");
  assert.equal(state.orders.length, 1);
  assert.equal(state.orders[0]!.code, "DH0002");
  assert.equal(state.albums[0]!.orderId, null);
  assert.equal(state.reprints[0]!.orderId, "");
  assert.equal(state.wasteReports[0]!.orderId, null);
  assert.deepEqual(state.paymentQrTokens.map((row) => row.id), ["qr2"]);

  const second = detachOrder(state as never, "bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
  assert.equal(second.order.code, "DH0002");
  assert.equal(state.orders.length, 0);
  assert.equal(state.paymentQrTokens.length, 0);
});

test("detachOrder báo lỗi khi không có đơn", () => {
  assert.throws(() => detachOrder({ orders: [], albums: [], reprints: [], wasteReports: [], paymentQrTokens: [] }, "DH0009"), /Không tìm thấy đơn/);
});
