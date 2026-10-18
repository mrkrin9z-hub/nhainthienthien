import { vnMonth } from "./calc.ts";

/** Thư mục gốc trên Drive của chủ, theo nguồn đơn. */
export function driveRootName(order: { source?: string | null; channel?: string | null }): string {
  if (order.source === "web") return "Đơn web";
  if (order.channel === "facebook") return "Đơn Facebook";
  if (order.channel === "tiktok") return "Đơn TikTok";
  if (order.channel === "shopee") return "Đơn Shopee";
  return "Đơn tại tiệm";
}

export function driveCustomerPart(name: string): string {
  const clean = name.replace(/[\\/]/g, " ").replace(/\s+/g, " ").trim();
  return (clean || "Khách").slice(0, 60);
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
