import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, MessageCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FreeshipTag, ImagePlaceholder, PolicyChips, ProductCard, ShopInfoBlock, Stepper } from "@/components/site/shop-ui";
import { catalogQueryOptions, publicConfigQueryOptions, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { matchingSheet, sizeChoices } from "@/domain/catalog-label";
import { BRAND, formatVnd, tiktokUrl } from "@/lib/brand";
import { useCart } from "@/lib/cart";
import { galleryFor, mediaFor, type MediaItem } from "@/lib/product-media";
import { discountPercent } from "@/lib/ship-estimate";
import { DEPOSIT, NO_RETURN, PAYMENT, REPRINT, SHIP_LARGE, SHIP_PICKUP, SHIP_SMALL } from "@/lib/public-policy";

export const Route = createFileRoute("/san-pham_/$slug")({
  validateSearch: (search: Record<string, unknown>): { v?: string } =>
    typeof search["v"] === "string" ? { v: search["v"] } : {},
  loader: async ({ context, params }) => {
    const products = await context.queryClient.ensureQueryData(catalogQueryOptions);
    const product = products.find((p) => p.slug === params.slug);
    if (!product) throw notFound();
    return { name: product.name, description: product.description, slug: product.slug, prices: product.variants.map((v) => v.price).filter((p): p is number => typeof p === "number") };
  },
  head: ({ loaderData }) => {
    if (!loaderData) return {};
    const url = `https://nhainthienthien.com/san-pham/${loaderData.slug}`;
    const low = loaderData.prices.length ? Math.min(...loaderData.prices) : null;
    const high = loaderData.prices.length ? Math.max(...loaderData.prices) : null;
    const ld = {
      "@context": "https://schema.org",
      "@type": "Product",
      name: loaderData.name,
      description: loaderData.description,
      brand: { "@type": "Brand", name: "Nhà In Thiên Thiên" },
      url,
      ...(low !== null
        ? {
            offers: {
              "@type": "AggregateOffer",
              priceCurrency: "VND",
              lowPrice: low,
              highPrice: high,
              offerCount: loaderData.prices.length,
              availability: "https://schema.org/InStock",
            },
          }
        : {}),
    };
    return {
      meta: [
        { title: `${loaderData.name} — Nhà In Thiên Thiên` },
        { name: "description", content: loaderData.description },
        { property: "og:title", content: `${loaderData.name} — Nhà In Thiên Thiên` },
        { property: "og:description", content: loaderData.description },
        { property: "og:type", content: "product" },
      ],
      links: [{ rel: "canonical", href: url }],
      scripts: [{ type: "application/ld+json", children: JSON.stringify(ld) }],
    };
  },
  component: ProductPage,
});

function amount(v: CatalogVariant): number | null {
  return v.requires_quote ? null : (v.sale_price ?? v.price);
}

function packLabel(sheets: number, unit: string): string {
  if (sheets <= 1) return `1 ${unit}`;
  return sheets <= 5 ? `Combo ${sheets} ${unit}` : `Gói ${sheets} ${unit}`;
}

function ProductPage() {
  const { slug } = Route.useParams();
  const { v: presetVariant } = Route.useSearch();
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const config = useQuery(publicConfigQueryOptions);
  const product = products.find((p) => p.slug === slug) as CatalogProduct;
  const navigate = useNavigate();
  const cart = useCart();

  const choices = useMemo(() => sizeChoices(product.variants), [product]);
  const preset = product.variants.find((v) => v.id === presetVariant);
  const presetChoice = preset ? choices.find((c) => c.variants.some((v) => v.id === preset.id)) : undefined;
  const [sizeKey, setSizeKey] = useState(presetChoice?.key ?? choices[0]?.key ?? "");
  const [variantId, setVariantId] = useState(preset?.id ?? choices[0]?.variants[0]?.id ?? "");
  const [qty, setQty] = useState(1);
  const [design, setDesign] = useState<string | null>(null);
  const [needDesign, setNeedDesign] = useState(false);
  const designRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setSizeKey(presetChoice?.key ?? choices[0]?.key ?? "");
    setVariantId(preset?.id ?? choices[0]?.variants[0]?.id ?? "");
    setQty(1);
    setDesign(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  const choice = choices.find((c) => c.key === sizeKey) ?? choices[0];
  const variant = choice?.variants.find((v) => v.id === variantId) ?? choice?.variants[0];
  const price = variant ? amount(variant) : null;
  const pct = variant ? discountPercent(price, variant.list_price) : null;
  const media = mediaFor(product.slug);
  const designs = media.designs;
  const gallery = useMemo(
    () => galleryFor(product.slug, product.cover_path, choices.length > 1 ? (choice?.key ?? null) : null, product.name),
    [product, choice?.key, choices.length],
  );
  const tiktok = tiktokUrl(product.slug);
  const others = products.filter((p) => p.slug !== product.slug);

  function pickSize(key: string) {
    const next = choices.find((c) => c.key === key);
    if (!next) return;
    setSizeKey(key);
    const kept = matchingSheet(next.variants, variant?.sheets ?? null);
    if (kept) setVariantId(kept.id);
  }

  function ready(): boolean {
    if (!variant || price === null) return false;
    if (designs && !design) {
      setNeedDesign(true);
      designRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
      toast.error("Vui lòng chọn mẫu");
      return false;
    }
    return true;
  }

  function addToCart() {
    if (!ready() || !variant) return;
    cart.add(variant.id, qty, design ?? undefined);
    toast.success("Đã thêm vào giỏ hàng", { action: { label: "Xem giỏ", onClick: () => navigate({ to: "/gio-hang" }) } });
  }

  function buyNow() {
    if (!ready() || !variant) return;
    navigate({
      to: "/dat-in",
      search: { items: `${variant.id}:${qty}`, ...(design ? { mau: `Mẫu khách chọn: ${product.name}: ${design} × ${qty}` } : {}) },
    });
  }

  const buyButtons = (
    <>
      <button type="button" onClick={addToCart} className="flex min-h-12 flex-1 items-center justify-center gap-1.5 border border-brand-blue bg-brand-blue-soft px-3 text-sm font-medium text-brand-blue md:rounded-sm">
        <ShoppingCart className="size-5" aria-hidden /> Thêm vào giỏ
      </button>
      <button type="button" onClick={buyNow} className="min-h-12 flex-1 bg-cta px-3 text-sm font-semibold text-cta-foreground md:rounded-sm">
        Mua ngay
      </button>
    </>
  );

  return (
    <div className="shop-ui min-h-screen bg-shop-bg pb-16 md:pb-0">
      <SiteHeader back title="Chi tiết sản phẩm" hideTabs />
      <main className="mx-auto max-w-6xl md:px-6 md:pt-4">
        <nav className="hidden items-center gap-1 py-2 text-sm text-muted-foreground md:flex" aria-label="Đường dẫn">
          <Link to="/" className="text-sale">Nhà In Thiên Thiên</Link>
          <ChevronRight className="size-4" />
          <Link to="/san-pham" search={{ cat: product.category }} className="text-sale">{product.category}</Link>
          <ChevronRight className="size-4" />
          <span className="truncate">{product.name}</span>
        </nav>

        <div className="bg-white md:grid md:grid-cols-[minmax(0,450px)_minmax(0,1fr)] md:gap-8 md:rounded-sm md:p-5">
          <Gallery items={gallery} key={`${product.slug}-${choice?.key ?? ""}`} />

          <div className="min-w-0">
            {/* Giá */}
            <section className="p-3 md:p-0">
              <h1 className="text-base font-normal leading-6 text-foreground md:text-xl md:font-medium">{product.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 bg-sale-soft/60 px-3 py-3 md:mt-4 md:px-5 md:py-4">
                <span className="text-2xl font-semibold text-sale md:text-3xl">{price === null ? "Liên hệ" : formatVnd(price * 1)}</span>
                {variant?.list_price ? <s className="text-sm text-muted-foreground">{formatVnd(variant.list_price)}</s> : null}
                {pct ? <span className="rounded-sm bg-cta px-1.5 py-0.5 text-xs font-bold text-cta-foreground">-{pct}%</span> : null}
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <FreeshipTag />
                <span className="rounded-sm border border-sale/60 px-1 text-[10px] font-semibold leading-4 text-sale">COD</span>
                {variant ? <span className="text-xs text-muted-foreground">Đang chọn: {variant.name}</span> : null}
              </div>
            </section>

            <Link to="/chinh-sach" className="flex items-center gap-2 border-t-8 border-shop-bg px-3 py-3 md:mt-4 md:border-t md:border-border md:px-0">
              <PolicyChips className="min-w-0 flex-1" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>

            {/* Phân loại */}
            <section className="border-t-8 border-shop-bg p-3 md:border-t md:border-border md:px-0 md:py-4">
              {choices.length > 1 ? (
                <div>
                  <p className="text-sm text-muted-foreground">Kích thước</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn kích thước">
                    {choices.map((c) => (
                      <VariantChip key={c.key} active={c.key === choice?.key} label={c.label} onClick={() => pickSize(c.key)} />
                    ))}
                  </div>
                </div>
              ) : null}

              {choice && choice.variants.length > 1 ? (
                <div className={choices.length > 1 ? "mt-4" : ""}>
                  <p className="text-sm text-muted-foreground">Phân loại{choices.length === 1 ? ` · ${choice.label}` : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn combo">
                    {choice.variants.map((item) => {
                      const p = amount(item);
                      return (
                        <VariantChip
                          key={item.id}
                          active={item.id === variant?.id}
                          label={packLabel(item.sheets, product.slug === "trang-guong" ? "ảnh" : "tấm")}
                          detail={p === null ? "Liên hệ" : formatVnd(p)}
                          onClick={() => setVariantId(item.id)}
                        />
                      );
                    })}
                  </div>
                </div>
              ) : null}

              {designs ? (
                <div ref={designRef} className="mt-4">
                  <p className={`text-sm ${needDesign && !design ? "font-semibold text-sale" : "text-muted-foreground"}`}>
                    {designs.title} ({designs.options.length} mẫu){design ? `: ${design}` : needDesign ? " — vui lòng chọn" : ""}
                  </p>
                  <div className="mt-2 grid grid-cols-4 gap-2 sm:grid-cols-5">
                    {designs.options.map((opt) => (
                      <button
                        key={opt.key}
                        type="button"
                        aria-pressed={design === opt.key}
                        onClick={() => {
                          setDesign(opt.key);
                          setNeedDesign(false);
                        }}
                        className={`relative overflow-hidden rounded-sm border text-left ${design === opt.key ? "border-sale ring-1 ring-sale" : "border-border"}`}
                      >
                        <img src={opt.image} alt={opt.label} loading="lazy" width={240} height={240} className="aspect-square w-full bg-muted object-cover" />
                        <span className="block truncate px-1 py-0.5 text-[10px] leading-4 text-foreground">{opt.label}</span>
                        {design === opt.key ? (
                          <span className="absolute right-0 top-0 grid size-4 place-items-center rounded-bl-sm bg-sale text-white">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm text-muted-foreground">Số lượng</span>
                <Stepper value={qty} onChange={setQty} />
              </div>
              {price !== null && qty > 1 ? (
                <p className="mt-2 text-right text-sm text-muted-foreground">
                  Thành tiền: <span className="font-semibold text-sale">{formatVnd(price * qty)}</span>
                </p>
              ) : null}

              <div className="mt-5 hidden gap-3 md:flex">
                <a href={BRAND.messengerUrl} target="_blank" rel="noopener" className="flex min-h-12 items-center gap-1.5 rounded-sm border border-border px-4 text-sm text-foreground/80">
                  <MessageCircle className="size-5 text-brand-blue" aria-hidden /> Chat ngay
                </a>
                {buyButtons}
              </div>
            </section>
          </div>
        </div>

        <div className="mt-2 md:rounded-sm">
          <ShopInfoBlock hours={config.data?.hours} />
        </div>

        <section className="mt-2 bg-white p-3 md:rounded-sm md:p-5">
          <h2 className="bg-shop-bg px-3 py-2 text-sm font-semibold uppercase text-foreground">Mô tả sản phẩm</h2>
          <div className="space-y-2 px-1 pt-3 text-sm leading-relaxed text-foreground/85">
            <p>{product.description}</p>
            {product.turnaround_text ? <p>Thời gian làm: {product.turnaround_text}</p> : null}
            {variant?.recommended_width_px && variant.recommended_height_px ? (
              <p className="text-muted-foreground">
                Ảnh nét nhất khi khổ {variant.width}×{variant.height} cm có ảnh gốc khoảng {variant.recommended_width_px}×{variant.recommended_height_px} px. Tiệm kiểm tra và báo lại nếu ảnh chưa đủ nét.
              </p>
            ) : null}
            <p className="flex flex-wrap gap-3 pt-1 text-xs">
              {tiktok ? (
                <a href={tiktok} target="_blank" rel="noopener" className="text-sale underline">Xem trên TikTok Shop</a>
              ) : null}
              <a href={BRAND.shopeeUrl} target="_blank" rel="noopener" className="text-sale underline">Shop trên Shopee</a>
            </p>
          </div>
          <h2 className="mt-4 bg-shop-bg px-3 py-2 text-sm font-semibold uppercase text-foreground">Vận chuyển & đổi trả</h2>
          <ul className="list-disc space-y-1 pl-5 pt-3 text-sm leading-relaxed text-foreground/85">
            <li>{SHIP_SMALL}</li>
            <li>{SHIP_LARGE}</li>
            <li>{SHIP_PICKUP}</li>
            <li>{PAYMENT} {DEPOSIT}</li>
            <li>{REPRINT}</li>
            <li>{NO_RETURN}</li>
          </ul>
        </section>

        {others.length ? (
          <section className="mt-2">
            <h2 className="bg-white px-3 py-3 text-sm font-semibold uppercase text-muted-foreground md:rounded-t-sm">Sản phẩm khác của shop</h2>
            <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3 md:grid-cols-5 md:gap-2.5 md:px-0">
              {others.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* Thanh mua cố định trên điện thoại */}
      <div className="fixed inset-x-0 bottom-0 z-50 flex border-t border-border bg-white pb-[env(safe-area-inset-bottom)] md:hidden">
        <a href={BRAND.messengerUrl} target="_blank" rel="noopener" className="flex min-h-12 w-20 shrink-0 flex-col items-center justify-center text-[10px] text-brand-blue">
          <MessageCircle className="size-5" aria-hidden /> Chat ngay
        </a>
        {buyButtons}
      </div>

      <div className="hidden md:block">
        <SiteFooter />
      </div>
    </div>
  );
}

function VariantChip({ active, label, detail, onClick }: { active: boolean; label: string; detail?: string; onClick: () => void }) {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={active}
      onClick={onClick}
      className={`relative min-h-9 rounded-sm border px-3 py-1.5 text-left text-sm ${active ? "border-sale text-sale" : "border-border bg-white text-foreground"}`}
    >
      {label}
      {detail ? <span className={`ml-1.5 text-xs ${active ? "text-sale" : "text-muted-foreground"}`}>{detail}</span> : null}
      {active ? (
        <span className="absolute bottom-0 right-0 grid size-3.5 place-items-center rounded-tl-sm bg-sale text-white">
          <Check className="size-2.5" />
        </span>
      ) : null}
    </button>
  );
}

function Gallery({ items }: { items: MediaItem[] }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  if (!items.length) return <ImagePlaceholder className="aspect-square w-full" />;

  function go(i: number) {
    const el = track.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <div className="min-w-0">
      <div className="relative">
        <div
          ref={track}
          className="snap-gallery flex overflow-x-auto"
          onScroll={(e) => {
            const el = e.currentTarget;
            setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
          }}
        >
          {items.map((item, i) => (
            <div key={item.src} className="w-full shrink-0">
              {item.kind === "video" ? (
                <video src={item.src} poster={item.poster} controls playsInline preload="metadata" className="aspect-square w-full bg-black object-contain" aria-label={item.alt} />
              ) : (
                <img
                  src={item.src}
                  alt={item.alt}
                  width={900}
                  height={900}
                  loading={i === 0 ? "eager" : "lazy"}
                  decoding="async"
                  className="aspect-square w-full bg-muted object-cover"
                />
              )}
            </div>
          ))}
        </div>
        {items.length > 1 ? (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/45 px-2 py-0.5 text-xs text-white">
            {index + 1}/{items.length}
          </span>
        ) : null}
      </div>
      {items.length > 1 ? (
        <div className="scrollbar-none mt-2 hidden gap-2 overflow-x-auto md:flex">
          {items.map((item, i) => (
            <button
              key={item.src}
              type="button"
              aria-label={`Xem ảnh ${i + 1}`}
              onClick={() => go(i)}
              className={`size-20 shrink-0 overflow-hidden border-2 ${i === index ? "border-sale" : "border-transparent"}`}
            >
              {item.kind === "video" ? (
                <span className="grid size-full place-items-center bg-black text-xs text-white">Video</span>
              ) : (
                <img src={item.src} alt="" loading="lazy" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
