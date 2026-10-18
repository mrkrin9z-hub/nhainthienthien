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
import type { WalletId } from "@/domain/money";
import { formatVnd } from "@/lib/brand";
import { getMoneyDesk, saveWalletAdjust } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/vi")({
  component: WalletPage,
});

const KIND_LABEL = { thu: "Thu", chi: "Chi", dieu_chinh: "Điều chỉnh" } as const;

function WalletPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <WalletBody />
    </RoleGate>
  );
}

function signed(amount: number) {
  const body = formatVnd(Math.abs(amount));
  if (amount > 0) return `+${body}`;
  if (amount < 0) return `−${body}`;
  return body;
}

function WalletBody() {
  const [month, setMonth] = useState(vnMonth());
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [direction, setDirection] = useState<"cong" | "tru">("cong");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [filter, setFilter] = useState<"all" | WalletId>("all");
  const [busy, setBusy] = useState(false);
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const lines = (desk.data?.lines ?? []).filter((line) => filter === "all" || line.wallet === filter);

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Ví tiền</h1>
        <p className="mt-1 text-sm text-muted-foreground">Hai nguồn của cả tiệm. Phần dưới là ví từng người: thu cộng vào người bấm thu, chi trừ người ghi chi.</p>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" aria-label="Tháng ví" value={month} onChange={(e) => setMonth(e.target.value)} />
      {desk.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {desk.isError ? <p className="font-semibold text-destructive">{(desk.error as Error).message}</p> : null}
      <section className="grid gap-3 sm:grid-cols-2">
        {(desk.data?.cards ?? []).map((card) => (
          <article key={card.id} className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">{card.label}</h2>
            <p className="mt-1 text-2xl font-extrabold">{formatVnd(card.balance)}</p>
            <p className="mt-1 text-sm text-muted-foreground">
              Tháng này vào {formatVnd(card.inMonth)} · ra {formatVnd(card.outMonth)}
            </p>
          </article>
        ))}
      </section>
      <section className="space-y-2">
        <h2 className="font-bold text-primary">Ví người thu</h2>
        {desk.data && (desk.data.holders ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Chưa có tiền gắn với người thu.</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          {(desk.data?.holders ?? []).map((holder) => (
            <article key={holder.staffId || "none"} className="rounded-md border bg-card p-4">
              <h3 className="font-bold">{holder.name}</h3>
              <p className="mt-1 text-sm">Tiền mặt {formatVnd(holder.tien_mat)}</p>
              <p className="text-sm">Chuyển khoản {formatVnd(holder.chuyen_khoan)}</p>
            </article>
          ))}
        </div>
      </section>
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section className="order-2 space-y-3 lg:order-1 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-primary">Danh sách giao dịch</h2>
            <select className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm" aria-label="Lọc ví" value={filter} onChange={(e) => setFilter(e.target.value as "all" | WalletId)}>
              <option value="all">Cả hai ví</option>
              <option value="tien_mat">Tiền mặt</option>
              <option value="chuyen_khoan">Chuyển khoản</option>
            </select>
          </div>
          {desk.data && lines.length === 0 ? <p className="glass-card rounded-3xl p-4 text-sm">Chưa có giao dịch trong tháng này.</p> : null}
          <ul className="space-y-2">
            {lines.map((line) => (
              <li key={line.id} className="glass-card flex flex-wrap items-center gap-3 rounded-3xl p-4">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{line.label}</p>
                  <p className="text-sm text-muted-foreground">
                    {vnYmd(line.at)} · {KIND_LABEL[line.kind]} · {line.wallet === "chuyen_khoan" ? "Chuyển khoản" : line.wallet === "tien_mat" ? "Tiền mặt" : "Chưa rõ nguồn"}
                    {line.holderName ? ` · ví ${line.holderName}` : ""}
                  </p>
                </div>
                <p className={`font-extrabold ${line.amount < 0 ? "text-destructive" : "text-primary"}`}>{signed(line.amount)}</p>
              </li>
            ))}
          </ul>
        </section>
        <form
          className="glass-card order-1 space-y-3 rounded-3xl p-4 lg:sticky lg:top-20 lg:order-2"
          onSubmit={async (event) => {
            event.preventDefault();
            const value = Math.round(Number(amount));
            if (!value) {
              toast.error("Số tiền điều chỉnh chưa đúng.");
              return;
            }
            setBusy(true);
            try {
              await saveWalletAdjust({
                data: { wallet, amount: direction === "tru" ? -value : value, note },
              });
              setAmount("");
              setNote("");
              toast.success("Đã tạo giao dịch");
              await queryClient.invalidateQueries({ queryKey: ["money", month] });
            } catch (error) {
              toast.error((error as Error).message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h2 className="font-bold text-primary">Tạo giao dịch</h2>
          <p className="text-sm text-muted-foreground">Dùng khi đếm két lệch hoặc chuyển tiền giữa két và tài khoản. Thu đơn và chi phí đã tự vào ví.</p>
          <div>
            <p className="mb-1 text-sm font-semibold">Ví</p>
            <WalletToggle value={wallet} onChange={setWallet} />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={direction === "cong"} className={`min-h-11 rounded-xl border text-sm font-semibold ${direction === "cong" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`} onClick={() => setDirection("cong")}>
              Cộng vào ví
            </button>
            <button type="button" aria-pressed={direction === "tru"} className={`min-h-11 rounded-xl border text-sm font-semibold ${direction === "tru" ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`} onClick={() => setDirection("tru")}>
              Trừ khỏi ví
            </button>
          </div>
          <label className="block text-sm font-semibold">
            Số tiền
            <Input className="mt-1 min-h-11" inputMode="numeric" required placeholder="0" value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
          </label>
          <label className="block text-sm font-semibold">
            Diễn giải
            <Input className="mt-1 min-h-11" placeholder="Vì sao điều chỉnh" value={note} onChange={(e) => setNote(e.target.value)} />
          </label>
          <Button className="min-h-11 w-full" type="submit" disabled={busy}>
            Tạo giao dịch
          </Button>
        </form>
      </div>
    </div>
  );
}
