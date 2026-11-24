import { PUBLIC_PRICE_CHANNEL, type ChannelPrice, type Group, type Settings, type Sku } from "./types.ts";
import { groupIsListed, isMergedWoodAlias, priceOf, walkInListed } from "./calc.ts";

export type PublicCatalogGroup = Pick<Group, "id" | "name" | "slug" | "category" | "description" | "turnaround" | "sort" | "gate"> & {
  familySlug?: string | null;
};

export type PublicCatalogState = {
  settings: Settings;
  groups: PublicCatalogGroup[];
  skus: Sku[];
  prices: ChannelPrice[];
};

export type PublicCatalogVariant = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  unit: string;
  price: number | null;
  sale_price: number | null;
  list_price: number | null;
  min_total: number | null;
  requires_quote: boolean;
  recommended_width_px: number | null;
  recommended_height_px: number | null;
  sort_order: number;
  sheets: number;
};

export type PublicCatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  cover_path: string | null;
  gallery: string[];
  turnaround_text: string;
  sort_order: number;
  variants: PublicCatalogVariant[];
};

/** Trang storefront của nhóm (vd trang-guong) khi đã tách mỗi mã thành một sản phẩm. */
export function familySlugOf(group: { slug: string; familySlug?: string | null }): string {
  const family = group.familySlug?.trim();
  return family || group.slug;
}

/** Mã nháp, không bán kênh nào, cùng nhóm với mã đang bán — ẩn khỏi admin/storefront, không xóa. */
export function isRetiredDraftSku(
  sku: Sku,
  prices: ChannelPrice[],
  siblings: Sku[],
): boolean {
  if (isMergedWoodAlias(sku)) return false;
  const hasLivePeer = siblings.some((peer) => peer.id !== sku.id && !isMergedWoodAlias(peer) && skuHasLiveChannel(peer, prices));
  if (!hasLivePeer) return false;
  return !skuHasLiveChannel(sku, prices);
}

function skuHasLiveChannel(sku: Sku, prices: ChannelPrice[]): boolean {
  const sold = sku.soldOn ?? [];
  if (sold.length) {
    return sold.some((channel) => walkInListed(priceOf(prices, sku.id, channel)?.status));
  }
  return prices.some((row) => row.skuId === sku.id && walkInListed(row.status));
}

export function visibleAdminSkus(groupId: string, skus: Sku[], prices: ChannelPrice[]): Sku[] {
  const siblings = skus.filter((sku) => sku.groupId === groupId);
  return siblings
    .filter((sku) => !isMergedWoodAlias(sku) && !isRetiredDraftSku(sku, prices, siblings))
    .sort((a, b) => a.sort - b.sort);
}

function variantOf(sku: Sku, prices: ChannelPrice[]): PublicCatalogVariant {
  const price = priceOf(prices, sku.id, PUBLIC_PRICE_CHANNEL)?.price ?? null;
  const listPrice =
    priceOf(prices, sku.id, PUBLIC_PRICE_CHANNEL)?.listPrice
    ?? priceOf(prices, sku.id, "tiktok")?.listPrice
    ?? null;
  return {
    id: sku.id,
    name: sku.name,
    width: sku.widthCm,
    height: sku.heightCm,
    unit: "cm",
    price,
    sale_price: null,
    list_price: typeof listPrice === "number" && price !== null && listPrice > price ? listPrice : null,
    min_total: priceOf(prices, sku.id, PUBLIC_PRICE_CHANNEL)?.minTotal ?? null,
    requires_quote: price === null,
    recommended_width_px: sku.widthCm ? Math.round((sku.widthCm / 2.54) * 300) : null,
    recommended_height_px: sku.heightCm ? Math.round((sku.heightCm / 2.54) * 300) : null,
    sort_order: sku.sort,
    sheets: sku.sheets,
  };
}

function familyHead(members: PublicCatalogGroup[], familySlug: string): PublicCatalogGroup {
  return members.find((group) => group.slug === familySlug) ?? [...members].sort((a, b) => a.sort - b.sort)[0]!;
}

/**
 * Catalog khách: một thẻ / một URL theo nhóm (familySlug), biến thể là mọi mã đang bán trong nhóm.
 * Trước khi tách dữ liệu, familySlug trống nên mỗi group vẫn là một trang như cũ.
 */
export function buildPublicCatalog(
  state: PublicCatalogState,
  media: {
    cover: (slug: string) => string | null;
    gallery: (slug: string) => string[];
  },
): PublicCatalogProduct[] {
  const listed = state.groups
    .filter((group) => groupIsListed(state.settings, group))
    .sort((a, b) => a.sort - b.sort);

  const buckets = new Map<string, PublicCatalogGroup[]>();
  for (const group of listed) {
    const slug = familySlugOf(group);
    const bucket = buckets.get(slug) ?? [];
    bucket.push(group);
    buckets.set(slug, bucket);
  }

  const products: PublicCatalogProduct[] = [];
  for (const [slug, members] of buckets) {
    const head = familyHead(members, slug);
    const memberIds = new Set(members.map((group) => group.id));
    const variants = state.skus
      .filter((sku) => memberIds.has(sku.groupId))
      .filter((sku) => !isMergedWoodAlias(sku))
      .filter((sku) => walkInListed(priceOf(state.prices, sku.id, PUBLIC_PRICE_CHANNEL)?.status))
      .sort((a, b) => a.sort - b.sort || a.code.localeCompare(b.code, "vi"))
      .map((sku) => variantOf(sku, state.prices));
    if (!variants.length) continue;
    products.push({
      id: head.id,
      name: head.name,
      slug,
      category: head.category,
      description: head.description,
      cover_path: media.cover(slug) ?? media.cover(head.slug),
      gallery: media.gallery(slug).length ? media.gallery(slug) : media.gallery(head.slug),
      turnaround_text: head.turnaround,
      sort_order: head.sort,
      variants,
    });
  }
  return products.sort((a, b) => a.sort_order - b.sort_order);
}
