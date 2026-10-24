import assert from "node:assert/strict";
import test from "node:test";

import { familySizes, purchaseUnit, sizeLabel } from "./stock-receive.ts";

test("đơn vị nhập theo loại vật tư và thêm mọi khổ gỗ", () => {
  assert.equal(purchaseUnit({ id: "go-13x18", name: "Tấm nền gỗ 13×18", unit: "tấm" }), "tấm");
  assert.equal(purchaseUnit({ id: "giay-pp", name: "Giấy PP", unit: "m" }), "cuộn");
  assert.equal(purchaseUnit({ id: "muc-1", name: "Mực màu 1", unit: "lọ" }), "lọ");
  assert.equal(purchaseUnit({ id: "mang", name: "Màng tráng gương", unit: "m" }), "cuộn");
  const wood = [
    { id: "go-13x18", name: "Tấm nền gỗ 13×18" },
    { id: "go-60x90", name: "Tấm nền gỗ 60×90" },
    { id: "giay-pp", name: "Giấy PP" },
  ];
  assert.equal(sizeLabel(wood[0]!), "13×18");
  assert.equal(familySizes(wood, "go-13x18").length, 2);
  assert.equal(familySizes(wood, "giay-pp").length, 0);
});
