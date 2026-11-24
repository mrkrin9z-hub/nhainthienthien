import assert from "node:assert/strict";
import test from "node:test";

import { parseProductExcel, productExcelHeaders, productExcelTemplateRows } from "./product-excel.ts";
import { productCodeFromName } from "./web-product.ts";

test("mã viết tắt từ tên liền không dấu", () => {
  assert.equal(productCodeFromName("Ảnh ép gỗ"), "AEG");
  assert.equal(productCodeFromName("canvas"), "CANVAS");
});

test("parse excel rộng thành draft sản phẩm", () => {
  const rows = productExcelTemplateRows().map((row) => row.map((cell) => String(cell ?? "")));
  assert.deepEqual(rows[0], productExcelHeaders());
  const drafts = parseProductExcel(rows);
  assert.equal(drafts.length, 1);
  assert.equal(drafts[0]?.code, "AEG");
  assert.equal(drafts[0]?.sizes.length, 2);
  assert.equal(drafts[0]?.sizes[0]?.quotes?.tai_tiem?.price, 45000);
  assert.equal(drafts[0]?.sizes[0]?.quotes?.tai_tiem?.sold, true);
  assert.equal(drafts[0]?.sizes[0]?.quotes?.tiktok?.sold, false);
});
