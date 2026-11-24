import { remainOf } from "./money.ts";
import { transferContent } from "./print-shop.ts";

/** Payload SePay gửi tới webhook (Money in / Money out). */
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
  discount?: number | null;
  shipping?: { customerShip?: number | null } | null;
};

export type BankTxnMatchStatus = "matched" | "unmatched" | "manual" | "ignored";

export type BankTransaction = {
  id: string;
  sepayId: string;
  amountIn: number;
  amountOut: number;
  /** ISO */
  transactionDate: string;
  content: string;
  description: string;
  code: string;
  referenceCode: string;
  gateway: string;
  accountNumber: string;
  subAccount: string;
  matchStatus: BankTxnMatchStatus;
  matchReason: string;
  matchedOrderId: string | null;
  matchedOrderPaymentId: string | null;
  reconciledAt: string | null;
  reconciledBy: string | null;
  reconcileNote: string;
  reconcileKind: string;
  createdAt: string;
};

export type PaymentQrTokenStatus = "open" | "matched" | "void";

export type OrderPaymentQrToken = {
  id: string;
  /** SB + 6 ký tự alphabet không nhầm. */
  token: string;
  orderId: string;
  amount: number;
  /** STK ví lúc phát hành (chuẩn hóa). */
  accountNumber: string;
  issuedBy: string | null;
  issuedByName: string;
  status: PaymentQrTokenStatus;
  matchedBankTxnId: string | null;
  matchedOrderPaymentId: string | null;
  matchedAt: string | null;
  createdAt: string;
};

/** Alphabet không nhầm (bỏ I O 0 1). */
export const SB_TOKEN_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeAccountNumber(value: string | null | undefined): string {
  return String(value ?? "").replace(/\s+/g, "").replace(/\D/g, "");
}

/** SePay gửi "YYYY-MM-DD HH:mm:ss" (giờ VN) → ISO +07:00. */
export function sepayDateToIso(raw: string | null | undefined): string {
  const text = String(raw ?? "").trim();
  const match = text.match(/^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})$/);
  if (match) {
    const iso = new Date(`${match[1]}T${match[2]}+07:00`);
    if (!Number.isNaN(iso.getTime())) return iso.toISOString();
  }
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.getTime())) return parsed.toISOString();
  return new Date().toISOString();
}

export function generateSbToken(random: () => number = Math.random): string {
  let body = "";
  for (let i = 0; i < 6; i += 1) {
    body += SB_TOKEN_ALPHABET[Math.floor(random() * SB_TOKEN_ALPHABET.length)]!;
  }
  return `SB${body}`;
}

/** Regex mã đối soát trên nội dung CK. */
export const SB_TOKEN_RE = /\bSB[A-Z0-9]{6}\b/;

export function extractSbToken(...parts: Array<string | null | undefined>): string {
  const blob = parts.map((part) => String(part ?? "").toUpperCase()).join(" ");
  const match = blob.match(SB_TOKEN_RE);
  return match?.[0] ?? "";
}

/** Nội dung CK / VietQR addInfo: token + mã đơn, ≤25 ký tự. */
export function paymentQrAddInfo(token: string, orderCode: string): string {
  const sb = token.toUpperCase().replace(/[^A-Z0-9]/g, "");
  const code = transferContent(orderCode);
  const joined = `${sb} ${code}`.trim();
  if (joined.length <= 25) return joined;
  if (sb.length <= 25) return sb;
  return sb.slice(0, 25);
}

/** Clean nội dung UI nhưng giữ SB******. */
export function cleanBankContentForUi(content: string): string {
  const token = extractSbToken(content);
  const folded = content
    .replace(/\s+/g, " ")
    .replace(/chuyen tien|chuyển tiền|IBFT|MBVCB|QR/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (token && !folded.toUpperCase().includes(token)) return `${token} ${folded}`.trim();
  return folded || content.trim();
}

export function accountsMatchShop(
  payload: SePayWebhookPayload,
  shopAccount: string | null | undefined,
): { mapped: boolean; preferred: string } {
  const shop = normalizeAccountNumber(shopAccount);
  const sub = normalizeAccountNumber(payload.subAccount);
  const main = normalizeAccountNumber(payload.accountNumber);
  const preferred = sub || main;
  if (!shop) return { mapped: false, preferred };
  if (sub && sub === shop) return { mapped: true, preferred: sub };
  if (main && main === shop) return { mapped: true, preferred: main };
  return { mapped: false, preferred };
}

export function findOpenToken(
  tokens: OrderPaymentQrToken[],
  input: { orderId: string; amount: number; accountNumber: string },
): OrderPaymentQrToken | null {
  const account = normalizeAccountNumber(input.accountNumber);
  const amount = Math.round(input.amount);
  return (
    tokens.find(
      (row) =>
        row.status === "open" &&
        row.orderId === input.orderId &&
        row.amount === amount &&
        normalizeAccountNumber(row.accountNumber) === account,
    ) ?? null
  );
}

export function resolvePaymentToken(
  tokens: OrderPaymentQrToken[],
  needle: string,
): OrderPaymentQrToken | null {
  if (!needle) return null;
  return tokens.find((row) => row.token === needle) ?? null;
}

export type AutoMatchResult =
  | { status: "matched"; token: OrderPaymentQrToken; orderId: string; amount: number; reason: string }
  | { status: "unmatched"; reason: string; token?: OrderPaymentQrToken | null }
  | { status: "manual"; reason: string; token: OrderPaymentQrToken }
  | { status: "ignored"; reason: string; token?: OrderPaymentQrToken | null };

/** Điều kiện auto-match sau khi đã lưu bank txn và ví bật auto. */
export function evaluateAutoMatch(input: {
  amountIn: number;
  content: string;
  description: string;
  code: string;
  accountNumber: string;
  tokens: OrderPaymentQrToken[];
  orders: SePayMatchOrder[];
  recentPayments?: { orderId: string; amount: number; at: string }[];
  bankAt: string;
}): AutoMatchResult {
  if (!(input.amountIn > 0)) return { status: "ignored", reason: "Chỉ khớp tiền vào." };
  const needle = extractSbToken(input.content, input.description, input.code);
  if (!needle) return { status: "unmatched", reason: "Không có mã SB trong nội dung CK." };
  const token = resolvePaymentToken(input.tokens, needle);
  if (!token) return { status: "unmatched", reason: "Mã SB không thuộc cửa hàng." };
  if (token.status === "matched") return { status: "ignored", reason: "Mã SB đã khớp trước đó.", token };
  if (token.status === "void") return { status: "unmatched", reason: "Mã SB đã hủy.", token };
  if (token.status !== "open") return { status: "unmatched", reason: "Mã SB không còn mở.", token };
  if (normalizeAccountNumber(token.accountNumber) !== normalizeAccountNumber(input.accountNumber)) {
    return { status: "unmatched", reason: "STK nhận khác ví phát mã.", token };
  }
  if (Math.round(input.amountIn) !== Math.round(token.amount)) {
    return { status: "unmatched", reason: "Số tiền CK khác số trên mã.", token };
  }
  const order = input.orders.find((row) => row.id === token.orderId) ?? null;
  if (!order) return { status: "unmatched", reason: "Không thấy đơn gắn mã.", token };
  if (order.status === "huy" || order.status === "xong" || order.status === "draft_upload" || order.status === "upload_error") {
    return { status: "unmatched", reason: "Đơn đã khóa hoặc không thu được.", token };
  }
  if (order.channel === "tiktok" || order.channel === "shopee") {
    return { status: "unmatched", reason: "Đơn sàn không thu trên web.", token };
  }
  const remain = remainOf(order);
  if (remain !== null && remain <= 0) return { status: "unmatched", reason: "Đơn đã thu đủ.", token };
  if (remain !== null && Math.round(input.amountIn) > remain) {
    return { status: "unmatched", reason: "Số tiền vượt phần còn lại.", token };
  }
  const bankMs = new Date(input.bankAt).getTime();
  const duplicateManual = (input.recentPayments ?? []).some((payment) => {
    if (payment.orderId !== order.id) return false;
    if (Math.round(payment.amount) !== Math.round(input.amountIn)) return false;
    const delta = Math.abs(new Date(payment.at).getTime() - bankMs);
    return delta <= 15 * 60 * 1000;
  });
  if (duplicateManual) {
    return { status: "manual", reason: "Đã có khoản thu tay cùng số tiền ±15 phút.", token };
  }
  return {
    status: "matched",
    token,
    orderId: order.id,
    amount: Math.round(input.amountIn),
    reason: "Khớp mã SB + số tiền + ví.",
  };
}

/** Chuẩn hoá mã thanh toán legacy từ `code` hoặc nội dung CK TT…. */
export function extractPaymentNeedle(payload: SePayWebhookPayload): string {
  const sb = extractSbToken(payload.code, payload.content, payload.description);
  if (sb) return sb;
  const fromCode = String(payload.code ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "");
  if (fromCode) return fromCode;
  const content = String(payload.content ?? payload.description ?? "").toUpperCase();
  const dh = content.match(/\bDH\d{4,}\b/);
  if (dh) return dh[0];
  const match = content.match(/\b(?:TT|MH)\d{6}-\d{2,4}\b/);
  return match?.[0] ?? "";
}

export function findOrderForSePay(orders: SePayMatchOrder[], payload: SePayWebhookPayload): SePayMatchOrder | null {
  const needle = extractPaymentNeedle(payload);
  if (!needle) return null;
  if (needle.startsWith("SB")) return null;
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

/** Số tiền ghi thu legacy: không vượt phần còn lại nếu đã có tổng. */
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

export function parseSePayAuthHeader(header: string | null | undefined, expected: string): boolean {
  const key = expected.trim();
  if (!key) return false;
  const raw = (header ?? "").trim();
  if (!raw) return false;
  if (raw === key) return true;
  if (raw === `Bearer ${key}` || raw === `Apikey ${key}`) return true;
  if (raw.toLowerCase() === `apikey ${key.toLowerCase()}`) return true;
  if (raw.toLowerCase() === `bearer ${key.toLowerCase()}`) return true;
  return false;
}

export function makeApiKey(random: () => number = Math.random): string {
  const chunk = () =>
    Array.from({ length: 8 }, () => SB_TOKEN_ALPHABET[Math.floor(random() * SB_TOKEN_ALPHABET.length)]).join("");
  return `sb_${chunk()}${chunk()}`;
}
