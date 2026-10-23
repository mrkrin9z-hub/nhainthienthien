import assert from "node:assert/strict";
import test from "node:test";

import { channelPriceFor } from "./price-import.ts";
import { parseCommaPercent, parseDottedAmount, tiktokPriceFor } from "./tiktok-price.ts";

test("parse số TikTok: chấm ngăn nghìn, phẩy phần trăm", () => {
  assert.equal(parseDottedAmount("88.000"), 88000);
  assert.equal(parseDottedAmount("1.199.000"), 1199000);
  assert.equal(parseDottedAmount("1.024.000"), 1024000);
  assert.equal(parseDottedAmount(""), null);
  assert.equal(parseDottedAmount("88,000"), null);
  assert.equal(parseCommaPercent("26,1%"), 26.1);
  assert.equal(parseCommaPercent("47,4%"), 47.4);
  assert.equal(parseCommaPercent(""), null);
});

test("giá khách trả theo bảng 23/10, niêm yết riêng, combo 2 khổ 40×60 để trống", () => {
  assert.deepEqual(tiktokPriceFor("TG-13x18-C1"), { sale: 37000, list: 70000 });
  assert.deepEqual(tiktokPriceFor("GK-13x18-C4"), { sale: 100000, list: 190000 });
  assert.deepEqual(tiktokPriceFor("TG-13x18-C5"), { sale: 125000, list: 226000 });
  assert.deepEqual(tiktokPriceFor("TG-60x90-C2"), { sale: 609000, list: 1199000 });
  assert.deepEqual(tiktokPriceFor("EG-60x90-C2"), { sale: 609000, list: 1157000 });
  assert.deepEqual(tiktokPriceFor("EG-40x60-C5"), { sale: 669000, list: 1271000 });
  assert.deepEqual(tiktokPriceFor("TG-40x60-C5"), { sale: 669000, list: 1252000 });
  assert.deepEqual(tiktokPriceFor("TG-40x60-C2"), { sale: null, list: null });
  assert.deepEqual(tiktokPriceFor("AT-40x60-C2"), { sale: null, list: null });
  assert.deepEqual(tiktokPriceFor("NCT-6x9-10"), { sale: 90000, list: 171000 });
  assert.equal(tiktokPriceFor("NCT-6x9-1"), undefined);
  assert.equal(tiktokPriceFor("NX-17x22-C1"), undefined);
  assert.equal(tiktokPriceFor("TKB-20x30-C4"), undefined);
  assert.equal(tiktokPriceFor("LUA-6x9-10"), undefined);
  assert.equal(tiktokPriceFor("EG-13x18-C1"), undefined);

  const walk = channelPriceFor({ id: "TG-13x18-C1", code: "TG-13x18-C1" }, "tai_tiem", undefined);
  const market = channelPriceFor({ id: "TG-13x18-C1", code: "TG-13x18-C1" }, "shopee", undefined);
  const home = channelPriceFor({ id: "TG-13x18-C1", code: "TG-13x18-C1" }, "mo_home", undefined);
  assert.equal(walk.price, 37000);
  assert.equal(walk.listPrice, undefined);
  assert.equal(market.price, 37000);
  assert.equal(market.listPrice, 70000);
  assert.match(market.note, /89\.000|37\.000/);
  assert.equal(home.price, null);
  const empty = channelPriceFor({ id: "TG-40x60-C2", code: "TG-40x60-C2" }, "facebook", undefined);
  assert.equal(empty.price, null);
  assert.equal(empty.status, "nhap");
  assert.match(empty.note, /chưa chốt/i);
});
