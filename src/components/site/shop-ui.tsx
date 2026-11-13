import { Link } from "@tanstack/react-router";
import { Banknote, ImageOff, MapPin, Minus, Plus, RotateCcw, Store, Truck } from "lucide-react";

import { BRAND, formatVnd } from "@/lib/brand";
import { minListPrice, minPrice, type CatalogProduct } from "@/lib/catalog.functions";
import { hasPlaceholderCover } from "@/lib/product-media";
import { catalogImage } from "@/lib/product-images";
import { discountPercent } from "@/lib/ship-estimate";

export function ImagePlaceholder({ className = "" }: { className?: string }) {
  return (
    <div className={`grid place-items-center bg-muted text-muted-foreground ${className}`}>
      <span className="flex flex-col items-center gap-1 text-xs">
        <ImageOff className="size-6" aria-hidden />
        Ảnh đang cập nhật
      </span>
    </div>
  );
}

export function ProductCover({ product, className }: { product: CatalogProduct; className: string }) {
  if (hasPlaceholderCover(product.slug)) return <ImagePlaceholder className={className} />;
  return (
    <div className={`skeleton overflow-hidden ${className}`}>
    <img
      src={catalogImage(product.slug, product.cover_path)}
      alt={`Ảnh mẫu ${product.name}`}
      loading="lazy"
      decoding="async"
      width={600}
      height={600}
      className="size-full object-cover"
      onError={(event) => {
        event.currentTarget.src = catalogImage(product.slug, null);
      }}
    />
    </div>
  );
}

export function FreeshipTag({ className = "" }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-0.5 rounded-sm border border-brand-blue/70 px-1 text-[10px] font-semibold leading-4 text-brand-blue ${className}`}>
      <Truck className="size-3" aria-hidden /> Freeship từ 300k
    </span>
  );
}

/** Thẻ sản phẩm dạng lưới như app sàn. Không có số đã bán / sao vì chưa có dữ liệu thật. */
export function ProductCard({ product }: { product: CatalogProduct }) {
  const from = minPrice(product);
  const list = minListPrice(product);
  const pct = discountPercent(from, list);
  const many = new Set(product.variants.map((v) => v.price)).size > 1;
  return (
    <Link
      to="/san-pham/$slug"
      params={{ slug: product.slug }}
      className="product-card group flex flex-col overflow-hidden rounded-sm bg-white shadow-[0_1px_2px_rgb(0_0_0/0.08)] transition duration-200 hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative">
        <ProductCover product={product} className="aspect-square w-full" />
        {pct ? (
          <span className="absolute right-0 top-0 rounded-bl-sm bg-cta px-1.5 py-0.5 text-xs font-bold text-cta-foreground">-{pct}%</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-2">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] font-normal leading-5 text-foreground">{product.name}</h3>
        <div className="mt-1 flex flex-wrap gap-1">
          <FreeshipTag />
          <span className="rounded-sm border border-sale/60 px-1 text-[10px] font-semibold leading-4 text-sale">COD</span>
        </div>
        <div className="mt-auto pt-1.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-base font-semibold text-sale">
              {from === null ? "Liên hệ" : formatVnd(from)}
            </span>
            {many && from !== null ? <span className="text-[11px] text-muted-foreground">trở lên</span> : null}
          </p>
          {list ? <p className="text-[11px] text-muted-foreground line-through">{formatVnd(list)}</p> : null}
          <p className="mt-1 flex items-center gap-0.5 text-[11px] text-muted-foreground">
            <MapPin className="size-3" aria-hidden /> Đồng Nai
          </p>
        </div>
      </div>
    </Link>
  );
}

export const POLICY_CHIPS = [
  { icon: Banknote, label: "Thanh toán khi nhận (COD)" },
  { icon: Truck, label: "Ship 25k · Freeship từ 300k" },
  { icon: RotateCcw, label: "In lại nếu lỗi xưởng (báo trong 3 ngày)" },
  { icon: Store, label: "Nhận tại tiệm 0đ" },
] as const;

export function PolicyChips({ className = "" }: { className?: string }) {
  return (
    <ul className={`flex flex-wrap gap-x-4 gap-y-2 text-xs text-foreground/80 ${className}`}>
      {POLICY_CHIPS.map((chip) => (
        <li key={chip.label} className="flex items-center gap-1">
          <chip.icon className="size-4 shrink-0 text-brand-blue" aria-hidden />
          {chip.label}
        </li>
      ))}
    </ul>
  );
}

export function ShopInfoBlock({ hours }: { hours?: string | undefined }) {
  return (
    <section className="flex items-center gap-3 bg-white p-3 md:p-4">
      <img src="/brand/logo-vuong.png" alt="" className="size-14 shrink-0 rounded-full border border-border object-contain p-1" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Nhà In Thiên Thiên</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{BRAND.address}</p>
        {hours ? <p className="text-xs text-muted-foreground">Mở cửa {hours}</p> : null}
      </div>
      <Link to="/" className="shrink-0 rounded-sm border border-brand-blue px-3 py-1.5 text-xs font-semibold text-brand-blue">
        Xem shop
      </Link>
    </section>
  );
}

export function Stepper({ value, onChange, min = 1, small }: { value: number; onChange: (n: number) => void; min?: number; small?: boolean }) {
  const size = small ? "size-7" : "size-9";
  return (
    <div className="flex items-center border border-border">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={`grid ${size} place-items-center text-foreground disabled:text-muted-foreground/50`}>
        <Minus className="size-4" />
      </button>
      <span className={`grid ${small ? "h-7 w-9" : "h-9 w-12"} place-items-center border-x border-border text-sm`}>{value}</span>
      <button type="button" aria-label="Tăng" onClick={() => onChange(Math.min(500, value + 1))} className={`grid ${size} place-items-center text-foreground`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

