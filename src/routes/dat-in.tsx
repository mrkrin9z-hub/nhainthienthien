import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus, UploadCloud, X } from "lucide-react";

import { LocalPhotoThumb } from "@/components/photo-thumb";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { sheetOptionLabel, sizeChoices, sizeSummary } from "@/domain/catalog-label";
import { ChoiceChip } from "@/components/site/choice-chip";
import { photoLimitLabel } from "@/domain/order-upload";
import { catalogQueryOptions, publicConfigQueryOptions, type CatalogProduct } from "@/lib/catalog.functions";
import { postFormWithProgress, putDriveFile } from "@/lib/drive-put";
import { createOrder, createUploadTicket, finishOrderDriveUpload, markFileStatus, prepareOrderDriveUpload, submitOrder } from "@/lib/orders.functions";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/dat-in")({
  validateSearch: (search: Record<string, unknown>): { product?: string; items?: string } => {
    const out: { product?: string; items?: string } = {};
    if (typeof search["product"] === "string") out.product = search["product"];
    if (typeof search["items"] === "string") out.items = search["items"];
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
  const { product: presetSlug, items: presetItems } = Route.useSearch();
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const { data: config } = useSuspenseQuery(publicConfigQueryOptions);
  const maxPhotoBytes = config.maxPhotoBytes;

  const initialQuantities = useMemo(() => parseItems(presetItems), [presetItems]);
  const [step, setStep] = useState(Object.keys(initialQuantities).length ? 2 : 1);
  const [quantities, setQuantities] = useState<Record<string, number>>(initialQuantities);

  const [activeSlug, setActiveSlug] = useState<string>(presetSlug ?? products[0]?.slug ?? "");

  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
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
    const rows: { id: string; label: string; unitPrice: number; quantity: number }[] = [];
    for (const product of products) {
      for (const variant of product.variants) {
        const qty = quantities[variant.id] ?? 0;
        if (qty > 0) {
          rows.push({
            id: variant.id,
            label: `${product.name} — ${variant.name}`,
            unitPrice: variant.requires_quote ? 0 : (variant.sale_price ?? variant.price ?? 0),
            quantity: qty,
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
  const canNext = step === 1 ? selected.length > 0 : step === 2 ? files.length > 0 : contactOk;
  const stepHint =
    step === 1 ? "Chọn ít nhất một khổ." : step === 2 ? "Thêm ít nhất một ảnh." : fulfillment === "delivery" && address.trim().length < 8 ? "Nhập địa chỉ nhận hàng." : "Nhập họ tên và số điện thoại.";

  async function handleSubmit() {
    setError(null);
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
          note,
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
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (doneCode) {
    return (
      <div className="min-h-screen bg-background">
        <SiteHeader />
        <main className="mx-auto max-w-xl px-4 py-16 text-center md:px-6">
          <CheckCircle2 className="mx-auto size-14 text-accent" />
          <h1 className="mt-4 text-3xl font-extrabold text-primary">Đã nhận đơn của bạn</h1>
          <p className="mt-2 text-muted-foreground">
            Mã đơn của bạn là <strong className="text-foreground">{doneCode}</strong>. Hãy lưu lại
            để tra cứu tiến trình.
          </p>
          <div className="mt-6 flex justify-center gap-3">
            <Button asChild size="lg">
              <Link to="/tra-cuu" search={{ code: doneCode, phone }}>Tra cứu đơn</Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link to="/">Về trang chủ</Link>
            </Button>
          </div>
        </main>
        <SiteFooter />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-56 lg:pb-0">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Đặt in online</h1>

        <ol className="mt-4 flex gap-2">
          {["Sản phẩm", "Gửi ảnh", "SĐT, địa chỉ"].map((label, i) => (
            <li
              key={label}
              className={`flex min-h-12 flex-1 items-center justify-center rounded-2xl px-2 py-2 text-center text-xs font-bold leading-tight sm:text-sm ${
                step === i + 1
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground"
              }`}
            >
              {i + 1}. {label}
            </li>
          ))}
        </ol>

        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_320px]">
          <div>
            {step > 1 && selected.length > 0 ? (
              <ul className="mb-4 space-y-1 rounded-3xl bg-card px-4 py-3 text-sm lg:hidden">
                {selected.map((row) => (
                  <li key={row.id} className="flex justify-between gap-3">
                    <span className="min-w-0 text-foreground/80">{row.label} × {row.quantity}</span>
                    <span className="shrink-0 font-semibold text-primary">{row.unitPrice ? formatVnd(row.unitPrice * row.quantity) : "Liên hệ"}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {step === 1 ? (
              <section className="space-y-3">
                {products.map((product) => {
                  const open = product.slug === activeProduct?.slug;
                  const from = product.variants
                    .map((variant) => (variant.requires_quote ? null : (variant.sale_price ?? variant.price)))
                    .filter((price): price is number => price !== null);
                  return (
                    <div key={product.id} id={`sp-${product.slug}`} className="glass-card scroll-mt-24 overflow-hidden rounded-3xl">
                      <button
                        type="button"
                        onClick={() => setActiveSlug(product.slug)}
                        className="flex min-h-16 w-full items-center gap-3 p-3 text-left"
                      >
                        <span className="min-w-0 flex-1">
                          <span className="block text-[11px] font-bold uppercase tracking-wide text-accent">{product.category}</span>
                          <span className="block font-extrabold leading-tight text-foreground">{product.name}</span>
                          <span className="block text-xs text-muted-foreground">
                            {from.length ? `Từ ${formatVnd(Math.min(...from))}` : "Liên hệ"} · {sizeSummary(product.variants)}
                          </span>
                        </span>
                        <span className={`shrink-0 rounded-full px-3 py-1 text-xs font-bold ${open ? "bg-accent text-accent-foreground" : "bg-muted text-foreground/70"}`}>
                          {open ? "Đang chọn" : "Chọn"}
                        </span>
                      </button>
                      {open ? (
                        <div className="border-t border-border px-3 pb-3">
                          <p className="py-3 text-sm text-muted-foreground">{product.description}</p>
                          <ProductOptions product={product} quantities={quantities} setQty={setQty} />
                        </div>
                      ) : null}
                    </div>
                  );
                })}
              </section>
            ) : null}

            {step === 3 ? (
              <section className="glass-card space-y-4 rounded-3xl p-5">
                <div>
                  <h2 className="text-lg font-extrabold text-primary">Số điện thoại và địa chỉ</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Ảnh đã chọn. Nhập thông tin để nhận mã đơn.</p>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="name">Họ và tên</Label>
                  <Input
                    id="name"
                    className="h-12"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="tel">Số điện thoại</Label>
                  <Input
                    id="tel"
                    className="h-12"
                    inputMode="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Hình thức nhận hàng</Label>
                  <div className="flex gap-2">
                    {(
                      [
                        ["pickup", "Nhận tại xưởng"],
                        ["delivery", "Giao tận nơi"],
                      ] as const
                    ).map(([value, label]) => (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setFulfillment(value)}
                        className={`flex-1 rounded-2xl px-4 py-3 text-sm font-semibold ${
                          fulfillment === value
                            ? "bg-primary text-primary-foreground"
                            : "bg-muted text-foreground/80"
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                {fulfillment === "delivery" ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="addr">Địa chỉ nhận hàng</Label>
                    <Textarea
                      id="addr"
                      value={address}
                      onChange={(e) => setAddress(e.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label htmlFor="note">Ghi chú</Label>
                  <Textarea id="note" value={note} onChange={(e) => setNote(e.target.value)} />
                </div>
                {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
              </section>
            ) : null}

            {step === 2 ? (
              <section className="glass-card rounded-3xl p-5">
                <h2 className="text-lg font-extrabold text-primary">Gửi ảnh gốc</h2>
                <p className="mt-1 text-sm text-muted-foreground">Số điện thoại và địa chỉ sẽ nhập ở bước sau.</p>
                <label className="mt-4 flex min-h-36 cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-10 text-center">
                  <UploadCloud className="size-8 text-accent" />
                  <span className="mt-2 font-semibold text-foreground">Chọn ảnh gốc</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, WEBP, HEIC — {maxPhotoBytes === null ? "không giới hạn dung lượng và số lượng" : photoLimitLabel(maxPhotoBytes)}
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>

                <ul className="mt-4 grid grid-cols-3 gap-2">
                  {files.map((f) => (
                    <li key={f.key} className="overflow-hidden rounded-2xl border border-border bg-card text-sm">
                      <LocalPhotoThumb file={f.file} className="aspect-square w-full object-cover" />
                      <span className="flex items-center gap-1 px-2 py-2">
                        <span className="min-w-0 flex-1 truncate">{f.file.name}</span>
                        {f.status === "uploading" ? <span className="shrink-0 text-xs font-semibold text-primary">{f.progress}%</span> : null}
                        {f.status === "complete" ? <CheckCircle2 className="size-4 shrink-0 text-accent" /> : null}
                        {f.status === "error" ? <AlertCircle className="size-4 shrink-0 text-destructive" /> : null}
                        <button
                          type="button"
                          aria-label="Xóa ảnh"
                          onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                        >
                          <X className="size-4 text-muted-foreground" />
                        </button>
                      </span>
                      {f.status === "uploading" ? (
                        <div className="mx-2 mb-2 h-1.5 overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-accent transition-[width]" style={{ width: `${f.progress}%` }} />
                        </div>
                      ) : null}
                      {f.message ? <span className="block px-2 pb-2 text-xs text-destructive">{f.message}</span> : null}
                    </li>
                  ))}
                </ul>

                {error ? (
                  <p className="mt-4 text-sm font-semibold text-destructive">{error}</p>
                ) : null}
              </section>
            ) : null}
          </div>

          <aside className="glass-panel hidden h-fit rounded-3xl p-5 lg:sticky lg:top-24 lg:block">
            <Summary
              selected={selected}
              subtotal={subtotal}
              step={step}
              busy={busy}
              onBack={() => setStep((s) => Math.max(1, s - 1))}
              onNext={() => setStep((s) => Math.min(3, s + 1))}
              onSubmit={handleSubmit}
              canNext={canNext}
              hint={canNext ? "" : stepHint}
            />
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-[4.5rem] z-40 border-t border-border bg-card p-3 lg:hidden">
        <Summary
          selected={selected}
          subtotal={subtotal}
          step={step}
          busy={busy}
          compact
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onNext={() => setStep((s) => Math.min(3, s + 1))}
          onSubmit={handleSubmit}
          canNext={canNext}
          hint={canNext ? "" : stepHint}
        />
      </div>

      <div className="hidden lg:block">
        <SiteFooter />
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
            <li key={variant.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border px-3 py-2">
              <span className="min-w-0">
                <span className="block text-sm font-semibold text-foreground">
                  {showOptions ? sheetOptionLabel(variant.sheets) : variant.name}
                </span>
                <span className="block text-xs font-semibold text-accent">
                  {amount == null ? "Liên hệ báo giá" : formatVnd(amount)}
                </span>
              </span>
              <div className="flex shrink-0 items-center rounded-full border border-border">
                <button
                  type="button"
                  aria-label={`Giảm ${showOptions ? sheetOptionLabel(variant.sheets) : variant.name}`}
                  className="grid size-11 place-items-center text-muted-foreground"
                  onClick={() => setQty(variant.id, qty - 1)}
                >
                  <Minus className="size-4" />
                </button>
                <span className="w-8 text-center text-sm font-bold">{qty}</span>
                <button
                  type="button"
                  aria-label={`Tăng ${showOptions ? sheetOptionLabel(variant.sheets) : variant.name}`}
                  className="grid size-11 place-items-center text-muted-foreground"
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

function Summary({
  selected,
  subtotal,
  step,
  busy,
  compact,
  canNext,
  hint,
  onBack,
  onNext,
  onSubmit,
}: {
  selected: { id: string; label: string; unitPrice: number; quantity: number }[];
  subtotal: number;
  step: number;
  busy: boolean;
  compact?: boolean;
  canNext: boolean;
  hint?: string;
  onBack: () => void;
  onNext: () => void;
  onSubmit: () => void;
}) {
  return (
    <div>
      {!compact ? (
        <>
          <h2 className="text-lg font-bold text-primary">Tóm tắt đơn</h2>
          <ul className="mt-3 space-y-2 text-sm">
            {selected.length === 0 ? (
              <li className="text-muted-foreground">Chưa chọn quy cách nào.</li>
            ) : (
              selected.map((s) => (
                <li key={s.id} className="flex justify-between gap-2">
                  <span className="text-foreground/80">
                    {s.label} × {s.quantity}
                  </span>
                  <span className="font-semibold text-primary">
                    {s.unitPrice ? formatVnd(s.unitPrice * s.quantity) : "Liên hệ"}
                  </span>
                </li>
              ))
            )}
          </ul>
        </>
      ) : null}

      <div className="flex items-center justify-between gap-2 text-base font-bold">
        <span>Tạm tính</span>
        <span className="text-accent">{formatVnd(subtotal)}</span>
      </div>

      {hint ? <p className="mt-2 text-center text-xs text-muted-foreground">{hint}</p> : null}
      <div className="mt-3 flex gap-2">
        {step > 1 ? (
          <Button variant="outline" size="lg" onClick={onBack} className="min-h-12 flex-1">
            Quay lại
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            size="lg"
            onClick={onNext}
            disabled={!canNext}
            className="min-h-12 flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {step === 1 ? "Gửi ảnh" : "Nhập SĐT"}
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={busy || !canNext}
            className="min-h-12 flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Gửi đơn
          </Button>
        )}
      </div>
    </div>
  );
}
