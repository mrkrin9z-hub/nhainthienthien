import { createFileRoute } from "@tanstack/react-router";

import { shopKv } from "@/server/bindings";
import { verifyStudioBaseWebhook } from "@/server/studiobase";

const SEEN_KEY = "studiobase_webhook_seen";
const LAST_KEY = "studiobase_webhook_last";

export const Route = createFileRoute("/api/public/studiobase-webhook")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const raw = await request.text();
        const signature = request.headers.get("X-StudioBase-Signature") || request.headers.get("x-studiobase-signature");
        const ok = await verifyStudioBaseWebhook(raw, signature);
        if (!ok) return new Response("Chữ ký không hợp lệ.", { status: 401 });

        let event: { id?: string; event?: string; created_at?: string; data?: unknown };
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
              event: event.event,
              created_at: event.created_at,
              at: new Date().toISOString(),
            }),
          );
        }

        // Inbox client poll 5–8s; webhook chỉ ghi nhận idempotent để sẵn sàng mở rộng push.
        return Response.json({ ok: true });
      },
    },
  },
});
