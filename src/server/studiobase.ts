import { createHmac, timingSafeEqual } from "node:crypto";

import { readIntegrationSecret } from "@/server/secrets";

export const STUDIOBASE_CHAT_BASE =
  process.env.STUDIOBASE_CHAT_BASE?.replace(/\/$/, "") ||
  "https://xujazxqkpfouypqxqxnc.supabase.co/functions/v1/partner-chat-api/v1";

export type StudioBaseConversation = {
  id: string;
  channel_type?: string;
  channel?: string;
  page_name?: string;
  customer_name?: string | null;
  customer_phone?: string | null;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  unread_count?: number;
  external_user_name?: string | null;
  psid?: string | null;
  [key: string]: unknown;
};

export type StudioBaseMessage = {
  id: string;
  direction?: "inbound" | "outbound" | string;
  content?: string | null;
  content_type?: string | null;
  media_url?: string | null;
  created_at?: string | null;
  external_comment_id?: string | null;
  [key: string]: unknown;
};

export type StudioBaseOrder = {
  id: string;
  code?: string | null;
  status_id?: string | null;
  status_name?: string | null;
  customer_name?: string | null;
  customer_phone?: string | null;
  total_amount?: number | null;
  paid_amount?: number | null;
  photo_date?: string | null;
  is_photo_date_tbd?: boolean | null;
  notes?: string | null;
  channel?: string | null;
  is_locked?: boolean | null;
  items?: { product_id?: string | null; product_name?: string; quantity?: number; price?: number }[];
  [key: string]: unknown;
};

export type StudioBaseCatalogItem = { id: string; name?: string; [key: string]: unknown };

async function credentials(): Promise<{ apiKey: string; anon: string }> {
  const apiKey =
    (await readIntegrationSecret("studiobase_chat_api_key")) ||
    process.env.STUDIOBASE_CHAT_API_KEY?.trim() ||
    "";
  const anon =
    (await readIntegrationSecret("studiobase_anon_key")) ||
    process.env.STUDIOBASE_ANON_KEY?.trim() ||
    process.env.SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.VITE_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    "";
  if (!apiKey) throw new Error("Chưa cấu hình StudioBase Chat API key (Kết nối → StudioBase).");
  if (!anon) throw new Error("Chưa cấu hình StudioBase / Supabase anon key.");
  return { apiKey, anon };
}

export async function studiobaseConfigured(): Promise<boolean> {
  try {
    await credentials();
    return true;
  } catch {
    return false;
  }
}

async function studiobaseFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const { apiKey, anon } = await credentials();
  const url = `${STUDIOBASE_CHAT_BASE}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = new Headers(init?.headers);
  headers.set("Authorization", `Bearer ${apiKey}`);
  headers.set("apikey", anon);
  if (init?.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");
  const res = await fetch(url, { ...init, headers });
  const text = await res.text();
  let json: unknown = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = text;
  }
  if (!res.ok) {
    const message =
      typeof json === "object" && json && "error" in json
        ? String((json as { error: unknown }).error)
        : typeof json === "object" && json && "message" in json
          ? String((json as { message: unknown }).message)
          : text || `StudioBase HTTP ${res.status}`;
    throw new Error(message);
  }
  return json as T;
}

function asList<T>(payload: unknown): T[] {
  if (Array.isArray(payload)) return payload as T[];
  if (payload && typeof payload === "object") {
    const obj = payload as Record<string, unknown>;
    for (const key of ["data", "conversations", "messages", "orders", "items", "products", "branches", "categories", "statuses", "channels"]) {
      if (Array.isArray(obj[key])) return obj[key] as T[];
    }
  }
  return [];
}

export async function sbMe() {
  return studiobaseFetch<Record<string, unknown>>("/me");
}

export async function sbChannels() {
  const raw = await studiobaseFetch<unknown>("/channels");
  return asList<Record<string, unknown>>(raw);
}

export async function sbConversations(input?: { before?: string; includeComments?: boolean }) {
  const params = new URLSearchParams();
  if (input?.includeComments !== false) params.set("include_comments", "1");
  if (input?.before) params.set("before_last_message_at", input.before);
  const q = params.toString();
  const raw = await studiobaseFetch<unknown>(`/conversations${q ? `?${q}` : ""}`);
  return asList<StudioBaseConversation>(raw);
}

export async function sbMessages(conversationId: string) {
  const id = encodeURIComponent(conversationId);
  const raw = await studiobaseFetch<unknown>(`/conversations/${id}/messages`);
  return asList<StudioBaseMessage>(raw);
}

export async function sbSendMessage(
  conversationId: string,
  body: { content: string; content_type?: string; media_url?: string; external_comment_id?: string },
) {
  const id = encodeURIComponent(conversationId);
  return studiobaseFetch<unknown>(`/conversations/${id}/messages`, {
    method: "POST",
    body: JSON.stringify({
      content: body.content,
      content_type: body.content_type ?? "text",
      ...(body.media_url ? { media_url: body.media_url } : {}),
      ...(body.external_comment_id ? { external_comment_id: body.external_comment_id } : {}),
    }),
  });
}

export async function sbMarkRead(conversationId: string) {
  const id = encodeURIComponent(conversationId);
  return studiobaseFetch<unknown>(`/conversations/${id}/read`, { method: "POST", body: "{}" });
}

export async function sbCatalogBranches() {
  return asList<StudioBaseCatalogItem>(await studiobaseFetch<unknown>("/catalog/branches"));
}

export async function sbCatalogCategories() {
  return asList<StudioBaseCatalogItem>(await studiobaseFetch<unknown>("/catalog/categories"));
}

export async function sbCatalogStatuses() {
  return asList<StudioBaseCatalogItem>(await studiobaseFetch<unknown>("/catalog/order-statuses"));
}

export async function sbCatalogProducts(q?: string) {
  const query = q?.trim() ? `?q=${encodeURIComponent(q.trim())}` : "";
  return asList<StudioBaseCatalogItem & { price?: number }>(await studiobaseFetch<unknown>(`/catalog/products${query}`));
}

export async function sbConversationOrders(conversationId: string) {
  const id = encodeURIComponent(conversationId);
  return asList<StudioBaseOrder>(await studiobaseFetch<unknown>(`/conversations/${id}/orders`));
}

export async function sbCreateConversationOrder(
  conversationId: string,
  body: Record<string, unknown>,
) {
  const id = encodeURIComponent(conversationId);
  return studiobaseFetch<{ order?: StudioBaseOrder; linked?: boolean } & Record<string, unknown>>(
    `/conversations/${id}/orders`,
    { method: "POST", body: JSON.stringify(body) },
  );
}

export async function sbLinkOrder(conversationId: string, orderId: string) {
  const id = encodeURIComponent(conversationId);
  return studiobaseFetch<unknown>(`/conversations/${id}/link-order`, {
    method: "POST",
    body: JSON.stringify({ order_id: orderId }),
  });
}

export async function sbGetOrder(orderId: string) {
  return studiobaseFetch<StudioBaseOrder>(`/orders/${encodeURIComponent(orderId)}`);
}

/** Regex SĐT Việt Nam trong tin nhắn. */
export function extractVietnamPhone(text: string): string | null {
  const match = text.replace(/\u00a0/g, " ").match(/(?:\+?84|0)\s*[35789](?:[\s.-]*\d){8}/);
  if (!match) return null;
  let digits = match[0].replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) return digits.slice(0, 11);
  return null;
}

export async function verifyStudioBaseWebhook(rawBody: string, signatureHeader: string | null): Promise<boolean> {
  const secret =
    (await readIntegrationSecret("studiobase_webhook_secret")) ||
    process.env.STUDIOBASE_WEBHOOK_SECRET?.trim() ||
    "";
  if (!secret) return false;
  const expected = `sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`;
  const provided = (signatureHeader || "").trim();
  if (!provided || provided.length !== expected.length) return false;
  try {
    return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  } catch {
    return false;
  }
}

/** Nhãn UI in ấn khi status StudioBase còn tên studio. */
export const PRINT_STATUS_HINT: Record<string, string> = {
  "ngày chụp": "Ngày nhận / hẹn in",
  "đã chụp": "Đã nhận file từ khách",
  "gửi ảnh gốc": "Khách duyệt file / chọn size",
  "chỉnh sửa": "Xử lý file / retouch trước in",
  "đã gửi in": "Đưa vào máy in",
  "đã có hình": "In xong / đã giao",
};

export function printStatusHint(name: string | null | undefined): string | null {
  if (!name) return null;
  const lower = name.toLowerCase();
  for (const [key, hint] of Object.entries(PRINT_STATUS_HINT)) {
    if (lower.includes(key)) return hint;
  }
  return null;
}
