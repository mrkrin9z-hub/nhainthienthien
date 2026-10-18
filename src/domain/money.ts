import { vnMonth } from "./calc.ts";

export const WALLETS = [
  { id: "tien_mat", label: "Tiền mặt" },
  { id: "chuyen_khoan", label: "Chuyển khoản" },
] as const;

export type WalletId = (typeof WALLETS)[number]["id"];

export const EXPENSE_CATEGORIES = [
  { id: "mat_bang", label: "Mặt bằng" },
  { id: "dien_nuoc", label: "Điện nước" },
  { id: "vat_tu", label: "Vật tư" },
  { id: "van_chuyen", label: "Vận chuyển" },
  { id: "nhan_su", label: "Nhân sự" },
  { id: "sua_chua", label: "Sửa chữa" },
  { id: "khac", label: "Khác" },
] as const;

export type ExpenseCategoryId = (typeof EXPENSE_CATEGORIES)[number]["id"];

export function walletLabel(id: string): string {
  return WALLETS.find((item) => item.id === id)?.label ?? "Chưa rõ nguồn";
}

export function categoryLabel(id: string): string {
  return EXPENSE_CATEGORIES.find((item) => item.id === id)?.label ?? (id ? id : "Khác");
}

export function walletOfMethod(method: string): WalletId {
  const text = method.trim().toLowerCase();
  if (
    text.includes("chuyển") ||
    text.includes("chuyen") ||
    text.includes("khoản") ||
    text.includes("khoan") ||
    text.includes("ngân") ||
    text.includes("ngan") ||
    text === "ck"
  ) {
    return "chuyen_khoan";
  }
  return "tien_mat";
}

export type CashPayment = { at: string; amount: number; method: string };

export type CashOrder = {
  id: string;
  code: string;
  customerName: string;
  status: string;
  total: number | null;
  depositPaid: number;
  depositMethod: string;
  createdAt: string;
  payments?: CashPayment[];
};

export type CashExpense = {
  id: string;
  name: string;
  amount: number;
  note: string;
  at: string;
  month: string;
  category?: string;
  wallet?: string;
};

export type CashAdjust = {
  id: string;
  at: string;
  wallet: string;
  amount: number;
  note: string;
};

export type LedgerLine = {
  id: string;
  at: string;
  wallet: WalletId | "";
  amount: number;
  kind: "thu" | "chi" | "dieu_chinh";
  label: string;
};

export function depositEvents(order: CashOrder): CashPayment[] {
  if (order.payments && order.payments.length > 0) return order.payments.filter((row) => row.amount > 0);
  if (order.depositPaid > 0) {
    return [{ at: order.createdAt, amount: order.depositPaid, method: order.depositMethod || "Tiền mặt" }];
  }
  return [];
}

export function remainOf(order: Pick<CashOrder, "total" | "depositPaid">): number | null {
  if (order.total === null) return null;
  return order.total - order.depositPaid;
}

export function ordersToCollect(orders: CashOrder[]): CashOrder[] {
  return orders
    .filter((order) => order.status !== "huy" && order.status !== "draft_upload" && order.status !== "upload_error")
    .filter((order) => {
      const remain = remainOf(order);
      return remain === null || remain > 0;
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function buildLedger(input: { orders: CashOrder[]; expenses: CashExpense[]; adjusts: CashAdjust[] }): LedgerLine[] {
  const lines: LedgerLine[] = [];
  for (const order of input.orders) {
    depositEvents(order).forEach((payment, index) => {
      lines.push({
        id: `${order.id}:${index}`,
        at: payment.at,
        wallet: walletOfMethod(payment.method),
        amount: payment.amount,
        kind: "thu",
        label: `Thu đơn ${order.code}${order.customerName ? ` · ${order.customerName}` : ""}`,
      });
    });
  }
  for (const expense of input.expenses) {
    const wallet = expense.wallet === "tien_mat" || expense.wallet === "chuyen_khoan" ? expense.wallet : "";
    lines.push({
      id: expense.id,
      at: expense.at,
      wallet,
      amount: -Math.abs(expense.amount),
      kind: "chi",
      label: expense.name,
    });
  }
  for (const adjust of input.adjusts) {
    const wallet = adjust.wallet === "tien_mat" || adjust.wallet === "chuyen_khoan" ? adjust.wallet : "";
    if (!wallet || !adjust.amount) continue;
    lines.push({
      id: adjust.id,
      at: adjust.at,
      wallet,
      amount: adjust.amount,
      kind: "dieu_chinh",
      label: adjust.note || "Điều chỉnh ví",
    });
  }
  return lines.sort((a, b) => b.at.localeCompare(a.at));
}

export type StoredPayment = {
  id: string;
  at: string;
  amount: number;
  method: string;
  by: string | null;
};

/** Ghi một lần thu. Khoản cọc cũ chưa có dòng riêng thì chèn một dòng tại lúc tạo đơn, rồi mới cộng khoản mới. */
export function appendCollection(
  order: {
    createdAt: string;
    depositPaid: number;
    depositMethod: string;
    depositBy: string | null;
    payments?: StoredPayment[];
  },
  payment: StoredPayment,
  backfillId: string,
): { payments: StoredPayment[]; depositPaid: number; depositMethod: string; depositBy: string | null } {
  const amount = Math.round(payment.amount);
  const method = payment.method.trim() || "Tiền mặt";
  const existing = order.payments ?? [];
  const payments = existing.length > 0 ? existing.map((row) => ({ ...row })) : [];
  if (payments.length === 0 && order.depositPaid > 0) {
    payments.push({
      id: backfillId,
      at: order.createdAt,
      amount: order.depositPaid,
      method: order.depositMethod || "Tiền mặt",
      by: order.depositBy,
    });
  }
  payments.push({ ...payment, amount, method });
  return {
    payments,
    depositPaid: order.depositPaid + amount,
    depositMethod: method,
    depositBy: payment.by,
  };
}

/** Ngày chi lưu lúc giữa trưa giờ Việt Nam để tháng báo cáo khớp ngày đã chọn. */
export function expenseStamp(ymd: string): { at: string; month: string } {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) throw new Error("Ngày chi chưa đúng.");
  const at = new Date(`${ymd}T12:00:00+07:00`);
  if (Number.isNaN(at.getTime())) throw new Error("Ngày chi chưa đúng.");
  return { at: at.toISOString(), month: vnMonth(at) };
}

export function walletCards(lines: LedgerLine[], month: string) {
  return WALLETS.map((wallet) => {
    const rows = lines.filter((line) => line.wallet === wallet.id);
    const monthRows = rows.filter((line) => vnMonth(line.at) === month);
    return {
      id: wallet.id,
      label: wallet.label,
      balance: rows.reduce((sum, line) => sum + line.amount, 0),
      inMonth: monthRows.filter((line) => line.amount > 0).reduce((sum, line) => sum + line.amount, 0),
      outMonth: monthRows.filter((line) => line.amount < 0).reduce((sum, line) => sum + Math.abs(line.amount), 0),
    };
  });
}

export function expenseReport(expenses: CashExpense[], month: string) {
  const rows = expenses.filter((row) => row.month === month);
  const total = rows.reduce((sum, row) => sum + row.amount, 0);
  const byCategory = EXPENSE_CATEGORIES.map((category) => ({
    id: category.id,
    label: category.label,
    amount: rows.filter((row) => row.category === category.id).reduce((sum, row) => sum + row.amount, 0),
  })).filter((row) => row.amount > 0);
  const uncategorized = rows.filter((row) => !row.category).reduce((sum, row) => sum + row.amount, 0);
  if (uncategorized > 0) byCategory.push({ id: "", label: "Chưa phân nhóm", amount: uncategorized });
  const byWallet = WALLETS.map((wallet) => ({
    id: wallet.id,
    label: wallet.label,
    amount: rows.filter((row) => row.wallet === wallet.id).reduce((sum, row) => sum + row.amount, 0),
  }));
  const unknown = rows.filter((row) => row.wallet !== "tien_mat" && row.wallet !== "chuyen_khoan").reduce((sum, row) => sum + row.amount, 0);
  return { total, count: rows.length, byCategory, byWallet, unknown };
}
