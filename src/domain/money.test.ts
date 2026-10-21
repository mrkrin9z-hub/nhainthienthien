import assert from "node:assert/strict";
import test from "node:test";

import { appendCollection, buildLedger, expenseReport, expenseStamp, handoverError, holderBalances, ordersToCollect, SHOP_TILL_ID, walletCards, walletOfMethod, type CashOrder } from "./money.ts";

function order(partial: Partial<CashOrder> & Pick<CashOrder, "id" | "code">): CashOrder {
  return {
    customerName: "An",
    status: "nhan_don",
    total: 100000,
    depositPaid: 0,
    depositMethod: "",
    createdAt: "2026-10-01T05:00:00.000Z",
    ...partial,
  };
}

test("ví đọc hình thức thu", () => {
  assert.equal(walletOfMethod("Tiền mặt"), "tien_mat");
  assert.equal(walletOfMethod("Chuyển khoản"), "chuyen_khoan");
  assert.equal(walletOfMethod("CK"), "chuyen_khoan");
  assert.equal(walletOfMethod(""), "tien_mat");
});

test("cọc cũ là một khoản tại lúc tạo đơn, không cộng đôi khi thu thêm", () => {
  const first = appendCollection(
    { createdAt: "2026-10-01T05:00:00.000Z", depositPaid: 100000, depositMethod: "Tiền mặt", depositBy: "owner", payments: [] },
    { id: "p2", at: "2026-10-18T05:00:00.000Z", amount: 50000, method: "Chuyển khoản", by: "sale" },
    "backfill",
  );
  assert.equal(first.payments.length, 2);
  assert.equal(first.payments[0]?.amount, 100000);
  assert.equal(first.payments[0]?.at, "2026-10-01T05:00:00.000Z");
  assert.equal(first.depositPaid, 150000);

  const second = appendCollection(
    {
      createdAt: "2026-10-01T05:00:00.000Z",
      depositPaid: 150000,
      depositMethod: "Chuyển khoản",
      depositBy: "sale",
      payments: first.payments,
    },
    { id: "p3", at: "2026-10-18T06:00:00.000Z", amount: 20000, method: "Tiền mặt", by: "sale" },
    "ignored",
  );
  assert.equal(second.payments.length, 3);
  assert.equal(second.payments.filter((row) => row.id === "backfill").length, 1);
  assert.equal(second.depositPaid, 170000);
});

test("đơn cần thu bỏ đơn hủy và đơn đã đủ tiền", () => {
  const rows = ordersToCollect([
    order({ id: "a", code: "A", status: "huy", depositPaid: 0 }),
    order({ id: "b", code: "B", depositPaid: 100000 }),
    order({ id: "c", code: "C", depositPaid: 40000, createdAt: "2026-10-02T05:00:00.000Z" }),
    order({ id: "d", code: "D", total: null, createdAt: "2026-10-03T05:00:00.000Z" }),
    order({ id: "e", code: "E", status: "draft_upload" }),
  ]);
  assert.deepEqual(rows.map((row) => row.code), ["D", "C"]);
});

test("sổ ví cộng thu, trừ chi và giữ điều chỉnh", () => {
  const lines = buildLedger({
    orders: [order({ id: "o1", code: "TT1", depositPaid: 80000, depositMethod: "Chuyển khoản", createdAt: "2026-10-10T05:00:00.000Z" })],
    expenses: [
      { id: "e1", name: "Giấy", amount: 30000, note: "", at: "2026-10-11T05:00:00.000Z", month: "2026-10", category: "vat_tu", wallet: "tien_mat" },
      { id: "e2", name: "Cũ", amount: 5000, note: "", at: "2026-09-11T05:00:00.000Z", month: "2026-09" },
    ],
    adjusts: [{ id: "a1", at: "2026-10-12T05:00:00.000Z", wallet: "tien_mat", amount: 10000, note: "Đếm két" }],
  });
  const cards = walletCards(lines, "2026-10");
  const cash = cards.find((card) => card.id === "tien_mat");
  const bank = cards.find((card) => card.id === "chuyen_khoan");
  assert.equal(cash?.balance, -20000);
  assert.equal(cash?.inMonth, 10000);
  assert.equal(cash?.outMonth, 30000);
  assert.equal(bank?.balance, 80000);
  assert.equal(bank?.inMonth, 80000);
});

test("báo cáo không cộng khoản chưa nhóm vào Khác", () => {
  const report = expenseReport(
    [
      { id: "1", name: "A", amount: 100000, note: "", at: "", month: "2026-10" },
      { id: "2", name: "B", amount: 50000, note: "", at: "", month: "2026-10", category: "khac", wallet: "tien_mat" },
      { id: "3", name: "C", amount: 20000, note: "", at: "", month: "2026-10", category: "vat_tu", wallet: "chuyen_khoan" },
      { id: "4", name: "D", amount: 999, note: "", at: "", month: "2026-09", category: "vat_tu" },
    ],
    "2026-10",
  );
  assert.equal(report.total, 170000);
  assert.equal(report.byCategory.find((row) => row.id === "khac")?.amount, 50000);
  assert.equal(report.byCategory.find((row) => row.label === "Chưa phân nhóm")?.amount, 100000);
  assert.equal(report.byWallet.find((row) => row.id === "tien_mat")?.amount, 50000);
  assert.equal(report.unknown, 100000);
});

test("thu vào ví người thu và chi trừ ví người ghi", () => {
  const rows = holderBalances({
    orders: [
      order({
        id: "o",
        code: "TT",
        depositPaid: 100000,
        depositMethod: "Tiền mặt",
        depositBy: "sale",
        payments: [
          { at: "2026-10-10T05:00:00.000Z", amount: 80000, method: "Tiền mặt", by: "sale" },
          { at: "2026-10-11T05:00:00.000Z", amount: 20000, method: "Chuyển khoản", by: "owner" },
        ],
      }),
    ],
    expenses: [{ id: "e", name: "Giấy", amount: 30000, note: "", at: "", month: "2026-10", category: "vat_tu", wallet: "tien_mat", by: "owner" }],
    staff: [
      { id: "sale", name: "Lan" },
      { id: "owner", name: "Chủ" },
    ],
  });
  assert.equal(rows.find((row) => row.staffId === "sale")?.tien_mat, 80000);
  assert.equal(rows.find((row) => row.staffId === "owner")?.chuyen_khoan, 20000);
  assert.equal(rows.find((row) => row.staffId === "owner")?.tien_mat, -30000);
  const legacy = holderBalances({
    orders: [order({ id: "old", code: "OLD", depositPaid: 15000, depositMethod: "Tiền mặt", depositBy: "sale" })],
    expenses: [],
    staff: [{ id: "sale", name: "Lan" }],
  });
  assert.equal(legacy.find((row) => row.staffId === "sale")?.tien_mat, 15000);
});

test("nộp tiền mặt chuyển từ người thu sang két, ví cửa hàng không thêm dòng", () => {
  const orders = [
    order({
      id: "o",
      code: "TT",
      depositPaid: 80000,
      depositMethod: "Tiền mặt",
      depositBy: "sale",
      payments: [{ at: "2026-10-10T05:00:00.000Z", amount: 80000, method: "Tiền mặt", by: "sale" }],
    }),
  ];
  const staff = [{ id: "sale", name: "Lan" }];
  const before = holderBalances({ orders, expenses: [], staff });
  assert.equal(before.find((row) => row.staffId === "sale")?.tien_mat, 80000);
  assert.equal(handoverError({ held: 80000, amount: 30000 }), null);
  assert.match(handoverError({ held: 80000, amount: 90000 }) ?? "", /lớn hơn/);
  assert.match(handoverError({ held: 80000, amount: 0 }) ?? "", /chưa đúng/);
  const after = holderBalances({
    orders,
    expenses: [],
    staff,
    handovers: [{ fromId: "sale", amount: 30000 }],
  });
  assert.equal(after.find((row) => row.staffId === "sale")?.tien_mat, 50000);
  assert.equal(after.find((row) => row.staffId === SHOP_TILL_ID)?.tien_mat, 30000);
  assert.equal(after[0]?.staffId, SHOP_TILL_ID);
  const lines = buildLedger({ orders, expenses: [], adjusts: [] });
  assert.equal(walletCards(lines, "2026-10").find((card) => card.id === "tien_mat")?.balance, 80000);
});

test("ngày chi giữa trưa giờ Việt Nam", () => {
  const stamp = expenseStamp("2026-10-18");
  assert.equal(stamp.month, "2026-10");
  assert.equal(stamp.at, "2026-10-18T05:00:00.000Z");
  assert.throws(() => expenseStamp("18/10/2026"), /Ngày chi chưa đúng/);
});
