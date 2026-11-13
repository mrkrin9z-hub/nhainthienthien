import { Link } from "@tanstack/react-router";

import { BRAND, formatVnd } from "@/lib/brand";
import { discountPercent } from "@/lib/ship-estimate";

/** Ảnh bìa trang chủ (bố cục ghép ảnh, phương án 3 – ảnh AI theo sản phẩm thật). */
export const HERO_MAIN_MOBILE = "/media/hero/deban-13x18.webp";
export const HERO_MAIN_DESKTOP = "/media/hero/deban-combo4.webp";

type Variant = { id: string; price: number | null; list_price?: number | null };
type Product = { slug: string; variants: Variant[] };

const NAVY = "#123047";

function priceOf(products: Product[], slug: string, id: string | null, fallback: number) {
  const product = products.find((p) => p.slug === slug);
  const variant = id ? product?.variants.find((v) => v.id === id) : product?.variants[0];
  return { id: variant?.id ?? id, price: variant?.price ?? fallback, list: variant?.list_price ?? null };
}

function SideTile({
  to,
  slug,
  v,
  img,
  imgDesktop,
  pos,
  title,
  price,
  className = "",
}: {
  to: "/san-pham/$slug";
  slug: string;
  v?: string | null;
  img: string;
  imgDesktop?: string;
  pos?: string;
  title: string;
  price: string;
  className?: string;
}) {
  return (
    <Link
      to={to}
      params={{ slug }}
      search={v ? { v } : {}}
      className={`hero-tile relative block overflow-hidden rounded-[14px] bg-[#dfe6ee] text-white ${className}`}
    >
      <picture>
        {imgDesktop ? <source media="(min-width: 768px)" srcSet={imgDesktop} /> : null}
        <img
          src={img}
          alt={title}
          width={640}
          height={480}
          loading="lazy"
          decoding="async"
          className="absolute inset-0 size-full object-cover"
          style={pos ? { objectPosition: pos } : undefined}
        />
      </picture>
      <span className="absolute inset-0 bg-gradient-to-b from-transparent from-35% to-[rgb(18_48_71/0.88)]" aria-hidden />
      <span className="absolute inset-x-2.5 bottom-2 z-[1] md:inset-x-3 md:bottom-2.5">
        <b className="block text-[13px] leading-tight md:text-base">{title}</b>
        <span className="block text-lg font-extrabold tracking-tight text-[#ffd38a] md:text-2xl">{price}</span>
      </span>
    </Link>
  );
}

export function HomeHero({ products }: { products: Product[] }) {
  const combo = priceOf(products, "trang-guong", "TG-13x18-C4", 100000);
  const comboList = combo.list ?? 190000;
  const pct = discountPercent(combo.price, comboList);
  const wall = priceOf(products, "trang-guong", "TG-40x60-C1", 149000);
  const desk20 = priceOf(products, "trang-guong", "TG-20x30-C1", 56000);
  const magnet = priceOf(products, "nam-cham-xe", null, 65000);
  const tkb = priceOf(products, "thoi-khoa-bieu", "TKB-20x30-C1", 70000);

  return (
    <section className="bg-white p-2.5 md:bg-transparent md:px-0 md:pb-3 md:pt-0">
      <div className="grid h-[clamp(300px,80vw,380px)] grid-cols-[1.25fr_1fr] grid-rows-2 gap-2 md:h-[420px] md:grid-cols-[1.5fr_1fr_1fr] md:gap-3">
        <Link
          to="/san-pham/$slug"
          params={{ slug: "trang-guong" }}
          search={{ v: combo.id ?? "TG-13x18-C4" }}
          className="hero-tile row-span-2 flex flex-col overflow-hidden rounded-[14px] text-white"
          style={{ backgroundColor: NAVY }}
        >
          <div className="relative shrink-0 basis-[44%] overflow-hidden bg-[#dfe6ee] md:basis-1/2">
            <picture>
              <source media="(min-width: 768px)" srcSet={HERO_MAIN_DESKTOP} width={1100} height={825} />
              <img
                src={HERO_MAIN_MOBILE}
                alt="Ảnh tráng gương để bàn in từ ảnh gia đình"
                width={720}
                height={720}
                fetchPriority="high"
                loading="eager"
                className="absolute inset-0 size-full object-cover object-[center_38%] md:object-[center_58%]"
              />
            </picture>
            <span className="absolute inset-0 bg-gradient-to-b from-transparent from-55% to-[#123047]" aria-hidden />
            <span className="absolute left-2.5 top-2.5 z-[1] rounded-full bg-cta px-2.5 py-1 text-[11px] font-extrabold text-[#1b1300] md:left-3 md:top-3 md:text-xs">
              Combo 4 ảnh 13×18
            </span>
          </div>
          <div className="relative z-[1] -mt-5 flex flex-1 flex-col justify-end px-3 pb-3 md:px-6 md:pb-5">
            <h1 className="text-[17px] font-extrabold leading-[1.15] md:text-[30px]">
              Ảnh tráng gương 4K – <span className="text-cta">in từ ảnh của bạn</span>
            </h1>
            <div className="mt-1.5 flex flex-wrap items-center gap-x-2 md:mt-1">
              <span className="text-[26px] font-extrabold leading-tight tracking-tight md:text-[38px]">
                {formatVnd(combo.price)}
                <s className="block text-[13px] font-semibold opacity-75 md:ml-2 md:inline">{formatVnd(comboList)}</s>
              </span>
              {pct ? (
                <span className="rounded bg-white px-1.5 py-0.5 text-[11px] font-extrabold text-[#e3570b]">-{pct}%</span>
              ) : null}
            </div>
            <div className="mt-1.5 flex flex-col-reverse items-start gap-2 md:flex-row md:items-center md:gap-3">
              <span className="self-center rounded-full bg-cta px-4 py-2.5 text-[13px] font-bold text-[#1b1300] shadow-[0_6px_16px_rgb(244_158_13/0.35)] md:self-auto md:px-6 md:py-3 md:text-base">
                Mua ngay ›
              </span>
              <span className="flex flex-nowrap gap-1">
                <span className="whitespace-nowrap rounded-full border border-white/40 bg-white/15 px-[7px] py-[3px] text-[10.5px] font-semibold md:px-3 md:py-1.5 md:text-[13px]">
                  🚚 Freeship từ 300k
                </span>
                <span className="whitespace-nowrap rounded-full border border-white/40 bg-white/15 px-[7px] py-[3px] text-[10.5px] font-semibold md:px-3 md:py-1.5 md:text-[13px]">
                  💵 COD
                </span>
              </span>
            </div>
          </div>
        </Link>
        <SideTile
          to="/san-pham/$slug"
          slug="trang-guong"
          v={wall.id}
          img="/media/hero/treo-40x60-doc.webp"
          imgDesktop="/media/hero/treo-40x60-ngang.webp"
          pos="center 35%"
          title="Ảnh treo tường 40×60"
          price={formatVnd(wall.price)}
        />
        <SideTile
          to="/san-pham/$slug"
          slug="nam-cham-xe"
          img="/media/hero/namcham-laimoi.webp"
          pos="45% 55%"
          title="Nam châm Lái Mới"
          price={formatVnd(magnet.price)}
        />
        <SideTile
          to="/san-pham/$slug"
          slug="thoi-khoa-bieu"
          v={tkb.id}
          img="/media/hero/tkb.webp"
          title="Thời khóa biểu"
          price={formatVnd(tkb.price)}
          className="hidden md:block"
        />
        <SideTile
          to="/san-pham/$slug"
          slug="trang-guong"
          v={desk20.id}
          img="/media/hero/deban-20x30.webp"
          title="Ảnh để bàn 20×30"
          price={`từ ${formatVnd(desk20.price)}`}
          className="hidden md:block"
        />
      </div>
      <p className="flex items-center gap-2 px-0.5 pt-2 text-xs text-[#5b6b7a] md:text-sm">
        <img src="/brand/icon-192.png" alt="" width={22} height={22} loading="lazy" decoding="async" className="size-[22px] rounded-full" />
        Nhà In Thiên Thiên · {BRAND.region} · Giao tận nơi
      </p>
    </section>
  );
}
