import assert from "node:assert/strict";
import test from "node:test";

import { extractVietnamPhone, normalizeChatChannel } from "./shop-chat.ts";

test("bắt SĐT Việt Nam trong tin nhắn", () => {
  assert.equal(extractVietnamPhone("Chị ơi số em 0901 234 567 nhé"), "0901234567");
  assert.equal(extractVietnamPhone("Zalo +84 901.234.567"), "0901234567");
  assert.equal(extractVietnamPhone("không có số"), null);
});

test("chuẩn hóa kênh chat local", () => {
  assert.equal(normalizeChatChannel("messenger"), "messenger");
  assert.equal(normalizeChatChannel("Facebook Comment"), "comment");
  assert.equal(normalizeChatChannel("zalo_oa"), "zalo_oa");
  assert.equal(normalizeChatChannel("manual"), "manual");
});
