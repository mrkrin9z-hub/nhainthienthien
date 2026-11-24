import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Banknote, Check, CheckCircle2, Copy, MessageCircle, ChevronDown, ChevronUp, ImagePlus, Loader2, MapPin, Minus, Plus, Store, Trash2, Truck, X } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { ImagePlaceholder, Stepper } from "@/components/site/shop-ui";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sheetOptionLabel, sizeChoices, sizeSummary } from "@/domain/catalog-label";
import { ChoiceChip } from "@/components/site/choice-chip";
import { photoLimitLabel } from "@/domain/order-upload";
import { catalogQueryOptions, publicConfigQueryOptions, type CatalogProduct } from "@/lib/catalog.functions";
import { postFormWithProgress, putDriveFile } from "@/lib/drive-put";
import { createOrder, createUploadTickets, finishOrderDriveUpload, prepareOrderDriveUpload, submitOrder } from "@/lib/orders.functions";
import { preparePhoto } from "@/lib/compress-image";
import { UploadOverlay, type UploadPhase } from "@/components/site/upload-overlay";
import { lineAmount } from "@/domain/calc";
import { BRAND, formatVnd } from "@/lib/brand";
import { useCart } from "@/lib/cart";
import { needsCustomerPhotos, variantThumb } from "@/lib/product-media";
import { toast } from "sonner";
import { needsDeposit, shipEstimate } from "@/lib/ship-estimate";

export const Route = createFileRoute("/dat-in")({
  validateSearch: (search: Record<string, unknown>): { product?: string; items?: string; mau?: string; src?: "cart" } => {
    const out: { product?: string; items?: string; mau?: string; src?: "cart" } = {};
    if (typeof search["product"] === "string") out.product = search["product"];
    if (typeof search["items"] === "string") out.items = search["items"];
    if (typeof search["mau"] === "string" && search["mau"].trim()) out.mau = search["mau"].trim().slice(0, 500);
    if (search["src"] === "cart") out.src = "cart";
    return out;
  },


  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(catalogQueryOptions),
      context.queryClient.ensureQueryData(publicConfigQueryOptions),
    ]),
  head: () => ({
    meta: [
      { title: "Đặt in online — gửi ảnh 3 bước | Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Chọn sản phẩm, gửi ảnh gốc, rồi nhập số điện thoại và địa chỉ để đặt in tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Đặt in online — Nhà In Thiên Thiên" },
      { property: "og:description", content: "Gửi ảnh đặt in chỉ với 3 bước, nhận mã đơn ngay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderPage,
});

const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

type FileState = {
  key: string;
  file: File;
  status: "pending" | "uploading" | "complete" | "error";
  progress: number;
  fileId?: string;
  message?: string;
};

function parseItems(raw?: string): Record<string, number> {
  if (!raw) return {};
  const out: Record<string, number> = {};
  for (const part of raw.split(",")) {
    const [id, qty] = part.split(":");
    const n = Number(qty);
    if (id && Number.isFinite(n) && n > 0) out[id] = Math.min(500, Math.round(n));
  }
  return out;
}

function OrderPage() {
  const { product: presetSlug, items: presetItems, mau: designText, src } = Route.useSearch();
  const cart = useCart();
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const { data: config } = useSuspenseQuery(publicConfigQueryOptions);
  const maxPhotoBytes = config.maxPhotoBytes;

  const initialQuantities = useMemo(() => parseItems(presetItems), [presetItems]);
  const [tried, setTried] = useState(false);
  const [picking, setPicking] = useState(Object.keys(initialQuantities).length === 0);
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);

  const [activeSlug, setActiveSlug] = useState<string>(presetSlug ?? products[0]?.slug ?? "");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("delivery");
  const [address, setAddress] = useState("");
  const [note, setNote] = useState("");

  const [files, setFiles] = useState<FileState[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneCode, setDoneCode] = useState<string | null>(null);
  const [doneTotal, setDoneTotal] = useState(0);
  const idempotencyKey = useRef(crypto.randomUUID());
  const prepared = useRef(new Map<string, Promise<File>>());

  const activeProduct: CatalogProduct | undefined =
    products.find((p) => p.slug === activeSlug) ?? products[0];

  useEffect(() => {
    if (!presetSlug) return;
    document.getElementById(`sp-${presetSlug}`)?.scrollIntoView({ block: "center" });
  }, [presetSlug]);

  const selected = useMemo(() => {
    const rows: { id: string; label: string; unitPrice: number; quantity: number; product: CatalogProduct; variant: CatalogProduct["variants"][number] }[] = [];
    for (const product of products) {
      for (const variant of product.variants) {
        const qty = quantities[variant.id] ?? 0;
        if (qty > 0) {
          rows.push({
            id: variant.id,
            label: `${product.name} — ${variant.name}`,
            unitPrice: variant.requires_quote ? 0 : (variant.sale_price ?? variant.price ?? 0),
            quantity: qty,
            product,
            variant,
          });
        }
      }
    }
    return rows;
  }, [products, quantities]);

  const subtotal = selected.reduce((sum, r) => sum + (lineAmount(r.unitPrice, r.quantity, r.variant.min_total) ?? r.unitPrice * r.quantity), 0);

  function setQty(variantId: string, next: number) {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, Math.min(500, next)) }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: FileState[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (maxPhotoBytes !== null && file.size > maxPhotoBytes && !file.type.startsWith("image/") && !/\.hei[cf]$/i.test(file.name)) {
        rejected.push(file.name);
        continue;
      }
      next.push({ key: crypto.randomUUID(), file, status: "pending", progress: 0 });
    }
    if (rejected.length && maxPhotoBytes !== null) {
      const limitMb = Math.round(maxPhotoBytes / (1024 * 1024));
      setError(`${rejected.join(", ")} lớn hơn ${limitMb}MB. Nối Google Drive để bỏ giới hạn dung lượng.`);
    }
    setFiles((prev) => [...prev, ...next]);
    // Nén sẵn trong lúc khách điền thông tin để lúc bấm Đặt hàng gửi nhanh hơn.
    for (const item of next) preparedFor(item);
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const contactOk = fullName.trim().length > 1 && phoneDigits.length >= 8 && (fulfillment !== "delivery" || address.trim().length >= 8);
  const missing = !selected.length
    ? "Chọn ít nhất một sản phẩm."
    : fullName.trim().length < 2 || phoneDigits.length < 8
        ? "Nhập họ tên và số điện thoại."
        : fulfillment === "delivery" && address.trim().length < 8
          ? "Nhập địa chỉ nhận hàng."
          : "";
  const shipLines = selected.map((r) => ({ width: r.variant.width, height: r.variant.height, amount: r.unitPrice * r.quantity }));
  const ship = shipEstimate(shipLines, fulfillment);
  const deposit = needsDeposit(shipLines);
  const total = subtotal + ship.fee;
  const needsPhotos = selected.some((r) => needsCustomerPhotos(r.product.slug));
  const showUpload = needsPhotos || files.length > 0;
  const orderNote = [designText, note.trim()].filter(Boolean).join("\n").slice(0, 1000);

  // Đơn đã tạo (giữ lại để bấm thử lại không tạo đơn mới).
  const orderRef = useRef<{ orderId: string; accessToken: string; code: string } | null>(null);
  const submitting = useRef(false);
  const [progress, setProgress] = useState<UploadPhase | null>(null);

  function preparedFor(item: FileState): Promise<File> {
    let job = prepared.current.get(item.key);
    if (!job) {
      job = preparePhoto(item.file).then((r) => r.file);
      prepared.current.set(item.key, job);
    }
    return job;
  }

  async function uploadOne(
    order: { orderId: string; accessToken: string },
    item: FileState,
    fileId: string,
    upload: File,
    report: (loaded: number, total: number) => void,
  ) {
    const mime = upload.type || "image/jpeg";
    if (maxPhotoBytes === null) {
      const session = await prepareOrderDriveUpload({ data: { orderId: order.orderId, accessToken: order.accessToken, fileId } });
      const driveFileId = await putDriveFile(session.uploadUrl, upload, mime, report);
      await finishOrderDriveUpload({ data: { orderId: order.orderId, accessToken: order.accessToken, fileId, driveFileId } });
    } else {
      const body = new FormData();
      body.set("orderId", order.orderId);
      body.set("accessToken", order.accessToken);
      body.set("fileId", fileId);
      body.set("file", upload, upload.name);
      await postFormWithProgress("/api/public/upload", body, report);
    }
    void item;
  }

  function friendly(err: unknown, fallback: string): string {
    const message = err instanceof Error ? err.message : "";
    if (!message) return fallback;
    if (/failed to fetch|networkerror|load failed|network request failed|mạng/i.test(message)) return "Mất kết nối mạng. Kiểm tra mạng rồi bấm thử lại";
    return message;
  }

  async function handleSubmit(opts: { sendLater?: boolean } = {}) {
    if (submitting.current) return; // chặn bấm 2 lần
    setError(null);
    setTried(true);
    if (!selected.length) {
      setError("Vui lòng chọn ít nhất một sản phẩm.");
      return;
    }
    if (!contactOk) {
      setError(fulfillment === "delivery" && address.trim().length < 8 ? "Nhập địa chỉ nhận hàng." : "Nhập họ tên và số điện thoại đúng.");
      return;
    }
    submitting.current = true;
    setBusy(true);
    const pending = files.filter((f) => f.status !== "complete");
    setProgress({ step: "order", done: files.length - pending.length, total: files.length, percent: 0, failed: 0 });
    try {
      let order = orderRef.current;
      if (!order) {
        const created = await createOrder({
          data: {
            fullName,
            phone,
            note: orderNote,
            fulfillment,
            address,
            idempotencyKey: idempotencyKey.current,
            items: selected.map((s) => ({ variantId: s.id, quantity: s.quantity })),
          },
        });
        order = { orderId: created.orderId, accessToken: created.accessToken, code: created.code };
        orderRef.current = order;
      }
      const current = order;

      if (pending.length && !opts.sendLater) {
        setProgress((p) => (p ? { ...p, step: "prepare" } : p));
        // Nén ảnh (đã bắt đầu từ lúc chọn ảnh) rồi gửi.
        const uploads = await Promise.all(pending.map((f) => preparedFor(f)));
        const tooBig = maxPhotoBytes === null ? -1 : uploads.findIndex((u) => u.size > maxPhotoBytes);
        if (tooBig >= 0) throw new Error(`Ảnh ${pending[tooBig]!.file.name} vẫn quá lớn sau khi nén. Vui lòng chọn ảnh khác hoặc gửi qua Messenger.`);

        // Lần đầu: tạo phiếu cho tất cả ảnh trong 1 lần. Ảnh lỗi gửi lại dùng lại phiếu cũ.
        const needTicket = pending.map((f, i) => ({ f, i })).filter(({ f }) => !f.fileId);
        const ids = new Map<string, string>();
        for (const f of pending) if (f.fileId) ids.set(f.key, f.fileId);
        if (needTicket.length) {
          const res = await createUploadTickets({
            data: {
              orderId: current.orderId,
              accessToken: current.accessToken,
              files: needTicket.map(({ i }) => ({ fileName: uploads[i]!.name, mimeType: uploads[i]!.type || "image/jpeg", sizeBytes: uploads[i]!.size })),
            },
          });
          needTicket.forEach(({ f }, n) => ids.set(f.key, res.fileIds[n]!));
          setFiles((prev) => prev.map((x) => (ids.has(x.key) ? { ...x, fileId: ids.get(x.key)! } : x)));
        }

        const totalBytes = uploads.reduce((sum, u) => sum + u.size, 0) || 1;
        const loadedBy = new Map<string, number>();
        let done = files.length - pending.length;
        let failed = 0;
        let firstError: string | null = null;
        const tick = () =>
          setProgress({
            step: "upload",
            done,
            total: files.length,
            failed,
            percent: Math.min(100, Math.round(([...loadedBy.values()].reduce((a, b) => a + b, 0) / totalBytes) * 100)),
          });
        tick();
        let next = 0;
        const worker = async () => {
          while (next < pending.length) {
            const i = next++;
            const item = pending[i]!;
            const upload = uploads[i]!;
            setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, status: "uploading" as const, progress: 0, message: "" } : f)));
            try {
              await uploadOne(current, item, ids.get(item.key)!, upload, (loaded, total) => {
                loadedBy.set(item.key, Math.round((loaded / Math.max(1, total)) * upload.size));
                setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, progress: Math.min(100, Math.round((loaded / Math.max(1, total)) * 100)) } : f)));
                tick();
              });
              loadedBy.set(item.key, upload.size);
              done += 1;
              setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, status: "complete", progress: 100 } : f)));
            } catch (err) {
              failed += 1;
              loadedBy.set(item.key, 0);
              const message = friendly(err, "Không tải được ảnh.");
              firstError = firstError ?? message;
              setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, status: "error", message } : f)));
            }
            tick();
          }
        };
        await Promise.all(Array.from({ length: Math.min(2, pending.length) }, worker));
        if (failed) {
          setProgress({ step: "error", done, total: files.length, failed, percent: 100, message: firstError ?? undefined });
          return;
        }
      }

      setProgress((p) => (p ? { ...p, step: "finish", percent: 100 } : p));
      await submitOrder({ data: { orderId: current.orderId, accessToken: current.accessToken, ...(opts.sendLater ? { sendLater: true } : {}) } });
      setDoneTotal(total);
      setDoneCode(current.code);
      setProgress(null);
      if (src === "cart") cart.clear();
    } catch (err) {
      const message = friendly(err, "Có lỗi, vui lòng thử lại.");
      setProgress((p) => ({ step: "error", done: p?.done ?? 0, total: files.length, failed: p?.failed ?? 0, percent: p?.percent ?? 0, message, orderOnly: !orderRef.current }));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  if (doneCode) {
    return <OrderDone code={doneCode} total={doneTotal} phone={phone} zalo={config.zalo} />;
  }

  const bad = (ok: boolean) => (tried && !ok ? "border-sale" : "");

  return (
    <div className="shop-ui min-h-screen bg-shop-bg pb-28 md:pb-24">
      <SiteHeader back title="Thanh toán" hideTabs />
      <main className="mx-auto max-w-4xl space-y-3 px-2.5 pt-2.5 md:px-6 md:pt-5">
        <h1 className="hidden text-xl tracking-tight text-[#123047] md:block">Thanh toán</h1>

        {/* Nhận hàng */}
        <section className="card p-3.5 md:p-5">
          <h2 className="flex items-center gap-2 text-[15px] text-[#123047]">
            <span className="grid size-8 place-items-center rounded-xl bg-[#fff3e0] text-sale"><MapPin className="size-4" aria-hidden /></span> Thông tin nhận hàng
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Họ và tên</Label>
              <Input id="name" className={`h-11 ${bad(fullName.trim().length > 1)}`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tel">Số điện thoại</Label>
              <Input id="tel" className={`h-11 ${bad(phoneDigits.length >= 8)}`} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            </div>
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2" role="radiogroup" aria-label="Hình thức nhận hàng">
            {(
              [
                ["delivery", "Giao hàng tận nơi", Truck],
                ["pickup", "Nhận tại tiệm", Store],
              ] as const
            ).map(([value, label, Icon]) => (
              <button
                key={value}
                type="button"
                role="radio"
                aria-checked={fulfillment === value}
                onClick={() => setFulfillment(value)}
                className={`flex min-h-11 items-center justify-center gap-1.5 whitespace-nowrap rounded-2xl px-2 text-[13px] transition-[background-color,box-shadow,color] ${
                  fulfillment === value ? "bg-[#fff3e0] font-semibold text-sale shadow-[0_0_0_1.5px_var(--sale)]" : "bg-[#f3f6fa] text-[#123047]/80"
                }`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          {fulfillment === "delivery" ? (
            <div className="mt-3 space-y-1">
              <Label htmlFor="addr">Địa chỉ nhận hàng</Label>
              <Textarea id="addr" className={`${bad(address.trim().length >= 8)}`} placeholder="Số nhà, đường, phường/xã, tỉnh/thành" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
          ) : (
            <p className="mt-3 rounded-2xl bg-[#f3f6fa] px-3 py-2.5 text-xs text-foreground/80">
              Nhận tại: {BRAND.address}. {config.hours ? `Mở cửa ${config.hours}.` : ""}
            </p>
          )}
        </section>

        {/* Sản phẩm */}
        <section className="card overflow-hidden">
          <div className="flex items-center gap-2 border-b border-[#123047]/6 px-3.5 py-3 md:px-5">
            <Store className="size-4 text-brand-blue" aria-hidden />
            <span className="text-sm font-semibold">Nhà In Thiên Thiên</span>
          </div>
          {selected.length ? (
            <ul className="divide-y divide-[#123047]/6">
              {selected.map((row) => {
                const thumb = variantThumb(row.product, row.variant);
                return (
                  <li key={row.id} className="flex gap-3 px-3.5 py-3 md:px-5">
                    {thumb ? (
                      <img src={thumb} alt="" width={64} height={64} className="size-16 shrink-0 rounded-xl object-cover shadow-[0_0_0_1px_rgb(18_48_71/0.06)]" />
                    ) : (
                      <ImagePlaceholder className="size-16 shrink-0 rounded-xl" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-foreground">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">Phân loại: {row.variant.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-sm font-bold text-sale">{row.unitPrice ? formatVnd(row.unitPrice) : "Liên hệ"}</span>
                        <div className="flex items-center gap-1">
                          <Stepper small min={1} value={row.quantity} onChange={(n) => setQty(row.id, n)} />
                          <button type="button" aria-label="Bỏ sản phẩm" onClick={() => setQty(row.id, 0)} className="grid size-7 place-items-center text-muted-foreground">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className={`px-3 py-4 text-sm md:px-5 ${tried ? "text-sale" : "text-muted-foreground"}`}>Chưa chọn sản phẩm nào.</p>
          )}
          {designText ? (
            <p className="border-t border-[#123047]/6 px-3.5 py-2 text-xs text-foreground/80 md:px-5">{designText}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-[#123047]/6 py-3 text-sm font-semibold text-brand-blue hover:bg-[#f6f9fc]"
          >
            {picking ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
            {picking ? "Thu gọn" : "Thêm sản phẩm"}
          </button>
          {picking ? (
            <div className="space-y-2 border-t border-[#123047]/6 bg-[#f6f8fb] p-2">
              {products.map((product) => {
                const open = product.slug === activeProduct?.slug;
                return (
                  <div key={product.id} id={`sp-${product.slug}`} className="scroll-mt-24 rounded-2xl bg-white shadow-[0_0_0_1px_rgb(18_48_71/0.05)]">
                    <button type="button" onClick={() => setActiveSlug(product.slug)} className="flex min-h-14 w-full items-center gap-3 p-2 text-left">
                      {variantThumb(product, product.variants[0] ?? { width: null, height: null }) ? (
                        <img src={variantThumb(product, product.variants[0] ?? { width: null, height: null }) ?? ""} alt="" width={48} height={48} className="size-12 shrink-0 rounded-xl object-cover" />
                      ) : (
                        <ImagePlaceholder className="size-12 shrink-0 rounded-xl" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{sizeSummary(product.variants)}</span>
                      </span>
                      <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open ? (
                      <div className="border-t border-[#123047]/6 p-2">
                        <ProductOptions product={product} quantities={quantities} setQty={setQty} />
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          ) : null}
        </section>

        {/* Gửi ảnh */}
        {showUpload ? (
        <section className="card p-3.5 md:p-5">
          <h2 className="text-[15px] text-[#123047]">
            Ảnh cần in <span className="font-normal text-muted-foreground">(không bắt buộc)</span>
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gửi ảnh gốc từ điện thoại. JPG, PNG, WEBP, HEIC — {maxPhotoBytes === null ? "không giới hạn dung lượng và số lượng" : photoLimitLabel(maxPhotoBytes)}.
            {" "}Có thể gửi ảnh sau qua Zalo/Messenger của shop.
          </p>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {files.map((f) => (
              <li key={f.key} className="relative overflow-hidden rounded-xl bg-white text-xs shadow-[0_0_0_1px_rgb(18_48_71/0.08)]">
                <LocalPhotoThumb file={f.file} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label="Xóa ảnh"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                  className="glass-dark absolute right-1 top-1 grid size-6 place-items-center rounded-full"
                >
                  <X className="size-3.5" />
                </button>
                {f.status === "uploading" ? (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                    <div className="h-full bg-sale transition-[width]" style={{ width: `${f.progress}%` }} />
                  </div>
                ) : null}
                {f.status === "complete" ? <CheckCircle2 className="absolute bottom-1 right-1 size-4 rounded-full bg-white text-brand-blue" /> : null}
                {f.status === "error" ? <AlertCircle className="absolute bottom-1 right-1 size-4 rounded-full bg-white text-destructive" /> : null}
              </li>
            ))}
            <li>
              <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-xl border-[1.5px] border-dashed border-brand-blue/45 bg-[#f3f8fd] text-center text-[11px] font-semibold text-brand-blue transition-colors hover:bg-brand-blue-soft`}>
                <ImagePlus className="size-6" aria-hidden />
                Thêm ảnh
                <input type="file" multiple accept={ACCEPT} className="hidden" onChange={(e) => addFiles(e.target.files)} />
              </label>
            </li>
          </ul>
          {files.some((f) => f.message) ? (
            <p className="mt-2 text-xs text-destructive">{files.find((f) => f.message)?.message}</p>
          ) : null}
        </section>
        ) : null}

        {/* Ghi chú */}
        <section className="card p-3.5 md:p-5">
          <Label htmlFor="note" className="text-[15px] font-semibold text-[#123047]">Lời nhắn cho shop</Label>
          <Textarea id="note" className="mt-2" placeholder={selected.some((r) => r.product.slug.startsWith("thoi-khoa-bieu")) ? "Tên, lớp của bé in trên thời khóa biểu, màu viền…" : "Ví dụ: cắt ảnh theo chiều dọc, chỉnh sáng…"} value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        {/* Vận chuyển + thanh toán */}
        <section className="card divide-y divide-[#123047]/6">
          <div className="flex items-start gap-2 px-3 py-3 md:px-5">
            <Truck className="mt-0.5 size-4 shrink-0 text-brand-blue" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-foreground">Phương thức vận chuyển</p>
              <p className="text-xs text-muted-foreground">
                {fulfillment === "pickup"
                  ? "Nhận tại tiệm: 0đ"
                  : ship.fee === 0
                    ? `Đơn từ ${formatVnd(ship.freeFrom)}: 0đ phí ship`
                    : `Phí ship ${formatVnd(ship.base)}. Mua thêm ${formatVnd(ship.freeFrom - subtotal)} để được freeship.`}
              </p>
            </div>
            <span className="shrink-0 text-sm">{formatVnd(ship.fee)}</span>
          </div>
          <div className="flex items-start gap-2 px-3 py-3 md:px-5">
            <Banknote className="mt-0.5 size-4 shrink-0 text-sale" aria-hidden />
            <div className="min-w-0 flex-1 text-sm">
              <p className="text-foreground">Phương thức thanh toán</p>
              <p className="text-xs text-muted-foreground">
                {fulfillment === "delivery" ? "Thanh toán khi nhận hàng (COD)" : "Tiền mặt hoặc chuyển khoản tại tiệm"}
              </p>
              {deposit ? (
                <p className="mt-1.5 rounded-xl bg-[#fff3e0] px-2.5 py-1.5 text-xs text-[#9a4508]">
                  Đơn từ 300.000đ hoặc có ảnh từ 40×60 trở lên cần cọc 50% ({formatVnd(Math.round(subtotal / 2))}) trước khi làm hàng. Tiệm sẽ báo cách chuyển cọc.
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5 px-3 py-3 text-sm md:px-5">
            <p className="font-semibold text-[#123047]">Chi tiết thanh toán</p>
            <p className="flex justify-between text-muted-foreground">
              <span>Tổng tiền hàng</span>
              <span>{formatVnd(subtotal)}</span>
            </p>
            <p className="flex justify-between text-muted-foreground">
              <span>Phí vận chuyển (dự kiến)</span>
              <span>{formatVnd(ship.fee)}</span>
            </p>
            <p className="flex justify-between text-base">
              <span>Tổng thanh toán</span>
              <span className="text-lg font-extrabold tracking-tight text-sale">{formatVnd(total)}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Tiệm xác nhận lại phí ship trên đơn. Chính sách xem tại trang <Link to="/chinh-sach" className="text-sale underline">Chính sách</Link>.</p>
          </div>
        </section>
        {error ? <p className="card px-3.5 py-3 text-sm font-semibold text-destructive">{error}</p> : null}
      </main>

      {progress ? (
        <UploadOverlay
          phase={progress}
          busy={busy}
          onRetry={() => void handleSubmit()}
          onSendLater={orderRef.current ? () => void handleSubmit({ sendLater: true }) : undefined}
          onClose={() => setProgress(null)}
          messengerUrl={BRAND.messengerUrl}
        />
      ) : null}

      <div className="site-sticky-bottom glass-bar fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
        <div className="mx-auto flex max-w-4xl items-center gap-3 px-3 md:px-6">
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-foreground">
              Tổng thanh toán <span className="text-lg font-extrabold tracking-tight text-sale">{formatVnd(total)}</span>
            </p>
            {tried && missing ? <p className="text-[11px] text-sale">{missing}</p> : null}
          </div>
          <button
            type="button"
            onClick={() => {
              setTried(true);
              if (!missing) void handleSubmit();
            }}
            disabled={busy}
            data-ripple
            className="btn-cta relative flex min-h-12 shrink-0 items-center gap-1.5 overflow-hidden px-7 text-sm disabled:opacity-60 md:px-12"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Đặt hàng
          </button>
        </div>
      </div>
    </div>
  );
}

function ProductOptions({
  product,
  quantities,
  setQty,
}: {
  product: CatalogProduct;
  quantities: Record<string, number>;
  setQty: (variantId: string, next: number) => void;
}) {
  const choices = useMemo(() => sizeChoices(product.variants), [product]);
  const [sizeKey, setSizeKey] = useState(() => {
    const picked = choices.find((choice) => choice.variants.some((variant) => (quantities[variant.id] ?? 0) > 0));
    return picked?.key ?? choices[0]?.key ?? "";
  });
  const choice = choices.find((item) => item.key === sizeKey) ?? choices[0];
  const showOptions = (choice?.variants.length ?? 0) > 1;
  if (!choice) return null;

  return (
    <div>
      <p className="text-sm font-semibold text-foreground">Chọn kích thước</p>
      <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn kích thước">
        {choices.map((item) => {
          const picked = item.variants.reduce((sum, variant) => sum + (quantities[variant.id] ?? 0), 0);
          const only = item.variants.length === 1 ? item.variants[0] : undefined;
          const onlyPrice = only && !only.requires_quote ? (only.sale_price ?? only.price) : null;
          return (
            <ChoiceChip
              key={item.key}
              active={item.key === choice.key}
              title={item.label}
              {...(only
                ? { detail: onlyPrice == null ? "Liên hệ" : formatVnd(onlyPrice) }
                : picked > 0
                  ? { detail: `Đã chọn ${picked}` }
                  : {})}
              onClick={() => setSizeKey(item.key)}
            />
          );
        })}
      </div>
      {showOptions ? <p className="mt-4 text-sm font-semibold text-foreground">Chọn số tấm</p> : null}
      <ul className={showOptions ? "mt-2 space-y-2" : "mt-3 space-y-2"}>
        {choice.variants.map((variant) => {
          const qty = quantities[variant.id] ?? 0;
          const amount = variant.requires_quote ? null : (variant.sale_price ?? variant.price);
          const line = amount == null || qty <= 0 ? amount : (lineAmount(amount, qty, variant.min_total) ?? amount * qty);
          return (
            <li key={variant.id} className="flex items-center justify-between gap-3 rounded-2xl bg-[#f6f8fb] px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {showOptions ? sheetOptionLabel(variant.sheets) : variant.name}
                </span>
                <span className="block text-xs font-semibold text-sale">
                  {amount == null ? "Liên hệ báo giá" : qty > 0 ? formatVnd(line ?? amount) : formatVnd(amount)}
                </span>
                {variant.min_total ? <span className="block text-[11px] text-muted-foreground">Tối thiểu {formatVnd(variant.min_total)}</span> : null}
              </span>
              <div className="flex shrink-0 items-center rounded-full bg-white shadow-[0_0_0_1px_rgb(18_48_71/0.08)]">
                <button
                  type="button"
                  aria-label={`Giảm ${showOptions ? sheetOptionLabel(variant.sheets) : variant.name}`}
                  className="grid size-11 place-items-center bg-muted text-foreground"
                  onClick={() => setQty(variant.id, qty - 1)}
                >
                  <Minus className="size-4" />
                </button>
                <span className={`w-8 text-center text-sm font-bold ${qty === 0 ? "text-muted-foreground" : "text-foreground"}`}>{qty}</span>
                <button
                  type="button"
                  aria-label={`Tăng ${showOptions ? sheetOptionLabel(variant.sheets) : variant.name}`}
                  className="grid size-11 place-items-center bg-muted text-foreground"
                  onClick={() => setQty(variant.id, qty + 1)}
                >
                  <Plus className="size-4" />
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/** Chép tin nhắn vào bộ nhớ tạm. Có cách dự phòng cho trình duyệt cũ. */
function copyText(text: string): boolean {
  try {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* thử cách dưới */
  }
  try {
    const area = document.createElement("textarea");
    area.value = text;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand("copy");
    area.remove();
    return ok;
  } catch {
    return false;
  }
}

function OrderDone({ code, total, phone, zalo }: { code: string; total: number; phone: string; zalo: string }) {
  const totalText = formatVnd(total);
  const message = `Chào shop, em đã đặt đơn hàng mã ${code} trị giá ${totalText}. Shop xác nhận giúp em nhé!`;
  // Nút Zalo chỉ hiện khi Cài đặt có số Zalo và đang bật "Hiện số Zalo trên web". Chưa có thì dùng Messenger.
  const viaZalo = Boolean(zalo);
  const chatUrl = viaZalo ? zalo : BRAND.messengerUrl;
  const chatLabel = viaZalo ? "Nhắn Zalo cho shop" : "Nhắn Messenger cho shop";

  function copyOrder() {
    if (copyText(`Mã đơn ${code} · ${totalText}`)) toast.success("Đã chép mã đơn");
  }

  return (
    <div className="shop-ui min-h-screen bg-shop-bg">
      <SiteHeader />
      <main className="mx-auto max-w-xl px-3 py-6 md:px-6 md:py-12">
        <div className="card relative overflow-hidden p-5 text-center md:p-8">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-[#e8f1fa] to-transparent" aria-hidden />
          <span className="pop-in relative mx-auto grid size-16 place-items-center rounded-full bg-gradient-to-b from-[#1f74b8] to-[#155e9a] text-white shadow-[0_12px_28px_-12px_rgb(21_94_154/0.9)]">
            <Check className="size-8" strokeWidth={2.5} />
          </span>
          <h1 className="relative mt-3 text-2xl tracking-tight text-[#123047]">Đặt hàng thành công</h1>
          <div className="relative mx-auto mt-4 max-w-sm rounded-2xl bg-[#f3f8fd] p-3.5 text-left shadow-[0_0_0_1px_rgb(21_94_154/0.12)]">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">Mã đơn</p>
                <p className="text-xl font-extrabold tracking-wide text-[#123047]">{code}</p>
              </div>
              <button type="button" onClick={copyOrder} className="btn-ghost flex min-h-10 shrink-0 items-center gap-1 px-3.5 text-sm font-semibold !text-brand-blue">
                <Copy className="size-4" aria-hidden /> Chép
              </button>
            </div>
            <div className="mt-2.5 flex items-baseline justify-between gap-3 border-t border-dashed border-brand-blue/20 pt-2.5">
              <span className="text-xs text-muted-foreground">Tổng thanh toán (dự kiến)</span>
              <span className="text-lg font-extrabold tracking-tight text-sale">{totalText}</span>
            </div>
          </div>
          <p className="mt-4 text-sm text-muted-foreground">
            Nhắn cho shop để được xác nhận đơn nhanh. Tin nhắn có sẵn mã đơn, bạn chỉ cần dán và gửi.
          </p>
          <a
            href={chatUrl}
            target="_blank"
            rel="noopener"
            onClick={() => {
              if (copyText(message)) toast.success(viaZalo ? "Đã chép tin nhắn, dán vào Zalo rồi gửi" : "Đã chép tin nhắn, dán vào Messenger rồi gửi");
            }}
            className={`mt-3 flex min-h-14 w-full items-center justify-center gap-2 rounded-full text-base font-bold ${
              viaZalo ? "bg-[#0068ff] text-white shadow-[0_10px_24px_-12px_rgb(0_104_255/0.9)]" : "btn-cta"
            }`}
          >
            <MessageCircle className="size-5" aria-hidden /> {chatLabel}
          </a>
          <p className="mt-2.5 rounded-2xl bg-[#f3f6fa] px-3.5 py-2.5 text-left text-xs leading-relaxed text-foreground/80">“{message}”</p>
          <p className="mt-3 text-xs text-muted-foreground">Ảnh in chưa gửi? Có thể gửi sau qua Zalo/Messenger của shop.</p>
          <div className="mt-5 grid grid-cols-2 gap-2">
            <Button asChild size="lg" variant="ghost" className="btn-soft h-12">
              <Link to="/tra-cuu" search={{ code, phone }}>Xem đơn hàng</Link>
            </Button>
            <Button asChild size="lg" variant="ghost" className="btn-ghost h-12">
              <Link to="/">Tiếp tục mua sắm</Link>
            </Button>
          </div>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
