import assert from "node:assert/strict";
import test from "node:test";

import { albumFolderParts } from "./drive-path.ts";
import { bytesStillShared } from "./files.ts";
import { albumPhone, customerUploadPath, googleThumbSize, photoLimitLabel, photoTooBig, publicUploadCard, SHARED_UPLOAD_PATH, uploadTokenShape } from "./order-upload.ts";
import type { OrderFile, ShopState } from "./types.ts";

test("mã gửi ảnh là 32 ký tự hex và ra đúng đường dẫn", () => {
  const token = "a".repeat(32);
  assert.equal(uploadTokenShape(token), true);
  assert.equal(customerUploadPath(token), `/gui-anh/${token}`);
  assert.equal(uploadTokenShape(""), false);
  assert.equal(uploadTokenShape("short"), false);
  assert.equal(uploadTokenShape(`${token}zz`), false);
  assert.throws(() => customerUploadPath("khong-phai-ma"), /không hợp lệ/);
  assert.equal(SHARED_UPLOAD_PATH, "/gui-anh");
});

test("album lấy tên là số điện thoại", () => {
  assert.equal(albumPhone("0901 234 567"), "0901234567");
  assert.equal(albumPhone("+84 901 234 567"), "0901234567");
  assert.deepEqual(albumFolderParts("0901234567"), ["Album khách", "0901234567"]);
  assert.throws(() => albumPhone("123"), /chưa đúng/);
});

test("Drive đã nối thì không chặn dung lượng ảnh", () => {
  assert.equal(photoTooBig(2 * 1024 * 1024 * 1024, null), false);
  assert.equal(photoTooBig(11 * 1024 * 1024, 10 * 1024 * 1024), true);
  assert.equal(photoTooBig(10 * 1024 * 1024, 10 * 1024 * 1024), false);
  assert.equal(photoLimitLabel(null), "không giới hạn dung lượng");
  assert.equal(photoLimitLabel(10 * 1024 * 1024), "mỗi ảnh tối đa 10MB");
});

test("mã đơn cho khách thấy người đặt, sản phẩm và ảnh gốc đã gửi", () => {
  const card = publicUploadCard({
    customer: { name: "Lan", phone: "0901234567" },
    order: {
      id: "order-1",
      code: "TT1",
      status: "nhan_don",
      createdAt: "2026-10-18T06:00:00.000Z",
      channel: "tiktok",
      marketplaceCode: "TTS-9",
      fulfillment: "delivery",
      address: "Xuân Lộc",
      customerNote: "In sáng",
      total: 70000,
      items: [{ name: "Ảnh ép gỗ", skuCode: "TG-13x18", quantity: 2, lineTotal: 70000 }],
      files: [
        { id: "old", name: "cu.jpg", status: "complete", kind: "original", createdAt: "2026-10-01T00:00:00.000Z" },
        { id: "new", name: "moi.jpg", status: "complete", kind: "original", createdAt: "2026-10-18T00:00:00.000Z" },
        { id: "gone", name: "xoa.jpg", status: "complete", kind: "original", createdAt: "2026-10-19T00:00:00.000Z", deletedAt: "2026-10-19T01:00:00.000Z" },
        { id: "design", name: "mau.jpg", status: "complete", kind: "design", createdAt: "2026-10-18T02:00:00.000Z" },
        { id: "wait", name: "cho.jpg", status: "uploading", kind: "original", createdAt: "2026-10-18T03:00:00.000Z" },
      ],
    },
  });
  assert.equal(card.customerName, "Lan");
  assert.equal(card.phone, "0901234567");
  assert.equal(card.code, "TT1");
  assert.equal(card.items[0]?.variant, "TG-13x18");
  assert.equal(card.items[0]?.quantity, 2);
  assert.deepEqual(card.photos.map((photo) => photo.id), ["new", "old"]);
  assert.equal(JSON.stringify(card).includes("mau.jpg"), false);
  assert.equal(JSON.stringify(card).includes("drive"), false);
  assert.equal(googleThumbSize("https://lh3.googleusercontent.com/d/abc=s220", 480), "https://lh3.googleusercontent.com/d/abc=s480");
  assert.equal(googleThumbSize("http://evil.example/a=s220", 480), null);
});

test("ảnh gắn đơn vẫn giữ byte khi album còn file", () => {
  const shared: OrderFile = {
    id: "file-1",
    name: "a.jpg",
    mime: "image/jpeg",
    size: 10,
    status: "complete",
    kind: "original",
    storage: "local",
    path: "data/uploads/file-1",
    driveFileId: null,
    createdAt: "2026-10-18T00:00:00.000Z",
    deletedAt: null,
  };
  const copy = { ...shared };
  const state = { orders: [{ files: [shared] }], albums: [{ files: [copy] }] } as ShopState;
  shared.deletedAt = "2026-10-18T01:00:00.000Z";
  assert.equal(bytesStillShared(state, shared), true);
  copy.deletedAt = "2026-10-18T02:00:00.000Z";
  assert.equal(bytesStillShared(state, shared), false);
});
