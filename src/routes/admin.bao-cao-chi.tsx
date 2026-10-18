import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { MoneyLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Input } from "@/components/ui/input";
import { vnMonth, vnYmd } from "@/domain/calc";
import { formatMaybe, formatVnd } from "@/lib/brand";
import { getMoneyDesk } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/bao-cao-chi")({
  component: ExpenseReportPage,
});

function ExpenseReportPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <ReportBody />
    </RoleGate>
  );
}

function ReportBody() {
  const [month, setMonth] = useState(vnMonth());
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const data = desk.data;
  const report = data?.report;
  const maxCategory = Math.max(1, ...(report?.byCategory.map((row) => row.amount) ?? [1]));

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Báo cáo chi phí</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Chi trong tháng, tách theo nhóm và theo ví. Tiền thu đơn trừ chi phí phát sinh chưa phải lợi nhuận — lợi nhuận nằm ở Thu chi, sau giá vốn và chi phí cố định.
        </p>
      </div>
      <Input className="min-h-12 max-w-xs" type="month" aria-label="Tháng báo cáo chi" value={month} onChange={(e) => setMonth(e.target.value)} />
      {desk.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {desk.isError ? <p className="font-semibold text-destructive">{(desk.error as Error).message}</p> : null}
      {data && report ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Tổng chi" value={formatVnd(report.total)} />
            <Stat label="Tiền thu đơn" value={formatVnd(data.collected)} />
            <Stat label="Tiền mặt" value={formatVnd(report.byWallet.find((row) => row.id === "tien_mat")?.amount ?? 0)} />
            <Stat label="Chuyển khoản" value={formatVnd(report.byWallet.find((row) => row.id === "chuyen_khoan")?.amount ?? 0)} />
          </section>
          {report.unknown > 0 ? <p className="text-sm font-semibold">Chưa rõ nguồn: {formatVnd(report.unknown)}. Khoản cũ ghi trước khi có ví.</p> : null}
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Theo nhóm</h2>
            {report.byCategory.length === 0 ? <p className="mt-2 text-sm">Chưa có chi phí nào trong tháng này.</p> : null}
            <ul className="mt-3 space-y-3">
              {report.byCategory.map((row) => (
                <li key={row.id || "none"}>
                  <div className="flex justify-between gap-3 text-sm font-semibold">
                    <span>{row.label}</span>
                    <span>{formatVnd(row.amount)}</span>
                  </div>
                  <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted">
                    <div className="h-full bg-primary" style={{ width: `${Math.round((row.amount / maxCategory) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Khoản trong tháng</h2>
            <ul className="mt-2 space-y-2 text-sm">
              {data.expenses.map((row) => (
                <li key={row.id} className="flex flex-wrap justify-between gap-2">
                  <span>
                    {row.name}
                    <span className="block text-muted-foreground">
                      {vnYmd(row.at) || row.month} · {row.categoryLabel} · {row.walletLabel}
                    </span>
                  </span>
                  <span className="font-semibold">{formatMaybe(row.amount)}</span>
                </li>
              ))}
              {data.expenses.length === 0 ? <li>Chưa có chi phí nào trong tháng này.</li> : null}
            </ul>
          </section>
        </>
      ) : null}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="glass-card rounded-3xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-extrabold text-primary">{value}</p>
    </div>
  );
}
