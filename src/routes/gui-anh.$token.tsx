import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2, Loader2, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { uploadTokenShape } from "@/domain/order-upload";
import { acknowledgeCustomerPhotos, createUploadTicket, getUploadTarget } from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-anh/$token")({
  head: () => ({
    meta: [
      { title: "Gửi ảnh đặt in | Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerUploadPage,
});

const MAX_FILES = 30;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

type Row = {
  key: string;
  file: File;
  status: "pending" | "uploading" | "complete" | "error";
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

function CustomerUploadPage() {
  const { token } = Route.useParams();
  const valid = uploadTokenShape(token);
  const target = useQuery({
    queryKey: ["upload-target", token],
    queryFn: () => getUploadTarget({ data: { token } }),
    enabled: valid,
    retry: false,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const limit = target.data?.maxPhotoBytes ?? MAX_FILE_BYTES;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of list) {
      if (rows.length + next.length >= MAX_FILES) break;
      if (file.size > limit) {
        next.push({ key: crypto.randomUUID(), file, status: "error", message: "Ảnh lớn hơn mức cho phép." });
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, status: "pending" });
    }
    setRows((current) => [...current, ...next]);
    setDone(null);
  }

  async function send() {
    const info = target.data;
    if (!info) return;
    const pending = rows.filter((row) => row.status === "pending" || row.status === "error");
    if (!pending.length && !rows.some((row) => row.status === "complete")) {
      setError("Chọn ít nhất một ảnh.");
      return;
    }
    setBusy(true);
    setError(null);
    let failed = false;
    try {
      for (const row of pending) {
        if (row.file.size > limit) {
          failed = true;
          continue;
        }
        setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "uploading", message: undefined } : item)));
        try {
          const mime = guessMime(row.file);
          const ticket = await createUploadTicket({
            data: {
              orderId: info.orderId,
              accessToken: token,
              fileName: row.file.name,
              mimeType: mime,
              sizeBytes: row.file.size,
            },
          });
          const body = new FormData();
          body.set("orderId", info.orderId);
          body.set("accessToken", token);
          body.set("fileId", ticket.fileId);
          body.set("file", row.file);
          const uploaded = await fetch("/api/public/upload", { method: "POST", body });
          if (!uploaded.ok) throw new Error(await uploaded.text());
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "complete" } : item)));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Không tải được ảnh.";
          failed = true;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "error", message } : item)));
        }
      }
      const result = await acknowledgeCustomerPhotos({ data: { orderId: info.orderId, accessToken: token } });
      setDone(result.code);
      if (failed) setError("Một số ảnh chưa lên. Chọn lại ảnh lỗi rồi gửi tiếp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa gửi được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        {!valid ? <p className="font-semibold text-destructive">Mã không còn dùng được.</p> : null}
        {valid && target.isLoading ? <p className="text-muted-foreground">Đang mở đơn…</p> : null}
        {valid && target.isError ? <p className="font-semibold text-destructive">{(target.error as Error).message}</p> : null}
        {target.data ? (
          <section className="glass-card space-y-4 rounded-3xl p-5">
            <div>
              <h1 className="text-2xl text-primary">Gửi ảnh cho đơn {target.data.code}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                {target.data.customerName ? `${target.data.customerName}. ` : ""}
                Chọn ảnh gốc từ máy. Ảnh vào đúng đơn này.
                {target.data.fileCount > 0 ? ` Đơn đã có ${target.data.fileCount} ảnh.` : ""}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WEBP, HEIC — mỗi ảnh tối đa {Math.round(limit / (1024 * 1024))}MB, tối đa {MAX_FILES} ảnh.
              </p>
            </div>
            {done ? (
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="size-5" />
                Đã nhận ảnh cho đơn {done}. Có thể đóng trang.
              </p>
            ) : null}
            <label className="flex min-h-32 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-8 text-center">
              <UploadCloud className="size-8 text-accent" />
              <span className="mt-2 font-semibold">Chọn ảnh gốc</span>
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
                <li key={row.key} className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate">{row.file.name}</span>
                  <span className={row.status === "error" ? "shrink-0 text-destructive" : "shrink-0 text-muted-foreground"}>
                    {row.status === "uploading" ? "Đang gửi" : row.status === "complete" ? "Đã nhận" : row.status === "error" ? row.message || "Lỗi" : "Chờ"}
                  </span>
                </li>
              ))}
            </ul>
            {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
            <Button type="button" className="min-h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90" disabled={busy} onClick={() => void send()}>
              {busy ? <Loader2 className="size-4 animate-spin" /> : null}
              Gửi ảnh
            </Button>
          </section>
        ) : null}
      </main>
    </div>
  );
}
