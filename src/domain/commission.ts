import { collectedRevenue, commissionOf } from "./calc.ts";
import type { Order, ShopState } from "./types.ts";

/** shop = doanh thu cả tiệm (mặc định, một sale). handled = chỉ đơn người đó xử lý. */
export type CommissionBasis = "shop" | "handled";

export function commissionBasisOf(settings: { commissionBasis?: string | null }): CommissionBasis {
  return settings.commissionBasis === "handled" ? "handled" : "shop";
}

export function commissionBasisLabel(basis: CommissionBasis): string {
  return basis === "handled" ? "Theo đơn người đó xử lý" : "Toàn tiệm";
}

/** Sale đã đụng đơn (bất kỳ lần nào trong lịch sử), không chỉ trong tháng đang tính. */
export function saleHandledOrder(order: Pick<Order, "history">, staffId: string): boolean {
  return (order.history ?? []).some((entry) => entry.by === staffId);
}

/**
 * Hoa hồng một sale trong một tháng.
 * Bậc 3% / 5% / 7% áp một lần trên tổng doanh thu đã thu của tháng, không tính từng đơn.
 * Chế độ toàn tiệm dùng mọi đơn xong trong tháng. Chế độ theo đơn chỉ lấy đơn người đó đã xử lý.
 */
export function commissionForSale(
  state: Pick<ShopState, "orders" | "settings">,
  staffId: string,
  month: string,
): { revenue: number; commission: number; basis: CommissionBasis } {
  const basis = commissionBasisOf(state.settings);
  const outside = state.orders.filter((order) => order.channel !== "mo_home");
  const source = basis === "handled" ? outside.filter((order) => saleHandledOrder(order, staffId)) : outside;
  const revenue = collectedRevenue(source, month);
  return { revenue, commission: commissionOf(revenue, state.settings.commissionTiers), basis };
}
