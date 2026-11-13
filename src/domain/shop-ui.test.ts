import assert from "node:assert/strict";
import test from "node:test";

import { discountPercent, needsDeposit, shipEstimate } from "../lib/ship-estimate.ts";

test("phí ship dự kiến theo chính sách 13/11", () => {
  const small = [{ width: 13, height: 18, amount: 100_000 }];
  assert.equal(shipEstimate(small, "delivery").fee, 25_000);
  assert.equal(shipEstimate(small, "pickup").fee, 0);
  assert.equal(shipEstimate([], "delivery").fee, 0);
  assert.equal(shipEstimate([{ width: 13, height: 18, amount: 300_000 }], "delivery").fee, 0);
  const large = [{ width: 50, height: 75, amount: 239_000 }];
  assert.equal(shipEstimate(large, "delivery").fee, 30_000);
  assert.equal(shipEstimate([{ width: 60, height: 90, amount: 450_000 }], "delivery").fee, 0);
  // 40×60 vẫn là hàng nhỏ (25k, freeship 300k)
  assert.equal(shipEstimate([{ width: 40, height: 60, amount: 149_000 }], "delivery").fee, 25_000);
});

test("cọc 50% khi từ 300k hoặc có ảnh từ 40×60", () => {
  assert.equal(needsDeposit([{ width: 13, height: 18, amount: 100_000 }]), false);
  assert.equal(needsDeposit([{ width: 13, height: 18, amount: 300_000 }]), true);
  assert.equal(needsDeposit([{ width: 40, height: 60, amount: 149_000 }]), true);
  assert.equal(needsDeposit([{ width: 30, height: 45, amount: 86_000 }]), false);
});

test("% giảm chỉ hiện khi có giá gốc thật", () => {
  assert.equal(discountPercent(100_000, 190_000), 47);
  assert.equal(discountPercent(100_000, null), null);
  assert.equal(discountPercent(100_000, 100_000), null);
});
