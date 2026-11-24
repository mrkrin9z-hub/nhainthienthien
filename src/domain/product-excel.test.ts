import assert from "node:assert/strict";
import test from "node:test";

import { parseProductExcel, productExcelHeaders, productExcelTemplateRows } from "./product-excel.ts";
import { productCodeFromName, suggestProductCode } from "./web-product.ts";

test("mã viết tắt từ tên liền không dấu", () => {
  assert.equal(productCodeFromName("Ảnh ép gỗ"), "AEG");
  assert.equal(productCodeFromName("canvas"), "CANVAS");
});

test("parse excel: mỗi dòng một mã, không gộp khổ", () => {
  const rows = productExcelTemplateRows().map((row) => row.map((cell) => String(cell ?? "")));
  assert.deepEqual(rows[0], productExcelHeaders());
  const drafts = parseProductExcel(rows);
  assert.equal(drafts.length, 3);
  assert.equal(drafts[0]?.code, "TG-13X18");
  assert.equal(drafts[0]?.sizes.length, 1);
  assert.equal(drafts[0]?.sizes[0]?.sheets, 1);
  assert.equal(drafts[1]?.code, "COMBO13X18-02");
  assert.equal(drafts[1]?.sizes[0]?.sheets, 2);
  assert.equal(drafts[1]?.sizes[0]?.quotes?.tai_tiem?.price, 80000);
  assert.equal(drafts[2]?.category, "Tráng gương");
});

test("excel trùng mã trong file thì báo rõ", () => {
  const header = productExcelHeaders().map(String);
  const row = [
    "TG-13x18",
    "A",
    "Tráng gương",
    "",
    "13",
    "18",
    "1",
    ...Array.from({ length: 12 }, (_, i) => (i === 0 ? "45000" : i === 1 ? "có" : "")),
  ];
  assert.throws(() => parseProductExcel([header, row, row]), /trùng dòng/);
});

test("suggestProductCode khớp mẫu Excel", () => {
  assert.equal(suggestProductCode({ category: "Tráng gương", widthCm: 13, heightCm: 18, sheets: 1 }), "TG-13X18");
  assert.equal(suggestProductCode({ category: "Tráng gương", widthCm: 13, heightCm: 18, sheets: 2 }), "COMBO13X18-02");
});
