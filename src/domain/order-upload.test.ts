import assert from "node:assert/strict";
import test from "node:test";

import { albumFolderParts } from "./drive-path.ts";
import { bytesStillShared } from "./files.ts";
import { albumPhone, customerUploadPath, SHARED_UPLOAD_PATH, uploadTokenShape } from "./order-upload.ts";
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
