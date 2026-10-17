import assert from "node:assert/strict";
import test from "node:test";

import { moneyLeaks } from "./access.ts";
import { materialForecast } from "./forecast.ts";
import { saleKpi } from "./kpi.ts";
import { businessReport, weekStart } from "./report.ts";
import { DEFAULT_SETTINGS } from "./seed.ts";
import type { Material, Movement, Order, ShopState, Sku, Staff } from "./types.ts";

function shop(partial: Partial<ShopState>): ShopState {
  return {
    settings: DEFAULT_SETTINGS,
    staff: [],
    skus: [],
    boms: [],
    materials: [],
    customers: [],
    orders: [],
    movements: [],
    monthlyFixed: [],
    ...partial,
  } as ShopState;
}

test("báo cáo: lãi ròng trừ chi phí cố định và tỉ lệ hủy", () => {
  const sku = { id: "sku", size: "13x18", sheets: 1, code: "TG", name: "13x18" } as Sku;
  const done = {
    id: "o1",
    status: "xong",
    channel: "tai_tiem",
    createdAt: "2026-10-02T02:00:00.000Z",
    completedAt: "2026-10-02T08:00:00.000Z",
    updatedAt: "2026-10-02T08:00:00.000Z",
    total: 100000,
    items: [{ id: "i", skuId: "sku", name: "Ép gỗ — 13x18", quantity: 2, unitPrice: 50000, lineTotal: 100000 }],
  } as Order;
  const cancelled = { ...done, id: "o2", status: "huy", total: 50000, completedAt: null } as Order;
  const report = businessReport(shop({ skus: [sku], orders: [done, cancelled] }), "2026-10", "day");
  assert.equal(report.revenue, 100000);
  assert.equal(report.orderCount, 1);
  assert.equal(report.averageOrder, 100000);
  assert.equal(report.gross, 92600);
  assert.equal(report.fixedSum, 29400000);
  assert.equal(report.net, 92600 - 29400000);
  assert.equal(report.breakEvenPercent, Math.round((92600 / 29400000) * 1000) / 10);
  assert.equal(report.cancelled, 1);
  assert.equal(report.placed, 2);
  assert.equal(report.cancelRate, 50);
  assert.equal(report.bySize[0]?.size, "13x18");
  assert.equal(report.topProducts[0]?.name, "Ép gỗ — 13x18");
  assert.equal(report.byChannel[0]?.channel, "tai_tiem");
  assert.equal(report.series[0]?.key, "2026-10-02");
  assert.equal(weekStart("2026-10-17"), "2026-10-12");
  const week = businessReport(shop({ skus: [sku], orders: [done] }), "2026-10", "week");
  assert.equal(week.series[0]?.key, "2026-09-28");
});

test("dự báo vật tư theo 30 ngày trừ kho", () => {
  const now = new Date("2026-10-17T00:00:00.000Z");
  const material = { id: "pp", name: "Giấy", unit: "m", stock: 5, leadTimeDays: 7 } as Material;
  const movements: Movement[] = [
    { id: "a", at: "2026-10-16T00:00:00.000Z", materialId: "pp", qty: -30, reason: "Trừ kho khi vào bước in", orderId: "o", by: null, note: "" },
    { id: "b", at: "2026-10-16T01:00:00.000Z", materialId: "pp", qty: 10, reason: "Nhập hàng", orderId: null, by: null, note: "" },
    { id: "c", at: "2026-09-01T00:00:00.000Z", materialId: "pp", qty: -100, reason: "Trừ kho khi vào bước in", orderId: "old", by: null, note: "" },
  ];
  const [row] = materialForecast({ materials: [material], movements }, now);
  assert.equal(row?.used, 30);
  assert.equal(row?.avgDaily, 1);
  assert.equal(row?.daysLeft, 5);
  assert.equal(row?.reorder, true);
});

test("KPI sale chỉ tính đơn chính mình xử lý", () => {
  const state = shop({
    staff: [
      { id: "sale-1", name: "Sale A", role: "sale", active: true },
      { id: "sale-2", name: "Sale B", role: "sale", active: true },
    ] as Staff[],
    orders: [
      {
        id: "o1",
        status: "xong",
        total: 200000,
        createdAt: "2026-10-05T01:00:00.000Z",
        history: [
          { at: "2026-10-05T01:00:00.000Z", from: null, to: "nhan_don", by: "sale-1", note: "" },
          { at: "2026-10-05T01:30:00.000Z", from: "nhan_don", to: "thiet_ke", by: "sale-1", note: "" },
        ],
      } as Order,
      {
        id: "o2",
        status: "xong",
        total: 900000,
        createdAt: "2026-10-06T01:00:00.000Z",
        history: [{ at: "2026-10-06T02:00:00.000Z", from: "nhan_don", to: "in", by: "sale-2", note: "" }],
      } as Order,
    ],
  });
  const rows = saleKpi(state, "2026-10");
  const mine = rows.find((row) => row.staffId === "sale-1");
  assert.equal(mine?.orders, 1);
  assert.equal(mine?.commissionRevenue, 200000);
  assert.equal(mine?.commission, 6000);
  assert.equal(mine?.avgReplyMinutes, 30);
  assert.equal(rows.find((row) => row.staffId === "sale-2")?.commissionRevenue, 900000);
  assert.deepEqual(moneyLeaks("sale", rows), []);
});
