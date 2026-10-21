import assert from "node:assert/strict";
import test from "node:test";

import { extractVietnamPhone, printStatusHint } from "../server/studiobase.ts";

test("bắt SĐT Việt Nam trong tin nhắn", () => {
  assert.equal(extractVietnamPhone("Chị ơi số em 0901 234 567 nhé"), "0901234567");
  assert.equal(extractVietnamPhone("Zalo +84 901.234.567"), "0901234567");
  assert.equal(extractVietnamPhone("không có số"), null);
});

test("gợi ý nhãn in ấn từ tên status studio", () => {
  assert.equal(printStatusHint("Đã gửi in"), "Đưa vào máy in");
  assert.equal(printStatusHint("Ngày chụp TBD"), "Ngày nhận / hẹn in");
  assert.equal(printStatusHint("Đang xử lý"), null);
});
