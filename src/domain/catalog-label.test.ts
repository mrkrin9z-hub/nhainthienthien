import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { isExtraSheetVariant, matchingSheet, packOptionLabel, sheetOptionLabel, sizeChoices, sizeSummary } from "./catalog-label.ts";

test("đếm khổ, không đếm từng mức giá", () => {
  const size = (width: number, height: number) => ({ width, height });
  const boVien = [13, 15, 20, 30, 40, 50, 60].flatMap((width, index) => {
    const height = [18, 21, 30, 45, 60, 75, 90][index]!;
    return [1, 2, 3, 4, 5].map(() => size(width, height));
  });
  assert.equal(boVien.length, 35);
  assert.equal(sizeSummary(boVien), "7 kích thước");
  assert.equal(sizeSummary([1, 5, 10, 20, 50].map(() => size(6, 9))), "1 kích thước · 5 gói");
  assert.equal(sizeSummary([size(20, 30), size(30, 45), size(40, 60), size(50, 75), size(60, 90)]), "5 kích thước");
  assert.equal(sizeSummary([size(9, 19), size(17, 22)]), "2 kích thước");
  assert.equal(sizeSummary([size(15, 21), size(20, 30), size(30, 45)]), "3 kích thước");
  assert.equal(sizeSummary([{ width: null, height: null }]), "1 quy cách");

  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  // Giao diện kiểu sàn: chọn khổ/combo ở trang chi tiết sản phẩm, trang thanh toán vẫn có bộ chọn đủ.
  for (const file of ["../routes/san-pham_.$slug.tsx", "../routes/dat-in.tsx"]) {
    const source = read(file);
    assert.doesNotMatch(source, /variants\.length\} (kích thước|quy cách)/, file);
    assert.match(source, /sizeChoices\(/, file);
  }
  const checkout = read("../routes/dat-in.tsx");
  assert.match(checkout, /sizeSummary\(/);
  assert.match(checkout, /Chọn số tấm/);
});

test("chọn khổ trước, số tấm của khổ đó xếp sau", () => {
  const variant = (width: number, height: number, sheets: number, sort: number) => ({
    id: `${width}x${height}-${sheets}`,
    name: sheets === 1 ? `${width}×${height} cm` : `${width}×${height} cm · ${sheets} tấm`,
    width,
    height,
    sheets,
    sort_order: sort,
  });
  const mixed = [
    variant(15, 21, 2, 4),
    variant(13, 18, 5, 3),
    variant(13, 18, 1, 1),
    variant(15, 21, 1, 2),
  ];
  const choices = sizeChoices(mixed);
  assert.deepEqual(
    choices.map((choice) => choice.label),
    ["13×18 cm", "15×21 cm"],
  );
  assert.deepEqual(
    choices[0]?.variants.map((item) => item.sheets),
    [1, 5],
  );
  assert.equal(sheetOptionLabel(1), "1 tấm");
  assert.equal(sheetOptionLabel(5), "5 tấm");
  assert.equal(matchingSheet(choices[1]?.variants ?? [], 5)?.id, "15x21-1");
  assert.equal(matchingSheet(choices[1]?.variants ?? [], 2)?.id, "15x21-2");
  assert.equal(sizeChoices([{ id: "album", name: "Thiết kế theo yêu cầu", width: null, height: null, sheets: 1, sort_order: 1 }])[0]?.label, "Thiết kế theo yêu cầu");
});

test("chip thêm 1 tờ album không hiện 1 tấm, đổi khổ vẫn giữ thêm tờ", () => {
  const album = (size: string, kind: "book" | "extra", sort: number) => {
    const [width, height] = size.split("x").map(Number) as [number, number];
    const extra = kind === "extra";
    return {
      id: extra ? `PB-${size}-T1` : `PB-${size}-C1`,
      name: extra ? `Thêm 1 tờ ${width}×${height} cm` : `${width}×${height} cm`,
      width,
      height,
      sheets: 1,
      sort_order: sort,
    };
  };
  const variants = [album("13x18", "book", 1), album("13x18", "extra", 10), album("15x21", "book", 2), album("15x21", "extra", 11)];
  assert.equal(isExtraSheetVariant(variants[1]!), true);
  assert.equal(isExtraSheetVariant(variants[0]!), false);
  assert.equal(packOptionLabel(variants[0]!), "1 tấm");
  assert.equal(packOptionLabel(variants[1]!), "Thêm 1 tờ");
  assert.equal(sheetOptionLabel(1, variants[1]), "Thêm 1 tờ");
  assert.equal(sheetOptionLabel(1, variants[0]), "1 tấm");
  const choices = sizeChoices(variants);
  const from = choices[0]?.variants.find((item) => isExtraSheetVariant(item));
  assert.equal(matchingSheet(choices[1]?.variants ?? [], from?.sheets ?? 1, from)?.id, "PB-15x21-T1");
  assert.equal(matchingSheet(choices[1]?.variants ?? [], 1, choices[0]?.variants[0])?.id, "PB-15x21-C1");
});
