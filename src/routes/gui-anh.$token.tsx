import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { CheckCircle2, Loader2, UploadCloud, X } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";
import { photoLimitLabel, uploadTokenShape } from "@/domain/order-upload";
import { formatMaybe } from "@/lib/brand";
import { putDriveFile } from "@/lib/drive-put";
import { acknowledgeCustomerPhotos, createUploadTicket, finishOrderDriveUpload, getUploadTarget, prepareOrderDriveUpload } from "@/lib/orders.functions";

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
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

const STATUS_LABEL: Record<string, string> = {
  draft_upload: "Đang gửi ảnh",
  upload_error: "Lỗi tải ảnh",
  nhan_don: "Đã nhận đơn",
  thiet_ke: "Đang thiết kế",
  cho_duyet: "Chờ khách duyệt",
  in: "Đang in",
  dong_goi: "Đang đóng gói",
  giao: "Đang giao",
  xong: "Hoàn tất",
  huy: "Đã hủy",
};

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", { hour12: false });
}

function channelLabel(channel: string): string {
  return CHANNEL_LABEL[channel as Channel] ?? channel;
}

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
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const limit = target.data ? target.data.maxPhotoBytes : undefined;
  const direct = limit === null;

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of list) {
      if (rows.length + next.length >= MAX_FILES) break;
      if (limit != null && file.size > limit) {
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
        if (limit != null && row.file.size > limit) {
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
          if (direct) {
            const session = await prepareOrderDriveUpload({
              data: { orderId: info.orderId, accessToken: token, fileId: ticket.fileId },
            });
            const driveFileId = await putDriveFile(session.uploadUrl, row.file, mime);
            await finishOrderDriveUpload({
              data: { orderId: info.orderId, accessToken: token, fileId: ticket.fileId, driveFileId },
            });
          } else {
            const body = new FormData();
            body.set("orderId", info.orderId);
            body.set("accessToken", token);
            body.set("fileId", ticket.fileId);
            body.set("file", row.file);
            const uploaded = await fetch("/api/public/upload", { method: "POST", body });
            if (!uploaded.ok) throw new Error(await uploaded.text());
          }
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "complete" } : item)));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Không tải được ảnh.";
          failed = true;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "error", message } : item)));
        }
      }
      const result = await acknowledgeCustomerPhotos({ data: { orderId: info.orderId, accessToken: token } });
      setDone(result.code);
      await target.refetch();
      if (failed) setError("Một số ảnh chưa lên. Chọn lại ảnh lỗi rồi gửi tiếp.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Chưa gửi được.");
    } finally {
      setBusy(false);
    }
  }

  const info = target.data;
  const opened = info?.photos.find((photo) => photo.id === openPhoto) ?? null;

  useEffect(() => {
    if (!opened) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPhoto(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [opened]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-6">
        {!valid ? <p className="font-semibold text-destructive">Mã không còn dùng được.</p> : null}
        {valid && target.isLoading ? <p className="text-muted-foreground">Đang mở đơn…</p> : null}
        {valid && target.isError ? <p className="font-semibold text-destructive">{(target.error as Error).message}</p> : null}
        {info ? (
          <section className="glass-card space-y-5 rounded-3xl p-5">
            <div>
              <h1 className="text-2xl text-primary">Gửi ảnh cho đơn {info.code}</h1>
              <p className="mt-1 text-sm text-muted-foreground">Ảnh vào đúng đơn này. Ảnh đã gửi nằm bên dưới.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WEBP, HEIC{limit === undefined ? "" : ` — ${photoLimitLabel(limit)}`}, tối đa {MAX_FILES} ảnh.
              </p>
            </div>

            <div className="space-y-3 text-sm">
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Khách hàng</h2>
                <p className="mt-1 font-semibold text-foreground">{info.customerName || "Khách"}</p>
                {info.phone ? <p className="text-muted-foreground">{info.phone}</p> : null}
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Đơn hàng</h2>
                <p className="mt-1 font-semibold text-foreground">{info.code}</p>
                <p className="text-muted-foreground">
                  {STATUS_LABEL[info.status] ?? info.status}
                  {info.createdAt ? ` · ${formatWhen(info.createdAt)}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {channelLabel(info.channel)} · {info.fulfillment === "delivery" ? "Giao tận nơi" : "Nhận tại xưởng"}
                </p>
                {info.marketplaceCode ? <p className="text-muted-foreground">Mã trên sàn: {info.marketplaceCode}</p> : null}
                {info.address ? <p className="text-muted-foreground">{info.address}</p> : null}
                {info.customerNote ? <p className="text-muted-foreground">Ghi chú: {info.customerNote}</p> : null}
              </div>
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Sản phẩm</h2>
                <ul className="mt-1 space-y-2">
                  {info.items.map((item, index) => (
                    <li key={`${item.variant}-${index}`} className="flex items-start justify-between gap-3">
                      <span>
                        <span className="block font-semibold text-foreground">{item.name}</span>
                        <span className="text-muted-foreground">
                          {item.variant} × {item.quantity}
                        </span>
                      </span>
                      <span className="shrink-0 font-semibold text-primary">{item.lineTotal === null ? "Liên hệ" : formatMaybe(item.lineTotal)}</span>
                    </li>
                  ))}
                </ul>
                <p className="mt-2 flex justify-between border-t border-border pt-2 font-bold text-foreground">
                  <span>Tạm tính</span>
                  <span className="text-accent">{formatMaybe(info.total) === "—" ? "Liên hệ" : formatMaybe(info.total)}</span>
                </p>
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ảnh đã gửi ({info.photos.length})</h2>
              {info.photos.length ? (
                <ul className="mt-2 grid grid-cols-3 gap-2">
                  {info.photos.map((photo) => (
                    <li key={photo.id}>
                      <button type="button" className="block w-full overflow-hidden rounded-2xl border border-border bg-muted" onClick={() => setOpenPhoto(photo.id)}>
                        <img
                          src={`/api/public/order-photo/${token}/${photo.id}`}
                          alt={photo.name}
                          className="aspect-square w-full object-cover"
                          onError={(event) => {
                            event.currentTarget.style.display = "none";
                          }}
                        />
                        <span className="block truncate px-2 py-1 text-left text-xs text-muted-foreground">{photo.name}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Chưa có ảnh trong đơn.</p>
              )}
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
            <ul className="grid grid-cols-3 gap-2 text-sm">
              {rows.map((row) => (
                <li key={row.key} className="overflow-hidden rounded-2xl border border-border bg-card">
                  <LocalPhotoThumb file={row.file} className="aspect-square w-full object-cover" />
                  <span className="block truncate px-2 pt-1 text-xs">{row.file.name}</span>
                  <span className={`block truncate px-2 pb-2 text-xs ${row.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
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
      {opened ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={opened.name}>
          <button
            type="button"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-background text-foreground"
            onClick={() => setOpenPhoto(null)}
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
          <img
            src={`/api/public/order-photo/${token}/${opened.id}?view=1`}
            alt={opened.name}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
