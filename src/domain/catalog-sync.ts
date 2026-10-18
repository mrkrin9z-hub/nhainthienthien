import { comboPriceError, priceOf } from "./calc.ts";
import type { Channel, ChannelPrice, Group, Sku, SkuMap } from "./types.ts";
import { slugifyProductName, uniqueKey } from "./web-product.ts";

export type ShelfOffer = {
  channel: "tiktok" | "shopee";
  sellerSku: string;
  platformSkuId: string;
  productName: string;
  variantName: string;
  price: number | null;
  active: boolean;
};

export type ShelfShop = {
  groups: Group[];
  skus: Sku[];
  prices: ChannelPrice[];
  skuMaps: SkuMap[];
};

export type ShelfResult = {
  created: number;
  priced: number;
  mapped: number;
  skipped: string[];
};

const CODE = /^[A-Za-z][A-Za-z0-9-]{1,48}$/;

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function money(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return Math.round(value);
  const raw = text(value).replace(/[^\d.-]/g, "");
  if (!raw) return null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(n);
}

function cleanName(value: string, max: number): string {
  return value.trim().replace(/\s+/g, " ").slice(0, max);
}

function sameName(a: string, b: string): boolean {
  return cleanName(a, 80).toLowerCase() === cleanName(b, 80).toLowerCase();
}

function sizeOf(label: string): { widthCm: number; heightCm: number } | null {
  const match = /(\d{1,3})\s*[x×*]\s*(\d{1,3})/i.exec(label);
  if (!match) return null;
  const widthCm = Number(match[1]);
  const heightCm = Number(match[2]);
  if (widthCm < 1 || widthCm > 200 || heightCm < 1 || heightCm > 200) return null;
  return { widthCm, heightCm };
}

function usablePrice(price: number | null): price is number {
  return price !== null && Number.isInteger(price) && price >= 1 && price <= 100_000_000;
}

/** Mã sàn gửi về. Bỏ mã EG mới. Mã không hợp lệ thì để trống để sinh mã TT/SP. */
export function shopCodeForSeller(sellerSku: string): string | null {
  const code = sellerSku.trim();
  if (!code || code.toLowerCase().startsWith("eg-")) return null;
  if (!CODE.test(code)) return null;
  return code;
}

export function tiktokSearchPage(data: unknown): { ids: string[]; next: string } {
  const row = asRecord(data);
  const products = Array.isArray(row?.products) ? row.products : [];
  const ids = products
    .map((item) => text(asRecord(item)?.id))
    .filter((id) => /^\d{5,30}$/.test(id));
  return { ids, next: text(row?.next_page_token).slice(0, 400) };
}

export function offersFromTiktokProduct(product: unknown): ShelfOffer[] {
  const row = asRecord(product);
  if (!row) return [];
  const status = text(row.status) || text(row.product_status);
  if (status && status !== "ACTIVATE") return [];
  const productName = cleanName(text(row.title), 80);
  if (productName.length < 2) return [];
  const skus = Array.isArray(row.skus) ? row.skus : [];
  const offers: ShelfOffer[] = [];
  for (const raw of skus) {
    const sku = asRecord(raw);
    if (!sku) continue;
    const platformSkuId = text(sku.id);
    if (!/^\d{5,30}$/.test(platformSkuId)) continue;
    const attrs = Array.isArray(sku.sales_attributes) ? sku.sales_attributes : [];
    const variantName = cleanName(
      attrs
        .map((attr) => text(asRecord(attr)?.value_name))
        .filter(Boolean)
        .join(" · "),
      80,
    );
    const skuStatus = text(asRecord(sku.status_info)?.status);
    const price = money(asRecord(sku.price)?.sale_price);
    offers.push({
      channel: "tiktok",
      sellerSku: text(sku.seller_sku).slice(0, 80),
      platformSkuId,
      productName,
      variantName,
      price,
      active: skuStatus !== "DEACTIVATED",
    });
  }
  return offers;
}

export function shopeeListPage(response: unknown): { ids: string[]; nextOffset: number | null } {
  const row = asRecord(response);
  const items = Array.isArray(row?.item) ? row.item : [];
  const ids = items
    .map((item) => text(asRecord(item)?.item_id))
    .filter((id) => /^\d{1,20}$/.test(id));
  const more = row?.has_next_page === true;
  const offset = Number(text(row?.next_offset));
  return { ids, nextOffset: more && Number.isInteger(offset) && offset >= 0 ? offset : null };
}

export function offersFromShopeeItem(item: unknown, models: unknown | null): ShelfOffer[] {
  const row = asRecord(item);
  if (!row) return [];
  const productName = cleanName(text(row.item_name), 80);
  if (productName.length < 2) return [];
  if (row.has_model === true) return offersFromShopeeModels(productName, models);
  const platformSkuId = text(row.item_id);
  if (!/^\d{1,20}$/.test(platformSkuId)) return [];
  const priceInfo = Array.isArray(row.price_info) ? asRecord(row.price_info[0]) : null;
  return [
    {
      channel: "shopee",
      sellerSku: text(row.item_sku).slice(0, 80),
      platformSkuId,
      productName,
      variantName: "",
      price: money(priceInfo?.current_price) ?? money(priceInfo?.original_price),
      active: true,
    },
  ];
}

function offersFromShopeeModels(productName: string, models: unknown | null): ShelfOffer[] {
  const row = asRecord(models);
  if (!row) return [];
  const tiers = Array.isArray(row.tier_variation) ? row.tier_variation : [];
  const list = Array.isArray(row.model) ? row.model : [];
  const offers: ShelfOffer[] = [];
  for (const raw of list) {
    const model = asRecord(raw);
    if (!model) continue;
    const platformSkuId = text(model.model_id);
    if (!/^\d{1,20}$/.test(platformSkuId)) continue;
    const indexes = Array.isArray(model.tier_index) ? model.tier_index : [];
    const variantName = cleanName(
      indexes
        .map((index, tier) => {
          const option = asRecord(tiers[tier]);
          const options = Array.isArray(option?.option_list) ? option.option_list : [];
          const at = typeof index === "number" ? index : Number(text(index));
          return text(asRecord(options[at])?.option);
        })
        .filter(Boolean)
        .join(" · "),
      80,
    );
    const priceInfo = Array.isArray(model.price_info) ? asRecord(model.price_info[0]) : null;
    offers.push({
      channel: "shopee",
      sellerSku: text(model.model_sku).slice(0, 80),
      platformSkuId,
      productName,
      variantName,
      price: money(priceInfo?.current_price) ?? money(priceInfo?.original_price),
      active: true,
    });
  }
  return offers;
}

function findSku(skus: Sku[], code: string): Sku | undefined {
  const key = code.trim().toLowerCase();
  return skus.find((sku) => sku.code.toLowerCase() === key);
}

function groupFor(state: ShelfShop, productName: string): Group {
  const found = state.groups.find((group) => sameName(group.name, productName));
  if (found) return found;
  const slugs = new Set(state.groups.map((group) => group.slug));
  const ids = new Set(state.groups.map((group) => group.id));
  const slug = uniqueKey(slugifyProductName(productName), slugs);
  const id = uniqueKey(slug.replace(/-/g, "_"), ids);
  const group: Group = {
    id,
    name: cleanName(productName, 80),
    slug,
    category: "Sàn",
    description: "",
    turnaround: "",
    sort: Math.max(0, ...state.groups.map((item) => item.sort)) + 1,
    gate: null,
  };
  state.groups.push(group);
  return group;
}

function generatedCode(channel: ShelfOffer["channel"], platformSkuId: string, taken: Set<string>): string {
  const stem = channel === "tiktok" ? `TT-${platformSkuId.slice(-16)}` : `SP-${platformSkuId}`;
  const code = uniqueKey(stem.slice(0, 40), taken);
  if (code.toLowerCase().startsWith("eg-")) throw new Error("Không tạo mã EG.");
  return code;
}

function rememberMap(state: ShelfShop, channel: ShelfOffer["channel"], externalSku: string, skuId: string): boolean {
  const key = externalSku.trim();
  if (!key) return false;
  const found = state.skuMaps.find((row) => row.channel === channel && row.externalSku.toLowerCase() === key.toLowerCase());
  if (found) {
    if (found.skuId === skuId) return false;
    found.skuId = skuId;
    return true;
  }
  state.skuMaps.push({ channel, externalSku: key, skuId });
  return true;
}

function writeChannelPrice(state: ShelfShop, sku: Sku, offer: ShelfOffer): "same" | "wrote" | string {
  const siblings = state.skus.filter(
    (item) => item.groupId === sku.groupId && item.size === sku.size && item.size !== null && !item.code.endsWith("-GOI") && !item.code.startsWith("EG-"),
  );
  const nextPrice = offer.active && usablePrice(offer.price) ? offer.price : null;
  const nextStatus = nextPrice === null ? "nhap" : "dang_ban";
  if (nextPrice !== null) {
    const error = comboPriceError(
      siblings.map((item) => ({
        sheets: item.sheets,
        price: item.id === sku.id ? nextPrice : (priceOf(state.prices, item.id, offer.channel)?.price ?? null),
      })),
    );
    if (error) return error;
  }
  const note = offer.channel === "tiktok" ? "Từ TikTok Shop" : "Từ Shopee";
  const row = state.prices.find((item) => item.skuId === sku.id && item.channel === offer.channel);
  if (!row) {
    state.prices.push({ skuId: sku.id, channel: offer.channel, price: nextPrice, status: nextStatus, note });
    return "wrote";
  }
  if (row.price === nextPrice && row.status === nextStatus) return "same";
  row.price = nextPrice;
  row.status = nextStatus;
  row.note = note;
  return "wrote";
}

/** Ghi SKU và giá TikTok hoặc Shopee. Không đụng giá tại tiệm và Facebook. */
export function applyShelfOffers(state: ShelfShop, offers: ShelfOffer[]): ShelfResult {
  const result: ShelfResult = { created: 0, priced: 0, mapped: 0, skipped: [] };
  const taken = new Set(state.skus.map((sku) => sku.code.toLowerCase()));
  for (const offer of offers) {
    const label = offer.sellerSku || offer.platformSkuId;
    const sellerCode = shopCodeForSeller(offer.sellerSku);
    const existing = offer.sellerSku ? findSku(state.skus, offer.sellerSku) : undefined;
    if (!existing && offer.sellerSku.toLowerCase().startsWith("eg-")) {
      result.skipped.push(`${label}: không tạo mã EG mới.`);
      continue;
    }
    let sku = existing;
    if (!sku && offer.sellerSku) {
      const mapped = state.skuMaps.find(
        (row) => row.channel === offer.channel && row.externalSku.toLowerCase() === offer.sellerSku.toLowerCase(),
      );
      sku = mapped ? state.skus.find((item) => item.id === mapped.skuId) : undefined;
    }
    if (!sku) {
      const group = groupFor(state, offer.productName);
      const code = sellerCode ?? generatedCode(offer.channel, offer.platformSkuId, taken);
      if (taken.has(code.toLowerCase())) {
        sku = findSku(state.skus, code);
      } else {
        const size = sizeOf(offer.variantName) ?? sizeOf(offer.productName);
        const name = offer.variantName || (size ? `${size.widthCm}×${size.heightCm} cm` : "Một mẫu");
        sku = {
          id: code,
          code,
          groupId: group.id,
          name: cleanName(name, 80),
          size: size ? `${size.widthCm}x${size.heightCm}` : null,
          widthCm: size?.widthCm ?? null,
          heightCm: size?.heightCm ?? null,
          sheets: 1,
          piecesPerPack: null,
          sort: state.skus.filter((item) => item.groupId === group.id).length + 1,
        };
        state.skus.push(sku);
        taken.add(code.toLowerCase());
        for (const channel of ["tai_tiem", "facebook", "tiktok", "shopee"] as Channel[]) {
          if (channel === offer.channel) continue;
          state.prices.push({ skuId: sku.id, channel, price: null, status: "nhap", note: "" });
        }
        result.created += 1;
      }
    }
    if (!sku) {
      result.skipped.push(`${label}: không gắn được vào bảng giá.`);
      continue;
    }
    const problem = writeChannelPrice(state, sku, offer);
    if (problem !== "same" && problem !== "wrote") {
      result.skipped.push(`${label}: ${problem}`);
      continue;
    }
    if (problem === "wrote") result.priced += 1;
    if (offer.sellerSku && rememberMap(state, offer.channel, offer.sellerSku, sku.id)) result.mapped += 1;
    if (rememberMap(state, offer.channel, offer.platformSkuId, sku.id)) result.mapped += 1;
  }
  return result;
}

export function cloneChannelPrices(
  state: { skus: Sku[]; prices: ChannelPrice[] },
  input: { groupId: string; from: "tiktok" | "shopee"; to: "tai_tiem" | "facebook"; overwrite: boolean },
): { copied: number; kept: number } {
  if (input.from === input.to) return { copied: 0, kept: 0 };
  let copied = 0;
  let kept = 0;
  const note = input.from === "tiktok" ? "Nhân bản từ TikTok" : "Nhân bản từ Shopee";
  for (const sku of state.skus.filter((item) => item.groupId === input.groupId)) {
    const source = priceOf(state.prices, sku.id, input.from);
    if (!usablePrice(source?.price ?? null) || source?.status !== "dang_ban") continue;
    const target = state.prices.find((item) => item.skuId === sku.id && item.channel === input.to);
    if (target && target.price !== null && !input.overwrite) {
      kept += 1;
      continue;
    }
    if (!target) {
      state.prices.push({ skuId: sku.id, channel: input.to, price: source.price, status: "dang_ban", note });
    } else {
      target.price = source.price;
      target.status = "dang_ban";
      target.note = note;
    }
    copied += 1;
  }
  return { copied, kept };
}
