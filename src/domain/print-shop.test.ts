import assert from "node:assert/strict";
import test from "node:test";

import { statusChangeError } from "./calc.ts";
import {
  cleanBank,
  deskAlerts,
  feedbackOpensReprint,
  hasPackingPhoto,
  itemChangeNote,
  needsPackCheck,
  packReady,
  transferContent,
  transferQrUrl,
} from "./print-shop.ts";

test("mã QR chuyển khoản gắn số tiền còn lại và mã đơn", () => {
  const bank = cleanBank({ id: "970422", account: "1133 6666 8888", holder: "NGUYEN VAN A" });
  assert.ok(bank);
  assert.equal(transferContent("tt261018-001"), "TT261018-001");
  const url = transferQrUrl({ bank: bank!, amount: 150000, code: "TT261018-001" });
  assert.ok(url?.startsWith("https://img.vietqr.io/image/970422-113366668888-compact2.png?"));
  assert.match(url ?? "", /amount=150000/);
  assert.match(url ?? "", /addInfo=TT261018-001/);
  assert.equal(transferQrUrl({ bank: bank!, amount: 0, code: "TT1" }), null);
  assert.throws(() => cleanBank({ id: "000", account: "123456", holder: "A B" }), /ngân hàng/);
  assert.equal(cleanBank({ id: "", account: "", holder: "" }), null);
});

test("lịch sử đổi khổ và số lượng, giấu giá với sản xuất", () => {
  const before = [{ name: "Ảnh gỗ — 13×18", quantity: 2, unitPrice: 35000 }];
  const after = [{ name: "Ảnh gỗ — 20×30", quantity: 1, unitPrice: 70000 }];
  assert.match(itemChangeNote(before, after, true) ?? "", /2× Ảnh gỗ — 13×18 35\.000đ thành 1× Ảnh gỗ — 20×30 70\.000đ/);
  assert.equal((itemChangeNote(before, after, false) ?? "").includes("35"), false);
  assert.equal(itemChangeNote(before, before, true), null);
  const priced = [{ name: "Ảnh gỗ — 13×18", quantity: 2, unitPrice: 40000 }];
  assert.equal(itemChangeNote(before, priced, false), "Đổi giá bán");
  assert.match(itemChangeNote(before, priced, true) ?? "", /40\.000đ/);
});

test("chưa ép, bo, tem và ảnh gói thì không sang giao", () => {
  assert.equal(packReady({ ep: true, bo: true, tem: true }, true), true);
  assert.equal(packReady({ ep: true, bo: true, tem: false }, true), false);
  assert.equal(packReady({ ep: true, bo: true, tem: true }, false), false);
  assert.equal(hasPackingPhoto([{ kind: "packing_photo", status: "complete", deletedAt: null }]), true);
  assert.equal(hasPackingPhoto([{ kind: "packing_photo", status: "complete", deletedAt: "2026-10-19" }]), false);
  assert.equal(needsPackCheck("dong_goi", "giao"), true);
  assert.equal(needsPackCheck("in", "xong"), true);
  assert.equal(needsPackCheck("giao", "xong"), false);
  const blocked = statusChangeError({
    role: "production",
    ownerOverride: false,
    current: "dong_goi",
    next: "giao",
    depositRequired: 0,
    depositPaid: 0,
    packReady: false,
  });
  assert.match(blocked ?? "", /ảnh gói/);
  assert.equal(
    statusChangeError({
      role: "owner",
      ownerOverride: true,
      current: "dong_goi",
      next: "giao",
      depositRequired: 0,
      depositPaid: 0,
      packReady: false,
    }),
    null,
  );
});

test("báo đơn sàn mới và đơn trễ, không báo đơn đã giao", () => {
  const now = Date.parse("2026-10-19T10:00:00.000Z");
  const alerts = deskAlerts(
    [
      { code: "A", channel: "tiktok", status: "nhan_don", createdAt: "2026-10-19T08:00:00.000Z", customerName: "Lan", late: false },
      { code: "B", channel: "shopee", status: "in", createdAt: "2026-10-17T08:00:00.000Z", customerName: "Hùng", late: true },
      { code: "C", channel: "tiktok", status: "giao", createdAt: "2026-10-19T09:00:00.000Z", customerName: "Mai", late: false },
      { code: "D", channel: "tai_tiem", status: "nhan_don", createdAt: "2026-10-19T09:00:00.000Z", customerName: "An", late: false },
    ],
    now,
  );
  assert.deepEqual(
    alerts.map((item) => item.code),
    ["A", "B"],
  );
  assert.equal(alerts[0]?.kind, "san");
  assert.equal(alerts[1]?.kind, "tre");
  assert.equal(feedbackOpensReprint("dung_y"), false);
  assert.equal(feedbackOpensReprint("sai_mau"), true);
});
