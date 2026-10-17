import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RoleGate } from "@/components/role-gate";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { getKpi, getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/kpi")({
  component: KpiPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

function KpiPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <KpiBody />
    </RoleGate>
  );
}

function KpiBody() {
  const [month, setMonth] = useState(monthNow());
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const kpi = useQuery({ queryKey: ["kpi", month], queryFn: () => getKpi({ data: { month } }) });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">KPI sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.data?.role === "sale" ? "Chỉ số của bạn." : "Mỗi sale chỉ thấy số của mình. Chủ thấy cả nhóm."} Doanh thu là đơn đã xong mà sale đã xử lý, dùng để tính hoa hồng. Không hiện giá vốn.
        </p>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {kpi.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {kpi.isError ? <p className="font-semibold text-destructive">{(kpi.error as Error).message}</p> : null}
      <div className="grid gap-3">
        {(kpi.data ?? []).map((row) => (
          <article key={row.staffId} className="glass-card space-y-1 rounded-3xl p-4">
            <h2 className="text-lg font-extrabold text-primary">{row.name}</h2>
            <p>Đơn đã xử lý: {row.orders}</p>
            <p>Doanh thu tính hoa hồng: {formatMaybe(row.commissionRevenue)}</p>
            <p>Hoa hồng: {formatMaybe(row.commission)}</p>
            <p>
              Thời gian xử lý:{" "}
              {row.avgReplyMinutes === null ? "chưa có mốc (tính từ lúc tạo đơn đến lần sale đổi trạng thái)" : `${row.avgReplyMinutes} phút (${row.timedOrders} đơn)`}
            </p>
          </article>
        ))}
        {kpi.data && kpi.data.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có tài khoản sale.</p> : null}
      </div>
    </div>
  );
}
