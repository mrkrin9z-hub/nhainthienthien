import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { formatMediaBytes, MEDIA_KV_MAX_BYTES, MEDIA_MAX_BYTES, mediaMimeAllowed } from "@/domain/media-library";
import { putDriveFile } from "@/lib/drive-put";
import { mapPool, withUploadRetries } from "@/domain/upload-pool";
import { finishPublicMediaUpload, preparePublicMediaUpload } from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-media")({
  head: () => ({
    meta: [
      { title: "Gửi media | Nhà In Thiên Thiên" },
      { name: "description", content: "Gửi ảnh và video source vào kho MEDIA Nhà In Thiên Thiên." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: MediaUploadPage,
});

const ACCEPT = "image/*,video/*,.zip,.rar,application/zip,application/octet-stream";

type Row = {
  key: string;
  file: File;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  message?: string;
};

function guessMime(file: File): string {
  if (file.type) return file.type;
  const name = file.name.toLowerCase();
  if (name.endsWith(".png")) return "image/png";
  if (name.endsWith(".webp")) return "image/webp";
  if (name.endsWith(".heic") || name.endsWith(".heif")) return "image/heic";
  if (name.endsWith(".mp4")) return "video/mp4";
  if (name.endsWith(".mov")) return "video/quicktime";
  if (name.endsWith(".webm")) return "video/webm";
  if (name.endsWith(".zip")) return "application/zip";
  if (name.endsWith(".rar")) return "application/vnd.rar";
  if (/\.(jpe?g)$/.test(name)) return "image/jpeg";
  return "application/octet-stream";
}

async function postServerUpload(
  file: File,
  session: { uploadPath: string; fileName: string; path: string[] },
  report: (loaded: number, total: number) => void,
) {
  await new Promise<void>((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open("POST", session.uploadPath);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) report(event.loaded, event.total);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(xhr.responseText || "Không tải được file."));
    };
    xhr.onerror = () => reject(new Error("Mạng lỗi khi tải file."));
    const body = new FormData();
    body.set("file", file);
    body.set("fileName", session.fileName);
    body.set("path", JSON.stringify(session.path ?? []));
    xhr.send(body);
  });
}

function MediaUploadPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of list) {
      const mime = guessMime(file);
      if (!mediaMimeAllowed(mime)) {
        next.push({ key: crypto.randomUUID(), file, status: "error", progress: 0, message: "Định dạng không hỗ trợ." });
        continue;
      }
      if (file.size > MEDIA_MAX_BYTES) {
        next.push({
          key: crypto.randomUUID(),
          file,
          status: "error",
          progress: 0,
          message: `Tối đa ${formatMediaBytes(MEDIA_MAX_BYTES)}.`,
        });
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, status: "pending", progress: 0 });
    }
    setRows((current) => [...current, ...next]);
    setDone(false);
  }

  async function send() {
    const pending = rows.filter((row) => row.status === "pending" || row.status === "error");
    if (!pending.length) {
      setError("Chọn ít nhất một ảnh hoặc video.");
      return;
    }
    setBusy(true);
    setError(null);
    setBatchProgress(0);
    let failed = false;
    let saved = 0;
    const queue = pending.filter((row) => row.file.size <= MEDIA_MAX_BYTES && mediaMimeAllowed(guessMime(row.file)));
    const totalBytes = Math.max(
      1,
      queue.reduce((sum, row) => sum + row.file.size, 0),
    );
    const loadedBy = new Map<string, number>();
    const sumLoaded = () => [...loadedBy.values()].reduce((a, b) => a + b, 0);
    try {
      await mapPool(pending, 3, async (row) => {
        const mime = guessMime(row.file);
        if (row.file.size > MEDIA_MAX_BYTES || !mediaMimeAllowed(mime)) {
          failed = true;
          return;
        }
        setRows((current) =>
          current.map((item) => {
            if (item.key !== row.key) return item;
            const next: Row = { ...item, status: "uploading", progress: 0 };
            delete next.message;
            return next;
          }),
        );
        const report = (loaded: number, total: number) => {
          const fileLoaded = total > 0 ? Math.min(row.file.size, Math.round((loaded / total) * row.file.size)) : loaded;
          const pct = Math.min(100, Math.round((fileLoaded / Math.max(row.file.size, 1)) * 100));
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, progress: pct } : item)));
          loadedBy.set(row.key, fileLoaded);
          setBatchProgress(Math.min(100, Math.round((sumLoaded() / totalBytes) * 100)));
        };
        try {
          await withUploadRetries(async () => {
            const session = await preparePublicMediaUpload({
              data: { fileName: row.file.name, mimeType: mime, sizeBytes: row.file.size },
            });
            if (session.mode === "drive") {
              const driveFileId = await putDriveFile(session.uploadUrl, row.file, mime, report);
              await finishPublicMediaUpload({ data: { driveFileId } });
            } else {
              await postServerUpload(row.file, session, report);
            }
          });
          loadedBy.set(row.key, row.file.size);
          saved += 1;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "complete", progress: 100 } : item)));
        } catch (err) {
          failed = true;
          const message = err instanceof Error ? err.message : "Không tải được file.";
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "error", message } : item)));
        }
      });
      if (saved) setDone(true);
      if (failed) setError("Một số file chưa lên. Có thể gửi tiếp.");
      if (!saved && failed) setError("Chưa gửi được file.");
      if (!failed) setBatchProgress(100);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-900">
      <SiteHeader />
      <main className="mx-auto max-w-lg space-y-4 px-4 py-6">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Gửi media source</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ảnh và video vào kho MEDIA của tiệm. Có Drive thì vào thư mục Inbox trên Drive; chưa nối Drive thì lưu trên web (tối đa{" "}
            {formatMediaBytes(MEDIA_KV_MAX_BYTES)}/file).
          </p>
        </div>

        <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center">
          <UploadCloud className="size-8 text-primary" />
          <span className="text-sm font-semibold">Chọn ảnh / video / zip</span>
          <input
            type="file"
            accept={ACCEPT}
            multiple
            className="hidden"
            disabled={busy}
            onChange={(event) => {
              addFiles(event.target.files);
              event.target.value = "";
            }}
          />
        </label>

        {rows.length ? (
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.key} className="rounded-xl border bg-white px-3 py-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate font-medium">{row.file.name}</span>
                  <span className="shrink-0 text-xs text-muted-foreground">{formatMediaBytes(row.file.size)}</span>
                </div>
                {row.status === "uploading" ? (
                  <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                    <div className="h-full bg-primary transition-all" style={{ width: `${row.progress}%` }} />
                  </div>
                ) : null}
                {row.status === "complete" ? (
                  <p className="mt-1 flex items-center gap-1 text-xs text-emerald-700">
                    <CheckCircle2 className="size-3.5" /> Đã gửi
                  </p>
                ) : null}
                {row.status === "error" ? <p className="mt-1 text-xs text-destructive">{row.message}</p> : null}
              </li>
            ))}
          </ul>
        ) : null}

        {busy ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" /> Đang tải {batchProgress}%…
          </p>
        ) : null}
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        {done && !error ? <p className="text-sm font-semibold text-emerald-700">Đã gửi xong. Nhân viên lấy trong Media → Kho source.</p> : null}

        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11 flex-1" disabled={busy || !rows.length} onClick={() => void send()}>
            Gửi media
          </Button>
          <Button type="button" variant="outline" className="min-h-11" asChild>
            <Link to="/">Về trang chủ</Link>
          </Button>
        </div>
      </main>
    </div>
  );
}
