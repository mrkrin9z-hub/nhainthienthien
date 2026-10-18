import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { OrderLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Banknote, CircleCheck } from "lucide-react";
import { vnMonth } from "@/domain/calc";
import { formatMaybe } from "@/lib/brand";
import { getCod, setCodReceived } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cod")({
  component: CodPage,
});

function monthNow() {
  return vnMonth();
}

function CodPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <CodBody />
    </RoleGate>
  );
}

function CodBody() {
  const [month, setMonth] = useState(monthNow());
  const [q, setQ] = useState("");
  const [paid, setPaid] = useState("all");
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["cod", month], queryFn: () => getCod({ data: { month } }) });
  if (report.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (report.isError) return <p className="font-semibold text-destructive">{(report.error as Error).message}</p>;
  const data = report.data;
  const lines = data?.lines ?? [];
  const chips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: lines.length, ...ALL_TONE },
    { id: "open", label: "Chưa nhận", count: lines.filter((line) => !line.codReceivedAt).length, color: "#D97706", icon: Banknote },
    { id: "done", label: "Đã nhận", count: lines.filter((line) => Boolean(line.codReceivedAt)).length, color: "#059669", icon: CircleCheck },
  ];
  const shown = lines.filter((line) => {
    if (paid === "open" && line.codReceivedAt) return false;
    if (paid === "done" && !line.codReceivedAt) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${line.code} ${line.customerName} ${line.carrier}`.toLowerCase().includes(needle);
  });
  return (
    <div className="space-y-4">
      <OrderLinks />
      <PageToolbar
        title="Đối soát COD"
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã, khách, hãng…"
        below={<Input className="min-h-12 max-w-xs" type="month" aria-label="Tháng đối soát" value={month} onChange={(e) => setMonth(e.target.value)} />}
      />
      <FilterChips label="Thu COD" value={paid} chips={chips} onChange={setPaid} />
      <p className="text-sm">Phải thu {formatMaybe(data?.expected)} · Đã nhận {formatMaybe(data?.received)} · Còn {formatMaybe((data?.expected ?? 0) - (data?.received ?? 0))}</p>
      <ul className="space-y-1 text-sm">
        {(data?.carriers ?? []).map((row) => (
          <li key={row.carrier}>
            {row.carrier}: {row.orders} đơn · phải thu {formatMaybe(row.expected)} · đã nhận {formatMaybe(row.received)} · còn {formatMaybe(row.outstanding)}
          </li>
        ))}
      </ul>
      <div className="grid gap-3">
        {shown.map((line) => (
          <article key={line.id} className="glass-card flex flex-wrap items-center justify-between gap-2 rounded-3xl p-4 text-sm">
            <div>
              <p className="font-bold text-primary">{line.code}</p>
              <p>{line.customerName} · {line.carrier}</p>
              <p>{formatMaybe(line.codAmount)}{line.codReceivedAt ? " · đã nhận" : " · chưa nhận"}</p>
            </div>
            <Button
              className="min-h-11"
              variant={line.codReceivedAt ? "outline" : "default"}
              onClick={async () => {
                await setCodReceived({ data: { orderId: line.id, received: !line.codReceivedAt } });
                toast.success(line.codReceivedAt ? "Đã bỏ đánh dấu" : "Đã nhận COD");
                await queryClient.invalidateQueries({ queryKey: ["cod", month] });
              }}
            >
              {line.codReceivedAt ? "Bỏ nhận" : "Đã nhận COD"}
            </Button>
          </article>
        ))}
        {data && shown.length === 0 ? <p className="text-sm text-muted-foreground">{lines.length === 0 ? "Tháng này chưa có đơn có số COD." : "Không có dòng khớp bộ lọc."}</p> : null}
      </div>
    </div>
  );
}
