import { createFileRoute } from "@tanstack/react-router";

import { parseMetaWebhook } from "@/domain/meta-page";
import { shopKv } from "@/server/bindings";
import { ingestInboundChatEvent } from "@/server/service";
import { readMetaPageLink } from "@/server/meta-messenger";

const SEEN_KEY = "meta_webhook_seen";

/**
 * Webhook Meta Messenger của Fanpage Thiên Thiên.
 * Tin nhắn ghi local — không đọc inbox StudioBase.
 */
export const Route = createFileRoute("/api/public/meta-webhook")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const url = new URL(request.url);
        const mode = url.searchParams.get("hub.mode");
        const token = url.searchParams.get("hub.verify_token");
        const challenge = url.searchParams.get("hub.challenge");
        const link = await readMetaPageLink();
        if (mode === "subscribe" && token && link?.verifyToken && token === link.verifyToken && challenge) {
          return new Response(challenge, { status: 200, headers: { "content-type": "text/plain" } });
        }
        return new Response("Forbidden", { status: 403 });
      },
      POST: async ({ request }) => {
        const raw = await request.text();
        let body: unknown;
        try {
          body = JSON.parse(raw);
        } catch {
          return new Response("Bad JSON", { status: 400 });
        }
        const link = await readMetaPageLink();
        const events = parseMetaWebhook(body);
        const kv = await shopKv();
        for (const event of events) {
          if (link?.pageId && event.pageId && event.pageId !== link.pageId) continue;
          if (kv && event.messageId) {
            const seen = ((await kv.get(SEEN_KEY, "json")) as string[] | null) ?? [];
            if (seen.includes(event.messageId)) continue;
            await kv.put(SEEN_KEY, JSON.stringify([event.messageId, ...seen].slice(0, 300)));
          }
          await ingestInboundChatEvent({
            externalId: event.messageId,
            channel: event.isComment ? "comment" : "messenger",
            pageName: link?.pageName || event.pageName || "Fanpage Thiên Thiên",
            customerName: event.customerName,
            externalUserId: event.psid,
            content: event.content,
            mediaUrl: event.mediaUrl,
            externalCommentId: event.commentId ?? null,
            createdAt: event.createdAt,
          });
        }
        return Response.json({ ok: true, local: true, ingested: events.length });
      },
    },
  },
});
