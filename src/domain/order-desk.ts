import { feeLines, PRODUCTION_STEPS } from "./calc.ts";
import type { Channel, OrderStatus, Settings } from "./types.ts";

/** Bốn tab làm việc. Trả hàng nằm ở Cần làm. Giao lỗi vẫn ở Đang giao. Xong và hủy chung một tab. */
export const DESK_TABS = [
  { id: "can_lam", label: "Cần làm" },
  { id: "can_gui", label: "Cần gửi" },
  { id: "dang_giao", label: "Đang giao" },
  { id: "xong_huy", label: "Xong/Hủy" },
] as const;

export type DeskTab = (typeof DESK_TABS)[number]["id"];

export const DESK_CHANNEL_LABEL: Record<Channel, string> = {
  tai_tiem: "Trực tiếp",
  facebook: "Facebook",
  tiktok: "TikTok",
  shopee: "Shopee",
  mo_home: "Mơ Home",
};

export const PAYMENT_METHODS = [
  { id: "cod", label: "COD" },
  { id: "chuyen_khoan", label: "Chuyển khoản" },
  { id: "tien_mat", label: "Tiền mặt" },
  { id: "vi_san", label: "Ví sàn" },
] as const;

export type PaymentMethod = (typeof PAYMENT_METHODS)[number]["id"] | "";
export type ShipMode = "pickup" | "tu_giao" | "san";
export type DeskIssue = "giao_that_bai" | "tra_hang";

const PROCESSING = new Set(["draft_upload", "upload_error", "nhan_don", "thiet_ke", "cho_duyet"]);
const TO_SHIP = new Set(["in", "dong_goi"]);

export function deskTabOf(order: { status: string; deskIssue?: string | null }): DeskTab {
  if (order.status === "huy" || order.status === "xong") return "xong_huy";
  if (order.deskIssue === "tra_hang") return "can_lam";
  if (order.status === "giao" || order.deskIssue === "giao_that_bai") return "dang_giao";
  if (TO_SHIP.has(order.status)) return "can_gui";
  if (PROCESSING.has(order.status) || order.status) return "can_lam";
  return "can_lam";
}

const FLOW: OrderStatus[] = ["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong"];

/** Bước được chọn trên danh sách: chỉ kế trước, kế sau, hoặc hủy. Không nhảy bước. */
export function listStatusChoices(input: {
  status: string;
  role: "owner" | "sale" | "production";
  channel: string;
}): OrderStatus[] {
  const status = input.status as OrderStatus;
  if (status === "xong") return input.role === "owner" ? ["giao"] : [];
  if (status === "huy") return input.role === "owner" ? ["nhan_don"] : [];
  if (status === "draft_upload" || status === "upload_error") {
    return input.role === "production" ? [] : ["nhan_don", "huy"];
  }
  const index = FLOW.indexOf(status);
  if (index < 0) return [];
  const near = [FLOW[index - 1], FLOW[index + 1]].filter((item): item is OrderStatus => Boolean(item));
  if (input.role === "production" && input.channel !== "mo_home") {
    return near.filter((item) => (PRODUCTION_STEPS as readonly string[]).includes(item));
  }
  if (input.role === "production") return near;
  return [...near, "huy"];
}

export function deskTabMeta(id: DeskTab) {
  return DESK_TABS.find((tab) => tab.id === id) ?? DESK_TABS[0];
}

export function isMarketplace(channel: string): boolean {
  return channel === "tiktok" || channel === "shopee";
}

export function shipModeOf(order: { channel: string; fulfillment?: string | null; shipMode?: string | null }): ShipMode {
  if (order.shipMode === "pickup" || order.shipMode === "tu_giao" || order.shipMode === "san") return order.shipMode;
  if (isMarketplace(order.channel)) return "san";
  return order.fulfillment === "pickup" ? "pickup" : "tu_giao";
}

export function shipModeLabel(mode: ShipMode): string {
  if (mode === "pickup") return "Lấy tại xưởng";
  if (mode === "tu_giao") return "Tự giao";
  return "Nhãn sàn";
}

export function fulfillmentFor(mode: ShipMode): "pickup" | "delivery" {
  return mode === "pickup" ? "pickup" : "delivery";
}

export function maskBuyer(name: string): string {
  const trimmed = name.trim();
  if (!trimmed) return "—";
  if (trimmed.length === 1) return trimmed;
  if (trimmed.length === 2) return `${trimmed[0]}*`;
  return `${trimmed[0]}***${trimmed[trimmed.length - 1]}`;
}

export function paymentLabel(method: string | null | undefined): string {
  return PAYMENT_METHODS.find((item) => item.id === method)?.label ?? (method ? method : "—");
}

export function paymentMethodFromText(value: string): PaymentMethod {
  const text = value.trim().toLowerCase();
  if (!text) return "";
  if (text.includes("cod")) return "cod";
  if (text.includes("ví") || text.includes("vi san") || text.includes("vi_san")) return "vi_san";
  if (text.includes("chuyển") || text.includes("chuyen") || text.includes("ck")) return "chuyen_khoan";
  if (text.includes("mặt") || text.includes("mat") || text.includes("tiền mặt")) return "tien_mat";
  return "";
}

/** Thực nhận. Số đã nhập thì giữ. Chưa nhập thì trừ phí kênh, không cộng affiliate. */
export function estimateNet(
  total: number | null,
  channel: Channel,
  settings: Settings,
  stored: number | null | undefined,
): number | null {
  if (stored != null) return stored;
  if (total == null) return null;
  const lines = feeLines(channel, total, settings, false);
  if (lines.some((line) => line.amount == null)) return null;
  const fees = lines.reduce((sum, line) => sum + (line.amount ?? 0), 0);
  return Math.max(0, Math.round(total - fees));
}

export type DeskAlertId = "ship_24h" | "cancel_24h" | "overdue_ship" | "cancelled" | "ship_problem" | "return_request";

export type DeskAlert = { id: DeskAlertId; label: string; count: number };

type AlertOrder = {
  status: string;
  channel: string;
  deskIssue?: string | null;
  shipBy?: string | null;
  autoCancelAt?: string | null;
  tracking?: string | null;
};

function hoursUntil(iso: string | null | undefined, now: number): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  if (Number.isNaN(at)) return null;
  return (at - now) / 3_600_000;
}

export function deskAlerts(orders: AlertOrder[], now = Date.now()): DeskAlert[] {
  const cards: { id: DeskAlertId; label: string; match: (order: AlertOrder) => boolean }[] = [
    {
      id: "ship_24h",
      label: "Cần vận chuyển trong 24h",
      match: (order) => {
        const tab = deskTabOf(order);
        const hours = hoursUntil(order.shipBy, now);
        return (tab === "can_lam" || tab === "can_gui") && hours != null && hours >= 0 && hours <= 24;
      },
    },
    {
      id: "cancel_24h",
      label: "Tự hủy trong 24h",
      match: (order) => {
        const tab = deskTabOf(order);
        const hours = hoursUntil(order.autoCancelAt, now);
        return tab !== "xong_huy" && hours != null && hours >= 0 && hours <= 24;
      },
    },
    {
      id: "overdue_ship",
      label: "Quá hạn vận chuyển",
      match: (order) => {
        const tab = deskTabOf(order);
        const hours = hoursUntil(order.shipBy, now);
        return (tab === "can_lam" || tab === "can_gui") && hours != null && hours < 0;
      },
    },
    { id: "cancelled", label: "Hủy", match: (order) => order.status === "huy" },
    {
      id: "ship_problem",
      label: "Vấn đề gửi hàng",
      match: (order) => order.deskIssue === "giao_that_bai" || (deskTabOf(order) === "dang_giao" && isMarketplace(order.channel) && !order.tracking?.trim()),
    },
    { id: "return_request", label: "Yêu cầu trả hàng", match: (order) => order.deskIssue === "tra_hang" },
  ];
  return cards.map((card) => ({ id: card.id, label: card.label, count: orders.filter(card.match).length }));
}

export function matchesAlert(order: AlertOrder, id: DeskAlertId, now = Date.now()): boolean {
  return deskAlerts([order], now).some((card) => card.id === id && card.count > 0);
}

type DeskOrderPatch = {
  channel: string;
  fulfillment?: string | null;
  shipMode?: string | null;
  marketplaceCode?: string;
  channelOrderId?: string;
  depositMethod?: string;
  paymentMethod?: string;
};

/** Một lần: gắn cách giao và mã đơn kênh. Giữ nguyên bước, tiền, sản phẩm và cờ đơn thử. */
export function applyOrderDesk<T extends { settings: { orderDesk20261024?: boolean }; orders?: DeskOrderPatch[] }>(state: T): boolean {
  if (state.settings.orderDesk20261024) return false;
  for (const order of state.orders ?? []) {
    if (!order.shipMode) order.shipMode = shipModeOf(order);
    if (!order.channelOrderId && order.marketplaceCode) order.channelOrderId = order.marketplaceCode;
    if (!order.paymentMethod && order.depositMethod) order.paymentMethod = paymentMethodFromText(order.depositMethod);
  }
  state.settings.orderDesk20261024 = true;
  return true;
}
