import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { ShoppingCart, Store, Trash2, Truck } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { ImagePlaceholder, Stepper } from "@/components/site/shop-ui";
import { catalogQueryOptions, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { designNote, itemsParam, useCart, type CartLine } from "@/lib/cart";
import { lineAmount } from "@/domain/calc";
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

type Row = CartLine & { key: string; product: CatalogProduct; variant: CatalogVariant; unit: number; amount: number };

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
    const amount = hit.variant.requires_quote ? 0 : (lineAmount(unit, line.qty, hit.variant.min_total) ?? unit * line.qty);
    return [{ ...line, key: `${line.variantId}|${line.design ?? ""}`, ...hit, unit, amount }];
  });
  const picked = rows.filter((r) => !unselected.has(r.key));
  const subtotal = picked.reduce((sum, r) => sum + r.amount, 0);
  const saved = picked.reduce((sum, r) => sum + Math.max(0, (r.variant.list_price ?? r.unit) - r.unit) * r.qty, 0);
  const ship = shipEstimate(
    picked.map((r) => ({ width: r.variant.width, height: r.variant.height, amount: r.amount })),
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
      <main className="mx-auto max-w-6xl px-2.5 pt-2.5 md:px-6 md:pt-5">
        <h1 className="hidden pb-3 text-xl tracking-tight text-[#123047] md:block">Giỏ hàng</h1>
        {rows.length === 0 ? (
          <div className="card flex flex-col items-center gap-3 px-6 py-20 text-center">
            <ShoppingCart className="size-16 text-muted-foreground/40" aria-hidden />
            <p className="text-sm text-muted-foreground">Giỏ hàng của bạn còn trống</p>
            <Link to="/san-pham" className="btn-cta px-7 py-2.5 text-sm">
              Mua sắm ngay
            </Link>
          </div>
        ) : (
          <section className="card overflow-hidden">
            <div className="flex items-center gap-2 border-b border-[#123047]/6 px-3.5 py-3">
              <input type="checkbox" checked={allOn} onChange={() => setUnselected(allOn ? new Set(rows.map((r) => r.key)) : new Set())} className="size-4 accent-[var(--brand-blue)]" aria-label="Chọn tất cả" />
              <Store className="size-4 text-brand-blue" aria-hidden />
              <span className="text-sm font-semibold">Nhà In Thiên Thiên</span>
            </div>
            <ul className="divide-y divide-[#123047]/6">
              {rows.map((r) => {
                const thumb = variantThumb(r.product, r.variant);
                return (
                  <li key={r.key} className="flex gap-2.5 px-3.5 py-3.5">
                    <input type="checkbox" checked={!unselected.has(r.key)} onChange={() => toggle(r.key)} className="mt-8 size-4 shrink-0 accent-[var(--brand-blue)]" aria-label={`Chọn ${r.product.name}`} />
                    <Link to="/san-pham/$slug" params={{ slug: r.product.slug }} search={{ v: r.variant.id }} className="shrink-0">
                      {thumb ? (
                        <img src={thumb} alt="" width={80} height={80} className="size-20 rounded-2xl object-cover shadow-[0_0_0_1px_rgb(18_48_71/0.06)]" />
                      ) : (
                        <ImagePlaceholder className="size-20 rounded-2xl" />
                      )}
                    </Link>
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-2 text-sm font-medium leading-5 text-[#123047]">{r.product.name}</p>
                      <p className="mt-1 inline-block max-w-full truncate rounded-full bg-[#f3f6fa] px-2.5 py-0.5 text-xs text-[#5b6b7a]">
                        Phân loại: {r.variant.name}
                        {r.design ? ` · ${r.design}` : ""}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-end justify-between gap-2">
                        <p className="flex items-baseline gap-1.5">
                          <span className="text-[15px] font-extrabold tracking-tight text-sale">{r.unit ? formatVnd(r.amount) : "Liên hệ"}</span>
                          {r.variant.min_total && r.amount !== r.unit * r.qty ? (
                            <p className="text-xs text-muted-foreground">Đã áp dụng tối thiểu {formatVnd(r.variant.min_total)}</p>
                          ) : null}
                          {r.variant.list_price ? <s className="text-xs text-muted-foreground">{formatVnd(r.variant.list_price)}</s> : null}
                        </p>
                        <div className="flex items-center gap-2">
                          <Stepper small value={r.qty} onChange={(n) => cart.setQty(r.variantId, r.design, n)} />
                          <button type="button" aria-label="Xóa" onClick={() => cart.remove(r.variantId, r.design)} className="grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-[#fff3e0] hover:text-sale">
                            <Trash2 className="size-4" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
            <div className="flex items-center gap-2 border-t border-[#123047]/6 bg-[#f6f9fc] px-3.5 py-3 text-xs text-foreground/80">
              <Truck className="size-4 shrink-0 text-brand-blue" aria-hidden />
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
        <div className="site-sticky-bottom glass-bar fixed inset-x-0 bottom-0 z-50 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2">
          <div className="mx-auto flex max-w-6xl items-center gap-2 px-3 md:px-6">
            <label className="flex shrink-0 items-center gap-1.5 text-sm">
              <input type="checkbox" checked={allOn} onChange={() => setUnselected(allOn ? new Set(rows.map((r) => r.key)) : new Set())} className="size-4 accent-[var(--brand-blue)]" />
              Tất cả
            </label>
            <div className="min-w-0 flex-1 text-right">
              <p className="text-xs text-foreground">
                Tổng thanh toán <span className="text-lg font-extrabold tracking-tight text-sale">{formatVnd(subtotal)}</span>
              </p>
              {saved > 0 ? <p className="text-[11px] text-sale">Tiết kiệm {formatVnd(saved)}</p> : null}
            </div>
            <button type="button" onClick={checkout} disabled={!picked.length} className="btn-cta min-h-12 shrink-0 px-6 text-sm disabled:opacity-50 md:px-10">
              Mua hàng ({picked.reduce((s, r) => s + r.qty, 0)})
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
