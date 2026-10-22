import type { Order, OrderShipping } from "./types.ts";

export function blankShipping(): OrderShipping {
  return { carrier: "", tracking: "", shipFee: null, codAmount: null, codReceivedAt: null };
}

export function orderShipping(order: { shipping?: OrderShipping | null }): OrderShipping {
  return { ...blankShipping(), ...(order.shipping ?? {}) };
}

/** Bảng giao hàng: giao tận nơi và nhận tại tiệm, từ đóng gói trở đi. Không gồm đơn hủy, đơn thử. */
export function onDeliveryDesk(order: Pick<Order, "status" | "fulfillment"> & { isTest?: boolean }): boolean {
  if (order.isTest) return false;
  return order.status === "dong_goi" || order.status === "giao" || order.status === "xong";
}

export function shipsOut(order: Pick<Order, "status" | "fulfillment" | "channel">): boolean {
  if (order.status === "draft_upload" || order.status === "huy" || order.status === "upload_error") return false;
  if (order.fulfillment === "delivery") return true;
  return order.channel === "facebook" || order.channel === "tiktok" || order.channel === "shopee";
}

export function labelChannel(channel: Order["channel"]): boolean {
  return channel === "tai_tiem" || channel === "facebook";
}
