import { isCancelledStatus, parseMoney, type ParsedLine } from "./marketplace.ts";

export const TIKTOK_API = "https://open-api.tiktokglobalshop.com";
export const TIKTOK_AUTH = "https://auth.tiktok-shops.com";
export const SHOPEE_API = "https://partner.shopeemobile.com";
export const LOOKBACK_SEC = 7 * 24 * 60 * 60;
export const PULL_GAP_MS = 15 * 60 * 1000;

export type TiktokLink = {
  accessToken: string;
  refreshToken: string;
  expireAt: number;
  shopCipher: string;
  shopId: string;
  pulledAt: number;
  /** Lần kéo sản phẩm gần nhất. */
  catalogAt: number;
  /** Trang kế. Rỗng nghĩa là vòng sau kéo lại từ đầu. */
  catalogToken: string;
};

export type ShopeeLink = {
  accessToken: string;
  refreshToken: string;
  expireAt: number;
  shopId: string;
  pulledAt: number;
  catalogAt: number;
  catalogToken: string;
};

type Dict = Record<string, unknown>;

function asRecord(value: unknown): Dict | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Dict;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  return parseMoney(text(value));
}

function unixIso(value: unknown): string | null {
  const n = typeof value === "number" ? value : Number(text(value));
  if (!Number.isFinite(n) || n < 1_000_000_000 || n > 4_000_000_000) return null;
  return new Date(n * 1000).toISOString();
}

function unpaid(status: string): boolean {
  return status.trim().toUpperCase() === "UNPAID";
}

export async function hmacSha256Hex(secret: string, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return [...new Uint8Array(sig)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

/** Chữ ký TikTok Shop 202309. access_token không nằm trong chuỗi ký. */
export async function tiktokSign(appSecret: string, path: string, query: Record<string, string>, body: string): Promise<string> {
  const pairs = Object.keys(query)
    .filter((key) => key !== "sign" && key !== "access_token")
    .sort()
    .map((key) => `${key}${query[key] ?? ""}`)
    .join("");
  return hmacSha256Hex(appSecret, `${appSecret}${path}${pairs}${body}${appSecret}`);
}

/** Shop API: thêm access_token và shop_id. API công khai (đăng nhập) để hai phần đó rỗng. */
export function shopeeBase(input: { partnerId: string; path: string; timestamp: string; accessToken?: string; shopId?: string }): string {
  return `${input.partnerId}${input.path}${input.timestamp}${input.accessToken ?? ""}${input.shopId ?? ""}`;
}

export async function shopeeSign(partnerKey: string, base: string): Promise<string> {
  return hmacSha256Hex(partnerKey, base);
}

export function tiktokAuthorizeUrl(serviceId: string, state: string): string {
  const params = new URLSearchParams({ service_id: serviceId.trim(), state });
  return `https://services.tiktokshop.com/open/authorize?${params.toString()}`;
}

export function shopeeAuthorizeUrl(input: { partnerId: string; timestamp: string; sign: string; redirect: string }): string {
  const params = new URLSearchParams({
    partner_id: input.partnerId,
    timestamp: input.timestamp,
    sign: input.sign,
    redirect: input.redirect,
  });
  return `${SHOPEE_API}/api/v2/shop/auth_partner?${params.toString()}`;
}

/** Giây còn lại hoặc unix giây tuyệt đối. */
export function expireAtFromApi(value: number, nowMs: number): number {
  if (!Number.isFinite(value) || value <= 0) return nowMs + 3 * 60 * 60 * 1000;
  if (value > 1_000_000_000) return value * 1000;
  return nowMs + value * 1000;
}

export function tokenFresh(expireAt: number, nowMs: number): boolean {
  return expireAt - nowMs > 5 * 60 * 1000;
}

export function publicApiMessage(prefix: string, message: string): string {
  const clean = message.replace(/[A-Za-z0-9_-]{24,}/g, "…").replace(/\s+/g, " ").trim().slice(0, 140);
  return clean ? `${prefix}: ${clean}` : `${prefix} từ chối yêu cầu.`;
}

function linkNumber(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function parseTiktokLink(raw: string): TiktokLink | null {
  if (!raw.trim()) return null;
  try {
    const row = asRecord(JSON.parse(raw));
    if (!row) return null;
    const accessToken = text(row.accessToken);
    const refreshToken = text(row.refreshToken);
    const shopCipher = text(row.shopCipher);
    if (!accessToken || !refreshToken || !shopCipher) return null;
    return {
      accessToken,
      refreshToken,
      expireAt: linkNumber(row.expireAt),
      shopCipher,
      shopId: text(row.shopId),
      pulledAt: linkNumber(row.pulledAt),
      catalogAt: linkNumber(row.catalogAt),
      catalogToken: text(row.catalogToken).slice(0, 400),
    };
  } catch {
    return null;
  }
}

export function parseShopeeLink(raw: string): ShopeeLink | null {
  if (!raw.trim()) return null;
  try {
    const row = asRecord(JSON.parse(raw));
    if (!row) return null;
    const accessToken = text(row.accessToken);
    const refreshToken = text(row.refreshToken);
    const shopId = text(row.shopId);
    if (!accessToken || !refreshToken || !/^\d{1,20}$/.test(shopId)) return null;
    return {
      accessToken,
      refreshToken,
      expireAt: linkNumber(row.expireAt),
      shopId,
      pulledAt: linkNumber(row.pulledAt),
      catalogAt: linkNumber(row.catalogAt),
      catalogToken: text(row.catalogToken).slice(0, 40),
    };
  } catch {
    return null;
  }
}

export function linesFromTiktokOrders(orders: unknown): ParsedLine[] {
  if (!Array.isArray(orders)) return [];
  const lines: ParsedLine[] = [];
  for (const item of orders) {
    const order = asRecord(item);
    if (!order) continue;
    const orderId = text(order.id);
    if (!orderId) continue;
    const status = text(order.status);
    if (unpaid(status)) continue;
    const address = asRecord(order.recipient_address);
    const payment = asRecord(order.payment);
    const shared = {
      orderId,
      buyer: text(address?.name) || text(order.buyer_nickname) || "Khách sàn",
      platformBuyer: text(order.buyer_nickname) || text(order.user_id),
      phone: text(address?.phone_number),
      address: tiktokAddress(address),
      tracking: text(order.tracking_number),
      carrier: text(order.shipping_provider),
      shipFee: money(payment?.shipping_fee),
      codAmount: null,
      payment: order.is_cod === true ? "COD" : text(order.payment_method_name),
      orderAmount: money(payment?.total_amount),
      status: isCancelledStatus(status) ? "CANCELLED" : status,
      createdAt: unixIso(order.create_time),
      shipBy: unixIso(order.rts_sla_time) ?? unixIso(order.ship_by_date),
    };
    const grouped = new Map<string, ParsedLine>();
    const items = Array.isArray(order.line_items) ? order.line_items : [];
    for (const raw of items) {
      const line = asRecord(raw);
      if (!line) continue;
      if (isCancelledStatus(text(line.display_status)) && !isCancelledStatus(status)) continue;
      const sku = text(line.seller_sku) || text(line.sku_id);
      if (!sku) continue;
      const key = sku.toLowerCase();
      const price = money(line.sale_price);
      const found = grouped.get(key);
      if (found) {
        found.qty += 1;
        found.lineAmount = found.lineAmount === null || price === null ? null : found.lineAmount + price;
        continue;
      }
      grouped.set(key, {
        ...shared,
        sku,
        name: text(line.product_name),
        variation: text(line.sku_name),
        qty: 1,
        lineAmount: price,
      });
    }
    if (grouped.size) lines.push(...grouped.values());
    else if (isCancelledStatus(status)) lines.push({ ...shared, sku: "", name: "", variation: "", qty: 1, lineAmount: null });
  }
  return lines;
}

function tiktokAddress(address: Dict | null): string {
  if (!address) return "";
  const full = text(address.full_address);
  if (full) return full;
  const parts = [text(address.address_detail)];
  if (Array.isArray(address.district_info)) {
    for (const raw of address.district_info) {
      const name = text(asRecord(raw)?.address_name);
      if (name && !parts.includes(name)) parts.push(name);
    }
  }
  return parts.filter(Boolean).join(", ");
}

export function linesFromShopeeOrders(orders: unknown): ParsedLine[] {
  if (!Array.isArray(orders)) return [];
  const lines: ParsedLine[] = [];
  for (const item of orders) {
    const order = asRecord(item);
    if (!order) continue;
    const orderId = text(order.order_sn);
    if (!orderId) continue;
    const status = text(order.order_status);
    if (unpaid(status)) continue;
    const cancelled = isCancelledStatus(status) || status.toUpperCase() === "IN_CANCEL";
    const address = asRecord(order.recipient_address);
    const packages = Array.isArray(order.package_list) ? order.package_list : [];
    const firstPackage = asRecord(packages[0]);
    const shipFee = money(order.actual_shipping_fee) ?? money(order.estimated_shipping_fee);
    const shared = {
      orderId,
      buyer: text(address?.name) || text(order.buyer_username) || "Khách sàn",
      platformBuyer: text(order.buyer_username),
      phone: text(address?.phone),
      address: text(address?.full_address),
      tracking: text(firstPackage?.tracking_number) || text(order.tracking_no),
      carrier: text(order.shipping_carrier) || text(firstPackage?.shipping_carrier),
      shipFee,
      codAmount: null,
      payment: order.cod === true ? "COD" : text(order.payment_method),
      orderAmount: money(order.total_amount),
      status: cancelled ? "CANCELLED" : status,
      createdAt: unixIso(order.create_time),
      shipBy: unixIso(order.ship_by_date) ?? unixIso(order.rts_sla_time),
    };
    const items = Array.isArray(order.item_list) ? order.item_list : [];
    let pushed = 0;
    for (const raw of items) {
      const line = asRecord(raw);
      if (!line) continue;
      const sku = text(line.model_sku) || text(line.item_sku) || text(line.model_id) || text(line.item_id);
      if (!sku) continue;
      const qtyRaw = money(line.model_quantity_purchased);
      const qty = qtyRaw && qtyRaw > 0 ? qtyRaw : 1;
      const unit = money(line.model_discounted_price) ?? money(line.model_original_price);
      lines.push({
        ...shared,
        sku,
        name: text(line.item_name),
        variation: text(line.model_name),
        qty,
        lineAmount: unit === null ? null : unit * qty,
      });
      pushed += 1;
    }
    if (!pushed && cancelled) lines.push({ ...shared, sku: "", name: "", variation: "", qty: 1, lineAmount: null });
  }
  return lines;
}
