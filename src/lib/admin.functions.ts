import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Actor } from "@/server/service";

async function actor(): Promise<Actor> {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  const person = await currentActor(await readStaffId());
  if (!person) throw new Error("Chưa đăng nhập.");
  return person;
}

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  return currentActor(await readStaffId());
});

export const loginStaff = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ email: z.string().email(), password: z.string().min(4) }).parse(data))
  .handler(async ({ data }) => {
    const { login } = await import("@/server/service");
    const { writeStaffId } = await import("@/server/session");
    const person = await login(data.email, data.password);
    await writeStaffId(person.id);
    return person;
  });

export const logoutStaff = createServerFn({ method: "POST" }).handler(async () => {
  const { writeStaffId } = await import("@/server/session");
  await writeStaffId(null);
  return { ok: true };
});

export const changeOwnPassword = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ current: z.string().min(4), next: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { changePassword } = await import("@/server/service");
    await changePassword(await actor(), data.current, data.next);
    return { ok: true };
  });

export const getDashboard = createServerFn({ method: "GET" }).handler(async () => {
  const { dashboard } = await import("@/server/service");
  return dashboard(await actor());
});

export const getOrders = createServerFn({ method: "GET" }).handler(async () => {
  const { listOrders } = await import("@/server/service");
  return listOrders(await actor());
});

export const getOrderDetail = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(3) }).parse(data))
  .handler(async ({ data }) => {
    const { getOrder } = await import("@/server/service");
    return getOrder(await actor(), data.code);
  });

const itemSchema = z.object({
  skuId: z.string().min(2),
  quantity: z.number().int().min(1).max(500),
  unitPrice: z.number().int().min(0).nullable().optional(),
});

export const createDeskOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        channel: z.enum(["tai_tiem", "facebook", "tiktok", "shopee"]),
        fullName: z.string().min(2),
        phone: z.string().min(8),
        address: z.string().optional().default(""),
        fulfillment: z.enum(["pickup", "delivery"]),
        note: z.string().optional().default(""),
        dueDate: z.string().nullable().optional().default(null),
        marketplaceCode: z.string().optional().default(""),
        items: z.array(itemSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createManualOrder } = await import("@/server/service");
    return createManualOrder(await actor(), data);
  });

export const changeStatus = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        status: z.enum(["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"]),
        note: z.string().optional().default(""),
        ownerOverride: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { setOrderStatus } = await import("@/server/service");
    await setOrderStatus(await actor(), data);
    return { ok: true };
  });

export const recordDeposit = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ orderId: z.string().uuid(), amount: z.number().positive(), method: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { addDeposit } = await import("@/server/service");
    await addDeposit(await actor(), data);
    return { ok: true };
  });

export const saveNote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid(), note: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { saveInternalNote } = await import("@/server/service");
    await saveInternalNote(await actor(), data.orderId, data.note);
    return { ok: true };
  });

export const saveReprint = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        reason: z.string().min(2),
        decision: z.enum(["reprint", "reject"]).nullable(),
        extraCost: z.number().nullable(),
        uses: z.array(z.object({ materialId: z.string(), qty: z.number().positive() })).default([]),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { addReprint } = await import("@/server/service");
    await addReprint(await actor(), data);
    return { ok: true };
  });

export const getPriceBoard = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ groupId: z.string().optional() }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { priceBoard } = await import("@/server/service");
    return priceBoard(await actor(), data.groupId);
  });

export const savePrice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        skuId: z.string(),
        channel: z.enum(["tai_tiem", "facebook", "tiktok", "shopee"]),
        price: z.number().int().min(0).nullable(),
        status: z.enum(["dang_ban", "nhap", "cho_duyet"]),
        note: z.string().optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { updateChannelPrice } = await import("@/server/service");
    await updateChannelPrice(await actor(), data);
    return { ok: true };
  });

export const savePieces = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ skuId: z.string(), pieces: z.number().int().positive().nullable() }).parse(data))
  .handler(async ({ data }) => {
    const { setPiecesPerPack } = await import("@/server/service");
    await setPiecesPerPack(await actor(), data.skuId, data.pieces);
    return { ok: true };
  });

export const runQuote = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        skuId: z.string(),
        channel: z.enum(["tai_tiem", "facebook", "tiktok", "shopee"]),
        price: z.number().nullable(),
        affiliate: z.boolean(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { quote } = await import("@/server/service");
    return quote(await actor(), data);
  });

export const getInventory = createServerFn({ method: "GET" }).handler(async () => {
  const { inventory } = await import("@/server/service");
  return inventory(await actor());
});

export const receiveStock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string(),
        packs: z.number().positive(),
        packPrice: z.number().min(0).nullable(),
        supplier: z.string().optional().default(""),
        note: z.string().optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { stockIn } = await import("@/server/service");
    await stockIn(await actor(), data);
    return { ok: true };
  });

export const approvePrice = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { approveMaterialPrice } = await import("@/server/service");
    await approveMaterialPrice(await actor(), data.materialId);
    return { ok: true };
  });

export const saveMaterial = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        materialId: z.string(),
        packPrice: z.number().min(0).nullable(),
        packSize: z.number().positive().nullable(),
        minStock: z.number().min(0).nullable(),
        supplier: z.string(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { updateMaterial } = await import("@/server/service");
    await updateMaterial(await actor(), data);
    return { ok: true };
  });

export const saveBomQty = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ bomId: z.string(), qty: z.number().min(0).nullable() }).parse(data))
  .handler(async ({ data }) => {
    const { updateBom } = await import("@/server/service");
    await updateBom(await actor(), data);
    return { ok: true };
  });

export const countStock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ materialId: z.string(), actual: z.number().min(0), note: z.string().optional().default("") }).parse(data))
  .handler(async ({ data }) => {
    const { recount } = await import("@/server/service");
    await recount(await actor(), data);
    return { ok: true };
  });

export const markInkOpened = createServerFn({ method: "POST" }).handler(async () => {
  const { openInk } = await import("@/server/service");
  await openInk(await actor());
  return { ok: true };
});

export const getBom = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ skuId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { bomOf } = await import("@/server/service");
    return bomOf(await actor(), data.skuId);
  });

export const getCustomers = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ q: z.string().optional().default("") }).parse(data ?? {}))
  .handler(async ({ data }) => {
    const { customerList } = await import("@/server/service");
    return customerList(await actor(), data.q);
  });

export const getCustomer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { customerDetail } = await import("@/server/service");
    return customerDetail(await actor(), data.id);
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string(), note: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { saveCustomerNote } = await import("@/server/service");
    await saveCustomerNote(await actor(), data.id, data.note);
    return { ok: true };
  });

export const punchClock = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ action: z.enum(["in", "out"]) }).parse(data))
  .handler(async ({ data }) => {
    const { clock } = await import("@/server/service");
    await clock(await actor(), data.action);
    return { ok: true };
  });

export const getAttendance = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { attendance } = await import("@/server/service");
    return attendance(await actor(), data.month);
  });

export const correctPunch = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ punchId: z.string(), inAt: z.string(), outAt: z.string().nullable(), note: z.string().optional().default("") }).parse(data),
  )
  .handler(async ({ data }) => {
    const { editPunch } = await import("@/server/service");
    await editPunch(await actor(), data);
    return { ok: true };
  });

export const grantLeave = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ staffId: z.string(), date: z.string(), note: z.string().optional().default("") }).parse(data))
  .handler(async ({ data }) => {
    const { addLeave } = await import("@/server/service");
    await addLeave(await actor(), data);
    return { ok: true };
  });

export const getPayroll = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { payroll } = await import("@/server/service");
    return payroll(await actor(), data.month);
  });

export const closePayroll = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { lockPayroll } = await import("@/server/service");
    await lockPayroll(await actor(), data.month);
    return { ok: true };
  });

export const getProfit = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { profitReport } = await import("@/server/service");
    return profitReport(await actor(), data.month);
  });

export const saveFixedMonth = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ month: z.string(), rows: z.array(z.object({ key: z.string(), amount: z.number() })) }).parse(data))
  .handler(async ({ data }) => {
    const { saveMonthlyFixed } = await import("@/server/service");
    await saveMonthlyFixed(await actor(), data.month, data.rows);
    return { ok: true };
  });

export const saveExpense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ month: z.string(), name: z.string(), amount: z.number(), note: z.string().optional().default("") }).parse(data))
  .handler(async ({ data }) => {
    const { addExpense } = await import("@/server/service");
    await addExpense(await actor(), data);
    return { ok: true };
  });

export const loadSettings = createServerFn({ method: "GET" }).handler(async () => {
  const { getSettings } = await import("@/server/service");
  return getSettings(await actor());
});

export const storeSettings = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.record(z.unknown()).parse(data))
  .handler(async ({ data }) => {
    const { saveSettings } = await import("@/server/service");
    await saveSettings(await actor(), data);
    return { ok: true };
  });

export const storeStaff = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string().optional(),
        name: z.string().min(2),
        email: z.string().email(),
        role: z.enum(["owner", "sale", "production"]),
        password: z.string().optional(),
        probation: z.boolean().optional(),
        hiredAt: z.string().nullable().optional(),
        active: z.boolean().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveStaff } = await import("@/server/service");
    await saveStaff(await actor(), data);
    return { ok: true };
  });

export const getSkuOptions = createServerFn({ method: "GET" }).handler(async () => {
  const { skuOptions } = await import("@/server/service");
  return skuOptions(await actor());
});

export const downloadExcel = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ kind: z.enum(["orders", "stock", "moves", "payroll", "profit"]), month: z.string() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { exportWorkbook } = await import("@/server/service");
    return exportWorkbook(await actor(), data.kind, data.month);
  });

export const runRecalc = createServerFn({ method: "POST" }).handler(async () => {
  const { recalc } = await import("@/server/service");
  const changed = await recalc(await actor());
  return { changed };
});

export const dueFiles = createServerFn({ method: "GET" }).handler(async () => {
  const { filesDue } = await import("@/server/service");
  return filesDue(await actor());
});

export const removeFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ fileId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteStoredFile } = await import("@/server/service");
    await deleteStoredFile(await actor(), data.fileId);
    return { ok: true };
  });
