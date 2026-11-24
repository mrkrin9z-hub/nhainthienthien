import assert from "node:assert/strict";
import test from "node:test";

import { formatDeskOrderCode, maxDeskOrderSeq, nextDeskOrderCode, parseDeskOrderSeq } from "./order-code.ts";

test("parseDeskOrderSeq chỉ nhận DH####", () => {
  assert.equal(parseDeskOrderSeq("DH0001"), 1);
  assert.equal(parseDeskOrderSeq("dh42"), 42);
  assert.equal(parseDeskOrderSeq("TT261124-001"), null);
  assert.equal(parseDeskOrderSeq("DH"), null);
});

test("nextDeskOrderCode tăng dần từ max DH và orderSeq", () => {
  assert.deepEqual(nextDeskOrderCode([]), { code: "DH0001", seq: 1 });
  assert.deepEqual(nextDeskOrderCode(["TT261124-001", "MH261023-002"]), { code: "DH0001", seq: 1 });
  assert.deepEqual(nextDeskOrderCode(["DH0001", "DH0003", "TT1"]), { code: "DH0004", seq: 4 });
  assert.deepEqual(nextDeskOrderCode(["DH0002"], 9), { code: "DH0010", seq: 10 });
  assert.equal(formatDeskOrderCode(1), "DH0001");
  assert.equal(formatDeskOrderCode(10000), "DH10000");
  assert.equal(maxDeskOrderSeq(["DH0007"], 3), 7);
});
