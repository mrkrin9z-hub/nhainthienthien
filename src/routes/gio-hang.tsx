import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShoppingCart, Store, Trash2, Truck } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { ImagePlaceholder, Stepper } from "@/components/site/shop-ui";
import { catalogQueryOptions, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { designNote, itemsParam, useCart, type CartLine } from "@/lib/cart";
import { formatVnd } from "@/lib/brand";
import { variantThumb } from "@/lib/product-media";
import { shipEstimate } from "@/lib/ship-estimate";

export const Route = createFileRoute("/gio-hang")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "Giỏ hàng — Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: CartPage,
});

type Row = CartLine & { key: string; product: CatalogProduct; variant: CatalogVariant; unit: number };

function CartPage() {
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const cart = useCart();
  const navigate = useNavigate();
  const [unselected, setUnselected] = useState<Set<string>>(new Set());

  const lookup = useMemo(() => {
    const map = new Map<string, { product: CatalogProduct; variant: CatalogVariant }>();
    for (const product of products) for (const variant of product.variants) map.set(variant.id, { product, variant });
    return map;
  }, [products]);

  const rows: Row[] = cart.lines.flatMap((line) => {
    const hit = lookup.get(line.variantId);
    if (!hit) return [];
    const unit = hit.variant.requires_quote ? 0 : (hit.variant.sale_price ?? hit.variant.price ?? 0);
    return [{ ...line, key: `${line.variantId}|${line.design ?? ""}`, ...hit, unit }];
  });
  const picked = rows.filter((r) => !unselected.has(r.key));
  const subtotal = picked.reduce((sum, r) => sum + r.unit * r.qty, 0);
  const saved = picked.reduce((sum, r) => sum + Math.max(0, (r.variant.list_price ?? r.unit) - r.unit) * r.qty, 0);
  const ship = shipEstimate(
    picked.map((r) => ({ width: r.variant.width, height: r.variant.height, amount: r.unit * r.qty })),
    "delivery",
  );
  const allOn = rows.length > 0 && picked.length === rows.length;

  function toggle(key: string) {
    setUnselected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function checkout() {
    if (!picked.length) return;
    const note = designNote(picked, (id) => lookup.get(id)?.product.name ?? id);
    navigate({ to: "/dat-in", search: { items: itemsParam(picked), src: "cart", ...(note ? { mau: note } : {}) } });
  }

  return (
    <div className="shop-ui min-h-screen bg-shop-bg pb-28 md:pb-24">
      <SiteHeader back title={`Giỏ hàng (${cart.count})`} hideTabs />
      <main className="mx-auto max-w-6xl md:px-6 md:pt-4">
        <h1 className="hidden py-2 text-xl text-foreground md:block">Giỏ hàng</h1>
        {rows.length === 0 ? (
          <div className="flex flex-col items-center gap-3 bg-white px-6 py-20 text-center md:rounded-sm">
            <ShoppingCart className="size-16 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">Giỏ hàng của bạn còn trống</p>
            <Link to="/san-pham" className="rounded-sm bg-sale px-6 py-2.5 text-sm font-semibold text-white">
              Mua sắm ngay
            </Link>
          </div>
        ) : (
          <section className="bg-white md:rounded-sm">
            <div className="flex items-center gap-2 border-b border-border px-3 py-3">
              <input type="checkbox" checked={allOn} onChange={() => setUnselected(allOn ? new Set(rows.map((r) => r.key)) : new Set())} className="size-4 accent-[var(--sale)]" aria-label="Chọn tất cả" />
              <Store className="size-4 text-foreground" aria-hidden />
              <span className="text-sm font-semibold">Nhà In Thiên Thiên</span>
            </div>
            <ul className="divide-y divide-border">
              {rows.map((r) => {
                const thumb = variantThumb(r.product, r.variant);
                return (
                  <li key={r.key} className="flex gap-2 px-3 py-3">
                    <input type="checkbox" checked={!unselected.has(r.key)} onChange={() => toggle(r.key)} className="mt-8 size-4 shrink-0 accent-[var(--sale)]" aria-label={`Chọn ${r.product.name}`} />
                    <Link to="/san-pham/$slug" params={{ slug: r.product.slug }} search={{ v: r.variant.id }} className="shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="" width={80} height={80} className="size-20 border border-border object-cover" />
                      ) : (
                        <ImagePlaceholder className="size-20 border border-border" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm leading-5 text-foreground">{r.product.name}</p>
                      <p className="mt-1 inline-block max-w-full truncate rounded-sm bg-shop-bg px-1.5 py-0.5 text-xs text-muted-foreground">
                        Phân loại: {r.variant.name}
                        {r.design ? ` · ${r.design}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-sm font-semibold text-sale">{r.unit ? formatVnd(r.unit) : "Liên hệ"}</span>
                          {r.variant.list_price ? <s className="text-xs text-muted-foreground">{formatVnd(r.variant.list_price)}</s> : null}
                        </p>
                        <div className="flex items-center gap-2">
                          <Stepper small value={r.qty} onChange={(n) => cart.setQty(r.variantId, r.design, n)} />
                          <button type="button" aria-label="Xóa" onClick={() => cart.remove(r.variantId, r.design)} className="grid size-8 place-items-center text-muted-foreground hover:text-sale">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 border-t border-border px-3 py-3 text-xs text-foreground/80">
              <Truck className="size-4 shrink-0 text-teal-700" aria-hidden />
              {picked.length === 0
                ? "Chọn sản phẩm để xem phí ship."
                : ship.fee === 0
                  ? `Đơn đã đủ ${formatVnd(ship.freeFrom)}: 0đ phí ship khi giao hàng.`
                  : `Mua thêm ${formatVnd(ship.freeFrom - subtotal)} để được freeship (phí ship ${formatVnd(ship.base)}). Nhận tại tiệm: 0đ.`}
            </div>
          </section>
        )}
      </main>

      {rows.length ? (
        <div className="fixed inset-x-0 bottom-0 z-50 border-t border-border bg-white pb-[env(safe-area-inset-bottom)]">
          <div className="mx-auto flex max-w-6xl items-center gap-2 pl-3 md:px-6">
            <label className="flex shrink-0 items-center gap-1.5 text-sm">
              <input type="checkbox" checked={allOn} onChange={() => setUnselected(allOn ? new Set(rows.map((r) => r.key)) : new Set())} className="size-4 accent-[var(--sale)]" />
              Tất cả
            </label>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-xs text-foreground">
                Tổng thanh toán <span className="text-base font-semibold text-sale">{formatVnd(subtotal)}</span>
              </p>
              {saved > 0 ? <p className="text-[11px] text-sale">Tiết kiệm {formatVnd(saved)}</p> : null}
            </div>
            <button type="button" onClick={checkout} disabled={!picked.length} className="min-h-14 shrink-0 bg-sale px-5 text-sm font-semibold text-white disabled:opacity-50 md:min-h-12 md:rounded-sm md:px-10">
              Mua hàng ({picked.reduce((s, r) => s + r.qty, 0)})
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
