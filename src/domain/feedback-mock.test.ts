import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { FEEDBACK_TEMPLATES, platformLabel } from "./feedback-mock.ts";

test("có mẫu Zalo và Messenger để tạo feedback giả", () => {
  assert.ok(FEEDBACK_TEMPLATES.length >= 4);
  assert.ok(FEEDBACK_TEMPLATES.some((item) => item.draft.platform === "zalo"));
  assert.ok(FEEDBACK_TEMPLATES.some((item) => item.draft.platform === "zalo_classic"));
  assert.ok(FEEDBACK_TEMPLATES.some((item) => item.draft.platform === "messenger"));
  assert.equal(platformLabel("zalo_classic"), "Zalo (header xanh)");
});

test("trang admin feedback-gia xuất JPG kiểu iPhone", () => {
  const page = readFileSync(new URL("../routes/admin.feedback-gia.tsx", import.meta.url), "utf8");
  assert.match(page, /toJpeg/);
  assert.match(page, /FeedbackMockPhone/);
  assert.match(page, /Xuất JPG/);
  assert.match(page, /Chat phía khách/);
  assert.match(page, /Chat phía shop/);
  assert.match(page, /live/);
  const phone = readFileSync(new URL("../components/admin/feedback-mock-phone.tsx", import.meta.url), "utf8");
  assert.match(phone, /feedback-mock-capture/);
  assert.match(phone, /IosKeyboard/);
  assert.match(phone, /contentEditable/);
  assert.match(phone, /VerifiedBadge/);
});
