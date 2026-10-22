import { ensureOrgCollections } from "./org-desk.ts";
import {
  applyFeeSettings,
  channelPriceFor,
  DESK_PRODUCT_DESCRIPTION,
  DESK_PRODUCT_NAME,
  masterByCode,
  MIN_STOCK_20261022,
} from "./price-import.ts";
import { repairMojibake } from "./text-repair.ts";
import type { ChannelPrice, Material, NotifyPrefs, Order, RoleModules, SePayConfig, ServicePackage, Settings, Sku } from "./types.ts";

const LEGACY_ANH_THO = "Miễn phí khôi phục, thay áo, đổi nền. Không giới hạn số lần sửa.";
const NEXT_ANH_THO = "Hỗ trợ chỉnh sửa ảnh cơ bản.";
const GLOSS_NAME = DESK_PRODUCT_NAME;
const PREVIOUS_GLOSS_NAME = "Ảnh ép gỗ tráng gương bo viền";
const WOOD_NAME = "Ảnh ép gỗ tráng gương";
const LEGACY_GLOSS_NAMES = ["Ảnh tráng gương bo viền", "Ảnh tráng gương", PREVIOUS_GLOSS_NAME, WOOD_NAME] as const;
const LEGACY_SMALLER_SIZES = "nằm ở ảnh tráng gương";
const NEXT_SMALLER_SIZES = "nằm ở ảnh ép gỗ tráng gương để bàn";
const OLD_GLOSS_DESCRIPTION = "Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.";
const PREVIOUS_GLOSS_DESCRIPTION =
  "Khổ 13×18 đến 60×90. Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.";
const NEXT_GLOSS_DESCRIPTION = DESK_PRODUCT_DESCRIPTION;
const PROMISED_TURNAROUND = "1–2 ngày";
const TEST_ORDER_CODES = new Set(["TT261022-001", "TT261018-001", "TT261017-001"]);
const MERGED_GROUP = "trang_guong";
const LEGACY_GROUP = "ep_go";

type ShopGroup = {
  id: string;
  name?: string;
  description: string;
  turnaround: string;
  category?: string;
  sort?: number;
};

type Migratable = {
  settings: Settings | {
    showZalo?: boolean;
    zaloDefaultMigrated?: boolean;
    groupListed?: Record<string, boolean>;
    sepay?: SePayConfig;
    notifyPrefs?: NotifyPrefs;
    catalogImport20261022?: boolean;
    fixedCosts?: Settings["fixedCosts"];
    publicHours?: string;
  };
  groups?: ShopGroup[];
  skus?: (Sku | { id: string; code: string; groupId: string; sheetCost?: number | null })[];
  prices?: ChannelPrice[];
  materials?: Material[];
  orders?: (Order | { code?: string; isTest?: boolean; customerId?: string; items: { name: string }[]; history?: { note: string }[]; customerNote?: string; internalNote?: string; stockWarning?: string })[];
  customers?: { id: string; name: string; phone: string }[];
  movements?: { reason: string; note: string }[];
  roleModules?: RoleModules[];
  packages?: ServicePackage[];
  sepaySeen?: string[];
};

/** Đổi tên cũ đúng nguyên văn. Tên chủ đã sửa thì giữ. */
function renameGlossLabel(value: string): string | null {
  if (value === GLOSS_NAME || value.startsWith(`${GLOSS_NAME} — `) || value.startsWith(`${GLOSS_NAME} - `)) return null;
  for (const legacy of LEGACY_GLOSS_NAMES) {
    if (value === legacy) return GLOSS_NAME;
    for (const separator of [" — ", " - "]) {
      if (value.startsWith(`${legacy}${separator}`)) return GLOSS_NAME + value.slice(legacy.length);
    }
  }
  return null;
}

function repair(value: string): string | null {
  const next = repairMojibake(value);
  return next === value ? null : next;
}

/**
 * Sổ seed lúc Zalo mặc định bật thì tắt một lần.
 * Khi `zaloDefaultMigrated` đã có, ô Cài đặt của chủ được giữ.
 * Câu tặng trên ảnh thờ cũ được đổi nếu còn nguyên câu đó.
 * Ảnh ép gỗ và ảnh ép gỗ tráng gương bo viền là một sản phẩm. Mã EG chuyển sang nhóm đó.
 * Câu hẹn 1–2 ngày trên thẻ được bỏ.
 */
export function applyStoreMigrations(state: Migratable): boolean {
  let changed = false;
  if (state.settings.zaloDefaultMigrated !== true) {
    state.settings.showZalo = false;
    state.settings.zaloDefaultMigrated = true;
    changed = true;
  }
  const groups = state.groups ?? [];
  for (const group of groups) {
    if (group.description.includes(LEGACY_ANH_THO)) {
      group.description = group.description.replace(LEGACY_ANH_THO, NEXT_ANH_THO);
      changed = true;
    }
    if (group.id === "anh_tho" && group.turnaround === "Có liền") {
      group.turnaround = "Theo đơn";
      changed = true;
    }
    if (group.id === MERGED_GROUP && group.name) {
      const next = renameGlossLabel(group.name);
      if (next) {
        group.name = next;
        changed = true;
      }
    }
    if (group.id === LEGACY_GROUP && group.description.includes(LEGACY_SMALLER_SIZES)) {
      group.description = group.description.replace(LEGACY_SMALLER_SIZES, NEXT_SMALLER_SIZES);
      changed = true;
    }
    if (group.turnaround === PROMISED_TURNAROUND || group.turnaround === "Trong ngày") {
      group.turnaround = "";
      changed = true;
    }
  }
  for (const order of state.orders ?? []) {
    for (const item of order.items) {
      const next = renameGlossLabel(item.name);
      if (next) {
        item.name = next;
        changed = true;
      }
    }
  }
  if (groups.some((group) => group.id === MERGED_GROUP)) {
    for (const sku of state.skus ?? []) {
      if ((sku.groupId === LEGACY_GROUP || sku.code.startsWith("EG-")) && sku.groupId !== MERGED_GROUP) {
        sku.groupId = MERGED_GROUP;
        changed = true;
      }
    }
    const gloss = groups.find((group) => group.id === MERGED_GROUP);
    if (gloss && (gloss.description === OLD_GLOSS_DESCRIPTION || gloss.description === PREVIOUS_GLOSS_DESCRIPTION)) {
      gloss.description = NEXT_GLOSS_DESCRIPTION;
      changed = true;
    }
    if (gloss && gloss.category === "Ảnh trang trí") {
      gloss.category = "Ảnh gỗ";
      changed = true;
    }
    if (gloss && gloss.sort === 6) {
      gloss.sort = 1;
      changed = true;
    }
    const legacyAt = groups.findIndex((group) => group.id === LEGACY_GROUP);
    if (legacyAt >= 0) {
      groups.splice(legacyAt, 1);
      changed = true;
    }
    const listed = state.settings.groupListed ?? (state.settings.groupListed = {});
    if (listed.ep_go !== false && listed.trang_guong === false) {
      listed.trang_guong = true;
      changed = true;
    }
    if (listed.ep_go !== false) {
      listed.ep_go = false;
      changed = true;
    }
  }
  if (repairStoredText(state)) changed = true;
  if (markKnownTestOrders(state)) changed = true;
  if (importCatalogOnce(state)) changed = true;
  if (ensureOrgCollections(state)) changed = true;
  return changed;
}

function repairStoredText(state: Migratable): boolean {
  let changed = false;
  const fix = (holder: object, key: string) => {
    const record = holder as Record<string, unknown>;
    const value = record[key];
    if (typeof value !== "string") return;
    const next = repair(value);
    if (!next) return;
    record[key] = next;
    changed = true;
  };
  for (const order of state.orders ?? []) {
    fix(order, "customerNote");
    fix(order, "internalNote");
    fix(order, "stockWarning");
    for (const item of order.items) {
      let next = item.name;
      const repaired = repair(next);
      if (repaired) next = repaired;
      const renamed = renameGlossLabel(next);
      if (renamed) next = renamed;
      if (next !== item.name) {
        item.name = next;
        changed = true;
      }
    }
    for (const row of order.history ?? []) {
      const next = repair(row.note);
      if (next) {
        row.note = next;
        changed = true;
      }
    }
  }
  for (const movement of state.movements ?? []) {
    const reason = repair(movement.reason);
    if (reason) {
      movement.reason = reason;
      changed = true;
    }
    const note = repair(movement.note);
    if (note) {
      movement.note = note;
      changed = true;
    }
  }
  for (const material of state.materials ?? []) {
    const name = repair(material.name);
    if (name) {
      material.name = name;
      changed = true;
    }
  }
  return changed;
}

function markKnownTestOrders(state: Migratable): boolean {
  let changed = false;
  const customers = new Map((state.customers ?? []).map((customer) => [customer.id, customer]));
  for (const order of state.orders ?? []) {
    if (!order.code || order.isTest) continue;
    const customer = order.customerId ? customers.get(order.customerId) : undefined;
    const namedTest = /^TEST\b/i.test(customer?.name ?? "");
    if (TEST_ORDER_CODES.has(order.code) || customer?.phone === "0900000099" || namedTest) {
      order.isTest = true;
      changed = true;
    }
  }
  return changed;
}

/** Một lần: giá 22/10, phí, định phí 23,9 triệu, mức tồn. Không đụng số lượng tồn và không đụng đơn. */
function importCatalogOnce(state: Migratable): boolean {
  if (state.settings.catalogImport20261022) return false;
  if (!state.prices?.length || !state.settings.fixedCosts) return false;
  applyFeeSettings(state.settings as Settings);
  state.settings.catalogImport20261022 = true;
  const rows = masterByCode();
  const skus = state.skus ?? [];
  for (const sku of skus) {
    const cost = rows.get(sku.code)?.cost;
    if (cost !== undefined && cost !== null) sku.sheetCost = cost;
  }
  const skuById = new Map(skus.map((sku) => [sku.id, sku]));
  for (const price of state.prices) {
    const sku = skuById.get(price.skuId);
    const next = channelPriceFor({ id: price.skuId, code: sku?.code ?? "" }, price.channel, sku ? rows.get(sku.code) : undefined);
    price.price = next.price;
    price.status = next.status;
    price.note = next.note;
    if (next.listPrice != null) price.listPrice = next.listPrice;
    else delete price.listPrice;
  }
  const materials = state.materials ?? [];
  for (const material of materials) {
    const min = MIN_STOCK_20261022[material.id];
    if (min !== undefined) material.minStock = min;
    if (material.id === "tui") {
      material.packSize = 1;
      material.packPrice = 500;
      material.buyLabel = "cái — ước tính 500đ";
    }
    if (material.id === "carton") {
      material.packSize = 1;
      material.packPrice = 0;
      material.buyLabel = "không tính riêng, nằm trong khoán 500.000đ";
    }
    if (material.id === "tem") {
      material.packSize = 1;
      material.packPrice = 0;
      material.buyLabel = "không tính riêng, nằm trong khoán 500.000đ";
    }
  }
  if (state.materials && !materials.some((material) => material.id === "bien-nhan")) {
    materials.push({
      id: "bien-nhan",
      name: "Giấy in biên nhận",
      buyLabel: "xấp/ram — chưa có giá",
      unit: "xấp",
      packSize: 1,
      packPrice: null,
      stock: 0,
      minStock: 1,
      supplier: "",
      pendingPrice: null,
      openingCounted: false,
    });
  }
  if (state.settings.groupListed) {
    state.settings.groupListed.tkb = true;
    state.settings.groupListed.lua = true;
  }
  return true;
}
