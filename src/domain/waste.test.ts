import assert from "node:assert/strict";
import test from "node:test";

import { applyStoreMigrations } from "./migrate-shop.ts";
import { businessReport } from "./report.ts";
import { buildSeed, DEFAULT_SETTINGS } from "./seed.ts";
import { syncOrderStock } from "./stock.ts";
import type { Order, ShopState, WasteReport } from "./types.ts";
import { navCounts } from "./views.ts";
import {
  applyStockCount,
  approveWaste,
  confirmWasteDay,
  editWaste,
  ensureWaste,
  previousMonth,
  recordWaste,
  voidWaste,
  WASTE_MOVE_REASON,
  wasteMonth,
} from "./waste.ts";

function ids() {
  let n = 0;
  return () => `w${++n}`;
}

test("báo hỏng trừ một lần, hủy đơn không hoàn, sửa và hủy không trừ trùng", () => {
  const id = ids();
  const at = "2026-10-23T02:00:00.000Z";
  const state = {
    settings: DEFAULT_SETTINGS,
    materials: [
      { id: "tui", name: "Túi", unit: "cái", packSize: 1, packPrice: 500, stock: 10 },
      { id: "giay", name: "Giấy", unit: "tờ", packSize: null, packPrice: 200, stock: 5 },
    ],
    boms: [{ id: "b", skuId: "TG", materialId: "tui", phase: "print", scope: "sheet", qty: 1, formula: "manual" }],
    skus: [{ id: "TG", code: "TG", sheets: 1, widthCm: 13, heightCm: 18 }],
    movements: [],
    counts: [],
    orders: [],
    staff: [{ id: "sx", name: "Sản xuất" }],
    wasteReports: [],
  } as unknown as ShopState;
  const order = {
    id: "o1",
    code: "TT261023-009",
    channel: "facebook",
    items: [{ skuId: "TG", quantity: 2 }],
    printDeducted: false,
    packDeducted: false,
    stockWarning: "",
    status: "nhan_don",
  } as Order;
  state.orders.push(order);

  syncOrderStock(state, order, "in", "sx");
  assert.equal(state.materials[0]?.stock, 8);

  const report = recordWaste(state, {
    materialId: "tui",
    qty: 1,
    reason: "in_loi",
    orderId: "o1",
    by: "sx",
    note: "mép",
    photoId: "p1",
    at,
    id,
  });
  assert.equal(report.day, "2026-10-23");
  assert.equal(report.photoId, "p1");
  assert.equal(report.channel, "facebook");
  assert.equal(state.materials[0]?.stock, 7);
  const move = state.movements[0];
  assert.equal(move?.reason, WASTE_MOVE_REASON);
  assert.equal(move?.qty, -1);
  assert.equal(move?.channel, "facebook");
  assert.equal(move?.wasteId, report.id);

  const loose = recordWaste(state, { materialId: "giay", qty: 1, reason: "roi_vo", orderId: null, by: "sx", at, id });
  assert.equal(loose.orderId, null);
  assert.equal(loose.channel, undefined);
  assert.equal(state.materials[1]?.stock, 4);
  assert.equal(state.movements[0]?.channel, undefined);

  syncOrderStock(state, order, "nhan_don", "sx");
  assert.equal(state.materials[0]?.stock, 9);
  assert.equal(state.wasteReports?.filter((row) => row.reason === "in_loi")[0]?.qty, 1);
  assert.equal(state.movements.filter((row) => row.reason === WASTE_MOVE_REASON && row.materialId === "tui").length, 1);

  syncOrderStock(state, order, "in", "sx");
  assert.equal(state.materials[0]?.stock, 7);
  assert.equal(state.movements.filter((row) => row.wasteId === report.id).length, 1);

  assert.equal(confirmWasteDay(state, report.day, "sx", at), 2);
  assert.equal(state.materials[0]?.stock, 7);
  assert.equal(report.status, "confirmed");
  assert.equal(confirmWasteDay(state, report.day, "sx", at), 0);
  assert.equal(state.materials[0]?.stock, 7);

  approveWaste(state, report.id, "owner", at);
  assert.equal(report.status, "approved");
  approveWaste(state, report.id, "owner", at);
  assert.equal(state.materials[0]?.stock, 7);

  editWaste(state, { id: report.id, qty: 3, reason: "rach", materialId: "tui", note: "thêm" });
  assert.equal(state.materials[0]?.stock, 5);
  assert.equal(state.movements.find((row) => row.id === move?.id)?.qty, -3);
  assert.equal(state.movements.filter((row) => row.wasteId === report.id).length, 1);

  editWaste(state, { id: report.id, qty: 2, reason: "rach", materialId: "giay", note: "đổi giấy" });
  assert.equal(state.materials[0]?.stock, 8);
  assert.equal(state.materials[1]?.stock, 2);
  assert.equal(state.movements.find((row) => row.id === move?.id)?.materialId, "giay");

  voidWaste(state, report.id);
  assert.equal(report.status, "void");
  assert.equal(state.materials[1]?.stock, 4);
  assert.equal(state.movements.find((row) => row.id === move?.id)?.qty, 0);
  voidWaste(state, report.id);
  assert.equal(state.materials[1]?.stock, 4);
  assert.throws(() => recordWaste(state, { materialId: "tui", qty: 1, reason: "chua_ro" as "in_loi", by: null, at, id }), /lý do/);
});

test("kiểm kho thiếu là một phiếu hao hụt chưa rõ lý do", () => {
  const id = ids();
  const at = "2026-10-23T03:00:00.000Z";
  const state = {
    settings: DEFAULT_SETTINGS,
    materials: [{ id: "tui", name: "Túi", stock: 10, openingCounted: false }],
    movements: [],
    counts: [],
    orders: [],
    staff: [],
    wasteReports: [],
  } as unknown as ShopState;

  applyStockCount(state, { materialId: "tui", actual: 8, note: "tuần", by: "sx", at, id });
  assert.equal(state.materials[0]?.stock, 8);
  assert.equal(state.materials[0]?.openingCounted, true);
  assert.equal(state.movements.length, 1);
  assert.equal(state.movements[0]?.reason, WASTE_MOVE_REASON);
  assert.equal(state.movements[0]?.qty, -2);
  assert.equal(state.movements.some((row) => row.reason === "Kiểm kho"), false);
  assert.equal(state.wasteReports?.[0]?.reason, "chua_ro");
  assert.equal(state.wasteReports?.[0]?.qty, 2);
  assert.equal(state.wasteReports?.[0]?.status, "pending");

  applyStockCount(state, { materialId: "tui", actual: 8, note: "tuần", by: "sx", at, id });
  assert.equal(state.materials[0]?.stock, 8);
  assert.equal(state.movements.length, 1);
  assert.equal(state.wasteReports?.length, 1);
  assert.equal(state.counts.length, 2);

  applyStockCount(state, { materialId: "tui", actual: 7, note: "tuần", by: "sx", at, id });
  assert.equal(state.materials[0]?.stock, 7);
  assert.equal(state.wasteReports?.length, 2);
  assert.equal(state.wasteReports?.[0]?.qty, 1);
  assert.equal(state.movements.filter((row) => row.reason === "Kiểm kho").length, 0);

  applyStockCount(state, { materialId: "tui", actual: 9, note: "thừa", by: "sx", at, id });
  assert.equal(state.materials[0]?.stock, 9);
  assert.equal(state.movements[0]?.reason, "Kiểm kho");
  assert.equal(state.movements[0]?.qty, 2);
  assert.equal(state.wasteReports?.filter((row) => row.status !== "void").length, 2);
});

test("hao hụt trừ vào lãi theo kênh và không bịa giá", () => {
  const stamp = "2026-12-05T02:00:00.000Z";
  const done = (channel: "tai_tiem" | "mo_home", total: number): Order =>
    ({
      id: channel,
      status: "xong",
      channel,
      isTest: false,
      createdAt: stamp,
      completedAt: stamp,
      updatedAt: stamp,
      total,
      items: [],
    }) as Order;
  const line = (partial: Partial<WasteReport>): WasteReport =>
    ({
      id: partial.id ?? "x",
      at: stamp,
      day: "2026-12-05",
      materialId: "tui",
      qty: 1,
      reason: "in_loi",
      orderId: null,
      by: "sx",
      note: "",
      photoId: null,
      movementId: "m",
      status: "pending",
      ...partial,
    }) as WasteReport;
  const state = {
    settings: { ...DEFAULT_SETTINGS, wasteAlertPercent: 2 },
    skus: [],
    orders: [done("tai_tiem", 100000), done("mo_home", 80000), { ...done("tai_tiem", 50000), id: "nov", completedAt: "2026-11-05T02:00:00.000Z", createdAt: "2026-11-05T02:00:00.000Z", updatedAt: "2026-11-05T02:00:00.000Z" }],
    expenses: [{ id: "e", month: "2026-12", name: "Điện", amount: 10000, note: "", at: stamp, by: null }],
    monthlyFixed: [],
    materials: [
      { id: "tui", name: "Túi", packPrice: 1000, packSize: 1, stock: 10 },
      { id: "muc", name: "Mực", packPrice: null, packSize: null, stock: 2 },
    ],
    staff: [{ id: "sx", name: "Sản xuất" }],
    wasteReports: [
      line({ id: "free", qty: 2 }),
      line({ id: "home", qty: 1, channel: "mo_home", status: "approved" }),
      line({ id: "shop", qty: 1, channel: "facebook", reason: "lech_vien" }),
      line({ id: "ink", materialId: "muc", qty: 1, reason: "rach", status: "confirmed" }),
      line({ id: "gone", qty: 9, channel: "tai_tiem", status: "void" }),
      line({ id: "nov", qty: 1, day: "2026-11-05", at: "2026-11-05T02:00:00.000Z" }),
    ],
  } as unknown as ShopState;

  const all = businessReport(state, "2026-12", "month", "all");
  const nha = businessReport(state, "2026-12", "month", "nha_in");
  const home = businessReport(state, "2026-12", "month", "mo_home");
  const shop = businessReport(state, "2026-12", "month", "facebook");
  assert.equal(all.wasteCost, 4000);
  assert.equal(all.wasteUnknown, 1);
  assert.equal(all.wasteLines, 4);
  assert.equal(all.wasteRate, 2.2);
  assert.equal(all.wasteAlert, true);
  assert.equal(all.net, -29_400_000 - 10000 - 4000);
  assert.equal(nha.wasteCost, 3000);
  assert.equal(nha.wasteUnknown, 1);
  assert.equal(nha.net, -23_900_000 - 10000 - 3000);
  assert.equal(home.wasteCost, 1000);
  assert.equal(home.net, -5_500_000 - 1000);
  assert.equal(shop.wasteCost, 1000);
  assert.equal(shop.wasteRate, null);
  assert.equal(shop.wasteAlert, false);
  assert.equal(shop.net, -1000);
  assert.equal((nha.net ?? 0) + (home.net ?? 0), all.net);
  assert.equal(all.wasteByReason.some((row) => row.label === "In lỗi"), true);
  assert.equal(all.wasteByPerson[0]?.label, "Sản xuất");
  assert.equal(all.wasteByChannel.some((row) => row.label === "Không thuộc kênh"), true);
  assert.equal(all.wasteByDay[0]?.key, "2026-12-05");
  assert.equal(all.wasteByDay[0]?.cost, 4000);
  assert.equal(all.wasteByDay[0]?.rate, 2.2);
  assert.equal(all.wasteByMaterial.find((row) => row.label === "Túi")?.rate, 2.2);
  assert.equal(all.wasteByReason.find((row) => row.label === "In lỗi")?.cost, 3000);
  assert.equal(all.wasteByReason.find((row) => row.label === "In lỗi")?.rate, 1.7);
  assert.equal(all.wasteDays[0]?.wasteCost, 4000);
  assert.equal(all.wasteDays[0]?.wasteRate, 2.2);
  assert.equal(all.wasteDays[0]?.byChannel.find((row) => row.label === "Mơ Home (nội bộ)")?.cost, 1000);
  assert.equal(all.wastePreviousMonth, "2026-11");
  assert.equal(all.wastePreviousCost, 1000);
  assert.equal(all.wastePreviousRate, 2);
  assert.equal(all.wasteCostDelta, 3000);
  assert.equal(all.wasteRateDelta, 0.2);
  assert.equal(shop.wasteByDay[0]?.rate, null);
  assert.equal(previousMonth("2026-01"), "2025-12");

  const october = {
    ...state,
    settings: { ...DEFAULT_SETTINGS, wasteAlertPercent: 2 },
    orders: [],
    expenses: [],
    wasteReports: [line({ id: "oct", day: "2026-10-05", qty: 2 }), line({ id: "oct-ink", day: "2026-10-05", materialId: "muc" })],
  } as unknown as ShopState;
  const beforeOpen = businessReport(october, "2026-10", "day");
  assert.equal(beforeOpen.fixedCharged, 0);
  assert.equal(beforeOpen.wasteCost, 2000);
  assert.equal(beforeOpen.wasteUnknown, 1);
  assert.equal(beforeOpen.net, -2000);
  assert.equal(beforeOpen.wasteAlert, false);

  const quiet = wasteMonth({ ...state, settings: { ...state.settings, wasteAlertPercent: null } } as ShopState, "2026-12", "all", all.revenue);
  assert.equal(quiet.wasteAlert, false);
  const edge = wasteMonth({ ...state, settings: { ...state.settings, wasteAlertPercent: 2.2 } } as ShopState, "2026-12", "all", all.revenue);
  assert.equal(edge.wasteRate, 2.2);
  assert.equal(edge.wasteAlert, false);
});

test("sổ có sẵn không bị migration hao hụt chạy lại", async () => {
  const seeded = await buildSeed();
  assert.equal(seeded.settings.wasteAlertPercent, null);
  assert.deepEqual(seeded.wasteReports, []);
  assert.equal(applyStoreMigrations(seeded), false);
  recordWaste(seeded, {
    materialId: seeded.materials[0]!.id,
    qty: 1,
    reason: "khac",
    by: "staff-sx",
    at: "2026-10-23T02:00:00.000Z",
    id: ids(),
  });
  assert.equal(navCounts(seeded)["/admin/kho"], seeded.materials.length);

  const box = { settings: {} as { wasteAlertPercent?: number | null }, wasteReports: undefined as undefined | [] };
  assert.equal(ensureWaste(box), true);
  assert.deepEqual(box.wasteReports, []);
  assert.equal(box.settings.wasteAlertPercent, null);
  assert.equal(ensureWaste(box), false);
});
