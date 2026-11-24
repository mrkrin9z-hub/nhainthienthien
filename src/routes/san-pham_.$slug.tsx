import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronRight, MessageCircle, ShoppingCart } from "lucide-react";
import { toast } from "sonner";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { FreeshipTag, PolicyChips, ProductCard, ShopInfoBlock, Stepper } from "@/components/site/shop-ui";
import { catalogQueryOptions, publicConfigQueryOptions, type CatalogProduct, type CatalogVariant } from "@/lib/catalog.functions";
import { matchingSheet, packOptionLabel, sizeChoices } from "@/domain/catalog-label";
import { lineAmount } from "@/domain/calc";
import { BRAND, formatVnd, tiktokUrl } from "@/lib/brand";
import { ShopLinksRow } from "@/components/site/shop-links";
import { flyToCart } from "@/lib/motion";
import { useCart } from "@/lib/cart";
import { ProductGallery } from "@/components/site/product-gallery";
import { galleryFor, mediaFor } from "@/lib/product-media";
import { discountPercent } from "@/lib/ship-estimate";
import { DEPOSIT, NO_RETURN, PAYMENT, REPRINT, SHIP_LARGE, SHIP_PICKUP, SHIP_SMALL } from "@/lib/public-policy";

export const Route = createFileRoute("/san-pham_/$slug")({
  validateSearch: (search: Record<string, unknown>): { v?: string } =>
    typeof search["v"] === "string" ? { v: search["v"] } : {},
  loader: async ({ context, params }) => {
    const [products, config] = await Promise.all([
      context.queryClient.ensureQueryData(catalogQueryOptions),
      context.queryClient.ensureQueryData(publicConfigQueryOptions),
    ]);
    const product = products.find((p) => p.slug === params.slug);
    if (!product) throw notFound();
    const phoneRaw = config.showZalo && config.phoneRaw ? config.phoneRaw : "";
    return { name: product.name, description: product.description, slug: product.slug, prices: product.variants.map((v) => v.price).filter((p): p is number => typeof p === "number"), phoneRaw };
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
      ...(loaderData.phoneRaw
        ? {
            seller: {
              "@type": "Organization",
              name: "Nhà In Thiên Thiên",
              telephone: loaderData.phoneRaw.startsWith("0") ? `+84${loaderData.phoneRaw.slice(1)}` : `+${loaderData.phoneRaw}`,
              url: "https://nhainthienthien.com",
            },
          }
        : {}),
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

function ProductPage() {
  const { slug } = Route.useParams();
  const { v: presetVariant } = Route.useSearch();
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const phone = showZalo ? config.data?.phone ?? "" : "";
  const zalo = showZalo ? config.data?.zalo ?? "" : "";
  const chatUrl = showZalo ? zalo : BRAND.messengerUrl;
  const chatLabel = showZalo ? `Nhắn Zalo${phone ? ` ${phone}` : ""}` : "Chat ngay";
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
  const selectedDesign = designs?.options.find((opt) => opt.key === design) ?? null;
  const gallery = useMemo(
    () => galleryFor(product.slug, product.cover_path, choices.length > 1 ? (choice?.key ?? null) : null, product.name, product.gallery),
    [product, choice?.key, choices.length],
  );
  const tiktok = tiktokUrl(product.slug);
  const others = products.filter((p) => p.slug !== product.slug);

  function pickSize(key: string) {
    const next = choices.find((c) => c.key === key);
    if (!next) return;
    setSizeKey(key);
    const kept = matchingSheet(next.variants, variant?.sheets ?? null, variant);
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

  function addToCart(event?: { currentTarget: Element }) {
    if (!ready() || !variant) return;
    cart.add(variant.id, qty, design ?? undefined);
    const first = gallery.find((m) => m.kind === "image");
    flyToCart(event?.currentTarget ?? null, first && first.kind === "image" ? first.src : null);
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
      <button type="button" onClick={addToCart} data-ripple className="btn-soft relative flex min-h-12 flex-1 items-center justify-center gap-1.5 overflow-hidden px-3 text-sm">
        <ShoppingCart className="size-5" aria-hidden /> Thêm vào giỏ
      </button>
      <button type="button" onClick={buyNow} className="btn-cta min-h-12 flex-1 px-3 text-sm">
        Mua ngay
      </button>
    </>
  );

  return (
    <div className="shop-ui min-h-screen bg-shop-bg pb-16 md:pb-0">
      <SiteHeader back title="Chi tiết sản phẩm" hideTabs />
      <main className="mx-auto max-w-6xl md:px-6 md:pt-4">
        <nav className="hidden items-center gap-1 py-2 text-sm text-muted-foreground md:flex" aria-label="Đường dẫn">
          <Link to="/" className="text-brand-blue hover:underline">Nhà In Thiên Thiên</Link>
          <ChevronRight className="size-4" />
          <Link to="/san-pham" search={{ cat: product.category }} className="text-brand-blue hover:underline">{product.category}</Link>
          <ChevronRight className="size-4" />
          <span className="truncate">{product.name}</span>
        </nav>

        <div className="md:card md:grid md:grid-cols-[minmax(0,450px)_minmax(0,1fr)] md:gap-8 md:p-5">
          <ProductGallery items={gallery} selectedSrc={selectedDesign?.image ?? null} selectedAlt={selectedDesign?.label} key={`${product.slug}-${choice?.key ?? ""}`} />

          <div className="min-w-0">
            {/* Giá */}
            <section className="card relative z-[1] mx-2.5 -mt-5 p-3.5 md:m-0 md:rounded-none md:bg-transparent md:p-0 md:shadow-none">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 rounded-2xl bg-gradient-to-r from-[#fff3e0] via-[#fff8ee] to-white px-3.5 py-3 md:px-5 md:py-4">
                <span className="text-[26px] font-extrabold tracking-tight text-sale md:text-[32px]">{price === null ? "Liên hệ" : formatVnd(price * 1)}</span>
                {price !== null && variant?.min_total ? (
                  <p className="mt-1 text-sm text-muted-foreground">Tối thiểu {formatVnd(variant.min_total)} / lần đặt (ít ảnh hơn vẫn tính mức này).</p>
                ) : null}
                {variant?.list_price ? <s className="text-sm text-muted-foreground">{formatVnd(variant.list_price)}</s> : null}
                {pct ? <span className="rounded-full bg-cta px-2 py-0.5 text-xs font-extrabold text-cta-foreground">-{pct}%</span> : null}
              </div>
              <h1 className="mt-3 text-[15px] !font-semibold leading-6 text-[#123047] md:text-xl">{product.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <FreeshipTag />
                <span className="pill pill-sale">COD</span>
                {variant ? <span className="text-xs text-muted-foreground">Đang chọn: {variant.name}</span> : null}
              </div>
            </section>

            <Link to="/chinh-sach" className="card mx-2.5 mt-2.5 flex items-center gap-2 px-3.5 py-3 md:mx-0 md:mt-4 md:rounded-2xl md:bg-[#f6f9fc] md:shadow-none">
              <PolicyChips className="min-w-0 flex-1" />
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>

            {/* Phân loại */}
            <section className="card mx-2.5 mt-2.5 p-3.5 md:mx-0 md:mt-2 md:rounded-none md:bg-transparent md:px-0 md:py-4 md:shadow-none">
              {choices.length > 1 ? (
                <div>
                  <p className="text-sm font-semibold text-[#123047]">Kích thước</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn kích thước">
                    {choices.map((c) => (
                      <VariantChip key={c.key} active={c.key === choice?.key} label={c.label} onClick={() => pickSize(c.key)} />
                    ))}
                  </div>
                </div>
              ) : null}

              {choice && choice.variants.length > 1 ? (
                <div className={choices.length > 1 ? "mt-4" : ""}>
                  <p className="text-sm font-semibold text-[#123047]">Phân loại{choices.length === 1 ? ` · ${choice.label}` : ""}</p>
                  <div className="mt-2 flex flex-wrap gap-2" role="radiogroup" aria-label="Chọn combo">
                    {choice.variants.map((item) => {
                      const p = amount(item);
                      return (
                        <VariantChip
                          key={item.id}
                          active={item.id === variant?.id}
                          label={packOptionLabel(item, product.slug === "trang-guong" ? "ảnh" : "tấm")}
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
                        className={`relative overflow-hidden rounded-xl bg-white text-left shadow-[0_0_0_1px_rgb(18_48_71/0.08)] transition-shadow ${design === opt.key ? "!shadow-[0_0_0_2px_var(--sale),0_8px_18px_-10px_rgb(180_83_9/0.7)]" : "hover:shadow-[0_0_0_1px_rgb(180_83_9/0.4)]"}`}
                      >
                        <img src={opt.image} alt={opt.label} loading="lazy" width={240} height={240} className="aspect-square w-full bg-muted object-cover" />
                        <span className="block truncate px-1 py-0.5 text-[10px] leading-4 text-foreground">{opt.label}</span>
                        {design === opt.key ? (
                          <span className="pop-in absolute right-1 top-1 grid size-5 place-items-center rounded-full bg-sale text-white shadow">
                            <Check className="size-3" />
                          </span>
                        ) : null}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              <div className="mt-4 flex items-center justify-between gap-3">
                <span className="text-sm font-semibold text-[#123047]">Số lượng</span>
                <Stepper value={qty} onChange={setQty} />
              </div>
              {price !== null && qty > 1 ? (
                <p className="mt-2 text-right text-sm text-muted-foreground">
                  Thành tiền: <span className="font-semibold text-sale">{formatVnd(lineAmount(price, qty, variant?.min_total) ?? price * qty)}</span>
                </p>
              ) : null}

              <div className="mt-5 hidden gap-3 md:flex">
                <a href={chatUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost flex min-h-12 items-center gap-1.5 px-5 text-sm font-semibold">
                  <MessageCircle className="size-5 text-brand-blue" aria-hidden /> {chatLabel}
                </a>
                {buyButtons}
              </div>
            </section>
          </div>
        </div>

        <div className="mx-2.5 mt-3 md:mx-0">
          <ShopInfoBlock hours={config.data?.hours} phone={phone} zalo={zalo} />
        </div>

        <div className="card mx-2.5 mt-3 px-3.5 py-3 md:mx-0 md:px-5">
          <ShopLinksRow tiktokHref={tiktok} />
        </div>

        <section className="card mx-2.5 mt-3 p-3.5 md:mx-0 md:p-5">
          <h2 className="section-title">Mô tả sản phẩm</h2>
          <div className="space-y-2 px-1 pt-3 text-sm leading-relaxed text-foreground/85">
            <p>{product.description}</p>
            {product.turnaround_text ? <p>Thời gian làm: {product.turnaround_text}</p> : null}
            {variant?.recommended_width_px && variant.recommended_height_px ? (
              <p className="text-muted-foreground">
                Ảnh nét nhất khi khổ {variant.width}×{variant.height} cm có ảnh gốc khoảng {variant.recommended_width_px}×{variant.recommended_height_px} px. Tiệm kiểm tra và báo lại nếu ảnh chưa đủ nét.
              </p>
            ) : null}
          </div>
          <h2 className="section-title mt-5">Vận chuyển & đổi trả</h2>
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
          <section className="mx-2.5 mt-4 md:mx-0">
            <h2 className="section-title px-1 pb-2.5">Sản phẩm khác của shop</h2>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
              {others.map((p) => (
                <ProductCard key={p.id} product={p} />
              ))}
            </div>
          </section>
        ) : null}
      </main>

      {/* Thanh mua cố định trên điện thoại */}
      <div className="site-sticky-bottom glass-bar fixed inset-x-0 bottom-0 z-50 flex gap-2 px-2.5 pb-[calc(env(safe-area-inset-bottom)+8px)] pt-2 md:hidden">
        <a href={chatUrl} target="_blank" rel="noopener noreferrer" className="flex min-h-12 w-14 shrink-0 flex-col items-center justify-center gap-0.5 text-[10px] font-semibold text-brand-blue">
          <MessageCircle className="size-5" aria-hidden /> {showZalo ? "Zalo" : "Chat"}
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
      className={`relative flex min-h-9 items-center gap-1 rounded-full px-3.5 py-1.5 text-left text-sm transition-[background-color,box-shadow,color] ${active ? "bg-[#fff3e0] font-semibold text-sale shadow-[0_0_0_1.5px_var(--sale)]" : "bg-[#f3f6fa] text-[#123047] hover:shadow-[0_0_0_1px_rgb(180_83_9/0.45)]"}`}
    >
      {active ? (
        <span className="pop-in grid size-4 place-items-center rounded-full bg-sale text-white">
          <Check className="size-3" />
        </span>
      ) : null}
      {label}
      {detail ? <span className={`ml-0.5 text-xs ${active ? "text-sale" : "text-muted-foreground"}`}>{detail}</span> : null}
    </button>
  );
}
