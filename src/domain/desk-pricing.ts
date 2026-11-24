import type { Channel } from "./types.ts";
import { lineAmount } from "./calc.ts";

export type PricedSku = {
  id: string;
  prices?: Partial<Record<Channel, number | null>>;
  minTotals?: Partial<Record<Channel, number | null>>;
};

export type DeskLineDraft = {
  skuId: string;
  quantity: number;
  unitPrice: string;
  priceTouched: boolean;
};

/** Giá niêm yết của SKU trên kênh đang chọn. */
export function listedPriceForChannel(sku: PricedSku | undefined, channel: Channel): number | null {
  if (!sku) return null;
  const value = sku.prices?.[channel];
  return typeof value === "number" ? value : null;
}

/** Kênh Mơ Home chỉ bán lẻ, không áp dụng số lượng / thành tiền tối thiểu. */
export function channelMinTotal(channel: Channel, minTotal?: number | null): number | null {
  if (channel === "mo_home") return null;
  return typeof minTotal === "number" && minTotal > 0 ? minTotal : null;
}

export function minTotalForChannel(sku: PricedSku | undefined, channel: Channel): number | null {
  if (!sku) return null;
  return channelMinTotal(channel, sku.minTotals?.[channel]);
}

/** Khi đổi kênh, mọi dòng lấy lại giá và tối thiểu của kênh mới — không giữ giá kênh cũ. */
export function retargetLinesForChannel<T extends DeskLineDraft>(lines: T[], catalog: PricedSku[], channel: Channel): T[] {
  return lines.map((line) => {
    if (!line.skuId) return line;
    const sku = catalog.find((item) => item.id === line.skuId);
    const listed = listedPriceForChannel(sku, channel);
    return { ...line, unitPrice: listed === null ? "" : String(listed), priceTouched: false };
  });
}

export function lineTotalForChannel(sku: PricedSku | undefined, channel: Channel, quantity: number, typedUnit?: number | null): number | null {
  const unit = typedUnit ?? listedPriceForChannel(sku, channel);
  return lineAmount(unit, quantity, minTotalForChannel(sku, channel));
}
