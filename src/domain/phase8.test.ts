import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { moneyLeaks } from "./access.ts";
import { materialForecast } from "./forecast.ts";
import { kpiForActor, saleKpi } from "./kpi.ts";
import { businessReport, weekStart } from "./report.ts";
import { vnMonth } from "./calc.ts";
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
  assert.equal(report.gross, 97000);
  assert.equal(report.fixedSum, 23900000);
  assert.equal(report.fixedCharged, 0);
  assert.equal(report.extraSum, 0);
  assert.deepEqual(report.extras, []);
  assert.equal(report.net, 97000);
  const withExtra = businessReport(
    shop({
      skus: [sku],
      orders: [done],
      expenses: [
        { id: "e1", month: "2026-10", name: "Điện phát sinh", amount: 50000, note: "hóa đơn", at: "", by: null },
        { id: "e2", month: "2026-09", name: "Tháng trước", amount: 999000, note: "", at: "", by: null },
      ],
    }),
    "2026-10",
  );
  assert.equal(withExtra.extraSum, 50000);
  assert.equal(withExtra.extras[0]?.name, "Điện phát sinh");
  assert.equal(withExtra.net, 97000 - 50000);
  assert.equal(withExtra.breakEvenPercent, report.breakEvenPercent);
  assert.equal(report.breakEvenPercent, Math.round((100000 / 45126608) * 1000) / 10);
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

test("KPI sale: mặc định hoa hồng toàn tiệm, chuyển được theo đơn", () => {
  const staff = [
    { id: "sale-1", name: "Sale A", role: "sale", active: true },
    { id: "sale-2", name: "Sale B", role: "sale", active: true },
  ] as Staff[];
  const orders = [
    {
      id: "o1",
      status: "xong",
      total: 200000,
      createdAt: "2026-10-05T01:00:00.000Z",
      updatedAt: "2026-10-05T01:30:00.000Z",
      completedAt: "2026-10-05T01:30:00.000Z",
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
      updatedAt: "2026-10-06T02:00:00.000Z",
      completedAt: "2026-10-06T02:00:00.000Z",
      history: [{ at: "2026-10-06T02:00:00.000Z", from: "nhan_don", to: "in", by: "sale-2", note: "" }],
    } as Order,
  ];
  const rows = saleKpi(shop({ staff, orders }), "2026-10");
  const mine = rows.find((row) => row.staffId === "sale-1");
  assert.equal(mine?.orders, 1);
  assert.equal(mine?.basis, "shop");
  assert.equal(mine?.commissionRevenue, 1100000);
  assert.equal(mine?.commission, 33000);
  assert.equal(mine?.avgReplyMinutes, 30);
  assert.equal(rows.find((row) => row.staffId === "sale-2")?.commissionRevenue, 1100000);
  assert.deepEqual(moneyLeaks("sale", rows), []);
  const handled = saleKpi(shop({ staff, orders, settings: { ...DEFAULT_SETTINGS, commissionBasis: "handled" } }), "2026-10");
  assert.equal(handled.find((row) => row.staffId === "sale-1")?.basis, "handled");
  assert.equal(handled.find((row) => row.staffId === "sale-1")?.commissionRevenue, 200000);
  assert.equal(handled.find((row) => row.staffId === "sale-1")?.commission, 6000);
  assert.equal(handled.find((row) => row.staffId === "sale-2")?.commissionRevenue, 900000);
  assert.equal(handled.find((row) => row.staffId === "sale-2")?.commission, 27000);
  const own = kpiForActor("sale", "sale-1", rows);
  assert.equal(own.length, 1);
  assert.equal(own[0]?.commissionRevenue, null);
  assert.equal(own[0]?.commission, 33000);
  assert.equal(kpiForActor("owner", "staff-owner", rows)[0]?.commissionRevenue, 1100000);
  const ownHandled = kpiForActor("sale", "sale-1", handled);
  assert.equal(ownHandled[0]?.commissionRevenue, 200000);
});

test("KPI, tổng quan, lương và Excel gọi cùng commissionForSale", () => {
  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  const kpi = read("./kpi.ts");
  const views = read("./views.ts");
  const service = read("../server/service.ts");
  const session = read("../server/session.ts");
  for (const source of [kpi, views, service]) assert.match(source, /commissionForSale\(/);
  assert.match(service, /kpiForActor\(/);
  assert.doesNotMatch(kpi, /commissionOf\(/);
  assert.doesNotMatch(views, /commissionOf\(/);
  assert.doesNotMatch(service, /commissionOf\(/);
  const payroll = service.slice(service.indexOf("function payrollRow"), service.indexOf("export async function payroll"));
  assert.match(payroll, /commissionForSale\(/);
  const excel = service.slice(service.indexOf('kind === "payroll"'), service.indexOf('kind === "profit"'));
  assert.match(excel, /payrollRow\(/);
  assert.doesNotMatch(excel, /commissionOf\(/);
  const limit = read("./login-limit.ts");
  const calc = read("./calc.ts");
  assert.match(limit, /login_fail:/);
  assert.match(limit, /login_fail_ip:/);
  assert.match(limit, /LOGIN_IP_FAIL_LIMIT = 30/);
  assert.match(service, /loginFailKey\(/);
  assert.match(service, /loginFailIpKey\(/);
  assert.match(service, /expirationTtl: LOGIN_FAIL_TTL_SECONDS/);
  assert.match(service, /khongtontai-locktest@example\.invalid/);
  assert.match(service, /auth\.fail/);
  const failure = service.slice(service.indexOf("async function noteLoginFailure"), service.indexOf("export async function login"));
  assert.match(failure, /auth\.lock/);
  assert.match(failure, /if \(!emailLocked && !ipLocked\) return;/);
  assert.doesNotMatch(failure, /auth\.fail/);
  const loginFn = service.slice(service.indexOf("export async function login"), service.indexOf("export async function changePassword"));
  assert.match(loginFn, /auth\.login/);
  assert.doesNotMatch(loginFn, /auth\.fail/);
  assert.doesNotMatch(loginFn, /state\.audits/);
  const revenue = calc.slice(calc.indexOf("export function collectedRevenue"), calc.indexOf("export function priceOf"));
  assert.match(revenue, /vnMonth\(/);
  assert.doesNotMatch(revenue, /slice\(0,\s*7\)/);
  const ordersFn = service.slice(service.indexOf("export async function listOrders"), service.indexOf("export async function getOrder"));
  assert.match(ordersFn, /isProductionStep\(/);
  assert.match(service, /vnMonth\(/);
  assert.doesNotMatch(service, /inAt\.slice\(0, 7\)/);
  assert.doesNotMatch(service, /completedAt \?\? ""\)\.startsWith/);
  assert.match(service, /imageBytesMatch\(/);
  const octoberNight = "2026-10-31T16:30:00.000Z";
  assert.equal(vnMonth(octoberNight), "2026-10");
  const edge = businessReport(
    shop({
      orders: [
        {
          id: "edge",
          status: "xong",
          channel: "tai_tiem",
          createdAt: octoberNight,
          completedAt: octoberNight,
          updatedAt: octoberNight,
          total: 40000,
          items: [],
        } as Order,
      ],
    }),
    "2026-10",
  );
  assert.equal(edge.revenue, 40000);
  assert.equal(edge.orderCount, 1);
  assert.match(session, /NODE_ENV !== "development"/);
});
