import { createFileRoute } from "@tanstack/react-router";

import type { SePayWebhookPayload } from "@/domain/sepay";
import { pingSePayWebhook, processSePayWebhook } from "@/server/service";

function authFrom(request: Request): string | null {
  return (
    request.headers.get("Authorization") ||
    request.headers.get("authorization") ||
    request.headers.get("X-Api-Key") ||
    request.headers.get("x-api-key") ||
    null
  );
}

async function parsePayload(request: Request): Promise<SePayWebhookPayload | null> {
  const contentType = request.headers.get("content-type") || "";
  if (contentType.includes("application/x-www-form-urlencoded") || contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const id = String(form.get("id") ?? "").trim();
    if (!id) return null;
    return {
      id,
      gateway: String(form.get("gateway") ?? ""),
      transactionDate: String(form.get("transactionDate") ?? ""),
      accountNumber: String(form.get("accountNumber") ?? ""),
      subAccount: String(form.get("subAccount") ?? ""),
      code: form.get("code") == null ? null : String(form.get("code")),
      content: String(form.get("content") ?? ""),
      transferType: String(form.get("transferType") ?? "in"),
      description: String(form.get("description") ?? ""),
      transferAmount: Number(form.get("transferAmount") ?? 0),
      accumulated: Number(form.get("accumulated") ?? 0),
      referenceCode: String(form.get("referenceCode") ?? ""),
    };
  }
  const text = await request.text();
  if (!text.trim() || text.trim() === "{}") return null;
  const payload = JSON.parse(text) as SePayWebhookPayload;
  if (!String(payload.id ?? "").trim()) return null;
  return payload;
}

export const Route = createFileRoute("/api/public/sepay")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        try {
          await pingSePayWebhook(authFrom(request));
          return Response.json({ success: true, ready: true });
        } catch (error) {
          const message = (error as Error).message || "Lỗi SePay";
          if (message.includes("API key") || message.includes("chưa bật") || message.includes("chưa tạo")) {
            return new Response(message, { status: 401 });
          }
          return new Response(message, { status: 400 });
        }
      },
      POST: async ({ request }) => {
        try {
          const payload = await parsePayload(request);
          if (!payload) {
            await pingSePayWebhook(authFrom(request));
            return Response.json({ success: true, ready: true });
          }
          const result = await processSePayWebhook(payload, authFrom(request));
          return Response.json(result);
        } catch (error) {
          const message = (error as Error).message || "Lỗi SePay";
          if (message.includes("API key")) return new Response(message, { status: 401 });
          return new Response(message, { status: 400 });
        }
      },
    },
  },
});
