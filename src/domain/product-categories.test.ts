import assert from "node:assert/strict";
import test from "node:test";

import { categoryExists, mergeProductCategories, normalizeCategoryName } from "./product-categories.ts";

test("normalizeCategoryName trim khoảng trắng", () => {
  assert.equal(normalizeCategoryName("  Tráng  gương "), "Tráng gương");
});

test("mergeProductCategories hợp danh mục lưu + đang dùng", () => {
  assert.deepEqual(mergeProductCategories(["Ép gỗ", "Tráng gương"], ["tráng gương", "Album"]), ["Album", "Ép gỗ", "Tráng gương"]);
});

test("categoryExists không phân biệt hoa thường", () => {
  assert.equal(categoryExists(["Tráng gương"], "tráng gương"), true);
  assert.equal(categoryExists(["Tráng gương"], "Ép gỗ"), false);
});
