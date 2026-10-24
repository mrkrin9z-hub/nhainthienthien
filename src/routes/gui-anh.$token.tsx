import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Loader2, PackageSearch, UploadCloud, X } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { OrderMoney } from "@/components/site/order-money";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";
import { photoLimitLabel, uploadKeyShape } from "@/domain/order-upload";
import { publicStatusLabel } from "@/domain/public-status";
import { formatMaybe } from "@/lib/brand";
import { postFormWithProgress, putDriveFile } from "@/lib/drive-put";
import {
  acknowledgeCustomerPhotos,
  createUploadTicket,
  finishOrderDriveUpload,
  getUploadTarget,
  prepareOrderDriveUpload,
  setCustomerComment,
  setCustomerPrint,
} from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-anh/$token")({
  head: () => ({
    meta: [
      { title: "Gửi ảnh đặt in | Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CustomerUploadPage,
});

const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

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
  comment: string;
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

export function CustomerUploadScreen({ token }: { token: string }) {
  const valid = uploadKeyShape(token);
  const target = useQuery({
    queryKey: ["upload-target", token],
    queryFn: () => getUploadTarget({ data: { token } }),
    enabled: valid,
    retry: false,
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ code: string; fileCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const canonicalPath = (target.data as { canonicalPath?: string } | undefined)?.canonicalPath;
  useEffect(() => {
    if (!canonicalPath?.startsWith("/u/")) return;
    if (window.location.pathname === canonicalPath) return;
    window.location.replace(canonicalPath);
  }, [canonicalPath]);
  const [openPhoto, setOpenPhoto] = useState<string | null>(null);
  const [batchProgress, setBatchProgress] = useState(0);
  const [photoNotes, setPhotoNotes] = useState<Record<string, string>>({});
  const limit = target.data ? target.data.maxPhotoBytes : undefined;
  const direct = limit === null;

  useEffect(() => {
    const photos = target.data?.photos;
    if (!photos) return;
    setPhotoNotes((current) => {
      const next = { ...current };
      for (const photo of photos) {
        if (next[photo.id] === undefined) next[photo.id] = photo.comment;
      }
      return next;
    });
  }, [target.data?.photos]);

  const overallLabel = useMemo(() => {
    if (!busy) return null;
    return `Đang gửi… ${batchProgress}%`;
  }, [busy, batchProgress]);

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: Row[] = [];
    for (const file of list) {
      if (limit != null && file.size > limit) {
        next.push({
          key: crypto.randomUUID(),
          file,
          comment: "",
          status: "error",
          progress: 0,
          message: `Ảnh lớn hơn ${photoLimitLabel(limit)}. Nối Google Drive trên admin để bỏ giới hạn dung lượng.`,
        });
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, comment: "", status: "pending", progress: 0 });
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
    setBatchProgress(0);
    let failed = false;
    let completed = 0;
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
          const ticket = await createUploadTicket({
            data: {
              orderId: info.orderId,
              accessToken: token,
              fileName: row.file.name,
              mimeType: mime,
              sizeBytes: row.file.size,
              comment: row.comment,
            },
          });
          if (direct) {
            const session = await prepareOrderDriveUpload({
              data: { orderId: info.orderId, accessToken: token, fileId: ticket.fileId },
            });
            const driveFileId = await putDriveFile(session.uploadUrl, row.file, mime, report);
            await finishOrderDriveUpload({
              data: { orderId: info.orderId, accessToken: token, fileId: ticket.fileId, driveFileId },
            });
          } else {
            const body = new FormData();
            body.set("orderId", info.orderId);
            body.set("accessToken", token);
            body.set("fileId", ticket.fileId);
            body.set("file", row.file);
            await postFormWithProgress("/api/public/upload", body, report);
          }
          loadedBytes += row.file.size;
          completed += 1;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "complete", progress: 100 } : item)));
        } catch (err) {
          const message = err instanceof Error ? err.message : "Không tải được ảnh.";
          failed = true;
          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, status: "error", message } : item)));
        }
      }
      setBatchProgress(failed ? Math.min(99, batchProgress) : 100);
      const result = await acknowledgeCustomerPhotos({ data: { orderId: info.orderId, accessToken: token } });
      await target.refetch();
      if (failed) {
        setError("Một số ảnh chưa lên. Chọn lại ảnh lỗi rồi gửi tiếp.");
        setDone(null);
      } else {
        setDone({ code: result.code, fileCount: result.fileCount || completed });
        setRows([]);
      }
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

  if (done && info) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto w-full max-w-lg px-4 py-12 text-center">
          <CheckCircle2 className="mx-auto size-14 text-accent" />
          <h1 className="mt-4 text-3xl font-extrabold text-primary">Đã nhận ảnh</h1>
          <p className="mt-2 text-muted-foreground">
            Đơn <strong className="text-foreground">{done.code}</strong> đã nhận ảnh. Xưởng sẽ xử lý theo tiến trình trên phiếu.
          </p>
          <OrderMoney total={info.total} depositPaid={info.depositPaid} remain={info.remain} className="mx-auto mt-6 max-w-sm space-y-2 rounded-2xl border border-border/70 bg-card p-4 text-left text-sm" />
          <p className="mt-4 text-sm text-muted-foreground">
            Muốn xem lại đơn, ảnh đã gửi và trạng thái (đã in, đã ship…): vào Tra cứu, nhập SĐT rồi chọn đơn này.
          </p>
          <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
              <Link to="/tra-cuu" search={{ code: done.code, phone: info.phone || "" }}>
                <PackageSearch className="size-4" />
                Tra cứu đơn
              </Link>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={() => {
                setDone(null);
                setError(null);
                setBatchProgress(0);
              }}
            >
              Gửi thêm ảnh
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

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
              <p className="mt-1 text-sm text-muted-foreground">Ảnh vào đúng đơn này. Có thể ghi chú chỉnh sửa từng ảnh.</p>
              <p className="mt-1 text-xs text-muted-foreground">
                JPG, PNG, WEBP, HEIC — {direct ? "không giới hạn dung lượng và số lượng ảnh" : photoLimitLabel(limit ?? null)}.
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
                  {publicStatusLabel(info.status)}
                  {info.createdAt ? ` · ${formatWhen(info.createdAt)}` : ""}
                </p>
                <p className="text-muted-foreground">
                  {channelLabel(info.channel)} · {info.fulfillment === "delivery" ? "Giao hàng" : "Nhận tại tiệm"}
                </p>
                {info.marketplaceCode ? <p className="text-muted-foreground">Mã trên sàn: {info.marketplaceCode}</p> : null}
                {info.address ? <p className="text-muted-foreground">{info.address}</p> : null}
                {info.customerNote ? <p className="text-muted-foreground">Ghi chú: {info.customerNote}</p> : null}
                {info.shipping ? (
                  <p className="text-muted-foreground">
                    Vận chuyển: {[info.shipping.carrier, info.shipping.tracking, info.shipping.carrierStatus].filter(Boolean).join(" · ")}
                  </p>
                ) : null}
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
              </div>
              <div>
                <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">Thanh toán</h2>
                <OrderMoney total={info.total} depositPaid={info.depositPaid} remain={info.remain} />
              </div>
            </div>

            <div>
              <h2 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Ảnh đã gửi ({info.photos.length})</h2>
              {info.photos.length ? (
                <ul className="mt-2 space-y-3">
                  {info.photos.map((photo) => (
                    <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-muted/40">
                      <div className="flex gap-3 p-2">
                        <button type="button" className="shrink-0" onClick={() => setOpenPhoto(photo.id)}>
                          <img
                            src={`/api/public/order-photo/${token}/${photo.id}`}
                            alt={photo.name}
                            className="size-20 rounded-xl object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                        </button>
                        <div className="min-w-0 flex-1 space-y-2">
                          <p className="truncate text-xs text-muted-foreground">{photo.name}</p>
                          <Textarea
                            value={photoNotes[photo.id] ?? photo.comment}
                            rows={2}
                            placeholder="Ghi chú chỉnh sửa ảnh này…"
                            className="min-h-16 text-sm"
                            onChange={(event) => {
                              const comment = event.target.value.slice(0, 500);
                              setPhotoNotes((current) => ({ ...current, [photo.id]: comment }));
                            }}
                            onBlur={() => {
                              const comment = (photoNotes[photo.id] ?? photo.comment).trim();
                              if (comment === photo.comment) return;
                              void setCustomerComment({ data: { token, fileId: photo.id, comment } })
                                .then(() => target.refetch())
                                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không lưu được ghi chú."));
                            }}
                          />
                          <button
                            type="button"
                            className={`rounded-lg px-2 py-1 text-xs font-semibold ${photo.print ? "bg-primary text-primary-foreground" : "text-primary"}`}
                            onClick={() => {
                              void setCustomerPrint({ data: { token, fileId: photo.id, print: !photo.print } })
                                .then(() => target.refetch())
                                .catch((err: unknown) => setError(err instanceof Error ? err.message : "Không lưu được lựa chọn."));
                            }}
                          >
                            {photo.print ? "Đã chọn in" : "In ảnh này"}
                          </button>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="mt-1 text-sm text-muted-foreground">Chưa có ảnh trong đơn.</p>
              )}
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
            <ul className="space-y-3 text-sm">
              {rows.map((row) => (
                <li key={row.key} className="overflow-hidden rounded-2xl border border-border bg-card p-2">
                  <div className="flex gap-3">
                    <LocalPhotoThumb file={row.file} className="size-20 shrink-0 rounded-xl object-cover" />
                    <div className="min-w-0 flex-1 space-y-2">
                      <span className="block truncate text-xs font-medium">{row.file.name}</span>
                      <Textarea
                        value={row.comment}
                        rows={2}
                        disabled={row.status === "uploading" || row.status === "complete"}
                        placeholder="Muốn chỉnh sửa gì? (xóa nền, sáng hơn, crop…)"
                        className="min-h-16 text-sm"
                        onChange={(event) => {
                          const comment = event.target.value.slice(0, 500);
                          setRows((current) => current.map((item) => (item.key === row.key ? { ...item, comment } : item)));
                        }}
                      />
                      {row.status === "uploading" ? (
                        <div className="space-y-1">
                          <div className="h-2 overflow-hidden rounded-full bg-muted">
                            <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${row.progress}%` }} />
                          </div>
                          <p className="text-xs text-muted-foreground">Đang gửi {row.progress}%</p>
                        </div>
                      ) : (
                        <span className={`block text-xs ${row.status === "error" ? "text-destructive" : "text-muted-foreground"}`}>
                          {row.status === "complete" ? "Đã nhận" : row.status === "error" ? row.message || "Lỗi" : "Chờ gửi"}
                        </span>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
            {busy ? (
              <div className="space-y-2 rounded-2xl border border-border bg-muted/40 p-3">
                <div className="flex items-center justify-between text-sm font-semibold">
                  <span>{overallLabel}</span>
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
          <div className="max-h-[90vh] w-full max-w-lg space-y-3">
            <img
              src={`/api/public/order-photo/${token}/${opened.id}?view=1`}
              alt={opened.name}
              className="max-h-[70vh] w-full rounded-2xl object-contain"
            />
            {opened.comment ? <p className="rounded-2xl bg-background/95 p-3 text-sm text-foreground">{opened.comment}</p> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function CustomerUploadPage() {
  const { token } = Route.useParams();
  return <CustomerUploadScreen token={token} />;
}
