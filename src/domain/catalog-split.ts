import type { Group, ShopState, Sku } from "./types.ts";
import { familySlugOf, isRetiredDraftSku, visibleAdminSkus } from "./public-catalog.ts";
import { isMergedWoodAlias } from "./calc.ts";
import { slugifyProductName, uniqueKey } from "./web-product.ts";

export type SplitLegacyResult = {
  created: { groupId: string; slug: string; skuId: string }[];
  shells: string[];
  skipped: string[];
};

function productNameFor(group: Group, sku: Sku): string {
  const family = group.name.trim() || "Sản phẩm";
  if (sku.sheets > 1) {
    return `${family} Combo ${sku.widthCm}×${sku.heightCm} · ${sku.sheets} tấm`.slice(0, 80);
  }
  return `${family} ${sku.widthCm}×${sku.heightCm} cm`.slice(0, 80);
}

/** Tách nhóm đang gom nhiều mã thành mỗi mã một sản phẩm, giữ slug trang cũ làm familySlug. */
export function splitLegacyProductGroups(state: ShopState): SplitLegacyResult {
  const created: SplitLegacyResult["created"] = [];
  const shells: string[] = [];
  const skipped: string[] = [];
  const slugs = new Set(state.groups.map((group) => group.slug));
  const ids = new Set(state.groups.map((group) => group.id));

  const groups = state.groups.slice();
  for (const group of groups) {
    const visible = visibleAdminSkus(group.id, state.skus, state.prices);
    if (visible.length <= 1) {
      skipped.push(group.id);
      continue;
    }
    const familySlug = familySlugOf(group);
    group.familySlug = familySlug;
    for (const sku of visible) {
      const name = productNameFor(group, sku);
      const slug = uniqueKey(slugifyProductName(name), slugs);
      slugs.add(slug);
      const idBase = sku.code.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || slug.replace(/-/g, "_");
      const id = uniqueKey(idBase, ids);
      ids.add(id);
      const child: Group = {
        id,
        name,
        slug,
        category: group.category,
        description: group.description,
        turnaround: group.turnaround,
        sort: group.sort,
        gate: group.gate,
        familySlug,
      };
      state.groups.push(child);
      sku.groupId = id;
      state.settings.groupListed = { ...state.settings.groupListed, [id]: state.settings.groupListed?.[group.id] !== false };
      created.push({ groupId: id, slug, skuId: sku.id });
    }
    shells.push(group.id);
  }
  return { created, shells, skipped };
}

export function retiredDraftCodes(state: ShopState): string[] {
  return state.skus
    .filter((sku) => {
      const siblings = state.skus.filter((item) => item.groupId === sku.groupId);
      return isRetiredDraftSku(sku, state.prices, siblings) && !isMergedWoodAlias(sku);
    })
    .map((sku) => sku.code);
}
