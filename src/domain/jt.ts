export const JT_CARRIER = "J&T Express";

export const JT_LABEL_MM = { width: 100, height: 150 } as const;

/** Đơn Facebook, và đơn web giao tận nơi, đi J&T. */
export function jtOrder(order: { channel?: string | null; source?: string | null; fulfillment?: string | null }): boolean {
  if (order.channel === "facebook") return true;
  return order.source === "web" && order.fulfillment === "delivery";
}

export function defaultCarrier(order: { channel?: string | null; source?: string | null; fulfillment?: string | null }): string {
  return jtOrder(order) ? JT_CARRIER : "";
}

export type JtCapability = {
  id: "waybill" | "quote" | "track" | "label";
  label: string;
  available: boolean;
  reason: string;
};

/**
 * Không gọi API J&T. Chưa có khóa thì ghi vận đơn và phí bằng tay.
 * Đã lưu khóa thì vẫn chờ hợp đồng API của hãng, tem 100×150 in được ngay.
 */
export function jtCapabilities(keysConnected: boolean): JtCapability[] {
  const wait = keysConnected
    ? "Đã lưu khóa. Phần này chờ hợp đồng API của J&T, chưa gọi mạng."
    : "Chưa có khóa. Ghi bằng tay trên đơn.";
  return [
    { id: "waybill", label: "Tạo vận đơn", available: false, reason: wait },
    { id: "quote", label: "Báo phí", available: false, reason: wait },
    { id: "track", label: "Đồng bộ trạng thái", available: false, reason: wait },
    { id: "label", label: "In tem 100×150", available: true, reason: "In từ trình duyệt, không cần khóa." },
  ];
}

export type JtPlan = {
  applies: boolean;
  carrier: string;
  mode: "manual" | "ready";
  fee: number | null;
  tracking: string;
  note: string;
  label: { width: 100; height: 150 };
};

export function jtPlan(
  order: {
    channel?: string | null;
    source?: string | null;
    fulfillment?: string | null;
    shipping?: { carrier?: string | null; tracking?: string | null; shipFee?: number | null } | null;
  },
  keysConnected: boolean,
): JtPlan {
  const tracking = order.shipping?.tracking?.trim() ?? "";
  const fee = order.shipping?.shipFee ?? null;
  if (!jtOrder(order)) {
    return {
      applies: false,
      carrier: order.shipping?.carrier?.trim() ?? "",
      mode: "manual",
      fee,
      tracking,
      note: "",
      label: JT_LABEL_MM,
    };
  }
  if (!keysConnected) {
    return {
      applies: true,
      carrier: JT_CARRIER,
      mode: "manual",
      fee,
      tracking,
      note: "Chưa có khóa J&T. Ghi mã vận đơn và phí bằng tay. Tem in khổ 100×150.",
      label: JT_LABEL_MM,
    };
  }
  return {
    applies: true,
    carrier: JT_CARRIER,
    mode: "ready",
    fee,
    tracking,
    note: "Đã lưu khóa J&T. Tạo vận đơn, báo phí và đồng bộ trạng thái chờ hợp đồng API của hãng. Trước đó vẫn ghi mã và phí bằng tay.",
    label: JT_LABEL_MM,
  };
}
