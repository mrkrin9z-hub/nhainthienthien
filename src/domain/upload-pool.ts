/** Gửi nhiều ảnh cùng lúc trên mạng điện thoại, không chờ từng tấm. */
export const UPLOAD_CONCURRENCY = 5;
export const UPLOAD_RETRIES = 2;

export function isRetryableUploadError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error ?? "");
  return /failed to fetch|networkerror|load failed|network request failed|mạng|chậm quá|abort|timed? out|tải được ảnh lên drive|không mở phiên|508|502|503|504/i.test(
    message,
  );
}

export async function withUploadRetries<T>(fn: () => Promise<T>, retries = UPLOAD_RETRIES): Promise<T> {
  let last: unknown;
  const attempts = Math.max(1, retries + 1);
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await fn();
    } catch (error) {
      last = error;
      if (attempt >= attempts || !isRetryableUploadError(error)) throw error;
      await new Promise((resolve) => setTimeout(resolve, 400 * attempt));
    }
  }
  throw last instanceof Error ? last : new Error("Không tải được ảnh.");
}

/** Chạy tối đa `concurrency` tác vụ cùng lúc, giữ đúng thứ tự kết quả. */
export async function mapPool<T, R>(items: readonly T[], concurrency: number, fn: (item: T, index: number) => Promise<R>): Promise<PromiseSettledResult<R>[]> {
  const results: PromiseSettledResult<R>[] = Array.from({ length: items.length });
  let next = 0;
  const limit = Math.max(1, Math.min(concurrency, items.length || 1));
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      const item = items[index];
      if (item === undefined) continue;
      try {
        const value = await fn(item, index);
        results[index] = { status: "fulfilled", value };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(limit, Math.max(items.length, 1)) }, () => worker()));
  return results;
}


/** Metadata chốt file: Drive thì giữ id; KV thì luôn dùng khóa upload:{fileId} như putPhoto. */
export function storedUploadMeta(fileId: string, row: FinishedUpload, existing?: { size?: number }): FinishedUpload {
  if (row.driveFileId) {
    return {
      fileId,
      driveFileId: row.driveFileId,
      size: row.size,
      storage: row.storage ?? "drive",
      path: row.path ?? row.driveFileId,
    };
  }
  return {
    fileId,
    size: row.size ?? existing?.size,
    storage: row.storage ?? "kv",
    path: row.path ?? `upload:${fileId}`,
  };
}

export type FinishedUpload = {
  fileId: string;
  driveFileId?: string | null;
  size?: number;
  storage?: string;
  path?: string;
};

type UploadSlot = {
  id: string;
  status: string;
  deletedAt?: string | null;
  driveFileId?: string | null;
  storage?: string;
  path?: string;
  size?: number;
};

/** Gắn kết quả tải (Drive/KV) vào danh sách file album/đơn — một lần, không ghi từng tấm. */
export function applyFinishedUploads<T extends UploadSlot>(files: T[], updates: FinishedUpload[], updatedAt?: string): number {
  const byId = new Map(updates.map((row) => [row.fileId, row]));
  let count = 0;
  for (const file of files) {
    if (file.deletedAt) continue;
    const update = byId.get(file.id);
    if (!update) continue;
    if (update.driveFileId) {
      file.driveFileId = update.driveFileId;
      file.storage = update.storage ?? "drive";
      file.path = update.path ?? update.driveFileId;
    } else if (update.storage) {
      file.storage = update.storage;
      if (update.path) file.path = update.path;
    }
    if (typeof update.size === "number" && update.size > 0) file.size = update.size;
    file.status = "complete";
    count += 1;
  }
  void updatedAt;
  return count;
}

export function guessImageMime(file: { name: string; type?: string }): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}
