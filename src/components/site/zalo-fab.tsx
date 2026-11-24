import { useQuery } from "@tanstack/react-query";
import { useRouterState } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { resolvePublicZaloHref } from "@/domain/public-contact";
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

/** Nút nổi Chat Zalo trên trang công khai — không hiện trong /admin. */
export function ZaloFab() {
  const admin = useRouterState({ select: (state) => state.location.pathname.startsWith("/admin") });
  const config = useQuery({ ...publicConfigQueryOptions, enabled: !admin });
  const href = resolvePublicZaloHref(admin ? undefined : config.data);
  const bottom = useClearanceAboveStickyBars(!admin);

  if (admin) return null;

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      data-zalo-fab="1"
      aria-label="Chat Zalo"
      className="zalo-fab"
      style={bottom != null ? { bottom } : undefined}
    >
      <span className="zalo-fab-pulse" aria-hidden />
      <span className="zalo-fab-mark">Zalo</span>
      <span className="zalo-fab-label">Chat Zalo</span>
    </a>
  );
}
