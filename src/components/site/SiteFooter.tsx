import { Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { BadgeCheck, Globe, MapPin, MessageCircle } from "lucide-react";

import { LOGO_HORIZONTAL } from "@/lib/assets";
import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

export function SiteFooter() {
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data ? config.data.showZalo : true;
  const phone = showZalo ? (config.data?.phone || BRAND.phone) : "";
  const zalo = showZalo ? (config.data?.zalo || BRAND.zalo) : "";
  return (
    <footer className="mt-16 border-t border-border bg-card/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3 md:px-6">
        <div>
          <img src={LOGO_HORIZONTAL} alt={BRAND.name} className="h-11 w-auto" />
          <p className="mt-3 text-sm text-muted-foreground">
            {BRAND.slogan} {BRAND.message}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="text-base font-bold text-primary">Liên hệ</h3>
          {showZalo ? (
            <p className="flex items-center gap-2">
              <MessageCircle className="size-4 text-accent" />
              <a href={zalo} className="font-semibold hover:text-primary">
                Zalo {phone}
              </a>
            </p>
          ) : null}
          <p className="flex items-center gap-2">
            <MapPin className="size-4 text-accent" /> {BRAND.region}
          </p>
          <p className="flex items-center gap-2">
            <Globe className="size-4 text-accent" /> {BRAND.website}
          </p>
        </div>
        <div className="space-y-2 text-sm">
          <h3 className="text-base font-bold text-primary">Liên kết</h3>
          <Link to="/san-pham" className="block hover:text-primary">
            Sản phẩm & bảng giá
          </Link>
          <Link to="/huong-dan" className="block hover:text-primary">
            Hướng dẫn đặt in
          </Link>
          <Link to="/tra-cuu" className="block hover:text-primary">
            Tra cứu đơn hàng
          </Link>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1">
          <BadgeCheck className="size-3.5 text-accent" /> © {new Date().getFullYear()} {BRAND.name}
        </span>
      </div>
    </footer>
  );
}
