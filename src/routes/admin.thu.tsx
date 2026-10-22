import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, CHANNEL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { HandCoins, MoreHorizontal } from "lucide-react";
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
  const [picker, setPicker] = useState(false);
  const [filters, setFilters] = useState(false);
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
      <PageToolbar
        title="Nhập thu"
        hint="Ghi tiền khách trả. Số cộng vào ví của bạn. Nộp tiền mặt làm ở mục Chuyển nộp."
        search={query}
        onSearch={setQuery}
        searchPlaceholder="Tìm mã đơn hoặc tên khách"
        filterCount={channel === "all" ? 0 : 1}
        onFilter={() => setFilters(true)}
        actions={<ToolbarButton label="Nhập thu" icon={HandCoins} primary onClick={() => setPicker(true)} />}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc thu">
        <FilterChips label="Kênh đơn" value={channel} chips={channelChips} onChange={setChannel} wrap />
      </FilterSheet>
      <Dialog open={picker} onOpenChange={setPicker}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chọn đơn để thu</DialogTitle>
          </DialogHeader>
          <ul className="max-h-80 space-y-1 overflow-y-auto">
            {rows.map((row) => (
              <li key={row.id}>
                <button
                  type="button"
                  className="flex w-full items-center justify-between rounded-md px-2 py-2 text-left hover:bg-muted"
                  onClick={() => {
                    setOpen(row);
                    setPicker(false);
                  }}
                >
                  <span>
                    <span className="font-semibold">{row.code}</span>
                    <span className="block text-xs text-muted-foreground">{row.customerName || "Khách lẻ"}</span>
                  </span>
                  <span className="text-sm font-semibold">{row.remain === null ? "Chưa đủ giá" : formatMaybe(row.remain)}</span>
                </button>
              </li>
            ))}
            {rows.length === 0 ? <li className="text-sm text-muted-foreground">Không còn đơn cần thu.</li> : null}
          </ul>
        </DialogContent>
      </Dialog>
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
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border" aria-label={`Thao tác ${row.code}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setOpen(row)}>Thu tiền</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
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
