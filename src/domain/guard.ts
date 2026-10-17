import type { Role } from "./types.ts";

export function canViewProfit(role: Role): boolean {
  return role === "owner";
}

export function canViewPriceBoard(role: Role): boolean {
  return role === "owner" || role === "sale";
}

export function canExport(role: Role, kind: "orders" | "stock" | "moves" | "payroll" | "profit"): boolean {
  if (kind === "profit" || kind === "payroll") return role === "owner";
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
};

/** Chủ thấy cả bảng. Người khác chỉ thấy dòng của mình, không kèm doanh thu quán. */
export function payrollForActor(role: Role, staffId: string, rows: PayLine[]): PayLine[] {
  if (role === "owner") return rows;
  return rows
    .filter((row) => row.staffId === staffId)
    .map(({ revenue: _revenue, ...row }) => row);
}

/** Khóa cũ nhất bị xóa khi vượt quá số bản giữ. */
export function backupKeysToDrop(keys: string[], keep = 30): string[] {
  const sorted = keys.filter((key) => key.startsWith("shop_backup:")).sort();
  if (sorted.length <= keep) return [];
  return sorted.slice(0, sorted.length - keep);
}

/** Pathname được lấy từ ASSETS_KV. `/` để SSR. */
export function staticAssetPath(pathname: string): string | null {
  if (pathname === "/" || pathname === "/index.html") return null;
  if (pathname.includes("..") || pathname.includes("\\")) return null;
  if (pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(pathname)) return pathname;
  return null;
}

export const INTEGRATION_PROVIDERS = ["tiktok", "shopee", "meta", "zalo", "carrier"] as const;
export type IntegrationProvider = (typeof INTEGRATION_PROVIDERS)[number];

export function emptySecretStatus(): Record<IntegrationProvider, boolean> {
  return { tiktok: false, shopee: false, meta: false, zalo: false, carrier: false };
}
