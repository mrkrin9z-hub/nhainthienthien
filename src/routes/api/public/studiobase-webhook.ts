import { createFileRoute } from "@tanstack/react-router";

import { shopKv } from "@/server/bindings";
import { ingestInboundChatEvent } from "@/server/service";
import { verifyStudioBaseWebhook } from "@/server/studiobase";

const SEEN_KEY = "studiobase_webhook_seen";
const LAST_KEY = "studiobase_webhook_last";

/**
 * Nhận sự kiện Meta đã ủy quyền qua StudioBase (nếu có).
 * Chỉ ghi vào chat local Thiên Thiên — không đọc inbox StudioBase.
 */
export const Route = createFileRoute("/api/public/studiobase-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("X-StudioBase-Signature") || request.headers.get("x-studiobase-signature");
        const ok = await verifyStudioBaseWebhook(raw, signature);
        if (!ok) return new Response("Chữ ký không hợp lệ.", { status: 401 });

        let event: {
          id?: string;
          event?: string;
          type?: string;
          created_at?: string;
          data?: Record<string, unknown> | null;
        };
        try {
          event = JSON.parse(raw) as typeof event;
        } catch {
          return new Response("Body JSON không hợp lệ.", { status: 400 });
        }

        const kv = await shopKv();
        if (kv && event.id) {
          const seen = ((await kv.get(SEEN_KEY, "json")) as string[] | null) ?? [];
          if (seen.includes(event.id)) {
            return Response.json({ ok: true, duplicate: true });
          }
          const next = [event.id, ...seen].slice(0, 200);
          await kv.put(SEEN_KEY, JSON.stringify(next));
          await kv.put(
            LAST_KEY,
            JSON.stringify({
              id: event.id,
              event: event.event || event.type,
              created_at: event.created_at,
              at: new Date().toISOString(),
            }),
          );
        }

        const data = event.data && typeof event.data === "object" ? event.data : {};
        const content = String(data.content || data.message || data.text || "").trim();
        const mediaUrl = typeof data.media_url === "string" ? data.media_url : null;
        const kind = String(event.event || event.type || "").toLowerCase();
        if ((kind.includes("message") || kind.includes("comment") || content || mediaUrl) && (content || mediaUrl)) {
          await ingestInboundChatEvent({
            externalId: typeof data.message_id === "string" ? data.message_id : event.id,
            channel: String(data.channel_type || data.channel || (kind.includes("comment") ? "comment" : "messenger")),
            pageName: typeof data.page_name === "string" ? data.page_name : undefined,
            customerName: typeof data.customer_name === "string" ? data.customer_name : typeof data.external_user_name === "string" ? data.external_user_name : undefined,
            customerPhone: typeof data.customer_phone === "string" ? data.customer_phone : undefined,
            externalUserId: typeof data.psid === "string" ? data.psid : typeof data.external_user_id === "string" ? data.external_user_id : undefined,
            content,
            mediaUrl,
            externalCommentId: typeof data.external_comment_id === "string" ? data.external_comment_id : null,
            createdAt: typeof event.created_at === "string" ? event.created_at : undefined,
          });
        }

        return Response.json({ ok: true, local: true });
      },
    },
  },
});
