import assert from "node:assert/strict";
import test from "node:test";

import { caretAfterFormat, formatGroupedInt, groupedIntValue, parseGroupedDigits } from "./grouped-number.ts";

test("150000 tự hiện thành 150.000, dán số có dấu vẫn ra số nguyên", () => {
  assert.equal(formatGroupedInt(150000), "150.000");
  assert.equal(formatGroupedInt("150000"), "150.000");
  assert.equal(formatGroupedInt(1500000), "1.500.000");
  assert.equal(formatGroupedInt(0), "0");
  assert.equal(formatGroupedInt(null), "");
  assert.equal(formatGroupedInt(""), "");
  assert.equal(groupedIntValue("150.000đ"), 150000);
  assert.equal(groupedIntValue("150,000"), 150000);
  assert.equal(groupedIntValue("1.500.000 đ"), 1500000);
  assert.equal(groupedIntValue("  0050000 "), 50000);
  assert.equal(groupedIntValue(""), null);
  assert.equal(parseGroupedDigits("000"), "0");
});

test("caret giữ đúng vị trí khi thêm dấu chấm giữa chừng", () => {
  // gõ thêm 0 vào 15|000 → 150000, caret sau chữ số thứ 2 (15) phải thành 15|.000
  assert.equal(caretAfterFormat("15000", 2, "15.000"), 2);
  // gõ hết 150000, caret cuối
  assert.equal(caretAfterFormat("150000", 6, "150.000"), 7);
  // "150.|000" (3 chữ số trái caret) sau khi thành 1.505.000 thì caret sau "1.50"
  assert.equal(caretAfterFormat("150.000", 4, "1.505.000"), 4);
});
