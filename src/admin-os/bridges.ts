/**
 * Deep-link StudioBase — tin mẫu / OAuth kênh chat.
 */
export const STUDIOBASE_MANAGE_ORIGIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_STUDIOBASE_MANAGE_ORIGIN?: string } }).env?.VITE_STUDIOBASE_MANAGE_ORIGIN?.replace(
      /\/$/,
      "",
    )) ||
  "https://studiobase.vn";

export const STUDIOBASE_CHAT_ORIGIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_STUDIOBASE_CHAT_ORIGIN?: string } }).env?.VITE_STUDIOBASE_CHAT_ORIGIN?.replace(
      /\/$/,
      "",
    )) ||
  "https://chat.studiobase.vn";

export function studioManageUrl(managePath: string): string {
  const path = managePath.startsWith("/") ? managePath : `/${managePath}`;
  return `${STUDIOBASE_MANAGE_ORIGIN}${path}`;
}

export type BridgePhase = 2 | 3 | 4;

export type StudioBridge = {
  slug: string;
  label: string;
  managePath: string;
  phase: BridgePhase;
  blurb: string;
};

/** Chỉ tin mẫu & kênh còn deep-link (OAuth / UI StudioBase Chat). */
export const STUDIO_BRIDGES: Record<string, StudioBridge> = {
  "tin-mau": {
    slug: "tin-mau",
    label: "Tin mẫu & kênh chat",
    managePath: "/manage/messages/settings",
    phase: 4,
    blurb: "Soạn tin mẫu và nối Fanpage/Zalo trên StudioBase Chat — app Thiên Thiên dùng Partner API, không OAuth trong app.",
  },
};
