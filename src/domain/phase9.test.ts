import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { customerCards, DEFAULT_REPEAT_ORDERS } from "./crm.ts";
import { driveFolderParts, driveRootName } from "./drive-path.ts";
import { googleAuthUrl, readDriveState, signDriveState } from "./drive-oauth.ts";
import { backupKeysToDrop } from "./guard.ts";
import { defaultCarrier, JT_CARRIER, JT_LABEL_MM, jtCapabilities, jtOrder, jtPlan } from "./jt.ts";
import { buildSeed } from "./seed.ts";
import { CAR_MAGNET_SIZES, FRIDGE_MAGNET_SIZES, PHOTO_PRINT_SIZES, sizeFitsProduct } from "./sizes.ts";
import type { Customer, Order, ShopState } from "./types.ts";
import { PRICE_STATUS_LABEL } from "./types.ts";

function text(file: string): string {
  return readFileSync(new URL(file, import.meta.url), "utf8");
}

test("thư mục Drive theo tháng Việt Nam và nguồn đơn", () => {
  const oct = driveFolderParts({
    code: "TT261018-001",
    customerName: "Nguyễn  A/B",
    createdAt: "2026-10-31T16:30:00.000Z",
    source: "web",
    channel: "tai_tiem",
  });
  assert.deepEqual(oct, ["Đơn web", "2026-10", "TT261018-001 - Nguyễn A B"]);
  const nov = driveFolderParts({
    code: "TT261101-001",
    customerName: "   ",
    createdAt: "2026-10-31T17:30:00.000Z",
    source: "web",
    channel: "tai_tiem",
  });
  assert.equal(nov[0], "Đơn web");
  assert.equal(nov[1], "2026-11");
  assert.equal(nov[2], "TT261101-001 - Khách");
  const long = "A".repeat(80);
  assert.equal(driveFolderParts({ code: "TT1", customerName: long, createdAt: "2026-10-01T00:00:00.000Z", source: "web" })[2].endsWith("A".repeat(60)), true);
  assert.equal(driveRootName({ channel: "facebook", source: "manual" }), "Đơn Facebook");
  assert.equal(driveRootName({ channel: "tiktok", source: "manual" }), "Đơn TikTok");
  assert.equal(driveRootName({ channel: "shopee" }), "Đơn Shopee");
  assert.equal(driveRootName({ channel: "tai_tiem", source: "manual" }), "Đơn tại tiệm");
});

test("state kết nối Drive hết hạn và không chứa khóa", async () => {
  const now = 1_700_000_000_000;
  const state = await signDriveState("staff-owner", "secret-test", now);
  assert.equal(await readDriveState(state, "secret-test", now + 60_000), "staff-owner");
  assert.equal(await readDriveState(state, "secret-test", now + 11 * 60 * 1000), null);
  assert.equal(await readDriveState(state, "secret-khac", now), null);
  assert.equal(await readDriveState(`${state}x`, "secret-test", now), null);
  assert.equal(state.includes("secret-test"), false);
  const url = new URL(googleAuthUrl({ clientId: "client", redirectUri: "https://nhainthienthien.com/api/admin/drive/callback", state }));
  assert.equal(url.origin, "https://accounts.google.com");
  assert.equal(url.searchParams.get("scope"), "https://www.googleapis.com/auth/drive.file");
  assert.equal(url.searchParams.get("access_type"), "offline");
  assert.equal(url.searchParams.get("prompt"), "consent");
});

test("khổ ảnh in, nam châm tủ và nam châm xe trong sổ mẫu", async () => {
  const state = await buildSeed();
  for (const sku of state.skus) assert.equal(sizeFitsProduct(sku.groupId, sku.size), true, sku.code);
  assert.equal(sizeFitsProduct("ep_go", "10x15"), false);
  assert.equal(sizeFitsProduct("nam_cham_tu", "9x19"), false);
  assert.equal(sizeFitsProduct("nam_cham_xe", "6x9"), false);
  assert.equal(sizeFitsProduct("anh_tho", "13x18"), false);
  assert.equal(sizeFitsProduct("anh_tho", "15x21"), false);
  const prints = state.skus.filter((sku) => ["ep_go", "giay_khen", "trang_guong"].includes(sku.groupId));
  assert.ok(prints.length > 0);
  assert.ok(prints.every((sku) => (PHOTO_PRINT_SIZES as readonly (string | null)[]).includes(sku.size)));
  assert.deepEqual(
    [...new Set(state.skus.filter((sku) => sku.groupId === "nam_cham_tu").map((sku) => sku.size))],
    [...FRIDGE_MAGNET_SIZES],
  );
  assert.deepEqual(
    [...new Set(state.skus.filter((sku) => sku.groupId === "nam_cham_xe").map((sku) => sku.size))].sort(),
    [...CAR_MAGNET_SIZES].sort(),
  );
});

test("J&T chạy tay khi chưa có khóa và không gọi mạng", () => {
  const web = { channel: "tai_tiem", source: "web", fulfillment: "delivery", shipping: { tracking: "JT123", shipFee: null } };
  assert.equal(jtOrder(web), true);
  assert.equal(jtOrder({ channel: "tai_tiem", source: "web", fulfillment: "pickup" }), false);
  assert.equal(jtOrder({ channel: "facebook", source: "manual", fulfillment: "pickup" }), true);
  assert.equal(jtOrder({ channel: "tiktok", source: "manual", fulfillment: "delivery" }), false);
  assert.equal(defaultCarrier(web), JT_CARRIER);
  assert.equal(defaultCarrier({ channel: "tai_tiem", source: "manual", fulfillment: "delivery" }), "");
  const manual = jtPlan(web, false);
  assert.equal(manual.mode, "manual");
  assert.equal(manual.carrier, JT_CARRIER);
  assert.equal(manual.fee, null);
  assert.equal(manual.tracking, "JT123");
  assert.match(manual.note, /bằng tay/);
  assert.deepEqual(manual.label, JT_LABEL_MM);
  const ready = jtPlan(web, true);
  assert.equal(ready.mode, "ready");
  assert.match(ready.note, /chờ hợp đồng API/);
  assert.equal(jtPlan({ channel: "shopee", source: "manual", fulfillment: "delivery" }, true).applies, false);
  const caps = jtCapabilities(false);
  assert.equal(caps.find((item) => item.id === "waybill")?.available, false);
  assert.equal(caps.find((item) => item.id === "quote")?.available, false);
  assert.equal(caps.find((item) => item.id === "track")?.available, false);
  assert.equal(caps.find((item) => item.id === "label")?.available, true);
  assert.equal(jtCapabilities(true).every((item) => item.id === "label" || item.available === false), true);
  const source = text("./jt.ts");
  assert.equal(/https?:\/\//.test(source), false);
});

function person(partial: Partial<Customer> & Pick<Customer, "id">): Customer {
  return {
    name: "Khách",
    phone: "0900000000",
    phoneNormalized: "0900000000",
    address: "",
    note: "",
    createdAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

function order(partial: Partial<Order> & Pick<Order, "id" | "status" | "createdAt">): Order {
  return { customerId: "c", channel: "tai_tiem", code: partial.id, total: 10000, ...partial } as Order;
}

test("khách quen từ đúng 2 đơn, không tính hủy và đơn ảnh lỗi", () => {
  assert.equal(DEFAULT_REPEAT_ORDERS, 2);
  const settings = {} as ShopState["settings"];
  const one = customerCards({
    customers: [person({ id: "c" })],
    orders: [order({ id: "a", status: "xong", createdAt: "2026-10-01T00:00:00.000Z" })],
    settings,
  } as ShopState);
  assert.equal(one[0]?.repeat, false);
  assert.equal(one[0]?.orderCount, 1);
  const two = customerCards({
    customers: [person({ id: "c" })],
    orders: [
      order({ id: "a", status: "xong", createdAt: "2026-10-01T00:00:00.000Z" }),
      order({ id: "b", status: "nhan_don", createdAt: "2026-10-02T00:00:00.000Z" }),
      order({ id: "h", status: "huy", createdAt: "2026-10-03T00:00:00.000Z" }),
      order({ id: "d", status: "draft_upload", createdAt: "2026-10-04T00:00:00.000Z" }),
      order({ id: "e", status: "upload_error", createdAt: "2026-10-05T00:00:00.000Z" }),
    ],
    settings,
  } as ShopState);
  assert.equal(two[0]?.orderCount, 2);
  assert.equal(two[0]?.repeat, true);
});

test("sao lưu ngày giữ 30 bản", () => {
  const daily = Array.from({ length: 30 }, (_, i) => `shop_backup:2026-03-${String(i + 1).padStart(2, "0")}`);
  assert.deepEqual(backupKeysToDrop(daily), []);
  assert.deepEqual(backupKeysToDrop([...daily, "shop_backup:2026-04-01"]), ["shop_backup:2026-03-01"]);
});

test("không còn nhãn nháp, không còn ô Zalo OA, Drive không dùng tài khoản dịch vụ", () => {
  assert.equal(PRICE_STATUS_LABEL.nhap, "Chưa có giá");
  for (const file of ["../routes/admin.gia.tsx", "./types.ts", "../../README.md", "../routes/admin.ket-noi.tsx"]) {
    assert.equal(/nháp/i.test(text(file)), false, file);
  }
  const connect = text("../routes/admin.ket-noi.tsx");
  assert.equal(connect.includes("Zalo OA"), false);
  assert.equal(connect.includes("Official Account"), false);
  assert.match(connect, /Kết nối Google Drive/);
  assert.match(connect, /J&T Express/);
  const drive = text("../server/drive.ts");
  assert.equal(drive.includes("GOOGLE_DRIVE_PRIVATE_KEY"), false);
  assert.equal(drive.includes("jwt-bearer"), false);
  assert.match(drive, /refresh_token/);
});
