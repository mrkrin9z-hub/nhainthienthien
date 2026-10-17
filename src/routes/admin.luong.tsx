import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { closePayroll, downloadExcel, getMe, getPayroll } from "@/lib/admin.functions";
import { ROLE_LABEL, type Role } from "@/domain/types";

export const Route = createFileRoute("/admin/luong")({
  component: PayrollPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

function PayrollPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [month, setMonth] = useState(monthNow());
  const payroll = useQuery({ queryKey: ["payroll", month], queryFn: () => getPayroll({ data: { month } }) });
  const owner = me.data?.role === "owner";
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (payroll.isError) return <p className="font-semibold text-destructive">{(payroll.error as Error).message}</p>;
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">{owner ? "Lương tháng" : "Lương của tôi"}</h1>
      {owner ? (
        <p className="text-sm text-muted-foreground">
          Sale phương án A: 8.000.000đ cứng (thử việc 85%). Hoa hồng 3% / 5% / 7%. Sản xuất 11.000.000đ, không thưởng sản phẩm. Mức trừ đi trễ và nghỉ để trống cho đến khi chủ nhập.
        </p>
      ) : (
        <p className="text-sm text-muted-foreground">Chỉ hiện lương của tài khoản đang đăng nhập.</p>
      )}
      <div className="flex flex-wrap gap-2">
        <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {owner ? (
          <>
            <Button className="min-h-12" onClick={() => closePayroll({ data: { month } }).then(() => toast.success("Đã chốt lương"))}>
              Chốt tháng
            </Button>
            <Button
              variant="outline"
              className="min-h-12"
              onClick={async () => {
                const file = await downloadExcel({ data: { kind: "payroll", month } });
                const blob = new Blob([file.xml], { type: "application/vnd.ms-excel" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = file.filename;
                a.click();
              }}
            >
              Xuất Excel
            </Button>
          </>
        ) : null}
      </div>
      {payroll.data?.locked ? <p className="text-sm font-semibold">Tháng này đã chốt.</p> : null}
      <div className="grid gap-3">
        {(payroll.data?.rows ?? []).map((row) => (
          <article key={row.staffId} className="glass-card rounded-3xl p-4">
            <h2 className="text-lg font-bold text-primary">
              {row.name} · {ROLE_LABEL[row.role as Role]}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Lương cứng: {formatMaybe(row.base)}</li>
              <li>Thưởng KPI: {formatMaybe(row.kpiBonus)} (phương án A không có thưởng KPI)</li>
              {"commission" in row ? <li>Hoa hồng: {formatMaybe(row.commission)}</li> : null}
              {"kpiPercent" in row && row.kpiPercent !== undefined ? <li>KPI: {row.kpiPercent === null ? "—" : `${row.kpiPercent}%`}</li> : null}
              <li>Đi trễ: {row.lateMinutes} phút · Vắng: {row.absentDays} ngày</li>
              <li>Khấu trừ: {row.deduction === null ? "Chưa cấu hình mức trừ" : formatMaybe(row.deduction)}</li>
              <li className="text-base font-extrabold">Thực nhận: {row.net === null ? "Chưa đủ số" : formatMaybe(row.net)}</li>
            </ul>
          </article>
        ))}
      </div>
    </div>
  );
}
