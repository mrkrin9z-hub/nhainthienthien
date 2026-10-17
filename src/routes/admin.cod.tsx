import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { getCod, setCodReceived } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/cod")({
  component: CodPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
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
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["cod", month], queryFn: () => getCod({ data: { month } }) });
  if (report.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (report.isError) return <p className="font-semibold text-destructive">{(report.error as Error).message}</p>;
  const data = report.data;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Đối soát COD</h1>
      <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      <p className="text-sm">Phải thu {formatMaybe(data?.expected)} · Đã nhận {formatMaybe(data?.received)} · Còn {formatMaybe((data?.expected ?? 0) - (data?.received ?? 0))}</p>
      <ul className="space-y-1 text-sm">
        {(data?.carriers ?? []).map((row) => (
          <li key={row.carrier}>
            {row.carrier}: {row.orders} đơn · phải thu {formatMaybe(row.expected)} · đã nhận {formatMaybe(row.received)} · còn {formatMaybe(row.outstanding)}
          </li>
        ))}
      </ul>
      <div className="grid gap-3">
        {(data?.lines ?? []).map((line) => (
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
        {data && data.lines.length === 0 ? <p className="text-sm text-muted-foreground">Tháng này chưa có đơn có số COD.</p> : null}
      </div>
    </div>
  );
}
