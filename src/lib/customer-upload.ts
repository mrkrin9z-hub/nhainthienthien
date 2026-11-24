import { postFormWithProgress, putDriveFile, type UploadProgress } from "@/lib/drive-put";
import { UPLOAD_CONCURRENCY, UPLOAD_RETRIES, mapPool, withUploadRetries } from "@/domain/upload-pool";

export type LocalUploadRow = {
  key: string;
  file: File;
};

export type DriveSession = { uploadUrl: string };

export type UploadedOriginal = {
  key: string;
  fileId: string;
  driveFileId?: string;
  size: number;
  storage?: string;
  path?: string;
};

/**
 * Tải nguyên file gốc (không nén, không đổi độ phân giải) theo nhóm 4–6 ảnh.
 * Gặp lỗi mạng thì thử lại file đó, không hủy cả lô.
 */
export async function uploadOriginalsInPool<T extends LocalUploadRow>(opts: {
  items: T[];
  fileIdOf: (item: T) => string;
  direct: boolean;
  openSession: (item: T, fileId: string) => Promise<DriveSession>;
  postForm?: (item: T, fileId: string, report: UploadProgress) => Promise<void | Partial<UploadedOriginal>>;
  onStatus: (key: string, patch: { status: "uploading" | "complete" | "error"; progress?: number; message?: string }) => void;
  onProgress: (info: { percent: number; done: number; failed: number; total: number }) => void;
  concurrency?: number;
}): Promise<{ ok: UploadedOriginal[]; failed: T[] }> {
  const totalBytes = Math.max(1, opts.items.reduce((sum, item) => sum + item.file.size, 0));
  const loadedBy = new Map<string, number>();
  let done = 0;
  let failed = 0;
  const tick = () => {
    const loaded = [...loadedBy.values()].reduce((sum, value) => sum + value, 0);
    opts.onProgress({
      percent: Math.min(100, Math.round((loaded / totalBytes) * 100)),
      done,
      failed,
      total: opts.items.length,
    });
  };
  const ok: UploadedOriginal[] = [];
  const rejected: T[] = [];
  const results = await mapPool(opts.items, opts.concurrency ?? UPLOAD_CONCURRENCY, async (item) => {
    const fileId = opts.fileIdOf(item);
    opts.onStatus(item.key, { status: "uploading", progress: 0, message: undefined });
    const report: UploadProgress = (loaded, total) => {
      const fileLoaded = total > 0 ? Math.min(item.file.size, Math.round((loaded / total) * item.file.size)) : loaded;
      loadedBy.set(item.key, fileLoaded);
      opts.onStatus(item.key, { status: "uploading", progress: Math.min(100, Math.round((fileLoaded / Math.max(item.file.size, 1)) * 100)) });
      tick();
    };
    try {
      let driveFileId: string | undefined;
      let stored: Partial<UploadedOriginal> | void;
      await withUploadRetries(async () => {
        stored = undefined;
        if (opts.direct) {
          const session = await opts.openSession(item, fileId);
          driveFileId = await putDriveFile(session.uploadUrl, item.file, item.file.type || "application/octet-stream", report);
        } else if (opts.postForm) {
          stored = await opts.postForm(item, fileId, report);
          if (stored?.driveFileId) driveFileId = stored.driveFileId;
        } else {
          throw new Error("Thiếu đường tải ảnh.");
        }
      }, UPLOAD_RETRIES);
      loadedBy.set(item.key, item.file.size);
      done += 1;
      opts.onStatus(item.key, { status: "complete", progress: 100 });
      tick();
      ok.push({
        key: item.key,
        fileId,
        size: stored?.size ?? item.file.size,
        ...(driveFileId ? { driveFileId } : {}),
        ...(stored?.storage ? { storage: stored.storage } : {}),
        ...(stored?.path ? { path: stored.path } : {}),
      });
    } catch (error) {
      failed += 1;
      loadedBy.set(item.key, 0);
      rejected.push(item);
      const message = error instanceof Error ? error.message : "Không tải được ảnh.";
      opts.onStatus(item.key, { status: "error", message });
      tick();
    }
  });
  void results;
  return { ok, failed: rejected };
}

export async function keepScreenAwake(): Promise<() => void> {
  const nav = typeof navigator !== "undefined" ? navigator : undefined;
  const wake = nav && "wakeLock" in nav ? (nav as Navigator & { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock : undefined;
  if (!wake) return () => undefined;
  try {
    const lock = await wake.request("screen");
    return () => {
      void lock.release();
    };
  } catch {
    return () => undefined;
  }
}
