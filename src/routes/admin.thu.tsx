import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MoneyLinks } from "@/components/admin/sections";
import { WalletToggle } from "@/components/admin/wallet-toggle";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { WalletId } from "@/domain/money";
import { walletLabel } from "@/domain/money";
import { formatMaybe } from "@/lib/brand";
import { getCollectList, recordDeposit } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/thu")({
  component: CollectPage,
});

function CollectPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale thu tiền.">
      <CollectBody />
    </RoleGate>
  );
}

function CollectBody() {
  const [query, setQuery] = useState("");
  const list = useQuery({ queryKey: ["collect"], queryFn: () => getCollectList() });
  const needle = query.trim().toLowerCase();
  const rows = (list.data ?? []).filter((row) => {
    if (!needle) return true;
    return row.code.toLowerCase().includes(needle) || row.customerName.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Thu tiền</h1>
        <p className="mt-1 text-sm text-muted-foreground">Đơn còn thiếu tiền hoặc chưa đủ giá. Tiền mặt vào ví tiền mặt, chuyển khoản vào ví chuyển khoản.</p>
      </div>
      <Input className="min-h-12 max-w-md" placeholder="Tìm mã đơn hoặc tên khách" value={query} onChange={(e) => setQuery(e.target.value)} />
      {list.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {list.isError ? <p className="font-semibold text-destructive">{(list.error as Error).message}</p> : null}
      {list.data && rows.length === 0 ? <p className="glass-card rounded-3xl p-4 text-sm">Không còn đơn cần thu.</p> : null}
      <ul className="space-y-3">
        {rows.map((row) => (
          <CollectCard key={row.id} row={row} />
        ))}
      </ul>
    </div>
  );
}

function CollectCard({
  row,
}: {
  row: {
    id: string;
    code: string;
    customerName: string;
    statusLabel: string;
    channelLabel: string;
    total: number | null;
    depositPaid: number;
    remain: number | null;
  };
}) {
  const queryClient = useQueryClient();
  const [amount, setAmount] = useState(row.remain && row.remain > 0 ? String(row.remain) : "");
  const [wallet, setWallet] = useState<WalletId>("tien_mat");
  const [busy, setBusy] = useState(false);

  return (
    <li className="glass-card space-y-3 rounded-3xl p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <Link to="/admin/don-hang/$code" params={{ code: row.code }} className="text-lg font-extrabold text-primary">
            {row.code}
          </Link>
          <p className="text-sm">
            {row.customerName || "Khách lẻ"} · {row.channelLabel} · {row.statusLabel}
          </p>
        </div>
        <div className="text-right text-sm">
          <p>Tổng {formatMaybe(row.total)}</p>
          <p>Đã thu {formatMaybe(row.depositPaid)}</p>
          <p className="font-extrabold text-primary">{row.remain === null ? "Chưa đủ giá" : `Còn lại ${formatMaybe(row.remain)}`}</p>
        </div>
      </div>
      <div className="grid gap-2 md:grid-cols-[8rem_1fr_auto] md:items-end">
        <label className="text-sm font-semibold">
          Số tiền
          <Input className="mt-1 min-h-11" inputMode="numeric" aria-label={`Số tiền thu ${row.code}`} value={amount} onChange={(e) => setAmount(e.target.value.replace(/\D/g, ""))} />
        </label>
        <WalletToggle value={wallet} onChange={setWallet} />
        <Button
          className="min-h-11"
          disabled={busy}
          onClick={async () => {
            setBusy(true);
            try {
              await recordDeposit({ data: { orderId: row.id, amount: Number(amount), method: walletLabel(wallet) } });
              toast.success("Đã thu tiền");
              setAmount("");
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
      </div>
    </li>
  );
}
