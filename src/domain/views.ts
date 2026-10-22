import { fixedCostsApply, isWeeklyOff, kpiTarget, quoteSku, vnParts, vnYmd, vnMonth } from "./calc.ts";
import { commissionForSale } from "./commission.ts";
import { materialForecast } from "./forecast.ts";
import { depositEvents, remainOf } from "./money.ts";
import { bankLabel, deskAlerts, hasPackingPhoto, itemChangeNote, transferQrUrl } from "./print-shop.ts";
import { orderShipping } from "./shipping.ts";
import type { Order, OrderStatus, Role, ShopState } from "./types.ts";
import { CHANNEL_LABEL, STATUS_LABEL, STATUS_REPLY } from "./types.ts";

export type Viewer = { id: string; name: string; role: Role };

export function customerName(state: ShopState, id: string): { name: string; phone: string } {
  const customer = state.customers.find((item) => item.id === id);
  return { name: customer?.name ?? "", phone: customer?.phone ?? "" };
}

export function isLate(state: ShopState, order: Order, clock = vnParts()): boolean {
  if (!["facebook", "tiktok", "shopee"].includes(order.channel)) return false;
  if (["giao", "xong", "huy", "draft_upload", "upload_error"].includes(order.status)) return false;
  const created = vnParts(new Date(order.createdAt));
  if (created.ymd < clock.ymd) return true;
  return created.hm <= state.settings.marketplaceCutoff && clock.hm > state.settings.marketplaceHandover;
}

export function orderSummary(state: ShopState, order: Order, role: Role) {
  const customer = customerName(state, order.customerId);
  const showMoney = role !== "production";
  return {
    id: order.id,
    code: order.code,
    status: order.status,
    statusLabel: STATUS_LABEL[order.status],
    createdAt: order.createdAt,
    channel: order.channel,
    channelLabel: CHANNEL_LABEL[order.channel],
    source: order.source,
    customerName: customer.name,
    recipientName: order.recipientName ?? "",
    phone: customer.phone,
    address: order.address,
    itemSummary: order.items.map((item) => `${item.quantity}× ${item.name}`).join(", "),
    total: showMoney ? order.total : null,
    depositPaid: showMoney ? order.depositPaid : null,
    remain: showMoney ? remainOf(order) : null,
    isTest: Boolean(order.isTest),
    late: isLate(state, order),
    fileCount: order.files.filter((file) => !file.deletedAt && file.status === "complete").length,
    fulfillment: order.fulfillment,
    dueDate: order.dueDate,
  };
}

function fixedAmount(state: ShopState, month: string, key: string, fallback: number): number {
  return state.monthlyFixed.find((row) => row.month === month && row.key === key)?.amount ?? fallback;
}

export function fixedRows(state: ShopState, month: string) {
  return state.settings.fixedCosts.map((row) => ({
    ...row,
    amount: fixedAmount(state, month, row.key, row.amount),
  }));
}

export function fixedTotal(state: ShopState, month: string): number {
  return fixedRows(state, month).reduce((sum, row) => sum + row.amount, 0);
}

export function extraTotal(state: ShopState, month: string): number {
  return (state.expenses ?? []).filter((row) => row.month === month).reduce((sum, row) => sum + row.amount, 0);
}

export function buildDashboard(state: ShopState, actor: Viewer) {
  const clock = vnParts();
  const visible = state.orders.filter((order) => order.status !== "draft_upload");
  const byStatus = (["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao", "xong", "huy"] as OrderStatus[]).map(
    (status) => ({ status, label: STATUS_LABEL[status], count: visible.filter((order) => order.status === status).length }),
  );
  const late = visible.filter((order) => isLate(state, order, clock)).map((order) => orderSummary(state, order, actor.role));
  const prefs = state.settings.notifyPrefs;
  const alerts = deskAlerts(
    visible.map((order) => orderSummary(state, order, actor.role)),
    Date.now(),
  ).filter((alert) => {
    if (!prefs) return true;
    if (alert.kind === "tre") return prefs.lateOrders !== false;
    if (alert.kind === "san") return prefs.marketplaceNew !== false;
    return true;
  });
  const lowStock = state.materials
    .filter((material) => material.minStock !== null && material.stock > 0 && material.stock <= material.minStock)
    .map((material) => ({ id: material.id, name: material.name, stock: material.stock, unit: material.unit, min: material.minStock }));
  const onShift = state.staff
    .filter((person) =>
      state.punches.some((punch) => punch.staffId === person.id && !punch.outAt && vnYmd(punch.inAt) === clock.ymd),
    )
    .map((person) => ({ id: person.id, name: person.name, role: person.role }));
  const mineToday = state.punches.find((punch) => punch.staffId === actor.id && !punch.outAt && vnYmd(punch.inAt) === clock.ymd) ?? null;
  const stalePunch = state.punches.find((punch) => punch.staffId === actor.id && !punch.outAt && vnYmd(punch.inAt) !== clock.ymd) ?? null;
  const clockedInAt = mineToday?.inAt ?? null;
  const clockedIn = Boolean(mineToday);
  const stalePunchAt = stalePunch?.inAt ?? null;
  if (actor.role === "production") {
    return {
      role: actor.role,
      name: actor.name,
      byStatus: byStatus.filter((row) => ["thiet_ke", "cho_duyet", "in", "dong_goi", "giao"].includes(row.status)),
      queue: visible
        .filter((order) => ["thiet_ke", "cho_duyet", "in", "dong_goi"].includes(order.status))
        .map((order) => orderSummary(state, order, actor.role)),
      late,
      alerts,
      lowStock,
      onShift: onShift.filter((person) => person.id === actor.id),
      clockedIn,
      clockedInAt,
      stalePunchAt,
    };
  }
  if (actor.role === "sale") {
    const pay = commissionForSale(state, actor.id, clock.month);
    const target = kpiTarget(state.settings.shopOpenDate, clock.month, state.settings.kpiTargets);
    return {
      role: actor.role,
      name: actor.name,
      byStatus,
      late,
      alerts,
      lowStock,
      onShift,
      clockedIn,
      clockedInAt,
      stalePunchAt,
      orders: visible.slice(0, 12).map((order) => orderSummary(state, order, actor.role)),
      kpiPercent: target > 0 ? Math.round((pay.revenue / target) * 1000) / 10 : null,
      commission: pay.commission,
      commissionBasis: pay.basis,
    };
  }
  const doneMonth = state.orders.filter(
    (order) => order.status === "xong" && !order.isTest && vnMonth(order.completedAt ?? "") === clock.month,
  );
  const revenueMonth = doneMonth.reduce((sum, order) => sum + (order.total ?? 0), 0);
  const revenueToday = doneMonth
    .filter((order) => vnYmd(order.completedAt ?? "") === clock.ymd)
    .reduce((sum, order) => sum + (order.total ?? 0), 0);
  let gross = 0;
  let grossIncomplete = false;
  for (const order of doneMonth) {
    for (const item of order.items) {
      const sku = state.skus.find((row) => row.id === item.skuId);
      if (!sku || item.unitPrice === null) {
        grossIncomplete = true;
        continue;
      }
      const quote = quoteSku({
        sku,
        price: item.unitPrice * item.quantity,
        channel: order.channel,
        settings: state.settings,
        boms: state.boms,
        materials: state.materials,
        affiliate: false,
      });
      if (quote.profit === null) grossIncomplete = true;
      else gross += quote.profit;
    }
  }
  const fixed = fixedTotal(state, clock.month);
  const beforeOpen = !fixedCostsApply(state.settings.shopOpenDate, clock.month);
  const dayOff = isWeeklyOff(clock.ymd, state.settings.weeklyOff);
  const workingDays = state.settings.workingDays || 26;
  const dayTarget = workingDays > 0 ? Math.round(state.settings.breakevenMonth / workingDays) : state.settings.breakevenDay;
  const fixedCharged = beforeOpen ? 0 : fixed;
  return {
    role: actor.role,
    name: actor.name,
    byStatus,
    late,
    alerts,
    lowStock,
    onShift,
    clockedIn,
    clockedInAt,
    stalePunchAt,
    revenueToday,
    revenueMonth,
    breakevenPercent: state.settings.breakevenMonth ? Math.round((revenueMonth / state.settings.breakevenMonth) * 1000) / 10 : null,
    todayGap: beforeOpen || dayOff ? 0 : Math.max(0, dayTarget - revenueToday),
    beforeOpen,
    dayOff,
    gross: Math.round(gross),
    grossIncomplete,
    fixed,
    fixedCharged,
    profit: grossIncomplete ? null : Math.round(gross - fixedCharged - extraTotal(state, clock.month)),
    orders: visible.slice(0, 12).map((order) => orderSummary(state, order, actor.role)),
  };
}

const OPEN_STATUS = new Set(["nhan_don", "thiet_ke", "cho_duyet", "in", "dong_goi", "giao"]);
const MAKE_STATUS = new Set(["thiet_ke", "cho_duyet", "in", "dong_goi"]);

/** Số trên menu. Đơn thử và đơn nháp không tính. */
export function navCounts(state: ShopState): Record<string, number> {
  const orders = state.orders.filter((order) => order.status !== "draft_upload" && order.status !== "upload_error" && !order.isTest);
  const open = orders.filter((order) => OPEN_STATUS.has(order.status)).length;
  const making = orders.filter((order) => MAKE_STATUS.has(order.status)).length;
  const delivery = orders.filter((order) => order.fulfillment === "delivery" && (order.status === "dong_goi" || order.status === "giao")).length;
  const cod = orders.filter((order) => {
    const amount = order.shipping?.codAmount ?? 0;
    return order.status !== "huy" && amount > 0 && !order.shipping?.codReceivedAt;
  }).length;
  const low = state.materials.filter((material) => material.minStock !== null && material.stock > 0 && material.stock <= material.minStock).length;
  const chat = (state.chatConversations ?? []).reduce((sum, row) => sum + (row.unreadCount > 0 ? row.unreadCount : 0), 0);
  return {
    "/admin/don-hang": open,
    "/admin/chat": chat,
    "/admin/giao-hang": delivery,
    "/admin/cod": cod,
    "/admin/san-xuat": making,
    "/admin/cong-viec": open,
    "/admin/kho": low,
  };
}

export function stockLabel(material: { stock: number; minStock: number | null; openingCounted?: boolean }): string {
  if (material.stock < 0) return "Tồn âm — chưa nhập tồn đầu";
  if (material.stock === 0 && material.openingCounted !== true) return "Chưa đếm";
  if (material.minStock !== null && material.stock <= material.minStock) return "Sắp hết";
  return "Đủ";
}

export function inventoryView(state: ShopState, role: Role) {
  const showCost = role === "owner";
  const forecast = new Map(materialForecast(state).map((row) => [row.materialId, row]));
  return {
    materials: state.materials.map((material) => ({
      id: material.id,
      name: material.name,
      buyLabel: material.buyLabel,
      unit: material.unit,
      stock: material.stock,
      stockLabel: stockLabel(material),
      minStock: material.minStock,
      supplier: material.supplier,
      avgDaily: forecast.get(material.id)?.avgDaily ?? 0,
      daysLeft: forecast.get(material.id)?.daysLeft ?? null,
      leadTimeDays: forecast.get(material.id)?.leadTimeDays ?? 7,
      reorder: forecast.get(material.id)?.reorder ?? false,
      ...(showCost
        ? { packSize: material.packSize, packPrice: material.packPrice, pendingPrice: material.pendingPrice }
        : {}),
      low: material.minStock !== null && material.stock <= material.minStock,
    })),
    movements: state.movements.slice(0, 80).map((move) => ({
      id: move.id,
      at: move.at,
      materialId: move.materialId,
      qty: move.qty,
      reason: move.reason,
      orderId: move.orderId,
      note: move.note,
      materialName: state.materials.find((item) => item.id === move.materialId)?.name ?? move.materialId,
      byName: state.staff.find((item) => item.id === move.by)?.name ?? "",
    })),
    counts: state.counts.slice(0, 40),
  };
}

export function orderDetail(state: ShopState, order: Order, role: Role) {
  const showMoney = role !== "production";
  const quote =
    role === "owner"
      ? order.items.map((item) => {
          const sku = state.skus.find((row) => row.id === item.skuId);
          if (!sku) return null;
          const priced = sku.sheets > 0 ? { ...sku, sheets: sku.sheets * item.quantity } : sku;
          return quoteSku({
            sku: priced,
            price: item.lineTotal,
            channel: order.channel,
            settings: state.settings,
            boms: state.boms,
            materials: state.materials,
            affiliate: false,
          });
        })
      : null;
  return {
    ...orderSummary(state, order, role),
    customerNote: order.customerNote,
    internalNote: role === "production" ? "" : order.internalNote,
    dueDate: order.dueDate,
    marketplaceCode: order.marketplaceCode,
    shipping: (() => {
      const ship = orderShipping(order);
      return {
        ...ship,
        shipFee: showMoney ? ship.shipFee : null,
        codAmount: showMoney ? ship.codAmount : null,
        codReceivedAt: showMoney ? ship.codReceivedAt : null,
      };
    })(),
    discount: showMoney ? (order.discount ?? null) : null,
    depositRequired: showMoney ? order.depositRequired : null,
    depositPaid: showMoney ? order.depositPaid : null,
    depositMethod: showMoney ? order.depositMethod : "",
    items: order.items.map((item) => ({
      ...item,
      unitPrice: showMoney ? item.unitPrice : null,
      lineTotal: showMoney ? item.lineTotal : null,
      listUnitPrice: showMoney ? (item.listUnitPrice ?? null) : null,
    })),
    subtotal: showMoney ? order.subtotal : null,
    reply: STATUS_REPLY[order.status],
    history: order.history.map((item) => ({
      ...item,
      byName: state.staff.find((person) => person.id === item.by)?.name ?? "Khách / hệ thống",
      toLabel: STATUS_LABEL[item.to],
    })),
    files: order.files.filter((file) => !file.deletedAt),
    payments: showMoney
      ? depositEvents({
          id: order.id,
          code: order.code,
          customerName: "",
          status: order.status,
          total: order.total,
          depositPaid: order.depositPaid,
          depositMethod: order.depositMethod,
          depositBy: order.depositBy,
          createdAt: order.createdAt,
          ...(order.payments ? { payments: order.payments } : {}),
        }).map((payment) => ({
          at: payment.at,
          amount: payment.amount,
          method: payment.method,
          byName: state.staff.find((person) => person.id === payment.by)?.name ?? "",
        }))
      : [],
    transfer: (() => {
      if (!showMoney || order.channel === "tiktok" || order.channel === "shopee" || !state.settings.bank || order.total === null) return null;
      const amount = order.total - order.depositPaid;
      const image = transferQrUrl({ bank: state.settings.bank, amount, code: order.code });
      if (!image) return null;
      return { image, content: order.code, bank: bankLabel(state.settings.bank.id), holder: state.settings.bank.holder, amount };
    })(),
    packCheck: order.packCheck ?? { ep: false, bo: false, tem: false },
    hasPackingPhoto: hasPackingPhoto(order.files),
    feedback: order.feedback ?? null,
    itemChanges: (order.itemChanges ?? []).flatMap((change) => {
      const note = itemChangeNote(change.before, change.after, showMoney);
      if (!note) return [];
      return [
        {
          at: change.at,
          byName: state.staff.find((person) => person.id === change.by)?.name ?? "",
          note,
        },
      ];
    }),
    reprints: state.reprints
      .filter((item) => item.orderId === order.id)
      .map((item) => (role === "owner" ? item : { ...item, extraCost: null })),
    stockWarning: order.stockWarning,
    quote,
    customerId: order.customerId,
    printDeducted: order.printDeducted,
    packDeducted: order.packDeducted,
  };
}
