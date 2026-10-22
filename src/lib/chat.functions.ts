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
  const actor = await assertChatRole();
  const { metaPageStatus } = await import("@/server/service");
  const page = await metaPageStatus(actor);
  return {
    ready: true as const,
    /** Fanpage Nhà In đã nối (token local) — inbox chỉ của page này. */
    pageConnected: page.connected,
    pageName: page.pageName,
    pageId: page.pageId,
    metaAppIdSaved: page.metaAppIdSaved,
  };
});

export const connectShopMetaPage = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        pageToken: z.string().trim().min(20).max(6000),
        verifyToken: z.string().trim().max(200).optional(),
        pageName: z.string().trim().max(120).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const actor = await assertChatRole();
    if (actor.role !== "owner") throw new Error("Chỉ chủ nối Fanpage.");
    const { connectMetaPage } = await import("@/server/service");
    return connectMetaPage(actor, data);
  });

export const disconnectShopMetaPage = createServerFn({ method: "POST" }).handler(async () => {
  const actor = await assertChatRole();
  if (actor.role !== "owner") throw new Error("Chỉ chủ ngắt Fanpage.");
  const { disconnectMetaPage } = await import("@/server/service");
  return disconnectMetaPage(actor);
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
