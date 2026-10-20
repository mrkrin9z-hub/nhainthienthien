import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

async function assertChatRole() {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  const actor = await currentActor(await readStaffId());
  if (!actor) throw new Error("Chưa đăng nhập.");
  if (actor.mustChangePassword) throw new Error("Đổi mật khẩu trước khi dùng.");
  if (actor.role !== "owner" && actor.role !== "sale") {
    throw new Error("Chỉ chủ và sale dùng hộp thoại StudioBase.");
  }
  return actor;
}

export const chatStatus = createServerFn({ method: "GET" }).handler(async () => {
  await assertChatRole();
  const { studiobaseConfigured, sbMe, sbChannels } = await import("@/server/studiobase");
  const configured = await studiobaseConfigured();
  if (!configured) return { configured: false as const, me: null, channels: [] as Record<string, unknown>[] };
  const [me, channels] = await Promise.all([sbMe(), sbChannels()]);
  return { configured: true as const, me, channels };
});

export const listChatConversations = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        before: z.string().optional(),
        includeComments: z.boolean().optional().default(true),
      })
      .parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    await assertChatRole();
    const { sbConversations } = await import("@/server/studiobase");
    return { conversations: await sbConversations(data) };
  });

export const listChatMessages = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ conversationId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    await assertChatRole();
    const { sbMessages, sbMarkRead, extractVietnamPhone } = await import("@/server/studiobase");
    const messages = await sbMessages(data.conversationId);
    try {
      await sbMarkRead(data.conversationId);
    } catch {
      // read is best-effort
    }
    const phones = messages
      .map((item) => extractVietnamPhone(String(item.content || "")))
      .filter((item): item is string => Boolean(item));
    return { messages, suggestedPhone: phones[phones.length - 1] ?? null };
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
    await assertChatRole();
    const { sbSendMessage } = await import("@/server/studiobase");
    await sbSendMessage(data.conversationId, {
      content: data.content,
      external_comment_id: data.externalCommentId,
    });
    return { ok: true };
  });

export const chatCatalog = createServerFn({ method: "GET" }).handler(async () => {
  await assertChatRole();
  const { sbCatalogBranches, sbCatalogCategories, sbCatalogStatuses, sbCatalogProducts } = await import("@/server/studiobase");
  const [branches, categories, statuses, products] = await Promise.all([
    sbCatalogBranches(),
    sbCatalogCategories(),
    sbCatalogStatuses(),
    sbCatalogProducts(),
  ]);
  return { branches, categories, statuses, products };
});

export const listConversationOrders = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ conversationId: z.string().min(1) }).parse(data))
  .handler(async ({ data }) => {
    await assertChatRole();
    const { sbConversationOrders, printStatusHint } = await import("@/server/studiobase");
    const orders = await sbConversationOrders(data.conversationId);
    return {
      orders: orders.map((order) => ({
        ...order,
        printHint: printStatusHint(order.status_name),
      })),
    };
  });

const createOrderSchema = z.object({
  conversationId: z.string().min(1),
  customer_name: z.string().trim().min(1).max(120),
  customer_phone: z.string().trim().min(8).max(20),
  branch_id: z.string().uuid(),
  category_id: z.string().uuid(),
  photo_date: z.string().optional(),
  is_photo_date_tbd: z.boolean().optional().default(false),
  total_amount: z.number().min(0),
  paid_amount: z.number().min(0).default(0),
  notes: z.string().max(2000).optional().default(""),
  channel: z.string().max(40).optional().default("Facebook"),
  client_request_id: z.string().min(8).max(80),
  items: z
    .array(
      z.object({
        product_id: z.string().uuid().optional(),
        product_name: z.string().min(1).max(200),
        quantity: z.number().int().min(1).max(500),
        price: z.number().min(0),
      }),
    )
    .min(1)
    .max(40),
});

export const createConversationOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    await assertChatRole();
    const { sbCreateConversationOrder } = await import("@/server/studiobase");
    const { conversationId, ...body } = data;
    const payload: Record<string, unknown> = {
      customer_name: body.customer_name,
      customer_phone: body.customer_phone,
      branch_id: body.branch_id,
      category_id: body.category_id,
      is_photo_date_tbd: body.is_photo_date_tbd,
      total_amount: body.total_amount,
      paid_amount: body.paid_amount,
      notes: body.notes,
      channel: body.channel,
      client_request_id: body.client_request_id,
      items: body.items.map((item) => ({
        ...(item.product_id ? { product_id: item.product_id } : {}),
        product_name: item.product_name,
        quantity: item.quantity,
        price: item.price,
      })),
    };
    if (!body.is_photo_date_tbd && body.photo_date) payload.photo_date = body.photo_date;
    return sbCreateConversationOrder(conversationId, payload);
  });
