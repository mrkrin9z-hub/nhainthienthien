import assert from "node:assert/strict";
import test from "node:test";

import { lookupByPhone, lookupPhoneDigits, type LookupOrder } from "./order-lookup.ts";

function order(partial: Partial<LookupOrder> & Pick<LookupOrder, "code" | "customerId" | "createdAt">): LookupOrder {
  return {
    status: "nhan_don",
    total: 35000,
    fulfillment: "delivery",
    address: "Xuân Lộc",
    customerNote: "",
    items: [{ name: "Ảnh ép gỗ", skuCode: "TG-13x18", quantity: 1, lineTotal: 35000 }],
    files: [],
    history: [{ to: "nhan_don", at: partial.createdAt, note: "Đặt trên web" }],
    ...partial,
  };
}

const customers = [
  { id: "c1", name: "Lan", phoneNormalized: "0901234567" },
  { id: "c2", name: "Hùng", phoneNormalized: "0909999999" },
];

test("số 84 đổi về đầu 0 và lịch sử mới nhất đứng trước", () => {
  assert.equal(lookupPhoneDigits("+84 901 234 567"), "0901234567");
  const found = lookupByPhone({
    phone: "0901 234 567",
    customers,
    orders: [
      order({ code: "TT1", customerId: "c1", createdAt: "2026-10-01T00:00:00.000Z", total: 35000 }),
      order({ code: "TT2", customerId: "c1", createdAt: "2026-10-18T00:00:00.000Z", status: "xong", total: 89000 }),
      order({ code: "TT9", customerId: "c2", createdAt: "2026-10-19T00:00:00.000Z" }),
    ],
  });
  assert.deepEqual(found.orders.map((item) => item.code), ["TT2", "TT1"]);
  assert.equal(found.focus, "TT2");
  assert.equal(found.customerName, "Lan");
  assert.equal(found.orders[0]?.status, "xong");
  assert.equal(found.orders[0]?.total, 89000);
});

test("có mã đơn thì mở đúng đơn và vẫn trả các đơn khác của số đó", () => {
  const found = lookupByPhone({
    phone: "84901234567",
    code: "tt1",
    customers,
    orders: [
      order({ code: "TT1", customerId: "c1", createdAt: "2026-10-01T00:00:00.000Z" }),
      order({ code: "TT2", customerId: "c1", createdAt: "2026-10-18T00:00:00.000Z" }),
    ],
  });
  assert.equal(found.focus, "TT1");
  assert.equal(found.orders.length, 2);
});

test("mã đơn của số khác và số lạ không lộ đơn", () => {
  const orders = [
    order({ code: "TT1", customerId: "c1", createdAt: "2026-10-01T00:00:00.000Z" }),
    order({ code: "TT9", customerId: "c2", createdAt: "2026-10-02T00:00:00.000Z" }),
  ];
  assert.throws(() => lookupByPhone({ phone: "0909999999", code: "TT1", customers, orders }), /mã đơn và số điện thoại/);
  assert.throws(() => lookupByPhone({ phone: "0900000000", customers, orders }), /số điện thoại này/);
  assert.throws(() => lookupByPhone({ phone: "123", customers, orders }), /chưa đúng/);
});
