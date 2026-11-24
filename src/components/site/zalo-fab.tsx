import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { FacebookIcon, ShopeeIcon, TikTokIcon, ZaloIcon } from "@/components/site/shop-links";
import { resolvePublicZaloHref } from "@/domain/public-contact";
import { isStaffPath } from "@/domain/site-chrome";
import { resolveFacebookHref, resolveShopeeHref, resolveTiktokHref } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

const GAP_PX = 16;

function useClearanceAboveStickyBars(enabled: boolean) {
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [bottom, setBottom] = useState<number | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    const measure = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const nodes = document.querySelectorAll<HTMLElement>(".site-bottom-nav, .site-sticky-bottom");
        let max = 0;
        for (const node of nodes) {
          const rect = node.getBoundingClientRect();
          if (rect.height < 8) continue;
          if (rect.bottom < window.innerHeight - 2) continue;
          max = Math.max(max, window.innerHeight - rect.top);
        }
        setBottom(max + GAP_PX);
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    document.querySelectorAll(".site-bottom-nav, .site-sticky-bottom").forEach((node) => observer.observe(node));
    window.addEventListener("resize", measure);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, [enabled, pathname]);

  return bottom;
}

/** Cụm nút nổi logo (Zalo, TikTok Shop, Shopee, Fanpage) — ẩn trên admin/staff. */
export function ZaloFab() {
  const admin = useRouterState({ select: (state) => isStaffPath(state.location.pathname) });
  const config = useQuery({ ...publicConfigQueryOptions, enabled: !admin });
  const bottom = useClearanceAboveStickyBars(!admin);

  if (admin) return null;

  const links = [
    { key: "zalo", href: resolvePublicZaloHref(config.data), label: "Chat Zalo", Icon: ZaloIcon },
    { key: "tiktok", href: resolveTiktokHref(config.data?.tiktokUrl), label: "TikTok Shop", Icon: TikTokIcon },
    { key: "shopee", href: resolveShopeeHref(config.data?.shopeeUrl), label: "Shopee", Icon: ShopeeIcon },
    { key: "facebook", href: resolveFacebookHref(config.data?.facebookUrl), label: "Fanpage Facebook", Icon: FacebookIcon },
  ];

  return (
    <nav
      data-zalo-fab="1"
      data-social-fab="1"
      aria-label="Liên hệ nhanh"
      className="zalo-fab"
      style={bottom != null ? { bottom } : undefined}
    >
      {links.map((item) => (
        <a
          key={item.key}
          href={item.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`${item.label} (mở tab mới)`}
          data-social-fab-item={item.key}
          className="social-fab-btn"
        >
          <item.Icon className="size-full" />
        </a>
      ))}
    </nav>
  );
}
