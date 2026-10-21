/**
 * Module chưa có API Partner / chưa port local — hiện bridge trong shell
 * (deep-link StudioBase Manage hoặc “đang kết nối”).
 * Không gồm garment / AI tools (studio-chụp).
 * Phase 2–4 đã live local: chi nhánh, bộ phận, nhóm quyền, mục tiêu, SePay stub,
 * đánh giá, TB nội bộ, tài liệu, hướng dẫn.
 */
export type BridgePhase = 2 | 3 | 4;

export type StudioBridge = {
  slug: string;
  label: string;
  managePath: string;
  phase: BridgePhase;
  blurb: string;
};

export const STUDIO_BRIDGES: Record<string, StudioBridge> = {
  "chien-dich": {
    slug: "chien-dich",
    label: "Chiến dịch",
    managePath: "/manage/campaigns",
    phase: 4,
    blurb: "Nguồn / chiến dịch ads (tuỳ chọn).",
  },
  "thong-bao": {
    slug: "thong-bao",
    label: "Thông báo đẩy",
    managePath: "/manage/settings/notifications",
    phase: 4,
    blurb: "Web Push / PWA — cần VAPID trên StudioBase.",
  },
  "tin-mau": {
    slug: "tin-mau",
    label: "Tin mẫu & kênh chat",
    managePath: "/manage/messages/settings",
    phase: 4,
    blurb: "Nối Fanpage/Zalo, tin mẫu, auto-reply — OAuth trên StudioBase.",
  },
  goi: {
    slug: "goi",
    label: "Gói dịch vụ",
    managePath: "/manage/subscription",
    phase: 4,
    blurb: "Gói StudioBase của owner.",
  },
};

/** Origin Manage (deep-link). Có thể đổi qua VITE_STUDIOBASE_MANAGE_ORIGIN lúc build. */
export const STUDIOBASE_MANAGE_ORIGIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_STUDIOBASE_MANAGE_ORIGIN?: string } }).env?.VITE_STUDIOBASE_MANAGE_ORIGIN?.replace(
      /\/$/,
      "",
    )) ||
  "https://studiobase.vn";

export function studioManageUrl(managePath: string): string {
  const path = managePath.startsWith("/") ? managePath : `/${managePath}`;
  return `${STUDIOBASE_MANAGE_ORIGIN}${path}`;
}
