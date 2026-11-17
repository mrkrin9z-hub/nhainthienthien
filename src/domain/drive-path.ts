import { vnMonth } from "./calc.ts";

/** Thư mục gốc trên Drive của chủ, theo nguồn đơn. */
export function driveRootName(order: { source?: string | null; channel?: string | null }): string {
  if (order.source === "web") return "Đơn web";
  if (order.channel === "facebook") return "Đơn Facebook";
  if (order.channel === "tiktok") return "Đơn TikTok";
  if (order.channel === "shopee") return "Đơn Shopee";
  if (order.channel === "mo_home") return "Đơn Mơ Home";
  return "Đơn tại tiệm";
}

export function driveCustomerPart(name: string): string {
  const clean = name.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Khách").slice(0, 60);
}

/** `Album khách / <số điện thoại>`. */
export function albumFolderParts(phone: string): [string, string] {
  return ["Album khách", phone];
}

/** Thư mục media dùng chung của tiệm trên Drive. */
export const MEDIA_ROOT = "NHÀ IN THIÊN THIÊN" as const;
export const MEDIA_DIR = "MEDIA" as const;
export const MEDIA_INBOX = "Inbox" as const;

/** `NHÀ IN THIÊN THIÊN / MEDIA`. */
export function mediaRootParts(): [string, string] {
  return [MEDIA_ROOT, MEDIA_DIR];
}

/** `NHÀ IN THIÊN THIÊN / MEDIA / Inbox` — file mới từ QR/link. */
export function mediaInboxParts(): [string, string, string] {
  return [MEDIA_ROOT, MEDIA_DIR, MEDIA_INBOX];
}

/** `NHÀ IN THIÊN THIÊN / MEDIA / …subfolders`. */
export function mediaFolderParts(subfolders: readonly string[] = []): string[] {
  const clean = subfolders
    .map((part) => part.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, 8);
  return [...mediaRootParts(), ...clean];
}

/** Thư mục con trong đơn, theo SOP: ảnh gốc, bản sửa, file in, duyệt và video. */
export function orderKindFolder(kind: string): string {
  if (kind === "original") return "1-anh-goc";
  if (kind === "design") return "2-ban-sua";
  if (kind === "approval" || kind === "packing_photo" || kind === "packing_video") return "4-duyet-va-video";
  return "3-file-in";
}

/** `Đơn web / YYYY-MM / <mã> - <khách>`, tháng theo giờ Việt Nam. */
export function driveFolderParts(order: {
  code: string;
  customerName: string;
  createdAt: string;
  source?: string | null;
  channel?: string | null;
}): [string, string, string] {
  return [driveRootName(order), vnMonth(order.createdAt), `${order.code} - ${driveCustomerPart(order.customerName)}`];
}
