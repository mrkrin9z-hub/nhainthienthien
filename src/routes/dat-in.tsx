import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, Banknote, CheckCircle2, ChevronDown, ChevronUp, ImagePlus, Loader2, MapPin, Minus, Plus, Store, Trash2, Truck, X } from "lucide-react";

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
import { createOrder, createUploadTicket, finishOrderDriveUpload, markFileStatus, prepareOrderDriveUpload, submitOrder } from "@/lib/orders.functions";
import { BRAND, formatVnd } from "@/lib/brand";
import { useCart } from "@/lib/cart";
import { variantThumb } from "@/lib/product-media";
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
  const idempotencyKey = useRef(crypto.randomUUID());

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

  const subtotal = selected.reduce((sum, r) => sum + r.unitPrice * r.quantity, 0);

  function setQty(variantId: string, next: number) {
    setQuantities((prev) => ({ ...prev, [variantId]: Math.max(0, Math.min(500, next)) }));
  }

  function addFiles(list: FileList | null) {
    if (!list) return;
    const next: FileState[] = [];
    const rejected: string[] = [];
    for (const file of Array.from(list)) {
      if (maxPhotoBytes !== null && file.size > maxPhotoBytes) {
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
  }

  const phoneDigits = phone.replace(/\D/g, "");
  const contactOk = fullName.trim().length > 1 && phoneDigits.length >= 8 && (fulfillment !== "delivery" || address.trim().length >= 8);
  const missing = !selected.length
    ? "Chọn ít nhất một sản phẩm."
    : !files.length
      ? "Thêm ít nhất một ảnh để in."
      : fullName.trim().length < 2 || phoneDigits.length < 8
        ? "Nhập họ tên và số điện thoại."
        : fulfillment === "delivery" && address.trim().length < 8
          ? "Nhập địa chỉ nhận hàng."
          : "";
  const shipLines = selected.map((r) => ({ width: r.variant.width, height: r.variant.height, amount: r.unitPrice * r.quantity }));
  const ship = shipEstimate(shipLines, fulfillment);
  const deposit = needsDeposit(shipLines);
  const total = subtotal + ship.fee;
  const orderNote = [designText, note.trim()].filter(Boolean).join("\n").slice(0, 1000);

  async function handleSubmit() {
    setError(null);
    setTried(true);
    if (!selected.length) {
      setError("Vui lòng chọn ít nhất một sản phẩm.");
      return;
    }
    if (!files.length) {
      setError("Vui lòng chọn ít nhất một ảnh gốc.");
      return;
    }
    if (!contactOk) {
      setError(fulfillment === "delivery" && address.trim().length < 8 ? "Nhập địa chỉ nhận hàng." : "Nhập họ tên và số điện thoại đúng.");
      return;
    }
    setBusy(true);
    try {
      const order = await createOrder({
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

      let uploadError: string | null = null;
      for (const item of files) {
        if (item.status === "complete") continue;
        setFiles((prev) =>
          prev.map((f) => (f.key === item.key ? { ...f, status: "uploading", progress: 0 } : f)),
        );
        const report = (loaded: number, total: number) => {
          const pct = total > 0 ? Math.min(100, Math.round((loaded / total) * 100)) : 0;
          setFiles((prev) => prev.map((f) => (f.key === item.key ? { ...f, progress: pct } : f)));
        };
        try {
          const mime = item.file.type || "image/jpeg";
          const ticket = await createUploadTicket({
            data: {
              orderId: order.orderId,
              accessToken: order.accessToken,
              fileName: item.file.name,
              mimeType: mime,
              sizeBytes: item.file.size,
            },
          });
          if (maxPhotoBytes === null) {
            const session = await prepareOrderDriveUpload({
              data: { orderId: order.orderId, accessToken: order.accessToken, fileId: ticket.fileId },
            });
            const driveFileId = await putDriveFile(session.uploadUrl, item.file, mime, report);
            await finishOrderDriveUpload({
              data: { orderId: order.orderId, accessToken: order.accessToken, fileId: ticket.fileId, driveFileId },
            });
          } else {
            const body = new FormData();
            body.set("orderId", order.orderId);
            body.set("accessToken", order.accessToken);
            body.set("fileId", ticket.fileId);
            body.set("file", item.file);
            await postFormWithProgress("/api/public/upload", body, report);
          }

          await markFileStatus({
            data: {
              orderId: order.orderId,
              accessToken: order.accessToken,
              fileId: ticket.fileId,
              status: "complete",
            },
          });
          setFiles((prev) =>
            prev.map((f) =>
              f.key === item.key ? { ...f, status: "complete", progress: 100, fileId: ticket.fileId } : f,
            ),
          );
        } catch (err) {
          const message = err instanceof Error ? err.message : "Không tải được ảnh.";
          uploadError = uploadError ?? message;
          setFiles((prev) =>
            prev.map((f) =>
              f.key === item.key
                ? { ...f, status: "error", message }
                : f,
            ),
          );
        }
      }

      const result = await submitOrder({
        data: { orderId: order.orderId, accessToken: order.accessToken },
      });
      if (!result.allDone) {
        setError(uploadError ?? "Một số ảnh chưa tải lên được. Vui lòng bấm gửi lại để thử tiếp.");
      } else {
        setDoneCode(order.code);
        if (src === "cart") cart.clear();
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (doneCode) {
    return (
      <div className="shop-ui min-h-screen bg-shop-bg">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-12 text-center md:px-6">
          <div className="rounded-sm bg-white p-6">
            <CheckCircle2 className="mx-auto size-14 text-sale" />
            <h1 className="mt-4 text-2xl text-foreground">Đặt hàng thành công</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Mã đơn của bạn là <strong className="text-foreground">{doneCode}</strong>. Hãy lưu lại để tra cứu tiến trình.
              Tiệm sẽ xem ảnh và báo lại trên đơn.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Button asChild size="lg" className="rounded-sm bg-sale text-white hover:bg-sale/90">
                <Link to="/tra-cuu" search={{ code: doneCode, phone }}>Xem đơn hàng</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-sm">
                <Link to="/">Tiếp tục mua sắm</Link>
              </Button>
            </div>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  const bad = (ok: boolean) => (tried && !ok ? "border-sale" : "");

  return (
    <div className="shop-ui min-h-screen bg-shop-bg pb-28 md:pb-24">
      <SiteHeader back title="Thanh toán" hideTabs />
      <main className="mx-auto max-w-4xl space-y-2 md:px-6 md:pt-4">
        <h1 className="hidden py-2 text-xl text-foreground md:block">Thanh toán</h1>

        {/* Nhận hàng */}
        <section className="bg-white p-3 md:rounded-sm md:p-5">
          <div className="h-1 bg-[repeating-linear-gradient(45deg,var(--sale)_0_12px,transparent_12px_18px,#6fa6d6_18px_30px,transparent_30px_36px)] opacity-80" aria-hidden />
          <h2 className="mt-3 flex items-center gap-1.5 text-sm text-sale">
            <MapPin className="size-4" aria-hidden /> Thông tin nhận hàng
          </h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="name">Họ và tên</Label>
              <Input id="name" className={`h-11 rounded-sm ${bad(fullName.trim().length > 1)}`} value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="tel">Số điện thoại</Label>
              <Input id="tel" className={`h-11 rounded-sm ${bad(phoneDigits.length >= 8)}`} inputMode="tel" autoComplete="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
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
                className={`flex min-h-11 items-center justify-center gap-1.5 rounded-sm border px-3 text-sm ${
                  fulfillment === value ? "border-sale bg-sale-soft text-sale" : "border-border text-foreground/80"
                }`}
              >
                <Icon className="size-4" aria-hidden /> {label}
              </button>
            ))}
          </div>
          {fulfillment === "delivery" ? (
            <div className="mt-3 space-y-1">
              <Label htmlFor="addr">Địa chỉ nhận hàng</Label>
              <Textarea id="addr" className={`rounded-sm ${bad(address.trim().length >= 8)}`} placeholder="Số nhà, đường, phường/xã, tỉnh/thành" value={address} onChange={(e) => setAddress(e.target.value)} autoComplete="street-address" />
            </div>
          ) : (
            <p className="mt-3 rounded-sm bg-shop-bg px-3 py-2 text-xs text-foreground/80">
              Nhận tại: {BRAND.address}. {config.hours ? `Mở cửa ${config.hours}.` : ""}
            </p>
          )}
        </section>

        {/* Sản phẩm */}
        <section className="bg-white md:rounded-sm">
          <div className="flex items-center gap-2 border-b border-border px-3 py-3 md:px-5">
            <Store className="size-4" aria-hidden />
            <span className="text-sm font-semibold">Nhà In Thiên Thiên</span>
          </div>
          {selected.length ? (
            <ul className="divide-y divide-border">
              {selected.map((row) => {
                const thumb = variantThumb(row.product, row.variant);
                return (
                  <li key={row.id} className="flex gap-3 px-3 py-3 md:px-5">
                    {thumb ? (
                      <img src={thumb} alt="" width={64} height={64} className="size-16 shrink-0 border border-border object-cover" />
                    ) : (
                      <ImagePlaceholder className="size-16 shrink-0 border border-border" />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm text-foreground">{row.product.name}</p>
                      <p className="text-xs text-muted-foreground">Phân loại: {row.variant.name}</p>
                      <div className="mt-1 flex items-center justify-between gap-2">
                        <span className="text-sm text-sale">{row.unitPrice ? formatVnd(row.unitPrice) : "Liên hệ"}</span>
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
            <p className="border-t border-border px-3 py-2 text-xs text-foreground/80 md:px-5">{designText}</p>
          ) : null}
          <button
            type="button"
            onClick={() => setPicking((v) => !v)}
            className="flex w-full items-center justify-center gap-1 border-t border-border py-3 text-sm text-sale"
          >
            {picking ? <ChevronUp className="size-4" /> : <Plus className="size-4" />}
            {picking ? "Thu gọn" : "Thêm sản phẩm"}
          </button>
          {picking ? (
            <div className="space-y-2 border-t border-border bg-shop-bg p-2">
              {products.map((product) => {
                const open = product.slug === activeProduct?.slug;
                return (
                  <div key={product.id} id={`sp-${product.slug}`} className="scroll-mt-24 rounded-sm bg-white">
                    <button type="button" onClick={() => setActiveSlug(product.slug)} className="flex min-h-14 w-full items-center gap-3 p-2 text-left">
                      {variantThumb(product, product.variants[0] ?? { width: null, height: null }) ? (
                        <img src={variantThumb(product, product.variants[0] ?? { width: null, height: null }) ?? ""} alt="" width={48} height={48} className="size-12 shrink-0 object-cover" />
                      ) : (
                        <ImagePlaceholder className="size-12 shrink-0" />
                      )}
                      <span className="min-w-0 flex-1">
                        <span className="line-clamp-2 text-sm">{product.name}</span>
                        <span className="block text-xs text-muted-foreground">{sizeSummary(product.variants)}</span>
                      </span>
                      <ChevronDown className={`size-4 shrink-0 text-muted-foreground transition ${open ? "rotate-180" : ""}`} />
                    </button>
                    {open ? (
                      <div className="border-t border-border p-2">
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
        <section className="bg-white p-3 md:rounded-sm md:p-5">
          <h2 className="text-sm text-foreground">Ảnh cần in</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Gửi ảnh gốc từ điện thoại. JPG, PNG, WEBP, HEIC — {maxPhotoBytes === null ? "không giới hạn dung lượng và số lượng" : photoLimitLabel(maxPhotoBytes)}.
          </p>
          <ul className="mt-3 grid grid-cols-4 gap-2 sm:grid-cols-6">
            {files.map((f) => (
              <li key={f.key} className="relative overflow-hidden rounded-sm border border-border bg-white text-xs">
                <LocalPhotoThumb file={f.file} className="aspect-square w-full object-cover" />
                <button
                  type="button"
                  aria-label="Xóa ảnh"
                  onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                  className="absolute right-0 top-0 grid size-6 place-items-center bg-black/45 text-white"
                >
                  <X className="size-3.5" />
                </button>
                {f.status === "uploading" ? (
                  <div className="absolute inset-x-0 bottom-0 h-1.5 bg-black/20">
                    <div className="h-full bg-sale transition-[width]" style={{ width: `${f.progress}%` }} />
                  </div>
                ) : null}
                {f.status === "complete" ? <CheckCircle2 className="absolute bottom-1 right-1 size-4 rounded-full bg-white text-teal-600" /> : null}
                {f.status === "error" ? <AlertCircle className="absolute bottom-1 right-1 size-4 rounded-full bg-white text-destructive" /> : null}
              </li>
            ))}
            <li>
              <label className={`flex aspect-square cursor-pointer flex-col items-center justify-center gap-1 rounded-sm border border-dashed text-center text-[11px] text-sale ${tried && !files.length ? "border-sale bg-sale-soft" : "border-sale/60"}`}>
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

        {/* Ghi chú */}
        <section className="bg-white p-3 md:rounded-sm md:p-5">
          <Label htmlFor="note" className="text-sm">Lời nhắn cho shop</Label>
          <Textarea id="note" className="mt-1 rounded-sm" placeholder="Ví dụ: tên bé in trên thời khóa biểu, cắt ảnh theo chiều dọc…" value={note} onChange={(e) => setNote(e.target.value)} />
        </section>

        {/* Vận chuyển + thanh toán */}
        <section className="divide-y divide-border bg-white md:rounded-sm">
          <div className="flex items-start gap-2 px-3 py-3 md:px-5">
            <Truck className="mt-0.5 size-4 shrink-0 text-teal-700" aria-hidden />
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
                <p className="mt-1 rounded-sm bg-sale-soft px-2 py-1 text-xs text-sale">
                  Đơn từ 300.000đ hoặc có ảnh từ 40×60 trở lên cần cọc 50% ({formatVnd(Math.round(subtotal / 2))}) trước khi làm hàng. Tiệm sẽ báo cách chuyển cọc.
                </p>
              ) : null}
            </div>
          </div>
          <div className="space-y-1.5 px-3 py-3 text-sm md:px-5">
            <p className="font-medium text-foreground">Chi tiết thanh toán</p>
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
              <span className="font-semibold text-sale">{formatVnd(total)}</span>
            </p>
            <p className="text-[11px] text-muted-foreground">Tiệm xác nhận lại phí ship trên đơn. Chính sách xem tại trang <Link to="/chinh-sach" className="text-sale underline">Chính sách</Link>.</p>
          </div>
        </section>
        {error ? <p className="bg-white px-3 py-3 text-sm font-semibold text-destructive md:rounded-sm">{error}</p> : null}
      </main>

      <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
        <div className="mx-auto flex max-w-4xl items-center gap-3 pl-3 md:px-6">
          <div className="min-w-0 flex-1 text-right">
            <p className="text-xs text-foreground">
              Tổng thanh toán <span className="text-lg font-semibold text-sale">{formatVnd(total)}</span>
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
            className="flex min-h-14 shrink-0 items-center gap-1.5 bg-sale px-6 text-sm font-semibold text-white disabled:opacity-60 md:min-h-12 md:rounded-sm md:px-12"
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
          return (
            <li key={variant.id} className="flex items-center justify-between gap-3 rounded-sm border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {showOptions ? sheetOptionLabel(variant.sheets) : variant.name}
                </span>
                <span className="block text-xs font-semibold text-sale">
                  {amount == null ? "Liên hệ báo giá" : formatVnd(amount)}
                </span>
              </span>
              <div className="flex shrink-0 items-center rounded-full border border-border">
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
