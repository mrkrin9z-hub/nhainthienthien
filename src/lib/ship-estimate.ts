/** Phí ship dự kiến theo chính sách công khai 13/11/2026. Tiệm vẫn xác nhận lại trên đơn. */
export type ShipLine = { width: number | null; height: number | null; amount: number };

export function isLargeSize(width: number | null, height: number | null): boolean {
  return Math.max(width ?? 0, height ?? 0) >= 75;
}

export function needsDeposit(lines: ShipLine[]): boolean {
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  return subtotal >= 300_000 || lines.some((l) => Math.max(l.width ?? 0, l.height ?? 0) >= 60);
}

export function shipEstimate(lines: ShipLine[], fulfillment: "pickup" | "delivery"): { fee: number; freeFrom: number; base: number } {
  const large = lines.some((l) => isLargeSize(l.width, l.height));
  const base = large ? 30_000 : 25_000;
  const freeFrom = large ? 450_000 : 300_000;
  if (fulfillment === "pickup" || lines.length === 0) return { fee: 0, freeFrom, base };
  const subtotal = lines.reduce((sum, l) => sum + l.amount, 0);
  return { fee: subtotal >= freeFrom ? 0 : base, freeFrom, base };
}

export function discountPercent(price: number | null, list: number | null | undefined): number | null {
  if (price == null || list == null || list <= price) return null;
  const pct = Math.round(((list - price) / list) * 100);
  return pct > 0 ? pct : null;
}
