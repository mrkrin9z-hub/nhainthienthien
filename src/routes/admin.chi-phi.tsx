import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MoneyLinks } from "@/components/admin/sections";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { vnMonth, vnYmd } from "@/domain/calc";
import { EXPENSE_CATEGORIES, type ExpenseCategoryId, type WalletId } from "@/domain/money";
import { formatVnd } from "@/lib/brand";
import { getMe, getMoneyDesk, removeExpense, saveExpense } from "@/lib/admin.functions";

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
  const [filter, setFilter] = useState("all");
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const rows = (desk.data?.expenses ?? []).filter((row) => filter === "all" || row.category === filter);

  async function refresh(nextMonth = month) {
    await queryClient.invalidateQueries({ queryKey: ["money", nextMonth] });
    await queryClient.invalidateQueries({ queryKey: ["collect"] });
  }

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Chi phí</h1>
          <p className="mt-1 text-sm text-muted-foreground">Danh sách khoản chi trong tháng. Bấm nút để ghi một khoản mới.</p>
        </div>
        <Button className="min-h-11" onClick={() => setOpen(true)}>
          Tạo khoản chi
        </Button>
      </div>
      <ExpenseDialog
        open={open}
        payerName={me.data?.name ?? ""}
        onOpenChange={setOpen}
        onSaved={async (nextMonth) => {
          setMonth(nextMonth);
          await refresh(nextMonth);
        }}
      />
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
      {desk.data && rows.length === 0 ? <p className="rounded-md border bg-card p-4 text-sm">Chưa có chi phí nào trong tháng này.</p> : null}
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
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
    </div>
  );
}

function ExpenseDialog({
  open,
  payerName,
  onOpenChange,
  onSaved,
}: {
  open: boolean;
  payerName: string;
  onOpenChange: (open: boolean) => void;
  onSaved: (month: string) => Promise<void>;
}) {
  const [date, setDate] = useState(vnYmd());
  const [category, setCategory] = useState<ExpenseCategoryId>("vat_tu");
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [amount, setAmount] = useState("");
  const [name, setName] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  async function save() {
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
      toast.success("Đã tạo khoản chi");
      onOpenChange(false);
      await onSaved(nextMonth);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo khoản chi</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Trừ vào ví của {payerName || "bạn"}.</p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Ngày chi
            <Input className="mt-1 min-h-11" type="date" required value={date} onChange={(e) => setDate(e.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Nhóm
            <select className={control + " mt-1"} aria-label="Nhóm chi phí" value={category} onChange={(e) => setCategory(e.target.value as ExpenseCategoryId)}>
              {EXPENSE_CATEGORIES.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.label}
                </option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-2">
            <p className="mb-1 text-sm font-semibold">Chi từ ví</p>
            <WalletToggle value={wallet} onChange={setWallet} />
          </div>
          <label className="text-sm font-semibold">
            Số tiền
            <Input className="mt-1 min-h-11" inputMode="numeric" required placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="text-sm font-semibold">
            Diễn giải
            <Input className="mt-1 min-h-11" required minLength={2} placeholder="Mua gì, trả cho ai" value={name} onChange={(e) => setName(e.target.value)} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Ghi chú
            <Input className="mt-1 min-h-11" placeholder="Số hóa đơn, nếu có" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
        </div>
        <DialogFooter>
          <Button className="min-h-11" disabled={busy} onClick={() => void save()}>
            Tạo khoản chi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
