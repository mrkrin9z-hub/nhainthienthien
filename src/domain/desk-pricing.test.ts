import { lineAmountAfterDiscount } from "./calc.ts";
import assert from "node:assert/strict";
import test from "node:test";

import { CHANNELS, type Channel } from "./types.ts";
import { lineTotalForChannel, listedPriceForChannel, retargetLinesForChannel } from "./desk-pricing.ts";

const luaLe = {
  id: "LUA-6x9-1",
  prices: { tai_tiem: 3000, facebook: 3000, tiktok: null, shopee: null, ctv: 2700, mo_home: 2400 },
  minTotals: { tai_tiem: 30000, facebook: 30000, ctv: 27000, mo_home: 24000 },
};

const mirror = {
  id: "TG-13x18-C1",
  prices: { tai_tiem: 37000, facebook: 37000, tiktok: 39000, shopee: 39000, ctv: 33000, mo_home: 25000 },
};

test("tạo đơn: mỗi kênh lấy đúng giá niêm yết của kênh đó", () => {
  const expected: Record<Channel, number | null> = {
    tai_tiem: 37000,
    facebook: 37000,
    tiktok: 39000,
    shopee: 39000,
    ctv: 33000,
    mo_home: 25000,
  };
  for (const channel of CHANNELS) {
    assert.equal(listedPriceForChannel(mirror, channel), expected[channel], channel);
  }
});

test("ảnh lụa 6×9 lẻ: thành tiền tôn trọng tối thiểu theo từng kênh", () => {
  assert.equal(lineTotalForChannel(luaLe, "tai_tiem", 5), 30000);
  assert.equal(lineTotalForChannel(luaLe, "facebook", 12), 36000);
  assert.equal(lineTotalForChannel(luaLe, "ctv", 5), 27000);
  assert.equal(lineTotalForChannel(luaLe, "mo_home", 1), 2400);
  assert.equal(lineTotalForChannel(luaLe, "mo_home", 5), 12000);
  assert.equal(lineTotalForChannel(luaLe, "tiktok", 5), null);
});

test("kênh mo_home không bị ép tối thiểu dù minTotal còn trong dữ liệu", () => {
  const namCham = {
    id: "NCT-6x9-1",
    prices: { mo_home: 8000, tai_tiem: 10000 },
    minTotals: { mo_home: 80000, tai_tiem: 100000 },
  };
  assert.equal(lineTotalForChannel(namCham, "mo_home", 1), 8000);
  assert.equal(lineTotalForChannel(namCham, "tai_tiem", 1), 100000);
});


test("đổi kênh sau khi chọn sản phẩm thì cập nhật lại đơn giá, không giữ giá kênh cũ", () => {
  const lines = [
    { skuId: "TG-13x18-C1", quantity: 2, unitPrice: "37000", priceTouched: true },
    { skuId: "LUA-6x9-1", quantity: 3, unitPrice: "3000", priceTouched: false },
  ];
  const toCtv = retargetLinesForChannel(lines, [mirror, luaLe], "ctv");
  assert.equal(toCtv[0]?.unitPrice, "33000");
  assert.equal(toCtv[0]?.priceTouched, false);
  assert.equal(toCtv[1]?.unitPrice, "2700");
  const toHome = retargetLinesForChannel(toCtv, [mirror, luaLe], "mo_home");
  assert.equal(toHome[0]?.unitPrice, "25000");
  assert.equal(toHome[1]?.unitPrice, "2400");
  const toTiktok = retargetLinesForChannel(toHome, [mirror, luaLe], "tiktok");
  assert.equal(toTiktok[0]?.unitPrice, "39000");
  assert.equal(toTiktok[1]?.unitPrice, "");
});

test("thành tiền dòng = max(0, đơn giá × SL − giảm), vẫn tôn trọng tối thiểu kênh trước khi trừ giảm", () => {
  // lẻ tai_tiem 5 tấm * 3000 = 15000 nhưng min 30000
  assert.equal(lineAmountAfterDiscount(3000, 5, 30000, 0), 30000);
  assert.equal(lineAmountAfterDiscount(3000, 5, 30000, 5000), 25000);
  assert.equal(lineAmountAfterDiscount(56000, 1, null, 0), 56000);
  assert.equal(lineAmountAfterDiscount(56000, 2, null, 12000), 100000);
  assert.equal(lineAmountAfterDiscount(56000, 1, null, 56000), 0);
  assert.equal(lineAmountAfterDiscount(56000, 1, null, 80000), 0);
  assert.equal(lineAmountAfterDiscount(null, 1, null, 0), null);
});
