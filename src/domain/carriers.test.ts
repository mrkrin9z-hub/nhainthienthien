import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  blankPickup,
  ghnAuth,
  ghnOrderBody,
  ghtkOrderBody,
  jtBizObject,
  parseGhnCreate,
  parseGhnDetail,
  parseGhtkCreate,
  parseGhtkFee,
  parseJtCreate,
  parseJtTrace,
  pickupReady,
  waybillBlock,
  type CarrierPickup,
  type WaybillDraft,
} from "./carriers.ts";
import { jtBusinessPassword, jtHeaderDigest } from "../server/carrier-sign.ts";
import { createGhnWaybill, createJtWaybill } from "../server/carriers.ts";

const pickup: CarrierPickup = {
  name: "Tiệm",
  phone: "0901000000",
  address: "12 đường Mẫu",
  province: "Đồng Nai",
  district: "",
  ward: "Xuân Lộc",
};

const draft: WaybillDraft = {
  code: "TT1",
  name: "Khách thử",
  phone: "0902000000",
  address: "34 đường Giao",
  province: "Đồng Nai",
  district: "",
  ward: "Xuân Hòa",
  weightGrams: 500,
  cod: 0,
  value: 59000,
  content: "1× Ảnh",
  note: "",
  items: [{ name: "Ảnh", quantity: 1 }],
};

test("chưa có khóa thì không tạo, đơn sàn và đơn đã có mã không tạo thêm", () => {
  assert.equal(waybillBlock({ channel: "facebook", status: "giao", fulfillment: "pickup", tracking: "" }), null);
  assert.equal(waybillBlock({ channel: "tai_tiem", status: "nhan_don", fulfillment: "delivery", tracking: "" }), null);
  assert.match(waybillBlock({ channel: "tai_tiem", status: "nhan_don", fulfillment: "pickup", tracking: "" }) ?? "", /không giao/);
  assert.match(waybillBlock({ channel: "shopee", status: "giao", fulfillment: "delivery", tracking: "" }) ?? "", /sàn/);
  assert.match(waybillBlock({ channel: "tiktok", status: "giao", fulfillment: "delivery", tracking: "SPX1" }) ?? "", /sàn/);
  assert.match(waybillBlock({ channel: "facebook", status: "giao", fulfillment: "pickup", tracking: "JT1" }) ?? "", /đã có mã/);
  assert.equal(waybillBlock({ channel: "facebook", status: "huy", fulfillment: "delivery", tracking: "" })?.includes("không giao"), true);
});

test("GHN dùng mã đơn làm khóa chống tạo trùng và địa chỉ 2 cấp", () => {
  const body = ghnOrderBody(pickup, draft);
  assert.equal(body.client_order_code, "TT1");
  assert.equal(body.payment_type_id, 1);
  assert.equal(body.is_new_to_address, true);
  assert.equal(body.is_new_from_address, true);
  assert.equal("to_district_name" in body, false);
  assert.equal(body.service_type_id, 2);
  const withDistrict = ghnOrderBody({ ...pickup, district: "Xuân Lộc" }, { ...draft, district: "Long Khánh" });
  assert.equal(withDistrict.is_new_to_address, false);
  assert.equal(withDistrict.to_district_name, "Long Khánh");
  assert.equal(parseGhnCreate({ code: 200, data: { order_code: "LAD1", total_fee: 20900 } }).tracking, "LAD1");
  assert.equal(parseGhnCreate({ code: 200, data: { order_code: "LAD1", total_fee: 20900 } }).fee, 20900);
  assert.equal(parseGhnDetail({ code: 200, data: { order_code: "LAD1", status: "delivering" } }).status, "Đang giao");
  assert.throws(() => parseGhnCreate({ code: 400, message: "token " + "A".repeat(30) }), /GHN/);
});

test("GHTK gửi lại đúng mã đơn thì lấy vận đơn đã có, không tạo đơn thứ hai", () => {
  assert.throws(() => ghtkOrderBody(pickup, draft), /quận/);
  const body = ghtkOrderBody({ ...pickup, district: "Xuân Lộc" }, { ...draft, district: "Long Khánh" }) as {
    order: { id: string; hamlet: string; is_freeship: number };
    products: { weight: number }[];
  };
  assert.equal(body.order.id, "TT1");
  assert.equal(body.order.hamlet, "Khác");
  assert.equal(body.order.is_freeship, 1);
  assert.equal(body.products[0]?.weight, 0.5);
  const again = parseGhtkCreate({
    success: false,
    message: "đã tồn tại",
    error: { code: "ORDER_ID_EXIST", ghtk_label: "S1.A1.1" },
  });
  assert.equal(again.tracking, "S1.A1.1");
  assert.equal(again.fee, null);
  assert.equal(parseGhtkFee({ success: true, fee: { fee: 30400 } }), 30400);
});

test("J&T ký đúng vector sandbox và không đưa mật khẩu thường vào thân đơn", () => {
  assert.equal(jtBusinessPassword("KGC6jju1"), "4AE2DBF6527EA7C49C59EFF24F6FEA71");
  const biz = JSON.stringify({ customerCode: "084LC02438", txlogisticId: "TT1" });
  assert.equal(jtHeaderDigest(biz, "test-private-key"), "5Omx5CNuiutrL7zZCdKr5w==");
  const hashed = jtBusinessPassword("mat-khau-thu");
  const order = jtBizObject(pickup, draft, hashed, "084LC02438");
  const raw = JSON.stringify(order);
  assert.equal(order.txlogisticId, "TT1");
  assert.equal(order.password, hashed);
  assert.equal(raw.includes("mat-khau-thu"), false);
  assert.equal(raw.includes("private"), false);
  assert.equal((order.sender as { city?: string }).city, undefined);
  assert.equal(parseJtCreate({ code: "1", msg: "success", data: { billCode: "8024", inquiryFee: 15000 } }).fee, 15000);
  const trace = parseJtTrace({
    code: "1",
    data: [{ billCode: "8024", details: [{ scanTime: "2026-10-01 01:00:00", scanTypeName: "Lấy hàng" }, { scanTime: "2026-10-02 01:00:00", scanTypeName: "Ký nhận" }] }],
  });
  assert.equal(trace.status, "Ký nhận");
});

test("gọi GHN và J&T đúng cổng, khóa nằm ở header", async () => {
  const seen: { url: string; headers: Headers; body: string }[] = [];
  const fetchImpl: typeof fetch = async (input, init) => {
    seen.push({ url: String(input), headers: new Headers(init?.headers), body: String(init?.body ?? "") });
    const url = String(input);
    const payload = url.includes("jtexpress")
      ? { code: "1", msg: "success", data: { billCode: "JT9", inquiryFee: 12000 } }
      : { code: 200, message: "Success", data: { order_code: "GHN9", total_fee: 18000 } };
    return new Response(JSON.stringify(payload), { status: 200 });
  };
  const ghn = await createGhnWaybill({ token: "ghn-token-secret", shopId: "92837" }, pickup, draft, fetchImpl);
  assert.equal(ghn.tracking, "GHN9");
  assert.equal(seen[0]?.url, "https://online-gateway.ghn.vn/shiip/public-api/v2/shipping-order/create");
  assert.equal(seen[0]?.headers.get("Token"), "ghn-token-secret");
  assert.equal(seen[0]?.headers.get("ShopId"), "92837");
  assert.equal(seen[0]?.body.includes("ghn-token-secret"), false);
  assert.equal(JSON.parse(seen[0]?.body ?? "{}").client_order_code, "TT1");
  const jt = await createJtWaybill(
    { apiAccount: "1001", privateKey: "test-private-key", customerCode: "084LC02438", password: "KGC6jju1" },
    pickup,
    draft,
    fetchImpl,
  );
  assert.equal(jt.tracking, "JT9");
  assert.equal(seen[1]?.url, "https://ylopenapi.jtexpress.vn/webopenplatformapi/api/order/addOrder");
  assert.equal(seen[1]?.headers.get("apiAccount"), "1001");
  assert.ok(seen[1]?.headers.get("digest"));
  assert.equal(seen[1]?.body.includes("KGC6jju1"), false);
  assert.equal(seen[1]?.body.includes("test-private-key"), false);
  assert.equal(seen[1]?.body.includes("4AE2DBF6527EA7C49C59EFF24F6FEA71"), true);
  const source = readFileSync(new URL("../server/carriers.ts", import.meta.url), "utf8");
  assert.match(source, /online-gateway\.ghn\.vn/);
  assert.match(source, /services\.giaohangtietkiem\.vn/);
  assert.match(source, /ylopenapi\.jtexpress\.vn/);
  assert.equal(source.includes("jtexpress.my"), false);
  assert.equal(pickupReady(blankPickup()), false);
  assert.equal(ghnAuth("tok", "12a"), null);
});
