import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const createOrderSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(8).max(20),
  note: z.string().trim().max(1000).optional().default(""),
  fulfillment: z.enum(["pickup", "delivery"]),
  address: z.string().trim().max(300).optional().default(""),
  idempotencyKey: z.string().min(8).max(80),
  items: z
    .array(z.object({ variantId: z.string().min(2).max(40), quantity: z.number().int().min(1).max(500) }))
    .min(1)
    .max(20),
});

export const createOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => createOrderSchema.parse(data))
  .handler(async ({ data }) => {
    const { createWebOrder } = await import("@/server/service");
    return createWebOrder({
      fullName: data.fullName,
      phone: data.phone,
      note: data.note,
      fulfillment: data.fulfillment,
      address: data.address,
      idempotencyKey: data.idempotencyKey,
      items: data.items.map((item) => ({ skuId: item.variantId, quantity: item.quantity })),
    });
  });

const uploadTicketSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(10),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

export const createUploadTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadTicketSchema.parse(data))
  .handler(async ({ data }) => {
    const { createUploadTicket: ticket } = await import("@/server/service");
    return ticket(data);
  });

const markFileSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(10),
  fileId: z.string().uuid(),
  status: z.enum(["complete", "error"]),
  widthPx: z.number().int().positive().optional(),
  heightPx: z.number().int().positive().optional(),
});

export const markFileStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => markFileSchema.parse(data))
  .handler(async ({ data }) => {
    const { markFileStatus: mark } = await import("@/server/service");
    return mark(data);
  });

const submitSchema = z.object({
  orderId: z.string().uuid(),
  accessToken: z.string().min(10),
});

export const submitOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { submitWebOrder } = await import("@/server/service");
    return submitWebOrder(data);
  });

const lookupSchema = z.object({
  code: z.string().trim().min(4).max(30),
  phone: z.string().trim().min(8).max(20),
});

export type OrderLookupResult = {
  code: string;
  status: string;
  createdAt: string;
  total: number | null;
  fulfillment: string;
  address: string | null;
  note: string | null;
  customerName: string;
  items: { name: string; variant: string; quantity: number; lineTotal: number | null }[];
  fileCount: number;
  history: { to: string; at: string; note: string | null }[];
};

const albumTicketSchema = z.object({
  phone: z.string().trim().min(8).max(20),
  fileName: z.string().min(1).max(200),
  mimeType: z.string().min(3).max(100),
  sizeBytes: z.number().int().min(1).max(50 * 1024 * 1024),
});

export const createAlbumTicket = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => albumTicketSchema.parse(data))
  .handler(async ({ data }) => {
    const { createAlbumTicket: ticket } = await import("@/server/service");
    return ticket(data);
  });

const uploadTargetSchema = z.object({
  token: z.string().regex(/^[a-f0-9]{32}$/),
});

export const getUploadTarget = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => uploadTargetSchema.parse(data))
  .handler(async ({ data }) => {
    const { publicUploadTarget } = await import("@/server/service");
    return publicUploadTarget(data.token);
  });

export const acknowledgeCustomerPhotos = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => submitSchema.parse(data))
  .handler(async ({ data }) => {
    const { acknowledgeCustomerPhotos: acknowledge } = await import("@/server/service");
    return acknowledge(data);
  });

export const lookupOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => lookupSchema.parse(data))
  .handler(async ({ data }): Promise<OrderLookupResult> => {
    const { lookupOrder: lookup } = await import("@/server/service");
    return lookup(data.code, data.phone);
  });
