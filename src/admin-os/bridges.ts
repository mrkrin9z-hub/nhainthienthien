/**
 * StudioBase chỉ phục vụ ủy quyền Facebook (app Meta sẵn có).
 * Không còn deep-link Manage / bridge module vận hành.
 */

export const STUDIOBASE_MANAGE_ORIGIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_STUDIOBASE_MANAGE_ORIGIN?: string } }).env?.VITE_STUDIOBASE_MANAGE_ORIGIN?.replace(
      /\/$/,
      "",
    )) ||
  "https://studiobase.vn";

/** @deprecated Không dùng bridge Manage — giữ export để test cũ không vỡ import. */
export function studioManageUrl(managePath: string): string {
  const path = managePath.startsWith("/") ? managePath : `/${managePath}`;
  return `${STUDIOBASE_MANAGE_ORIGIN}${path}`;
}

export const STUDIO_BRIDGES: Record<string, never> = {};
