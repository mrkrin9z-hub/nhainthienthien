import type { Role } from "./types.ts";

/** Số tiền chủ mới được thấy. Sale vẫn thấy giá bán, hoa hồng và % KPI của chính mình. */
const SALE_HIDDEN = [
  "revenue",
  "revenueToday",
  "revenueMonth",
  "gross",
  "grossIncomplete",
  "profit",
  "margin",
  "marginPercent",
  "packPrice",
  "pendingPrice",
  "unitCost",
  "materialCost",
  "material",
  "materialIncomplete",
  "fees",
  "feesIncomplete",
  "ink",
  "fixed",
  "todayGap",
  "breakevenPercent",
  "lines",
  "tone",
  "shippingUnknown",
  "extraCost",
] as const;

const PRODUCTION_EXTRA = [
  "unitPrice",
  "lineTotal",
  "total",
  "subtotal",
  "depositRequired",
  "depositPaid",
  "depositMethod",
  "commission",
  "kpiPercent",
  "base",
  "net",
  "deduction",
  "price",
  "kpiBonus",
  "shipFee",
  "codAmount",
] as const;

function hiddenFor(role: Role): Set<string> {
  if (role === "owner") return new Set();
  if (role === "sale") return new Set(SALE_HIDDEN);
  return new Set([...SALE_HIDDEN, ...PRODUCTION_EXTRA]);
}

function strip(value: unknown, hidden: Set<string>): unknown {
  if (Array.isArray(value)) return value.map((item) => strip(item, hidden));
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (hidden.has(key)) continue;
    out[key] = strip(item, hidden);
  }
  return out;
}

export function visibleToRole<T>(role: Role, value: T): T {
  return strip(value, hiddenFor(role)) as T;
}

/** Đường dẫn còn sót khóa tiền bị cấm. Dùng trong kiểm thử. */
export function moneyLeaks(role: Role, value: unknown): string[] {
  const hidden = hiddenFor(role);
  const found: string[] = [];
  walk(value, hidden, "$", found);
  return found;
}

function walk(value: unknown, hidden: Set<string>, path: string, found: string[]) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => walk(item, hidden, `${path}[${index}]`, found));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    const next = `${path}.${key}`;
    if (hidden.has(key)) found.push(next);
    else walk(item, hidden, next, found);
  }
}
