import { createFileRoute } from "@tanstack/react-router";

import type { SePayWebhookPayload } from "@/domain/sepay";
import { processSePayWebhook } from "@/server/service";

function authFrom(request: Request): string | null {
  return (
    request.headers.get("Authorization") ||
    request.headers.get("authorization") ||
    request.headers.get("X-Api-Key") ||
    request.headers.get("x-api-key") ||
    null
  );
}

export const Route = createFileRoute("/api/public/sepay")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        try {
          const contentType = request.headers.get("content-type") || "";
          let payload: SePayWebhookPayload;
          if (contentType.includes("application/json")) {
            payload = (await request.json()) as SePayWebhookPayload;
          } else if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
            const form = await request.formData();
            payload = {
              id: String(form.get("id") ?? ""),
              gateway: String(form.get("gateway") ?? ""),
              transactionDate: String(form.get("transactionDate") ?? ""),
              accountNumber: String(form.get("accountNumber") ?? ""),
              subAccount: String(form.get("subAccount") ?? ""),
              code: form.get("code") == null ? null : String(form.get("code")),
              content: String(form.get("content") ?? ""),
              transferType: String(form.get("transferType") ?? ""),
              description: String(form.get("description") ?? ""),
              transferAmount: Number(form.get("transferAmount") ?? 0),
              accumulated: Number(form.get("accumulated") ?? 0),
              referenceCode: String(form.get("referenceCode") ?? ""),
            };
          } else {
            payload = (await request.json()) as SePayWebhookPayload;
          }
          await processSePayWebhook(payload, authFrom(request));
          return Response.json({ success: true });
        } catch (error) {
          const message = (error as Error).message || "Lỗi SePay";
          if (message.includes("API key")) return new Response(message, { status: 401 });
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
