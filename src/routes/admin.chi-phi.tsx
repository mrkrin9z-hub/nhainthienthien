import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MoneyLinks } from "@/components/admin/sections";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vnMonth, vnYmd } from "@/domain/calc";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId, type WalletId } from "@/domain/money";
import { formatVnd } from "@/lib/brand";
import { getMoneyDesk, removeExpense, saveExpense } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/chi-phi")({
  component: ExpensePage,
});

const control = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

function ExpensePage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <ExpenseBody />
    </RoleGate>
  );
}

function ExpenseBody() {
  const [month, setMonth] = useState(vnMonth());
  const [date, setDate] = useState(vnYmd());
  const [category, setCategory] = useState<ExpenseCategoryId>("vat_tu");
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const rows = (desk.data?.expenses ?? []).filter((row) => filter === "all" || row.category === filter);

  async function refresh(nextMonth = month) {
    await queryClient.invalidateQueries({ queryKey: ["money", nextMonth] });
  }

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Chi phí</h1>
        <p className="mt-1 text-sm text-muted-foreground">Ghi khoản chi theo ngày, nhóm và ví. Tiền trừ vào ví đã chọn và vào lợi nhuận tháng đó.</p>
      </div>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section className="order-2 space-y-3 lg:order-1 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-primary">Danh sách chi phí</h2>
            <Input className="min-h-11 max-w-xs" type="month" aria-label="Tháng chi phí" value={month} onChange={(e) => setMonth(e.target.value)} />
            <select className={control + " max-w-xs"} aria-label="Lọc nhóm" value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="all">Tất cả nhóm</option>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
              <option value="">Chưa phân nhóm</option>
            </select>
          </div>
          {desk.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
          {desk.isError ? <p className="font-semibold text-destructive">{(desk.error as Error).message}</p> : null}
          {desk.data && rows.length === 0 ? <p className="glass-card rounded-3xl p-4 text-sm">Chưa có chi phí nào trong tháng này.</p> : null}
          <ul className="space-y-2">
            {rows.map((row) => (
              <li key={row.id} className="glass-card flex flex-wrap items-center gap-3 rounded-3xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{row.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {vnYmd(row.at) || row.month} · {row.categoryLabel} · {row.walletLabel}
                    {row.note ? ` · ${row.note}` : ""}
                  </p>
                </div>
                <p className="font-extrabold text-primary">{formatVnd(row.amount)}</p>
                <Button
                  variant="outline"
                  className="min-h-11"
                  aria-label={`Xóa ${row.name}`}
                  onClick={async () => {
                    try {
                      await removeExpense({ data: { id: row.id } });
                      toast.success("Đã xóa chi phí");
                      await refresh();
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Xóa
                </Button>
              </li>
            ))}
          </ul>
        </section>
        <form
          className="glass-card order-1 space-y-3 rounded-3xl p-4 lg:sticky lg:top-20 lg:order-2"
          onSubmit={async (event) => {
            event.preventDefault();
            setBusy(true);
            try {
              await saveExpense({
                data: {
                  month: date.slice(0, 7),
                  date,
                  name,
                  amount: Math.round(Number(amount)),
                  note,
                  category,
                  wallet,
                },
              });
              const nextMonth = date.slice(0, 7);
              setName("");
              setAmount("");
              setNote("");
              setMonth(nextMonth);
              toast.success("Đã tạo chi phí");
              await refresh(nextMonth);
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="font-bold text-primary">Nhập chi phí mới</h2>
          <label className="block text-sm font-semibold">
            Ngày chi
            <Input className="mt-1 min-h-11" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Nhóm
            <select className={control + " mt-1"} aria-label="Nhóm chi phí" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategoryId)}>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div>
            <p className="mb-1 text-sm font-semibold">Chi từ ví</p>
            <WalletToggle value={wallet} onChange={setWallet} />
          </div>
          <label className="block text-sm font-semibold">
            Số tiền
            <Input className="mt-1 min-h-11" inputMode="numeric" required placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="block text-sm font-semibold">
            Diễn giải
            <Input className="mt-1 min-h-11" required minLength={2} placeholder="Mua gì, trả cho ai" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="block text-sm font-semibold">
            Ghi chú
            <Input className="mt-1 min-h-11" placeholder="Số hóa đơn, nếu có" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button className="min-h-11 w-full" type="submit" disabled={busy}>
            Tạo chi phí
          </Button>
        </form>
      </div>
    </div>
  );
}
