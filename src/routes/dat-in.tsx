import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useRef, useState } from "react";
import { AlertCircle, CheckCircle2, Loader2, Minus, Plus, UploadCloud, X } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { catalogQueryOptions, type CatalogProduct } from "@/lib/catalog.functions";
import { createOrder, createUploadTicket, markFileStatus, submitOrder } from "@/lib/orders.functions";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/dat-in")({
  validateSearch: (search: Record<string, unknown>): { product?: string; items?: string } => {
    const out: { product?: string; items?: string } = {};
    if (typeof search["product"] === "string") out.product = search["product"];
    if (typeof search["items"] === "string") out.items = search["items"];
    return out;
  },


  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "Đặt in online — gửi ảnh 3 bước | Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Chọn quy cách, điền thông tin nhận hàng và gửi ảnh gốc để đặt in tại Nhà In Thiên Thiên. Nhận mã đơn ngay sau khi gửi.",
      },
      { property: "og:title", content: "Đặt in online — Nhà In Thiên Thiên" },
      { property: "og:description", content: "Gửi ảnh đặt in chỉ với 3 bước, nhận mã đơn ngay." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: OrderPage,
});

const MAX_FILES = 30;
const MAX_FILE_BYTES = 50 * 1024 * 1024;
const ACCEPT = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";

type FileState = {
  key: string;
  file: File;
  status: "pending" | "uploading" | "complete" | "error";
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
    for (const file of Array.from(list)) {
      if (file.size > MAX_FILE_BYTES) continue;
      next.push({ key: crypto.randomUUID(), file, status: "pending" });
    }
    setFiles((prev) => [...prev, ...next].slice(0, MAX_FILES));
  }

  async function handleSubmit() {
    setError(null);
    if (!files.length) {
      setError("Vui lòng chọn ít nhất một ảnh gốc.");
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

      for (const item of files) {
        if (item.status === "complete") continue;
        setFiles((prev) =>
          prev.map((f) => (f.key === item.key ? { ...f, status: "uploading" } : f)),
        );
        try {
          const ticket = await createUploadTicket({
            data: {
              orderId: order.orderId,
              accessToken: order.accessToken,
              fileName: item.file.name,
              mimeType: item.file.type || "image/jpeg",
              sizeBytes: item.file.size,
            },
          });
          if (ticket.mode === "supabase") {
            const { error: uploadError } = await supabase.storage
              .from("order-originals")
              .uploadToSignedUrl(ticket.path, ticket.token, item.file);
            if (uploadError) throw new Error(uploadError.message);
          } else {
            const body = new FormData();
            body.set("orderId", order.orderId);
            body.set("accessToken", order.accessToken);
            body.set("fileId", ticket.fileId);
            body.set("file", item.file);
            const uploaded = await fetch("/api/public/upload", { method: "POST", body });
            if (!uploaded.ok) throw new Error(await uploaded.text());
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
              f.key === item.key ? { ...f, status: "complete", fileId: ticket.fileId } : f,
            ),
          );
        } catch (err) {
          setFiles((prev) =>
            prev.map((f) =>
              f.key === item.key
                ? { ...f, status: "error", message: (err as Error).message }
                : f,
            ),
          );
        }
      }

      const result = await submitOrder({
        data: { orderId: order.orderId, accessToken: order.accessToken },
      });
      if (!result.allDone) {
        setError("Một số ảnh chưa tải lên được. Vui lòng bấm gửi lại để thử tiếp.");
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
              <Link to="/tra-cuu">Tra cứu đơn</Link>
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
    <div className="min-h-screen bg-background pb-28 lg:pb-0">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Đặt in online</h1>

        <ol className="mt-4 flex gap-2">
          {["Chọn sản phẩm", "Thông tin", "Gửi ảnh"].map((label, i) => (
            <li
              key={label}
              className={`flex-1 rounded-2xl px-3 py-2 text-center text-xs font-bold sm:text-sm ${
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
            {step === 1 ? (
              <section className="glass-card rounded-3xl p-5">
                <div className="flex flex-wrap gap-2">
                  {products.map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setActiveSlug(p.slug)}
                      className={`rounded-full px-4 py-2 text-sm font-semibold ${
                        activeProduct?.slug === p.slug
                          ? "bg-accent text-accent-foreground"
                          : "bg-muted text-foreground/80"
                      }`}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>

                <p className="mt-4 text-sm text-muted-foreground">{activeProduct?.description}</p>

                <ul className="mt-4 divide-y divide-border">
                  {activeProduct?.variants.map((variant) => {
                    const qty = quantities[variant.id] ?? 0;
                    return (
                      <li key={variant.id} className="flex items-center justify-between gap-3 py-3">
                        <div>
                          <p className="font-semibold text-foreground">{variant.name}</p>
                          <p className="text-sm text-accent">
                            {variant.requires_quote || variant.price === null
                              ? "Liên hệ báo giá"
                              : formatVnd(variant.sale_price ?? variant.price)}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            aria-label="Giảm"
                            onClick={() => setQty(variant.id, qty - 1)}
                            className="flex size-11 items-center justify-center rounded-xl bg-muted"
                          >
                            <Minus className="size-4" />
                          </button>
                          <span className="w-8 text-center font-bold">{qty}</span>
                          <button
                            type="button"
                            aria-label="Tăng"
                            onClick={() => setQty(variant.id, qty + 1)}
                            className="flex size-11 items-center justify-center rounded-xl bg-primary/10 text-primary"
                          >
                            <Plus className="size-4" />
                          </button>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="glass-card space-y-4 rounded-3xl p-5">
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
              </section>
            ) : null}

            {step === 3 ? (
              <section className="glass-card rounded-3xl p-5">
                <label className="flex cursor-pointer flex-col items-center justify-center rounded-3xl border-2 border-dashed border-primary/30 bg-primary/5 px-4 py-10 text-center">
                  <UploadCloud className="size-8 text-accent" />
                  <span className="mt-2 font-semibold text-foreground">Chọn ảnh gốc</span>
                  <span className="mt-1 text-xs text-muted-foreground">
                    JPG, PNG, WEBP, HEIC — tối đa 50MB mỗi ảnh, {MAX_FILES} ảnh mỗi đơn
                  </span>
                  <input
                    type="file"
                    multiple
                    accept={ACCEPT}
                    className="hidden"
                    onChange={(e) => addFiles(e.target.files)}
                  />
                </label>

                <ul className="mt-4 space-y-2">
                  {files.map((f) => (
                    <li
                      key={f.key}
                      className="flex items-center justify-between gap-3 rounded-2xl bg-muted/60 px-3 py-2 text-sm"
                    >
                      <span className="truncate">{f.file.name}</span>
                      <span className="flex shrink-0 items-center gap-2">
                        {f.status === "uploading" ? (
                          <Loader2 className="size-4 animate-spin text-primary" />
                        ) : null}
                        {f.status === "complete" ? (
                          <CheckCircle2 className="size-4 text-accent" />
                        ) : null}
                        {f.status === "error" ? (
                          <AlertCircle className="size-4 text-destructive" />
                        ) : null}
                        <button
                          type="button"
                          aria-label="Xóa ảnh"
                          onClick={() => setFiles((prev) => prev.filter((x) => x.key !== f.key))}
                        >
                          <X className="size-4 text-muted-foreground" />
                        </button>
                      </span>
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
              canNext={step === 1 ? selected.length > 0 : fullName.length > 1 && phone.length > 8}
            />
          </aside>
        </div>
      </main>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 p-3 backdrop-blur lg:hidden">
        <Summary
          selected={selected}
          subtotal={subtotal}
          step={step}
          busy={busy}
          compact
          onBack={() => setStep((s) => Math.max(1, s - 1))}
          onNext={() => setStep((s) => Math.min(3, s + 1))}
          onSubmit={handleSubmit}
          canNext={step === 1 ? selected.length > 0 : fullName.length > 1 && phone.length > 8}
        />
      </div>

      <div className="hidden lg:block">
        <SiteFooter />
      </div>
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

      <div className="mt-3 flex gap-2">
        {step > 1 ? (
          <Button variant="outline" size="lg" onClick={onBack} className="flex-1">
            Quay lại
          </Button>
        ) : null}
        {step < 3 ? (
          <Button
            size="lg"
            onClick={onNext}
            disabled={!canNext}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            Tiếp tục
          </Button>
        ) : (
          <Button
            size="lg"
            onClick={onSubmit}
            disabled={busy}
            className="flex-1 bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : null}
            Gửi đơn
          </Button>
        )}
      </div>
    </div>
  );
}
