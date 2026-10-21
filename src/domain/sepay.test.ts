import assert from "node:assert/strict";
import test from "node:test";

import { extractPaymentNeedle, findOrderForSePay, sepayCollectAmount, sepayRejectReason } from "./sepay.ts";

const open = {
  id: "o1",
  code: "TT251021-001",
  status: "nhan_don",
  channel: "tai_tiem",
  total: 500000,
  depositPaid: 100000,
};

test("extractPaymentNeedle ưu tiên code rồi nội dung TT…", () => {
  assert.equal(extractPaymentNeedle({ id: 1, code: "tt251021-001" }), "TT251021-001");
  assert.equal(extractPaymentNeedle({ id: 1, code: null, content: "chuyen TT251021-001 cam on" }), "TT251021-001");
  assert.equal(extractPaymentNeedle({ id: 1, content: "khong co ma" }), "");
});

test("findOrderForSePay khớp mã đơn VietQR", () => {
  assert.equal(findOrderForSePay([open], { id: 1, code: "TT251021-001", transferAmount: 400000 })?.id, "o1");
  assert.equal(findOrderForSePay([open], { id: 1, content: "TT251021-001 CK", transferAmount: 1 })?.id, "o1");
  assert.equal(findOrderForSePay([open], { id: 1, code: "KHAC", transferAmount: 1 }), null);
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
