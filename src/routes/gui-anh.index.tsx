import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { photoLimitLabel } from "@/domain/order-upload";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";
import { postFormWithProgress, putDriveFile } from "@/lib/drive-put";
import { createAlbumTicket, finishAlbumDriveUpload, prepareAlbumDriveUpload } from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-anh/")({
  head: () => ({
    meta: [
      { title: "Gửi ảnh | Nhà In Thiên Thiên" },
      { name: "description", content: "Gửi ảnh gốc kèm số điện thoại cho Nhà In Thiên Thiên." },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: SharedUploadPage,
});

const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

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
  if (name.endsWith(".heic")) return "image/heic";
  if (name.endsWith(".heif")) return "image/heif";
  return "image/jpeg";
}

function SharedUploadPage() {
  const config = useQuery(publicConfigQueryOptions);
  const limit = config.data ? config.data.maxPhotoBytes : undefined;
  const direct = limit === null;
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [donePhone, setDonePhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of list) {
      if (limit != null && file.size > limit) {
        next.push({ key: crypto.randomUUID(), file, status: "error", progress: 0, message: "Ảnh lớn hơn mức cho phép." });
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, status: "pending", progress: 0 });
    }
    setRows((current) => [...current, ...next]);
    setDonePhone(null);
  }

  async function send() {
    const pending = rows.filter((row) => row.status === "pending" || row.status === "error");
    if (phone.trim().length < 8) {
      setError("Nhập số điện thoại.");
      return;
    }
    if (!pending.length) {
      setError("Chọn ít nhất một ảnh.");
      return;
    }
    setBusy(true);
    setError(null);
    setBatchProgress(0);
    let failed = false;
    let savedPhone = "";
    const queue = pending.filter((row) => !(limit != null && row.file.size > limit));
    const totalBytes = Math.max(1, queue.reduce((sum, row) => sum + row.file.size, 0));
    let loadedBytes = 0;
    try {
      for (const row of pending) {
        if (limit != null && row.file.size > limit) {
          failed = true;
          continue;
        }
        setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "uploading", progress: 0, message: undefined } : item)));
        const baseLoaded = loadedBytes;
        const report = (loaded: number, total: number) => {
          const fileLoaded = total > 0 ? Math.min(row.file.size, Math.round((loaded / total) * row.file.size)) : loaded;
          const pct = Math.min(100, Math.round((fileLoaded / Math.max(row.file.size, 1)) * 100));
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, progress: pct } : item)));
          setBatchProgress(Math.min(100, Math.round(((baseLoaded + fileLoaded) / totalBytes) * 100)));
        };
        try {
          const mime = guessMime(row.file);
          const ticket = await createAlbumTicket({
            data: { phone, fileName: row.file.name, mimeType: mime, sizeBytes: row.file.size },
          });
          savedPhone = ticket.phone;
          if (direct) {
            const session = await prepareAlbumDriveUpload({ data: { albumId: ticket.albumId, phone, fileId: ticket.fileId } });
            const driveFileId = await putDriveFile(session.uploadUrl, row.file, mime, report);
            await finishAlbumDriveUpload({ data: { albumId: ticket.albumId, phone, fileId: ticket.fileId, driveFileId } });
          } else {
            const body = new FormData();
            body.set("albumId", ticket.albumId);
            body.set("phone", phone);
            body.set("fileId", ticket.fileId);
            body.set("file", row.file);
            await postFormWithProgress("/api/public/album", body, report);
          }
          loadedBytes += row.file.size;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "complete", progress: 100 } : item)));
        } catch (err) {
          failed = true;
          const message = err instanceof Error ? err.message : "Không tải được ảnh.";
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "error", message } : item)));
        }
      }
      if (savedPhone) setDonePhone(savedPhone);
      if (failed) setError("Một số ảnh chưa lên. Có thể gửi tiếp.");
      if (!savedPhone && failed) setError("Chưa gửi được ảnh.");
      if (!failed) setBatchProgress(100);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        <section className="glass-card space-y-4 rounded-3xl p-5">
          <div>
            <h1 className="text-2xl text-primary">Gửi ảnh cho tiệm</h1>
            <p className="mt-1 text-sm text-muted-foreground">Nhập số điện thoại rồi chọn ảnh gốc. Ảnh vào album mang tên số đó.</p>
            <p className="mt-1 text-xs text-muted-foreground">
              JPG, PNG, WEBP, HEIC — {direct ? "không giới hạn dung lượng và số lượng ảnh" : limit === undefined ? "…" : photoLimitLabel(limit)}.
            </p>
          </div>
          {donePhone ? (
            <p className="flex items-center gap-2 font-semibold text-primary">
              <CheckCircle2 className="size-5" />
              Đã nhận ảnh vào album {donePhone}.
            </p>
          ) : null}
          <div className="space-y-1">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input id="phone" className="min-h-12" inputMode="tel" autoComplete="tel" placeholder="090..." value={phone} onChange={(event) => setPhone(event.target.value)} />
          </div>
          <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-8 text-center">
            <UploadCloud className="size-8 text-accent" />
            <span className="mt-2 font-semibold">Chọn ảnh gốc</span>
            <span className="mt-1 text-xs text-muted-foreground">Không giới hạn số lượng ảnh</span>
            <input
              type="file"
              multiple
              accept={ACCEPT}
              className="hidden"
              onChange={(event) => {
                addFiles(event.target.files);
                event.target.value = "";
              }}
            />
          </label>
          <ul className="space-y-2 text-sm">
            {rows.map((row) => (
              <li key={row.key} className="overflow-hidden rounded-2xl border border-border bg-card p-2">
                <div className="flex gap-3">
                  <LocalPhotoThumb file={row.file} className="size-16 shrink-0 rounded-xl object-cover" />
                  <div className="min-w-0 flex-1">
                    <span className="block truncate text-xs">{row.file.name}</span>
                    {row.status === "uploading" ? (
                      <div className="mt-2 space-y-1">
                        <div className="h-2 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${row.progress}%` }} />
                        </div>
                        <span className="text-xs text-muted-foreground">{row.progress}%</span>
                      </div>
                    ) : (
                      <span className={`block text-xs ${row.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                        {row.status === "complete" ? "Đã nhận" : row.status === "error" ? row.message || "Lỗi" : "Chờ"}
                      </span>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
          {busy ? (
            <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
              <div className="flex justify-between text-sm font-semibold">
                <span>Đang gửi…</span>
                <span>{batchProgress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${batchProgress}%` }} />
              </div>
            </div>
          ) : null}
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          <Button type="button" className="min-h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy} onClick={() => void send()}>
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Gửi ảnh
          </Button>
        </section>
      </main>
    </div>
  );
}
