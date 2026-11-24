import type { Channel } from "./types.ts";

/** Hàng lọc trong modal: mobile xếp dọc full-width, từ sm mới xếp ngang. */
export const PICKER_TOOLBAR_CLASS = "flex flex-col gap-2 sm:flex-row";
export const PICKER_SEARCH_WRAP_CLASS = "relative w-full min-w-0 sm:flex-1";
export const PICKER_SEARCH_INPUT_CLASS = "h-10 w-full rounded-full pl-9";
export const PICKER_TYPE_SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-full border border-input bg-background px-3 text-sm sm:w-auto sm:min-w-[10rem]";
export const PICKER_UNPRICED_BUTTON_CLASS = "h-10 w-full rounded-full border px-3 text-sm sm:w-auto";
export const PICKER_CHOSEN_CARD_CLASS =
  "flex w-full items-start gap-3 rounded-md border border-primary bg-primary/10 px-3 py-2.5 text-left";
export const PICKER_CARD_CLASS =
  "flex w-full items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left hover:border-primary hover:bg-primary/5";

export type PickerSku = {
  id: string;
  code?: string;
  name?: string;
  groupName?: string;
  label?: string;
  prices?: Partial<Record<Channel, number | null>>;
};

export type PickerQtyMap = Record<string, number>;
export type PickerSelection = { skuId: string; quantity: number };

export function pickerCatalog(catalog: PickerSku[] | null | undefined): PickerSku[] {
  return Array.isArray(catalog) ? catalog.filter(Boolean) : [];
}

export function pickerGroupNames(catalog: PickerSku[] | null | undefined): string[] {
  const names = new Set<string>();
  for (const sku of pickerCatalog(catalog)) names.add(sku.groupName || "Khác");
  return [...names].sort((a, b) => a.localeCompare(b, "vi"));
}

export function filterPickerRows(
  catalog: PickerSku[] | null | undefined,
  opts: { q: string; group: string; showUnpriced: boolean; channel: Channel },
): PickerSku[] {
  const needle = (opts.q ?? "").trim().toLowerCase();
  return pickerCatalog(catalog).filter((sku) => {
    if (!opts.showUnpriced && (sku.prices?.[opts.channel] ?? null) === null) return false;
    if (opts.group !== "all" && (sku.groupName || "Khác") !== opts.group) return false;
    if (!needle) return true;
    const hay = `${sku.label ?? ""} ${sku.code ?? ""} ${sku.name ?? ""} ${sku.groupName ?? ""}`.toLowerCase();
    return hay.includes(needle);
  });
}

export function qtyMapFromLines(lines: Array<{ skuId?: string; quantity?: number }> | null | undefined): PickerQtyMap {
  const map: PickerQtyMap = {};
  for (const line of lines ?? []) {
    const id = line.skuId?.trim();
    if (!id) continue;
    const qty = Number(line.quantity);
    const add = Number.isFinite(qty) && qty > 0 ? Math.round(qty) : 1;
    map[id] = Math.min(500, (map[id] ?? 0) + add);
  }
  return map;
}

export function pickerQtyOf(selected: PickerQtyMap, skuId: string): number {
  const n = selected[skuId] ?? 0;
  return Number.isFinite(n) && n > 0 ? Math.min(500, Math.round(n)) : 0;
}

export function setPickerQty(selected: PickerQtyMap, skuId: string, quantity: number): PickerQtyMap {
  const next = { ...selected };
  const qty = Math.round(Number(quantity));
  if (!skuId || !Number.isFinite(qty) || qty <= 0) {
    delete next[skuId];
    return next;
  }
  next[skuId] = Math.min(500, qty);
  return next;
}

export function bumpPickerQty(selected: PickerQtyMap, skuId: string, delta: number): PickerQtyMap {
  return setPickerQty(selected, skuId, pickerQtyOf(selected, skuId) + delta);
}

export type PickerChoice = {
  skuId: string;
  quantity: number;
  name: string;
  code: string;
  price: number | null;
  lineTotal: number | null;
};

export function pickerChoices(
  catalog: PickerSku[] | null | undefined,
  selected: PickerQtyMap,
  channel: Channel,
): PickerChoice[] {
  const list = pickerCatalog(catalog);
  const byId = new Map(list.map((sku) => [sku.id, sku]));
  const out: PickerChoice[] = [];
  const seen = new Set<string>();
  const ids = [...Object.keys(selected), ...list.map((sku) => sku.id)];
  for (const id of ids) {
    if (seen.has(id)) continue;
    seen.add(id);
    const quantity = pickerQtyOf(selected, id);
    if (quantity <= 0) continue;
    const sku = byId.get(id);
    const price = sku?.prices?.[channel] ?? null;
    out.push({
      skuId: id,
      quantity,
      name: sku?.name || sku?.label || id,
      code: sku?.code || id,
      price,
      lineTotal: price == null ? null : price * quantity,
    });
  }
  return out;
}

export function pickerChoiceSummary(choices: PickerChoice[]): { count: number; pieces: number; total: number | null } {
  const count = choices.length;
  const pieces = choices.reduce((sum, item) => sum + item.quantity, 0);
  const known = choices.every((item) => item.lineTotal != null);
  const total = known ? choices.reduce((sum, item) => sum + (item.lineTotal ?? 0), 0) : null;
  return { count, pieces, total };
}

/** Nhãn nút xác nhận: "Xong", "Xong (2 sản phẩm · 147.000đ)" hoặc "Xong (2 sản phẩm)". */
export function pickerDoneLabel(summary: { count: number; total: number | null }, formatMoney: (value: number) => string): string {
  if (summary.count <= 0) return "Xong";
  if (summary.total == null) return `Xong (${summary.count} sản phẩm)`;
  return `Xong (${summary.count} sản phẩm · ${formatMoney(summary.total)})`;
}
