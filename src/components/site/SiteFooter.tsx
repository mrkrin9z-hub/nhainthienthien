import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { LOGO_HORIZONTAL } from "@/lib/assets";
import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";
import { ShopLinksBlock } from "@/components/site/shop-links";

export function SiteFooter() {
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const phone = showZalo ? config.data?.phone ?? "" : "";
  const zalo = showZalo ? config.data?.zalo ?? "" : "";
  return (
    <footer className="mt-4 rounded-t-[28px] bg-white/85 pb-24 shadow-[0_-12px_40px_-28px_rgb(18_48_71/0.45)] md:mt-8 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-6 px-4 py-6 md:grid-cols-4 md:gap-10 md:px-6 md:py-8">
        <div className="md:col-span-2">
          <img src={LOGO_HORIZONTAL} alt={BRAND.name} width={120} height={40} loading="lazy" decoding="async" className="h-10 w-auto" />
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {BRAND.slogan} {BRAND.message}
          </p>
          <ShopLinksBlock className="mt-5 max-w-sm" />
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-sans text-xs font-bold tracking-[0.16em] text-foreground uppercase">Gian hàng</h2>
          <Link to="/san-pham" className="block text-foreground/80 hover:text-sale">
            Sản phẩm và giá
          </Link>
          <Link to="/dat-in" className="block text-foreground/80 hover:text-sale">
            Đặt in
          </Link>
          <Link to="/huong-dan" className="block text-foreground/80 hover:text-sale">
            Hướng dẫn
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-sans text-xs font-bold tracking-[0.16em] text-foreground uppercase">Đơn hàng</h2>
          <Link to="/tra-cuu" className="block text-foreground/80 hover:text-sale">
            Tra cứu đơn
          </Link>
          <Link to="/lien-he" className="block text-foreground/80 hover:text-sale">
            Liên hệ
          </Link>
          <Link to="/chinh-sach" className="block text-foreground/80 hover:text-sale">
            Chính sách
          </Link>
          {showZalo ? (
            <a href={zalo} className="block font-semibold text-sale">
              Zalo {phone}
            </a>
          ) : null}
          <p className="text-muted-foreground">{config.data?.address || BRAND.address}</p>
          {config.data?.hours ? <p className="text-muted-foreground">Mở cửa {config.data.hours}</p> : null}
          <p className="text-muted-foreground">{BRAND.website}</p>
        </div>
      </div>
      <div className="border-t border-[#123047]/5 py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name}
      </div>
    </footer>
  );
}
