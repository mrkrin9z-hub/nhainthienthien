import { lineAmountAfterDiscount } from "./calc.ts";
import { groupedIntValue } from "./grouped-number.ts";
import type { Channel } from "./types.ts";

export type DeskLineInput = {
  key: string;
  skuId: string;
  query: string;
  quantity: number;
  unitPrice: string;
  priceTouched: boolean;
  variant: string;
  discount: string;
};

export function normalizeDeskDiscount(value: unknown): string {
  if (value == null || value === "" || value === 0 || value === "0") return "";
  return String(value);
}

export function skuTitle(sku: { groupName?: string | null; name?: string | null; label?: string | null } | null | undefined): string {
  if (!sku) return "";
  const group = (sku.groupName ?? "").trim();
  const name = (sku.name ?? "").trim();
  if (group && name && !name.includes(group)) return `${group} · ${name}`;
  return name || group || (sku.label ?? "");
}

export function normalizeDeskLines<T extends { unitPrice?: unknown; variant?: unknown; discount?: unknown }>(
  lines: T[] | null | undefined,
): Array<T & { query: string; priceTouched: boolean; variant: string; discount: string }> {
  return (lines ?? []).map((line) => ({
    ...line,
    query: "",
    priceTouched: String(line.unitPrice ?? "") !== "",
    variant: String(line.variant ?? ""),
    discount: normalizeDeskDiscount(line.discount),
  }));
}

export function addSkusToLines<T extends DeskLineInput>(
  current: T[],
  skuIds: string[],
  catalog: Array<{ id: string; prices?: Partial<Record<Channel, number | null>> }> | null | undefined,
  channel: Channel,
  newKey: () => string,
): DeskLineInput[] {
  const list = Array.isArray(catalog) ? catalog : [];
  const added = skuIds.map((skuId) => {
    const sku = list.find((item) => item.id === skuId);
    const listed = sku?.prices?.[channel] ?? null;
    return {
      key: newKey(),
      skuId,
      query: "",
      quantity: 1,
      unitPrice: listed == null ? "" : String(listed),
      priceTouched: false,
      variant: "",
      discount: "",
    } satisfies DeskLineInput;
  });
  const next = [...current.filter((line) => line.skuId), ...added];
  return next.length ? next : current;
}

export function deskLineAmountAfterDiscount(input: {
  unit: number | null;
  quantity: number;
  discount: unknown;
  minTotal?: number | null;
  hasSku: boolean;
}): number | null {
  if (!input.hasSku || input.unit === null) return null;
  const cut = groupedIntValue(normalizeDeskDiscount(input.discount)) ?? 0;
  return lineAmountAfterDiscount(input.unit, input.quantity, input.minTotal ?? null, Number.isFinite(cut) ? cut : 0);
}

export function deskSaveItems(
  lines: Array<{
    skuId: string;
    sku?: unknown;
    quantity: number;
    variant: string;
    unit: number | null;
    priceTouched: boolean;
    discount: unknown;
  }>,
  priceReason: string,
): { skuId: string; quantity: number; variant: string; unitPrice?: number; priceReason?: string; discount: number }[] {
  return lines
    .filter((line) => line.sku)
    .map((line) => {
      const discount = groupedIntValue(normalizeDeskDiscount(line.discount)) ?? 0;
      return {
        skuId: line.skuId,
        quantity: line.quantity,
        variant: (line.variant ?? "").trim(),
        ...(line.unit !== null
          ? { unitPrice: line.unit, ...(line.priceTouched && priceReason.trim() ? { priceReason } : {}) }
          : {}),
        discount: Number.isFinite(discount) ? discount : 0,
      };
    });
}

export function applyPickerSelectionToLines(
  current: DeskLineInput[],
  selected: Array<{ skuId: string; quantity: number }>,
  catalog: Array<{ id: string; prices?: Partial<Record<Channel, number | null>> }> | null | undefined,
  channel: Channel,
  newKey: () => string,
): DeskLineInput[] {
  const wanted = selected.filter((item) => item.skuId && item.quantity > 0);
  const qtyBySku = new Map(wanted.map((item) => [item.skuId, item.quantity]));
  const used = new Set<string>();
  const next: DeskLineInput[] = [];
  for (const line of current) {
    if (!line.skuId) continue;
    const quantity = qtyBySku.get(line.skuId);
    if (quantity == null) continue;
    if (used.has(line.skuId)) continue;
    used.add(line.skuId);
    next.push({ ...line, quantity, query: line.query ?? "" });
  }
  const list = Array.isArray(catalog) ? catalog : [];
  for (const item of wanted) {
    if (used.has(item.skuId)) continue;
    const sku = list.find((row) => row.id === item.skuId);
    const listed = sku?.prices?.[channel] ?? null;
    next.push({
      key: newKey(),
      skuId: item.skuId,
      query: "",
      quantity: item.quantity,
      unitPrice: listed == null ? "" : String(listed),
      priceTouched: false,
      variant: "",
      discount: "",
    });
    used.add(item.skuId);
  }
  return next;
}

