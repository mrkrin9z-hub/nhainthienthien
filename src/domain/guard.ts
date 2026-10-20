import { vnYmd } from "./calc.ts";
import type { Role } from "./types.ts";

export function canViewProfit(role: Role): boolean {
  return role === "owner";
}

export function canViewPriceBoard(role: Role): boolean {
  return role === "owner" || role === "sale";
}

export function canExport(role: Role, kind: "orders" | "stock" | "moves" | "payroll" | "profit"): boolean {
  if (kind === "profit" || kind === "payroll") return role === "owner";
  if (kind === "orders" || kind === "stock") return role === "owner" || role === "sale";
  return true;
}

export type PayLine = {
  staffId: string;
  name: string;
  role: Role;
  base: number;
  commission: number;
  kpiBonus: number;
  deduction: number | null;
  net: number | null;
  lateMinutes: number;
  absentDays: number;
  kpiPercent: number | null;
  revenue?: number;
  commissionBasis?: "shop" | "handled" | null;
};

/** Chủ thấy cả bảng. Người khác chỉ thấy dòng của mình, không kèm doanh thu quán. */
export function payrollForActor(role: Role, staffId: string, rows: PayLine[]): PayLine[] {
  if (role === "owner") return rows;
  return rows
    .filter((row) => row.staffId === staffId)
    .map(({ revenue: _revenue, ...row }) => row);
}

const DAILY_BACKUP = /^shop_backup:\d{4}-\d{2}-\d{2}$/;

/** Ngày lịch Việt Nam, dùng làm khóa sao lưu hằng ngày. */
export function vnBackupDay(date = new Date()): string {
  return vnYmd(date);
}

export function dailyBackupKey(date = new Date()): string {
  return `shop_backup:${vnBackupDay(date)}`;
}

export function manualBackupKey(date = new Date()): string {
  return `shop_backup:manual:${date.toISOString().replace(/[:.]/g, "-")}`;
}

export function classifyBackupKey(key: string): "daily" | "manual" | "legacy" | "other" {
  if (DAILY_BACKUP.test(key)) return "daily";
  if (key.startsWith("shop_backup:manual:")) return "manual";
  if (key.startsWith("shop_backup:")) return "legacy";
  return "other";
}

/**
 * Bản ngày giữ 30 ngày mới nhất. Bản bấm tay giữ 10 khóa mới nhất.
 * Khóa có dấu thời gian (lần list KV bị trễ) bị xóa vì đã thay bằng khóa cố định theo ngày.
 */
export function backupKeysToDrop(keys: string[], dailyKeep = 30, manualKeep = 10): string[] {
  const daily = keys.filter((key) => classifyBackupKey(key) === "daily").sort();
  const manual = keys.filter((key) => classifyBackupKey(key) === "manual").sort();
  const legacy = keys.filter((key) => classifyBackupKey(key) === "legacy");
  const dropDaily = daily.length > dailyKeep ? daily.slice(0, daily.length - dailyKeep) : [];
  const dropManual = manual.length > manualKeep ? manual.slice(0, manual.length - manualKeep) : [];
  return [...legacy, ...dropDaily, ...dropManual];
}

export function backupFileName(key: string): string {
  return `shop_backup-${key.slice("shop_backup:".length).replaceAll(":", "-")}.json`;
}

export function backupKeyFromFile(name: string): string | null {
  if (!name.startsWith("shop_backup-") || !name.endsWith(".json")) return null;
  const body = name.slice("shop_backup-".length, -".json".length);
  if (body.startsWith("manual-")) return `shop_backup:manual:${body.slice("manual-".length)}`;
  return `shop_backup:${body}`;
}

/** Pathname được lấy từ ASSETS_KV. `/` để SSR. */
export function staticAssetPath(pathname: string): string | null {
  if (pathname === "/" || pathname === "/index.html") return null;
  if (pathname.includes("..") || pathname.includes("\\")) return null;
  if (pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(pathname)) return pathname;
  return null;
}

export const INTEGRATION_PROVIDERS = [
  "tiktok",
  "shopee",
  "tiktok_app_key",
  "tiktok_app_secret",
  "tiktok_service_id",
  "tiktok_shop",
  "shopee_partner_id",
  "shopee_partner_key",
  "shopee_shop",
  "meta",
  "zalo",
  "carrier",
  "ghn_token",
  "ghn_shop_id",
  "ghtk_token",
  "ghtk_partner",
  "jt_api_account",
  "jt_private_key",
  "jt_customer_code",
  "jt_password",
  "google_client_id",
  "google_client_secret",
  "google_drive",
  "studiobase_chat_api_key",
  "studiobase_anon_key",
  "studiobase_webhook_secret",
] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function emptySecretStatus(): Record<IntegrationProvider, boolean> {
  return {
    tiktok: false,
    shopee: false,
    tiktok_app_key: false,
    tiktok_app_secret: false,
    tiktok_service_id: false,
    tiktok_shop: false,
    shopee_partner_id: false,
    shopee_partner_key: false,
    shopee_shop: false,
    meta: false,
    zalo: false,
    carrier: false,
    ghn_token: false,
    ghn_shop_id: false,
    ghtk_token: false,
    ghtk_partner: false,
    jt_api_account: false,
    jt_private_key: false,
    jt_customer_code: false,
    jt_password: false,
    google_client_id: false,
    google_client_secret: false,
    google_drive: false,
    studiobase_chat_api_key: false,
    studiobase_anon_key: false,
    studiobase_webhook_secret: false,
  };
}
