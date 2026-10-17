import path from "node:path";

import { visibleToRole } from "@/domain/access";
import {
  comboPriceError,
  comboWarnings,
  depositFor,
  formulaQty,
  isWeeklyOff,
  kpiTarget,
  minutesEarly,
  vnMonth,
  vnYmd,
  minutesLate,
  groupIsListed,
  priceOf,
  quoteSku,
  isProductionStep,
  statusChangeError,
  vnParts,
  walkInListed,
} from "@/domain/calc";
import { commissionBasisLabel, commissionForSale } from "@/domain/commission";
import { workbookXml, type Sheet } from "@/domain/excel";
import { imageBytesMatch, imageMimeAllowed } from "@/domain/images";
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_TTL_SECONDS, LOGIN_IP_FAIL_LIMIT, LOGIN_LOCK_MS, loginFailIpKey, loginFailKey, loginIp } from "@/domain/login-limit";
import { filesToPurge } from "@/domain/files";
import { canExport, payrollForActor } from "@/domain/guard";
import { applyMarketplaceProfile, customerCard, customerCards, customerReminders, findCustomer, ordersForCustomer, type SpecialDate } from "@/domain/crm";
import { EXPECTED_COLUMNS, fileOrderAdapter, listDifference, normalizeMarketplacePhone, parseMarketplaceTable, planMarketplaceImport, type MarketplaceChannel, type PlannedItem } from "@/domain/marketplace";
import { applyRestore, restoreSummary } from "@/domain/restore";
import { blankShipping, orderShipping, shipsOut } from "@/domain/shipping";
import { hashPassword, recalcBoms, verifyPassword } from "@/domain/seed";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/domain/totp";
import { syncOrderStock } from "@/domain/stock";
import type {
  Channel,
  Order,
  OrderFile,
  OrderStatus,
  Role,
  ShopState,
  Sku,
  SkuMap,
  Staff,
} from "@/domain/types";
import { CHANNEL_LABEL, STATUS_LABEL } from "@/domain/types";
import { kpiForActor, saleKpi } from "@/domain/kpi";
import { businessReport } from "@/domain/report";
import { buildDashboard, customerName, extraTotal, fixedRows, inventoryView, orderDetail, orderSummary } from "@/domain/views";
import { getRequest } from "@tanstack/react-start/server";

import { onWorkers, orderFiles, shopKv } from "@/server/bindings";
import { listBackups, readBackup, writeManualBackup } from "@/server/store";
import { clearProductPhoto, readProductPhoto, writeProductPhoto } from "@/server/photos";
import { integrationStatus, saveIntegrationSecret } from "@/server/secrets";
import { deleteFromDrive, downloadFromDrive, driveConfigured, uploadToDrive } from "@/server/drive";
import { mutate, readState, usesDisk, usesSupabase } from "@/server/store";

export type Actor = Pick<Staff, "id" | "name" | "email" | "role" | "mustChangePassword"> & {
  totpEnabled: boolean;
};

export type LoginResult = Actor | { needsTotp: true };

function toActor(staff: Staff): Actor {
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    mustChangePassword: staff.mustChangePassword,
    totpEnabled: staff.totpEnabled === true,
  };
}

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

const LOCKTEST_EMAIL = "khongtontai-locktest@example.invalid";

function audit(state: ShopState, actorId: string | null, action: string, entity: string, before: unknown, after: unknown) {
  if (state.audits.some((item) => item.action === "auth.fail" && item.entity === LOCKTEST_EMAIL)) {
    state.audits = state.audits.filter((item) => !(item.action === "auth.fail" && item.entity === LOCKTEST_EMAIL));
  }
  state.audits.unshift({ id: nid(), at: nowIso(), actorId, action, entity, before, after });
  if (state.audits.length > 2000) state.audits.length = 2000;
}

/** Đếm trong isolate này khi chưa có SHOP_KV, và chặn dồn request trước khi KV kịp thấy bản ghi. */
const loginFailMemory = new Map<string, string[]>();

function memoryFailCount(key: string, now: number): number {
  const kept = (loginFailMemory.get(key) ?? []).filter((at) => {
    const stamp = Date.parse(at);
    return Number.isFinite(stamp) && stamp >= now - LOGIN_LOCK_MS && stamp <= now;
  });
  loginFailMemory.set(key, kept);
  return kept.length;
}

function rememberFail(key: string, at: string) {
  const now = Date.parse(at);
  const kept = (loginFailMemory.get(key) ?? []).filter((stamp) => {
    const parsed = Date.parse(stamp);
    return Number.isFinite(parsed) && parsed >= now - LOGIN_LOCK_MS && parsed <= now;
  });
  kept.push(at);
  loginFailMemory.set(key, kept);
}

async function kvFailCount(key: string): Promise<number> {
  const kv = await shopKv();
  if (!kv) return 0;
  const raw = await kv.get(key, "text");
  const count = Number(raw ?? "0");
  return Number.isInteger(count) && count > 0 ? count : 0;
}

async function failCount(key: string, now: number): Promise<number> {
  return Math.max(memoryFailCount(key, now), await kvFailCount(key));
}

/** Ghi bộ đếm. Không ghi lại khi đã khóa, để khóa KV tự hết hạn 15 phút sau lần khóa. */
async function bumpFail(key: string, at: string, limit: number): Promise<{ count: number; crossed: boolean }> {
  const now = Date.parse(at);
  const before = await failCount(key, now);
  if (before >= limit) return { count: before, crossed: false };
  rememberFail(key, at);
  const stored = await kvFailCount(key);
  if (stored >= limit) return { count: stored, crossed: false };
  const next = Math.max(stored + 1, memoryFailCount(key, now));
  const kv = await shopKv();
  if (kv) await kv.put(key, String(next), { expirationTtl: LOGIN_FAIL_TTL_SECONDS });
  return { count: next, crossed: next >= limit };
}

async function clearLoginFail(email: string) {
  loginFailMemory.delete(loginFailKey(email));
  const kv = await shopKv();
  if (kv) await kv.delete(loginFailKey(email));
}

function clientIp(): string {
  try {
    const headers = getRequest()?.headers;
    if (!headers) return "unknown";
    const cf = headers.get("cf-connecting-ip");
    if (cf?.trim()) return loginIp(cf);
    const forwarded = headers.get("x-forwarded-for")?.split(",")[0];
    if (forwarded?.trim()) return loginIp(forwarded);
  } catch {
    // Ngoài một request HTTP.
  }
  return "unknown";
}

/** Mỗi lần sai chỉ tăng khóa KV. shop_state chỉ bị ghi khi lần này chạm ngưỡng khóa. */
async function noteLoginFailure(email: string, ip: string): Promise<void> {
  const at = new Date().toISOString();
  const emailFail = await bumpFail(loginFailKey(email), at, LOGIN_FAIL_LIMIT);
  const ipFail = await bumpFail(loginFailIpKey(ip), at, LOGIN_IP_FAIL_LIMIT);
  const emailLocked = emailFail.crossed;
  const ipLocked = ipFail.crossed;
  if (!emailLocked && !ipLocked) return;
  const scope = emailLocked && ipLocked ? "both" : emailLocked ? "email" : "ip";
  await mutate(async (draft) => {
    audit(draft, null, "auth.lock", email, null, { ip, scope });
  });
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
  return toActor(staff);
}

export async function login(email: string, password: string, code?: string): Promise<LoginResult> {
  const emailKey = email.trim().toLowerCase();
  const ip = clientIp();
  const now = Date.now();
  if ((await failCount(loginFailKey(emailKey), now)) >= LOGIN_FAIL_LIMIT || (await failCount(loginFailIpKey(ip), now)) >= LOGIN_IP_FAIL_LIMIT) {
    throw new Error("Đăng nhập sai quá nhiều. Thử lại sau 15 phút.");
  }
  const state = await readState();
  const staff = state.staff.find((s) => s.email.toLowerCase() === emailKey && s.active);
  const passwordOk = Boolean(staff) && (await verifyPassword(password, staff?.passwordHash ?? ""));
  if (!staff || !passwordOk) {
    await noteLoginFailure(emailKey, ip);
    throw new Error("Email hoặc mật khẩu không đúng.");
  }
  if (staff.totpEnabled && staff.totpSecret) {
    if (!code?.trim()) return { needsTotp: true };
    if (!(await verifyTotp(staff.totpSecret, code))) {
      await noteLoginFailure(emailKey, ip);
      throw new Error("Mã xác thực không đúng.");
    }
  }
  await clearLoginFail(emailKey);
  await mutate(async (draft) => {
    audit(draft, staff.id, "auth.login", staff.id, null, { email: staff.email });
  });
  return toActor(staff);
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
  return groupIsListed(state.settings, group);
}

export async function publicConfig() {
  const state = await readState();
  const phone = state.settings.zaloPhone || "0778662227";
  const digits = phone.replace(/\D/g, "");
  const showZalo = state.settings.showZalo !== false;
  return {
    name: "NHÀ IN THIÊN THIÊN",
    showZalo,
    phone: showZalo ? prettyPhone(phone) : "",
    phoneRaw: showZalo ? digits : "",
    zalo: showZalo ? `https://zalo.me/${digits}` : "",
    hours: state.settings.publicHours,
    region: "Xuân Lộc, Đồng Nai",
    maxPhotoBytes: await photoByteLimit(),
  };
}

let lastFileSweep = 0;

function sweepExpiredFiles() {
  const now = Date.now();
  if (now - lastFileSweep < 6 * 60 * 60 * 1000) return;
  lastFileSweep = now;
  void purgeExpiredFiles(now).catch(() => {
    lastFileSweep = 0;
  });
}

export async function publicCatalog() {
  sweepExpiredFiles();
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
      cover_path: state.settings.productPhotos?.[group.slug]
        ? `/api/public/product-photo/${group.slug}`
        : null,
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

function upsertCustomer(
  state: ShopState,
  input: { name: string; phone: string; address?: string; platformBuyer?: string; fromMarketplace?: boolean },
) {
  const parsed = normalizeMarketplacePhone(input.phone);
  const phoneNormalized = parsed.masked ? `masked:${parsed.phone}` : parsed.phone;
  if (!parsed.masked && phoneNormalized.length < 8) throw new Error("Số điện thoại chưa đúng.");
  const name = input.name.trim();
  const address = input.address?.trim() ?? "";
  let customer = findCustomer(state.customers, {
    phoneNormalized,
    name,
    address,
    platformBuyer: input.platformBuyer,
  });
  if (!customer) {
    customer = {
      id: nid(),
      name,
      phone: parsed.masked ? parsed.phone : input.phone.trim(),
      phoneNormalized,
      address,
      addresses: address ? [address] : [],
      platformBuyer: input.platformBuyer?.trim() || undefined,
      note: parsed.masked ? "SĐT bị ẩn" : "",
      createdAt: nowIso(),
    };
    state.customers.push(customer);
    return customer;
  }
  if (input.fromMarketplace) {
    const next = applyMarketplaceProfile(customer, {
      name,
      address,
      platformBuyer: input.platformBuyer ?? "",
      masked: parsed.masked,
    });
    customer.name = next.name;
    customer.address = next.address;
    customer.addresses = next.addresses;
    customer.platformBuyer = next.platformBuyer;
    customer.note = next.note;
    return customer;
  }
  if (name) customer.name = name;
  if (address) customer.address = address;
  if (parsed.masked && !customer.note.includes("SĐT bị ẩn")) {
    customer.note = [customer.note, "SĐT bị ẩn"].filter(Boolean).join(". ");
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

function marketplaceItems(state: ShopState, channel: Channel, items: PlannedItem[]) {
  return items.map((item) => {
    const sku = skuOrThrow(state, item.skuId);
    const group = state.groups.find((row) => row.id === sku.groupId);
    const listed = priceOf(state.prices, sku.id, channel)?.price ?? null;
    const lineTotal = item.platformLineTotal;
    return {
      id: nid(),
      skuId: sku.id,
      name: item.name || `${group?.name ?? "Sản phẩm"} — ${sku.name}`,
      skuCode: sku.code,
      quantity: item.quantity,
      unitPrice: lineTotal === null || item.quantity <= 0 ? null : Math.round(lineTotal / item.quantity),
      lineTotal,
      listUnitPrice: listed,
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
      shipping: blankShipping(),
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

const KV_UPLOAD_MAX = 10 * 1024 * 1024;

/** null khi Drive, R2 hoặc Supabase nhận ảnh lớn. Còn lại (KV hoặc đĩa local) là 10MB. */
export async function photoByteLimit(): Promise<number | null> {
  if (driveConfigured()) return null;
  if (await orderFiles()) return null;
  if (usesSupabase()) return null;
  return KV_UPLOAD_MAX;
}

export async function createUploadTicket(input: {
  orderId: string;
  accessToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
}) {
  if (!imageMimeAllowed(input.mimeType)) throw new Error("Định dạng ảnh không được hỗ trợ.");
  const limit = await photoByteLimit();
  if (limit !== null && input.sizeBytes > limit) throw new Error("Mỗi ảnh tối đa 10MB.");
  const fileId = nid();
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "anh.jpg";
  const storagePath = `orders/${input.orderId}/originals/${fileId}-${safe}`;
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    order.files.push({
      id: fileId,
      name: input.fileName,
      mime: input.mimeType,
      size: input.sizeBytes,
      status: "uploading",
      kind: "original",
      storage: "local",
      path: storagePath,
      driveFileId: null,
      createdAt: nowIso(),
      deletedAt: null,
    });
  });
  return { fileId, path: storagePath, mode: "server" as const };
}

async function putPhoto(file: OrderFile, orderId: string, bytes: Uint8Array, mime: string) {
  if (driveConfigured()) {
    file.driveFileId = await uploadToDrive(file.name, mime || file.mime, bytes);
    file.storage = "drive";
    file.path = file.driveFileId;
    return;
  }
  const bucket = await orderFiles();
  if (bucket) {
    await bucket.put(file.path, bytes, { httpMetadata: { contentType: mime || file.mime } });
    file.storage = "r2";
    return;
  }
  const kv = await shopKv();
  if (kv) {
    if (bytes.byteLength > KV_UPLOAD_MAX) {
      throw new Error("Mỗi ảnh tối đa 10MB.");
    }
    const key = `upload:${file.id}`;
    await kv.put(key, bytes);
    file.storage = "kv";
    file.path = key;
    return;
  }
  if (usesSupabase()) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    const uploaded = await supabase.storage.from("order-originals").upload(file.path, bytes, {
      contentType: mime || file.mime,
      upsert: true,
    });
    if (uploaded.error) throw new Error(uploaded.error.message);
    file.storage = "supabase";
    return;
  }
  if (onWorkers()) {
    throw new Error("Không có chỗ lưu ảnh trên Workers. Gắn R2 ORDER_FILES hoặc KV SHOP_KV.");
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const relative = path.join("data", "uploads", orderId, file.id);
  const absolute = path.join(process.cwd(), relative);
  await mkdir(path.dirname(absolute), { recursive: true });
  await writeFile(absolute, bytes);
  file.storage = "local";
  file.path = relative;
}

async function removePhoto(file: OrderFile) {
  if (file.storage === "local" && (await usesDisk())) {
    const { unlink } = await import("node:fs/promises");
    await unlink(path.join(process.cwd(), file.path)).catch(() => undefined);
  }
  if (file.storage === "drive" && file.driveFileId) await deleteFromDrive(file.driveFileId).catch(() => undefined);
  if (file.storage === "r2") {
    const bucket = await orderFiles();
    if (bucket) await bucket.delete(file.path).catch(() => undefined);
  }
  if (file.storage === "kv") {
    const kv = await shopKv();
    if (kv) await kv.delete(file.path || `upload:${file.id}`).catch(() => undefined);
  }
  if (file.storage === "supabase" && usesSupabase()) {
    const { createClient } = await import("@supabase/supabase-js");
    const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    await supabase.storage.from("order-originals").remove([file.path]);
  }
}

export async function saveDirectUpload(input: {
  orderId: string;
  accessToken: string;
  fileId: string;
  bytes: Uint8Array;
  mime: string;
}) {
  const limit = await photoByteLimit();
  if (limit !== null && input.bytes.byteLength > limit) throw new Error("Mỗi ảnh tối đa 10MB.");
  if (!imageMimeAllowed(input.mime) || !imageBytesMatch(input.mime, input.bytes)) {
    throw new Error("Định dạng ảnh không được hỗ trợ.");
  }
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    const file = order.files.find((item) => item.id === input.fileId);
    if (!file) throw new Error("Không thấy file của đơn.");
    await putPhoto(file, order.id, input.bytes, input.mime);
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

export async function dashboard(actor: Actor) {
  return visibleToRole(actor.role, buildDashboard(await readState(), actor));
}

export async function listOrders(actor: Actor) {
  const state = await readState();
  return visibleToRole(actor.role, {
    orders: state.orders
      .filter((order) => order.status !== "draft_upload" && (actor.role !== "production" || isProductionStep(order.status)))
      .map((order) => orderSummary(state, order, actor.role)),
  });
}

export async function getOrder(actor: Actor, code: string) {
  const state = await readState();
  const order = state.orders.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!order) throw new Error("Không tìm thấy đơn hàng.");
  return visibleToRole(actor.role, orderDetail(state, order, actor.role));
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
      shipping: blankShipping(),
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

export async function setOrderStatus(
  actor: Actor,
  input: { orderId: string; status: OrderStatus; note: string; ownerOverride?: boolean },
) {
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    refreshDeposit(state, order);
    const reason = input.note.trim();
    const blocked = statusChangeError({
      role: actor.role,
      ownerOverride: Boolean(input.ownerOverride),
      current: order.status,
      next: input.status,
      reason,
      depositRequired: order.depositRequired,
      depositPaid: order.depositPaid,
    });
    if (blocked) throw new Error(blocked);
    const from = order.status;
    syncOrderStock(state, order, input.status, actor.id);
    order.status = input.status;
    order.updatedAt = nowIso();
    if (input.status === "xong") order.completedAt = nowIso();
    else if (from === "xong") order.completedAt = null;
    order.history.push({ at: nowIso(), from, to: input.status, by: actor.id, note: reason });
    const reopening = (from === "huy" || from === "xong") && input.status !== from;
    audit(state, actor.id, "order.status", order.id, { status: from }, reopening ? { status: input.status, reason } : { status: input.status });
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
  const warnings = (["tai_tiem", "facebook", "tiktok", "shopee"] as Channel[]).flatMap((channel) =>
    comboWarnings(skus, state.prices, channel).map((text) => `${CHANNEL_LABEL[channel]}: ${text}`),
  );
  return visibleToRole(actor.role, {
    groups: state.groups.map((group) => ({ id: group.id, name: group.name })),
    warnings,
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
  });
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
  return visibleToRole(actor.role, inventoryView(await readState(), actor.role));
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

export async function updateMaterial(
  actor: Actor,
  input: {
    materialId: string;
    packPrice: number | null;
    packSize: number | null;
    minStock: number | null;
    supplier: string;
    leadTimeDays?: number | null;
  },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === input.materialId);
    if (!material) throw new Error("Không thấy vật tư.");
    const before = { packPrice: material.packPrice, packSize: material.packSize, minStock: material.minStock, leadTimeDays: material.leadTimeDays ?? null };
    material.packPrice = input.packPrice;
    material.packSize = input.packSize;
    material.minStock = input.minStock;
    material.supplier = input.supplier;
    if (input.leadTimeDays !== undefined) material.leadTimeDays = input.leadTimeDays;
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
    audit(state, actor.id, "stock.count", material.id, { stock: systemQty }, { stock: input.actual });
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
    audit(state, actor.id, "stock.ink", ink.id, null, { qty: -1 });
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

export async function customerList(actor: Actor, q: string, includeCancelled = false) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const query = q.trim().toLowerCase();
  return customerCards(state).filter((customer) => {
    if (!includeCancelled && customer.onlyCancelled) return false;
    if (!query) return true;
    const digits = query.replace(/\D/g, "");
    return (
      customer.name.toLowerCase().includes(query) ||
      customer.phone.toLowerCase().includes(query) ||
      (digits.length >= 3 && customer.phoneNormalized.includes(digits)) ||
      customer.tags.some((tag) => tag.toLowerCase().includes(query))
    );
  });
}

export async function customerDetail(actor: Actor, id: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const customer = customerCard(state, id);
  if (!customer) throw new Error("Không thấy khách.");
  return visibleToRole(actor.role, {
    ...customer,
    orders: ordersForCustomer(state, id).map((order) => orderSummary(state, order, actor.role)),
  });
}

export async function reminderList(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  return visibleToRole(actor.role, customerReminders(await readState()));
}

export async function saveCustomerNote(
  actor: Actor,
  id: string,
  note: string,
  tags?: string[],
  specialDates?: SpecialDate[],
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const card = customerCard(state, id);
    if (!card) throw new Error("Không thấy khách.");
    const cleanTags = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
    const cleanDates = (specialDates ?? [])
      .map((date) => ({ label: date.label.trim(), month: date.month, day: date.day }))
      .filter((date) => date.label && date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= 31);
    for (const customer of state.customers) {
      if (!card.ids.includes(customer.id)) continue;
      customer.note = note;
      if (tags) customer.tags = cleanTags;
      if (specialDates) customer.specialDates = cleanDates;
    }
    audit(state, actor.id, "customer.update", id, null, { note, tags: cleanTags });
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
      punches: state.punches.filter((punch) => punch.staffId === person.id && vnMonth(punch.inAt) === month),
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
  const punches = state.punches.filter((punch) => punch.staffId === person.id && vnMonth(punch.inAt) === month);
  const lateMinutes = punches.reduce((sum, punch) => sum + punch.lateMinutes, 0);
  const days = ymdList(month).filter((day) => day <= today && day >= settings.shopOpenDate);
  const absentDays = days.filter((day) => {
    if (isWeeklyOff(day, settings.weeklyOff)) return false;
    if (person.hiredAt && day < person.hiredAt) return false;
    if (state.leaves.some((leave) => leave.staffId === person.id && leave.date === day)) return false;
    return !punches.some((punch) => vnYmd(punch.inAt) === day);
  }).length;
  const pay = person.role === "sale" ? commissionForSale(state, person.id, month) : null;
  const revenue = pay?.revenue ?? 0;
  const commission = pay?.commission ?? 0;
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
    commissionBasis: pay?.basis ?? null,
  };
}

export async function payroll(actor: Actor, month: string) {
  const state = await readState();
  const locked = state.payrollLocks.some((item) => item.month === month);
  const rows = state.staff.filter((person) => person.role !== "owner").map((person) => payrollRow(state, person, month));
  return {
    month,
    locked,
    scope: actor.role === "owner" ? ("all" as const) : ("self" as const),
    rows: payrollForActor(actor.role, actor.id, rows),
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
  const orders = state.orders.filter((order) => order.status === "xong" && vnMonth(order.completedAt) === month);
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
  const reprints = state.reprints.filter((row) => vnMonth(row.reportedAt) === month);
  const today = vnParts();
  const todayRevenue = orders
    .filter((order) => vnYmd(order.completedAt) === today.ymd)
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

export async function ownerReport(actor: Actor, month: string, grain: "day" | "week" | "month") {
  assertRole(actor, ["owner"]);
  return businessReport(await readState(), month, grain);
}

export async function kpiReport(actor: Actor, month: string) {
  assertRole(actor, ["owner", "sale"]);
  return kpiForActor(actor.role, actor.id, saleKpi(await readState(), month));
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
  "repeatCustomerOrders",
  "remindAfterDays",
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
    if (typeof patch.showZalo === "boolean") state.settings.showZalo = patch.showZalo;
    if (typeof patch.publicHours === "string") state.settings.publicHours = patch.publicHours;
    if (typeof patch.workStart === "string") state.settings.workStart = patch.workStart;
    if (typeof patch.workEnd === "string") state.settings.workEnd = patch.workEnd;
    if (typeof patch.shopOpenDate === "string") state.settings.shopOpenDate = patch.shopOpenDate;
    if (typeof patch.marketplaceCutoff === "string") state.settings.marketplaceCutoff = patch.marketplaceCutoff;
    if (typeof patch.marketplaceHandover === "string") state.settings.marketplaceHandover = patch.marketplaceHandover;
    if (typeof patch.remindMessage === "string") state.settings.remindMessage = patch.remindMessage.trim();
    if (patch.commissionBasis === "shop" || patch.commissionBasis === "handled") {
      state.settings.commissionBasis = patch.commissionBasis;
    }
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
  return filesToPurge(state).map((row) => ({
    orderCode: row.orderCode,
    fileId: row.fileId,
    name: row.name,
    kind: row.kind,
    ageDays: row.ageDays,
  }));
}

export async function purgeExpiredFiles(now = Date.now()): Promise<number> {
  const preview = await readState();
  if (!filesToPurge(preview, now).length) return 0;
  return mutate(async (state) => {
    let removed = 0;
    for (const target of filesToPurge(state, now)) {
      const order = state.orders.find((item) => item.id === target.orderId);
      const file = order?.files.find((item) => item.id === target.fileId);
      if (!file || file.deletedAt) continue;
      await removePhoto(file);
      file.deletedAt = new Date(now).toISOString();
      removed += 1;
    }
    return removed;
  });
}

export async function deleteStoredFile(actor: Actor, fileId: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    for (const order of state.orders) {
      const file = order.files.find((item) => item.id === fileId);
      if (!file) continue;
      file.deletedAt = nowIso();
      await removePhoto(file);
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
      if (!(await usesDisk())) throw new Error("File nằm trên đĩa local, không đọc được trên Workers.");
      const { readFile } = await import("node:fs/promises");
      const bytes = new Uint8Array(await readFile(path.join(process.cwd(), file.path)));
      return { name: file.name, mime: file.mime, bytes };
    }
    if (file.storage === "drive" && file.driveFileId) {
      return { name: file.name, mime: file.mime, bytes: await downloadFromDrive(file.driveFileId) };
    }
    if (file.storage === "r2") {
      const bucket = await orderFiles();
      const object = bucket ? await bucket.get(file.path) : null;
      if (!object) throw new Error("Không thấy ảnh trong R2.");
      return { name: file.name, mime: file.mime, bytes: new Uint8Array(await object.arrayBuffer()) };
    }
    if (file.storage === "kv") {
      const kv = await shopKv();
      const buf = kv ? await kv.get(file.path || `upload:${file.id}`, "arrayBuffer") : null;
      if (!buf) throw new Error("Không thấy ảnh trong KV.");
      return { name: file.name, mime: file.mime, bytes: new Uint8Array(buf) };
    }
    if (file.storage === "supabase" && usesSupabase()) {
      const { createClient } = await import("@supabase/supabase-js");
      const supabase = createClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, {
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
  if (!canExport(actor.role, kind)) throw new Error("Không có quyền làm việc này.");
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
            return [
              order.code,
              CHANNEL_LABEL[order.channel],
              customer.name,
              customer.phone,
              STATUS_LABEL[order.status],
              actor.role === "production" ? null : order.total,
              order.createdAt,
              order.source,
            ];
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
        ["Nhân viên", "Lương cứng", "Thưởng KPI", "Hoa hồng", "Cách tính hoa hồng", "Khấu trừ", "Thực nhận", "Phút trễ", "Ngày vắng"],
        ...rows.map((row) => [
          row.name,
          row.base,
          row.kpiBonus,
          row.commission,
          row.commissionBasis ? commissionBasisLabel(row.commissionBasis) : "",
          row.deduction,
          row.net,
          row.lateMinutes,
          row.absentDays,
        ]),
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
  return visibleToRole(
    actor.role,
    state.skus.map((sku) => {
      const group = state.groups.find((item) => item.id === sku.groupId);
      const price = priceOf(state.prices, sku.id, "tai_tiem")?.price ?? null;
      return {
        id: sku.id,
        label: `${sku.code} · ${group?.name ?? ""} · ${sku.name}`,
        groupId: sku.groupId,
        ...(actor.role === "production" ? {} : { price }),
      };
    }),
  );
}

export async function recalc(actor: Actor) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => recalcBoms(state));
}

export async function listAudits(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return state.audits.slice(0, 200).map((item) => ({
    id: item.id,
    at: item.at,
    action: item.action,
    entity: item.entity,
    actorName: state.staff.find((person) => person.id === item.actorId)?.name ?? "",
    before: item.before,
    after: item.after,
  }));
}

export async function beginTotp(actor: Actor) {
  const secret = generateTotpSecret();
  await mutate(async (state) => {
    const staff = staffOf(state, actor.id);
    if (staff.totpEnabled) throw new Error("Xác thực 2 lớp đang bật. Tắt trước khi tạo mã mới.");
    staff.totpPendingSecret = secret;
  });
  return { secret, uri: otpauthUri(actor.email, secret) };
}

export async function confirmTotp(actor: Actor, code: string) {
  await mutate(async (state) => {
    const staff = staffOf(state, actor.id);
    if (!staff.totpPendingSecret) throw new Error("Chưa tạo mã bí mật.");
    if (!(await verifyTotp(staff.totpPendingSecret, code))) throw new Error("Mã xác thực không đúng.");
    staff.totpSecret = staff.totpPendingSecret;
    staff.totpPendingSecret = null;
    staff.totpEnabled = true;
    audit(state, actor.id, "auth.totp", staff.id, null, { enabled: true });
  });
}

export async function disableTotp(actor: Actor, password: string, code: string) {
  await mutate(async (state) => {
    const staff = staffOf(state, actor.id);
    if (!(await verifyPassword(password, staff.passwordHash))) throw new Error("Mật khẩu hiện tại không đúng.");
    if (!staff.totpEnabled || !staff.totpSecret) throw new Error("Xác thực 2 lớp đang tắt.");
    if (!(await verifyTotp(staff.totpSecret, code))) throw new Error("Mã xác thực không đúng.");
    staff.totpEnabled = false;
    staff.totpSecret = null;
    staff.totpPendingSecret = null;
    audit(state, actor.id, "auth.totp", staff.id, null, { enabled: false });
  });
}

export async function backups(actor: Actor) {
  assertRole(actor, ["owner"]);
  return listBackups();
}

export async function downloadBackupFile(actor: Actor, key: string) {
  assertRole(actor, ["owner"]);
  const doc = await readBackup(key);
  return {
    filename: `${key.replaceAll(":", "-")}.json`,
    json: JSON.stringify({ version: doc.version, doc }),
  };
}

export async function restorePreview(actor: Actor, key: string) {
  assertRole(actor, ["owner"]);
  const doc = await readBackup(key);
  return { key, ...restoreSummary(await readState(), doc) };
}

export async function restoreFromBackup(actor: Actor, key: string) {
  assertRole(actor, ["owner"]);
  const doc = await readBackup(key);
  await mutate(async (state) => {
    const next = applyRestore(state, doc);
    next.audits = [
      {
        id: nid(),
        at: nowIso(),
        actorId: actor.id,
        action: "backup.restore",
        entity: key,
        before: null,
        after: { version: doc.version, kept: "staff" },
      },
      ...(next.audits ?? []),
    ].slice(0, 2000);
    const draft = state as unknown as Record<string, unknown>;
    for (const field of Object.keys(draft)) delete draft[field];
    Object.assign(draft, next);
  });
}

export async function backupNow(actor: Actor) {
  assertRole(actor, ["owner"]);
  const key = await writeManualBackup(await readState());
  await mutate(async (state) => {
    audit(state, actor.id, "backup.manual", key, null, { key });
  });
  return { key };
}

export async function integrations(actor: Actor) {
  assertRole(actor, ["owner"]);
  return integrationStatus();
}

export async function setIntegration(actor: Actor, provider: string, value: string) {
  assertRole(actor, ["owner"]);
  await saveIntegrationSecret(provider, value);
  await mutate(async (state) => {
    audit(state, actor.id, "secret.update", provider, null, { set: value.trim().length > 0 });
  });
}

function mapsOf(state: ShopState): SkuMap[] {
  if (!state.skuMaps) state.skuMaps = [];
  return state.skuMaps;
}

function bytesFromBase64(value: string): Uint8Array {
  if (value.length > 6_000_000) throw new Error("File tối đa khoảng 4MB.");
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function marketplacePlan(state: ShopState, channel: MarketplaceChannel, filename: string, base64: string) {
  const table = await fileOrderAdapter(channel).loadTable({ filename, bytes: bytesFromBase64(base64) });
  const lines = parseMarketplaceTable(table);
  const maps = (state.skuMaps ?? []).filter((row) => row.channel === channel);
  const existingIds = state.orders
    .filter((order) => order.channel === channel && order.marketplaceCode)
    .map((order) => order.marketplaceCode);
  const plan = planMarketplaceImport({ lines, maps, existingIds });
  return {
    ...plan,
    orders: plan.orders.map((order) => ({
      ...order,
      items: order.items.map((item) => {
        const listUnitPrice = priceOf(state.prices, item.skuId, channel)?.price ?? null;
        return { ...item, listUnitPrice, difference: listDifference(item.platformLineTotal, listUnitPrice, item.quantity) };
      }),
    })),
  };
}

export function marketplaceColumns() {
  return EXPECTED_COLUMNS;
}

export async function previewMarketplaceFile(
  actor: Actor,
  input: { channel: MarketplaceChannel; filename: string; base64: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const plan = await marketplacePlan(await readState(), input.channel, input.filename, input.base64);
  return { columns: EXPECTED_COLUMNS, ...plan };
}

export async function importMarketplaceFile(
  actor: Actor,
  input: { channel: MarketplaceChannel; filename: string; base64: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const preview = await marketplacePlan(await readState(), input.channel, input.filename, input.base64);
  const codes = await mutate(async (state) => {
    const made: string[] = [];
    for (const planned of preview.orders) {
      const taken = state.orders.some(
        (order) => order.channel === input.channel && order.marketplaceCode === planned.platformOrderId,
      );
      if (taken) continue;
      const customer = upsertCustomer(state, {
        name: planned.buyer,
        phone: planned.phone,
        address: planned.address,
        platformBuyer: planned.platformBuyer,
        fromMarketplace: true,
      });
      const items = marketplaceItems(state, input.channel, planned.items);
      const totals = sumItems(items);
      const notes = [`Nhập từ file ${input.channel}`, ...planned.flags];
      const order: Order = {
        id: nid(),
        code: nextCode(state),
        channel: input.channel,
        source: "manual",
        customerId: customer.id,
        status: planned.status,
        fulfillment: "delivery",
        address: planned.address,
        customerNote: "",
        internalNote: notes.join(". "),
        dueDate: null,
        marketplaceCode: planned.platformOrderId,
        recipientName: planned.buyer,
        shipping: {
          carrier: planned.carrier,
          tracking: planned.tracking,
          shipFee: planned.shipFee,
          codAmount: planned.codAmount,
          codReceivedAt: null,
        },
        items,
        subtotal: totals.subtotal,
        total: planned.orderAmount ?? totals.total,
        depositRequired: 0,
        depositPaid: 0,
        depositMethod: "",
        depositBy: null,
        printDeducted: false,
        packDeducted: false,
        stockWarning: "",
        accessTokenHash: "",
        accessToken: "",
        idempotencyKey: `${input.channel}:${planned.platformOrderId}`,
        createdAt: planned.createdAt ?? nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
        files: [],
        history: [{ at: nowIso(), from: null, to: "nhan_don", by: actor.id, note: "Nhập từ file sàn" }],
      };
      refreshDeposit(state, order);
      state.orders.unshift(order);
      audit(state, actor.id, "order.import", order.id, null, {
        code: order.code,
        platform: planned.platformOrderId,
        channel: input.channel,
      });
      made.push(order.code);
    }
    return made;
  });
  return { codes, issues: preview.issues, duplicates: preview.duplicates, cancelled: preview.cancelled };
}

export async function listSkuMaps(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  return {
    maps: (state.skuMaps ?? []).map((row) => ({
      ...row,
      skuCode: state.skus.find((sku) => sku.id === row.skuId)?.code ?? "",
    })),
    skus: state.skus.map((sku) => ({
      id: sku.id,
      label: `${sku.code} · ${state.groups.find((group) => group.id === sku.groupId)?.name ?? ""} · ${sku.name}`,
    })),
  };
}

export async function saveSkuMap(actor: Actor, input: { channel: MarketplaceChannel; externalSku: string; skuId: string }) {
  assertRole(actor, ["owner", "sale"]);
  const externalSku = input.externalSku.trim();
  if (!externalSku) throw new Error("Thiếu SKU sàn.");
  await mutate(async (state) => {
    skuOrThrow(state, input.skuId);
    const maps = mapsOf(state);
    const found = maps.find(
      (row) => row.channel === input.channel && row.externalSku.toLowerCase() === externalSku.toLowerCase(),
    );
    if (found) found.skuId = input.skuId;
    else maps.push({ channel: input.channel, externalSku, skuId: input.skuId });
    audit(state, actor.id, "sku.map", externalSku, null, { channel: input.channel, skuId: input.skuId });
  });
}

export async function removeSkuMap(actor: Actor, input: { channel: MarketplaceChannel; externalSku: string }) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    state.skuMaps = (state.skuMaps ?? []).filter(
      (row) => !(row.channel === input.channel && row.externalSku.toLowerCase() === input.externalSku.trim().toLowerCase()),
    );
  });
}

export async function saveOrderShipping(
  actor: Actor,
  input: { orderId: string; carrier: string; tracking: string; shipFee: number | null; codAmount: number | null },
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(order);
    order.shipping = {
      carrier: input.carrier.trim(),
      tracking: input.tracking.trim(),
      shipFee: input.shipFee,
      codAmount: input.codAmount,
      codReceivedAt: previous.codReceivedAt,
    };
    audit(state, actor.id, "order.shipping", order.id, previous, order.shipping);
  });
}

export async function markCodReceived(actor: Actor, orderId: string, received: boolean) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(order);
    order.shipping = { ...previous, codReceivedAt: received ? nowIso() : null };
    audit(state, actor.id, "order.cod", order.id, { codReceivedAt: previous.codReceivedAt }, { received });
  });
}

export async function deliveryBoard(actor: Actor) {
  const state = await readState();
  const money = actor.role !== "production";
  return state.orders.filter(shipsOut).map((order) => {
    const customer = customerName(state, order.customerId);
    const ship = orderShipping(order);
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      channel: order.channel,
      channelLabel: CHANNEL_LABEL[order.channel],
      customerName: customer.name,
      recipientName: order.recipientName ?? "",
      phone: customer.phone,
      address: order.address,
      itemSummary: order.items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
      carrier: ship.carrier,
      tracking: ship.tracking,
      shipFee: money ? ship.shipFee : null,
      codAmount: money ? ship.codAmount : null,
      codReceivedAt: money ? ship.codReceivedAt : null,
      canLabel: order.channel === "tai_tiem" || order.channel === "facebook",
    };
  });
}

export async function codBoard(actor: Actor, month: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const rows = state.orders
    .filter((order) => vnMonth(order.createdAt) === month)
    .map((order) => ({ order, ship: orderShipping(order) }))
    .filter((row) => (row.ship.codAmount ?? 0) > 0);
  const byCarrier = new Map<string, { carrier: string; orders: number; expected: number; received: number }>();
  const lines = rows.map(({ order, ship }) => {
    const carrier = ship.carrier || "Chưa ghi hãng";
    const bucket = byCarrier.get(carrier) ?? { carrier, orders: 0, expected: 0, received: 0 };
    bucket.orders += 1;
    bucket.expected += ship.codAmount ?? 0;
    if (ship.codReceivedAt) bucket.received += ship.codAmount ?? 0;
    byCarrier.set(carrier, bucket);
    const customer = customerName(state, order.customerId);
    return {
      id: order.id,
      code: order.code,
      carrier,
      customerName: customer.name,
      codAmount: ship.codAmount,
      codReceivedAt: ship.codReceivedAt,
      createdAt: order.createdAt,
    };
  });
  const carriers = [...byCarrier.values()].map((row) => ({ ...row, outstanding: row.expected - row.received }));
  return {
    month,
    lines,
    carriers,
    expected: carriers.reduce((sum, row) => sum + row.expected, 0),
    received: carriers.reduce((sum, row) => sum + row.received, 0),
  };
}

export async function listGroupPhotos(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  return state.groups
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((group) => ({
      id: group.id,
      name: group.name,
      slug: group.slug,
      custom: Boolean(state.settings.productPhotos?.[group.slug]),
    }));
}

export async function saveGroupPhoto(actor: Actor, slug: string, bytes: Uint8Array, mime: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  if (!state.groups.some((group) => group.slug === slug)) throw new Error("Không có nhóm này.");
  await writeProductPhoto(slug, bytes, mime);
  await mutate(async (draft) => {
    draft.settings.productPhotos = { ...(draft.settings.productPhotos ?? {}), [slug]: mime };
    audit(draft, actor.id, "photo.product", slug, null, { mime });
  });
}

export async function removeGroupPhoto(actor: Actor, slug: string) {
  assertRole(actor, ["owner", "sale"]);
  await clearProductPhoto(slug);
  await mutate(async (draft) => {
    const photos = { ...(draft.settings.productPhotos ?? {}) };
    delete photos[slug];
    draft.settings.productPhotos = photos;
    audit(draft, actor.id, "photo.product", slug, null, { cleared: true });
  });
}

export async function publicProductPhoto(slug: string) {
  const state = await readState();
  if (!state.settings.productPhotos?.[slug]) return null;
  return readProductPhoto(slug);
}
