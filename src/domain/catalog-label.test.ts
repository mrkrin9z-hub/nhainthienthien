import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { sizeSummary } from "./catalog-label.ts";

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
  for (const file of ["../routes/san-pham.tsx", "../routes/dat-in.tsx"]) {
    const source = read(file);
    assert.match(source, /sizeSummary\(/, file);
    assert.doesNotMatch(source, /variants\.length\} (kích thước|quy cách)/, file);
  }
});
