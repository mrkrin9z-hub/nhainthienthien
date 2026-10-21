import { createHmac, timingSafeEqual } from "node:crypto";

import { readIntegrationSecret } from "@/server/secrets";

/**
 * StudioBase chỉ dùng để ủy quyền Facebook (app Meta sẵn có),
 * tránh đăng ký Facebook Developer App mới cho Thiên Thiên.
 * Không lấy hội thoại / tin nhắn / đơn / catalog từ StudioBase.
 */

export async function studiobaseFacebookLoginConfigured(): Promise<boolean> {
  const apiKey =
    (await readIntegrationSecret("studiobase_chat_api_key")) ||
    process.env.STUDIOBASE_CHAT_API_KEY?.trim() ||
    "";
  return Boolean(apiKey);
}

/** Webhook từ StudioBase (nếu có) chỉ để nhận sự kiện Meta đã ủy quyền — ghi vào chat local. */
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
