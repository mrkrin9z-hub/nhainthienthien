import { useQuery } from "@tanstack/react-query";

import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

/** Biểu tượng nền tảng, vẽ lại đơn giản (không dùng file logo của sàn). */
export function FacebookIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <circle cx="12" cy="12" r="12" fill="#1877F2" />
      <path
        fill="#fff"
        d="M13.4 24v-8.6h2.9l.45-3.4H13.4V9.85c0-.98.28-1.65 1.68-1.65h1.78V5.17a24 24 0 0 0-2.6-.13c-2.57 0-4.33 1.57-4.33 4.45V12H7v3.4h2.93V24z"
      />
    </svg>
  );
}

export function TikTokIcon({ className = "size-6" }: { className?: string }) {
  const note =
    "M16.6 5.82A4.28 4.28 0 0 1 15.54 3h-3.09v12.4a2.59 2.59 0 1 1-2.59-2.62c.27 0 .53.04.77.12V9.75a5.73 5.73 0 0 0-.77-.05A5.69 5.69 0 1 0 15.54 15.4V9.01a7.35 7.35 0 0 0 4.3 1.38V7.3a4.3 4.3 0 0 1-3.24-1.48z";
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#000" />
      <g transform="translate(1.2 1.6) scale(0.86)">
        <path d={note} fill="#25F4EE" transform="translate(-0.9 -0.9)" />
        <path d={note} fill="#FE2C55" transform="translate(0.9 0.9)" />
        <path d={note} fill="#fff" />
      </g>
    </svg>
  );
}

export function ShopeeIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#EE4D2D" />
      <path d="M8.6 8.2a3.4 3.4 0 0 1 6.8 0" fill="none" stroke="#fff" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M5.6 8.2h12.8l-.8 10.2a1.5 1.5 0 0 1-1.5 1.4H7.9a1.5 1.5 0 0 1-1.5-1.4z" fill="#fff" />
      <path
        d="M14.2 11.3c-.5-.5-1.2-.8-2.1-.8-1 0-1.8.55-1.8 1.4 0 1.9 3.9 1.1 3.9 3.1 0 .9-.85 1.5-2 1.5-.9 0-1.7-.35-2.2-.9"
        fill="none"
        stroke="#EE4D2D"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

export function ZaloIcon({ className = "size-6" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <rect width="24" height="24" rx="6" fill="#0068FF" />
      <path
        fill="#fff"
        d="M7.2 8.2c0-1.4 1.5-2.6 4.8-2.6s4.8 1.2 4.8 2.6v5.2c0 1.3-1.3 2.4-3.9 2.55l-2.5 1.85c-.28.2-.7 0-.7-.35v-1.5c-1.7-.4-2.5-1.4-2.5-2.55z"
      />
      <path
        fill="#0068FF"
        d="M10.15 9.15h1.12c.9 0 1.42.38 1.42 1.08 0 .5-.28.86-.74 1.02l.86 1.55h-1.06l-.74-1.4H11.2v1.4h-.96zm1.05 1.72c.32 0 .48-.16.48-.4s-.16-.4-.48-.4h-.17v.8z"
      />
    </svg>
  );
}

export const SHOP_LINKS = [
  { key: "facebook", label: "Fanpage", sub: "Nhà In Thiên Thiên", href: BRAND.facebookPageUrl, Icon: FacebookIcon },
  { key: "tiktok", label: "TikTok Shop", sub: BRAND.tiktokHandle, href: BRAND.tiktokShopUrl, Icon: TikTokIcon },
  { key: "shopee", label: "Shopee", sub: "nhainthienthien", href: BRAND.shopeeUrl, Icon: ShopeeIcon },
] as const;

/** Khối "Liên hệ & mua tại": 3 ô to, dễ bấm trên điện thoại. */
export function ShopLinksBlock({ title = "Liên hệ & mua tại", className = "" }: { title?: string; className?: string }) {
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const phone = showZalo ? config.data?.phone ?? "" : "";
  const zalo = showZalo ? config.data?.zalo ?? "" : "";
  const resolved = SHOP_LINKS.map((link) => {
    if (link.key === "tiktok") {
      return { ...link, href: config.data?.tiktokUrl || link.href, sub: config.data?.tiktokHandle || link.sub };
    }
    if (link.key === "facebook") return { ...link, href: config.data?.facebookUrl || link.href };
    if (link.key === "shopee") return { ...link, href: config.data?.shopeeUrl || link.href };
    return link;
  });
  const links = showZalo
    ? [...resolved, { key: "zalo", label: "Zalo", sub: phone, href: zalo, Icon: ZaloIcon }]
    : resolved;
  return (
    <div className={className}>
      {title ? (
        <h2 className="font-sans text-xs font-bold tracking-[0.16em] text-foreground uppercase">{title}</h2>
      ) : null}
      <div className={`mt-3 grid gap-2 ${showZalo ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
        {links.map(({ key, label, sub, href, Icon }) => (
          <a
            key={key}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label}: ${sub} (mở tab mới)`}
            className="press flex min-h-[84px] flex-col items-center justify-center gap-1.5 rounded-2xl bg-white px-1 py-2.5 text-center shadow-[0_0_0_1px_rgb(18_48_71/0.06),0_8px_20px_-14px_rgb(18_48_71/0.4)] transition hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_rgb(21_94_154/0.25),0_12px_24px_-14px_rgb(18_48_71/0.45)] active:scale-[0.98]"
          >
            <Icon className="size-9" />
            <span className="text-[13px] leading-tight font-semibold text-foreground">{label}</span>
            <span className="w-full truncate text-[11px] leading-tight text-muted-foreground">{sub}</span>
          </a>
        ))}
      </div>
    </div>
  );
}

/** Hàng nhỏ "Mua tại sàn" cho trang sản phẩm. tiktokHref: link sản phẩm trên TikTok Shop nếu có. */
export function ShopLinksRow({ tiktokHref }: { tiktokHref?: string | null }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
      <span className="shrink-0 text-sm font-semibold text-[#123047]">Mua tại sàn</span>
      <div className="grid grid-cols-3 gap-2 sm:flex">
        {SHOP_LINKS.map(({ key, label, href, Icon }) => (
          <a
            key={key}
            href={key === "tiktok" && tiktokHref ? tiktokHref : href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${label} (mở tab mới)`}
            className="press inline-flex min-h-11 items-center justify-center gap-1.5 rounded-full bg-[#f3f6fa] px-2 text-[13px] font-semibold whitespace-nowrap text-[#123047] transition hover:bg-white hover:shadow-[0_0_0_1px_rgb(21_94_154/0.3)] sm:pr-3 sm:pl-1.5"
          >
            <Icon className="size-6 shrink-0" />
            {label}
          </a>
        ))}
      </div>
    </div>
  );
}
