import { mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";

import {
  collectedRevenue,
  commissionOf,
  comboPriceError,
  depositBlocks,
  depositFor,
  formulaQty,
  isWeeklyOff,
  kpiTarget,
  minutesEarly,
  minutesLate,
  priceOf,
  quoteSku,
  statusRank,
  stockNeeds,
  vnParts,
  walkInListed,
} from "@/domain/calc";
import { workbookXml, type Sheet } from "@/domain/excel";
import { hashPassword, recalcBoms, verifyPassword } from "@/domain/seed";
import type {
  Channel,
  Order,
  OrderStatus,
  Role,
  ShopState,
  Sku,
  Staff,
} from "@/domain/types";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_REPLY } from "@/domain/types";
import { deleteFromDrive, downloadFromDrive, driveConfigured, uploadToDrive } from "@/server/drive";
import { mutate, readState } from "@/server/store";

export type Actor = Pick<Staff, "id" | "name" | "email" | "role" | "mustChangePassword">;

const MONEY_ROLES: Role[] = ["owner"];

function nowIso(): string {
  return new Date().toISOString();
}

function nid(): string {
  return crypto.randomUUID();
}

async function sha256(value: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.startsWith("84") && digits.length >= 10) return `0${digits.slice(2)}`;
  return digits;
}

export function prettyPhone(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (d.length === 10) return `${d.slice(0, 4)} ${d.slice(4, 7)} ${d.slice(7)}`;
  return d;
}

function audit(state: ShopState, actorId: string | null, action: string, entity: string, before: unknown, after: unknown) {
  state.audits.unshift({ id: nid(), at: nowIso(), actorId, action, entity, before, after });
  if (state.audits.length > 2000) state.audits.length = 2000;
}

function assertRole(actor: Actor, roles: Role[]) {
  if (!roles.includes(actor.role)) throw new Error("Không có quyền làm việc này.");
}

function staffOf(state: ShopState, id: string): Staff {
  const staff = state.staff.find((s) => s.id === id && s.active);
  if (!staff) throw new Error("Phiên đăng nhập không còn hiệu lực.");
  return staff;
}

export async function currentActor(staffId: string | null): Promise<Actor | null> {
  if (!staffId) return null;
  const state = await readState();
  const staff = state.staff.find((s) => s.id === staffId && s.active);
  if (!staff) return null;
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    mustChangePassword: staff.mustChangePassword,
  };
}

export async function login(email: string, password: string): Promise<Actor> {
  const state = await readState();
  const staff = state.staff.find((s) => s.email.toLowerCase() === email.trim().toLowerCase() && s.active);
  if (!staff || !(await verifyPassword(password, staff.passwordHash))) {
    throw new Error("Email hoặc mật khẩu không đúng.");
  }
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    mustChangePassword: staff.mustChangePassword,
  };
}

export async function changePassword(actor: Actor, current: string, next: string): Promise<void> {
  if (next.trim().length < 8) throw new Error("Mật khẩu mới cần ít nhất 8 ký tự.");
  await mutate(async (state) => {
    const staff = staffOf(state, actor.id);
    if (!(await verifyPassword(current, staff.passwordHash))) throw new Error("Mật khẩu hiện tại không đúng.");
    staff.passwordHash = await hashPassword(next.trim());
    staff.mustChangePassword = false;
    audit(state, actor.id, "staff.password", staff.id, null, { email: staff.email });
  });
}

function groupListed(state: ShopState, groupId: string): boolean {
  const group = state.groups.find((g) => g.id === groupId);
  if (!group) return false;
  if (group.gate === "anh_the" && !state.settings.showAnhThe) return false;
  if (group.gate === "album" && !state.settings.showAlbum) return false;
  return state.settings.groupListed[groupId] !== false;
}

export async function publicConfig() {
  const state = await readState();
  const phone = state.settings.zaloPhone || "0778662227";
  return {
    name: "NHÀ IN THIÊN THIÊN",
    phone: prettyPhone(phone),
    phoneRaw: phone.replace(/\D/g, ""),
    zalo: `https://zalo.me/${phone.replace(/\D/g, "")}`,
    hours: state.settings.publicHours,
    region: "Xuân Lộc, Đồng Nai",
  };
}

export async function publicCatalog() {
  const state = await readState();
  return state.groups
    .filter((g) => groupListed(state, g.id))
    .sort((a, b) => a.sort - b.sort)
    .map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      category: group.category,
      description: group.description,
      cover_path: null as string | null,
      turnaround_text: group.turnaround,
      sort_order: group.sort,
      variants: state.skus
        .filter((sku) => sku.groupId === group.id)
        .filter((sku) => walkInListed(priceOf(state.prices, sku.id, "tai_tiem")?.status))
        .sort((a, b) => a.sort - b.sort)
        .map((sku) => {
          const price = priceOf(state.prices, sku.id, "tai_tiem")?.price ?? null;
          return {
            id: sku.id,
            name: sku.name,
            width: sku.widthCm,
            height: sku.heightCm,
            unit: "cm",
            price,
            sale_price: null as number | null,
            requires_quote: price === null,
            recommended_width_px: sku.widthCm ? Math.round((sku.widthCm / 2.54) * 300) : null,
            recommended_height_px: sku.heightCm ? Math.round((sku.heightCm / 2.54) * 300) : null,
            sort_order: sku.sort,
          };
        }),
    }))
    .filter((group) => group.variants.length > 0);
}

function upsertCustomer(state: ShopState, input: { name: string; phone: string; address?: string }) {
  const phoneNormalized = normalizePhone(input.phone);
  if (phoneNormalized.length < 8) throw new Error("Số điện thoại chưa đúng.");
  let customer = state.customers.find((c) => c.phoneNormalized === phoneNormalized);
  if (!customer) {
    customer = {
      id: nid(),
      name: input.name.trim(),
      phone: input.phone.trim(),
      phoneNormalized,
      address: input.address?.trim() ?? "",
      note: "",
      createdAt: nowIso(),
    };
    state.customers.push(customer);
  } else {
    if (input.name.trim()) customer.name = input.name.trim();
    if (input.address?.trim()) customer.address = input.address.trim();
  }
  return customer;
}

function skuOrThrow(state: ShopState, skuId: string): Sku {
  const sku = state.skus.find((s) => s.id === skuId);
  if (!sku) throw new Error("Quy cách không có trong bảng giá.");
  return sku;
}

function buildItems(
  state: ShopState,
  channel: Channel,
  actorRole: Role | "web",
  items: { skuId: string; quantity: number; unitPrice?: number | null }[],
) {
  if (!items.length) throw new Error("Đơn chưa có sản phẩm.");
  return items.map((item) => {
    const sku = skuOrThrow(state, item.skuId);
    const group = state.groups.find((g) => g.id === sku.groupId);
    const listed = priceOf(state.prices, sku.id, channel);
    let unitPrice = listed?.price ?? null;
    if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== unitPrice) {
      if (actorRole !== "owner") throw new Error("Chỉ chủ tiệm sửa được giá bán.");
      unitPrice = item.unitPrice;
    }
    return {
      id: nid(),
      skuId: sku.id,
      name: `${group?.name ?? "Sản phẩm"} — ${sku.name}`,
      skuCode: sku.code,
      quantity: item.quantity,
      unitPrice,
      lineTotal: unitPrice === null ? null : unitPrice * item.quantity,
    };
  });
}

function sumItems(items: { lineTotal: number | null }[]): { subtotal: number | null; total: number | null } {
  if (items.some((item) => item.lineTotal === null)) return { subtotal: null, total: null };
  const subtotal = items.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0);
  return { subtotal, total: subtotal };
}

function refreshDeposit(state: ShopState, order: Order) {
  const items = order.items.map((item) => ({ size: state.skus.find((s) => s.id === item.skuId)?.size ?? null }));
  order.depositRequired = depositFor({
    channel: order.channel,
    total: order.total,
    items,
    settings: state.settings,
  });
}

function orderLines(state: ShopState, order: Order) {
  return order.items.map((item) => ({ sku: skuOrThrow(state, item.skuId), quantity: item.quantity }));
}

function applyStock(state: ShopState, order: Order, phase: "print" | "pack", by: string | null) {
  const { needs, missing } = stockNeeds(orderLines(state, order), state.boms, phase);
  const names: string[] = [];
  for (const id of missing) names.push(state.materials.find((m) => m.id === id)?.name ?? id);
  for (const need of needs) {
    if (need.materialId === "tem" && order.channel === "tai_tiem" && order.fulfillment === "pickup") continue;
    const material = state.materials.find((m) => m.id === need.materialId);
    if (!material) continue;
    material.stock = Math.round((material.stock - need.qty) * 10000) / 10000;
    state.movements.unshift({
      id: nid(),
      at: nowIso(),
      materialId: material.id,
      qty: -need.qty,
      reason: phase === "print" ? "Trừ kho khi vào bước in" : "Trừ kho khi đóng gói xong",
      orderId: order.id,
      by,
      note: order.code,
    });
  }
  if (names.length) {
    order.stockWarning = `Chưa trừ được: ${[...new Set(names)].join(", ")} (chưa có định mức).`;
  }
}

function nextCode(state: ShopState): string {
  const ymd = vnParts().ymd;
  const prefix = `TT${ymd.slice(2).replaceAll("-", "")}`;
  const seq = state.orders.filter((order) => order.code.startsWith(`${prefix}-`)).length + 1;
  return `${prefix}-${String(seq).padStart(3, "0")}`;
}

export async function createWebOrder(input: {
  fullName: string;
  phone: string;
  note: string;
  fulfillment: "pickup" | "delivery";
  address: string;
  idempotencyKey: string;
  items: { skuId: string; quantity: number }[];
}) {
  return mutate(async (state) => {
    const existing = state.orders.find((order) => order.idempotencyKey === input.idempotencyKey);
    if (existing) return { orderId: existing.id, code: existing.code, accessToken: existing.accessToken };
    const customer = upsertCustomer(state, {
      name: input.fullName,
      phone: input.phone,
      address: input.fulfillment === "delivery" ? input.address : "",
    });
    const items = buildItems(
      state,
      "tai_tiem",
      "web",
      input.items.map((item) => ({ skuId: item.skuId, quantity: item.quantity })),
    );
    const totals = sumItems(items);
    const accessToken = crypto.randomUUID().replaceAll("-", "");
    const order: Order = {
      id: nid(),
      code: nextCode(state),
      channel: "tai_tiem",
      source: "web",
      customerId: customer.id,
      status: "draft_upload",
      fulfillment: input.fulfillment,
      address: input.fulfillment === "delivery" ? input.address.trim() : "",
      customerNote: input.note.trim(),
      internalNote: "",
      dueDate: null,
      marketplaceCode: "",
      items,
      subtotal: totals.subtotal,
      total: totals.total,
      depositRequired: 0,
      depositPaid: 0,
      depositMethod: "",
      depositBy: null,
      printDeducted: false,
      packDeducted: false,
      stockWarning: "",
      accessTokenHash: await sha256(accessToken),
      accessToken,
      idempotencyKey: input.idempotencyKey,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      files: [],
      history: [],
    };
    refreshDeposit(state, order);
    state.orders.unshift(order);
    return { orderId: order.id, code: order.code, accessToken };
  });
}

async function orderByToken(state: ShopState, orderId: string, accessToken: string) {
  const order = state.orders.find((item) => item.id === orderId);
  if (!order || order.accessTokenHash !== (await sha256(accessToken))) throw new Error("Không có quyền với đơn hàng này.");
  return order;
}

function storageMode(): "drive" | "supabase" | "local" {
  if (driveConfigured()) return "drive";
  if (process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) return "supabase";
  return "local";
}

export async function createUploadTicket(input: {
  orderId: string;
  accessToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  const allowed = ["image/jpeg", "image/jpg", "image/png", "image/webp", "image/heic", "image/heif"];
  if (!allowed.includes(input.mimeType.toLowerCase())) throw new Error("Định dạng ảnh không được hỗ trợ.");
  const mode = storageMode();
  const fileId = nid();
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "anh.jpg";
  const storagePath = `orders/${input.orderId}/originals/${fileId}-${safe}`;
  let token = "";
  if (mode === "supabase") {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const signed = await supabase.storage.from("order-originals").createSignedUploadUrl(storagePath);
    if (signed.error || !signed.data) throw new Error(signed.error?.message ?? "Không tạo được đường dẫn tải lên.");
    token = signed.data.token;
  }
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    order.files.push({
      id: fileId,
      name: input.fileName,
      mime: input.mimeType,
      size: input.sizeBytes,
      status: "uploading",
      kind: "original",
      storage: mode === "supabase" ? "supabase" : mode === "drive" ? "drive" : "local",
      path: storagePath,
      driveFileId: null,
      createdAt: nowIso(),
      deletedAt: null,
    });
  });
  return { fileId, path: storagePath, token, mode };
}

export async function saveDirectUpload(input: {
  orderId: string;
  accessToken: string;
  fileId: string;
  bytes: Uint8Array;
  mime: string;
}) {
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    const file = order.files.find((item) => item.id === input.fileId);
    if (!file) throw new Error("Không thấy file của đơn.");
    if (driveConfigured()) {
      file.driveFileId = await uploadToDrive(file.name, input.mime || file.mime, input.bytes);
      file.storage = "drive";
      file.path = file.driveFileId;
    } else {
      const relative = path.join("data", "uploads", order.id, file.id);
      const absolute = path.join(process.cwd(), relative);
      await mkdir(path.dirname(absolute), { recursive: true });
      await writeFile(absolute, input.bytes);
      file.storage = "local";
      file.path = relative;
    }
    file.status = "complete";
    file.size = input.bytes.byteLength;
  });
}

export async function markFileStatus(input: {
  orderId: string;
  accessToken: string;
  fileId: string;
  status: "complete" | "error";
  widthPx?: number;
  heightPx?: number;
}) {
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    const file = order.files.find((item) => item.id === input.fileId);
    if (!file) throw new Error("Không thấy file của đơn.");
    if (file.status !== "complete") file.status = input.status;
    void input.widthPx;
    void input.heightPx;
  });
  return { ok: true };
}

export async function submitWebOrder(input: { orderId: string; accessToken: string }) {
  return mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    if (!order.files.length) throw new Error("Đơn chưa có ảnh nào được tải lên.");
    const allDone = order.files.every((file) => file.status === "complete");
    const next = allDone ? "nhan_don" : "upload_error";
    const from = order.status;
    order.status = next;
    order.updatedAt = nowIso();
    order.history.push({
      at: nowIso(),
      from,
      to: next,
      by: null,
      note: allDone ? "Khách gửi ảnh thành công" : "Còn file lỗi khi tải lên",
    });
    return { status: next, allDone };
  });
}

export async function lookupOrder(code: string, phone: string) {
  const state = await readState();
  const phoneNormalized = normalizePhone(phone);
  const order = state.orders.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
  const customer = order ? state.customers.find((item) => item.id === order.customerId) : undefined;
  if (!order || !customer || customer.phoneNormalized !== phoneNormalized) {
    throw new Error("Không tìm thấy đơn hàng khớp mã đơn và số điện thoại.");
  }
  return {
    code: order.code,
    status: order.status,
    createdAt: order.createdAt,
    total: order.total,
    fulfillment: order.fulfillment,
    address: order.address || null,
    note: order.customerNote || null,
    customerName: customer.name,
    items: order.items.map((item) => ({
      name: item.name,
      variant: item.skuCode,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    })),
    fileCount: order.files.filter((file) => !file.deletedAt).length,
    history: order.history.map((item) => ({ to: item.to, at: item.at, note: item.note })),
  };
}

function customerName(state: ShopState, id: string): { name: string; phone: string } {
  const customer = state.customers.find((item) => item.id === id);
  return { name: customer?.name ?? "", phone: customer?.phone ?? "" };
}

function isLate(state: ShopState, order: Order, clock = vnParts()): boolean {
  if (!["facebook", "tiktok", "shopee"].includes(order.channel)) return false;
  if (["giao", "xong", "huy", "draft_upload", "upload_error"].includes(order.status)) return false;
  const created = vnParts(new Date(order.createdAt));
  if (created.ymd < clock.ymd) return true;
  return created.hm <= state.settings.marketplaceCutoff && clock.hm > state.settings.marketplaceHandover;
}

function orderSummary(state: ShopState, order: Order, role: Role) {
  const customer = customerName(state, order.customerId);
  const showMoney = role !== "production";
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status],
    createdAt: order.createdAt,
    channel: order.channel,
    channelLabel: CHANNEL_LABEL[order.channel],
    source: order.source,
    customerName: customer.name,
    phone: customer.phone,
    address: order.address,
    itemSummary: order.items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
    total: showMoney ? order.total : null,
    late: isLate(state, order),
    fileCount: order.files.filter((file) => !file.deletedAt && file.status === "complete").length,
    fulfillment: order.fulfillment,
  };
}

export async function dashboard(actor: Actor) {
  const state = await readState();
  const clock = vnParts();
  const visible = state.orders.filter((order) => !["draft_upload"].includes(order.status));
  const byStatus = (["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"] as OrderStatus[]).map(
    (status) => ({ status, label: STATUS_LABEL[status], count: visible.filter((order) => order.status === status).length }),
  );
  const late = visible.filter((order) => isLate(state, order, clock)).map((order) => orderSummary(state, order, actor.role));
  const lowStock = state.materials
    .filter((material) => material.minStock !== null && material.stock <= material.minStock)
    .map((material) => ({ id: material.id, name: material.name, stock: material.stock, unit: material.unit, min: material.minStock }));
  const onShift = state.staff
    .filter((person) =>
      state.punches.some((punch) => punch.staffId === person.id && !punch.outAt && punch.inAt.slice(0, 10) === clock.ymd),
    )
    .map((person) => ({ id: person.id, name: person.name, role: person.role }));
  const mineOpen = state.punches.find((punch) => punch.staffId === actor.id && !punch.outAt) ?? null;
  if (actor.role === "production") {
    return {
      role: actor.role,
      name: actor.name,
      byStatus: byStatus.filter((row) => ["thiet_ke", "cho_duyet", "in", "dong_goi", "giao"].includes(row.status)),
      queue: visible
        .filter((order) => ["thiet_ke", "cho_duyet", "in", "dong_goi"].includes(order.status))
        .map((order) => orderSummary(state, order, actor.role)),
      late,
      lowStock,
      onShift: onShift.filter((person) => person.id === actor.id),
      clockedIn: Boolean(mineOpen),
    };
  }
  if (actor.role === "sale") {
    const revenue = collectedRevenue(state.orders, clock.month);
    const target = kpiTarget(state.settings.shopOpenDate, clock.month, state.settings.kpiTargets);
    return {
      role: actor.role,
      name: actor.name,
      byStatus,
      late,
      lowStock,
      onShift,
      clockedIn: Boolean(mineOpen),
      orders: visible.slice(0, 12).map((order) => orderSummary(state, order, actor.role)),
      kpiPercent: target > 0 ? Math.round((revenue / target) * 1000) / 10 : null,
      commission: commissionOf(revenue, state.settings.commissionTiers),
      kpiMonthLabel: `Mốc hòa vốn tháng ${clock.month} không hiện doanh thu.`,
    };
  }
  const doneMonth = state.orders.filter((order) => order.status === "xong" && (order.completedAt ?? "").slice(0, 7) === clock.month);
  const revenueMonth = doneMonth.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const revenueToday = doneMonth
    .filter((order) => (order.completedAt ?? "").slice(0, 10) === clock.ymd)
    .reduce((sum, order) => sum + (order.total ?? 0), 0);
  let gross = 0;
  let grossIncomplete = false;
  for (const order of doneMonth) {
    for (const item of order.items) {
      const sku = state.skus.find((row) => row.id === item.skuId);
      if (!sku || item.unitPrice === null) {
        grossIncomplete = true;
        continue;
      }
      const quote = quoteSku({
        sku,
        price: item.unitPrice * item.quantity,
        channel: order.channel,
        settings: state.settings,
        boms: state.boms.map((bom) => ({ ...bom, qty: bom.scope === "sheet" ? bom.qty : bom.qty })),
        materials: state.materials,
        affiliate: false,
      });
      if (quote.profit === null) grossIncomplete = true;
      else gross += quote.profit;
    }
  }
  const fixed = fixedTotal(state, clock.month);
  return {
    role: actor.role,
    name: actor.name,
    byStatus,
    late,
    lowStock,
    onShift,
    clockedIn: Boolean(mineOpen),
    revenueToday,
    revenueMonth,
    breakevenPercent: state.settings.breakevenMonth
      ? Math.round((revenueMonth / state.settings.breakevenMonth) * 1000) / 10
      : null,
    todayGap: Math.max(0, state.settings.breakevenDay - revenueToday),
    gross: Math.round(gross),
    grossIncomplete,
    fixed,
    profit: grossIncomplete ? null : Math.round(gross - fixed - extraTotal(state, clock.month)),
    orders: visible.slice(0, 12).map((order) => orderSummary(state, order, actor.role)),
  };
}

function fixedAmount(state: ShopState, month: string, key: string, fallback: number): number {
  return state.monthlyFixed.find((row) => row.month === month && row.key === key)?.amount ?? fallback;
}

function fixedRows(state: ShopState, month: string) {
  return state.settings.fixedCosts.map((row) => ({
    ...row,
    amount: fixedAmount(state, month, row.key, row.amount),
  }));
}

function fixedTotal(state: ShopState, month: string): number {
  return fixedRows(state, month).reduce((sum, row) => sum + row.amount, 0);
}

function extraTotal(state: ShopState, month: string): number {
  return state.expenses.filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0);
}

export async function listOrders(actor: Actor) {
  const state = await readState();
  return {
    orders: state.orders
      .filter((order) => order.status !== "draft_upload")
      .map((order) => orderSummary(state, order, actor.role)),
  };
}

export async function getOrder(actor: Actor, code: string) {
  const state = await readState();
  const order = state.orders.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!order) throw new Error("Không tìm thấy đơn hàng.");
  const customer = state.customers.find((item) => item.id === order.customerId);
  const showMoney = actor.role !== "production";
  const quote =
    actor.role === "owner"
      ? order.items.map((item) => {
          const sku = state.skus.find((row) => row.id === item.skuId);
          if (!sku) return null;
          const priced = sku.sheets > 0 ? { ...sku, sheets: sku.sheets * item.quantity } : sku;
          return quoteSku({
            sku: priced,
            price: item.lineTotal,
            channel: order.channel,
            settings: state.settings,
            boms: state.boms,
            materials: state.materials,
            affiliate: false,
          });
        })
      : null;
  return {
    ...orderSummary(state, order, actor.role),
    customerNote: order.customerNote,
    internalNote: actor.role === "production" ? "" : order.internalNote,
    dueDate: order.dueDate,
    marketplaceCode: order.marketplaceCode,
    depositRequired: showMoney ? order.depositRequired : null,
    depositPaid: showMoney ? order.depositPaid : null,
    depositMethod: showMoney ? order.depositMethod : "",
    items: order.items.map((item) => ({
      ...item,
      unitPrice: showMoney ? item.unitPrice : null,
      lineTotal: showMoney ? item.lineTotal : null,
    })),
    subtotal: showMoney ? order.subtotal : null,
    reply: STATUS_REPLY[order.status],
    history: order.history.map((item) => ({
      ...item,
      byName: state.staff.find((person) => person.id === item.by)?.name ?? "Khách / hệ thống",
      toLabel: STATUS_LABEL[item.to],
    })),
    files: order.files.filter((file) => !file.deletedAt),
    reprints: state.reprints.filter((item) => item.orderId === order.id),
    stockWarning: order.stockWarning,
    quote,
    customerId: customer?.id ?? order.customerId,
    printDeducted: order.printDeducted,
    packDeducted: order.packDeducted,
  };
}

export async function createManualOrder(
  actor: Actor,
  input: {
    channel: Channel;
    fullName: string;
    phone: string;
    address: string;
    fulfillment: "pickup" | "delivery";
    note: string;
    dueDate: string | null;
    marketplaceCode: string;
    items: { skuId: string; quantity: number; unitPrice?: number | null }[];
  },
) {
  assertRole(actor, ["owner", "sale"]);
  return mutate(async (state) => {
    const customer = upsertCustomer(state, { name: input.fullName, phone: input.phone, address: input.address });
    const items = buildItems(state, input.channel, actor.role, input.items);
    const totals = sumItems(items);
    const order: Order = {
      id: nid(),
      code: nextCode(state),
      channel: input.channel,
      source: "manual",
      customerId: customer.id,
      status: "nhan_don",
      fulfillment: input.fulfillment,
      address: input.address.trim(),
      customerNote: input.note.trim(),
      internalNote: "",
      dueDate: input.dueDate,
      marketplaceCode: input.marketplaceCode.trim(),
      items,
      subtotal: totals.subtotal,
      total: totals.total,
      depositRequired: 0,
      depositPaid: 0,
      depositMethod: "",
      depositBy: null,
      printDeducted: false,
      packDeducted: false,
      stockWarning: "",
      accessTokenHash: "",
      accessToken: "",
      idempotencyKey: null,
      createdAt: nowIso(),
      updatedAt: nowIso(),
      completedAt: null,
      files: [],
      history: [{ at: nowIso(), from: null, to: "nhan_don", by: actor.id, note: "Tạo đơn tại quầy" }],
    };
    refreshDeposit(state, order);
    state.orders.unshift(order);
    audit(state, actor.id, "order.create", order.id, null, { code: order.code, channel: order.channel });
    return { code: order.code };
  });
}

const PRODUCTION_STATUS: OrderStatus[] = ["in", "dong_goi", "giao"];

export async function setOrderStatus(
  actor: Actor,
  input: { orderId: string; status: OrderStatus; note: string; ownerOverride?: boolean },
) {
  if (actor.role === "production" && !PRODUCTION_STATUS.includes(input.status)) {
    throw new Error("Sản xuất chỉ chuyển các bước in, đóng gói và giao.");
  }
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    if (
      depositBlocks(input.status, order.depositRequired, order.depositPaid) &&
      !(actor.role === "owner" && input.ownerOverride)
    ) {
      throw new Error("Đơn Facebook chưa ghi đủ cọc. Chưa chuyển sang thiết kế hoặc in.");
    }
    const from = order.status;
    if (input.status !== "huy" && statusRank(input.status) >= statusRank("in") && !order.printDeducted && statusRank(from) < statusRank("in")) {
      applyStock(state, order, "print", actor.id);
      order.printDeducted = true;
    }
    if (input.status !== "huy" && statusRank(input.status) >= statusRank("giao") && !order.packDeducted && statusRank(from) < statusRank("giao")) {
      applyStock(state, order, "pack", actor.id);
      order.packDeducted = true;
    }
    order.status = input.status;
    order.updatedAt = nowIso();
    if (input.status === "xong") order.completedAt = nowIso();
    order.history.push({ at: nowIso(), from, to: input.status, by: actor.id, note: input.note.trim() });
    audit(state, actor.id, "order.status", order.id, { status: from }, { status: input.status });
  });
}

export async function addDeposit(actor: Actor, input: { orderId: string; amount: number; method: string }) {
  assertRole(actor, ["owner", "sale"]);
  if (!Number.isFinite(input.amount) || input.amount <= 0) throw new Error("Số tiền cọc chưa đúng.");
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const before = order.depositPaid;
    order.depositPaid = Math.round(order.depositPaid + input.amount);
    order.depositMethod = input.method.trim();
    order.depositBy = actor.id;
    audit(state, actor.id, "order.deposit", order.id, { depositPaid: before }, { depositPaid: order.depositPaid, method: input.method });
  });
}

export async function saveInternalNote(actor: Actor, orderId: string, note: string) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    order.internalNote = note;
  });
}

export async function addReprint(
  actor: Actor,
  input: {
    orderId: string;
    reason: string;
    decision: "reprint" | "reject" | null;
    extraCost: number | null;
    uses: { materialId: string; qty: number }[];
  },
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const delivered = order.history.find((item) => item.to === "giao" || item.to === "xong")?.at ?? order.completedAt;
    const overdue = delivered ? Date.now() - new Date(delivered).getTime() > 3 * 24 * 60 * 60 * 1000 : false;
    if (input.decision === "reprint") {
      for (const use of input.uses) {
        const material = state.materials.find((item) => item.id === use.materialId);
        if (!material || !(use.qty > 0)) continue;
        material.stock = Math.round((material.stock - use.qty) * 10000) / 10000;
        state.movements.unshift({
          id: nid(),
          at: nowIso(),
          materialId: material.id,
          qty: -use.qty,
          reason: "In lại",
          orderId: order.id,
          by: actor.id,
          note: order.code,
        });
      }
    }
    state.reprints.unshift({
      id: nid(),
      orderId: order.id,
      reportedAt: nowIso(),
      reason: input.reason.trim(),
      decision: input.decision,
      extraCost: input.extraCost,
      materialNote: "",
      overdue,
      by: actor.id,
      uses: input.uses,
    });
  });
}

export async function priceBoard(actor: Actor, groupId?: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const skus = state.skus.filter((sku) => !groupId || sku.groupId === groupId);
  return {
    groups: state.groups.map((group) => ({ id: group.id, name: group.name })),
    rows: skus.map((sku) => ({
      skuId: sku.id,
      code: sku.code,
      name: sku.name,
      groupId: sku.groupId,
      size: sku.size,
      sheets: sku.sheets,
      piecesPerPack: sku.piecesPerPack,
      prices: Object.fromEntries(
        (["tai_tiem", "facebook", "tiktok", "shopee"] as Channel[]).map((channel) => {
          const row = priceOf(state.prices, sku.id, channel);
          return [channel, { price: row?.price ?? null, status: row?.status ?? "nhap", note: row?.note ?? "" }];
        }),
      ),
    })),
  };
}

export async function updateChannelPrice(
  actor: Actor,
  input: { skuId: string; channel: Channel; price: number | null; status: "dang_ban" | "nhap" | "cho_duyet"; note: string },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const sku = skuOrThrow(state, input.skuId);
    const siblings = state.skus.filter((item) => item.groupId === sku.groupId && item.size === sku.size && !item.code.endsWith("-GOI"));
    const error = comboPriceError(
      siblings.map((item) => ({
        sheets: item.sheets,
        price: item.id === sku.id ? input.price : (priceOf(state.prices, item.id, input.channel)?.price ?? null),
      })),
    );
    if (error) throw new Error(error);
    const row = state.prices.find((item) => item.skuId === sku.id && item.channel === input.channel);
    const before = row ? { ...row } : null;
    if (!row) {
      state.prices.push({ skuId: sku.id, channel: input.channel, price: input.price, status: input.status, note: input.note });
    } else {
      row.price = input.price;
      row.status = input.status;
      row.note = input.note;
    }
    audit(state, actor.id, "price.update", `${sku.code}:${input.channel}`, before, input);
  });
}

export async function setPiecesPerPack(actor: Actor, skuId: string, pieces: number | null) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const sku = skuOrThrow(state, skuId);
    sku.piecesPerPack = pieces;
    for (const bom of state.boms.filter((item) => item.skuId === sku.id && item.formula !== "manual")) {
      bom.qty = formulaQty(bom.formula, sku, state.settings);
    }
    audit(state, actor.id, "sku.pieces", sku.id, null, { pieces });
  });
}

export async function quote(actor: Actor, input: { skuId: string; channel: Channel; price: number | null; affiliate: boolean }) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const sku = skuOrThrow(state, input.skuId);
  const price = input.price ?? priceOf(state.prices, sku.id, input.channel)?.price ?? null;
  return quoteSku({
    sku,
    price,
    channel: input.channel,
    settings: state.settings,
    boms: state.boms,
    materials: state.materials,
    affiliate: input.affiliate,
  });
}

export async function inventory(actor: Actor) {
  const state = await readState();
  const showCost = MONEY_ROLES.includes(actor.role);
  return {
    materials: state.materials.map((material) => ({
      id: material.id,
      name: material.name,
      buyLabel: material.buyLabel,
      unit: material.unit,
      stock: material.stock,
      minStock: material.minStock,
      supplier: material.supplier,
      packSize: showCost ? material.packSize : null,
      packPrice: showCost ? material.packPrice : null,
      pendingPrice: showCost ? material.pendingPrice : null,
      low: material.minStock !== null && material.stock <= material.minStock,
    })),
    movements: state.movements.slice(0, 80).map((move) => ({
      ...move,
      materialName: state.materials.find((item) => item.id === move.materialId)?.name ?? move.materialId,
      byName: state.staff.find((item) => item.id === move.by)?.name ?? "",
    })),
    counts: state.counts.slice(0, 40),
  };
}

export async function stockIn(
  actor: Actor,
  input: { materialId: string; packs: number; packPrice: number | null; supplier: string; note: string },
) {
  assertRole(actor, ["owner", "sale"]);
  if (!(input.packs > 0)) throw new Error("Số lượng nhập phải lớn hơn 0.");
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === input.materialId);
    if (!material) throw new Error("Không thấy vật tư.");
    const qty = material.packSize ? input.packs * material.packSize : input.packs;
    material.stock = Math.round((material.stock + qty) * 10000) / 10000;
    if (input.supplier.trim()) material.supplier = input.supplier.trim();
    if (input.packPrice !== null) {
      if (actor.role === "owner") material.packPrice = input.packPrice;
      else material.pendingPrice = input.packPrice;
    }
    state.movements.unshift({
      id: nid(),
      at: nowIso(),
      materialId: material.id,
      qty,
      reason: "Nhập hàng",
      orderId: null,
      by: actor.id,
      note: input.note.trim(),
    });
    audit(state, actor.id, "stock.in", material.id, null, { qty, packPrice: input.packPrice });
  });
}

export async function approveMaterialPrice(actor: Actor, materialId: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === materialId);
    if (!material || material.pendingPrice === null) throw new Error("Không có giá chờ duyệt.");
    const before = material.packPrice;
    material.packPrice = material.pendingPrice;
    material.pendingPrice = null;
    audit(state, actor.id, "material.price", material.id, { packPrice: before }, { packPrice: material.packPrice });
  });
}

export async function updateMaterial(actor: Actor, input: { materialId: string; packPrice: number | null; packSize: number | null; minStock: number | null; supplier: string }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === input.materialId);
    if (!material) throw new Error("Không thấy vật tư.");
    const before = { packPrice: material.packPrice, packSize: material.packSize, minStock: material.minStock };
    material.packPrice = input.packPrice;
    material.packSize = input.packSize;
    material.minStock = input.minStock;
    material.supplier = input.supplier;
    audit(state, actor.id, "material.update", material.id, before, input);
  });
}

export async function updateBom(actor: Actor, input: { bomId: string; qty: number | null }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const bom = state.boms.find((item) => item.id === input.bomId);
    if (!bom) throw new Error("Không thấy định mức.");
    const before = bom.qty;
    bom.qty = input.qty;
    bom.formula = "manual";
    audit(state, actor.id, "bom.update", bom.id, { qty: before }, { qty: input.qty });
  });
}

export async function recount(actor: Actor, input: { materialId: string; actual: number; note: string }) {
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === input.materialId);
    if (!material) throw new Error("Không thấy vật tư.");
    const systemQty = material.stock;
    const delta = input.actual - systemQty;
    material.stock = input.actual;
    state.counts.unshift({ id: nid(), at: nowIso(), materialId: material.id, systemQty, actualQty: input.actual, by: actor.id, note: input.note.trim() });
    state.movements.unshift({
      id: nid(),
      at: nowIso(),
      materialId: material.id,
      qty: delta,
      reason: "Kiểm kho",
      orderId: null,
      by: actor.id,
      note: input.note.trim(),
    });
  });
}

export async function openInk(actor: Actor) {
  await mutate(async (state) => {
    const ink = state.materials.find((item) => item.id === "muc");
    if (!ink) throw new Error("Không thấy mực.");
    ink.stock -= 1;
    state.movements.unshift({
      id: nid(),
      at: nowIso(),
      materialId: ink.id,
      qty: -1,
      reason: "Mở lọ mới",
      orderId: null,
      by: actor.id,
      note: "",
    });
  });
}

export async function bomOf(actor: Actor, skuId: string) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return state.boms
    .filter((bom) => bom.skuId === skuId)
    .map((bom) => ({
      ...bom,
      materialName: state.materials.find((item) => item.id === bom.materialId)?.name ?? bom.materialId,
      unit: state.materials.find((item) => item.id === bom.materialId)?.unit ?? "",
    }));
}

export async function customerList(actor: Actor, q: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const query = q.trim().toLowerCase();
  return state.customers
    .filter((customer) => {
      if (!query) return true;
      return customer.name.toLowerCase().includes(query) || customer.phoneNormalized.includes(query.replace(/\D/g, ""));
    })
    .map((customer) => ({
      id: customer.id,
      name: customer.name,
      phone: customer.phone,
      address: customer.address,
      orders: state.orders.filter((order) => order.customerId === customer.id && order.status !== "draft_upload").length,
    }));
}

export async function customerDetail(actor: Actor, id: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const customer = state.customers.find((item) => item.id === id);
  if (!customer) throw new Error("Không thấy khách.");
  return {
    ...customer,
    orders: state.orders
      .filter((order) => order.customerId === id && order.status !== "draft_upload")
      .map((order) => orderSummary(state, order, actor.role)),
  };
}

export async function saveCustomerNote(actor: Actor, id: string, note: string) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const customer = state.customers.find((item) => item.id === id);
    if (!customer) throw new Error("Không thấy khách.");
    customer.note = note;
  });
}

function ymdList(month: string): string[] {
  const [year, mon] = month.split("-").map(Number);
  const count = new Date(Date.UTC(year!, mon!, 0)).getUTCDate();
  return Array.from({ length: count }, (_, index) => `${month}-${String(index + 1).padStart(2, "0")}`);
}

export async function clock(actor: Actor, action: "in" | "out") {
  await mutate(async (state) => {
    const open = state.punches.find((punch) => punch.staffId === actor.id && !punch.outAt);
    const clockNow = vnParts();
    if (action === "in") {
      if (open) throw new Error("Bạn đang trong ca. Hãy bấm ra ca trước.");
      state.punches.unshift({
        id: nid(),
        staffId: actor.id,
        inAt: nowIso(),
        outAt: null,
        lateMinutes: minutesLate(clockNow.hm, state.settings.workStart, state.settings.lateGraceMinutes),
        earlyMinutes: 0,
        note: "",
        editedBy: null,
      });
      return;
    }
    if (!open) throw new Error("Bạn chưa bấm vào ca.");
    open.outAt = nowIso();
    open.earlyMinutes = minutesEarly(clockNow.hm, state.settings.workEnd);
  });
}

export async function attendance(actor: Actor, month: string) {
  const state = await readState();
  const people = actor.role === "owner" ? state.staff.filter((person) => person.role !== "owner") : state.staff.filter((person) => person.id === actor.id);
  return {
    month,
    workStart: state.settings.workStart,
    workEnd: state.settings.workEnd,
    weeklyOff: state.settings.weeklyOff,
    people: people.map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      punches: state.punches.filter((punch) => punch.staffId === person.id && punch.inAt.slice(0, 7) === month),
    })),
    leaves: state.leaves.filter((leave) => leave.date.startsWith(month) && (actor.role === "owner" || leave.staffId === actor.id)),
  };
}

export async function editPunch(actor: Actor, input: { punchId: string; inAt: string; outAt: string | null; note: string }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const punch = state.punches.find((item) => item.id === input.punchId);
    if (!punch) throw new Error("Không thấy lần chấm.");
    const before = { inAt: punch.inAt, outAt: punch.outAt };
    punch.inAt = input.inAt;
    punch.outAt = input.outAt;
    punch.note = input.note;
    punch.editedBy = actor.id;
    const start = vnParts(new Date(input.inAt));
    punch.lateMinutes = minutesLate(start.hm, state.settings.workStart, state.settings.lateGraceMinutes);
    punch.earlyMinutes = input.outAt ? minutesEarly(vnParts(new Date(input.outAt)).hm, state.settings.workEnd) : 0;
    audit(state, actor.id, "punch.edit", punch.id, before, { inAt: punch.inAt, outAt: punch.outAt });
  });
}

export async function addLeave(actor: Actor, input: { staffId: string; date: string; note: string }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    state.leaves.push({ id: nid(), staffId: input.staffId, date: input.date, paid: true, note: input.note.trim() });
  });
}

function payrollRow(state: ShopState, person: Staff, month: string) {
  const settings = state.settings;
  const today = vnParts().ymd;
  const base =
    person.role === "production"
      ? settings.productionBase
      : person.probation
        ? Math.round((settings.saleBase * settings.saleProbationPercent) / 100)
        : settings.saleBase;
  const punches = state.punches.filter((punch) => punch.staffId === person.id && punch.inAt.slice(0, 7) === month);
  const lateMinutes = punches.reduce((sum, punch) => sum + punch.lateMinutes, 0);
  const days = ymdList(month).filter((day) => day <= today && day >= settings.shopOpenDate);
  const absentDays = days.filter((day) => {
    if (isWeeklyOff(day, settings.weeklyOff)) return false;
    if (person.hiredAt && day < person.hiredAt) return false;
    if (state.leaves.some((leave) => leave.staffId === person.id && leave.date === day)) return false;
    return !punches.some((punch) => punch.inAt.slice(0, 10) === day);
  }).length;
  const revenue = person.role === "sale" ? collectedRevenue(state.orders, month) : 0;
  const commission = person.role === "sale" ? commissionOf(revenue, settings.commissionTiers) : 0;
  const target = kpiTarget(settings.shopOpenDate, month, settings.kpiTargets);
  let deduction: number | null = 0;
  if (lateMinutes > 0) {
    if (settings.lateDeductionPerMinute === null) deduction = null;
    else deduction = (deduction ?? 0) + lateMinutes * settings.lateDeductionPerMinute;
  }
  if (absentDays > 0) {
    if (settings.absenceDeductionPerDay === null) deduction = null;
    else deduction = (deduction ?? 0) + absentDays * settings.absenceDeductionPerDay;
  }
  const net = deduction === null ? null : base + commission - deduction;
  return {
    staffId: person.id,
    name: person.name,
    role: person.role,
    base,
    commission,
    kpiBonus: 0,
    deduction,
    net,
    lateMinutes,
    absentDays,
    kpiPercent: person.role === "sale" && target > 0 ? Math.round((revenue / target) * 1000) / 10 : null,
    revenue,
  };
}

export async function payroll(actor: Actor, month: string) {
  const state = await readState();
  const locked = state.payrollLocks.some((item) => item.month === month);
  if (actor.role === "owner") {
    const rows = state.staff.filter((person) => person.role !== "owner").map((person) => payrollRow(state, person, month));
    return { month, locked, rows };
  }
  if (actor.role !== "sale") throw new Error("Không có quyền xem lương.");
  const person = state.staff.find((item) => item.id === actor.id);
  if (!person) throw new Error("Không thấy nhân viên.");
  const row = payrollRow(state, person, month);
  return {
    month,
    locked,
    rows: [
      {
        staffId: row.staffId,
        name: row.name,
        role: row.role,
        base: row.base,
        commission: row.commission,
        kpiBonus: row.kpiBonus,
        deduction: row.deduction,
        net: row.net,
        lateMinutes: row.lateMinutes,
        absentDays: row.absentDays,
        kpiPercent: row.kpiPercent,
      },
    ],
  };
}

export async function lockPayroll(actor: Actor, month: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    if (!state.payrollLocks.some((item) => item.month === month)) {
      state.payrollLocks.push({ month, at: nowIso(), by: actor.id });
    }
  });
}

export async function profitReport(actor: Actor, month: string) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const orders = state.orders.filter((order) => order.status === "xong" && (order.completedAt ?? "").startsWith(month));
  const revenue = orders.reduce((sum, order) => sum + (order.total ?? 0), 0);
  let gross = 0;
  let incomplete = false;
  let shippingUnknown = false;
  const byChannel = new Map<string, { revenue: number; orders: number }>();
  const byProduct = new Map<string, { qty: number; revenue: number }>();
  for (const order of orders) {
    const bucket = byChannel.get(order.channel) ?? { revenue: 0, orders: 0 };
    bucket.revenue += order.total ?? 0;
    bucket.orders += 1;
    byChannel.set(order.channel, bucket);
    for (const item of order.items) {
      const sku = state.skus.find((row) => row.id === item.skuId);
      const key = item.name;
      const product = byProduct.get(key) ?? { qty: 0, revenue: 0 };
      product.qty += item.quantity * (sku?.sheets ?? 1);
      product.revenue += item.lineTotal ?? 0;
      byProduct.set(key, product);
      if (!sku || item.lineTotal === null) {
        incomplete = true;
        continue;
      }
      const quote = quoteSku({
        sku: { ...sku, sheets: sku.sheets * item.quantity },
        price: item.lineTotal,
        channel: order.channel,
        settings: state.settings,
        boms: state.boms,
        materials: state.materials,
        affiliate: false,
      });
      if (quote.shippingUnknown) shippingUnknown = true;
      if (quote.profit === null) incomplete = true;
      else gross += quote.profit;
    }
  }
  const fixed = fixedRows(state, month);
  const extras = state.expenses.filter((row) => row.month === month);
  const fixedSum = fixed.reduce((sum, row) => sum + row.amount, 0);
  const extraSum = extras.reduce((sum, row) => sum + row.amount, 0);
  const reprints = state.reprints.filter((row) => row.reportedAt.startsWith(month));
  const today = vnParts();
  const todayRevenue = orders
    .filter((order) => (order.completedAt ?? "").slice(0, 10) === today.ymd)
    .reduce((sum, order) => sum + (order.total ?? 0), 0);
  return {
    month,
    revenue,
    gross: Math.round(gross),
    incomplete,
    shippingUnknown,
    fixed,
    fixedSum,
    extras,
    extraSum,
    profit: incomplete ? null : Math.round(gross - fixedSum - extraSum),
    breakevenPercent: state.settings.breakevenMonth ? Math.round((revenue / state.settings.breakevenMonth) * 1000) / 10 : null,
    todayGap: Math.max(0, state.settings.breakevenDay - todayRevenue),
    byChannel: [...byChannel.entries()].map(([channel, value]) => ({ channel, label: CHANNEL_LABEL[channel as Channel], ...value })),
    byProduct: [...byProduct.entries()]
      .map(([name, value]) => ({ name, ...value }))
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 20),
    reprintCount: reprints.length,
    reprintRate: orders.length ? Math.round((reprints.length / orders.length) * 1000) / 10 : 0,
    openDate: state.settings.shopOpenDate,
  };
}

export async function saveMonthlyFixed(actor: Actor, month: string, rows: { key: string; amount: number }[]) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    for (const row of rows) {
      const existing = state.monthlyFixed.find((item) => item.month === month && item.key === row.key);
      const before = existing?.amount ?? null;
      if (existing) existing.amount = row.amount;
      else state.monthlyFixed.push({ month, key: row.key, amount: row.amount });
      audit(state, actor.id, "cost.fixed", `${month}:${row.key}`, { amount: before }, { amount: row.amount });
    }
  });
}

export async function addExpense(actor: Actor, input: { month: string; name: string; amount: number; note: string }) {
  assertRole(actor, ["owner"]);
  if (!input.name.trim() || !Number.isFinite(input.amount)) throw new Error("Chi phí chưa đủ.");
  await mutate(async (state) => {
    state.expenses.unshift({
      id: nid(),
      month: input.month,
      name: input.name.trim(),
      amount: input.amount,
      note: input.note.trim(),
      at: nowIso(),
      by: actor.id,
    });
  });
}

const SETTING_NUMBERS = [
  "inkPercent",
  "tiktokFeePercent",
  "tiktokExtraPercent",
  "tiktokFixed",
  "tiktokTaxPercent",
  "tiktokCommissionPercent",
  "tiktokAffiliatePercent",
  "shopeeFeePercent",
  "shopeeExtraPercent",
  "shopeeInfra",
  "shopeePiship",
  "shopeeTaxPercent",
  "shopeeCommissionPercent",
  "shopeeAffiliatePercent",
  "fbTaxPercent",
  "fbCommissionPercent",
  "fbAdsPercent",
  "fbCodPercent",
  "walkinCommissionPercent",
  "marginYellowPercent",
  "marginRedPercent",
  "wasteRate",
  "tapeOrdersPerRoll",
  "magnetPiecesPerSheet",
  "ppRollWidthCm",
  "filmRollWidthCm",
  "foamRollWidthCm",
  "foamRollLengthM",
  "depositMinTotal",
  "depositPercent",
  "breakevenMonth",
  "breakevenDay",
  "lateGraceMinutes",
  "saleBase",
  "saleProbationPercent",
  "productionBase",
  "fileRetentionDays",
  "videoRetentionDays",
  "rentFromJune2027",
] as const;

export async function getSettings(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return {
    settings: state.settings,
    audits: state.audits.slice(0, 40).map((item) => ({
      ...item,
      actorName: state.staff.find((person) => person.id === item.actorId)?.name ?? "",
    })),
    groups: state.groups.map((group) => ({ id: group.id, name: group.name, gate: group.gate })),
    staff: state.staff.map((person) => ({
      id: person.id,
      name: person.name,
      email: person.email,
      role: person.role,
      active: person.active,
      probation: person.probation,
      hiredAt: person.hiredAt,
    })),
  };
}

export async function saveSettings(actor: Actor, patch: Record<string, unknown>) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const before = structuredClone(state.settings);
    for (const key of SETTING_NUMBERS) {
      if (!(key in patch)) continue;
      const value = patch[key];
      if (value === null || value === "") continue;
      const number = Number(value);
      if (!Number.isFinite(number)) throw new Error(`Số liệu "${key}" không hợp lệ.`);
      (state.settings[key] as number) = number;
    }
    if ("fbShipping" in patch) {
      const value = patch.fbShipping;
      state.settings.fbShipping = value === null || value === "" ? null : Number(value);
    }
    if ("lateDeductionPerMinute" in patch) {
      const value = patch.lateDeductionPerMinute;
      state.settings.lateDeductionPerMinute = value === null || value === "" ? null : Number(value);
    }
    if ("absenceDeductionPerDay" in patch) {
      const value = patch.absenceDeductionPerDay;
      state.settings.absenceDeductionPerDay = value === null || value === "" ? null : Number(value);
    }
    if (typeof patch.zaloPhone === "string") state.settings.zaloPhone = patch.zaloPhone.replace(/\D/g, "");
    if (typeof patch.publicHours === "string") state.settings.publicHours = patch.publicHours;
    if (typeof patch.workStart === "string") state.settings.workStart = patch.workStart;
    if (typeof patch.workEnd === "string") state.settings.workEnd = patch.workEnd;
    if (typeof patch.shopOpenDate === "string") state.settings.shopOpenDate = patch.shopOpenDate;
    if (typeof patch.marketplaceCutoff === "string") state.settings.marketplaceCutoff = patch.marketplaceCutoff;
    if (typeof patch.marketplaceHandover === "string") state.settings.marketplaceHandover = patch.marketplaceHandover;
    if (typeof patch.showAnhThe === "boolean") state.settings.showAnhThe = patch.showAnhThe;
    if (typeof patch.showAlbum === "boolean") state.settings.showAlbum = patch.showAlbum;
    if (Array.isArray(patch.weeklyOff)) {
      state.settings.weeklyOff = patch.weeklyOff.map(Number).filter((day) => day >= 0 && day <= 6);
    }
    if (patch.groupListed && typeof patch.groupListed === "object") {
      state.settings.groupListed = { ...state.settings.groupListed, ...(patch.groupListed as Record<string, boolean>) };
    }
    if (Array.isArray(patch.fixedCosts)) {
      state.settings.fixedCosts = (patch.fixedCosts as { key: string; name: string; amount: number; note: string }[]).map((row) => ({
        key: String(row.key),
        name: String(row.name),
        amount: Number(row.amount),
        note: String(row.note ?? ""),
      }));
    }
    if (Array.isArray(patch.commissionTiers)) {
      state.settings.commissionTiers = (patch.commissionTiers as { upto: number | null; percent: number }[]).map((tier) => ({
        upto: tier.upto === null || tier.upto === undefined ? null : Number(tier.upto),
        percent: Number(tier.percent),
      }));
    }
    if (Array.isArray(patch.kpiTargets)) state.settings.kpiTargets = (patch.kpiTargets as number[]).map(Number);
    recalcBoms(state);
    audit(state, actor.id, "settings.update", "settings", before, state.settings);
  });
}

export async function saveStaff(actor: Actor, input: { id?: string; name: string; email: string; role: Role; password?: string; probation?: boolean; hiredAt?: string | null; active?: boolean }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    if (input.id) {
      const person = state.staff.find((item) => item.id === input.id);
      if (!person) throw new Error("Không thấy tài khoản.");
      person.name = input.name.trim();
      person.email = input.email.trim().toLowerCase();
      person.role = input.role;
      if (input.probation !== undefined) person.probation = input.probation;
      if (input.hiredAt !== undefined) person.hiredAt = input.hiredAt;
      if (input.active !== undefined) person.active = input.active;
      if (input.password) {
        person.passwordHash = await hashPassword(input.password);
        person.mustChangePassword = true;
      }
      audit(state, actor.id, "staff.update", person.id, null, { email: person.email, role: person.role });
      return;
    }
    if (!input.password) throw new Error("Tài khoản mới cần mật khẩu.");
    state.staff.push({
      id: nid(),
      name: input.name.trim(),
      email: input.email.trim().toLowerCase(),
      role: input.role,
      passwordHash: await hashPassword(input.password),
      active: true,
      mustChangePassword: true,
      probation: Boolean(input.probation),
      hiredAt: input.hiredAt ?? null,
    });
  });
}

export async function filesDue(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const now = Date.now();
  const rows = [];
  for (const order of state.orders) {
    for (const file of order.files) {
      if (file.deletedAt || file.status !== "complete") continue;
      const age = (now - new Date(file.createdAt).getTime()) / 86400000;
      const limit = file.kind === "packing_video" ? state.settings.videoRetentionDays : state.settings.fileRetentionDays;
      if (age >= limit) rows.push({ orderCode: order.code, fileId: file.id, name: file.name, kind: file.kind, ageDays: Math.floor(age) });
    }
  }
  return rows;
}

export async function deleteStoredFile(actor: Actor, fileId: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    for (const order of state.orders) {
      const file = order.files.find((item) => item.id === fileId);
      if (!file) continue;
      file.deletedAt = nowIso();
      if (file.storage === "local") {
        await unlink(path.join(process.cwd(), file.path)).catch(() => undefined);
      }
      if (file.storage === "drive" && file.driveFileId) await deleteFromDrive(file.driveFileId).catch(() => undefined);
      if (file.storage === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
        const { createClient } = await import("@supabase/supabase-js");
        const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
          auth: { persistSession: false, autoRefreshToken: false },
        });
        await supabase.storage.from("order-originals").remove([file.path]);
      }
      audit(state, actor.id, "file.delete", file.id, { name: file.name }, { deletedAt: file.deletedAt });
      return;
    }
    throw new Error("Không thấy file.");
  });
}

export async function fileForStaff(actor: Actor, fileId: string): Promise<{ name: string; mime: string; bytes?: Uint8Array; redirect?: string }> {
  const state = await readState();
  for (const order of state.orders) {
    const file = order.files.find((item) => item.id === fileId && !item.deletedAt);
    if (!file) continue;
    if (file.storage === "local") {
      const bytes = new Uint8Array(await readFile(path.join(process.cwd(), file.path)));
      return { name: file.name, mime: file.mime, bytes };
    }
    if (file.storage === "drive" && file.driveFileId) {
      return { name: file.name, mime: file.mime, bytes: await downloadFromDrive(file.driveFileId) };
    }
    if (file.storage === "supabase" && process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const signed = await supabase.storage.from("order-originals").createSignedUrl(file.path, 60 * 10);
      if (!signed.data?.signedUrl) throw new Error("Không tạo được link tải.");
      return { name: file.name, mime: file.mime, redirect: signed.data.signedUrl };
    }
    throw new Error("File chưa có nơi lưu.");
  }
  void actor;
  throw new Error("Không thấy file.");
}

export async function exportWorkbook(actor: Actor, kind: "orders" | "stock" | "moves" | "payroll" | "profit", month: string) {
  if (kind === "profit" || kind === "payroll") assertRole(actor, ["owner"]);
  const state = await readState();
  const sheets: Sheet[] = [];
  if (kind === "orders") {
    sheets.push({
      name: "So don",
      rows: [
        ["Mã", "Kênh", "Khách", "SĐT", "Trạng thái", "Tổng", "Ngày", "Nguồn"],
        ...state.orders
          .filter((order) => order.status !== "draft_upload")
          .map((order) => {
            const customer = customerName(state, order.customerId);
            return [order.code, CHANNEL_LABEL[order.channel], customer.name, customer.phone, STATUS_LABEL[order.status], order.total, order.createdAt, order.source];
          }),
      ],
    });
  }
  if (kind === "stock") {
    const showCost = actor.role === "owner";
    sheets.push({
      name: "Ton kho",
      rows: [
        ["Vật tư", "Tồn", "Đơn vị", "Mua theo", "Giá mua", "Tối thiểu", "Nơi mua"],
        ...state.materials.map((material) => [
          material.name,
          material.stock,
          material.unit,
          material.buyLabel,
          showCost ? material.packPrice : null,
          material.minStock,
          material.supplier,
        ]),
      ],
    });
  }
  if (kind === "moves") {
    sheets.push({
      name: "Nhap xuat",
      rows: [
        ["Lúc", "Vật tư", "Số lượng", "Lý do", "Ghi chú"],
        ...state.movements.map((move) => [
          move.at,
          state.materials.find((item) => item.id === move.materialId)?.name ?? move.materialId,
          move.qty,
          move.reason,
          move.note,
        ]),
      ],
    });
  }
  if (kind === "payroll") {
    const rows = state.staff.filter((person) => person.role !== "owner").map((person) => payrollRow(state, person, month));
    sheets.push({
      name: "Luong",
      rows: [
        ["Nhân viên", "Lương cứng", "Thưởng KPI", "Hoa hồng", "Khấu trừ", "Thực nhận", "Phút trễ", "Ngày vắng"],
        ...rows.map((row) => [row.name, row.base, row.kpiBonus, row.commission, row.deduction, row.net, row.lateMinutes, row.absentDays]),
      ],
    });
  }
  if (kind === "profit") {
    const report = await profitReport(actor, month);
    sheets.push({
      name: "Loi nhuan",
      rows: [
        ["Tháng", month],
        ["Doanh thu", report.revenue],
        ["Lãi gộp", report.gross],
        ["Chi phí cố định", report.fixedSum],
        ["Chi phí phát sinh", report.extraSum],
        ["Lợi nhuận", report.profit],
        [],
        ["Khoản cố định", "Số tiền"],
        ...report.fixed.map((row) => [row.name, row.amount]),
      ],
    });
  }
  return { filename: `${kind}-${month}.xls`, xml: workbookXml(sheets) };
}

export async function skuOptions(actor: Actor) {
  const state = await readState();
  return state.skus.map((sku) => {
    const group = state.groups.find((item) => item.id === sku.groupId);
    const price = priceOf(state.prices, sku.id, "tai_tiem")?.price ?? null;
    return {
      id: sku.id,
      label: `${sku.code} · ${group?.name ?? ""} · ${sku.name}`,
      groupId: sku.groupId,
      price: actor.role === "production" ? null : price,
    };
  });
}

export async function recalc(actor: Actor) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => recalcBoms(state));
}
