import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { photoLimitLabel } from "@/domain/order-upload";
import { guessImageMime } from "@/domain/upload-pool";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";
import { keepScreenAwake, uploadOriginalsInPool } from "@/lib/customer-upload";
import { postFormWithProgress } from "@/lib/drive-put";
import { createAlbumTickets, finalizeAlbumUploads, prepareAlbumDriveUpload } from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-anh/")({
  head: () => ({
    meta: [
      { title: "Gửi ảnh | Nhà In Thiên Thiên" },
      { name: "description", content: "Gửi ảnh gốc kèm họ tên và số điện thoại cho Nhà In Thiên Thiên." },
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

function SharedUploadPage() {
  const navigate = useNavigate();
  const config = useQuery(publicConfigQueryOptions);
  const limit = config.data ? config.data.maxPhotoBytes : undefined;
  const direct = limit === null;
  const [customerName, setCustomerName] = useState("");
  const [phone, setPhone] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [donePhone, setDonePhone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);
  const [doneCount, setDoneCount] = useState(0);

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
    if (customerName.trim().length < 2) {
      setError("Nhập họ tên.");
      return;
    }
    if (phone.trim().length < 8) {
      setError("Nhập số điện thoại.");
      return;
    }
    if (!pending.length) {
      setError("Chọn ít nhất một ảnh.");
      return;
    }
    const queue = pending.filter((row) => !(limit != null && row.file.size > limit));
    if (!queue.length) {
      setError("Ảnh lớn hơn mức cho phép.");
      return;
    }
    setBusy(true);
    setError(null);
    setBatchProgress(0);
    setDoneCount(0);
    const releaseWake = await keepScreenAwake();
    try {
      const tickets = await createAlbumTickets({
        data: {
          phone,
          customerName: customerName.trim(),
          files: queue.map((row) => ({
            fileName: row.file.name,
            mimeType: guessImageMime(row.file),
            sizeBytes: row.file.size,
          })),
        },
      });
      const idByKey = new Map(queue.map((row, index) => [row.key, tickets.files[index]!.fileId]));
      const { ok, failed } = await uploadOriginalsInPool({
        items: queue,
        fileIdOf: (item) => idByKey.get(item.key)!,
        direct,
        openSession: (item, fileId) =>
          prepareAlbumDriveUpload({ data: { albumId: tickets.albumId, phone, fileId } }),
        postForm: async (item, fileId, report) => {
          const body = new FormData();
          body.set("albumId", tickets.albumId);
          body.set("phone", phone);
          body.set("fileId", fileId);
          body.set("file", item.file);
          return postFormWithProgress("/api/public/album", body, report) as Promise<Partial<{ driveFileId: string; storage: string; path: string; size: number }>>;
        },
        onStatus: (key, patch) => {
          setRows((current) =>
            current.map((item) => (item.key === key ? { ...item, ...patch, ...(patch.message === undefined ? { message: undefined } : {}) } : item)),
          );
        },
        onProgress: ({ percent, done }) => {
          setBatchProgress(percent);
          setDoneCount(done);
        },
      });
      if (ok.length) {
        await finalizeAlbumUploads({
          data: {
            albumId: tickets.albumId,
            phone,
            files: ok.map((row) => ({
              fileId: row.fileId,
              ...(row.driveFileId ? { driveFileId: row.driveFileId } : {}),
              ...(row.storage ? { storage: row.storage } : {}),
              ...(row.path ? { path: row.path } : {}),
              size: row.size,
            })),
          },
        });
        setDonePhone(tickets.phone);
      }
      if (failed.length) {
        setError(ok.length ? "Một số ảnh chưa lên. Có thể gửi tiếp các ảnh lỗi." : "Chưa gửi được ảnh.");
        return;
      }
      setBatchProgress(100);
      await navigate({
        to: "/gui-anh/phieu",
        search: { album: tickets.albumId, phone: tickets.phone, name: customerName.trim(), count: String(ok.length) },
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa gửi được ảnh.");
    } finally {
      releaseWake();
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
            <p className="mt-1 text-sm text-muted-foreground">
              Nhập họ tên, số điện thoại rồi chọn ảnh gốc. Xưởng xem theo tên và SĐT — chưa cần tạo đơn.
            </p>
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
            <Label htmlFor="customer-name">Họ tên</Label>
            <Input
              id="customer-name"
              className="min-h-12"
              autoComplete="name"
              placeholder="Nguyễn Văn A"
              value={customerName}
              onChange={(event) => setCustomerName(event.target.value)}
            />
          </div>
          <div className="space-y-1">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              className="min-h-12"
              inputMode="tel"
              autoComplete="tel"
              placeholder="090..."
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
            />
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
                <span>Đã tải {doneCount} ảnh gốc</span>
                <span>{batchProgress}%</span>
              </div>
              <div className="h-2.5 overflow-hidden rounded-full bg-background">
                <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${batchProgress}%` }} />
              </div>
              <p className="text-xs text-muted-foreground">Giữ máy sáng, đừng khóa màn hình khi đang gửi nhiều ảnh. Ảnh gốc được giữ nguyên để in.</p>
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
