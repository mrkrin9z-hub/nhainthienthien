import type { Channel } from "./types.ts";

/** Hàng lọc trong modal: mobile xếp dọc full-width, từ sm mới xếp ngang. */
export const PICKER_TOOLBAR_CLASS = "flex flex-col gap-2 sm:flex-row";
export const PICKER_SEARCH_WRAP_CLASS = "relative w-full min-w-0 sm:flex-1";
export const PICKER_SEARCH_INPUT_CLASS = "h-10 w-full rounded-full pl-9";
export const PICKER_TYPE_SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-full border border-input bg-background px-3 text-sm sm:w-auto sm:min-w-[10rem]";
export const PICKER_UNPRICED_BUTTON_CLASS = "h-10 w-full rounded-full border px-3 text-sm sm:w-auto";

export type PickerSku = {
  id: string;
  code?: string;
  name?: string;
  groupName?: string;
  label?: string;
  prices?: Partial<Record<Channel, number | null>>;
};

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
