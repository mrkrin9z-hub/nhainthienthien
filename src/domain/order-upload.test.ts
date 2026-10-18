import assert from "node:assert/strict";
import test from "node:test";

import { customerUploadPath, uploadTokenShape } from "./order-upload.ts";

test("mã gửi ảnh là 32 ký tự hex và ra đúng đường dẫn", () => {
  const token = "a".repeat(32);
  assert.equal(uploadTokenShape(token), true);
  assert.equal(customerUploadPath(token), `/gui-anh/${token}`);
  assert.equal(uploadTokenShape(""), false);
  assert.equal(uploadTokenShape("short"), false);
  assert.equal(uploadTokenShape(`${token}zz`), false);
  assert.throws(() => customerUploadPath("khong-phai-ma"), /không hợp lệ/);
});
