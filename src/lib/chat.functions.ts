import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import { CHAT_CHANNELS } from "@/domain/shop-chat";

async function assertChatRole() {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  const actor = await currentActor(await readStaffId());
  if (!actor) throw new Error("Chưa đăng nhập.");
  if (actor.mustChangePassword) throw new Error("Đổi mật khẩu trước khi dùng.");
  if (actor.role !== "owner" && actor.role !== "sale") {
    throw new Error("Chỉ chủ và sale dùng Chat Thiên Thiên.");
  }
  return actor;
}

export const chatStatus = createServerFn({ method: "GET" }).handler(async () => {
  await assertChatRole();
  const { studiobaseFacebookLoginConfigured } = await import("@/server/studiobase");
  const { readIntegrationSecret } = await import("@/server/secrets");
  const facebookLogin = await studiobaseFacebookLoginConfigured();
  const metaToken = Boolean(await readIntegrationSecret("meta"));
  return {
    /** Chat luôn dùng data local; không cần StudioBase để mở inbox. */
    ready: true as const,
    facebookLoginViaStudioBase: facebookLogin,
    metaPageTokenSaved: metaToken,
  };
});

export const listChatConversations = createServerFn({ method: "GET" }).handler(async () => {
  const actor = await assertChatRole();
  const { listShopConversations } = await import("@/server/service");
  return listShopConversations(actor);
});

export const listChatMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ conversationId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    const { listShopChatMessages } = await import("@/server/service");
    return listShopChatMessages(actor, data.conversationId);
  });

export const sendChatMessage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        conversationId: z.string().min(1),
        content: z.string().trim().min(1).max(4000),
        externalCommentId: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    const { sendShopChatMessage } = await import("@/server/service");
    return sendShopChatMessage(actor, data);
  });

export const createChatConversation = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        customerName: z.string().trim().min(1).max(120),
        customerPhone: z.string().trim().max(20).optional().default(""),
        pageName: z.string().trim().max(120).optional(),
        channel: z.enum(CHAT_CHANNELS).optional().default("manual"),
        firstMessage: z.string().trim().max(4000).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    const { createManualConversation } = await import("@/server/service");
    return createManualConversation(actor, data);
  });

export const listConversationOrders = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ conversationId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    const { ordersForConversation } = await import("@/server/service");
    return ordersForConversation(actor, data.conversationId);
  });

export const linkConversationOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ conversationId: z.string().min(1), orderCode: z.string().trim().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    const { linkOrderToConversation } = await import("@/server/service");
    return linkOrderToConversation(actor, data.conversationId, data.orderCode);
  });
