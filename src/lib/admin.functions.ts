import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

import type { Actor } from "@/server/service";

async function session(): Promise<Actor> {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  const person = await currentActor(await readStaffId());
  if (!person) throw new Error("Chưa đăng nhập.");
  return person;
}

async function actor(): Promise<Actor> {
  const person = await session();
  if (person.mustChangePassword) throw new Error("Đổi mật khẩu trước khi dùng.");
  return person;
}

export const getMe = createServerFn({ method: "GET" }).handler(async () => {
  const { readStaffId } = await import("@/server/session");
  const { currentActor } = await import("@/server/service");
  return currentActor(await readStaffId());
});

export const loginStaff = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ email: z.string().email(), password: z.string().min(4), code: z.string().optional() }).parse(data),
  )
  .handler(async ({ data }) => {
    const { login } = await import("@/server/service");
    const { writeStaffId } = await import("@/server/session");
    const person = await login(data.email, data.password, data.code);
    if ("needsTotp" in person) return person;
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
    await changePassword(await session(), data.current, data.next);
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

export const getPhotoAlbums = createServerFn({ method: "GET" }).handler(async () => {
  const { listPhotoAlbums } = await import("@/server/service");
  return listPhotoAlbums(await actor());
});

export const getPhotoAlbum = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ albumId: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { getPhotoAlbum: load } = await import("@/server/service");
    return load(await actor(), data.albumId);
  });

export const linkPhotoAlbum = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ albumId: z.string().uuid(), code: z.string().trim().min(4).max(30) }).parse(data))
  .handler(async ({ data }) => {
    const { linkAlbumToOrder } = await import("@/server/service");
    return linkAlbumToOrder(await actor(), data.albumId, data.code);
  });

export const orderUploadLink = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string().uuid(), rotate: z.boolean().optional().default(false) }).parse(data))
  .handler(async ({ data }) => {
    const { orderUploadLink: link } = await import("@/server/service");
    return link(await actor(), data.orderId, data.rotate);
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
        depositPaid: z.number().int().min(0).max(100_000_000).optional().default(0),
        depositMethod: z.string().optional().default(""),
        items: z.array(itemSchema).min(1),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createManualOrder } = await import("@/server/service");
    return createManualOrder(await actor(), data);
  });

export const reviseOrder = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string().uuid(),
        fullName: z.string().min(2),
        phone: z.string().min(8),
        address: z.string().optional().default(""),
        fulfillment: z.enum(["pickup", "delivery"]),
        note: z.string().optional().default(""),
        dueDate: z.string().nullable().optional().default(null),
        items: z.array(itemSchema).min(1).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { reviseOrder: revise } = await import("@/server/service");
    await revise(await actor(), data);
    return { ok: true };
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

const priceMap = z.object({
  tai_tiem: z.number().int().min(1000).max(100_000_000).optional(),
  facebook: z.number().int().min(1000).max(100_000_000).optional(),
  tiktok: z.number().int().min(1000).max(100_000_000).optional(),
  shopee: z.number().int().min(1000).max(100_000_000).optional(),
});

export const createPriceSize = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        widthCm: z.number().int().min(1).max(200),
        heightCm: z.number().int().min(1).max(200),
        sheets: z.number().int().min(1).max(100),
        prices: priceMap,
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createPriceSize: create } = await import("@/server/service");
    const prices: Partial<Record<"tai_tiem" | "facebook" | "tiktok" | "shopee", number>> = {};
    if (data.prices.tai_tiem !== undefined) prices.tai_tiem = data.prices.tai_tiem;
    if (data.prices.facebook !== undefined) prices.facebook = data.prices.facebook;
    if (data.prices.tiktok !== undefined) prices.tiktok = data.prices.tiktok;
    if (data.prices.shopee !== undefined) prices.shopee = data.prices.shopee;
    return create(await actor(), { ...data, prices });
  });

export const importPriceSheet = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        groupId: z.string().min(1),
        filename: z.string().min(1).max(180),
        base64: z.string().min(1).max(6_000_000),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { importPriceSheet: load } = await import("@/server/service");
    return load(await actor(), data);
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
        leadTimeDays: z.number().int().min(0).nullable().optional(),
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
  .inputValidator((data: unknown) =>
    z.object({ q: z.string().optional().default(""), includeCancelled: z.boolean().optional().default(false) }).parse(data ?? {}),
  )
  .handler(async ({ data }) => {
    const { customerList } = await import("@/server/service");
    return customerList(await actor(), data.q, data.includeCancelled);
  });

export const getCustomer = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ id: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { customerDetail } = await import("@/server/service");
    return customerDetail(await actor(), data.id);
  });

export const saveCustomer = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        id: z.string(),
        note: z.string(),
        tags: z.array(z.string()).optional(),
        specialDates: z.array(z.object({ label: z.string(), month: z.number().int(), day: z.number().int() })).optional(),
        name: z.string().optional(),
        phone: z.string().optional(),
        address: z.string().optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveCustomerNote } = await import("@/server/service");
    const profile = data.name !== undefined || data.phone !== undefined || data.address !== undefined
      ? { ...(data.name !== undefined ? { name: data.name } : {}), ...(data.phone !== undefined ? { phone: data.phone } : {}), ...(data.address !== undefined ? { address: data.address } : {}) }
      : undefined;
    await saveCustomerNote(await actor(), data.id, data.note, data.tags, data.specialDates, profile);
    return { ok: true };
  });

export const getReminders = createServerFn({ method: "GET" }).handler(async () => {
  const { reminderList } = await import("@/server/service");
  return reminderList(await actor());
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

export const getReport = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string(), grain: z.enum(["day", "week", "month"]) }).parse(data))
  .handler(async ({ data }) => {
    const { ownerReport } = await import("@/server/service");
    return ownerReport(await actor(), data.month, data.grain);
  });

export const getKpi = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { kpiReport } = await import("@/server/service");
    return kpiReport(await actor(), data.month);
  });

export const saveFixedMonth = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ month: z.string(), rows: z.array(z.object({ key: z.string(), amount: z.number() })) }).parse(data))
  .handler(async ({ data }) => {
    const { saveMonthlyFixed } = await import("@/server/service");
    await saveMonthlyFixed(await actor(), data.month, data.rows);
    return { ok: true };
  });

export const saveExpense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        month: z.string(),
        name: z.string(),
        amount: z.number(),
        note: z.string().optional().default(""),
        category: z.enum(["mat_bang", "dien_nuoc", "vat_tu", "van_chuyen", "nhan_su", "sua_chua", "khac"]).optional(),
        wallet: z.enum(["tien_mat", "chuyen_khoan"]).optional(),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { addExpense } = await import("@/server/service");
    await addExpense(await actor(), data);
    return { ok: true };
  });

export const removeExpense = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ id: z.string().uuid() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteExpense } = await import("@/server/service");
    await deleteExpense(await actor(), data.id);
    return { ok: true };
  });

export const saveWalletAdjust = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        wallet: z.enum(["tien_mat", "chuyen_khoan"]),
        amount: z.number().int().min(-100_000_000).max(100_000_000).refine((value) => value !== 0),
        note: z.string().max(200).optional().default(""),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { adjustWallet } = await import("@/server/service");
    await adjustWallet(await actor(), data);
    return { ok: true };
  });

export const getMoneyDesk = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { moneyDesk } = await import("@/server/service");
    return moneyDesk(await actor(), data.month);
  });

export const getCollectList = createServerFn({ method: "GET" }).handler(async () => {
  const { collectList } = await import("@/server/service");
  return collectList(await actor());
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

export const getAudits = createServerFn({ method: "GET" }).handler(async () => {
  const { listAudits } = await import("@/server/service");
  return listAudits(await actor());
});

export const startTotp = createServerFn({ method: "POST" }).handler(async () => {
  const { beginTotp } = await import("@/server/service");
  return beginTotp(await actor());
});

export const finishTotp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ code: z.string().min(6).max(8) }).parse(data))
  .handler(async ({ data }) => {
    const { confirmTotp } = await import("@/server/service");
    await confirmTotp(await actor(), data.code);
    return { ok: true };
  });

export const stopTotp = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ password: z.string().min(4), code: z.string().min(6).max(8) }).parse(data))
  .handler(async ({ data }) => {
    const { disableTotp } = await import("@/server/service");
    await disableTotp(await actor(), data.password, data.code);
    return { ok: true };
  });

export const getBackups = createServerFn({ method: "GET" }).handler(async () => {
  const { backups } = await import("@/server/service");
  return backups(await actor());
});

export const fetchBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ key: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { downloadBackupFile } = await import("@/server/service");
    return downloadBackupFile(await actor(), data.key);
  });

export const restoreBackup = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ key: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { restoreFromBackup } = await import("@/server/service");
    await restoreFromBackup(await actor(), data.key);
    return { ok: true };
  });

export const getIntegrations = createServerFn({ method: "GET" }).handler(async () => {
  const { integrations } = await import("@/server/service");
  return integrations(await actor());
});

export const saveIntegration = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ provider: z.string(), value: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { setIntegration } = await import("@/server/service");
    await setIntegration(await actor(), data.provider, data.value);
    return { ok: true };
  });

export const getMarketplaceSync = createServerFn({ method: "GET" }).handler(async () => {
  const { marketplaceSyncStatus } = await import("@/server/service");
  return marketplaceSyncStatus(await actor());
});

export const pullMarketplace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ channel: z.enum(["tiktok", "shopee"]) }).parse(data))
  .handler(async ({ data }) => {
    const { pullMarketplaceNow } = await import("@/server/marketplace-sync");
    return pullMarketplaceNow(await actor(), data.channel);
  });

export const previewRestore = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ key: z.string().min(8) }).parse(data))
  .handler(async ({ data }) => {
    const { restorePreview } = await import("@/server/service");
    return restorePreview(await actor(), data.key);
  });

export const createBackupNow = createServerFn({ method: "POST" }).handler(async () => {
  const { backupNow } = await import("@/server/service");
  return backupNow(await actor());
});

const channelFile = z.object({
  channel: z.enum(["tiktok", "shopee"]),
  filename: z.string().min(1),
  base64: z.string().min(8),
});

export const previewMarketplace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => channelFile.parse(data))
  .handler(async ({ data }) => {
    const { previewMarketplaceFile } = await import("@/server/service");
    return previewMarketplaceFile(await actor(), data);
  });

export const importMarketplace = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => channelFile.parse(data))
  .handler(async ({ data }) => {
    const { importMarketplaceFile } = await import("@/server/service");
    return importMarketplaceFile(await actor(), data);
  });

export const getSkuMaps = createServerFn({ method: "GET" }).handler(async () => {
  const { listSkuMaps } = await import("@/server/service");
  return listSkuMaps(await actor());
});

export const storeSkuMap = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ channel: z.enum(["tiktok", "shopee"]), externalSku: z.string().min(1), skuId: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { saveSkuMap } = await import("@/server/service");
    await saveSkuMap(await actor(), data);
    return { ok: true };
  });

export const deleteSkuMap = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z.object({ channel: z.enum(["tiktok", "shopee"]), externalSku: z.string().min(1) }).parse(data),
  )
  .handler(async ({ data }) => {
    const { removeSkuMap } = await import("@/server/service");
    await removeSkuMap(await actor(), data);
    return { ok: true };
  });

export const storeShipping = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        orderId: z.string(),
        carrier: z.string(),
        tracking: z.string(),
        shipFee: z.number().nullable(),
        codAmount: z.number().nullable(),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { saveOrderShipping } = await import("@/server/service");
    await saveOrderShipping(await actor(), data);
    return { ok: true };
  });

export const setCodReceived = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ orderId: z.string(), received: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { markCodReceived } = await import("@/server/service");
    await markCodReceived(await actor(), data.orderId, data.received);
    return { ok: true };
  });

export const getDeliveries = createServerFn({ method: "GET" }).handler(async () => {
  const { deliveryBoard } = await import("@/server/service");
  return deliveryBoard(await actor());
});

export const getCod = createServerFn({ method: "GET" })
  .inputValidator((data: unknown) => z.object({ month: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { codBoard } = await import("@/server/service");
    return codBoard(await actor(), data.month);
  });

export const getGroupPhotos = createServerFn({ method: "GET" }).handler(async () => {
  const { listGroupPhotos } = await import("@/server/service");
  return listGroupPhotos(await actor());
});

export const getWebProducts = createServerFn({ method: "GET" }).handler(async () => {
  const { listWebProducts } = await import("@/server/service");
  return listWebProducts(await actor());
});

export const createWebProduct = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) =>
    z
      .object({
        name: z.string().min(2).max(80),
        category: z.string().min(2).max(40),
        description: z.string().max(400),
        turnaround: z.string().max(80),
        sizes: z
          .array(
            z.object({
              widthCm: z.number().int().positive(),
              heightCm: z.number().int().positive(),
              sheets: z.number().int().positive(),
              price: z.number().int().positive(),
            }),
          )
          .min(1)
          .max(40),
      })
      .parse(data),
  )
  .handler(async ({ data }) => {
    const { createWebProduct: create } = await import("@/server/service");
    return create(await actor(), data);
  });

export const setWebProductListed = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ groupId: z.string().min(1), listed: z.boolean() }).parse(data))
  .handler(async ({ data }) => {
    const { setWebProductListed: setListed } = await import("@/server/service");
    await setListed(await actor(), data.groupId, data.listed);
    return { ok: true };
  });

export const clearGroupPhoto = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ slug: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { removeGroupPhoto } = await import("@/server/service");
    await removeGroupPhoto(await actor(), data.slug);
    return { ok: true };
  });

export const removeFile = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => z.object({ fileId: z.string() }).parse(data))
  .handler(async ({ data }) => {
    const { deleteStoredFile } = await import("@/server/service");
    await deleteStoredFile(await actor(), data.fileId);
    return { ok: true };
  });
