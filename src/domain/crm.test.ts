import assert from "node:assert/strict";
import test from "node:test";

import { moneyLeaks } from "./access.ts";
import { applyMarketplaceProfile, customerCards, customerReminders, DEFAULT_REMIND_MESSAGE, findCustomer } from "./crm.ts";
import type { Customer, Order, ShopState } from "./types.ts";

function customer(partial: Partial<Customer> & Pick<Customer, "id" | "phoneNormalized">): Customer {
  return {
    name: "Khách",
    phone: partial.phoneNormalized,
    address: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function order(partial: Partial<Order> & Pick<Order, "id" | "customerId" | "createdAt" | "channel" | "total">): Order {
  return { status: "xong", code: partial.id, ...partial } as Order;
}

function shop(customers: Customer[], orders: Order[], settings: ShopState["settings"] = {} as ShopState["settings"]): ShopState {
  return { customers, orders, settings } as ShopState;
}

test("khách gộp theo số điện thoại, số che giữ riêng", () => {
  const now = new Date("2026-10-17T06:00:00Z");
  const cards = customerCards(
    shop(
      [
        customer({ id: "a", name: "Lan TikTok", phone: "0901234567", phoneNormalized: "0901234567", createdAt: "2026-08-01T00:00:00.000Z", tags: ["ảnh thờ"] }),
        customer({ id: "b", name: "Lan Shopee", phone: "0901234567", phoneNormalized: "0901234567", createdAt: "2026-09-01T00:00:00.000Z", note: "Gọi chiều" }),
        customer({ id: "c", name: "Ẩn", phone: "(+84)90*****12", phoneNormalized: "masked:(+84)90*****12" }),
      ],
      [
        order({ id: "o1", customerId: "a", channel: "tiktok", total: 100000, createdAt: "2026-08-18T06:00:00.000Z" }),
        order({ id: "o2", customerId: "b", channel: "shopee", total: 50000, createdAt: "2026-10-01T06:00:00.000Z" }),
        order({ id: "o3", customerId: "c", channel: "tiktok", total: 70000, createdAt: "2026-10-16T06:00:00.000Z" }),
      ],
    ),
    now,
  );
  assert.equal(cards.length, 2);
  const lan = cards.find((card) => card.ids.includes("a"));
  assert.equal(lan?.orderCount, 2);
  assert.equal(lan?.totalSpent, 150000);
  assert.equal(lan?.repeat, true);
  assert.equal(lan?.name, "Lan Shopee");
  assert.deepEqual(lan?.channels.sort(), ["Shopee", "TikTok"]);
  assert.ok(lan?.tags.includes("ảnh thờ"));
  assert.equal(lan?.note, "Gọi chiều");
  const hidden = cards.find((card) => card.id === "c");
  assert.equal(hidden?.orderCount, 1);
  assert.equal(hidden?.repeat, false);
  assert.equal(hidden?.phone, "(+84)90*****12");
  assert.deepEqual(moneyLeaks("sale", cards), []);
});

test("nhắc khách theo ngày đơn cuối và ngày giỗ", () => {
  const now = new Date("2026-10-17T06:00:00Z");
  const reminders = customerReminders(
    shop(
      [
        customer({ id: "old", name: "Bà Năm", phoneNormalized: "0900000001", phone: "0900000001" }),
        customer({
          id: "gio",
          name: "Anh Tư",
          phoneNormalized: "0900000002",
          phone: "0900000002",
          tags: ["ảnh thờ"],
          specialDates: [{ label: "Ngày giỗ", month: 10, day: 20 }],
        }),
        customer({ id: "new", name: "Mới", phoneNormalized: "0900000003", phone: "0900000003" }),
      ],
      [
        order({ id: "o1", customerId: "old", channel: "tai_tiem", total: 35000, createdAt: "2026-08-18T06:00:00.000Z" }),
        order({ id: "o2", customerId: "gio", channel: "tai_tiem", total: 200000, createdAt: "2026-10-10T06:00:00.000Z" }),
        order({ id: "o3", customerId: "new", channel: "facebook", total: 10000, createdAt: "2026-10-16T06:00:00.000Z" }),
      ],
      { remindAfterDays: 60, repeatCustomerOrders: 2, remindMessage: DEFAULT_REMIND_MESSAGE } as ShopState["settings"],
    ),
    now,
  );
  const names = reminders.map((item) => item.name).sort();
  assert.deepEqual(names, ["Anh Tư", "Bà Năm"]);
  const old = reminders.find((item) => item.id === "old");
  assert.equal(old?.daysSinceOrder, 60);
  assert.match(old?.message ?? "", /Bà Năm/);
  assert.match(old?.message ?? "", /60/);
  const gio = reminders.find((item) => item.id === "gio");
  assert.match(gio?.reasons.join(" ") ?? "", /Ngày giỗ/);
  assert.match(gio?.message ?? "", /20\/10/);
  assert.equal(reminders.some((item) => item.id === "new"), false);
});

test("số che không gộp hai người, trừ khi cùng tài khoản hoặc trùng tên và địa chỉ", () => {
  const mask = "masked:(+84)90*****12";
  const g = customer({
    id: "g",
    name: "Đỗ Văn G",
    phone: "(+84)90*****12",
    phoneNormalized: mask,
    address: "7 Nguyễn Huệ, Xã Xuân Hiệp",
    platformBuyer: "do_g",
  });
  const h = customer({
    id: "h",
    name: "Bùi Thị H",
    phone: "(+84)90*****12",
    phoneNormalized: mask,
    address: "9 Lý Thường Kiệt, Xã Xuân Hiệp",
    platformBuyer: "bui_h",
  });
  const cards = customerCards(
    shop(
      [g, h],
      [
        order({ id: "o1", customerId: "g", channel: "tiktok", total: 330000, createdAt: "2026-10-17T13:15:03.000Z" }),
        order({ id: "o2", customerId: "h", channel: "tiktok", total: 330000, createdAt: "2026-10-17T13:15:03.000Z" }),
      ],
    ),
  );
  assert.equal(cards.length, 2);
  assert.equal(cards.every((card) => card.repeat === false), true);
  assert.equal(
    findCustomer([g], { phoneNormalized: mask, name: "Bùi Thị H", address: h.address, platformBuyer: "bui_h" }),
    undefined,
  );
  assert.equal(
    findCustomer([g], { phoneNormalized: mask, name: "Đỗ Văn G khác", address: "địa chỉ khác", platformBuyer: "do_g" })?.id,
    "g",
  );
  const named = customer({ id: "n1", name: "Lan", phoneNormalized: mask, phone: "(+84)90*****12", address: "12 Hùng Vương" });
  assert.equal(
    findCustomer([named], { phoneNormalized: mask, name: "Lan", address: "12 Hùng Vương" })?.id,
    "n1",
  );
  assert.equal(findCustomer([named], { phoneNormalized: mask, name: "Lan", address: "99 khác" }), undefined);
  const kept = applyMarketplaceProfile(
    { ...named, name: "Cô Lan", address: "Tại tiệm", addresses: ["Tại tiệm"] },
    { name: "Lan sàn", address: "12 Hùng Vương", platformBuyer: "lan_1", masked: true },
  );
  assert.equal(kept.name, "Cô Lan");
  assert.equal(kept.address, "Tại tiệm");
  assert.deepEqual(kept.addresses, ["Tại tiệm", "12 Hùng Vương"]);
  assert.equal(kept.platformBuyer, "lan_1");
});

test("khách chỉ có đơn hủy bị đánh dấu để ẩn", () => {
  const person = customer({ id: "huy", name: "Hủy", phoneNormalized: "0901111222", phone: "0901111222" });
  const cards = customerCards(
    shop([person], [order({ id: "o1", customerId: "huy", channel: "tiktok", total: 10000, createdAt: "2026-10-01T00:00:00.000Z", status: "huy" })]),
  );
  assert.equal(cards[0]?.onlyCancelled, true);
  assert.equal(cards[0]?.orderCount, 0);
  assert.equal(cards[0]?.repeat, false);
});
