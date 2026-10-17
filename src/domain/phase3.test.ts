import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { zipSync, strToU8 } from "fflate";

import { code128Widths } from "./barcode.ts";
import { backupKeysToDrop, dailyBackupKey, vnBackupDay } from "./guard.ts";
import {
  isCancelledStatus,
  isCodPayment,
  listDifference,
  normalizeMarketplacePhone,
  parseCreatedTime,
  parseMarketplaceTable,
  planMarketplaceImport,
  parseMoney,
} from "./marketplace.ts";
import { applyRestore, restoreSummary } from "./restore.ts";
import { buildSeed } from "./seed.ts";
import { decodeXml, parseCsv, rowsFromUpload, rowsFromXlsx } from "./sheet.ts";

test("ngày sao lưu theo giờ Việt Nam", () => {
  assert.equal(vnBackupDay(new Date("2026-10-17T16:30:00Z")), "2026-10-17");
  assert.equal(vnBackupDay(new Date("2026-10-17T17:30:00Z")), "2026-10-18");
  assert.equal(dailyBackupKey(new Date("2026-10-17T17:30:00Z")), "shop_backup:2026-10-18");
  const legacy = Array.from({ length: 3 }, (_, i) => `shop_backup:2026-10-17T15-49-2${i}-005Z`);
  const drop = backupKeysToDrop([...legacy, "shop_backup:2026-10-17"]);
  assert.deepEqual(drop, legacy);
});

test("map cột file sàn và không nhập dòng chưa map", () => {
  const table = parseCsv(
    "Mã đơn hàng,Tên sản phẩm,Mã SKU,Số lượng,Tên người nhận,Số điện thoại,Địa chỉ,Đơn vị vận chuyển,Mã vận đơn,Phí vận chuyển,Tiền thu hộ\n" +
      "TT1,Ảnh gỗ,TG-13x18,2,Lan,0901234567,\"Xuân Lộc, Đồng Nai\",GHN,VN1,25000,150000\n" +
      "TT1,Nam châm,NX-9x19,1,Lan,0901234567,\"Xuân Lộc, Đồng Nai\",GHN,VN1,25000,150000\n" +
      "TT2,Lạ,SKU-LA,1,Hùng,0909999999,Long Khánh,GHTK,VN2,0,0\n",
  );
  const lines = parseMarketplaceTable(table);
  assert.equal(lines.length, 3);
  assert.equal(lines[0]?.shipFee, 25000);
  assert.equal(lines[0]?.codAmount, 150000);
  const plan = planMarketplaceImport({
    lines,
    maps: [{ externalSku: "tg-13x18", skuId: "sku-1" }],
    existingIds: [],
  });
  assert.equal(plan.orders.length, 0);
  assert.ok(plan.issues.some((issue) => issue.orderId === "TT1" && issue.sku === "NX-9x19"));
  assert.ok(plan.issues.some((issue) => issue.orderId === "TT2"));
  const ready = planMarketplaceImport({
    lines,
    maps: [
      { externalSku: "TG-13x18", skuId: "sku-1" },
      { externalSku: "NX-9x19", skuId: "sku-2" },
    ],
    existingIds: ["TT2"],
  });
  assert.deepEqual(ready.duplicates, ["TT2"]);
  assert.equal(ready.orders.length, 1);
  assert.equal(ready.orders[0]?.status, "nhan_don");
  assert.equal(ready.orders[0]?.items.length, 2);
  assert.equal(ready.orders[0]?.items[0]?.quantity, 2);
  assert.equal(ready.orders[0]?.codAmount, 150000);
  assert.equal(ready.orders[0]?.phone, "0901234567");
  assert.equal(parseMoney("99.000"), 99000);
  assert.equal(parseMoney("1,500.5"), 1501);
});

test("xlsx một sheet đọc lại được", () => {
  const shared =
    `<?xml version="1.0"?><sst><si><t>Order ID</t></si><si><t>Seller SKU</t></si><si><t>Quantity</t></si><si><t>SP9</t></si></sst>`;
  const sheet =
    `<?xml version="1.0"?><worksheet><sheetData>` +
    `<row r="1"><c r="A1" t="s"><v>0</v></c><c r="B1" t="s"><v>1</v></c><c r="C1" t="s"><v>2</v></c></row>` +
    `<row r="2"><c r="A2"><v>88</v></c><c r="B2" t="s"><v>3</v></c><c r="C2"><v>3</v></c></row>` +
    `</sheetData></worksheet>`;
  const bytes = zipSync({
    "xl/sharedStrings.xml": strToU8(shared),
    "xl/worksheets/sheet1.xml": strToU8(sheet),
  });
  const rows = rowsFromXlsx(bytes);
  const lines = parseMarketplaceTable(rows);
  assert.equal(lines[0]?.orderId, "88");
  assert.equal(lines[0]?.sku, "SP9");
  assert.equal(lines[0]?.qty, 3);
});

test("số điện thoại sàn và trạng thái hủy", () => {
  assert.deepEqual(normalizeMarketplacePhone("(+84)901234512"), { phone: "0901234512", masked: false });
  assert.deepEqual(normalizeMarketplacePhone("+84901234512"), { phone: "0901234512", masked: false });
  assert.deepEqual(normalizeMarketplacePhone("84901234512"), { phone: "0901234512", masked: false });
  assert.deepEqual(normalizeMarketplacePhone("(+84)90*****12"), { phone: "(+84)90*****12", masked: true });
  assert.equal(isCancelledStatus("Đã hủy"), true);
  assert.equal(isCancelledStatus("Đã huỷ"), true);
  assert.equal(isCancelledStatus("Cancelled"), true);
  assert.equal(isCancelledStatus("Đã giao"), false);
  assert.equal(isCodPayment("Thanh toán khi giao hàng"), true);
  assert.equal(isCodPayment("Thanh toán khi nhận hàng"), true);
  assert.equal(isCodPayment("Cash on delivery"), true);
  assert.equal(isCodPayment("COD"), true);
  assert.equal(isCodPayment("Chuyển khoản"), false);
  assert.equal(parseCreatedTime("2026-10-17 09:30:00"), "2026-10-17T02:30:00.000Z");
  assert.equal(parseCreatedTime("17/10/2026 09:30:00"), "2026-10-17T02:30:00.000Z");
  assert.equal(listDifference(135000, 35000, 2), 65000);
  assert.equal(listDifference(null, 35000, 2), null);
});

test("file TikTok Seller Center bỏ dòng mô tả, gộp dòng, COD và số che", () => {
  const headers = [
    "Order ID",
    "Seller SKU",
    "Product Name",
    "Variation",
    "Quantity",
    "Buyer Username",
    "Recipient",
    "Phone #",
    "Detail Address",
    "Additional address information",
    "Districts",
    "City",
    "Province",
    "Country",
    "Shipping Provider Name",
    "Tracking ID",
    "Shipping Fee After Discount",
    "Original Shipping Fee",
    "Payment Method",
    "Order Amount",
    "SKU Subtotal After Discount",
    "Order Status",
    "Created Time",
  ];
  const description = [
    "Platform unique order ID.",
    "Seller-defined SKU.",
    "Name of the product.",
    "SKU variation.",
    "Number of items purchased.",
    "Username of the buyer.",
    "Name of the recipient.",
    "Recipient phone number. May be masked.",
    "Street detail.",
    "Additional address information.",
    "District or town.",
    "City name.",
    "Province or state.",
    "Country name.",
    "Name of the shipping provider.",
    "Package tracking number.",
    "Shipping fee after discounts.",
    "Original shipping fee before discount.",
    "How the buyer paid.",
    "Total order amount.",
    "SKU subtotal after discount.",
    "Current order status.",
    "Time the order was created.",
  ];
  const live = "576800000000000001";
  const base = {
    "Order ID": live,
    "Buyer Username": "lan_tiktok",
    Recipient: "Lan",
    "Phone #": "(+84)901234512",
    "Detail Address": "12 Nguyễn Văn Trỗi",
    "Additional address information": "gần chợ",
    Districts: "Huyện Xuân Lộc",
    City: "",
    Province: "Đồng Nai",
    Country: "Việt Nam",
    "Shipping Provider Name": "J&T Express",
    "Tracking ID": "JT123",
    "Shipping Fee After Discount": "15000",
    "Original Shipping Fee": "30000",
    "Payment Method": "Cash on delivery",
    "Order Amount": "180000",
    "Order Status": "Awaiting shipment",
    "Created Time": "2026-10-17 09:30:00",
  };
  const rows = [
    headers,
    description,
    {
      ...base,
      "Seller SKU": "TG-13x18",
      "Product Name": "Ảnh gỗ",
      Variation: "13x18",
      Quantity: "2",
      "SKU Subtotal After Discount": "135000",
    },
    {
      ...base,
      "Seller SKU": "NX-9x19",
      "Product Name": "Nam châm",
      Variation: "9x19",
      Quantity: "1",
      "SKU Subtotal After Discount": "45000",
    },
    {
      ...base,
      "Order ID": "576800000000000002",
      "Seller SKU": "TG-13x18",
      "Product Name": "Ảnh gỗ",
      Variation: "13x18",
      Quantity: "1",
      "Order Amount": "70000",
      "SKU Subtotal After Discount": "70000",
      "Order Status": "Cancelled",
      "Payment Method": "Cash on delivery",
    },
    {
      ...base,
      "Order ID": "576800000000000002",
      "Seller SKU": "NX-9x19",
      "Product Name": "Nam châm",
      Variation: "9x19",
      Quantity: "1",
      "Order Status": "Cancelled",
    },
    {
      ...base,
      "Order ID": "576800000000000003",
      "Buyer Username": "minh_shop",
      Recipient: "Minh",
      "Phone #": "(+84)90*****12",
      "Seller SKU": "TG-13x18",
      "Product Name": "Ảnh gỗ",
      Variation: "",
      Quantity: "1",
      "Payment Method": "Bank Transfer",
      "Order Amount": "70000",
      "SKU Subtotal After Discount": "70000",
      "Order Status": "Awaiting collection",
    },
    {
      ...base,
      "Order ID": "576800000000000004",
      "Buyer Username": "should_ignore",
      Recipient: "",
      "Phone #": "0901111222",
      "Seller SKU": "TG-13x18",
      "Product Name": "Ảnh gỗ",
      Variation: "",
      Quantity: "1",
      "Payment Method": "Bank Transfer",
      "Order Amount": "50000",
      "SKU Subtotal After Discount": "50000",
    },
  ].map((row) => (Array.isArray(row) ? row : headers.map((header) => (row as Record<string, string>)[header] ?? "")));
  const lines = parseMarketplaceTable(rowsFromXlsx(sheetBytes(rows)));
  assert.equal(lines.some((line) => line.orderId.includes("Platform")), false);
  assert.equal(lines.length, 6);
  const plan = planMarketplaceImport({
    lines,
    maps: [
      { externalSku: "TG-13x18", skuId: "sku-1" },
      { externalSku: "NX-9x19", skuId: "sku-2" },
    ],
    existingIds: [],
  });
  assert.equal(plan.cancelled, 1);
  assert.equal(plan.issues.length, 0);
  assert.equal(plan.orders.length, 3);
  const order = plan.orders.find((item) => item.platformOrderId === live);
  assert.ok(order);
  assert.equal(order.buyer, "Lan");
  assert.equal(order.phone, "0901234512");
  assert.equal(order.address, "12 Nguyễn Văn Trỗi, gần chợ, Huyện Xuân Lộc, Đồng Nai, Việt Nam");
  assert.equal(order.carrier, "J&T Express");
  assert.equal(order.tracking, "JT123");
  assert.equal(order.shipFee, 15000);
  assert.equal(order.codAmount, 180000);
  assert.equal(order.orderAmount, 180000);
  assert.equal(order.createdAt, "2026-10-17T02:30:00.000Z");
  assert.equal(order.items.length, 2);
  assert.equal(order.items[0]?.name, "Ảnh gỗ — 13x18");
  assert.equal(order.items[0]?.quantity, 2);
  assert.equal(order.items[0]?.platformLineTotal, 135000);
  assert.equal(order.items[1]?.platformLineTotal, 45000);
  assert.equal(order.flags.includes("SĐT bị ẩn"), false);
  const masked = plan.orders.find((item) => item.platformOrderId === "576800000000000003");
  assert.equal(masked?.phone, "(+84)90*****12");
  assert.ok(masked?.flags.includes("SĐT bị ẩn"));
  assert.equal(masked?.codAmount, null);
  assert.equal(masked?.buyer, "Minh");
  const unnamed = plan.orders.find((item) => item.platformOrderId === "576800000000000004");
  assert.equal(unnamed?.buyer, "Khách sàn");
  assert.equal(plan.orders.some((item) => item.buyer.includes("tiktok") || item.buyer === "should_ignore"), false);
});

test("file Shopee khớp cột tiếng Việt, COD và bỏ đơn đã hủy", () => {
  const csv = [
    "Mã đơn hàng,SKU phân loại hàng,SKU sản phẩm,Tên sản phẩm,Tên phân loại hàng,Số lượng,Tên Người nhận,Số điện thoại,Địa chỉ nhận hàng,Đơn Vị Vận Chuyển,Mã vận đơn,Phí vận chuyển (người mua trả),Tổng giá trị đơn hàng (VND),Phương thức thanh toán,Trạng thái đơn hàng",
    "2410170000001,TG-13x18,PARENT-1,Ảnh gỗ,13x18,1,Hà,+84901234512,\"Xuân Lộc, Đồng Nai\",GHN,SPX1,18000,220000,Thanh toán khi giao hàng,Đang giao",
    "2410170000002,TG-13x18,PARENT-1,Ảnh gỗ,13x18,1,Hà,0901234512,Xuân Lộc,GHN,SPX2,0,90000,Thanh toán khi giao hàng,Đã hủy",
    "2410170000003,TG-13x18,PARENT-1,Ảnh gỗ,13x18,2,Minh,0901234513,Long Khánh,GHTK,SPX3,20000,300000,COD,Chờ giao",
    "2410170000003,NX-9x19,PARENT-2,Nam châm,9x19,1,Minh,0901234513,Long Khánh,GHTK,SPX3,20000,300000,COD,Chờ giao",
  ].join("\n");
  const lines = parseMarketplaceTable(parseCsv(csv));
  assert.equal(lines.length, 4);
  assert.equal(lines[0]?.sku, "TG-13x18");
  assert.equal(lines[0]?.shipFee, 18000);
  const plan = planMarketplaceImport({
    lines,
    maps: [
      { externalSku: "TG-13x18", skuId: "sku-1" },
      { externalSku: "NX-9x19", skuId: "sku-2" },
    ],
    existingIds: [],
  });
  assert.equal(plan.cancelled, 1);
  assert.equal(plan.orders.length, 2);
  const single = plan.orders.find((order) => order.platformOrderId === "2410170000001");
  assert.equal(single?.phone, "0901234512");
  assert.equal(single?.buyer, "Hà");
  assert.equal(single?.address, "Xuân Lộc, Đồng Nai");
  assert.equal(single?.codAmount, 220000);
  assert.equal(single?.orderAmount, 220000);
  assert.equal(single?.items.length, 1);
  assert.equal(single?.items[0]?.name, "Ảnh gỗ — 13x18");
  assert.equal(single?.items[0]?.platformLineTotal, 220000);
  const multi = plan.orders.find((order) => order.platformOrderId === "2410170000003");
  assert.equal(multi?.items.length, 2);
  assert.equal(multi?.codAmount, 300000);
  assert.equal(multi?.orderAmount, 300000);
  assert.ok(multi?.flags.includes("Không có tiền từng dòng"));
  assert.equal(multi?.items[0]?.platformLineTotal, null);
  assert.equal(multi?.items[1]?.platformLineTotal, null);
});

function sheetBytes(rows: string[][]): Uint8Array {
  const strings: string[] = [];
  const sheet = rows
    .map((row, rowIndex) => {
      const cells = row
        .map((value, column) => {
          if (!value) return "";
          const ref = `${String.fromCharCode(65 + column)}${rowIndex + 1}`;
          const numeric = /^-?\d+(\.\d+)?$/.test(value) && value.length < 12 && !/^0\d/.test(value);
          if (numeric) return `<c r="${ref}"><v>${value}</v></c>`;
          let index = strings.indexOf(value);
          if (index < 0) {
            index = strings.length;
            strings.push(value);
          }
          return `<c r="${ref}" t="s"><v>${index}</v></c>`;
        })
        .join("");
      return `<row r="${rowIndex + 1}">${cells}</row>`;
    })
    .join("");
  const shared = `<?xml version="1.0"?><sst>${strings.map((value) => `<si><t>${value.replaceAll("&", "&amp;").replaceAll("<", "&lt;")}</t></si>`).join("")}</sst>`;
  return zipSync({
    "xl/sharedStrings.xml": strToU8(shared),
    "xl/worksheets/sheet1.xml": strToU8(`<?xml version="1.0"?><worksheet><sheetData>${sheet}</sheetData></worksheet>`),
  });
}

test("giải mã ký tự số trong Excel trước khi đổi &amp;", () => {
  assert.equal(decodeXml("M&#227; &#273;&#417;n h&#224;ng"), "Mã đơn hàng");
  assert.equal(decodeXml("&#x111;"), "đ");
  assert.equal(decodeXml("&amp;#273;"), "&#273;");
  assert.equal(decodeXml("A &amp; B"), "A & B");
});

test("file mẫu Shopee: COD khi nhận hàng bằng tiền người mua trả", () => {
  const numeric = rowsFromXlsx(readFileSync(new URL("./fixtures/shopee-order-all.xlsx", import.meta.url)));
  const shared = rowsFromXlsx(readFileSync(new URL("./fixtures/shopee-order-all-sst.xlsx", import.meta.url)));
  assert.equal(numeric[0]?.[0], "Mã đơn hàng");
  assert.equal(shared[0]?.[0], "Mã đơn hàng");
  const planNumeric = shopeePlan(numeric);
  const planShared = shopeePlan(shared);
  assert.equal(planNumeric.cancelled, 1);
  assert.equal(planShared.cancelled, 1);
  assert.equal(planNumeric.orders.length, 2);
  const cod = planNumeric.orders.find((order) => order.platformOrderId === "261017ABCDEF01");
  const sharedCod = planShared.orders.find((order) => order.platformOrderId === "261017ABCDEF01");
  assert.equal(cod?.buyer, "Phạm Văn D");
  assert.equal(cod?.phone, "0912345678");
  assert.equal(cod?.address, "12 Hùng Vương, Thị trấn Gia Ray, Huyện Xuân Lộc, Đồng Nai, VN");
  assert.equal(cod?.address.startsWith("12 Hùng Vương"), true);
  assert.equal(cod?.shipFee, 30000);
  assert.equal(cod?.orderAmount, 470000);
  assert.equal(cod?.codAmount, 470000);
  assert.equal(cod?.items.length, 2);
  assert.equal(cod?.items[0]?.platformLineTotal, 110000);
  assert.equal(cod?.items[1]?.platformLineTotal, 330000);
  assert.equal(cod?.items[0]?.externalSku, "ANH-TG-2030");
  assert.equal(sharedCod?.orderAmount, cod?.orderAmount);
  assert.equal(sharedCod?.address, cod?.address);
  assert.equal(sharedCod?.codAmount, cod?.codAmount);
  const paid = planNumeric.orders.find((order) => order.platformOrderId === "261017ABCDEF03");
  assert.equal(paid?.phone, "******789");
  assert.ok(paid?.flags.includes("SĐT bị ẩn"));
  assert.equal(paid?.codAmount, null);
  assert.equal(paid?.orderAmount, 124000);
  assert.equal(paid?.shipFee, 15000);
  assert.equal(paid?.items[0]?.platformLineTotal, 109000);
  assert.equal(paid?.address, "5 Trần Phú, Xuân Lộc, Đồng Nai, VN");
});

test("file mẫu TikTok có phường xã và số che", () => {
  const numeric = rowsFromXlsx(readFileSync(new URL("./fixtures/tiktok-export-realistic.xlsx", import.meta.url)));
  const shared = rowsFromXlsx(readFileSync(new URL("./fixtures/tiktok-export-realistic-sst.xlsx", import.meta.url)));
  assert.equal(numeric[1]?.[0], "Platform unique order ID.");
  const plan = tiktokPlan(numeric);
  const sharedPlan = tiktokPlan(shared);
  assert.equal(plan.orders.length, 2);
  assert.equal(plan.issues.some((issue) => issue.sku === "MOC-KHOA"), true);
  assert.equal(sharedPlan.orders.length, 2);
  const order = plan.orders.find((item) => item.platformOrderId === "578123456789012345");
  assert.equal(order?.buyer, "Nguyễn Văn A");
  assert.equal(order?.phone, "(+84)90*****12");
  assert.ok(order?.flags.includes("SĐT bị ẩn"));
  assert.equal(order?.codAmount, 203000);
  assert.equal(order?.orderAmount, 203000);
  assert.equal(order?.shipFee, 25000);
  assert.equal(order?.items.length, 2);
  assert.equal(order?.items[0]?.platformLineTotal, 59000);
  assert.equal(order?.items[1]?.platformLineTotal, 119000);
  assert.equal(order?.address, "1** H*** V*****, Xã Xuân Hiệp, Huyện Xuân Lộc, Đồng Nai, Việt Nam");
  assert.equal(order?.createdAt, "2026-10-17T13:15:03.000Z");
  assert.equal(plan.orders.some((item) => item.buyer === "khachhang_a"), false);
  const card = plan.orders.find((item) => item.platformOrderId === "578123456789099999");
  assert.equal(card?.codAmount, null);
  assert.equal(card?.orderAmount, 330000);
  assert.equal(card?.address.startsWith("45 Trần Phú, Xã Xuân Hiệp"), true);
  assert.equal(sharedPlan.orders.find((item) => item.platformOrderId === order?.platformOrderId)?.address, order?.address);
});

test("csv TikTok v2 chuẩn hóa số và bỏ đơn đã hủy", () => {
  const table = rowsFromUpload("tiktok-export-v2.csv", readFileSync(new URL("./fixtures/tiktok-export-v2.csv", import.meta.url)));
  const plan = tiktokPlan(table);
  assert.equal(plan.cancelled, 1);
  const order = plan.orders.find((item) => item.platformOrderId === "578123456789012345");
  assert.equal(order?.phone, "0901234512");
  assert.equal(order?.address, "123 Hùng Vương, Xã Xuân Hiệp, Huyện Xuân Lộc, Đồng Nai, Việt Nam");
  assert.equal(order?.codAmount, 203000);
});

test("Shopee lấy giá ưu đãi khi thiếu tổng giá bán và lấy phí người mua trả", () => {
  const table = parseCsv(
    "Mã đơn hàng,SKU phân loại hàng,Số lượng,Giá ưu đãi,Tên Người nhận,Số điện thoại,Địa chỉ nhận hàng,Tỉnh/Thành phố,Quốc gia,Phí vận chuyển (dự kiến),Phí vận chuyển mà người mua trả,Tổng số tiền người mua thanh toán,Phương thức thanh toán\n" +
      "2610990000001,SKU1,3,20.000,An,0901111222,1 Đường A,Đồng Nai,VN,40000,15000,75000,Thanh toán khi nhận hàng\n",
  );
  const plan = planMarketplaceImport({
    lines: parseMarketplaceTable(table),
    maps: [{ externalSku: "SKU1", skuId: "sku-1" }],
    existingIds: [],
  });
  const order = plan.orders[0];
  assert.equal(order?.items[0]?.platformLineTotal, 60000);
  assert.equal(order?.orderAmount, 75000);
  assert.equal(order?.codAmount, 75000);
  assert.equal(order?.shipFee, 15000);
  assert.equal(order?.address, "1 Đường A, VN");
});

const SAMPLE_MAPS = [
  { externalSku: "ANH-TG-2030", skuId: "sku-1" },
  { externalSku: "ANH-TG-1318-C3", skuId: "sku-2" },
  { externalSku: "ANHTHO-4060", skuId: "sku-3" },
];

function shopeePlan(table: string[][]) {
  return planMarketplaceImport({ lines: parseMarketplaceTable(table), maps: SAMPLE_MAPS, existingIds: [] });
}

function tiktokPlan(table: string[][]) {
  return planMarketplaceImport({ lines: parseMarketplaceTable(table), maps: SAMPLE_MAPS, existingIds: [] });
}

test("khôi phục giữ nhân viên", async () => {
  const current = await buildSeed();
  current.staff[0]!.passwordHash = "hash-moi";
  current.staff[0]!.totpEnabled = true;
  current.staff[0]!.totpSecret = "SECRET";
  const incoming = await buildSeed();
  incoming.orders = [{ id: "o1" } as never];
  incoming.staff[0]!.passwordHash = "hash-cu";
  incoming.staff[0]!.totpEnabled = false;
  const next = applyRestore(current, incoming);
  assert.equal(next.staff[0]?.passwordHash, "hash-moi");
  assert.equal(next.staff[0]?.totpSecret, "SECRET");
  assert.equal(next.orders.length, 1);
  const summary = restoreSummary(current, incoming);
  assert.ok(summary.keep.some((line) => line.includes("Mật khẩu")));
  assert.ok(summary.replace.some((line) => line.includes("Đơn hàng: 1")));
});

test("mã vạch bắt đầu bằng start B", () => {
  const widths = code128Widths("TT1");
  assert.deepEqual(widths.slice(0, 6), [2, 1, 1, 2, 1, 4]);
  assert.equal(widths.at(-1), 2);
});
