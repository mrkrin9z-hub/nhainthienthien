import path from "node:path";

import { visibleToRole } from "@/domain/access";
import { auditActionLabel, auditDay, describeAudit, type AuditShop } from "@/domain/audit-text";
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
  isMergedWoodAlias,
  priceOf,
  quoteSku,
  sheetMargin,
  isProductionStep,
  statusChangeError,
  vnParts,
  walkInListed,
} from "@/domain/calc";
import { commissionBasisLabel, commissionForSale } from "@/domain/commission";
import { orderCodePrefix, skuSoldOn, withChannelSold, type ReportScope } from "@/domain/mohome";
import { applyStockCount, approveWaste, confirmWasteDay, editWaste, recordWaste, voidWaste, wasteDesk, wasteMonth, type EditWasteInput } from "@/domain/waste";
import { workbookXml, type Sheet } from "@/domain/excel";
import { imageBytesMatch, imageMimeAllowed, imagePreviewable } from "@/domain/images";
import { albumPhone, photoTooBig, publicUploadCard, uploadTokenShape } from "@/domain/order-upload";
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_TTL_SECONDS, LOGIN_IP_FAIL_LIMIT, LOGIN_LOCK_MS, loginFailIpKey, loginFailKey, loginIp } from "@/domain/login-limit";
import { marketplaceEditLocked, orderRevisionBlock } from "@/domain/order-edit";
import {
  cleanBank,
  feedbackAnswer,
  feedbackLabel,
  feedbackOpensReprint,
  hasPackingPhoto,
  itemChangeNote,
  packReady,
  type FeedbackAnswer,
  type LineSnap,
  type PackCheck,
} from "@/domain/print-shop";
import { bytesStillShared, filesToPurge } from "@/domain/files";
import { canExport, payrollForActor } from "@/domain/guard";
import { applyMarketplaceProfile, customerCard, customerCards, customerReminders, findCustomer, ordersForCustomer, type SpecialDate } from "@/domain/crm";
import { EXPECTED_COLUMNS, fileOrderAdapter, listDifference, normalizeMarketplacePhone, parseMarketplaceTable, planMarketplaceImport, type MarketplaceChannel, type ParsedLine, type PlannedItem, type PlannedOrder } from "@/domain/marketplace";
import { applyRestore, restoreSummary } from "@/domain/restore";
import { albumFolderParts, driveFolderParts, orderKindFolder } from "@/domain/drive-path";
import {
  applyTaskStatus,
  checklistCards,
  orderStepKind,
  SHEET_COVERAGE,
  SHOP_RULES,
  taskFileBucket,
  taskFolderParts,
} from "@/domain/checklists";
import {
  CARRIER_NAME,
  carrierIdFromName,
  clampCod,
  clampWeight,
  ghnAuth,
  ghtkAuth,
  jtAuth,
  pickupReady,
  readPickup,
  waybillBlock,
  type CarrierId,
  type WaybillDraft,
} from "@/domain/carriers";
import { defaultCarrier } from "@/domain/jt";
import { amountDue, codExpected } from "@/domain/money";
import { blankShipping, onDeliveryDesk, orderShipping, shipsOut } from "@/domain/shipping";
import { publicContact } from "@/domain/public-contact";
import { applyPriceDrafts, parsePriceRows, type PriceDraft } from "@/domain/price-sheet";
import { applyShelfOffers, cloneChannelPrices, type ShelfOffer } from "@/domain/catalog-sync";
import { rowsFromUpload } from "@/domain/sheet";
import { buildWebProduct, type WebProductInput } from "@/domain/web-product";
import { hashPassword, recalcBoms, verifyPassword } from "@/domain/seed";
import { generateTotpSecret, otpauthUri, verifyTotp } from "@/domain/totp";
import { syncOrderStock } from "@/domain/stock";
import { DEFAULT_ROLE_MODULES, defaultNotifyPrefs, defaultSePay, modulesForStoredRole, sortBySortThenName } from "@/domain/org-desk";
import { findOrderForSePay, sepayCollectAmount, sepayRejectReason, type SePayWebhookPayload } from "@/domain/sepay";
import { extractVietnamPhone, normalizeChatChannel, type ChatChannel, type ShopChatMessage, type ShopConversation } from "@/domain/shop-chat";
import type {
  Announcement,
  Branch,
  Campaign,
  Channel,
  Department,
  MessageTemplate,
  MessageTemplateKind,
  NotifyPrefs,
  Order,
  OrderFile,
  OrderStatus,
  PhotoAlbum,
  Role,
  RoleModules,
  CashHandover,
  SePayConfig,
  ServicePackage,
  Settings,
  ShopDocument,
  ShopState,
  Sku,
  SkuMap,
  Staff,
} from "@/domain/types";
import { CHANNEL_LABEL, CHANNELS, MESSAGE_TEMPLATE_KINDS, ROLE_LABEL, STATUS_LABEL } from "@/domain/types";
import { kpiForActor, saleKpi } from "@/domain/kpi";
import { businessReport } from "@/domain/report";
import { appendCollection, buildLedger, categoryLabel, expenseReport, expenseStamp, handoverError, holderBalances, ordersToCollect, remainOf, walletCards, walletLabel, EXPENSE_CATEGORIES, type CashOrder } from "@/domain/money";
import { buildDashboard, customerName, extraTotal, fixedRows, inventoryView, navCounts, orderDetail, orderSummary } from "@/domain/views";
import { getRequest } from "@tanstack/react-start/server";

import { onWorkers, orderFiles, shopKv } from "@/server/bindings";
import { listBackups, readBackup, writeManualBackup } from "@/server/store";
import { clearProductPhoto, readProductPhoto, writeProductPhoto } from "@/server/photos";
import { createGhnWaybill, createGhtkWaybill, createJtWaybill, quoteGhtkFee, trackGhn, trackGhtk, trackJt } from "@/server/carriers";
import { integrationStatus, readIntegrationSecret, saveIntegrationSecret } from "@/server/secrets";
import { deleteFromDrive, downloadDriveThumbnail, downloadFromDrive, driveConnected, inspectDriveUpload, openDriveUpload, uploadToDrive } from "@/server/drive";
import { mutate, readState, usesDisk, usesSupabase } from "@/server/store";

export type Actor = Pick<Staff, "id" | "name" | "email" | "role" | "mustChangePassword"> & {
  totpEnabled: boolean;
  /** Path menu được phép — từ roleModules. */
  modules: string[];
};

export type LoginResult = Actor | { needsTotp: true };

function toActor(staff: Staff, modules?: string[] | null): Actor {
  const fallback = DEFAULT_ROLE_MODULES.find((row) => row.role === staff.role)?.modules ?? ["/admin"];
  return {
    id: staff.id,
    name: staff.name,
    email: staff.email,
    role: staff.role,
    mustChangePassword: staff.mustChangePassword,
    totpEnabled: staff.totpEnabled === true,
    modules: modules?.length ? modules : [...fallback],
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
  return toActor(staff, modulesForStoredRole(staff.role, state.roleModules));
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
  return toActor(staff, modulesForStoredRole(staff.role, state.roleModules));
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

export async function submitInquiry(input: { name: string; message: string; orderCode?: string; phone?: string }) {
  const name = input.name.trim();
  const message = input.message.trim();
  if (name.length < 2) throw new Error("Tên cần ít nhất 2 ký tự.");
  if (message.length < 5) throw new Error("Nội dung cần ít nhất 5 ký tự.");
  await mutate(async (state) => {
    state.inquiries = state.inquiries ?? [];
    state.inquiries.unshift({
      id: nid(),
      at: nowIso(),
      name: name.slice(0, 80),
      message: message.slice(0, 2000),
      orderCode: (input.orderCode ?? "").trim().slice(0, 40),
      phone: (input.phone ?? "").trim().slice(0, 20),
    });
    state.inquiries = state.inquiries.slice(0, 200);
  });
  return { ok: true as const };
}

export async function listInquiries(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  return state.inquiries ?? [];
}

export async function publicConfig() {
  const state = await readState();
  const contact = publicContact(state.settings);
  return {
    name: "NHÀ IN THIÊN THIÊN",
    showZalo: contact.showZalo,
    phone: contact.phone,
    phoneRaw: contact.phoneRaw,
    zalo: contact.zalo,
    hours: state.settings.publicHours,
    region: "",
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
        .filter((sku) => !isMergedWoodAlias(sku))
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
            sheets: sku.sheets,
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
  items: { skuId: string; quantity: number; unitPrice?: number | null; priceReason?: string }[],
) {
  if (!items.length) throw new Error("Đơn chưa có sản phẩm.");
  return items.map((item) => {
    const sku = skuOrThrow(state, item.skuId);
    if (!skuSoldOn(sku, channel)) throw new Error("Sản phẩm này không bán ở kênh đang chọn.");
    const group = state.groups.find((g) => g.id === sku.groupId);
    const listed = priceOf(state.prices, sku.id, channel);
    let unitPrice = listed?.price ?? null;
    if ((listed?.status !== "dang_ban" || listed.price === null) && actorRole !== "owner") {
      throw new Error("Khổ này chưa có giá, không đưa vào đơn.");
    }
    if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== unitPrice) {
      if (actorRole !== "owner") throw new Error("Chỉ chủ tiệm sửa được giá bán.");
      if (!item.priceReason?.trim()) throw new Error("Sửa giá cần ghi lý do.");
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

function nextCode(state: ShopState, channel: Channel = "tai_tiem"): string {
  const prefix = orderCodePrefix(channel, vnParts().ymd);
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
      shipping: { ...blankShipping(), carrier: defaultCarrier({ channel: "tai_tiem", source: "web", fulfillment: input.fulfillment }) },
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
  if (!order || !order.accessTokenHash || order.accessTokenHash !== (await sha256(accessToken))) {
    throw new Error("Không có quyền với đơn hàng này.");
  }
  return order;
}

async function orderByUploadToken(state: ShopState, token: string) {
  if (!uploadTokenShape(token)) throw new Error("Mã không còn dùng được.");
  const hash = await sha256(token);
  const order = state.orders.find((item) => item.accessTokenHash === hash);
  if (!order) throw new Error("Mã không còn dùng được.");
  if (order.status === "huy") throw new Error("Đơn đã hủy, không nhận thêm ảnh.");
  return order;
}

function freshUploadToken(): string {
  return crypto.randomUUID().replaceAll("-", "");
}

/** Mã QR của một đơn. Giữ mã cũ trừ khi chủ hoặc sale đổi mã. */
export async function orderUploadLink(actor: Actor, orderId: string, rotate = false) {
  assertRole(actor, ["owner", "sale"]);
  return mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không thấy đơn.");
    if (order.status === "huy") throw new Error("Đơn đã hủy, không gửi mã.");
    const creating = !uploadTokenShape(order.accessToken);
    if (creating || rotate) {
      const token = freshUploadToken();
      order.accessToken = token;
      order.accessTokenHash = await sha256(token);
      order.updatedAt = nowIso();
      audit(state, actor.id, "order.upload_link", order.id, null, { code: order.code, rotated: rotate && !creating });
    }
    return { token: order.accessToken, code: order.code };
  });
}

/** Thẻ khách thấy khi mở mã của đơn: người đặt, sản phẩm, ảnh gốc đã gửi. */
export async function publicUploadTarget(token: string) {
  const state = await readState();
  const order = await orderByUploadToken(state, token);
  const customer = state.customers.find((item) => item.id === order.customerId);
  return {
    ...publicUploadCard({ order, customer }),
    maxPhotoBytes: await photoByteLimit(),
  };
}

/** Ảnh gốc của đúng đơn. Ảnh trên Drive lấy bản nhỏ Google tạo, không gửi file gốc. */
export async function publicOrderPhoto(token: string, fileId: string, width: 480 | 1600): Promise<{ bytes: Uint8Array; mime: string }> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fileId)) {
    throw new Error("Không thấy ảnh.");
  }
  const state = await readState();
  const order = await orderByUploadToken(state, token);
  const file = order.files.find((item) => item.id === fileId && !item.deletedAt && item.status === "complete" && item.kind === "original");
  if (!file) throw new Error("Không thấy ảnh.");
  if (file.storage === "drive" && file.driveFileId) return downloadDriveThumbnail(file.driveFileId, width);
  if (file.storage === "kv") {
    const kv = await shopKv();
    const buf = kv ? await kv.get(file.path || `upload:${file.id}`, "arrayBuffer") : null;
    if (!buf) throw new Error("Không thấy ảnh.");
    return { bytes: new Uint8Array(buf), mime: file.mime || "image/jpeg" };
  }
  if (file.storage === "local") {
    if (!(await usesDisk()) || file.path.split(/[/\\]/).includes("..")) throw new Error("Không thấy ảnh.");
    const { readFile } = await import("node:fs/promises");
    return { bytes: new Uint8Array(await readFile(path.join(process.cwd(), file.path))), mime: file.mime || "image/jpeg" };
  }
  if (file.storage === "r2") {
    const bucket = await orderFiles();
    const object = bucket ? await bucket.get(file.path) : null;
    if (!object) throw new Error("Không thấy ảnh.");
    return { bytes: new Uint8Array(await object.arrayBuffer()), mime: file.mime || "image/jpeg" };
  }
  throw new Error("Không thấy ảnh.");
}

function albumsOf(state: ShopState): PhotoAlbum[] {
  state.albums ??= [];
  return state.albums;
}

function findAlbum(state: ShopState, albumId: string): PhotoAlbum {
  const album = albumsOf(state).find((item) => item.id === albumId);
  if (!album) throw new Error("Không thấy album.");
  return album;
}

/** Khách gửi ảnh vào album mang tên số điện thoại. Cùng số thì vào cùng album. */
export async function createAlbumTicket(input: { phone: string; fileName: string; mimeType: string; sizeBytes: number }) {
  const phone = albumPhone(input.phone);
  if (!imageMimeAllowed(input.mimeType)) throw new Error("Định dạng ảnh không được hỗ trợ.");
  const limit = await photoByteLimit();
  if (photoTooBig(input.sizeBytes, limit)) throw new Error("Mỗi ảnh tối đa 10MB.");
  const fileId = nid();
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "anh.jpg";
  return mutate(async (state) => {
    const albums = albumsOf(state);
    let album = albums.find((item) => item.phone === phone);
    if (!album) {
      album = { id: nid(), phone, createdAt: nowIso(), updatedAt: nowIso(), orderId: null, files: [] };
      albums.unshift(album);
    }
    album.files.push({
      id: fileId,
      name: input.fileName,
      mime: input.mimeType,
      size: input.sizeBytes,
      status: "uploading",
      kind: "original",
      storage: "local",
      path: `albums/${phone}/${fileId}-${safe}`,
      driveFileId: null,
      createdAt: nowIso(),
      deletedAt: null,
    });
    album.updatedAt = nowIso();
    return { albumId: album.id, fileId, phone };
  });
}

export async function saveAlbumUpload(input: { albumId: string; phone: string; fileId: string; bytes: Uint8Array; mime: string }) {
  const phone = albumPhone(input.phone);
  const limit = await photoByteLimit();
  if (photoTooBig(input.bytes.byteLength, limit)) throw new Error("Mỗi ảnh tối đa 10MB.");
  if (!imageMimeAllowed(input.mime) || !imageBytesMatch(input.mime, input.bytes)) {
    throw new Error("Định dạng ảnh không được hỗ trợ.");
  }
  await mutate(async (state) => {
    const album = findAlbum(state, input.albumId);
    if (album.phone !== phone) throw new Error("Không có quyền với album này.");
    const file = album.files.find((item) => item.id === input.fileId);
    if (!file) throw new Error("Không thấy file của album.");
    await putPhoto(
      file,
      { orderId: `albums/${phone}`, code: phone, customerName: phone, createdAt: album.createdAt, source: "web", channel: "tai_tiem" },
      input.bytes,
      input.mime,
      albumFolderParts(phone),
    );
    file.status = "complete";
    file.size = input.bytes.byteLength;
    album.updatedAt = nowIso();
  });
}

export async function prepareAlbumDriveUpload(input: { albumId: string; phone: string; fileId: string }) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const phone = albumPhone(input.phone);
  const state = await readState();
  const album = (state.albums ?? []).find((item) => item.id === input.albumId);
  if (!album || album.phone !== phone) throw new Error("Không có quyền với album này.");
  const file = album.files.find((item) => item.id === input.fileId && !item.deletedAt);
  if (!file) throw new Error("Không thấy file của album.");
  if (file.status === "complete") throw new Error("Ảnh này đã gửi.");
  return openDriveUpload({ name: file.name, mime: file.mime, sizeBytes: file.size, folders: albumFolderParts(phone) });
}

export async function finishAlbumDriveUpload(input: { albumId: string; phone: string; fileId: string; driveFileId: string }) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const phone = albumPhone(input.phone);
  const state = await readState();
  const album = (state.albums ?? []).find((item) => item.id === input.albumId);
  if (!album || album.phone !== phone) throw new Error("Không có quyền với album này.");
  const file = album.files.find((item) => item.id === input.fileId && !item.deletedAt);
  if (!file) throw new Error("Không thấy file của album.");
  if (file.status === "complete" && file.driveFileId === input.driveFileId) return { ok: true as const };
  const seen = await acceptDriveImage(input.driveFileId, albumFolderParts(phone), file.mime);
  await mutate(async (next) => {
    const current = findAlbum(next, input.albumId);
    if (current.phone !== phone) throw new Error("Không có quyền với album này.");
    const saved = current.files.find((item) => item.id === input.fileId && !item.deletedAt);
    if (!saved) throw new Error("Không thấy file của album.");
    saved.driveFileId = input.driveFileId;
    saved.storage = "drive";
    saved.path = input.driveFileId;
    saved.status = "complete";
    saved.size = seen;
    current.updatedAt = nowIso();
  });
  return { ok: true as const };
}

export async function listPhotoAlbums(actor: Actor) {
  assertRole(actor, ["owner", "sale", "production"]);
  const state = await readState();
  return (state.albums ?? [])
    .slice()
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .map((album) => ({
      id: album.id,
      phone: album.phone,
      fileCount: album.files.filter((file) => !file.deletedAt && file.status === "complete").length,
      updatedAt: album.updatedAt,
      orderId: album.orderId,
      orderCode: state.orders.find((order) => order.id === album.orderId)?.code ?? "",
    }));
}

export async function getPhotoAlbum(actor: Actor, albumId: string) {
  assertRole(actor, ["owner", "sale", "production"]);
  const state = await readState();
  const album = (state.albums ?? []).find((item) => item.id === albumId);
  if (!album) throw new Error("Không thấy album.");
  const order = state.orders.find((item) => item.id === album.orderId);
  return {
    id: album.id,
    phone: album.phone,
    updatedAt: album.updatedAt,
    orderId: album.orderId,
    orderCode: order?.code ?? "",
    files: album.files
      .filter((file) => !file.deletedAt && file.status === "complete")
      .map((file) => ({ id: file.id, name: file.name, mime: file.mime, size: file.size, createdAt: file.createdAt })),
  };
}

/** Gắn ảnh trong album vào một đơn đã có. Ảnh vẫn nằm trong album. */
export async function linkAlbumToOrder(actor: Actor, albumId: string, code: string) {
  assertRole(actor, ["owner", "sale"]);
  return mutate(async (state) => {
    const album = findAlbum(state, albumId);
    const order = state.orders.find((item) => item.code.toUpperCase() === code.trim().toUpperCase());
    if (!order) throw new Error("Không thấy đơn.");
    if (order.status === "huy") throw new Error("Đơn đã hủy. Chọn đơn khác.");
    const ready = album.files.filter((file) => !file.deletedAt && file.status === "complete");
    if (!ready.length) throw new Error("Album chưa có ảnh.");
    for (const file of ready) {
      if (!order.files.some((item) => item.id === file.id)) order.files.push({ ...file });
    }
    album.orderId = order.id;
    album.updatedAt = nowIso();
    order.updatedAt = nowIso();
    order.history.push({ at: nowIso(), from: order.status, to: order.status, by: actor.id, note: `Gắn album ${album.phone}` });
    audit(state, actor.id, "album.link", order.id, null, { phone: album.phone, code: order.code });
    return { orderCode: order.code, phone: album.phone, fileCount: ready.length };
  });
}

const KV_UPLOAD_MAX = 10 * 1024 * 1024;

/** null khi Drive của chủ đã kết nối. Chưa kết nối thì KV hoặc đĩa local, mỗi ảnh 10MB. */
export async function photoByteLimit(): Promise<number | null> {
  if (await driveConnected()) return null;
  return KV_UPLOAD_MAX;
}

export async function createUploadTicket(input: {
  orderId: string;
  accessToken: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  comment?: string;
}) {
  if (!imageMimeAllowed(input.mimeType)) throw new Error("Định dạng ảnh không được hỗ trợ.");
  const limit = await photoByteLimit();
  if (photoTooBig(input.sizeBytes, limit)) {
    throw new Error(limit === null ? "Ảnh quá lớn." : "Mỗi ảnh tối đa 10MB khi chưa nối Google Drive. Nối Drive để gửi ảnh không giới hạn dung lượng.");
  }
  const fileId = nid();
  const safe = input.fileName.replace(/[^a-zA-Z0-9._-]/g, "-").slice(-80) || "anh.jpg";
  const storagePath = `orders/${input.orderId}/originals/${fileId}-${safe}`;
  const comment = (input.comment ?? "").trim().slice(0, 500);
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
      ...(comment ? { comment } : {}),
    });
  });
  return { fileId, path: storagePath, mode: "server" as const };
}

async function putPhoto(
  file: OrderFile,
  folder: { orderId: string; code: string; customerName: string; createdAt: string; source: string; channel: string },
  bytes: Uint8Array,
  mime: string,
  folders?: readonly string[],
) {
  if (await driveConnected()) {
    file.driveFileId = await uploadToDrive({
      name: file.name,
      mime: mime || file.mime,
      bytes,
      folders: folders ?? driveFolderParts(folder),
    });
    file.storage = "drive";
    file.path = file.driveFileId;
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
  if (onWorkers()) {
    throw new Error("Chưa kết nối Google Drive và chưa có KV để lưu ảnh.");
  }
  const { mkdir, writeFile } = await import("node:fs/promises");
  const relative = path.join("data", "uploads", folder.orderId, file.id);
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
  if (photoTooBig(input.bytes.byteLength, limit)) throw new Error("Mỗi ảnh tối đa 10MB.");
  if (!imageMimeAllowed(input.mime) || !imageBytesMatch(input.mime, input.bytes)) {
    throw new Error("Định dạng ảnh không được hỗ trợ.");
  }
  await mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    const file = order.files.find((item) => item.id === input.fileId);
    if (!file) throw new Error("Không thấy file của đơn.");
    const customer = state.customers.find((item) => item.id === order.customerId);
    const customerName = customer?.name ?? "";
    await putPhoto(
      file,
      {
        orderId: order.id,
        code: order.code,
        customerName,
        createdAt: order.createdAt,
        source: order.source,
        channel: order.channel,
      },
      input.bytes,
      input.mime,
      [
        ...driveFolderParts({
          code: order.code,
          customerName,
          createdAt: order.createdAt,
          source: order.source,
          channel: order.channel,
        }),
        orderKindFolder(file.kind),
      ],
    );
    file.status = "complete";
    file.size = input.bytes.byteLength;
  });
}

export async function prepareOrderDriveUpload(input: { orderId: string; accessToken: string; fileId: string }) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const state = await readState();
  const order = await orderByToken(state, input.orderId, input.accessToken);
  if (order.status === "huy") throw new Error("Đơn đã hủy, không nhận thêm ảnh.");
  const file = order.files.find((item) => item.id === input.fileId && !item.deletedAt);
  if (!file) throw new Error("Không thấy file của đơn.");
  if (file.status === "complete") throw new Error("Ảnh này đã gửi.");
  const customer = state.customers.find((item) => item.id === order.customerId);
  return openDriveUpload({
    name: file.name,
    mime: file.mime,
    sizeBytes: file.size,
    folders: [
      ...driveFolderParts({
        code: order.code,
        customerName: customer?.name ?? "",
        createdAt: order.createdAt,
        source: order.source,
        channel: order.channel,
      }),
      orderKindFolder(file.kind),
    ],
  });
}

export async function finishOrderDriveUpload(input: { orderId: string; accessToken: string; fileId: string; driveFileId: string }) {
  if (!(await driveConnected())) throw new Error("Chưa kết nối Google Drive.");
  const state = await readState();
  const order = await orderByToken(state, input.orderId, input.accessToken);
  if (order.status === "huy") throw new Error("Đơn đã hủy, không nhận thêm ảnh.");
  const file = order.files.find((item) => item.id === input.fileId && !item.deletedAt);
  if (!file) throw new Error("Không thấy file của đơn.");
  if (file.status === "complete" && file.driveFileId === input.driveFileId) return { ok: true as const };
  const customer = state.customers.find((item) => item.id === order.customerId);
  const folders = [
    ...driveFolderParts({
      code: order.code,
      customerName: customer?.name ?? "",
      createdAt: order.createdAt,
      source: order.source,
      channel: order.channel,
    }),
    orderKindFolder(file.kind),
  ];
  const seen = await acceptDriveImage(input.driveFileId, folders, file.mime);
  await mutate(async (next) => {
    const current = await orderByToken(next, input.orderId, input.accessToken);
    const saved = current.files.find((item) => item.id === input.fileId && !item.deletedAt);
    if (!saved) throw new Error("Không thấy file của đơn.");
    saved.driveFileId = input.driveFileId;
    saved.storage = "drive";
    saved.path = input.driveFileId;
    saved.status = "complete";
    saved.size = seen;
  });
  return { ok: true as const };
}

async function acceptDriveImage(driveFileId: string, folders: readonly string[], mime: string): Promise<number> {
  if (!/^[A-Za-z0-9_-]{8,200}$/.test(driveFileId)) throw new Error("Mã ảnh trên Drive không đúng.");
  const seen = await inspectDriveUpload(driveFileId, folders);
  if (!seen.inFolder || seen.size < 1 || !imageBytesMatch(mime, seen.head)) {
    await deleteFromDrive(driveFileId).catch(() => undefined);
    throw new Error("Định dạng ảnh không được hỗ trợ.");
  }
  return seen.size;
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

/** Khách bấm gửi xong trên trang mã QR. Đơn đang mở giữ nguyên bước. */
export async function acknowledgeCustomerPhotos(input: { orderId: string; accessToken: string }) {
  return mutate(async (state) => {
    const order = await orderByToken(state, input.orderId, input.accessToken);
    if (order.status === "huy") throw new Error("Đơn đã hủy, không nhận thêm ảnh.");
    const done = order.files.filter((file) => !file.deletedAt && file.status === "complete");
    if (!done.length) throw new Error("Chưa có ảnh nào được tải lên.");
    if (order.status === "draft_upload" || order.status === "upload_error") {
      const allDone = order.files.filter((file) => !file.deletedAt).every((file) => file.status === "complete");
      const next = allDone ? "nhan_don" : "upload_error";
      const from = order.status;
      order.status = next;
      order.updatedAt = nowIso();
      order.history.push({
        at: nowIso(),
        from,
        to: next,
        by: null,
        note: allDone ? "Khách gửi ảnh qua mã" : "Còn file lỗi khi tải lên",
      });
      return { code: order.code, fileCount: done.length, status: next };
    }
    order.updatedAt = nowIso();
    order.history.push({
      at: nowIso(),
      from: order.status,
      to: order.status,
      by: null,
      note: "Khách gửi ảnh qua mã",
    });
    return { code: order.code, fileCount: done.length, status: order.status };
  });
}

export async function lookupOrder(code: string, phone: string) {
  const { lookupByPhone } = await import("@/domain/order-lookup");
  const state = await readState();
  return lookupByPhone({
    phone,
    code,
    customers: state.customers,
    orders: state.orders,
  });
}

async function pullDueQuiet(actor: Actor) {
  if (actor.role !== "owner" && actor.role !== "sale") return;
  try {
    const { pullDueMarketplace } = await import("@/server/marketplace-sync");
    await pullDueMarketplace(actor);
  } catch {
    // Sàn lỗi thì sổ đang có vẫn mở. Lần mở sau sẽ lấy lại.
  }
}

export async function dashboard(actor: Actor) {
  await pullDueQuiet(actor);
  return visibleToRole(actor.role, buildDashboard(await readState(), actor));
}

export async function navBadges(actor: Actor) {
  void actor;
  return navCounts(await readState());
}

export async function listOrders(actor: Actor) {
  await pullDueQuiet(actor);
  const state = await readState();
  return visibleToRole(actor.role, {
    orders: state.orders
      .filter((order) => order.status !== "draft_upload" && (actor.role !== "sale" || order.channel !== "mo_home"))
      .filter((order) => order.status !== "draft_upload" && (actor.role !== "production" || order.channel === "mo_home" || isProductionStep(order.status)))
      .map((order) => orderSummary(state, order, actor.role)),
  });
}

export async function getOrder(actor: Actor, code: string) {
  const state = await readState();
  const order = state.orders.find((item) => item.code.toUpperCase() === code.toUpperCase());
  if (!order) throw new Error("Không tìm thấy đơn hàng.");
  if (actor.role === "sale" && order.channel === "mo_home") throw new Error("Đơn Mơ Home chỉ chủ và sản xuất xem.");
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
    depositPaid: number;
    depositMethod: string;
    discount?: number | null;
    customerShip?: number | null;
    items: { skuId: string; quantity: number; unitPrice?: number | null; priceReason?: string }[];
  },
) {
  if (input.channel === "mo_home") assertRole(actor, ["owner"]);
  else assertRole(actor, ["owner", "sale"]);
  if (input.dueDate && input.dueDate < vnParts().ymd) throw new Error("Ngày hẹn không được ở quá khứ.");
  return mutate(async (state) => {
    const customer = upsertCustomer(state, { name: input.fullName, phone: input.phone, address: input.address });
    const items = buildItems(state, input.channel, actor.role, input.items);
    const totals = sumItems(items);
    const order: Order = {
      id: nid(),
      code: nextCode(state, input.channel),
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
      shipping: {
        ...blankShipping(),
        carrier: defaultCarrier({ channel: input.channel, source: "manual", fulfillment: input.fulfillment }),
        customerShip: input.customerShip ?? null,
      },
      items,
      subtotal: totals.subtotal,
      total: totals.total,
      discount: input.discount ?? null,
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
    if (input.depositPaid > 0) {
      order.depositPaid = Math.round(input.depositPaid);
      order.depositMethod = input.depositMethod.trim() || "Tiền mặt";
      order.depositBy = actor.id;
      order.payments = [
        {
          id: nid(),
          at: order.createdAt,
          amount: order.depositPaid,
          method: order.depositMethod,
          by: actor.id,
        },
      ];
    }
    state.orders.unshift(order);
    audit(state, actor.id, "order.create", order.id, null, { code: order.code, channel: order.channel });
    return { code: order.code };
  });
}

export async function reviseOrder(
  actor: Actor,
  input: {
    orderId: string;
    fullName: string;
    phone: string;
    address: string;
    fulfillment: "pickup" | "delivery";
    note: string;
    dueDate: string | null;
    discount?: number | null;
    customerShip?: number | null;
    items?: { skuId: string; quantity: number; unitPrice?: number | null; priceReason?: string }[];
  },
) {
  assertRole(actor, ["owner", "sale"]);
  if (input.dueDate && input.dueDate < vnParts().ymd) throw new Error("Ngày hẹn không được ở quá khứ.");
  const name = input.fullName.trim();
  if (name.length < 2) throw new Error("Tên khách cần ít nhất 2 ký tự.");
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    if (actor.role === "sale" && order.channel === "mo_home") throw new Error("Đơn Mơ Home chỉ chủ sửa.");
    if (marketplaceEditLocked(order.channel)) throw new Error("Đơn TikTok hoặc Shopee không sửa trên web.");
    const changingItems = input.items != null;
    const blocked = orderRevisionBlock(order, changingItems);
    if (blocked) throw new Error(blocked);
    const customer = upsertCustomer(state, { name, phone: input.phone, address: input.address });
    const before = order.items.map((item) => `${item.quantity}× ${item.skuCode}`).join(", ");
    const beforeLines: LineSnap[] = order.items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice }));
    order.customerId = customer.id;
    order.address = input.address.trim();
    order.customerNote = input.note.trim();
    order.fulfillment = input.fulfillment;
    order.dueDate = input.dueDate;
    if (input.discount !== undefined) order.discount = input.discount;
    if (input.customerShip !== undefined) {
      order.shipping = { ...orderShipping(order), customerShip: input.customerShip };
    }
    if (input.items) {
      const items = input.items.map((item) => {
        const sku = skuOrThrow(state, item.skuId);
        const group = state.groups.find((row) => row.id === sku.groupId);
        const listed = priceOf(state.prices, sku.id, order.channel)?.price ?? null;
        const previous = order.items.find((row) => row.skuId === sku.id);
        let unitPrice = listed;
        if (item.unitPrice !== undefined && item.unitPrice !== null && item.unitPrice !== listed) {
          const kept = previous?.unitPrice === item.unitPrice;
          if (!kept) {
            if (actor.role !== "owner") throw new Error("Chỉ chủ tiệm sửa được giá bán.");
            if (!item.priceReason?.trim()) throw new Error("Sửa giá cần ghi lý do.");
          }
          unitPrice = item.unitPrice;
        }
        return {
          id: previous?.id ?? nid(),
          skuId: sku.id,
          name: previous ? previous.name : `${group?.name ?? "Sản phẩm"} — ${sku.name}`,
          skuCode: sku.code,
          quantity: item.quantity,
          unitPrice,
          lineTotal: unitPrice === null ? null : unitPrice * item.quantity,
          ...(previous?.listUnitPrice !== undefined ? { listUnitPrice: previous.listUnitPrice } : {}),
        };
      });
      const totals = sumItems(items);
      order.items = items;
      order.subtotal = totals.subtotal;
      order.total = totals.total;
      refreshDeposit(state, order);
    }
    order.updatedAt = nowIso();
    const after = order.items.map((item) => `${item.quantity}× ${item.skuCode}`).join(", ");
    if (input.items) {
      const afterLines: LineSnap[] = order.items.map((item) => ({ name: item.name, quantity: item.quantity, unitPrice: item.unitPrice }));
      if (itemChangeNote(beforeLines, afterLines, true)) {
        order.itemChanges = [
          ...(order.itemChanges ?? []),
          { at: order.updatedAt, by: actor.id, before: beforeLines, after: afterLines },
        ];
      }
    }
    audit(state, actor.id, "order.revise", order.id, { items: before }, { items: after, name });
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
      packReady: packReady(order.packCheck, hasPackingPhoto(order.files)),
      approvalReady: order.files.some((file) => !file.deletedAt && file.status === "complete" && file.kind === "approval"),
      channel: order.channel,
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
    if (marketplaceEditLocked(order.channel)) throw new Error("Đơn TikTok hoặc Shopee không thu tiền trên web.");
    const before = order.depositPaid;
    const next = appendCollection(
      order,
      {
        id: nid(),
        at: nowIso(),
        amount: Math.round(input.amount),
        method: input.method.trim() || "Tiền mặt",
        by: actor.id,
      },
      nid(),
    );
    order.payments = next.payments;
    order.depositPaid = next.depositPaid;
    order.depositMethod = next.depositMethod;
    order.depositBy = next.depositBy;
    order.updatedAt = nowIso();
    audit(state, actor.id, "order.deposit", order.id, { depositPaid: before }, { depositPaid: order.depositPaid, method: input.method });
  });
}

function markPrint(order: Order, fileId: string, print: boolean, by: string | null, who: string) {
  const file = order.files.find((item) => item.id === fileId && !item.deletedAt && item.status === "complete" && item.kind === "original");
  if (!file) throw new Error("Không thấy ảnh gốc.");
  if (Boolean(file.print) === print) return;
  file.print = print;
  order.updatedAt = nowIso();
  order.history.push({
    at: order.updatedAt,
    from: order.status,
    to: order.status,
    by,
    note: `${who} ${print ? "chọn in" : "bỏ in"} ảnh ${file.name}`,
  });
}

export async function setFilePrint(actor: Actor, orderId: string, fileId: string, print: boolean) {
  assertRole(actor, ["owner", "sale", "production"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    markPrint(order, fileId, print, actor.id, actor.name);
  });
}

export async function markFileApproval(actor: Actor, orderId: string, fileId: string) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const file = order.files.find((item) => item.id === fileId && !item.deletedAt);
    if (!file || file.status !== "complete") throw new Error("Chỉ đánh dấu ảnh đã tải xong.");
    if (file.kind === "packing_photo" || file.kind === "packing_video") throw new Error("Ảnh đóng gói không dùng làm ảnh duyệt.");
    file.kind = "approval";
    order.updatedAt = nowIso();
    order.history.push({
      at: order.updatedAt,
      from: order.status,
      to: order.status,
      by: actor.id,
      note: `${actor.name} đánh dấu khách đã duyệt ảnh ${file.name}`,
    });
    audit(state, actor.id, "order.approval", order.id, null, { fileId, name: file.name });
  });
}

export async function setCustomerFileComment(token: string, fileId: string, comment: string) {
  const note = comment.trim().slice(0, 500);
  await mutate(async (state) => {
    const order = await orderByUploadToken(state, token);
    const file = order.files.find((item) => item.id === fileId && !item.deletedAt && item.kind === "original");
    if (!file) throw new Error("Không thấy ảnh.");
    file.comment = note;
    order.updatedAt = nowIso();
  });
}

export async function setCustomerFilePrint(token: string, fileId: string, print: boolean) {
  await mutate(async (state) => {
    const order = await orderByUploadToken(state, token);
    markPrint(order, fileId, print, null, "Khách");
  });
}

export async function setOrderPackCheck(actor: Actor, orderId: string, check: PackCheck) {
  assertRole(actor, ["owner", "sale", "production"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    if (order.status === "huy" || order.status === "xong") throw new Error("Đơn đã xong hoặc đã hủy.");
    order.packCheck = { ep: check.ep, bo: check.bo, tem: check.tem };
    order.updatedAt = nowIso();
  });
}

export async function savePackingPhoto(actor: Actor, orderId: string, bytes: Uint8Array, mime: string) {
  assertRole(actor, ["owner", "sale", "production"]);
  if (!imageMimeAllowed(mime) || !imageBytesMatch(mime, bytes)) throw new Error("Chỉ nhận ảnh JPG, PNG hoặc WEBP.");
  if (bytes.byteLength > 4 * 1024 * 1024) throw new Error("Ảnh gói tối đa 4MB.");
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    if (order.status === "huy" || order.status === "xong") throw new Error("Đơn đã xong hoặc đã hủy.");
    const stamp = nowIso();
    for (const file of order.files) {
      if (file.kind === "packing_photo" && !file.deletedAt) file.deletedAt = stamp;
    }
    const file: OrderFile = {
      id: nid(),
      name: `goi-${order.code}.jpg`,
      mime,
      size: bytes.byteLength,
      status: "complete",
      kind: "packing_photo",
      storage: "local",
      path: "",
      driveFileId: null,
      createdAt: stamp,
      deletedAt: null,
    };
    await putPhoto(
      file,
      {
        orderId: order.id,
        code: order.code,
        customerName: customerName(state, order.customerId).name,
        createdAt: order.createdAt,
        source: order.source,
        channel: order.channel,
      },
      bytes,
      mime,
    );
    order.files.push(file);
    order.updatedAt = stamp;
    audit(state, actor.id, "order.pack_photo", order.id, null, { code: order.code });
  });
}

export async function publicFeedbackCard(token: string) {
  const state = await readState();
  const order = await orderByUploadToken(state, token);
  return {
    code: order.code,
    status: order.status,
    open: order.status === "giao" || order.status === "xong",
    feedback: order.feedback ? { answer: order.feedback.answer, note: order.feedback.note } : null,
  };
}

export async function submitOrderFeedback(token: string, answer: FeedbackAnswer, note: string) {
  const text = note.trim().slice(0, 300);
  return mutate(async (state) => {
    const order = await orderByUploadToken(state, token);
    if (order.status !== "giao" && order.status !== "xong") throw new Error("Đơn chưa giao xong.");
    if (order.feedback) return { already: true as const, answer: order.feedback.answer };
    const at = nowIso();
    order.feedback = { at, answer, note: text };
    order.updatedAt = at;
    order.history.push({
      at,
      from: order.status,
      to: order.status,
      by: null,
      note: `Khách đánh giá: ${feedbackLabel(answer)}${text ? ` · ${text}` : ""}`,
    });
    if (feedbackOpensReprint(answer)) {
      state.reprints.unshift({
        id: nid(),
        orderId: order.id,
        reportedAt: at,
        reason: text || feedbackLabel(answer),
        decision: null,
        extraCost: null,
        materialNote: "",
        overdue: false,
        by: null,
        uses: [],
      });
    }
    return { already: false as const, answer };
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
      sheetCost: sku.sheetCost ?? null,
      soldOn: sku.soldOn && sku.soldOn.length > 0 ? sku.soldOn : (["tai_tiem", "facebook", "tiktok", "shopee"] as Channel[]),
      prices: Object.fromEntries(
        CHANNELS.map((channel) => {
          const row = priceOf(state.prices, sku.id, channel);
          const price = row?.price ?? null;
          const margin = sheetMargin(channel, price, sku.sheetCost ?? null, state.settings);
          return [channel, { price, listPrice: row?.listPrice ?? null, status: row?.status ?? "nhap", note: row?.note ?? "", profit: margin.profit, marginPercent: margin.marginPercent, sold: skuSoldOn(sku, channel) }];
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
    const status = input.price === null ? "nhap" : input.status;
    if (status === "dang_ban" && input.price === null) throw new Error("Chưa có giá thì không để đang bán.");
    if (!row) {
      state.prices.push({ skuId: sku.id, channel: input.channel, price: input.price, status, note: input.note });
    } else {
      row.price = input.price;
      row.status = status;
      row.note = input.note;
    }
    if (input.price !== null) sku.soldOn = withChannelSold(sku, input.channel, true);
    audit(state, actor.id, "price.update", `${sku.code}:${input.channel}`, before, input);
  });
}

export async function createPriceSize(
  actor: Actor,
  input: {
    groupId: string;
    widthCm: number;
    heightCm: number;
    sheets: number;
    prices: Partial<Record<Channel, number>>;
  },
) {
  assertRole(actor, ["owner"]);
  const draft: PriceDraft = {
    code: null,
    widthCm: input.widthCm,
    heightCm: input.heightCm,
    sheets: input.sheets,
    prices: input.prices,
  };
  return mutate(async (state) => {
    const result = applyPriceDrafts(state, input.groupId, [draft]);
    audit(state, actor.id, "price.create", input.groupId, null, { ...input, ...result });
    return result;
  });
}

export async function importPriceSheet(actor: Actor, input: { groupId: string; filename: string; base64: string }) {
  assertRole(actor, ["owner"]);
  const drafts = parsePriceRows(rowsFromUpload(input.filename, bytesFromBase64(input.base64)));
  return mutate(async (state) => {
    const result = applyPriceDrafts(state, input.groupId, drafts);
    audit(state, actor.id, "price.import", input.groupId, null, { filename: input.filename, ...result });
    return result;
  });
}

export async function setSkuSold(actor: Actor, input: { skuId: string; channel: Channel; sold: boolean }) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const sku = skuOrThrow(state, input.skuId);
    const before = sku.soldOn ?? null;
    sku.soldOn = withChannelSold(sku, input.channel, input.sold);
    audit(state, actor.id, "sku.sold", `${sku.code}:${input.channel}`, before, sku.soldOn);
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
    name?: string;
    code?: string;
  },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const material = state.materials.find((item) => item.id === input.materialId);
    if (!material) throw new Error("Không thấy vật tư.");
    const before = { packPrice: material.packPrice, packSize: material.packSize, minStock: material.minStock, leadTimeDays: material.leadTimeDays ?? null, name: material.name, code: material.code ?? "" };
    material.packPrice = input.packPrice;
    material.packSize = input.packSize;
    material.minStock = input.minStock;
    material.supplier = input.supplier;
    if (input.leadTimeDays !== undefined) material.leadTimeDays = input.leadTimeDays;
    if (input.name !== undefined && input.name.trim()) material.name = input.name.trim();
    if (input.code !== undefined) material.code = input.code.trim();
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
    applyStockCount(state, { materialId: input.materialId, actual: input.actual, note: input.note, by: actor.id, at: nowIso(), id: nid });
    audit(state, actor.id, "stock.count", material.id, { stock: systemQty }, { stock: input.actual });
  });
}

const WASTE_ROLES: Role[] = ["owner", "sale", "production"];

function photoBytes(value: string): Uint8Array {
  const cleaned = value.replace(/^data:[^,]*,/, "").trim();
  if (cleaned.length > 14_000_000) throw new Error("Ảnh tối đa 10MB.");
  const binary = atob(cleaned);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

export async function wasteBoard(actor: Actor) {
  assertRole(actor, WASTE_ROLES);
  return wasteDesk(await readState(), actor.role);
}

export async function reportWaste(
  actor: Actor,
  input: {
    materialId: string;
    qty: number;
    reason: "in_loi" | "lech_vien" | "bong_mang" | "rach" | "roi_vo" | "khac";
    orderId?: string | null;
    note?: string;
    photoName?: string;
    photoMime?: string;
    photoBase64?: string;
  },
) {
  assertRole(actor, WASTE_ROLES);
  let bytes: Uint8Array | null = null;
  let mime = input.photoMime || "image/jpeg";
  if (input.photoBase64 && input.photoBase64.trim()) {
    const limit = await photoByteLimit();
    bytes = photoBytes(input.photoBase64);
    if (photoTooBig(bytes.byteLength, limit)) throw new Error("Mỗi ảnh tối đa 10MB khi chưa nối Google Drive.");
    if (!imageMimeAllowed(mime) || !imageBytesMatch(mime, bytes)) throw new Error("Chỉ nhận ảnh JPG, PNG, WEBP hoặc HEIC.");
  }
  await mutate(async (state) => {
    let photoId: string | null = null;
    if (bytes) {
      const file: OrderFile = {
        id: nid(),
        name: (input.photoName || "hong.jpg").replace(/[\\/]/g, "-").slice(-80) || "hong.jpg",
        mime,
        size: bytes.byteLength,
        status: "uploading",
        kind: "task",
        storage: "local",
        path: "",
        driveFileId: null,
        createdAt: nowIso(),
        deletedAt: null,
      };
      photoId = file.id;
      const photos = state.wastePhotos ?? (state.wastePhotos = []);
      photos.push(file);
      const order = input.orderId ? state.orders.find((item) => item.id === input.orderId) : null;
      await storeImage(
        file,
        bytes,
        mime,
        {
          orderId: "hao-hut",
          code: "HAO-HUT",
          customerName: "Hao hụt",
          createdAt: file.createdAt,
          source: "manual",
          channel: order?.channel ?? "tai_tiem",
        },
        ["Hao hut", vnYmd()],
      );
    }
    const report = recordWaste(state, {
      materialId: input.materialId,
      qty: input.qty,
      reason: input.reason,
      orderId: input.orderId,
      by: actor.id,
      note: input.note,
      photoId,
      at: nowIso(),
      id: nid,
    });
    audit(state, actor.id, "waste.report", report.id, null, { materialId: report.materialId, qty: report.qty, orderId: report.orderId });
  });
}

export async function closeWasteDay(actor: Actor, day: string) {
  assertRole(actor, ["owner", "production"]);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error("Ngày không hợp lệ.");
  await mutate(async (state) => {
    const count = confirmWasteDay(state, day, actor.id, nowIso());
    audit(state, actor.id, "waste.confirm", day, null, { day, count });
  });
}

export async function approveWasteReport(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    approveWaste(state, id, actor.id, nowIso());
    const report = state.wasteReports?.find((item) => item.id === id);
    audit(state, actor.id, "waste.approve", id, null, { materialId: report?.materialId ?? "" });
  });
}

export async function editWasteReport(actor: Actor, input: EditWasteInput) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const found = state.wasteReports?.find((item) => item.id === input.id);
    const before = found ? { qty: found.qty, materialId: found.materialId } : null;
    editWaste(state, input);
    audit(state, actor.id, "waste.edit", input.id, before, {
      qty: input.qty,
      materialId: input.materialId,
    });
  });
}

export async function voidWasteReport(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const before = state.wasteReports?.find((item) => item.id === id);
    voidWaste(state, id);
    audit(state, actor.id, "waste.void", id, before ? { materialId: before.materialId, qty: before.qty } : null, { status: "void" });
  });
}

export async function openInk(actor: Actor, materialId: string) {
  if (!/^muc-[1-9]$/.test(materialId)) throw new Error("Chọn một lọ mực.");
  await mutate(async (state) => {
    const ink = state.materials.find((item) => item.id === materialId);
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
  profile?: { name?: string; phone?: string; address?: string },
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const card = customerCard(state, id);
    if (!card) throw new Error("Không thấy khách.");
    const cleanTags = [...new Set((tags ?? []).map((tag) => tag.trim()).filter(Boolean))];
    const cleanDates = (specialDates ?? [])
      .map((date) => ({ label: date.label.trim(), month: date.month, day: date.day }))
      .filter((date) => date.label && date.month >= 1 && date.month <= 12 && date.day >= 1 && date.day <= 31);
    const name = profile?.name?.trim();
    if (profile?.name !== undefined && (!name || name.length < 2)) throw new Error("Tên khách cần ít nhất 2 ký tự.");
    let phone = "";
    let phoneNormalized = "";
    if (profile?.phone !== undefined) {
      const parsed = normalizeMarketplacePhone(profile.phone);
      phoneNormalized = parsed.masked ? `masked:${parsed.phone}` : parsed.phone;
      if (!parsed.masked && phoneNormalized.length < 8) throw new Error("Số điện thoại chưa đúng.");
      const taken = state.customers.find((customer) => customer.phoneNormalized === phoneNormalized && !card.ids.includes(customer.id));
      if (taken) throw new Error("Số này đang thuộc khách khác.");
      phone = parsed.masked ? parsed.phone : profile.phone.trim();
    }
    const address = profile?.address?.trim();
    for (const customer of state.customers) {
      if (!card.ids.includes(customer.id)) continue;
      customer.note = note;
      if (tags) customer.tags = cleanTags;
      if (specialDates) customer.specialDates = cleanDates;
      if (name) customer.name = name;
      if (profile?.phone !== undefined) {
        customer.phone = phone;
        customer.phoneNormalized = phoneNormalized;
      }
      if (address !== undefined) {
        customer.address = address;
        const known = customer.addresses ?? [];
        if (address && !known.includes(address)) customer.addresses = [...known, address];
      }
    }
    audit(state, actor.id, "customer.update", id, null, { note, tags: cleanTags, name: name ?? card.name });
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
  const beforeOpen = month < settings.shopOpenDate.slice(0, 7);
  const base = beforeOpen
    ? 0
    : person.role === "production"
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
  const revenue = beforeOpen ? 0 : (pay?.revenue ?? 0);
  const commission = beforeOpen ? 0 : (pay?.commission ?? 0);
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
    beforeOpen,
    probation: person.probation,
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
  const orders = state.orders.filter((order) => order.status === "xong" && order.channel !== "mo_home" && vnMonth(order.completedAt) === month);
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
  const waste = wasteMonth(state, month, "nha_in", revenue);
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
    wasteCost: waste.wasteCost,
    wasteUnknown: waste.wasteUnknown,
    wasteLines: waste.wasteLines,
    wasteRate: waste.wasteRate,
    wasteAlert: waste.wasteAlert,
    wasteThreshold: waste.wasteThreshold,
    profit: incomplete ? null : Math.round(gross - fixedSum - extraSum - waste.wasteCost),
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

export async function ownerReport(actor: Actor, month: string, grain: "day" | "week" | "month", scope: ReportScope = "nha_in") {
  assertRole(actor, ["owner"]);
  return businessReport(await readState(), month, grain, scope);
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

export async function addExpense(
  actor: Actor,
  input: { month: string; name: string; amount: number; note: string; category?: string; wallet?: string; date?: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const name = input.name.trim();
  const amount = Math.round(input.amount);
  if (!name || !Number.isFinite(amount) || amount <= 0) throw new Error("Chi phí chưa đủ.");
  const category = EXPENSE_CATEGORIES.some((item) => item.id === input.category) ? input.category! : "khac";
  const wallet = input.wallet === "chuyen_khoan" ? "chuyen_khoan" : "tien_mat";
  let at = nowIso();
  let month = input.month;
  if (input.date) {
    const stamp = expenseStamp(input.date);
    at = stamp.at;
    month = stamp.month;
  }
  if (!/^\d{4}-\d{2}$/.test(month)) throw new Error("Tháng chi chưa đúng.");
  await mutate(async (state) => {
    const row = {
      id: nid(),
      month,
      name,
      amount,
      note: input.note.trim(),
      at,
      by: actor.id,
      category,
      wallet,
      approvedAt: null,
    };
    state.expenses.unshift(row);
    audit(state, actor.id, "cost.expense", row.id, null, { name, amount, wallet, category });
  });
}

export async function deleteExpense(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const index = state.expenses.findIndex((row) => row.id === id);
    if (index < 0) throw new Error("Không thấy khoản chi.");
    const [row] = state.expenses.splice(index, 1);
    if (!row) throw new Error("Không thấy khoản chi.");
    audit(state, actor.id, "cost.expense", row.id, { name: row.name, amount: row.amount }, null);
  });
}

export async function approveExpense(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const row = state.expenses.find((item) => item.id === id);
    if (!row) throw new Error("Không thấy khoản chi.");
    if (row.approvedAt) return;
    row.approvedAt = nowIso();
    audit(state, actor.id, "cost.expense.approve", row.id, { approvedAt: null }, { approvedAt: row.approvedAt });
  });
}

export async function adjustWallet(actor: Actor, input: { wallet: "tien_mat" | "chuyen_khoan"; amount: number; note: string }) {
  assertRole(actor, ["owner"]);
  const amount = Math.round(input.amount);
  if (!Number.isFinite(amount) || amount === 0) throw new Error("Số tiền điều chỉnh chưa đúng.");
  if (input.wallet !== "tien_mat" && input.wallet !== "chuyen_khoan") throw new Error("Chọn ví tiền mặt hoặc chuyển khoản.");
  await mutate(async (state) => {
    const row = {
      id: nid(),
      at: nowIso(),
      wallet: input.wallet,
      amount,
      note: input.note.trim(),
      by: actor.id,
    };
    state.walletAdjusts = [row, ...(state.walletAdjusts ?? [])];
    audit(state, actor.id, "wallet.adjust", row.id, null, { wallet: row.wallet, amount, note: row.note });
  });
}

export async function handCash(actor: Actor, input: { staffId?: string; amount: number; note: string }) {
  assertRole(actor, ["owner", "sale"]);
  const amount = Math.round(input.amount);
  const fromId = actor.role === "owner" && input.staffId ? input.staffId : actor.id;
  if (actor.role !== "owner" && input.staffId && input.staffId !== actor.id) {
    throw new Error("Chỉ nộp tiền mặt của chính mình.");
  }
  await mutate(async (state) => {
    if (!state.staff.some((person) => person.id === fromId)) throw new Error("Không thấy nhân viên.");
    const held =
      holderBalances({
        orders: cashOrders(state),
        expenses: state.expenses,
        staff: state.staff.map((person) => ({ id: person.id, name: person.name })),
        handovers: state.handovers ?? [],
      }).find((row) => row.staffId === fromId)?.tien_mat ?? 0;
    const error = handoverError({ held, amount });
    if (error) throw new Error(error);
    const row: CashHandover = {
      id: nid(),
      at: nowIso(),
      fromId,
      amount,
      wallet: "tien_mat",
      note: input.note.trim(),
      by: actor.id,
    };
    state.handovers = [row, ...(state.handovers ?? [])];
    audit(state, actor.id, "cash.handover", row.id, null, { fromId, amount, note: row.note });
  });
}

function cashOrders(state: ShopState): CashOrder[] {
  return state.orders.map((order) => {
    const row: CashOrder = {
      id: order.id,
      code: order.code,
      customerName: customerName(state, order.customerId).name,
      status: order.status,
      total: order.total,
      depositPaid: order.depositPaid,
      depositMethod: order.depositMethod,
      depositBy: order.depositBy,
      createdAt: order.createdAt,
    };
    if (order.payments && order.payments.length > 0) {
      row.payments = order.payments.map((payment) => ({ at: payment.at, amount: payment.amount, method: payment.method, by: payment.by }));
    }
    return row;
  });
}

export async function moneyDesk(actor: Actor, month: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const orders = cashOrders(state);
  const lines = buildLedger({
    orders,
    expenses: state.expenses,
    adjusts: state.walletAdjusts ?? [],
  });
  const names = new Map(state.staff.map((person) => [person.id, person.name]));
  const monthLines = lines
    .filter((line) => vnMonth(line.at) === month)
    .map((line) => ({
      ...line,
      holderName: line.holder ? (names.get(line.holder) ?? "Người đã nghỉ") : "",
    }));
  const expenses = state.expenses
    .filter((row) => row.month === month)
    .filter((row) => actor.role !== "sale" || row.by === actor.id)
    .map((row) => ({
      id: row.id,
      name: row.name,
      amount: row.amount,
      note: row.note,
      at: row.at,
      month: row.month,
      category: row.category ?? "",
      wallet: row.wallet ?? "",
      categoryLabel: row.category ? categoryLabel(row.category) : "Chưa phân nhóm",
      walletLabel: walletLabel(row.wallet ?? ""),
      pending: row.approvedAt === null,
      approvedAt: row.approvedAt ?? null,
      by: row.by,
    }))
    .sort((a, b) => b.at.localeCompare(a.at));
  const holders = holderBalances({
    orders,
    expenses: state.expenses,
    staff: state.staff.map((person) => ({ id: person.id, name: person.name })),
    handovers: state.handovers ?? [],
  });
  if (actor.role === "sale") {
    const mine = holders.find((row) => row.staffId === actor.id);
    const myLines = monthLines.filter((line) => line.holder === actor.id);
    return {
      month,
      scope: "mine" as const,
      me: {
        name: actor.name,
        tien_mat: mine?.tien_mat ?? 0,
        chuyen_khoan: mine?.chuyen_khoan ?? 0,
      },
      cards: [],
      holders: mine ? [mine] : [],
      handovers: [],
      lines: myLines,
      expenses,
      report: expenseReport(expenses, month),
      collected: myLines.filter((line) => line.kind === "thu").reduce((sum, line) => sum + line.amount, 0),
    };
  }
  return {
    month,
    scope: "shop" as const,
    me: null,
    cards: walletCards(lines, month),
    holders,
    handovers: (state.handovers ?? []).slice(0, 100).map((row) => ({
      id: row.id,
      at: row.at,
      fromId: row.fromId,
      fromName: names.get(row.fromId) ?? "Người đã nghỉ",
      amount: row.amount,
      note: row.note,
      byName: row.by ? (names.get(row.by) ?? "Người đã nghỉ") : "",
    })),
    lines: monthLines,
    expenses,
    report: expenseReport(state.expenses, month),
    collected: monthLines.filter((line) => line.kind === "thu").reduce((sum, line) => sum + line.amount, 0),
  };
}

export async function collectList(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const orders = cashOrders(state);
  const mine = holderBalances({
    orders,
    expenses: state.expenses,
    staff: [{ id: actor.id, name: actor.name }],
    handovers: state.handovers ?? [],
  }).find((row) => row.staffId === actor.id);
  return {
    me: {
      name: actor.name,
      tien_mat: mine?.tien_mat ?? 0,
      chuyen_khoan: mine?.chuyen_khoan ?? 0,
    },
    rows: ordersToCollect(orders).map((order) => {
      const full = state.orders.find((item) => item.id === order.id);
      return {
        id: order.id,
        code: order.code,
        customerName: order.customerName,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status as keyof typeof STATUS_LABEL] ?? order.status,
        channel: full?.channel ?? "",
        channelLabel: full ? CHANNEL_LABEL[full.channel] : "",
        total: order.total,
        depositPaid: order.depositPaid,
        remain: remainOf(order),
        createdAt: order.createdAt,
      };
    }),
  };
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
  "moHomeLaborPercent",
  "fileRetentionDays",
  "videoRetentionDays",
  "rentFromJune2027",
  "repeatCustomerOrders",
  "remindAfterDays",
] as const;

export async function getSettings(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
    const settings = structuredClone(state.settings);
    delete settings.staffPinHash;
    return {
    settings: { ...settings, staffPinSet: Boolean(state.settings.staffPinHash) },
    audits: state.audits.slice(0, 40).map((item) => ({
      id: item.id,
      at: item.at,
      sentence: describeAudit(item, shopForAudit(state)),
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
      branchId: person.branchId ?? null,
      departmentId: person.departmentId ?? null,
    })),
    branches: sortBySortThenName(state.branches ?? []),
    departments: sortBySortThenName(state.departments ?? []),
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
      (state.settings[key] as number) = key === "moHomeLaborPercent" ? Math.min(100, Math.max(0, number)) : number;
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
    if ("wasteAlertPercent" in patch) {
      const value = patch.wasteAlertPercent;
      if (value === null || value === "") state.settings.wasteAlertPercent = null;
      else {
        const number = Number(value);
        if (!Number.isFinite(number)) throw new Error("Ngưỡng hao hụt không hợp lệ.");
        state.settings.wasteAlertPercent = Math.min(100, Math.max(0, number));
      }
    }
    if (typeof patch.zaloPhone === "string") state.settings.zaloPhone = patch.zaloPhone.replace(/\D/g, "");
    if (typeof patch.showZalo === "boolean") state.settings.showZalo = patch.showZalo;
    if (typeof patch.publicHours === "string") state.settings.publicHours = patch.publicHours;
    if (typeof patch.staffPin === "string" && patch.staffPin.trim()) {
      const pin = patch.staffPin.trim();
      if (!/^\d{4}$/.test(pin)) throw new Error("Mã PIN nhân viên là đúng 4 chữ số.");
      state.settings.staffPinHash = await sha256(`tt-staff-pin:v1:${pin}`);
    }
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
    if ("bank" in patch) {
      const next = cleanBank(patch.bank && typeof patch.bank === "object" ? (patch.bank as { id?: string; account?: string; holder?: string }) : null);
      if (next) state.settings.bank = next;
      else delete state.settings.bank;
    }
    if (patch["sepay"] && typeof patch["sepay"] === "object") {
      const raw = patch["sepay"] as Partial<SePayConfig>;
      const prev = state.settings.sepay ?? defaultSePay();
      state.settings.sepay = {
        enabled: typeof raw.enabled === "boolean" ? raw.enabled : prev.enabled,
        apiKey: typeof raw.apiKey === "string" ? raw.apiKey.trim() : prev.apiKey,
        accountHint: typeof raw.accountHint === "string" ? raw.accountHint.trim() : prev.accountHint,
        webhookPath: typeof raw.webhookPath === "string" && raw.webhookPath.trim() ? raw.webhookPath.trim() : prev.webhookPath || "/api/public/sepay",
        note: typeof raw.note === "string" ? raw.note.trim() : prev.note,
      };
    }
    if (patch["notifyPrefs"] && typeof patch["notifyPrefs"] === "object") {
      const raw = patch["notifyPrefs"] as Partial<NotifyPrefs>;
      const prev = state.settings.notifyPrefs ?? defaultNotifyPrefs();
      state.settings.notifyPrefs = {
        lateOrders: typeof raw.lateOrders === "boolean" ? raw.lateOrders : prev.lateOrders,
        marketplaceNew: typeof raw.marketplaceNew === "boolean" ? raw.marketplaceNew : prev.marketplaceNew,
        feedbackReprint: typeof raw.feedbackReprint === "boolean" ? raw.feedbackReprint : prev.feedbackReprint,
        cashHandover: typeof raw.cashHandover === "boolean" ? raw.cashHandover : prev.cashHandover,
        browserPrompted: typeof raw.browserPrompted === "boolean" ? raw.browserPrompted : prev.browserPrompted,
      };
    }
    if (Array.isArray(patch.shopChannels)) {
      const { normalizeShopChannels } = await import("@/domain/org-desk");
      state.settings.shopChannels = normalizeShopChannels(patch.shopChannels as Settings["shopChannels"]);
    }
    recalcBoms(state);
    audit(state, actor.id, "settings.update", "settings", before, state.settings);
  });
}

export async function saveStaff(
  actor: Actor,
  input: {
    id?: string;
    name: string;
    email: string;
    role: Role;
    password?: string;
    probation?: boolean;
    hiredAt?: string | null;
    active?: boolean;
    branchId?: string | null;
    departmentId?: string | null;
  },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    if (input.password && input.password.trim().length < 8) throw new Error("Mật khẩu cần ít nhất 8 ký tự.");
    if (input.branchId) {
      const ok = (state.branches ?? []).some((branch) => branch.id === input.branchId);
      if (!ok) throw new Error("Chi nhánh không tồn tại.");
    }
    if (input.departmentId) {
      const ok = (state.departments ?? []).some((dept) => dept.id === input.departmentId);
      if (!ok) throw new Error("Bộ phận không tồn tại.");
    }
    if (input.id) {
      const person = state.staff.find((item) => item.id === input.id);
      if (!person) throw new Error("Không thấy tài khoản.");
      const nextActive = input.active === undefined ? person.active : input.active;
      const leavingOwner = person.role === "owner" && person.active && (input.role !== "owner" || !nextActive);
      if (leavingOwner && !state.staff.some((item) => item.id !== person.id && item.active && item.role === "owner")) {
        throw new Error("Cần ít nhất một chủ đang làm.");
      }
      person.name = input.name.trim();
      person.email = input.email.trim().toLowerCase();
      person.role = input.role;
      if (input.probation !== undefined) person.probation = input.probation;
      if (input.hiredAt !== undefined) person.hiredAt = input.hiredAt;
      if (input.active !== undefined) person.active = input.active;
      if (input.branchId !== undefined) person.branchId = input.branchId;
      if (input.departmentId !== undefined) person.departmentId = input.departmentId;
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
      branchId: input.branchId ?? null,
      departmentId: input.departmentId ?? null,
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
      file.deletedAt = new Date(now).toISOString();
      if (!bytesStillShared(state, file)) await removePhoto(file);
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
      if (!bytesStillShared(state, file)) await removePhoto(file);
      audit(state, actor.id, "file.delete", file.id, { name: file.name }, { deletedAt: file.deletedAt });
      return;
    }
    throw new Error("Không thấy file.");
  });
}

export async function fileForStaff(
  actor: Actor,
  fileId: string,
  preview: 480 | 1600 | null = null,
): Promise<{ name: string; mime: string; bytes?: Uint8Array; redirect?: string }> {
  const state = await readState();
  const pools = [
    ...state.orders.map((order) => order.files),
    ...(state.albums ?? []).map((album) => album.files),
    ...(state.tasks ?? []).map((task) => task.files),
    ...(state.taskChecks ?? []).map((task) => task.files),
    state.wastePhotos ?? [],
  ];
  for (const files of pools) {
    const file = files.find((item) => item.id === fileId && !item.deletedAt);
    if (!file) continue;
    if (preview && !imagePreviewable(file.name, file.mime)) throw new Error("Không phải ảnh.");
    if (file.storage === "drive" && file.driveFileId && preview) {
      const photo = await downloadDriveThumbnail(file.driveFileId, preview);
      return { name: file.name, mime: photo.mime, bytes: photo.bytes };
    }
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
        ["Hao hụt", report.wasteCost],
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
      const prices = Object.fromEntries(
        CHANNELS.map((channel) => [channel, priceOf(state.prices, sku.id, channel)?.price ?? null]),
      ) as Record<(typeof CHANNELS)[number], number | null>;
      return {
        id: sku.id,
        code: sku.code,
        name: sku.name,
        groupName: group?.name ?? "",
        label: `${sku.code} · ${group?.name ?? ""} · ${sku.name}`,
        groupId: sku.groupId,
        size: sku.size,
        soldOn: sku.soldOn && sku.soldOn.length > 0 ? sku.soldOn : (["tai_tiem", "facebook", "tiktok", "shopee"] as Channel[]),
        prices,
        price: prices.tai_tiem,
      };
    }),
  );
}

export async function recalc(actor: Actor) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => recalcBoms(state));
}

function shopForAudit(state: ShopState): AuditShop {
  return {
    staff: state.staff,
    orders: state.orders,
    materials: state.materials,
    skus: state.skus,
    customers: state.customers,
    groups: state.groups,
    boms: state.boms,
    punches: state.punches,
    fixedCosts: state.settings.fixedCosts ?? [],
  };
}

export async function listAudits(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const shop = shopForAudit(state);
  return state.audits.slice(0, 200).map((item) => ({
    id: item.id,
    at: item.at,
    day: auditDay(item.at),
    action: item.action,
    actionLabel: auditActionLabel(item.action),
    actorId: item.actorId,
    actorName: item.actorId ? (state.staff.find((person) => person.id === item.actorId)?.name ?? "Người đã nghỉ") : "Hệ thống",
    sentence: describeAudit(item, shop),
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

async function commitMarketplaceOrders(actor: Actor, channel: MarketplaceChannel, orders: PlannedOrder[], note: string) {
  if (!orders.length) return [];
  return mutate(async (state) => {
    const made: string[] = [];
    for (const planned of orders) {
      const taken = state.orders.some(
        (order) =>
          (order.channel === channel && order.marketplaceCode === planned.platformOrderId) ||
          order.idempotencyKey === `${channel}:${planned.platformOrderId}`,
      );
      if (taken) continue;
      const customer = upsertCustomer(state, {
        name: planned.buyer,
        phone: planned.phone,
        address: planned.address,
        platformBuyer: planned.platformBuyer,
        fromMarketplace: true,
      });
      const items = marketplaceItems(state, channel, planned.items);
      const totals = sumItems(items);
      const notes = [note, ...planned.flags];
      const order: Order = {
        id: nid(),
      code: nextCode(state, channel),
      channel,
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
          carrier: planned.carrier.trim() || defaultCarrier({ channel, source: "manual", fulfillment: "delivery" }),
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
        idempotencyKey: `${channel}:${planned.platformOrderId}`,
        createdAt: planned.createdAt ?? nowIso(),
        updatedAt: nowIso(),
        completedAt: null,
        files: [],
        history: [{ at: nowIso(), from: null, to: "nhan_don", by: actor.id, note }],
      };
      refreshDeposit(state, order);
      state.orders.unshift(order);
      audit(state, actor.id, "order.import", order.id, null, {
        code: order.code,
        platform: planned.platformOrderId,
        channel,
      });
      made.push(order.code);
    }
    return made;
  });
}

export async function importMarketplaceFile(
  actor: Actor,
  input: { channel: MarketplaceChannel; filename: string; base64: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const preview = await marketplacePlan(await readState(), input.channel, input.filename, input.base64);
  const codes = await commitMarketplaceOrders(actor, input.channel, preview.orders, "Nhập từ file sàn");
  return { codes, issues: preview.issues, duplicates: preview.duplicates, cancelled: preview.cancelled };
}

export async function importMarketplaceOrders(actor: Actor, channel: MarketplaceChannel, lines: ParsedLine[]) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const maps = (state.skuMaps ?? []).filter((row) => row.channel === channel);
  const existingIds = state.orders.filter((order) => order.channel === channel && order.marketplaceCode).map((order) => order.marketplaceCode);
  const plan = planMarketplaceImport({ lines, maps, existingIds });
  const codes = await commitMarketplaceOrders(actor, channel, plan.orders, "Đổ từ API sàn");
  return {
    codes,
    issues: plan.issues.slice(0, 30),
    issueCount: plan.issues.length,
    duplicates: plan.duplicates.slice(0, 30),
    duplicateCount: plan.duplicates.length,
    cancelled: plan.cancelled,
  };
}

export async function importShelf(actor: Actor, offers: ShelfOffer[]) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => {
    if (!state.skuMaps) state.skuMaps = [];
    const result = applyShelfOffers(
      { groups: state.groups, skus: state.skus, prices: state.prices, skuMaps: state.skuMaps },
      offers,
    );
    audit(state, actor.id, "catalog.sync", offers[0]?.channel ?? "san", null, {
      created: result.created,
      priced: result.priced,
      mapped: result.mapped,
      skipped: result.skipped.length,
    });
    return { created: result.created, priced: result.priced, mapped: result.mapped, skipped: result.skipped.slice(0, 8) };
  });
}

export async function cloneShelfPrices(
  actor: Actor,
  input: { groupId: string; from: "tiktok" | "shopee"; to: "tai_tiem" | "facebook"; overwrite: boolean },
) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => {
    const result = cloneChannelPrices(state, input);
    audit(state, actor.id, "catalog.clone", input.groupId, null, { ...input, ...result });
    return result;
  });
}

export async function marketplaceSyncStatus(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const { parseShopeeLink, parseTiktokLink } = await import("@/domain/marketplace-api");
  const { readIntegrationSecret } = await import("@/server/secrets");
  const tiktok = parseTiktokLink(await readIntegrationSecret("tiktok_shop"));
  const shopee = parseShopeeLink(await readIntegrationSecret("shopee_shop"));
  return { tiktok: Boolean(tiktok), shopee: Boolean(shopee) };
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
  input: {
    orderId: string;
    carrier: string;
    tracking: string;
    shipFee: number | null;
    codAmount: number | null;
    customerShip?: number | null;
  },
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === input.orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(order);
    const tracking = input.tracking.trim();
    const customerShip = input.customerShip === undefined ? previous.customerShip ?? null : input.customerShip;
    const due = amountDue({ ...order, shipping: { ...previous, customerShip } });
    if (input.codAmount !== null && due !== null && input.codAmount > due + 0.5) {
      throw new Error("Tiền thu hộ không được cao hơn số còn lại.");
    }
    order.shipping = {
      carrier: input.carrier.trim(),
      tracking,
      shipFee: input.shipFee,
      codAmount: input.codAmount,
      customerShip,
      codReceivedAt: previous.codReceivedAt,
      ...(previous.codWalletId ? { codWalletId: previous.codWalletId } : {}),
      ...(tracking === previous.tracking && previous.carrierStatus ? { carrierStatus: previous.carrierStatus } : {}),
    };
    audit(state, actor.id, "order.shipping", order.id, previous, order.shipping);
  });
}

export async function carrierDesk(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const status = await integrationStatus();
  const state = await readState();
  return {
    ghn: Boolean(status.ghn_token && status.ghn_shop_id),
    ghtk: Boolean(status.ghtk_token && status.ghtk_partner),
    jt: Boolean(status.jt_api_account && status.jt_private_key && status.jt_customer_code && status.jt_password),
    pickup: readPickup(state.settings.carrierPickup),
  };
}

export async function saveCarrierPickup(
  actor: Actor,
  input: { name: string; phone: string; address: string; province: string; district: string; ward: string },
) {
  assertRole(actor, ["owner"]);
  const pickup = readPickup(input);
  if (!pickupReady(pickup)) throw new Error("Địa chỉ lấy hàng cần tên, số điện thoại, địa chỉ, tỉnh và phường.");
  await mutate(async (state) => {
    state.settings.carrierPickup = pickup;
    audit(state, actor.id, "settings.pickup", "carrier", null, { name: pickup.name, province: pickup.province });
  });
}

export async function openCarrierWaybill(
  actor: Actor,
  input: {
    orderId: string;
    carrier: CarrierId;
    province: string;
    district: string;
    ward: string;
    address: string;
    weightGrams: number;
    codAmount: number;
  },
) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const order = state.orders.find((item) => item.id === input.orderId);
  if (!order) throw new Error("Không tìm thấy đơn.");
  const blocked = waybillBlock({
    channel: order.channel,
    status: order.status,
    fulfillment: order.fulfillment,
    tracking: orderShipping(order).tracking,
  });
  if (blocked) throw new Error(blocked);
  const pickup = readPickup(state.settings.carrierPickup);
  if (!pickupReady(pickup)) throw new Error("Chủ cần ghi địa chỉ lấy hàng ở trang Kết nối.");
  const draft = waybillDraft(order, customerName(state, order.customerId), input);
  const hit =
    input.carrier === "ghn"
      ? await createGhnWaybill(await loadGhn(), pickup, draft)
      : input.carrier === "ghtk"
        ? await createGhtkWaybill(await loadGhtk(), pickup, draft)
        : await createJtWaybill(await loadJt(), pickup, draft);
  await mutate(async (next) => {
    const fresh = next.orders.find((item) => item.id === order.id);
    if (!fresh) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(fresh);
    if (previous.tracking && previous.tracking !== hit.tracking) throw new Error("Đơn vừa được ghi mã vận đơn khác.");
    fresh.shipping = {
      carrier: CARRIER_NAME[input.carrier],
      tracking: hit.tracking,
      shipFee: hit.fee === null ? previous.shipFee : hit.fee,
      codAmount: draft.cod,
      codReceivedAt: previous.codReceivedAt,
      carrierStatus: hit.status.slice(0, 160),
    };
    fresh.updatedAt = nowIso();
    audit(next, actor.id, "order.shipping", fresh.id, previous, fresh.shipping);
  });
  return { tracking: hit.tracking, fee: hit.fee, status: hit.status };
}

export async function quoteCarrierFee(
  actor: Actor,
  input: {
    orderId: string;
    carrier: CarrierId;
    province: string;
    district: string;
    ward: string;
    address: string;
    weightGrams: number;
    codAmount: number;
  },
) {
  assertRole(actor, ["owner", "sale"]);
  if (input.carrier !== "ghtk") throw new Error("Chỉ GHTK báo phí trước khi tạo vận đơn.");
  const state = await readState();
  const order = state.orders.find((item) => item.id === input.orderId);
  if (!order) throw new Error("Không tìm thấy đơn.");
  if (order.channel === "tiktok" || order.channel === "shopee") throw new Error("Đơn sàn lấy phí từ sàn.");
  if (!shipsOut(order)) throw new Error("Đơn này không giao đi.");
  const pickup = readPickup(state.settings.carrierPickup);
  if (!pickupReady(pickup)) throw new Error("Chủ cần ghi địa chỉ lấy hàng ở trang Kết nối.");
  const draft = waybillDraft(order, customerName(state, order.customerId), input);
  const fee = await quoteGhtkFee(await loadGhtk(), pickup, draft);
  return { fee };
}

export async function refreshCarrierWaybill(actor: Actor, orderId: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const order = state.orders.find((item) => item.id === orderId);
  if (!order) throw new Error("Không tìm thấy đơn.");
  const ship = orderShipping(order);
  const carrier = carrierIdFromName(ship.carrier);
  if (!carrier) throw new Error("Hãng này chưa có API trạng thái.");
  if (!ship.tracking) throw new Error("Đơn chưa có mã vận đơn.");
  const hit =
    carrier === "ghn"
      ? await trackGhn(await loadGhn(), ship.tracking)
      : carrier === "ghtk"
        ? await trackGhtk(await loadGhtk(), ship.tracking)
        : await trackJt(await loadJt(), ship.tracking);
  const status = (hit.status || "Chưa có trạng thái").slice(0, 160);
  await mutate(async (next) => {
    const fresh = next.orders.find((item) => item.id === order.id);
    if (!fresh) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(fresh);
    fresh.shipping = { ...previous, carrierStatus: status };
    fresh.updatedAt = nowIso();
    audit(next, actor.id, "order.shipping", fresh.id, previous, fresh.shipping);
  });
  return { status };
}

async function loadGhn() {
  const auth = ghnAuth(await readIntegrationSecret("ghn_token"), await readIntegrationSecret("ghn_shop_id"));
  if (!auth) throw new Error("Chưa lưu đủ khóa GHN.");
  return auth;
}

async function loadGhtk() {
  const auth = ghtkAuth(await readIntegrationSecret("ghtk_token"), await readIntegrationSecret("ghtk_partner"));
  if (!auth) throw new Error("Chưa lưu đủ khóa GHTK.");
  return auth;
}

async function loadJt() {
  const auth = jtAuth({
    apiAccount: await readIntegrationSecret("jt_api_account"),
    privateKey: await readIntegrationSecret("jt_private_key"),
    customerCode: await readIntegrationSecret("jt_customer_code"),
    password: await readIntegrationSecret("jt_password"),
  });
  if (!auth) throw new Error("Chưa lưu đủ khóa J&T.");
  return auth;
}

function waybillDraft(
  order: Order,
  customer: { name: string; phone: string },
  input: { province: string; district: string; ward: string; address: string; weightGrams: number; codAmount: number },
): WaybillDraft {
  const name = (order.recipientName || customer.name).trim();
  if (name.length < 2) throw new Error("Đơn chưa có tên người nhận.");
  const phone = customer.phone.trim();
  if (phone.startsWith("masked:") || phone.replace(/\D/g, "").length < 8) throw new Error("Đơn chưa có số điện thoại người nhận.");
  const address = (input.address || order.address).trim();
  if (address.length < 4) throw new Error("Đơn chưa có địa chỉ giao.");
  if (input.province.trim().length < 2 || input.ward.trim().length < 2) throw new Error("Cần tỉnh/thành và phường/xã.");
  const items = order.items.map((item) => ({ name: item.name, quantity: item.quantity }));
  return {
    code: order.code,
    name: name.slice(0, 120),
    phone,
    address: address.slice(0, 500),
    province: input.province.trim().slice(0, 80),
    district: input.district.trim().slice(0, 80),
    ward: input.ward.trim().slice(0, 80),
    weightGrams: clampWeight(input.weightGrams),
    cod: clampCod(input.codAmount),
    value: Math.max(0, Math.round(order.total ?? 0)),
    content: items.map((item) => `${item.quantity}× ${item.name}`).join(", ").slice(0, 500) || "Ảnh in",
    note: order.customerNote,
    items,
  };
}

export async function markCodReceived(actor: Actor, orderId: string, received: boolean) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const order = state.orders.find((item) => item.id === orderId);
    if (!order) throw new Error("Không tìm thấy đơn.");
    const previous = orderShipping(order);
    if (received && (order.status === "huy" || order.isTest)) throw new Error("Đơn hủy hoặc đơn thử không ghi nhận COD.");
    if (received) {
      if (!previous.codWalletId) {
        const net = Math.round((previous.codAmount ?? 0) - (previous.shipFee ?? 0));
        if (net !== 0) {
          const id = nid();
          state.walletAdjusts = state.walletAdjusts ?? [];
          state.walletAdjusts.push({
            id,
            at: nowIso(),
            wallet: "chuyen_khoan",
            amount: net,
            note: `COD ${order.code} sau trừ phí ship`,
            by: actor.id,
          });
          previous.codWalletId = id;
        }
      }
      order.shipping = { ...previous, codReceivedAt: previous.codReceivedAt ?? nowIso() };
    } else {
      if (previous.codWalletId) {
        state.walletAdjusts = (state.walletAdjusts ?? []).filter((row) => row.id !== previous.codWalletId);
      }
      order.shipping = { ...previous, codReceivedAt: null, codWalletId: null };
    }
    audit(state, actor.id, "order.cod", order.id, { codReceivedAt: previous.codReceivedAt }, { received });
  });
}

export async function deliveryBoard(actor: Actor) {
  const state = await readState();
  const money = actor.role !== "production";
  return state.orders.filter(onDeliveryDesk).map((order) => {
    const customer = customerName(state, order.customerId);
    const ship = orderShipping(order);
    return {
      id: order.id,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status],
      channel: order.channel,
      channelLabel: CHANNEL_LABEL[order.channel],
      fulfillment: order.fulfillment,
      customerName: customer.name,
      recipientName: order.recipientName ?? "",
      phone: customer.phone,
      address: order.address,
      itemSummary: order.items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
      carrier: ship.carrier,
      tracking: ship.tracking,
      carrierStatus: ship.carrierStatus ?? "",
      shipFee: money ? ship.shipFee : null,
      codAmount: money ? ship.codAmount : null,
      codNet: money ? Math.round((ship.codAmount ?? 0) - (ship.shipFee ?? 0)) : null,
      codReceivedAt: money ? ship.codReceivedAt : null,
      canLabel: order.channel === "tai_tiem" || order.channel === "facebook",
    };
  });
}

export async function codBoard(actor: Actor, month: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const rows = state.orders
    .filter((order) => vnMonth(order.createdAt) === month && order.status !== "huy" && !order.isTest)
    .map((order) => ({ order, ship: orderShipping(order) }))
    .filter((row) => (row.ship.codAmount ?? 0) > 0);
  const byCarrier = new Map<string, { carrier: string; orders: number; expected: number; received: number }>();
  const lines = rows.map(({ order, ship }) => {
    const carrier = ship.carrier || "Chưa ghi hãng";
    const expected = codExpected(order);
    const bucket = byCarrier.get(carrier) ?? { carrier, orders: 0, expected: 0, received: 0 };
    bucket.orders += 1;
    bucket.expected += expected;
    if (ship.codReceivedAt) bucket.received += Math.round((ship.codAmount ?? 0) - (ship.shipFee ?? 0));
    byCarrier.set(carrier, bucket);
    const customer = customerName(state, order.customerId);
    return {
      id: order.id,
      code: order.code,
      carrier,
      customerName: customer.name,
      codAmount: ship.codAmount,
      expected,
      shipFee: ship.shipFee,
      net: Math.round((ship.codAmount ?? 0) - (ship.shipFee ?? 0)),
      over: expected < (ship.codAmount ?? 0),
      tracking: ship.tracking,
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

export async function listWebProducts(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return state.groups
    .slice()
    .sort((a, b) => a.sort - b.sort)
    .map((group) => {
      const skus = state.skus.filter((sku) => sku.groupId === group.id && !isMergedWoodAlias(sku));
      const prices = skus
        .map((sku) => priceOf(state.prices, sku.id, "tai_tiem")?.price)
        .filter((price): price is number => typeof price === "number");
      return {
        id: group.id,
        name: group.name,
        slug: group.slug,
        category: group.category,
        description: group.description,
        listed: groupIsListed(state.settings, group),
        variants: skus.length,
        from: prices.length ? Math.min(...prices) : null,
      };
    });
}

export async function createWebProduct(actor: Actor, input: WebProductInput) {
  assertRole(actor, ["owner"]);
  return mutate(async (state) => {
    const built = buildWebProduct(input, {
      slugs: state.groups.map((group) => group.slug),
      ids: state.groups.map((group) => group.id),
      codes: state.skus.map((sku) => sku.code),
      sorts: state.groups.map((group) => group.sort),
    });
    state.groups.push(built.group);
    state.skus.push(...built.skus);
    state.prices.push(...built.prices);
    state.settings.groupListed = { ...state.settings.groupListed, [built.group.id]: true };
    audit(state, actor.id, "product.create", built.group.id, null, {
      name: built.group.name,
      slug: built.group.slug,
      sizes: built.skus.length,
    });
    return { id: built.group.id, slug: built.group.slug, name: built.group.name };
  });
}

export async function setWebProductListed(actor: Actor, groupId: string, listed: boolean) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const group = state.groups.find((item) => item.id === groupId);
    if (!group) throw new Error("Không thấy sản phẩm.");
    if (listed && group.gate === "anh_the") state.settings.showAnhThe = true;
    if (listed && group.gate === "album") state.settings.showAlbum = true;
    state.settings.groupListed = { ...state.settings.groupListed, [group.id]: listed };
    audit(state, actor.id, "product.list", group.id, null, { name: group.name, listed });
  });
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

/* ── Org desk: chi nhánh / bộ phận / nhóm quyền / TB / tài liệu / feedback ── */

export async function listOrg(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return {
    branches: sortBySortThenName(state.branches ?? []),
    departments: sortBySortThenName(state.departments ?? []),
    roleModules: (state.roleModules ?? DEFAULT_ROLE_MODULES).map((row) => ({
      role: row.role,
      label: ROLE_LABEL[row.role],
      modules: [...row.modules],
    })),
    staff: state.staff.map((person) => ({
      id: person.id,
      name: person.name,
      role: person.role,
      branchId: person.branchId ?? null,
      departmentId: person.departmentId ?? null,
      active: person.active,
    })),
  };
}

export async function saveBranch(
  actor: Actor,
  input: { id?: string; name: string; address?: string; phone?: string; active?: boolean; sort?: number },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Tên cửa hàng cần ít nhất 2 ký tự.");
    if (!state.branches) state.branches = [];
    if (input.id) {
      const row = state.branches.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy cửa hàng.");
      row.name = name;
      if (input.address !== undefined) row.address = input.address.trim();
      if (input.phone !== undefined) row.phone = input.phone.replace(/\D/g, "");
      if (input.active !== undefined) row.active = input.active;
      if (input.sort !== undefined) row.sort = input.sort;
      audit(state, actor.id, "branch.update", row.id, null, { name: row.name });
      return;
    }
    const row: Branch = {
      id: nid(),
      name,
      address: (input.address ?? "").trim(),
      phone: (input.phone ?? "").replace(/\D/g, ""),
      active: input.active !== false,
      sort: input.sort ?? state.branches.length,
    };
    state.branches.push(row);
    audit(state, actor.id, "branch.create", row.id, null, { name: row.name });
  });
}

export async function removeBranch(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.branches ?? [];
    if (list.length <= 1) throw new Error("Cần giữ ít nhất một cửa hàng.");
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy cửa hàng.");
    const [removed] = list.splice(at, 1);
    for (const person of state.staff) {
      if (person.branchId === id) person.branchId = null;
    }
    audit(state, actor.id, "branch.remove", id, removed, null);
  });
}

export async function saveDepartment(
  actor: Actor,
  input: { id?: string; name: string; note?: string; active?: boolean; sort?: number },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Tên bộ phận cần ít nhất 2 ký tự.");
    if (!state.departments) state.departments = [];
    if (input.id) {
      const row = state.departments.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy bộ phận.");
      row.name = name;
      if (input.note !== undefined) row.note = input.note.trim();
      if (input.active !== undefined) row.active = input.active;
      if (input.sort !== undefined) row.sort = input.sort;
      audit(state, actor.id, "department.update", row.id, null, { name: row.name });
      return;
    }
    const row: Department = {
      id: nid(),
      name,
      note: (input.note ?? "").trim(),
      active: input.active !== false,
      sort: input.sort ?? state.departments.length,
    };
    state.departments.push(row);
    audit(state, actor.id, "department.create", row.id, null, { name: row.name });
  });
}

export async function removeDepartment(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.departments ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy bộ phận.");
    const [removed] = list.splice(at, 1);
    for (const person of state.staff) {
      if (person.departmentId === id) person.departmentId = null;
    }
    audit(state, actor.id, "department.remove", id, removed, null);
  });
}

export async function saveRoleModules(actor: Actor, rows: RoleModules[]) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const next: RoleModules[] = [];
    for (const role of ["owner", "sale", "production"] as Role[]) {
      const found = rows.find((row) => row.role === role);
      const modules = (found?.modules ?? DEFAULT_ROLE_MODULES.find((row) => row.role === role)?.modules ?? [])
        .map((path) => path.trim())
        .filter((path) => path.startsWith("/admin"));
      if (modules.length === 0) throw new Error(`Nhóm ${ROLE_LABEL[role]} cần ít nhất một module.`);
      next.push({ role, modules: [...new Set(modules)] });
    }
    state.roleModules = next;
    audit(state, actor.id, "roleModules.update", "roleModules", null, next);
  });
}

export async function listAnnouncements(actor: Actor) {
  assertRole(actor, ["owner", "sale", "production"]);
  const state = await readState();
  const rows = (state.announcements ?? []).slice().sort((a, b) => {
    if (Boolean(a.pinned) !== Boolean(b.pinned)) return a.pinned ? -1 : 1;
    return b.at.localeCompare(a.at);
  });
  return { announcements: rows };
}

export async function saveAnnouncement(
  actor: Actor,
  input: { id?: string; title: string; body: string; pinned?: boolean },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 2) throw new Error("Tiêu đề cần ít nhất 2 ký tự.");
    if (!state.announcements) state.announcements = [];
    if (input.id) {
      const row = state.announcements.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy thông báo.");
      row.title = title;
      row.body = body;
      if (input.pinned !== undefined) row.pinned = input.pinned;
      audit(state, actor.id, "announcement.update", row.id, null, { title });
      return;
    }
    const row: Announcement = {
      id: nid(),
      title,
      body,
      at: nowIso(),
      by: actor.id,
      pinned: Boolean(input.pinned),
    };
    state.announcements.unshift(row);
    audit(state, actor.id, "announcement.create", row.id, null, { title });
  });
}

export async function removeAnnouncement(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.announcements ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy thông báo.");
    const [removed] = list.splice(at, 1);
    audit(state, actor.id, "announcement.remove", id, removed, null);
  });
}

export async function listDocuments(actor: Actor) {
  assertRole(actor, ["owner", "sale", "production"]);
  const state = await readState();
  const rows = (state.documents ?? []).slice().sort((a, b) => b.at.localeCompare(a.at));
  return { documents: rows };
}

export async function saveDocument(
  actor: Actor,
  input: { id?: string; title: string; body?: string; url?: string },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const title = input.title.trim();
    if (title.length < 2) throw new Error("Tiêu đề cần ít nhất 2 ký tự.");
    if (!state.documents) state.documents = [];
    if (input.id) {
      const row = state.documents.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy tài liệu.");
      row.title = title;
      if (input.body !== undefined) row.body = input.body.trim();
      if (input.url !== undefined) row.url = input.url.trim();
      audit(state, actor.id, "document.update", row.id, null, { title });
      return;
    }
    const row: ShopDocument = {
      id: nid(),
      title,
      body: (input.body ?? "").trim(),
      url: (input.url ?? "").trim(),
      at: nowIso(),
      by: actor.id,
    };
    state.documents.unshift(row);
    audit(state, actor.id, "document.create", row.id, null, { title });
  });
}

export async function removeDocument(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.documents ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy tài liệu.");
    const [removed] = list.splice(at, 1);
    audit(state, actor.id, "document.remove", id, removed, null);
  });
}

export async function listOrderFeedback(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const rows = state.orders
    .filter((order) => order.feedback)
    .map((order) => {
      const customer = customerName(state, order.customerId);
      return {
        code: order.code,
        status: order.status,
        statusLabel: STATUS_LABEL[order.status],
        customerName: customer.name,
        at: order.feedback!.at,
        answer: order.feedback!.answer,
        answerLabel: feedbackLabel(order.feedback!.answer),
        note: order.feedback!.note,
        opensReprint: feedbackOpensReprint(order.feedback!.answer),
      };
    })
    .sort((a, b) => b.at.localeCompare(a.at));
  return { feedback: rows };
}

export async function getTargets(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const month = vnParts().month;
  const target = kpiTarget(state.settings.shopOpenDate, month, state.settings.kpiTargets);
  return {
    shopOpenDate: state.settings.shopOpenDate,
    month,
    currentTarget: target,
    kpiTargets: [...state.settings.kpiTargets],
    labels: ["Tháng mở cửa", "Tháng 2", "Tháng 3", "Từ tháng 4"],
  };
}

export async function getSePayConfig(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  const sepay = state.settings.sepay ?? defaultSePay();
  return {
    sepay,
    bank: state.settings.bank ?? null,
  };
}

/* ── Extend: chiến dịch / tin mẫu / thông báo prefs / gói ── */

export async function listCampaigns(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const campaigns = sortBySortThenName(state.campaigns ?? []);
  return {
    campaigns: campaigns.map((row) => ({
      ...row,
      orderCount: state.orders.filter((order) => order.campaignId === row.id).length,
      customerCount: state.customers.filter((customer) => customer.campaignId === row.id).length,
    })),
  };
}

export async function saveCampaign(
  actor: Actor,
  input: { id?: string; name: string; note?: string; active?: boolean; sort?: number },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Tên chiến dịch cần ít nhất 2 ký tự.");
    if (!state.campaigns) state.campaigns = [];
    if (input.id) {
      const row = state.campaigns.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy chiến dịch.");
      row.name = name;
      if (input.note !== undefined) row.note = input.note.trim();
      if (input.active !== undefined) row.active = input.active;
      if (input.sort !== undefined) row.sort = input.sort;
      audit(state, actor.id, "campaign.update", row.id, null, { name });
      return;
    }
    const row: Campaign = {
      id: nid(),
      name,
      note: (input.note ?? "").trim(),
      active: input.active !== false,
      sort: input.sort ?? state.campaigns.length,
      createdAt: nowIso(),
    };
    state.campaigns.push(row);
    audit(state, actor.id, "campaign.create", row.id, null, { name });
  });
}

export async function removeCampaign(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.campaigns ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy chiến dịch.");
    const [removed] = list.splice(at, 1);
    for (const order of state.orders) {
      if (order.campaignId === id) order.campaignId = null;
    }
    for (const customer of state.customers) {
      if (customer.campaignId === id) customer.campaignId = null;
    }
    audit(state, actor.id, "campaign.remove", id, removed, null);
  });
}

export async function listMessageTemplates(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  const rows = (state.messageTemplates ?? []).slice().sort((a, b) => a.title.localeCompare(b.title, "vi"));
  return { templates: rows };
}

export async function saveMessageTemplate(
  actor: Actor,
  input: { id?: string; title: string; body: string; kind: MessageTemplateKind },
) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const title = input.title.trim();
    const body = input.body.trim();
    if (title.length < 2) throw new Error("Tiêu đề cần ít nhất 2 ký tự.");
    if (!body) throw new Error("Nội dung tin mẫu trống.");
    if (!MESSAGE_TEMPLATE_KINDS.includes(input.kind)) throw new Error("Loại tin không hợp lệ.");
    if (!state.messageTemplates) state.messageTemplates = [];
    if (input.id) {
      const row = state.messageTemplates.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy tin mẫu.");
      row.title = title;
      row.body = body;
      row.kind = input.kind;
      row.updatedAt = nowIso();
      audit(state, actor.id, "template.update", row.id, null, { title });
      return;
    }
    const row: MessageTemplate = {
      id: nid(),
      title,
      body,
      kind: input.kind,
      updatedAt: nowIso(),
    };
    state.messageTemplates.unshift(row);
    audit(state, actor.id, "template.create", row.id, null, { title });
  });
}

export async function removeMessageTemplate(actor: Actor, id: string) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    const list = state.messageTemplates ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy tin mẫu.");
    const [removed] = list.splice(at, 1);
    audit(state, actor.id, "template.remove", id, removed, null);
  });
}

function ensureChatCollections(state: ShopState) {
  if (!state.chatConversations) state.chatConversations = [];
  if (!state.chatMessages) state.chatMessages = [];
}

export async function listShopConversations(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  ensureChatCollections(state);
  const rows = state.chatConversations!
    .slice()
    .sort((a, b) => String(b.lastMessageAt || b.updatedAt).localeCompare(String(a.lastMessageAt || a.updatedAt)));
  return { conversations: rows };
}

export async function listShopChatMessages(actor: Actor, conversationId: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  ensureChatCollections(state);
  const conversation = state.chatConversations!.find((item) => item.id === conversationId);
  if (!conversation) throw new Error("Không thấy hội thoại.");
  const messages = state
    .chatMessages!.filter((item) => item.conversationId === conversationId)
    .slice()
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  await mutate(async (draft) => {
    ensureChatCollections(draft);
    const row = draft.chatConversations!.find((item) => item.id === conversationId);
    if (row && row.unreadCount > 0) {
      row.unreadCount = 0;
      row.updatedAt = nowIso();
    }
  });
  const phones = messages
    .map((item) => extractVietnamPhone(item.content))
    .filter((item): item is string => Boolean(item));
  return {
    messages,
    suggestedPhone: conversation.customerPhone || phones[phones.length - 1] || null,
  };
}

export async function sendShopChatMessage(
  actor: Actor,
  input: { conversationId: string; content: string; externalCommentId?: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const content = input.content.trim();
  if (!content) throw new Error("Tin nhắn trống.");
  const state = await readState();
  ensureChatCollections(state);
  const conversation = state.chatConversations!.find((item) => item.id === input.conversationId);
  if (!conversation) throw new Error("Không thấy hội thoại.");

  // Messenger: gửi thẳng Graph API tới PSID của page Thiên Thiên (không qua StudioBase inbox).
  if (conversation.channel === "messenger" && conversation.externalUserId) {
    const { readMetaPageLink, sendMetaMessengerText } = await import("@/server/meta-messenger");
    const link = await readMetaPageLink();
    if (!link?.pageToken) throw new Error("Chưa nối Fanpage — vào Kết nối lưu Page token của page Nhà In.");
    await sendMetaMessengerText(link.pageToken, conversation.externalUserId, content);
  }

  await mutate(async (draft) => {
    ensureChatCollections(draft);
    const row = draft.chatConversations!.find((item) => item.id === input.conversationId);
    if (!row) throw new Error("Không thấy hội thoại.");
    const at = nowIso();
    const message: ShopChatMessage = {
      id: nid(),
      conversationId: row.id,
      direction: "outbound",
      content,
      contentType: "text",
      mediaUrl: null,
      externalCommentId: input.externalCommentId ?? null,
      createdAt: at,
      byStaffId: actor.id,
    };
    draft.chatMessages!.push(message);
    row.lastMessageAt = at;
    row.lastMessagePreview = content.slice(0, 160);
    row.updatedAt = at;
    const phone = extractVietnamPhone(content);
    if (phone && !row.customerPhone) row.customerPhone = phone;
    audit(draft, actor.id, "chat.send", row.id, null, { preview: content.slice(0, 80) });
  });
  return { ok: true as const };
}

export async function connectMetaPage(
  actor: Actor,
  input: { pageToken: string; verifyToken?: string; pageName?: string },
) {
  assertRole(actor, ["owner"]);
  const token = input.pageToken.trim();
  if (token.length < 20) throw new Error("Page access token quá ngắn.");
  const { fetchMetaPageProfile } = await import("@/server/meta-messenger");
  const profile = await fetchMetaPageProfile(token);
  const link = {
    pageId: profile.id,
    pageName: input.pageName?.trim() || profile.name,
    pageToken: token,
    verifyToken: (input.verifyToken || "").trim() || `tt-${nid().slice(0, 12)}`,
    connectedAt: nowIso(),
  };
  const { saveIntegrationSecret } = await import("@/server/secrets");
  await saveIntegrationSecret("meta_page", JSON.stringify(link));
  await saveIntegrationSecret("meta", token);
  await mutate(async (state) => {
    audit(state, actor.id, "meta_page.connect", link.pageId, null, { name: link.pageName });
  });
  return { pageId: link.pageId, pageName: link.pageName, verifyToken: link.verifyToken };
}

export async function disconnectMetaPage(actor: Actor) {
  assertRole(actor, ["owner"]);
  const { saveIntegrationSecret } = await import("@/server/secrets");
  await saveIntegrationSecret("meta_page", "");
  await saveIntegrationSecret("meta", "");
  return { ok: true as const };
}

export async function metaPageStatus(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const { readMetaPageLink } = await import("@/server/meta-messenger");
  const { resolveMetaAppCredentials, readMetaPendingPages } = await import("@/server/meta-oauth");
  const link = await readMetaPageLink();
  const creds = await resolveMetaAppCredentials();
  const pending = actor.role === "owner" ? await readMetaPendingPages() : [];
  return {
    connected: Boolean(link?.pageToken),
    pageId: link?.pageId || null,
    pageName: link?.pageName || null,
    hasVerifyToken: Boolean(link?.verifyToken),
    /** Có đủ App ID + Secret (env hoặc đã lưu) để mở OAuth Facebook. */
    oauthReady: Boolean(creds.appId && creds.appSecret),
    metaAppIdSaved: Boolean(creds.appId),
    metaAppSecretSaved: Boolean(creds.appSecret),
    appFromEnv: creds.source === "env",
    pendingPages: pending.map((page) => ({ id: page.id, name: page.name })),
  };
}

export async function chooseMetaOauthPage(actor: Actor, pageId: string) {
  assertRole(actor, ["owner"]);
  const { readMetaPendingPages, clearMetaPendingPages } = await import("@/server/meta-oauth");
  const pages = await readMetaPendingPages();
  const hit = pages.find((page) => page.id === pageId);
  if (!hit) throw new Error("Hết hạn chọn Fanpage — bấm Kết nối Facebook lại.");
  const result = await connectMetaPage(actor, { pageToken: hit.accessToken, pageName: hit.name });
  await clearMetaPendingPages();
  return result;
}

export async function createManualConversation(
  actor: Actor,
  input: { customerName: string; customerPhone?: string; pageName?: string; channel?: ChatChannel; firstMessage?: string },
) {
  assertRole(actor, ["owner", "sale"]);
  const name = input.customerName.trim() || "Khách";
  const phone = (input.customerPhone || "").replace(/\D/g, "");
  let conversationId = "";
  await mutate(async (state) => {
    ensureChatCollections(state);
    const at = nowIso();
    const conversation: ShopConversation = {
      id: nid(),
      channel: input.channel ?? "manual",
      pageName: (input.pageName || "Nội bộ").trim() || "Nội bộ",
      customerName: name,
      customerPhone: phone,
      externalUserId: null,
      lastMessageAt: null,
      lastMessagePreview: "",
      unreadCount: 0,
      orderCodes: [],
      createdAt: at,
      updatedAt: at,
    };
    const first = (input.firstMessage || "").trim();
    if (first) {
      state.chatMessages!.push({
        id: nid(),
        conversationId: conversation.id,
        direction: "outbound",
        content: first,
        contentType: "text",
        createdAt: at,
        byStaffId: actor.id,
      });
      conversation.lastMessageAt = at;
      conversation.lastMessagePreview = first.slice(0, 160);
    }
    state.chatConversations!.unshift(conversation);
    conversationId = conversation.id;
    audit(state, actor.id, "chat.create", conversation.id, null, { name });
  });
  return { id: conversationId };
}

/** Ghi tin inbound (webhook Meta / StudioBase chỉ chuyển sự kiện — lưu local). */
export async function ingestInboundChatEvent(input: {
  externalId?: string;
  channel?: string;
  pageName?: string;
  customerName?: string;
  customerPhone?: string;
  externalUserId?: string;
  content: string;
  mediaUrl?: string | null;
  externalCommentId?: string | null;
  createdAt?: string;
}) {
  const content = input.content.trim();
  if (!content && !input.mediaUrl) return { ok: false as const, reason: "empty" };
  let conversationId = "";
  await mutate(async (state) => {
    ensureChatCollections(state);
    const channel = normalizeChatChannel(input.channel);
    const externalUserId = input.externalUserId?.trim() || null;
    let conversation =
      (externalUserId
        ? state.chatConversations!.find((item) => item.externalUserId === externalUserId && item.channel === channel)
        : undefined) ||
      (input.customerPhone
        ? state.chatConversations!.find((item) => item.customerPhone && item.customerPhone === input.customerPhone.replace(/\D/g, ""))
        : undefined);
    const at = input.createdAt || nowIso();
    if (!conversation) {
      conversation = {
        id: nid(),
        channel,
        pageName: (input.pageName || "Facebook").trim() || "Facebook",
        customerName: (input.customerName || "Khách").trim() || "Khách",
        customerPhone: (input.customerPhone || "").replace(/\D/g, ""),
        externalUserId,
        lastMessageAt: at,
        lastMessagePreview: (content || "[ảnh]").slice(0, 160),
        unreadCount: 1,
        orderCodes: [],
        createdAt: at,
        updatedAt: at,
      };
      state.chatConversations!.unshift(conversation);
    } else {
      conversation.lastMessageAt = at;
      conversation.lastMessagePreview = (content || "[ảnh]").slice(0, 160);
      conversation.unreadCount += 1;
      conversation.updatedAt = at;
      if (input.customerName?.trim()) conversation.customerName = input.customerName.trim();
      if (input.customerPhone) conversation.customerPhone = input.customerPhone.replace(/\D/g, "");
      if (input.pageName?.trim()) conversation.pageName = input.pageName.trim();
    }
    conversationId = conversation.id;
    const messageId = input.externalId?.trim() || nid();
    if (state.chatMessages!.some((item) => item.id === messageId)) return;
    state.chatMessages!.push({
      id: messageId,
      conversationId: conversation.id,
      direction: "inbound",
      content: content || (input.mediaUrl ? "[ảnh]" : ""),
      contentType: input.mediaUrl ? "image" : "text",
      mediaUrl: input.mediaUrl ?? null,
      externalCommentId: input.externalCommentId ?? null,
      createdAt: at,
      byStaffId: null,
    });
    const phone = extractVietnamPhone(content);
    if (phone && !conversation.customerPhone) conversation.customerPhone = phone;
  });
  return { ok: true as const, conversationId };
}

export async function ordersForConversation(actor: Actor, conversationId: string) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  ensureChatCollections(state);
  const conversation = state.chatConversations!.find((item) => item.id === conversationId);
  if (!conversation) throw new Error("Không thấy hội thoại.");
  const codes = new Set(conversation.orderCodes);
  const orders = state.orders
    .filter((order) => order.chatConversationId === conversationId || codes.has(order.code))
    .map((order) => ({
      id: order.id,
      code: order.code,
      status: order.status,
      statusLabel: STATUS_LABEL[order.status] || order.status,
      total: order.total,
      depositPaid: order.depositPaid,
      customerNote: order.customerNote,
    }));
  return { orders };
}

export async function linkOrderToConversation(actor: Actor, conversationId: string, orderCode: string) {
  assertRole(actor, ["owner", "sale"]);
  await mutate(async (state) => {
    ensureChatCollections(state);
    const conversation = state.chatConversations!.find((item) => item.id === conversationId);
    if (!conversation) throw new Error("Không thấy hội thoại.");
    const order = state.orders.find((item) => item.code === orderCode || item.id === orderCode);
    if (!order) throw new Error("Không thấy đơn.");
    order.chatConversationId = conversation.id;
    if (!conversation.orderCodes.includes(order.code)) conversation.orderCodes.push(order.code);
    conversation.updatedAt = nowIso();
    audit(state, actor.id, "chat.link_order", conversation.id, null, { code: order.code });
  });
  return { ok: true as const };
}

export async function getNotifyPrefs(actor: Actor) {
  assertRole(actor, ["owner"]);
  const state = await readState();
  return { notifyPrefs: state.settings.notifyPrefs ?? defaultNotifyPrefs() };
}

/** Webhook SePay: khớp mã CK với mã đơn → tự thu chuyển khoản. */
export async function processSePayWebhook(payload: SePayWebhookPayload, authHeader: string | null): Promise<{ success: true; duplicate?: boolean; matched?: string; amount?: number; skipped?: string }> {
  const state = await readState();
  const cfg = state.settings.sepay ?? defaultSePay();
  if (!cfg.enabled) return { success: true, skipped: "SePay chưa bật." };
  const expected = cfg.apiKey.trim();
  if (expected) {
    const header = (authHeader ?? "").trim();
    const ok =
      header === expected ||
      header === `Bearer ${expected}` ||
      header === `Apikey ${expected}` ||
      header.toLowerCase() === `apikey ${expected.toLowerCase()}`;
    if (!ok) throw new Error("API key SePay không khớp.");
  }
  const txId = String(payload.id ?? "").trim();
  if (!txId) throw new Error("Thiếu id giao dịch SePay.");
  const seen = state.sepaySeen ?? [];
  if (seen.includes(txId)) return { success: true, duplicate: true };

  const candidates = state.orders.map((order) => ({
    id: order.id,
    code: order.code,
    status: order.status,
    channel: order.channel,
    total: order.total,
    depositPaid: order.depositPaid,
  }));
  const order = findOrderForSePay(candidates, payload);
  const amountRaw = Number(payload.transferAmount) || 0;
  const reject = sepayRejectReason(order, amountRaw, payload.transferType);
  if (reject || !order) {
    await mutate(async (draft) => {
      draft.sepaySeen = [txId, ...(draft.sepaySeen ?? [])].slice(0, 500);
      audit(draft, null, "sepay.skip", txId, null, { reason: reject ?? "unknown", content: payload.content, code: payload.code });
    });
    return { success: true, skipped: reject ?? "Không khớp." };
  }

  const amount = sepayCollectAmount(order, amountRaw);
  await mutate(async (draft) => {
    draft.sepaySeen = [txId, ...(draft.sepaySeen ?? [])].slice(0, 500);
    const target = draft.orders.find((item) => item.id === order.id);
    if (!target) return;
    const before = target.depositPaid;
    const next = appendCollection(
      target,
      {
        id: nid(),
        at: nowIso(),
        amount,
        method: "SePay / chuyển khoản",
        by: null,
      },
      nid(),
    );
    target.payments = next.payments;
    target.depositPaid = next.depositPaid;
    target.depositMethod = next.depositMethod;
    target.depositBy = next.depositBy;
    target.updatedAt = nowIso();
    target.history.push({
      at: target.updatedAt,
      from: target.status,
      to: target.status,
      by: null,
      note: `SePay tự thu ${amount.toLocaleString("vi-VN")}đ · GD ${txId}`,
    });
    audit(draft, null, "sepay.collect", target.id, { depositPaid: before }, { depositPaid: target.depositPaid, txId, amount, reference: payload.referenceCode });
  });
  return { success: true, matched: order.code, amount };
}

export async function listPackages(actor: Actor) {
  assertRole(actor, ["owner", "sale"]);
  const state = await readState();
  return { packages: sortBySortThenName(state.packages ?? []) };
}

export async function savePackage(
  actor: Actor,
  input: { id?: string; name: string; price: number; description?: string; includes?: string; active?: boolean; sort?: number },
) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const name = input.name.trim();
    if (name.length < 2) throw new Error("Tên gói cần ít nhất 2 ký tự.");
    const price = Math.round(Number(input.price));
    if (!Number.isFinite(price) || price < 0) throw new Error("Giá gói không hợp lệ.");
    if (!state.packages) state.packages = [];
    if (input.id) {
      const row = state.packages.find((item) => item.id === input.id);
      if (!row) throw new Error("Không thấy gói.");
      row.name = name;
      row.price = price;
      if (input.description !== undefined) row.description = input.description.trim();
      if (input.includes !== undefined) row.includes = input.includes.trim();
      if (input.active !== undefined) row.active = input.active;
      if (input.sort !== undefined) row.sort = input.sort;
      audit(state, actor.id, "package.update", row.id, null, { name, price });
      return;
    }
    const row: ServicePackage = {
      id: nid(),
      name,
      price,
      description: (input.description ?? "").trim(),
      includes: (input.includes ?? "").trim(),
      active: input.active !== false,
      sort: input.sort ?? state.packages.length,
    };
    state.packages.push(row);
    audit(state, actor.id, "package.create", row.id, null, { name, price });
  });
}

export async function removePackage(actor: Actor, id: string) {
  assertRole(actor, ["owner"]);
  await mutate(async (state) => {
    const list = state.packages ?? [];
    const at = list.findIndex((item) => item.id === id);
    if (at < 0) throw new Error("Không thấy gói.");
    const [removed] = list.splice(at, 1);
    audit(state, actor.id, "package.remove", id, removed, null);
  });
}

const STAFF_PIN_PREFIX = "tt-staff-pin:v1:";

function pinFailKey(ip: string): string {
  return `pin_fail:${ip}`;
}

function sameHex(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let diff = 0;
  for (let index = 0; index < left.length; index++) diff |= left.charCodeAt(index) ^ right.charCodeAt(index);
  return diff === 0;
}

export async function staffPinReady(): Promise<{ set: boolean }> {
  const state = await readState();
  return { set: Boolean(state.settings.staffPinHash) };
}

export async function assertStaffPin(pin: string): Promise<void> {
  if (!/^\d{4}$/.test(pin)) throw new Error("Mã PIN là 4 chữ số.");
  const state = await readState();
  if (!state.settings.staffPinHash) throw new Error("Chủ chưa đặt mã PIN. Vào Cài đặt, mục Cửa hàng.");
  const ip = clientIp();
  if ((await failCount(pinFailKey(ip), Date.now())) >= LOGIN_FAIL_LIMIT) {
    throw new Error("Nhập sai quá nhiều. Thử lại sau 15 phút.");
  }
  const hash = await sha256(`${STAFF_PIN_PREFIX}${pin}`);
  if (!sameHex(hash, state.settings.staffPinHash)) {
    await bumpFail(pinFailKey(ip), new Date().toISOString(), LOGIN_FAIL_LIMIT);
    throw new Error("Mã PIN chưa đúng.");
  }
}

function checklistPayload(state: ShopState, drive: boolean) {
  return {
    pinSet: Boolean(state.settings.staffPinHash),
    drive,
    cards: checklistCards(state, vnYmd()),
    coverage: SHEET_COVERAGE,
    rules: SHOP_RULES,
    today: vnYmd(),
  };
}

export async function staffChecklist(actor: Actor) {
  assertRole(actor, ["owner", "sale", "production"]);
  const state = await readState();
  return checklistPayload(state, await driveConnected());
}

export async function phoneChecklist(pin: string) {
  await assertStaffPin(pin);
  const state = await readState();
  return checklistPayload(state, await driveConnected());
}

export async function setChecklistStatus(actor: Actor, input: { taskId: string; status: "chua_lam" | "dang_lam" | "xong"; note?: string }) {
  assertRole(actor, ["owner", "sale", "production"]);
  await mutate(async (state) => {
    const saved = applyTaskStatus(state, { ...input, by: actor.id, ymd: vnYmd(), at: nowIso() });
    audit(state, actor.id, "task.status", input.taskId, null, { status: input.status, title: saved.title });
  });
}

export async function phoneSetChecklistStatus(input: { pin: string; taskId: string; status: "chua_lam" | "dang_lam" | "xong"; note?: string }) {
  await assertStaffPin(input.pin);
  await mutate(async (state) => {
    applyTaskStatus(state, { taskId: input.taskId, status: input.status, note: input.note, by: null, ymd: vnYmd(), at: nowIso() });
  });
}

async function storeImage(file: OrderFile, bytes: Uint8Array, mime: string, folder: { orderId: string; code: string; customerName: string; createdAt: string; source: string; channel: string }, folders: readonly string[]) {
  await putPhoto(file, folder, bytes, mime, folders);
  file.status = "complete";
  file.size = bytes.byteLength;
  file.mime = mime;
}

export async function saveStaffPhoto(input: {
  pin: string;
  taskId?: string;
  token?: string;
  step?: string;
  name: string;
  mime: string;
  bytes: Uint8Array;
}) {
  await assertStaffPin(input.pin);
  const limit = await photoByteLimit();
  if (photoTooBig(input.bytes.byteLength, limit)) throw new Error("Mỗi ảnh tối đa 10MB khi chưa nối Google Drive.");
  const mime = input.mime || "image/jpeg";
  if (!imageMimeAllowed(mime) || !imageBytesMatch(mime, input.bytes)) throw new Error("Chỉ nhận ảnh JPG, PNG, WEBP hoặc HEIC.");
  const drive = await driveConnected();
  await mutate(async (state) => {
    const file: OrderFile = {
      id: nid(),
      name: input.name.replace(/[\\/]/g, "-").slice(-80) || "anh.jpg",
      mime,
      size: input.bytes.byteLength,
      status: "uploading",
      kind: "task",
      storage: "local",
      path: "",
      driveFileId: null,
      createdAt: nowIso(),
      deletedAt: null,
    };
    if (input.taskId) {
      const bucket = taskFileBucket(state, input.taskId, vnYmd());
      file.kind = "task";
      bucket.files.push(file);
      await storeImage(file, input.bytes, mime, {
        orderId: input.taskId,
        code: input.taskId,
        customerName: bucket.title,
        createdAt: file.createdAt,
        source: "manual",
        channel: "tai_tiem",
      }, taskFolderParts(bucket.period, bucket.title));
      applyTaskStatus(state, { taskId: input.taskId, status: "xong", by: null, ymd: vnYmd(), at: file.createdAt });
      return;
    }
    if (!input.token) throw new Error("Thiếu việc hoặc mã đơn.");
    const order = await orderByUploadToken(state, input.token);
    const kind = orderStepKind(input.step || "anh");
    file.kind = kind;
    order.files.push(file);
    const customer = state.customers.find((item) => item.id === order.customerId);
    await storeImage(
      file,
      input.bytes,
      mime,
      {
        orderId: order.id,
        code: order.code,
        customerName: customer?.name ?? "",
        createdAt: order.createdAt,
        source: order.source,
        channel: order.channel,
      },
      [
        ...driveFolderParts({
          code: order.code,
          customerName: customer?.name ?? "",
          createdAt: order.createdAt,
          source: order.source,
          channel: order.channel,
        }),
        orderKindFolder(kind),
      ],
    );
    order.updatedAt = nowIso();
  });
  return { ok: true as const, drive };
}

export async function saveActorTaskPhoto(
  actor: Actor,
  input: { taskId: string; name: string; mime: string; bytes: Uint8Array },
) {
  assertRole(actor, ["owner", "sale", "production"]);
  const limit = await photoByteLimit();
  if (photoTooBig(input.bytes.byteLength, limit)) throw new Error("Mỗi ảnh tối đa 10MB khi chưa nối Google Drive.");
  const mime = input.mime || "image/jpeg";
  if (!imageMimeAllowed(mime) || !imageBytesMatch(mime, input.bytes)) throw new Error("Chỉ nhận ảnh JPG, PNG, WEBP hoặc HEIC.");
  const drive = await driveConnected();
  await mutate(async (state) => {
    const bucket = taskFileBucket(state, input.taskId, vnYmd());
    const file: OrderFile = {
      id: nid(),
      name: input.name.replace(/[\\/]/g, "-").slice(-80) || "anh.jpg",
      mime,
      size: input.bytes.byteLength,
      status: "uploading",
      kind: "task",
      storage: "local",
      path: "",
      driveFileId: null,
      createdAt: nowIso(),
      deletedAt: null,
    };
    bucket.files.push(file);
    await storeImage(
      file,
      input.bytes,
      mime,
      {
        orderId: input.taskId,
        code: input.taskId,
        customerName: bucket.title,
        createdAt: file.createdAt,
        source: "manual",
        channel: "tai_tiem",
      },
      taskFolderParts(bucket.period, bucket.title),
    );
    applyTaskStatus(state, { taskId: input.taskId, status: "xong", by: actor.id, ymd: vnYmd(), at: file.createdAt });
  });
  return { ok: true as const, drive };
}

export async function phoneOrderCard(pin: string, token: string) {
  await assertStaffPin(pin);
  const state = await readState();
  const order = await orderByUploadToken(state, token);
  const customer = state.customers.find((item) => item.id === order.customerId);
  const files = order.files.filter((file) => !file.deletedAt && file.status === "complete");
  return {
    code: order.code,
    customerName: customer?.name ?? "",
    drive: await driveConnected(),
    counts: {
      original: files.filter((file) => file.kind === "original").length,
      design: files.filter((file) => file.kind === "design").length,
      approval: files.filter((file) => file.kind === "approval").length,
      packing_photo: files.filter((file) => file.kind === "packing_photo").length,
    },
  };
}
