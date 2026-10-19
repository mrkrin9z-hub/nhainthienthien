import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { MoneyLinks } from "@/components/admin/sections";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vnMonth, vnYmd } from "@/domain/calc";
import { SHOP_TILL_ID, type WalletId } from "@/domain/money";
import { formatVnd } from "@/lib/brand";
import { getMoneyDesk, handCashIn, saveWalletAdjust } from "@/lib/admin.functions";

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
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const [handAmount, setHandAmount] = useState("");
  const [handNote, setHandNote] = useState("");
  const [handFrom, setHandFrom] = useState("");
  const [handBusy, setHandBusy] = useState(false);
  const [tab, setTab] = useState<"tong" | "vi" | "so">("tong");
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const lines = (desk.data?.lines ?? []).filter((line) => {
    if (filter !== "all" && line.wallet !== filter) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${line.label} ${line.holderName ?? ""}`.toLowerCase().includes(needle);
  });
  const page = useListPage(lines, `${month}|${filter}|${q}`);
  const holders = (desk.data?.holders ?? []).filter((holder) => holder.staffId !== SHOP_TILL_ID);
  const till = (desk.data?.holders ?? []).find((holder) => holder.staffId === SHOP_TILL_ID);
  const carriers = holders.filter((holder) => holder.staffId && holder.tien_mat > 0);
  const handing = carriers.find((holder) => holder.staffId === handFrom) ?? carriers[0];
  const handovers = desk.data?.handovers ?? [];
  const handoverPage = useListPage(handovers, month);
  const cashCard = (desk.data?.cards ?? []).find((card) => card.id === "tien_mat");
  const bankCard = (desk.data?.cards ?? []).find((card) => card.id === "chuyen_khoan");
  const ledgerCash = cashCard?.balance ?? 0;
  const ledgerBank = bankCard?.balance ?? 0;
  const tillCash = till?.tien_mat ?? 0;
  const staffCash = holders.reduce((sum, holder) => sum + holder.tien_mat, 0);
  const staffBank = holders.reduce((sum, holder) => sum + holder.chuyen_khoan, 0);
  const walletRows = [
    { id: "ket", name: "Két tiệm", sub: "Tiền mặt đã nộp", kind: "Ví cửa hàng", cash: tillCash, bank: 0 },
    { id: "bank", name: "Tài khoản nhận", sub: "Chuyển khoản", kind: "Ví cửa hàng", cash: 0, bank: ledgerBank },
    ...holders.map((holder) => ({
      id: holder.staffId || holder.name,
      name: holder.name,
      sub: "Người thu",
      kind: "Nhân viên",
      cash: holder.tien_mat,
      bank: holder.chuyen_khoan,
    })),
  ];

  async function submitHandover(event: FormEvent) {
    event.preventDefault();
    const value = Math.round(Number(handAmount));
    if (!handing || !value) {
      toast.error("Chọn người đang giữ tiền mặt và số tiền nộp.");
      return;
    }
    setHandBusy(true);
    try {
      await handCashIn({ data: { staffId: handing.staffId, amount: value, note: handNote } });
      setHandAmount("");
      setHandNote("");
      toast.success("Đã nộp vào ví cửa hàng");
      await queryClient.invalidateQueries({ queryKey: ["money", month] });
      await queryClient.invalidateQueries({ queryKey: ["collect"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setHandBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Ví</h1>
          <p className="text-sm text-muted-foreground">Số dư hiện tại của cả tiệm. Tiền mặt đã nộp nằm ở két. Chuyển khoản nằm ở tài khoản nhận.</p>
        </div>
        <Input className="min-h-11 max-w-[11rem]" type="month" aria-label="Tháng ví" value={month} onChange={(e) => setMonth(e.target.value)} />
      </div>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Mục ví">
        {(
          [
            ["tong", "Tổng quan"],
            ["vi", "Ví cửa hàng"],
            ["so", "Sổ giao dịch"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`min-h-9 rounded-md px-3 text-sm font-semibold ${tab === id ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground"}`}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {desk.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {desk.isError ? <p className="font-semibold text-destructive">{(desk.error as Error).message}</p> : null}
      {tab === "tong" ? (
        <>
          <section className="grid gap-3 lg:grid-cols-3">
            <article className="rounded-md border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Tổng tiền tiệm đang có</p>
              <p className="mt-2 text-2xl font-bold text-primary">{formatVnd(ledgerCash + ledgerBank)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Tiền mặt: {formatVnd(ledgerCash)}</p>
              <p className="text-sm text-muted-foreground">Chuyển khoản: {formatVnd(ledgerBank)}</p>
            </article>
            <article className="rounded-md border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Trong ví cửa hàng</p>
              <p className="mt-2 text-2xl font-bold">{formatVnd(tillCash + ledgerBank)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Két tiệm: {formatVnd(tillCash)}</p>
              <p className="text-sm text-muted-foreground">Tài khoản nhận: {formatVnd(ledgerBank)}</p>
            </article>
            <article className="rounded-md border bg-card p-4">
              <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">Nhân viên đang giữ</p>
              <p className="mt-2 text-2xl font-bold">{formatVnd(staffCash)}</p>
              <p className="mt-2 text-sm text-muted-foreground">Tiền mặt chưa nộp: {formatVnd(staffCash)}</p>
              <p className="text-sm text-muted-foreground">Chuyển khoản ghi tên người thu: {formatVnd(staffBank)}</p>
            </article>
          </section>
          <section className="overflow-hidden rounded-md border bg-card">
            <h2 className="border-b px-4 py-3 text-sm font-semibold">Danh sách ví</h2>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[40rem] text-sm">
                <thead className="bg-muted/50 text-left text-xs tracking-wide text-muted-foreground uppercase">
                  <tr>
                    <th className="px-4 py-2 font-semibold">Ví</th>
                    <th className="px-4 py-2 font-semibold">Loại</th>
                    <th className="px-4 py-2 text-right font-semibold">Tiền mặt</th>
                    <th className="px-4 py-2 text-right font-semibold">Chuyển khoản</th>
                    <th className="px-4 py-2 text-right font-semibold">Số dư</th>
                  </tr>
                </thead>
                <tbody>
                  {walletRows.map((row) => (
                    <tr key={row.id} className="border-t">
                      <td className="px-4 py-3">
                        <p className="font-semibold">{row.name}</p>
                        <p className="text-xs text-muted-foreground">{row.sub}</p>
                      </td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-semibold ${row.kind === "Ví cửa hàng" ? "bg-primary/10 text-primary" : "bg-orange-100 text-orange-700"}`}>{row.kind}</span>
                      </td>
                      <td className="px-4 py-3 text-right">{formatVnd(row.cash)}</td>
                      <td className="px-4 py-3 text-right">{formatVnd(row.bank)}</td>
                      <td className="px-4 py-3 text-right font-semibold">{formatVnd(row.cash + row.bank)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
          <section className="grid gap-3 lg:grid-cols-2">
            <article className="rounded-md border bg-card p-4">
              <h2 className="font-semibold">Cần thu về từ nhân viên</h2>
              {carriers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Không còn tiền mặt nằm ở nhân viên.</p> : null}
              <ul className="mt-2 divide-y">
                {carriers.map((holder) => (
                  <li key={holder.staffId} className="flex items-center justify-between gap-3 py-2">
                    <span className="font-medium">{holder.name}</span>
                    <span className="font-semibold">{formatVnd(holder.tien_mat)}</span>
                  </li>
                ))}
              </ul>
              <form className="mt-3 space-y-2" onSubmit={submitHandover}>
                {carriers.length > 0 ? (
                  <>
                    <label className="block text-sm font-semibold">
                      Người nộp
                      <select className="mt-1 min-h-11 w-full rounded-md border border-input bg-background px-3 text-sm" aria-label="Người nộp tiền" value={handing?.staffId ?? ""} onChange={(event) => setHandFrom(event.target.value)}>
                        {carriers.map((holder) => (
                          <option key={holder.staffId} value={holder.staffId}>
                            {holder.name} · {formatVnd(holder.tien_mat)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="block text-sm font-semibold">
                      Số tiền nộp vào ví cửa hàng
                      <Input className="mt-1 min-h-11" inputMode="numeric" required placeholder="0" value={handAmount} onChange={(event) => setHandAmount(event.target.value.replace(/\D/g, ""))} />
                    </label>
                    <Input aria-label="Ghi chú nộp tiền" placeholder="Ghi chú" value={handNote} onChange={(event) => setHandNote(event.target.value)} />
                    <Button className="min-h-11" type="submit" disabled={handBusy}>Nộp vào ví cửa hàng</Button>
                  </>
                ) : null}
              </form>
            </article>
            <article className="rounded-md border bg-card p-4">
              <h2 className="font-semibold">Đơn còn phải thu</h2>
              <p className="mt-2 text-sm text-muted-foreground">Tiền khách chưa trả nằm ở danh sách thu, chưa cộng vào tổng ở trên.</p>
              <Link to="/admin/thu" className="mt-3 inline-flex min-h-11 items-center text-sm font-semibold text-primary">Mở danh sách đơn còn nợ</Link>
              <h3 className="mt-4 font-semibold">Đã nộp vào két</h3>
              {desk.data && handovers.length === 0 ? <p className="mt-2 text-sm text-muted-foreground">Chưa có lần nộp tiền mặt.</p> : null}
              <ListPager page={handoverPage.page} pages={handoverPage.pages} total={handoverPage.total} start={handoverPage.start} count={handoverPage.slice.length} noun="lần nộp" onPage={handoverPage.setPage} />
              <ul className="mt-2 space-y-2 text-sm">
                {handoverPage.slice.map((row) => (
                  <li key={row.id}>
                    <span className="font-semibold">{row.fromName} nộp {formatVnd(row.amount)}</span>
                    <span className="block text-muted-foreground">{vnYmd(row.at)}{row.note ? ` · ${row.note}` : ""}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>
        </>
      ) : null}
      {tab === "vi" ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-md border bg-card p-4">
            <h2 className="font-semibold">Két tiệm</h2>
            <p className="mt-2 text-2xl font-bold">{formatVnd(tillCash)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tiền mặt nhân viên đã nộp về ví cửa hàng.</p>
          </article>
          <article className="rounded-md border bg-card p-4">
            <h2 className="font-semibold">Tài khoản nhận</h2>
            <p className="mt-2 text-2xl font-bold">{formatVnd(ledgerBank)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tháng này vào {formatVnd(bankCard?.inMonth ?? 0)} · ra {formatVnd(bankCard?.outMonth ?? 0)}</p>
          </article>
          <article className="rounded-md border bg-card p-4">
            <h2 className="font-semibold">Tiền mặt trên sổ</h2>
            <p className="mt-2 text-2xl font-bold">{formatVnd(ledgerCash)}</p>
            <p className="mt-1 text-sm text-muted-foreground">Tháng này vào {formatVnd(cashCard?.inMonth ?? 0)} · ra {formatVnd(cashCard?.outMonth ?? 0)}</p>
          </article>
        </section>
      ) : null}
      {tab === "so" ? (
      <div className="grid items-start gap-4 lg:grid-cols-3">
        <section className="order-2 space-y-3 lg:order-1 lg:col-span-2">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-bold text-primary">Danh sách giao dịch</h2>
            <Input className="min-h-11 max-w-xs" placeholder="Tìm giao dịch" aria-label="Tìm giao dịch" value={q} onChange={(e) => setQ(e.target.value)} />
            <select className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm" aria-label="Lọc ví" value={filter} onChange={(e) => setFilter(e.target.value as "all" | WalletId)}>
              <option value="all">Cả hai ví</option>
              <option value="tien_mat">Tiền mặt</option>
              <option value="chuyen_khoan">Chuyển khoản</option>
            </select>
          </div>
          {desk.data && (desk.data.lines ?? []).length === 0 ? <p className="glass-card rounded-3xl p-4 text-sm">Chưa có giao dịch trong tháng này.</p> : null}
          {desk.data && (desk.data.lines ?? []).length > 0 && lines.length === 0 ? <p className="glass-card rounded-3xl p-4 text-sm">Không có giao dịch khớp bộ lọc.</p> : null}
          <ListPager page={page.page} pages={page.pages} total={page.total} start={page.start} count={page.slice.length} noun="giao dịch" onPage={page.setPage} />
          <ul className="space-y-2">
            {page.slice.map((line) => (
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
      ) : null}
    </div>
  );
}
