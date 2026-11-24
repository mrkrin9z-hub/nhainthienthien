import assert from "node:assert/strict";
import test from "node:test";

import { applyFinishedUploads, guessImageMime, isRetryableUploadError, mapPool, storedUploadMeta, withUploadRetries } from "./upload-pool.ts";

test("mapPool chạy song song nhưng giữ đúng thứ tự kết quả", async () => {
  const seen: number[] = [];
  let live = 0;
  let maxLive = 0;
  const results = await mapPool([1, 2, 3, 4, 5], 2, async (item) => {
    live += 1;
    maxLive = Math.max(maxLive, live);
    seen.push(item);
    await new Promise((resolve) => setTimeout(resolve, 15));
    live -= 1;
    if (item === 3) throw new Error("lỗi 3");
    return item * 10;
  });
  assert.ok(maxLive <= 2);
  assert.deepEqual(seen.slice().sort(), [1, 2, 3, 4, 5]);
  assert.equal(results[0]?.status, "fulfilled");
  assert.equal(results[0] && results[0].status === "fulfilled" ? results[0].value : null, 10);
  assert.equal(results[2]?.status, "rejected");
  assert.equal(results[4] && results[4].status === "fulfilled" ? results[4].value : null, 50);
});

test("withUploadRetries thử lại lỗi mạng rồi thành công, lỗi khác thì dừng", async () => {
  let n = 0;
  const value = await withUploadRetries(async () => {
    n += 1;
    if (n < 3) throw new Error("Mất kết nối mạng khi tải ảnh");
    return "ok";
  }, 2);
  assert.equal(value, "ok");
  assert.equal(n, 3);

  let m = 0;
  await assert.rejects(
    () =>
      withUploadRetries(async () => {
        m += 1;
        throw new Error("Định dạng ảnh không được hỗ trợ.");
      }, 2),
    /Định dạng/,
  );
  assert.equal(m, 1);
  assert.equal(isRetryableUploadError(new Error("Drive 503")), true);
  assert.equal(isRetryableUploadError(new Error("Định dạng ảnh không được hỗ trợ.")), false);
});

test("applyFinishedUploads chốt nhiều ảnh một lần, bỏ qua file đã xóa", () => {
  const files = [
    { id: "a", status: "uploading", storage: "local", path: "a", size: 1 },
    { id: "b", status: "uploading", storage: "local", path: "b", size: 2, deletedAt: "2026-11-24T00:00:00.000Z" },
    { id: "c", status: "uploading", storage: "local", path: "c", size: 3 },
  ];
  const count = applyFinishedUploads(files, [
    { fileId: "a", driveFileId: "drv-a", size: 111 },
    { fileId: "b", driveFileId: "drv-b", size: 222 },
    { fileId: "c", storage: "kv", path: "upload:c", size: 333 },
  ]);
  assert.equal(count, 2);
  assert.equal(files[0]?.status, "complete");
  assert.equal(files[0]?.driveFileId, "drv-a");
  assert.equal(files[0]?.storage, "drive");
  assert.equal(files[1]?.status, "uploading");
  assert.equal(files[2]?.status, "complete");
  assert.equal(files[2]?.storage, "kv");
  assert.equal(files[2]?.size, 333);
});

test("guessImageMime đọc đuôi khi trình duyệt không gửi type", () => {
  assert.equal(guessImageMime({ name: "a.HEIC", type: "" }), "image/heic");
  assert.equal(guessImageMime({ name: "b.png", type: "image/png" }), "image/png");
});

test("storedUploadMeta giữ id Drive hoặc khóa KV upload:{fileId} để chốt hàng loạt", () => {
  const drive = storedUploadMeta("a", { fileId: "a", driveFileId: "drv-1", size: 10 });
  assert.equal(drive.storage, "drive");
  assert.equal(drive.path, "drv-1");
  const kv = storedUploadMeta("b", { fileId: "b", size: 20 });
  assert.equal(kv.storage, "kv");
  assert.equal(kv.path, "upload:b");
  const named = storedUploadMeta("c", { fileId: "c", storage: "local", path: "data/uploads/x/c", size: 30 });
  assert.equal(named.storage, "local");
  assert.equal(named.path, "data/uploads/x/c");
});
