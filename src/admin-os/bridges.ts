/**
 * Deep-link StudioBase Manage cho phần bắt buộc OAuth / billing / VAPID.
 * Các module vận hành đã live local — không còn stub bridge trên menu.
 */
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

/** Giữ type cũ cho `admin.studio.$slug` nếu còn bookmark. */
export type BridgePhase = 2 | 3 | 4;

export type StudioBridge = {
  slug: string;
  label: string;
  managePath: string;
  phase: BridgePhase;
  blurb: string;
};

/** Không còn module bridge trên menu; map rỗng để `$slug` trả 404. */
export const STUDIO_BRIDGES: Record<string, StudioBridge> = {};
