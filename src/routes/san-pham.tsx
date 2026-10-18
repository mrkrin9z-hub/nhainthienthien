import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { Check, Minus, Plus, ShoppingBag, Trash2, X } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import {
  catalogQueryOptions,
  minPrice,
  type CatalogProduct,
  type CatalogVariant,
} from "@/lib/catalog.functions";
import { sizeSummary } from "@/domain/catalog-label";
import { catalogImage } from "@/lib/product-images";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/san-pham")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "Sản phẩm & bảng giá in ảnh — Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Xem ảnh mẫu và giá từng kích thước: ảnh ép gỗ tráng gương bo viền, ảnh thờ, giấy khen và nam châm. Chọn size, chọn số lượng và đặt mua ngay.",
      },
      { property: "og:title", content: "Sản phẩm & bảng giá in ảnh — Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "Chọn size, chọn số lượng, đặt mua trong vài giây. Giá xưởng cho mọi nhà.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ProductsPage,
});

function variantPrice(v: CatalogVariant): number | null {
  if (v.requires_quote) return null;
  return v.sale_price ?? v.price;
}

function ProductsPage() {
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const navigate = useNavigate();

  const [cart, setCart] = useState<Record<string, number>>({});
  const [openProduct, setOpenProduct] = useState<CatalogProduct | null>(null);
  const [category, setCategory] = useState<string>("Tất cả");

  const categories = useMemo(
    () => ["Tất cả", ...Array.from(new Set(products.map((p) => p.category).filter(Boolean)))],
    [products],
  );
  const visible = products.filter((p) => category === "Tất cả" || p.category === category);

  const lookup = useMemo(() => {
    const map = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>();
    for (const product of products)
      for (const variant of product.variants) map.set(variant.id, { product, variant });
    return map;
  }, [products]);

  const lines = Object.entries(cart)
    .filter(([, qty]) => qty > 0)
    .map(([id, qty]) => ({ id, qty, entry: lookup.get(id) }))
    .filter((l): l is { id: string; qty: number; entry: { product: CatalogProduct; variant: CatalogVariant } } =>
      Boolean(l.entry),
    )
    .map((l) => ({ id: l.id, qty: l.qty, product: l.entry.product, variant: l.entry.variant }));

  const total = lines.reduce((sum, l) => sum + (variantPrice(l.variant) ?? 0) * l.qty, 0);
  const hasQuote = lines.some((l) => variantPrice(l.variant) === null);
  const totalQty = lines.reduce((s, l) => s + l.qty, 0);

  function addToCart(variantId: string, qty: number, label: string) {
    setCart((prev) => ({ ...prev, [variantId]: (prev[variantId] ?? 0) + qty }));
    setOpenProduct(null);
    toast.success(`Đã thêm ${qty} × ${label} vào đơn`);
  }

  function checkout() {
    const items = lines.map((l) => `${l.id}:${l.qty}`).join(",");
    navigate({ to: "/dat-in", search: { items } });
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-4 py-8 pb-44 md:px-6 md:py-10">
        <h1 className="text-2xl font-extrabold text-primary sm:text-3xl md:text-4xl">
          Sản phẩm & bảng giá
        </h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground md:text-base">
          Xem ảnh mẫu và giá của từng kích thước ngay tại đây. Bấm vào sản phẩm để chọn size, số
          lượng rồi đặt mua.
        </p>

        <div className="-mx-4 mt-5 flex gap-2 overflow-x-auto px-4 pb-1 md:mx-0 md:px-0">
          {categories.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={`min-h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition ${
                c === category
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card/70 text-foreground/75"
              }`}
            >
              {c}
            </button>
          ))}
        </div>

        <div className="mt-5 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {visible.map((product) => (
            <ProductTile key={product.id} product={product} onOpen={() => setOpenProduct(product)} />
          ))}
        </div>
      </main>

      {openProduct ? (
        <VariantSheet
          product={openProduct}
          onClose={() => setOpenProduct(null)}
          onAdd={addToCart}
        />
      ) : null}

      {lines.length > 0 ? (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur">
          <div className="mx-auto flex max-w-6xl flex-col gap-2 px-4 py-3 md:flex-row md:items-center md:justify-between md:px-6">
            <div className="max-h-24 overflow-auto text-sm">
              {lines.map((l) => (
                <div key={l.id} className="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 py-0.5">
                  <span className="min-w-0 truncate text-foreground/80">
                    {l.product.name} — {l.variant.name} × {l.qty}
                  </span>
                  <span className="shrink-0 font-semibold text-primary">
                    {variantPrice(l.variant) === null
                      ? "Liên hệ"
                      : formatVnd(variantPrice(l.variant)! * l.qty)}
                  </span>
                  <button
                    type="button"
                    aria-label="Xoá dòng"
                    className="shrink-0 rounded-full p-1 text-muted-foreground hover:text-destructive"
                    onClick={() => setCart((prev) => ({ ...prev, [l.id]: 0 }))}
                  >
                    <Trash2 className="size-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 md:flex md:justify-end">
              <div className="min-w-0 text-right">
                <p className="text-xs text-muted-foreground">Tạm tính ({totalQty} món)</p>
                <p className="text-lg font-extrabold text-primary">
                  {formatVnd(total)}
                  {hasQuote ? " + báo giá" : ""}
                </p>
              </div>
              <Button
                size="lg"
                className="min-h-12 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
                onClick={checkout}
              >
                <ShoppingBag className="size-4" /> Đặt mua
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <SiteFooter />
    </div>
  );
}

function ProductTile({ product, onOpen }: { product: CatalogProduct; onOpen: () => void }) {
  const from = minPrice(product);
  return (
    <article className="glass-card flex flex-col overflow-hidden rounded-2xl">
      <button type="button" onClick={onOpen} className="text-left">
        <img
          src={catalogImage(product.slug, product.cover_path)}
          alt={`Ảnh mẫu ${product.name}`}
          loading="lazy"
          width={800}
          height={600}
          className="aspect-square w-full object-cover"
        />
      </button>
      <div className="flex flex-1 flex-col p-3">
        <h2 className="line-clamp-2 text-sm font-bold text-foreground sm:text-base">
          {product.name}
        </h2>
        {product.turnaround_text ? (
          <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{product.turnaround_text}</p>
        ) : null}
        <p className="mt-2 text-base font-extrabold text-accent sm:text-lg">
          {from === null ? null : (
            <span className="mr-1 text-[11px] font-medium text-muted-foreground">từ</span>
          )}
          {from === null ? "Liên hệ" : formatVnd(from)}
        </p>
        <p className="mt-0.5 text-[11px] text-muted-foreground">
          {sizeSummary(product.variants)}
        </p>
        <Button
          onClick={onOpen}
          className="mt-3 min-h-11 w-full bg-accent text-accent-foreground hover:bg-accent/90"
        >
          <ShoppingBag className="size-4" /> Chọn mua
        </Button>
      </div>
    </article>
  );
}

function VariantSheet({
  product,
  onClose,
  onAdd,
}: {
  product: CatalogProduct;
  onClose: () => void;
  onAdd: (variantId: string, qty: number, label: string) => void;
}) {
  const [variantId, setVariantId] = useState(product.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);

  const variant = product.variants.find((v) => v.id === variantId) ?? product.variants[0];
  const price = variant ? variantPrice(variant) : null;

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/40 backdrop-blur-sm sm:items-center">
      <div className="max-h-[88vh] w-full overflow-auto rounded-t-3xl border border-border bg-card p-4 sm:max-w-lg sm:rounded-3xl sm:p-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3">
          <img
            src={catalogImage(product.slug, product.cover_path)}
            alt={`Ảnh mẫu ${product.name}`}
            width={200}
            height={200}
            className="size-20 shrink-0 rounded-2xl object-cover"
          />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-accent">
              {product.category}
            </p>
            <h3 className="truncate text-lg font-bold text-foreground">{product.name}</h3>
            <p className="text-xl font-extrabold text-accent">
              {price === null ? "Liên hệ" : formatVnd(price)}
            </p>
          </div>
          <button
            type="button"
            aria-label="Đóng"
            onClick={onClose}
            className="grid size-10 shrink-0 place-items-center rounded-full text-muted-foreground hover:text-foreground"
          >
            <X className="size-5" />
          </button>
        </div>

        <p className="mt-3 text-sm text-muted-foreground">
          {product.turnaround_text ? `${product.description} • ${product.turnaround_text}` : product.description}
        </p>

        <p className="mt-5 text-sm font-semibold text-foreground">Chọn kích thước</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {product.variants.map((v) => {
            const active = v.id === variant?.id;
            const p = variantPrice(v);
            return (
              <button
                key={v.id}
                type="button"
                onClick={() => setVariantId(v.id)}
                className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-sm transition ${
                  active
                    ? "border-accent bg-accent/10 text-accent"
                    : "border-border bg-card/70 text-foreground/80 hover:border-accent/50"
                }`}
              >
                <span className="flex items-center gap-1.5 font-medium">
                  {active ? <Check className="size-3.5" /> : null}
                  {v.name}
                </span>
                <span className="block text-xs font-semibold">
                  {p === null ? "Liên hệ" : formatVnd(p)}
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Số lượng</span>
          <div className="flex items-center rounded-full border border-border">
            <button
              type="button"
              aria-label="Giảm"
              className="grid size-11 place-items-center text-muted-foreground"
              onClick={() => setQty((q) => Math.max(1, q - 1))}
            >
              <Minus className="size-4" />
            </button>
            <span className="w-10 text-center text-base font-bold">{qty}</span>
            <button
              type="button"
              aria-label="Tăng"
              className="grid size-11 place-items-center text-muted-foreground"
              onClick={() => setQty((q) => Math.min(500, q + 1))}
            >
              <Plus className="size-4" />
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">Thành tiền</p>
            <p className="text-lg font-extrabold text-primary">
              {price === null ? "Liên hệ" : formatVnd(price * qty)}
            </p>
          </div>
          <Button
            className="min-h-12 shrink-0 bg-accent text-accent-foreground hover:bg-accent/90"
            disabled={!variant}
            onClick={() => variant && onAdd(variant.id, qty, `${product.name} — ${variant.name}`)}
          >
            <ShoppingBag className="size-4" /> Thêm vào đơn
          </Button>
        </div>
      </div>
    </div>
  );
}
