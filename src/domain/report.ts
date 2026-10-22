import { fixedCostsApply, quoteSku, vnMonth, vnYmd } from "./calc.ts";
import { fixedRows } from "./views.ts";
import type { Channel, Order, ShopState } from "./types.ts";
import { CHANNEL_LABEL } from "./types.ts";

export type ReportGrain = "day" | "week" | "month";

export type ReportBucket = {
  key: string;
  label: string;
  orders: number;
  revenue: number;
  gross: number | null;
  incomplete: boolean;
};

export type BusinessReport = {
  month: string;
  grain: ReportGrain;
  revenue: number;
  orderCount: number;
  averageOrder: number | null;
  gross: number | null;
  incomplete: boolean;
  fixedSum: number;
  /** Phần định phí đã tính vào lãi. Trước ngày khai trương thì 0. */
  fixedCharged: number;
  fixed: { key: string; name: string; amount: number; note: string }[];
  extraSum: number;
  extras: { name: string; amount: number; note: string }[];
  net: number | null;
  breakEvenPercent: number | null;
  cancelRate: number | null;
  cancelled: number;
  placed: number;
  series: ReportBucket[];
  byChannel: { channel: Channel; label: string; orders: number; revenue: number; gross: number | null; incomplete: boolean }[];
  bySize: { size: string; qty: number; revenue: number }[];
  topProducts: { name: string; qty: number; revenue: number }[];
};

const OPEN = new Set(["draft_upload", "upload_error"]);

function monthOf(iso: string): string {
  return vnMonth(iso);
}

function ymdOf(iso: string): string {
  return vnYmd(iso);
}

/** Thứ hai đầu tuần, lịch Việt Nam. */
export function weekStart(ymd: string): string {
  const [year, month, day] = ymd.split("-").map(Number);
  const date = new Date(Date.UTC(year!, month! - 1, day));
  const weekday = date.getUTCDay();
  const back = weekday === 0 ? 6 : weekday - 1;
  date.setUTCDate(date.getUTCDate() - back);
  return date.toISOString().slice(0, 10);
}

function doneStamp(order: Order): string {
  return order.completedAt || order.updatedAt || order.createdAt;
}

type LineProfit = { revenue: number; gross: number; incomplete: boolean };

function lineProfit(state: ShopState, order: Order): LineProfit {
  let gross = 0;
  let incomplete = false;
  let revenue = 0;
  for (const item of order.items) {
    revenue += item.lineTotal ?? 0;
    const sku = state.skus.find((row) => row.id === item.skuId);
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
    if (quote.profit === null) incomplete = true;
    else gross += quote.profit;
  }
  return { revenue, gross, incomplete };
}

export function businessReport(state: ShopState, month: string, grain: ReportGrain = "day"): BusinessReport {
  const placedOrders = state.orders.filter((order) => !order.isTest && !OPEN.has(order.status) && monthOf(order.createdAt) === month);
  const cancelled = placedOrders.filter((order) => order.status === "huy").length;
  const done = state.orders.filter((order) => order.status === "xong" && !order.isTest && monthOf(doneStamp(order)) === month);
  const fixed = fixedRows(state, month);
  const fixedSum = fixed.reduce((sum, row) => sum + row.amount, 0);
  const fixedCharged = fixedCostsApply(state.settings.shopOpenDate, month) ? fixedSum : 0;
  const extras = (state.expenses ?? [])
    .filter((row) => row.month === month)
    .map((row) => ({ name: row.name, amount: row.amount, note: row.note }));
  const extraSum = extras.reduce((sum, row) => sum + row.amount, 0);

  let revenue = 0;
  let gross = 0;
  let incomplete = false;
  const series = new Map<string, { orders: number; revenue: number; gross: number; incomplete: boolean }>();
  const channels = new Map<Channel, { orders: number; revenue: number; gross: number; incomplete: boolean }>();
  const sizes = new Map<string, { qty: number; revenue: number }>();
  const products = new Map<string, { qty: number; revenue: number }>();

  for (const order of done) {
    const money = lineProfit(state, order);
    const orderRevenue = order.total ?? money.revenue;
    revenue += orderRevenue;
    if (money.incomplete) incomplete = true;
    else gross += money.gross;
    const stamp = ymdOf(doneStamp(order));
    const key = grain === "month" ? month : grain === "week" ? weekStart(stamp) : stamp;
    const bucket = series.get(key) ?? { orders: 0, revenue: 0, gross: 0, incomplete: false };
    bucket.orders += 1;
    bucket.revenue += orderRevenue;
    if (money.incomplete) bucket.incomplete = true;
    else bucket.gross += money.gross;
    series.set(key, bucket);
    const channel = channels.get(order.channel) ?? { orders: 0, revenue: 0, gross: 0, incomplete: false };
    channel.orders += 1;
    channel.revenue += orderRevenue;
    if (money.incomplete) channel.incomplete = true;
    else channel.gross += money.gross;
    channels.set(order.channel, channel);
    for (const item of order.items) {
      const sku = state.skus.find((row) => row.id === item.skuId);
      const size = sku?.size || "Khác";
      const sizeRow = sizes.get(size) ?? { qty: 0, revenue: 0 };
      sizeRow.qty += item.quantity;
      sizeRow.revenue += item.lineTotal ?? 0;
      sizes.set(size, sizeRow);
      const product = products.get(item.name) ?? { qty: 0, revenue: 0 };
      product.qty += item.quantity;
      product.revenue += item.lineTotal ?? 0;
      products.set(item.name, product);
    }
  }

  const knownGross = incomplete ? null : Math.round(gross);
  return {
    month,
    grain,
    revenue: Math.round(revenue),
    orderCount: done.length,
    averageOrder: done.length ? Math.round(revenue / done.length) : null,
    gross: knownGross,
    incomplete,
    fixedSum,
    fixedCharged,
    fixed,
    extraSum,
    extras,
    net: knownGross === null ? null : knownGross - fixedCharged - extraSum,
    breakEvenPercent:
      state.settings.breakevenMonth > 0 ? Math.round((revenue / state.settings.breakevenMonth) * 1000) / 10 : null,
    cancelRate: placedOrders.length ? Math.round((cancelled / placedOrders.length) * 1000) / 10 : null,
    cancelled,
    placed: placedOrders.length,
    series: [...series.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        label: grain === "week" ? `Tuần ${key}` : key,
        orders: value.orders,
        revenue: Math.round(value.revenue),
        gross: value.incomplete ? null : Math.round(value.gross),
        incomplete: value.incomplete,
      })),
    byChannel: [...channels.entries()].map(([channel, value]) => ({
      channel,
      label: CHANNEL_LABEL[channel],
      orders: value.orders,
      revenue: Math.round(value.revenue),
      gross: value.incomplete ? null : Math.round(value.gross),
      incomplete: value.incomplete,
    })),
    bySize: [...sizes.entries()]
      .map(([size, value]) => ({ size, qty: value.qty, revenue: Math.round(value.revenue) }))
      .sort((a, b) => b.revenue - a.revenue),
    topProducts: [...products.entries()]
      .map(([name, value]) => ({ name, qty: value.qty, revenue: Math.round(value.revenue) }))
      .sort((a, b) => b.revenue - a.revenue || b.qty - a.qty)
      .slice(0, 8),
  };
}
