import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { mediaFolderParts, mediaInboxParts, mediaRootParts } from "./drive-path.ts";
import {
  formatMediaBytes,
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
  assert.match(formatMediaBytes(1536), /KB/);
  assert.equal(mediaKindLabel({ mime: "video/mp4", isFolder: false }), "Video");
  assert.equal(mediaKindLabel({ mime: "x", isFolder: true }), "Thư mục");
  assert.equal(MEDIA_UPLOAD_PATH, "/gui-media");
});

test("admin có trang Data và QR gui-media", () => {
  const modules = readFileSync(new URL("../admin-os/modules.ts", import.meta.url), "utf8");
  assert.match(modules, /\/admin\/media/);
  assert.match(modules, /label: "Data"/);
  const page = readFileSync(new URL("../routes/admin.media.tsx", import.meta.url), "utf8");
  assert.match(page, /MEDIA_UPLOAD_PATH/);
  assert.match(page, /createMediaFolder/);
  assert.match(page, /moveMediaItem/);
  const upload = readFileSync(new URL("../routes/gui-media.tsx", import.meta.url), "utf8");
  assert.match(upload, /preparePublicMediaUpload/);
  assert.match(upload, /Inbox/);
});
