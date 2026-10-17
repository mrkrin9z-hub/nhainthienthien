import { commissionOf, vnParts } from "./calc.ts";
import type { Order, ShopState } from "./types.ts";

export type SaleKpi = {
  staffId: string;
  name: string;
  orders: number;
  commissionRevenue: number;
  commission: number;
  /** Phút từ lúc tạo đơn đến lần sale đổi trạng thái. Null khi chưa có mốc. */
  avgReplyMinutes: number | null;
  timedOrders: number;
};

function monthOf(iso: string): string {
  const at = Date.parse(iso);
  if (!Number.isFinite(at)) return "";
  return vnParts(new Date(at)).month;
}

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
        if (order.status === "draft_upload" || order.status === "upload_error") return false;
        return (order.history ?? []).some((entry) => entry.by === person.id && monthOf(entry.at) === month);
      });
      const paid = handled.filter((order) => order.status === "xong");
      const commissionRevenue = paid.reduce((sum, order) => sum + (order.total ?? 0), 0);
      const times = handled.map((order) => replyMinutes(order, person.id)).filter((value): value is number => value !== null);
      return {
        staffId: person.id,
        name: person.name,
        orders: handled.length,
        commissionRevenue,
        commission: commissionOf(commissionRevenue, state.settings.commissionTiers),
        avgReplyMinutes: times.length ? Math.round(times.reduce((sum, value) => sum + value, 0) / times.length) : null,
        timedOrders: times.length,
      };
    });
}
