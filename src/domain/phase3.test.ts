import assert from "node:assert/strict";
import test from "node:test";

import { zipSync, strToU8 } from "fflate";

import { code128Widths } from "./barcode.ts";
import { backupKeysToDrop, dailyBackupKey, vnBackupDay } from "./guard.ts";
import { parseMarketplaceTable, planMarketplaceImport, parseMoney } from "./marketplace.ts";
import { applyRestore, restoreSummary } from "./restore.ts";
import { buildSeed } from "./seed.ts";
import { parseCsv, rowsFromXlsx } from "./sheet.ts";

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
