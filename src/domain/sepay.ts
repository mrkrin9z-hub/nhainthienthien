import { transferContent } from "./print-shop.ts";
import { remainOf } from "./money.ts";

/** Payload SePay gửi tới webhook (Money in). */
export type SePayWebhookPayload = {
  id: number | string;
  gateway?: string;
  transactionDate?: string;
  accountNumber?: string;
  subAccount?: string;
  code?: string | null;
  content?: string;
  transferType?: string;
  description?: string;
  transferAmount?: number;
  accumulated?: number;
  referenceCode?: string;
};

export type SePayMatchOrder = {
  id: string;
  code: string;
  status: string;
  channel: string;
  total: number | null;
  depositPaid: number;
};

/** Chuẩn hoá mã thanh toán từ `code` hoặc nội dung CK. */
export function extractPaymentNeedle(payload: SePayWebhookPayload): string {
  const fromCode = String(payload.code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  if (fromCode) return fromCode;
  const content = String(payload.content ?? payload.description ?? "").toUpperCase();
  const match = content.match(/\bTT\d{6}-\d{2,4}\b/);
  return match?.[0] ?? "";
}

export function findOrderForSePay(orders: SePayMatchOrder[], payload: SePayWebhookPayload): SePayMatchOrder | null {
  const needle = extractPaymentNeedle(payload);
  if (!needle) return null;
  const normalized = needle.replace(/[^A-Z0-9]/g, "");
  for (const order of orders) {
    if (order.status === "huy" || order.status === "draft_upload" || order.status === "upload_error") continue;
    const code = transferContent(order.code);
    const compact = code.replace(/[^A-Z0-9]/g, "");
    if (code === needle || compact === normalized) return order;
    if (String(payload.content ?? "").toUpperCase().includes(code)) return order;
  }
  return null;
}

/** Số tiền ghi thu: không vượt phần còn lại nếu đã có tổng. */
export function sepayCollectAmount(order: SePayMatchOrder, transferAmount: number): number {
  const amount = Math.round(Number(transferAmount) || 0);
  if (amount <= 0) return 0;
  const remain = remainOf(order);
  if (remain === null) return amount;
  if (remain <= 0) return 0;
  return Math.min(amount, remain);
}

export function sepayRejectReason(order: SePayMatchOrder | null, transferAmount: number, transferType?: string): string | null {
  if (transferType && transferType !== "in") return "Chỉ nhận giao dịch tiền vào.";
  if (!order) return "Không khớp mã đơn.";
  if (order.channel === "tiktok" || order.channel === "shopee") return "Đơn sàn không thu trên web.";
  if (sepayCollectAmount(order, transferAmount) <= 0) return "Đơn đã thu đủ hoặc số tiền không hợp lệ.";
  return null;
}
