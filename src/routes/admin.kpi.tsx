import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { MoneyLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { formatMaybe } from "@/lib/brand";
import { getKpi, getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/kpi")({
  component: KpiPage,
});

function monthNow() {
  return vnMonth();
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
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">KPI sale</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {me.data?.role === "sale" ? "Chỉ số của bạn." : "Mỗi sale chỉ thấy số của mình. Chủ thấy cả nhóm."} Hoa hồng lũy tiến 3% đến 100 triệu, 5% phần 100–200 triệu, 7% phần trên 200 triệu. Đó không phải mốc KPI. Mục tiêu đã duyệt: tháng mở cửa 25 triệu, tháng 2 = 20 triệu, tháng 3 = 40 triệu, từ tháng 4 = 60 triệu.
        </p>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {kpi.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {kpi.isError ? <p className="font-semibold text-destructive">{(kpi.error as Error).message}</p> : null}
      <div className="grid gap-3">
        {(kpi.data ?? []).map((row) => (
          <article key={row.staffId} className="glass-card space-y-1 rounded-3xl p-4">
            <h2 className="text-lg font-extrabold text-primary">{row.name}</h2>
            <p>Đơn đã xử lý trong tháng: {row.orders}</p>
            <p>Cách tính hoa hồng: {row.basis === "handled" ? "Theo đơn người đó xử lý" : "Toàn tiệm"}</p>
            {row.commissionRevenue === null ? (
              <p>Doanh thu toàn tiệm không hiện ở tài khoản sale. Hoa hồng bên dưới đã tính trên số đó.</p>
            ) : (
              <p>{row.basis === "handled" ? "Doanh thu đơn người đó xử lý" : "Doanh thu toàn tiệm"}: {formatMaybe(row.commissionRevenue)}</p>
            )}
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
