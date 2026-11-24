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
      className="size-full object-cover transition-transform duration-500 ease-out group-hover:scale-[1.05]"
      onError={(event) => {
        event.currentTarget.src = catalogImage(product.slug, null);
      }}
    />
    </div>
  );
}

export function FreeshipTag({ className = "" }: { className?: string }) {
  return (
    <span className={`pill pill-blue ${className}`}>
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
      className="product-card card group flex flex-col rounded-2xl transition-[transform,box-shadow] duration-200 hover:-translate-y-1 hover:shadow-[0_0_0_1px_rgb(18_48_71/0.04),0_18px_36px_-16px_rgb(18_48_71/0.4)]"
    >
      <div className="relative overflow-hidden rounded-t-2xl">
        <ProductCover product={product} className="aspect-square w-full" />
        {pct ? (
          <span className="glass-chip absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-extrabold text-[#9a4508]">-{pct}%</span>
        ) : null}
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        <h3 className="line-clamp-2 min-h-[2.5rem] text-[13px] !font-medium leading-5 text-[#123047]">{product.name}</h3>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <FreeshipTag />
          <span className="pill pill-sale">COD</span>
        </div>
        <div className="mt-auto pt-1.5">
          <p className="flex flex-wrap items-baseline gap-x-1.5">
            <span className="text-[17px] font-extrabold tracking-tight text-sale">
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

export function ShopInfoBlock({ hours, phone, zalo }: { hours?: string | undefined; phone?: string | undefined; zalo?: string | undefined }) {
  return (
    <section className="card flex items-center gap-3 p-3 md:p-4">
      <img src="/brand/logo-vuong.png" alt="" className="size-14 shrink-0 rounded-full bg-white object-contain p-1 shadow-[0_0_0_1px_rgb(18_48_71/0.08),0_6px_14px_-8px_rgb(18_48_71/0.4)]" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold text-foreground">Nhà In Thiên Thiên</p>
        <p className="mt-0.5 text-xs text-muted-foreground">{BRAND.address}</p>
        {hours ? <p className="text-xs text-muted-foreground">Mở cửa {hours}</p> : null}
        {phone && zalo ? (
          <a href={zalo} target="_blank" rel="noopener noreferrer" className="mt-0.5 block text-xs font-semibold text-sale">
            Zalo {phone}
          </a>
        ) : null}
      </div>
      <Link to="/" className="btn-soft shrink-0 px-4 py-2 text-xs">
        Xem shop
      </Link>
    </section>
  );
}

export function Stepper({ value, onChange, min = 1, small }: { value: number; onChange: (n: number) => void; min?: number; small?: boolean }) {
  const size = small ? "size-7" : "size-9";
  return (
    <div className="flex items-center rounded-full bg-[#f1f4f8] p-0.5">
      <button type="button" aria-label="Giảm" disabled={value <= min} onClick={() => onChange(Math.max(min, value - 1))} className={`grid ${size} place-items-center rounded-full text-foreground hover:bg-white disabled:text-muted-foreground/50`}>
        <Minus className="size-4" />
      </button>
      <span className={`grid ${small ? "h-7 w-9" : "h-9 w-12"} place-items-center text-sm font-semibold tabular-nums`}>{value}</span>
      <button type="button" aria-label="Tăng" onClick={() => onChange(Math.min(500, value + 1))} className={`grid ${size} place-items-center rounded-full text-foreground hover:bg-white`}>
        <Plus className="size-4" />
      </button>
    </div>
  );
}

