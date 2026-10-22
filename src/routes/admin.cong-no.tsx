import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { HandCoins, MoreHorizontal } from "lucide-react";

import { ALL_TONE, CHANNEL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { CHANNEL_LABEL, CHANNELS } from "@/domain/types";
import { walletLabel, type WalletId } from "@/domain/money";
import { formatMaybe } from "@/lib/brand";
import { channelLabelOf } from "@/lib/display-labels";
import { getCollectList, recordDeposit } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cong-no")({
  component: DebtPage,
});

function DebtPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem công nợ.">
      <DebtBody />
    </RoleGate>
  );
}

function DebtBody() {
  const list = useQuery({ queryKey: ["collect"], queryFn: () => getCollectList() });
  const queryClient = useQueryClient();
  const [q, setQ] = useState("");
  const [channel, setChannel] = useState("all");
  const [filters, setFilters] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [busy, setBusy] = useState(false);
  const source = list.data?.rows ?? [];
  const rows = source.filter((row) => {
    if (channel !== "all" && row.channel !== channel) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return row.code.toLowerCase().includes(needle) || row.customerName.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Mọi kênh", count: source.length, ...ALL_TONE },
    ...CHANNELS.map((id) => ({
      id,
      label: CHANNEL_LABEL[id],
      count: source.filter((row) => row.channel === id).length,
      color: CHANNEL_TONE[id]?.color ?? "#6B7280",
    })),
  ];
  const page = useListPage(rows, `${q}|${channel}`);
  const opened = source.find((row) => row.id === openId) ?? null;

  function start(row: { id: string; remain: number | null }) {
    setOpenId(row.id);
    setAmount(row.remain && row.remain > 0 ? String(row.remain) : "");
  }

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Công nợ"
        hint="Đơn còn phải thu. Đơn hủy và đơn thử không hiện."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã hoặc tên khách"
        filterCount={channel === "all" ? 0 : 1}
        onFilter={() => setFilters(true)}
        actions={<ToolbarButton label="Ghi đã thu" icon={HandCoins} primary onClick={() => { const row = rows[0]; if (row) start(row); }} />}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc công nợ">
        <FilterChips label="Kênh" value={channel} chips={chips} onChange={setChannel} wrap />
      </FilterSheet>
      <ListPager page={page.page} pages={page.pages} total={page.total} start={page.start} count={page.slice.length} noun="đơn nợ" onPage={page.setPage} />
      {list.data && source.length === 0 ? <p className="text-sm text-muted-foreground">Không còn đơn cần thu.</p> : null}
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {page.slice.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="font-semibold text-primary">
                {row.code}
              </Link>
              <p className="text-sm text-muted-foreground">
                {row.customerName || "Khách lẻ"} · {channelLabelOf(row.channel, row.channelLabel)}
              </p>
            </div>
            <p className="text-sm font-semibold">{row.remain === null ? "Chưa đủ giá" : formatMaybe(row.remain)}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border" aria-label={`Thao tác ${row.code}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => start(row)}>Ghi đã thu</DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to="/admin/don-hang/$code" params={{ code: row.code }}>Mở đơn</Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      <Dialog open={opened !== null} onOpenChange={(next) => { if (!next) setOpenId(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ghi đã thu{opened ? ` · ${opened.code}` : ""}</DialogTitle>
          </DialogHeader>
          {opened ? <p className="text-sm text-muted-foreground">Còn {opened.remain === null ? "chưa đủ giá" : formatMaybe(opened.remain)}.</p> : null}
          <label className="text-sm font-semibold">
            Số tiền
            <Input className="mt-1 min-h-11" inputMode="numeric" aria-label="Số tiền thu" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} />
          </label>
          <WalletToggle value={wallet} onChange={setWallet} />
          <DialogFooter>
            <Button
              className="min-h-11"
              disabled={busy || !opened || !Number(amount)}
              onClick={async () => {
                if (!opened) return;
                setBusy(true);
                try {
                  await recordDeposit({ data: { orderId: opened.id, amount: Number(amount), method: walletLabel(wallet) } });
                  toast.success("Đã ghi thu");
                  setOpenId(null);
                  await queryClient.invalidateQueries({ queryKey: ["collect"] });
                  await queryClient.invalidateQueries({ queryKey: ["money"] });
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Ghi đã thu
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
