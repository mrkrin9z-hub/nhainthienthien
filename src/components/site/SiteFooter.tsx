import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { LOGO_HORIZONTAL } from "@/lib/assets";
import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

export function SiteFooter() {
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const phone = showZalo ? config.data?.phone ?? "" : "";
  const zalo = showZalo ? config.data?.zalo ?? "" : "";
  return (
    <footer className="mt-20 border-t border-border bg-card pb-24 md:pb-0">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-12 md:grid-cols-4 md:px-6">
        <div className="md:col-span-2">
          <img src={LOGO_HORIZONTAL} alt={BRAND.name} className="h-10 w-auto" />
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {BRAND.slogan} {BRAND.message}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-sans text-xs font-bold tracking-[0.16em] text-primary uppercase">Gian hàng</h2>
          <Link to="/san-pham" className="block text-foreground/80 hover:text-primary">
            Sản phẩm và giá
          </Link>
          <Link to="/dat-in" className="block text-foreground/80 hover:text-primary">
            Đặt in
          </Link>
          <Link to="/huong-dan" className="block text-foreground/80 hover:text-primary">
            Hướng dẫn
          </Link>
        </div>
        <div className="space-y-2 text-sm">
          <h2 className="font-sans text-xs font-bold tracking-[0.16em] text-primary uppercase">Đơn hàng</h2>
          <Link to="/tra-cuu" className="block text-foreground/80 hover:text-primary">
            Tra cứu đơn
          </Link>
          <Link to="/lien-he" className="block text-foreground/80 hover:text-primary">
            Liên hệ
          </Link>
          {showZalo ? (
            <a href={zalo} className="block font-semibold text-primary">
              Zalo {phone}
            </a>
          ) : null}
          <p className="text-muted-foreground">{BRAND.website}</p>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} {BRAND.name}
      </div>
    </footer>
  );
}
