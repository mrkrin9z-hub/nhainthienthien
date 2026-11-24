import { BRAND, mapsDirectionsUrl, resolveFacebookHref, resolveShopeeHref, resolveTiktokHref, tiktokHandleOrDefault } from "@/lib/brand";
import type { Settings, SiteContent } from "./types.ts";

export const DEFAULT_COMMITMENTS = [
  "In từ ảnh của bạn, màu chuẩn 4K.",
  "Freeship từ 300.000đ, nhận hàng COD.",
  "Đổi ảnh nếu lỗi in của tiệm.",
];

export function defaultSiteContent(): Required<Pick<SiteContent, "heroTitle" | "heroSubtitle" | "banner" | "address" | "hours" | "facebookUrl" | "tiktokUrl" | "tiktokHandle" | "shopeeUrl" | "mapsUrl" | "commitments">> & { region: string } {
  return {
    heroTitle: "Ảnh tráng gương 4K – in từ ảnh của bạn",
    heroSubtitle: `${BRAND.shortName} · ${BRAND.region} · Giao tận nơi`,
    banner: "",
    address: BRAND.address,
    hours: "08:00–18:00",
    facebookUrl: BRAND.facebookPageUrl,
    tiktokUrl: BRAND.tiktokShopUrl,
    tiktokHandle: BRAND.tiktokHandle,
    shopeeUrl: BRAND.shopeeUrl,
    mapsUrl: BRAND.mapsUrl,
    commitments: [...DEFAULT_COMMITMENTS],
    region: BRAND.region,
  };
}

export function resolveSiteContent(partial?: SiteContent | null, settings?: Pick<Settings, "publicHours"> | null) {
  const base = defaultSiteContent();
  const hours = (partial?.hours?.trim() || settings?.publicHours?.trim() || base.hours).slice(0, 80);
  const handle = tiktokHandleOrDefault(partial?.tiktokHandle?.trim() || base.tiktokHandle).slice(0, 40);
  const tiktokUrl = resolveTiktokHref(partial?.tiktokUrl?.trim() || `https://www.tiktok.com/${handle}`, handle).slice(0, 200);
  const commitments = (partial?.commitments ?? [])
    .map((item) => item.trim().slice(0, 160))
    .filter(Boolean);
  return {
    ...base,
    ...partial,
    heroTitle: (partial?.heroTitle?.trim() || base.heroTitle).slice(0, 120),
    heroSubtitle: (partial?.heroSubtitle?.trim() || base.heroSubtitle).slice(0, 160),
    banner: (partial?.banner ?? "").trim().slice(0, 200),
    address: (partial?.address?.trim() || base.address).slice(0, 200),
    hours,
    facebookUrl: resolveFacebookHref(partial?.facebookUrl?.trim() || base.facebookUrl).slice(0, 200),
    tiktokHandle: handle,
    tiktokUrl,
    shopeeUrl: resolveShopeeHref(partial?.shopeeUrl?.trim() || base.shopeeUrl).slice(0, 200),
    mapsUrl: mapsDirectionsUrl(partial?.mapsUrl?.trim() || base.mapsUrl).slice(0, 400),
    commitments: commitments.length ? commitments : base.commitments,
    region: base.region,
  };
}
