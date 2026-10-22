import assert from "node:assert/strict";
import test from "node:test";

import { metaAuthUrl, parseMetaAccountsPayload } from "./meta-oauth.ts";
import { metaPageConnected, parseMetaPageLink, parseMetaWebhook } from "./meta-page.ts";

test("parseMetaPageLink đọc JSON và token legacy", () => {
  const link = parseMetaPageLink(
    JSON.stringify({ pageId: "123", pageName: "Nhà In", pageToken: "EAAx", verifyToken: "v1" }),
  );
  assert.equal(link?.pageId, "123");
  assert.equal(link?.pageName, "Nhà In");
  assert.ok(metaPageConnected(link));
  const legacy = parseMetaPageLink("EAA_legacy_token_abcdefghijklmnop");
  assert.equal(legacy?.pageToken.startsWith("EAA"), true);
  assert.equal(parseMetaPageLink(""), null);
});

test("parseMetaWebhook lấy tin inbound Messenger", () => {
  const rows = parseMetaWebhook({
    object: "page",
    entry: [
      {
        id: "page1",
        time: 1_700_000_000_000,
        messaging: [
          {
            sender: { id: "psid9" },
            timestamp: 1_700_000_000_000,
            message: { mid: "m1", text: "Chào xưởng, in ảnh 20x30" },
          },
          {
            sender: { id: "page1" },
            message: { mid: "m2", text: "echo", is_echo: true },
          },
        ],
      },
    ],
  });
  assert.equal(rows.length, 1);
  assert.equal(rows[0]?.psid, "psid9");
  assert.match(rows[0]?.content ?? "", /20x30/);
});

test("meta OAuth URL và parse danh sách page", () => {
  const url = metaAuthUrl({ appId: "123", redirectUri: "https://nhainthienthien.com/api/admin/meta/callback", state: "abc" });
  assert.match(url, /facebook\.com/);
  assert.match(url, /pages_messaging/);
  assert.match(url, /client_id=123/);
  const pages = parseMetaAccountsPayload({
    data: [
      { id: "p1", name: "Nhà In", access_token: "EAA_token_xxxxxxxxxxxxxxxxxxxx" },
      { id: "bad", name: "x", access_token: "short" },
    ],
  });
  assert.equal(pages.length, 1);
  assert.equal(pages[0]?.id, "p1");
  assert.equal(pages[0]?.name, "Nhà In");
});
