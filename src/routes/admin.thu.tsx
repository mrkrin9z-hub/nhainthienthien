import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, CHANNEL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { MoneyLinks } from "@/components/admin/sections";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { WalletId } from "@/domain/money";
import { walletLabel } from "@/domain/money";
import { formatMaybe, formatVnd } from "@/lib/brand";
import { CHANNEL_LABEL, CHANNELS } from "@/domain/types";
import { channelLabelOf, statusLabelOf } from "@/lib/display-labels";
import { getCollectList, handCashIn, recordDeposit } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/thu")({
  component: CollectPage,
});

type CollectRow = {
  id: string;
  code: string;
  customerName: string;
  status: string;
  statusLabel: string;
  channel: string;
  channelLabel: string;
  total: number | null;
  depositPaid: number;
  remain: number | null;
};

function CollectPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale thu tiền.">
      <CollectBody />
    </RoleGate>
  );
}

function CollectBody() {
  const [query, setQuery] = useState("");
  const [channel, setChannel] = useState("all");
  const [open, setOpen] = useState<CollectRow | null>(null);
  const [handOpen, setHandOpen] = useState(false);
  const list = useQuery({ queryKey: ["collect"], queryFn: () => getCollectList() });
  const needle = query.trim().toLowerCase();
  const source = list.data?.rows ?? [];
  const rows = source.filter((row) => {
    if (channel !== "all" && row.channel !== channel) return false;
    if (!needle) return true;
    return row.code.toLowerCase().includes(needle) || row.customerName.toLowerCase().includes(needle);
  });
  const channelChips: FilterChip[] = [
    { id: "all", label: "Mọi kênh", count: source.length, ...ALL_TONE },
    ...CHANNELS.map((id) => ({
      id,
      label: CHANNEL_LABEL[id],
      count: source.filter((row) => row.channel === id).length,
      color: CHANNEL_TONE[id]?.color ?? "#6B7280",
      icon: CHANNEL_TONE[id]?.icon,
    })),
  ];
  const page = useListPage(rows, `${query}|${channel}`);
  const me = list.data?.me;

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Thu tiền</h1>
        <p className="mt-1 text-sm text-muted-foreground">Bấm Thu tiền trên đơn. Số tiền tự vào ví của bạn. Xem chi tiết ở Ví tiền. Cuối ca nộp tiền mặt đang giữ vào két tiệm.</p>
      </div>
      {me ? (
        <section className="grid gap-3 sm:grid-cols-2">
          <article className="rounded-md border bg-card p-4">
            <p className="text-sm text-muted-foreground">Ví tiền mặt của {me.name}</p>
            <p className="text-xl font-extrabold">{formatVnd(me.tien_mat)}</p>
            {me.tien_mat > 0 ? (
              <Button className="mt-3 min-h-11" variant="outline" onClick={() => setHandOpen(true)}>
                Nộp vào ví cửa hàng
              </Button>
            ) : (
              <p className="mt-2 text-sm text-muted-foreground">Không còn tiền mặt đang giữ.</p>
            )}
          </article>
          <article className="rounded-md border bg-card p-4">
            <p className="text-sm text-muted-foreground">Ví chuyển khoản của {me.name}</p>
            <p className="text-xl font-extrabold">{formatVnd(me.chuyen_khoan)}</p>
          </article>
        </section>
      ) : null}
      <Input className="min-h-12 max-w-md" placeholder="Tìm mã đơn hoặc tên khách" value={query} onChange={(e) => setQuery(e.target.value)} />
      <FilterChips label="Kênh đơn" value={channel} chips={channelChips} onChange={setChannel} />
      <ListPager page={page.page} pages={page.pages} total={page.total} start={page.start} count={page.slice.length} noun="đơn cần thu" onPage={page.setPage} />
      {list.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {list.isError ? <p className="font-semibold text-destructive">{(list.error as Error).message}</p> : null}
      {list.data && source.length === 0 ? <p className="rounded-md border bg-card p-4 text-sm">Không còn đơn cần thu.</p> : null}
      {list.data && source.length > 0 && rows.length === 0 ? <p className="rounded-md border bg-card p-4 text-sm">Không có đơn khớp bộ lọc.</p> : null}
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {page.slice.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="font-extrabold text-primary">
                {row.code}
              </Link>
              <p className="text-sm text-muted-foreground">
                {row.customerName || "Khách lẻ"} · {channelLabelOf(row.channel, row.channelLabel)} · {statusLabelOf(row.status, row.statusLabel)}
              </p>
            </div>
            <div className="text-right text-sm">
              <p>Đã thu {formatMaybe(row.depositPaid)}</p>
              <p className="font-extrabold text-primary">{row.remain === null ? "Chưa đủ giá" : `Còn ${formatMaybe(row.remain)}`}</p>
            </div>
            <Button className="min-h-11" onClick={() => setOpen(row)}>
              Thu tiền
            </Button>
          </li>
        ))}
      </ul>
      <CollectDialog key={open?.id ?? "closed"} row={open} payerName={me?.name ?? ""} onOpenChange={(next) => { if (!next) setOpen(null); }} />
      <HandDialog key={handOpen ? `hand-${me?.tien_mat ?? 0}` : "hand-closed"} open={handOpen} held={me?.tien_mat ?? 0} onOpenChange={setHandOpen} />
    </div>
  );
}

function HandDialog({ open, held, onOpenChange }: { open: boolean; held: number; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(held > 0 ? String(held) : "");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nộp tiền mặt</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Đưa số tiền mặt đang giữ về két tiệm. Đang giữ {formatVnd(held)}.</p>
        <label className="text-sm font-semibold">
          Số tiền nộp
          <Input className="mt-1 min-h-11" inputMode="numeric" aria-label="Số tiền nộp" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} />
        </label>
        <label className="text-sm font-semibold">
          Ghi chú
          <Input className="mt-1 min-h-11" placeholder="Cuối ca" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <DialogFooter>
          <Button
            className="min-h-11"
            disabled={busy || !Number(amount)}
            onClick={async () => {
              const value = Number(amount);
              if (!value) return;
              setBusy(true);
              try {
                await handCashIn({ data: { amount: value, note } });
                toast.success("Đã nộp tiền mặt vào két");
                onOpenChange(false);
                await queryClient.invalidateQueries({ queryKey: ["collect"] });
                await queryClient.invalidateQueries({ queryKey: ["money"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Nộp tiền mặt
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CollectDialog({
  row,
  payerName,
  onOpenChange,
}: {
  row: CollectRow | null;
  payerName: string;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const seeded = row && row.remain && row.remain > 0 ? String(row.remain) : "";
  const [amount, setAmount] = useState(seeded);
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [busy, setBusy] = useState(false);

  return (
    <Dialog open={row !== null} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Thu tiền{row ? ` · ${row.code}` : ""}</DialogTitle>
        </DialogHeader>
        {row ? (
          <>
            <p className="text-sm text-muted-foreground">
              {row.customerName || "Khách lẻ"} · Tổng {formatMaybe(row.total)} · Đã thu {formatMaybe(row.depositPaid)}
            </p>
            <p className="text-sm font-semibold">Cộng vào ví của {payerName || "bạn"}.</p>
            <label className="text-sm font-semibold">
              Số tiền
              <Input
                className="mt-1 min-h-11"
                inputMode="numeric"
                aria-label={`Số tiền thu ${row.code}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))}
              />
            </label>
            <WalletToggle value={wallet} onChange={setWallet} />
          </>
        ) : null}
        <DialogFooter>
          <Button
            className="min-h-11"
            disabled={busy || !row || !Number(amount)}
            onClick={async () => {
              if (!row || !Number(amount)) return;
              setBusy(true);
              try {
                await recordDeposit({ data: { orderId: row.id, amount: Number(amount), method: walletLabel(wallet) } });
                toast.success("Đã thu vào ví của bạn");
                setAmount("");
                onOpenChange(false);
                await queryClient.invalidateQueries({ queryKey: ["collect"] });
                await queryClient.invalidateQueries({ queryKey: ["money"] });
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            Thu tiền
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
