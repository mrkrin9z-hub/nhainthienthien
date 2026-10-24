import assert from "node:assert/strict";
import test from "node:test";

import { parseMarketplaceTable, planMarketplaceImport } from "./marketplace.ts";
import {
  expireAtFromApi,
  linesFromShopeeOrders,
  linesFromTiktokOrders,
  parseShopeeLink,
  parseTiktokLink,
  publicApiMessage,
  shopeeAuthorizeUrl,
  shopeeBase,
  tiktokAuthorizeUrl,
  tiktokSign,
  tokenFresh,
} from "./marketplace-api.ts";

test("chữ ký TikTok Shop khớp ví dụ app_secret e59af819cc", async () => {
  const sign = await tiktokSign("e59af819cc", "/authorization/202309/shops", { timestamp: "1623812664", app_key: "29a39d" }, "");
  assert.equal(sign, "b596b73e0cc6de07ac26f036364178ab16b0a907af13d43f0a0cd2345f582dc8");
  const withBody = await tiktokSign("secret", "/order/202309/orders/search", { app_key: "app", page_size: "20", shop_cipher: "cipher" }, '{"a":1}');
  const again = await tiktokSign("secret", "/order/202309/orders/search", { shop_cipher: "cipher", page_size: "20", app_key: "app", sign: "bo-qua" }, '{"a":1}');
  assert.equal(withBody, again);
});

test("chuỗi ký Shopee và link ủy quyền", async () => {
  assert.equal(
    shopeeBase({ partnerId: "100", path: "/api/v2/order/get_order_list", timestamp: "1700000000", accessToken: "tok", shopId: "9" }),
    "100/api/v2/order/get_order_list1700000000tok9",
  );
  assert.equal(shopeeBase({ partnerId: "100", path: "/api/v2/shop/auth_partner", timestamp: "1700000000" }), "100/api/v2/shop/auth_partner1700000000");
  assert.match(tiktokAuthorizeUrl("123", "abc"), /^https:\/\/services\.tiktokshop\.com\/open\/authorize\?/);
  assert.match(shopeeAuthorizeUrl({ partnerId: "100", timestamp: "1", sign: "ab", redirect: "https://nhainthienthien.com/api/admin/shopee/callback" }), /redirect=/);
});

test("hạn token và thông báo không kèm khóa dài", () => {
  assert.equal(expireAtFromApi(1690000000, 0), 1690000000 * 1000);
  assert.equal(expireAtFromApi(3600, 1_000), 3_601_000);
  assert.equal(tokenFresh(10 * 60 * 1000, 0), true);
  assert.equal(tokenFresh(60_000, 0), false);
  const message = publicApiMessage("TikTok Shop", "bad token TTP_pwSm2AAAAABmmtFz1xlyKMnwg74T2GJ5s0uQ");
  assert.equal(message.includes("TTP_"), false);
  assert.match(message, /^TikTok Shop:/);
});

test("đơn TikTok gộp từng món, bỏ chưa trả, không tạo đơn hủy", () => {
  const lines = linesFromTiktokOrders([
    {
      id: "576461413038785752",
      status: "AWAITING_SHIPMENT",
      create_time: 1_720_000_000,
      buyer_nickname: "lan",
      is_cod: true,
      shipping_provider: "J&T",
      tracking_number: "JT1",
      payment_method_name: "Cash",
      payment: { shipping_fee: "15000", total_amount: "89000" },
      recipient_address: { name: "Lan", phone_number: "0901234567", full_address: "Xuân Lộc, Đồng Nai" },
      line_items: [
        { seller_sku: "TG-13x18", product_name: "Ảnh ép gỗ", sku_name: "13x18", sale_price: "35000", display_status: "AWAITING_SHIPMENT" },
        { seller_sku: "TG-13x18", product_name: "Ảnh ép gỗ", sku_name: "13x18", sale_price: "35000", display_status: "AWAITING_SHIPMENT" },
      ],
    },
    { id: "1", status: "UNPAID", line_items: [{ seller_sku: "TG-13x18", sale_price: "1" }] },
    { id: "2", status: "CANCELLED", line_items: [{ seller_sku: "TG-13x18", sale_price: "1" }] },
  ]);
  assert.equal(lines.length, 2);
  assert.equal(lines[0]?.qty, 2);
  assert.equal(lines[0]?.lineAmount, 70000);
  assert.equal(lines[0]?.payment, "COD");
  assert.equal(lines[0]?.phone, "0901234567");
  const plan = planMarketplaceImport({
    lines,
    maps: [{ externalSku: "TG-13x18", skuId: "sku-1" }],
    existingIds: [],
  });
  assert.equal(plan.cancelled, 1);
  assert.equal(plan.orders.length, 1);
  assert.equal(plan.orders[0]?.platformOrderId, "576461413038785752");
  assert.equal(plan.orders[0]?.codAmount, 89000);
  assert.equal(plan.orders[0]?.items[0]?.quantity, 2);
  const again = planMarketplaceImport({ lines, maps: [{ externalSku: "TG-13x18", skuId: "sku-1" }], existingIds: ["576461413038785752"] });
  assert.deepEqual(again.duplicates, ["576461413038785752"]);
  assert.equal(again.orders.length, 0);
});

test("đơn Shopee lấy model_sku và bỏ đơn đang hủy", () => {
  const lines = linesFromShopeeOrders([
    {
      order_sn: "201218V2Y6E59M",
      order_status: "READY_TO_SHIP",
      create_time: 1_720_000_100,
      buyer_username: "nguoi_mua",
      payment_method: "Cash on Delivery",
      cod: true,
      shipping_carrier: "SPX",
      total_amount: 78000,
      estimated_shipping_fee: 12000,
      recipient_address: { name: "Hùng", phone: "0909***999", full_address: "Long Khánh" },
      item_list: [{ model_sku: "TG-15x21", item_sku: "PARENT", item_name: "Ảnh", model_name: "15x21", model_quantity_purchased: 2, model_discounted_price: 39000 }],
    },
    { order_sn: "UNPAID1", order_status: "UNPAID", item_list: [{ model_sku: "TG-15x21", model_quantity_purchased: 1, model_discounted_price: 1 }] },
    { order_sn: "CANCEL1", order_status: "IN_CANCEL", item_list: [{ model_sku: "TG-15x21", model_quantity_purchased: 1, model_discounted_price: 1 }] },
  ]);
  const plan = planMarketplaceImport({ lines, maps: [{ externalSku: "tg-15x21", skuId: "sku-2" }], existingIds: [] });
  assert.equal(plan.cancelled, 1);
  assert.equal(plan.orders.length, 1);
  assert.equal(plan.orders[0]?.items[0]?.quantity, 2);
  assert.equal(plan.orders[0]?.items[0]?.platformLineTotal, 78000);
  assert.equal(plan.orders[0]?.phone, "0909***999");
  assert.ok(plan.orders[0]?.flags.includes("SĐT bị ẩn"));
  assert.equal(parseTiktokLink(""), null);
  assert.equal(parseTiktokLink("{"), null);
  assert.equal(parseShopeeLink(JSON.stringify({ accessToken: "a", refreshToken: "b", shopId: "no" })), null);
  const link = parseTiktokLink(JSON.stringify({ accessToken: "a", refreshToken: "b", shopCipher: "c", shopId: "1", expireAt: 5, pulledAt: 9 }));
  assert.equal(link?.shopCipher, "c");
  assert.equal(link?.pulledAt, 9);
});

test("nhập lại cùng mã sàn thì cập nhật hạn gửi và SKU, không tạo đơn mới", () => {
  const lines = parseMarketplaceTable([
    ["Order ID", "Seller SKU", "Variation", "Quantity", "SKU Subtotal After Discount", "Order Amount", "Order Status", "Shipping Provider Name", "Tracking ID", "Payment Method", "Ship By", "Recipient"],
    ["576461413038785752", "TG-13x18-C1", "13x18", "1", "37000", "37000", "To Ship", "J&T", "JT123", "COD", "2026-10-25 18:00", "Lan"],
  ]);
  assert.equal(lines[0]?.shipBy?.slice(0, 10), "2026-10-25");
  assert.equal(lines[0]?.variation, "13x18");
  const plan = planMarketplaceImport({
    lines,
    maps: [],
    existingIds: ["576461413038785752"],
    skus: [{ id: "sku-tg", code: "TG-13x18-C1" }],
  });
  assert.equal(plan.orders.length, 0);
  assert.deepEqual(plan.duplicates, ["576461413038785752"]);
  assert.equal(plan.updates.length, 1);
  assert.equal(plan.updates[0]?.items[0]?.skuId, "sku-tg");
  assert.equal(plan.updates[0]?.items[0]?.externalSku, "TG-13x18-C1");
  assert.equal(plan.updates[0]?.items[0]?.variation, "13x18");
  assert.equal(plan.updates[0]?.tracking, "JT123");
  assert.equal(plan.updates[0]?.carrier, "J&T");
  assert.equal(plan.updates[0]?.cancel, false);
});
