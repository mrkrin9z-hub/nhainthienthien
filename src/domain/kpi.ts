import { vnMonth } from "./calc.ts";
import { commissionForSale, type CommissionBasis } from "./commission.ts";
import type { Order, Role, ShopState } from "./types.ts";

export type SaleKpi = {
  staffId: string;
  name: string;
  orders: number;
  commissionRevenue: number | null;
  commission: number;
  basis: CommissionBasis;
  /** Phút từ lúc tạo đơn đến lần sale đổi trạng thái. Null khi chưa có mốc. */
  avgReplyMinutes: number | null;
  timedOrders: number;
};

function replyMinutes(order: Order, staffId: string): number | null {
  const start = Date.parse(order.createdAt);
  if (!Number.isFinite(start)) return null;
  const touches = (order.history ?? [])
    .filter((entry) => entry.by === staffId && entry.from !== null)
    .map((entry) => Date.parse(entry.at))
    .filter((at) => Number.isFinite(at) && at >= start)
    .sort((a, b) => a - b);
  if (!touches.length) return null;
  return Math.round((touches[0]! - start) / 60000);
}

export function saleKpi(state: ShopState, month: string): SaleKpi[] {
  return state.staff
    .filter((person) => person.role === "sale" && person.active)
    .map((person) => {
      const handled = state.orders.filter((order) => {
        if (order.channel === "mo_home") return false;
        if (order.status === "draft_upload" || order.status === "upload_error") return false;
        return (order.history ?? []).some((entry) => entry.by === person.id && vnMonth(entry.at) === month);
      });
      const pay = commissionForSale(state, person.id, month);
      const times = handled.map((order) => replyMinutes(order, person.id)).filter((value): value is number => value !== null);
      return {
        staffId: person.id,
        name: person.name,
        orders: handled.length,
        commissionRevenue: pay.revenue,
        commission: pay.commission,
        basis: pay.basis,
        avgReplyMinutes: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
        timedOrders: times.length,
      };
    });
}

/** Sale không nhận doanh thu cả tiệm. Chế độ theo đơn thì thấy doanh thu đơn mình xử lý. */
export function kpiForActor(role: Role, staffId: string, rows: SaleKpi[]): SaleKpi[] {
  const visible = role === "owner" ? rows : rows.filter((row) => row.staffId === staffId);
  if (role !== "sale") return visible;
  return visible.map((row) => (row.basis === "shop" ? { ...row, commissionRevenue: null } : row));
}
