import assert from "node:assert/strict";
import test from "node:test";

import {
  accountsMatchShop,
  cleanBankContentForUi,
  evaluateAutoMatch,
  extractPaymentNeedle,
  extractSbToken,
  findOpenToken,
  findOrderForSePay,
  generateSbToken,
  makeApiKey,
  normalizeAccountNumber,
  parseSePayAuthHeader,
  paymentQrAddInfo,
  sepayCollectAmount,
  sepayDateToIso,
  sepayRejectReason,
  type OrderPaymentQrToken,
} from "./sepay.ts";

const open = {
  id: "o1",
  code: "TT251021-001",
  status: "nhan_don",
  channel: "tai_tiem",
  total: 500000,
  depositPaid: 100000,
};

const tokenOpen: OrderPaymentQrToken = {
  id: "t1",
  token: "SBABCD12",
  orderId: "o1",
  amount: 400000,
  accountNumber: "0123456789",
  issuedBy: "s1",
  issuedByName: "Sale",
  status: "open",
  matchedBankTxnId: null,
  matchedOrderPaymentId: null,
  matchedAt: null,
  createdAt: "2026-11-24T00:00:00.000Z",
};

test("extractPaymentNeedle ưu tiên SB rồi code rồi nội dung TT…", () => {
  assert.equal(extractSbToken("ck SBABCD12 cam on"), "SBABCD12");
  assert.equal(extractPaymentNeedle({ id: 1, code: "tt251021-001" }), "TT251021-001");
  assert.equal(extractPaymentNeedle({ id: 1, code: null, content: "chuyen TT251021-001 cam on" }), "TT251021-001");
  assert.equal(extractPaymentNeedle({ id: 1, content: "khong co ma" }), "");
  assert.equal(extractPaymentNeedle({ id: 1, content: "SBABCD12 TT251021-001" }), "SBABCD12");
});

test("findOrderForSePay khớp mã đơn VietQR legacy", () => {
  assert.equal(findOrderForSePay([open], { id: 1, code: "TT251021-001", transferAmount: 400000 })?.id, "o1");
  assert.equal(findOrderForSePay([open], { id: 1, content: "TT251021-001 CK", transferAmount: 1 })?.id, "o1");
  assert.equal(findOrderForSePay([open], { id: 1, code: "KHAC", transferAmount: 1 }), null);
  assert.equal(findOrderForSePay([open], { id: 1, content: "SBABCD12", transferAmount: 1 }), null);
});

test("sepayCollectAmount không vượt dư nợ", () => {
  assert.equal(sepayCollectAmount(open, 999999), 400000);
  assert.equal(sepayCollectAmount({ ...open, depositPaid: 500000 }, 10000), 0);
  assert.equal(sepayCollectAmount({ ...open, total: null }, 12345), 12345);
});

test("sepayRejectReason chặn sàn và đơn đủ tiền", () => {
  assert.match(sepayRejectReason(null, 1000, "in") ?? "", /Không khớp/);
  assert.match(sepayRejectReason(open, 1000, "out") ?? "", /tiền vào/);
  assert.match(sepayRejectReason({ ...open, channel: "shopee" }, 1000, "in") ?? "", /sàn/);
  assert.equal(sepayRejectReason(open, 400000, "in"), null);
});

test("normalizeAccountNumber và map STK ưu tiên subAccount", () => {
  assert.equal(normalizeAccountNumber("012 345 6789"), "0123456789");
  assert.deepEqual(
    accountsMatchShop({ id: 1, accountNumber: "999", subAccount: "0123456789" }, "0123456789"),
    { mapped: true, preferred: "0123456789" },
  );
  assert.equal(accountsMatchShop({ id: 1, accountNumber: "111" }, "0123456789").mapped, false);
});

test("paymentQrAddInfo ngắn ≤25 và generateSbToken", () => {
  const info = paymentQrAddInfo("SBABCD12", "TT251021-001");
  assert.match(info, /^SBABCD12/);
  assert.ok(info.length <= 25);
  assert.match(generateSbToken(() => 0), /^SB[A-Z0-9]{6}$/);
  assert.match(makeApiKey(() => 0), /^sb_/);
});

test("findOpenToken reuse cùng order+amount+ví", () => {
  assert.equal(findOpenToken([tokenOpen], { orderId: "o1", amount: 400000, accountNumber: "0123456789" })?.id, "t1");
  assert.equal(findOpenToken([tokenOpen], { orderId: "o1", amount: 100000, accountNumber: "0123456789" }), null);
});

test("evaluateAutoMatch: khớp / sai tiền / sai ví / thiếu mã", () => {
  const base = {
    amountIn: 400000,
    content: "CK SBABCD12 TT251021-001",
    description: "",
    code: "",
    accountNumber: "0123456789",
    tokens: [tokenOpen],
    orders: [open],
    bankAt: "2026-11-24T10:00:00.000Z",
  };
  assert.equal(evaluateAutoMatch(base).status, "matched");
  assert.equal(evaluateAutoMatch({ ...base, amountIn: 399000 }).status, "unmatched");
  assert.equal(evaluateAutoMatch({ ...base, accountNumber: "000" }).status, "unmatched");
  assert.equal(evaluateAutoMatch({ ...base, content: "khong ma" }).status, "unmatched");
  assert.equal(
    evaluateAutoMatch({
      ...base,
      recentPayments: [{ orderId: "o1", amount: 400000, at: "2026-11-24T10:05:00.000Z" }],
    }).status,
    "manual",
  );
});

test("parseSePayAuthHeader chấp nhận Apikey / Bearer", () => {
  assert.equal(parseSePayAuthHeader("Apikey secret", "secret"), true);
  assert.equal(parseSePayAuthHeader("Bearer secret", "secret"), true);
  assert.equal(parseSePayAuthHeader("secret", "secret"), true);
  assert.equal(parseSePayAuthHeader("Apikey wrong", "secret"), false);
});

test("sepayDateToIso và cleanBankContentForUi giữ SB", () => {
  assert.match(sepayDateToIso("2026-11-24 20:15:00"), /2026-11-24T13:15:00\.000Z|2026-11-24T20:15:00/);
  assert.match(cleanBankContentForUi("chuyen tien SBABCD12 cam on"), /SBABCD12/);
});
