import { findOrderByRef } from "./find-order.ts";
import type { Order, ShopState } from "./types.ts";

export type OrderDeleteLinks = Pick<ShopState, "orders" | "albums" | "reprints" | "wasteReports" | "paymentQrTokens">;

export type DetachedOrder = {
  order: Order;
  index: number;
};

/** Gỡ đơn khỏi sổ và liên kết album / in lại / hao phí / QR thanh toán. Không đụng orderSeq. */
export function detachOrder(state: OrderDeleteLinks, ref: string): DetachedOrder {
  const order = findOrderByRef(state.orders, ref);
  if (!order) throw new Error("Không tìm thấy đơn.");
  const index = state.orders.findIndex((item) => item.id === order.id);
  if (index < 0) throw new Error("Không tìm thấy đơn.");
  const now = new Date().toISOString();
  for (const album of state.albums ?? []) {
    if (album.orderId === order.id) {
      album.orderId = null;
      album.updatedAt = now;
    }
  }
  for (const reprint of state.reprints ?? []) {
    if (reprint.orderId === order.id) reprint.orderId = "";
  }
  for (const report of state.wasteReports ?? []) {
    if (report.orderId === order.id) report.orderId = null;
  }
  if (state.paymentQrTokens) {
    state.paymentQrTokens = state.paymentQrTokens.filter((row) => row.orderId !== order.id);
  }
  state.orders.splice(index, 1);
  return { order, index };
}
