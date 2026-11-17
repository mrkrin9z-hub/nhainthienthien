import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { mediaFolderParts, mediaInboxParts, mediaRootParts } from "./drive-path.ts";
import {
  formatMediaBytes,
  MEDIA_KV_MAX_BYTES,
  MEDIA_MAX_BYTES,
  MEDIA_UPLOAD_PATH,
  mediaKindLabel,
  mediaMimeAllowed,
  mediaTooBig,
} from "./media-library.ts";

test("MEDIA nằm dưới NHÀ IN THIÊN THIÊN / MEDIA / Inbox", () => {
  assert.deepEqual(mediaRootParts(), ["NHÀ IN THIÊN THIÊN", "MEDIA"]);
  assert.deepEqual(mediaInboxParts(), ["NHÀ IN THIÊN THIÊN", "MEDIA", "Inbox"]);
  assert.deepEqual(mediaFolderParts(["Video", "Tết"]), ["NHÀ IN THIÊN THIÊN", "MEDIA", "Video", "Tết"]);
  assert.deepEqual(mediaFolderParts(["a/b", "  "]), ["NHÀ IN THIÊN THIÊN", "MEDIA", "a b"]);
});

test("cho phép ảnh video zip, chặn html/js", () => {
  assert.equal(mediaMimeAllowed("image/jpeg"), true);
  assert.equal(mediaMimeAllowed("video/mp4"), true);
  assert.equal(mediaMimeAllowed("application/zip"), true);
  assert.equal(mediaMimeAllowed("text/html"), false);
  assert.equal(mediaMimeAllowed("application/javascript"), false);
  assert.equal(mediaTooBig(0), true);
  assert.equal(mediaTooBig(MEDIA_MAX_BYTES), false);
  assert.equal(mediaTooBig(MEDIA_MAX_BYTES + 1), true);
  assert.equal(MEDIA_KV_MAX_BYTES, 10 * 1024 * 1024);
  assert.match(formatMediaBytes(1536), /KB/);
  assert.equal(mediaKindLabel({ mime: "video/mp4", isFolder: false }), "Video");
  assert.equal(mediaKindLabel({ mime: "x", isFolder: true }), "Thư mục");
  assert.equal(MEDIA_UPLOAD_PATH, "/gui-media");
});

test("admin Media trên slide: Kho source + Feedback; upload không bắt buộc Drive", () => {
  const modules = readFileSync(new URL("../admin-os/modules.ts", import.meta.url), "utf8");
  assert.match(modules, /\/admin\/media/);
  assert.match(modules, /label: "Kho source"/);
  assert.match(modules, /label: "Feedback"/);
  assert.doesNotMatch(modules, /label: "Data"/);
  const page = readFileSync(new URL("../routes/admin.media.tsx", import.meta.url), "utf8");
  assert.match(page, /Kho source/);
  assert.match(page, /MEDIA_UPLOAD_PATH/);
  assert.match(page, /createMediaFolder/);
  assert.match(page, /mode === "drive"/);
  assert.match(page, /SHOP_KV|máy local|Chưa nối Drive/);
  const upload = readFileSync(new URL("../routes/gui-media.tsx", import.meta.url), "utf8");
  assert.match(upload, /preparePublicMediaUpload/);
  assert.match(upload, /mode === "drive"/);
  assert.match(upload, /postServerUpload/);
  const api = readFileSync(new URL("../routes/api/public/media-upload.ts", import.meta.url), "utf8");
  assert.match(api, /saveLocalMediaUpload/);
  const server = readFileSync(new URL("../server/media-library.ts", import.meta.url), "utf8");
  assert.match(server, /saveLocalMediaUpload/);
  assert.match(server, /MEDIA_KV_MAX_BYTES/);
});
