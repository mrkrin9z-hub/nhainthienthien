/** Kết nối Fanpage Thiên Thiên qua Meta Graph — không lấy inbox StudioBase. */

export type MetaPageLink = {
  pageId: string;
  pageName: string;
  /** Page access token lưu local. */
  pageToken: string;
  /** Token xác minh webhook Meta. */
  verifyToken: string;
  connectedAt: string;
};

export function parseMetaPageLink(raw: string | null | undefined): MetaPageLink | null {
  const text = (raw || "").trim();
  if (!text) return null;
  try {
    const json = JSON.parse(text) as Partial<MetaPageLink>;
    if (!json.pageId || !json.pageToken) return null;
    return {
      pageId: String(json.pageId).trim(),
      pageName: String(json.pageName || "Fanpage").trim() || "Fanpage",
      pageToken: String(json.pageToken).trim(),
      verifyToken: String(json.verifyToken || "").trim(),
      connectedAt: String(json.connectedAt || "").trim() || new Date().toISOString(),
    };
  } catch {
    // Legacy: chỉ lưu page token thuần.
    if (text.length > 20 && !text.startsWith("{")) {
      return {
        pageId: "",
        pageName: "Fanpage",
        pageToken: text,
        verifyToken: "",
        connectedAt: "",
      };
    }
    return null;
  }
}

export function metaPageConnected(link: MetaPageLink | null): boolean {
  return Boolean(link?.pageToken && (link.pageId || link.pageToken));
}

/** Parse payload webhook Messenger → tin inbound. */
export type MetaInboundMessage = {
  pageId: string;
  pageName?: string;
  psid: string;
  customerName?: string;
  messageId: string;
  content: string;
  mediaUrl?: string | null;
  createdAt: string;
  isComment?: boolean;
  commentId?: string | null;
};

export function parseMetaWebhook(body: unknown): MetaInboundMessage[] {
  if (!body || typeof body !== "object") return [];
  const root = body as { object?: string; entry?: unknown[] };
  if (root.object !== "page" || !Array.isArray(root.entry)) return [];
  const out: MetaInboundMessage[] = [];
  for (const entry of root.entry) {
    if (!entry || typeof entry !== "object") continue;
    const e = entry as { id?: string; time?: number; messaging?: unknown[]; changes?: unknown[] };
    const pageId = String(e.id || "");
    const messaging = Array.isArray(e.messaging) ? e.messaging : [];
    for (const item of messaging) {
      if (!item || typeof item !== "object") continue;
      const msg = item as {
        sender?: { id?: string };
        recipient?: { id?: string };
        timestamp?: number;
        message?: {
          mid?: string;
          text?: string;
          is_echo?: boolean;
          attachments?: { type?: string; payload?: { url?: string } }[];
        };
      };
      if (msg.message?.is_echo) continue;
      const psid = String(msg.sender?.id || "");
      const text = String(msg.message?.text || "").trim();
      const attachments = msg.message?.attachments ?? [];
      const mediaUrl = attachments.find((a) => a?.payload?.url)?.payload?.url ?? null;
      if (!psid || (!text && !mediaUrl)) continue;
      out.push({
        pageId,
        psid,
        messageId: String(msg.message?.mid || `${psid}-${msg.timestamp || Date.now()}`),
        content: text || (mediaUrl ? "[ảnh]" : ""),
        mediaUrl,
        createdAt: new Date(msg.timestamp || e.time || Date.now()).toISOString(),
      });
    }
  }
  return out;
}
