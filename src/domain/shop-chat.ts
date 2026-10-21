/** Chat inbox local của Thiên Thiên — không lấy tin nhắn/data StudioBase. */

export const CHAT_CHANNELS = ["messenger", "comment", "zalo_oa", "zalo", "manual"] as const;
export type ChatChannel = (typeof CHAT_CHANNELS)[number];

export type ShopChatMessage = {
  id: string;
  conversationId: string;
  direction: "inbound" | "outbound";
  content: string;
  contentType: "text" | "image" | "other";
  mediaUrl?: string | null;
  externalCommentId?: string | null;
  createdAt: string;
  byStaffId?: string | null;
};

export type ShopConversation = {
  id: string;
  channel: ChatChannel;
  pageName: string;
  customerName: string;
  customerPhone: string;
  externalUserId?: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string;
  unreadCount: number;
  /** Mã đơn Thiên Thiên gắn hội thoại. */
  orderCodes: string[];
  createdAt: string;
  updatedAt: string;
};

export function extractVietnamPhone(text: string): string | null {
  const match = text.replace(/\u00a0/g, " ").match(/(?:\+?84|0)\s*[35789](?:[\s.-]*\d){8}/);
  if (!match) return null;
  let digits = match[0].replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 11) digits = `0${digits.slice(2)}`;
  if (digits.startsWith("0") && digits.length >= 9 && digits.length <= 11) return digits.slice(0, 11);
  return null;
}

export function normalizeChatChannel(raw: unknown): ChatChannel {
  const value = String(raw || "").toLowerCase();
  if (value.includes("comment")) return "comment";
  if (value.includes("zalo") && value.includes("oa")) return "zalo_oa";
  if (value.includes("zalo")) return "zalo";
  if (value.includes("messenger") || value.includes("facebook") || value.includes("meta")) return "messenger";
  if (value.includes("manual") || value === "noi_bo") return "manual";
  return "messenger";
}
