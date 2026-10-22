import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { MoneyLinks } from "@/components/admin/sections";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { formatMaybe } from "@/lib/brand";
import { downloadExcel, getMe, getProfit, saveFixedMonth } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/loi-nhuan")({
  component: ProfitPage,
});

function monthNow() {
  return vnMonth();
}

function ProfitPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role !== "owner") return <p className="text-lg font-semibold text-primary">Chỉ chủ xem.</p>;
  return <ProfitBody />;
}

function ProfitBody() {
  const [month, setMonth] = useState(monthNow());
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["profit", month], queryFn: () => getProfit({ data: { month } }) });
  const data = report.data;

  return (
    <div className="space-y-4">
      <MoneyLinks />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold text-primary">Lợi nhuận</h1>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            const file = await downloadExcel({ data: { kind: "profit", month } });
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
      </div>
      <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
      {report.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {report.isError ? <p className="font-semibold text-destructive">{(report.error as Error).message}</p> : null}
      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Doanh thu đơn xong" value={formatMaybe(data.revenue)} />
            <Stat label="Lãi gộp" value={data.incomplete ? "Chưa đủ giá vốn" : formatMaybe(data.gross)} />
            <Stat label="Chi phí cố định" value={formatMaybe(data.fixedSum)} />
            <Stat label="Chi phí phát sinh" value={formatMaybe(data.extraSum)} />
            <Stat label="Lợi nhuận" value={data.profit === null ? "Chưa đủ số" : formatMaybe(data.profit)} />
            <Stat label="Hòa vốn" value={data.breakevenPercent === null ? "—" : `${data.breakevenPercent}%`} />
          </section>
          {data.shippingUnknown ? <p className="text-sm font-semibold">Có đơn Facebook chưa trừ phí ship vì chưa có số.</p> : null}
          <p className="text-sm text-muted-foreground">Hôm nay còn thiếu {formatMaybe(data.todayGap)} để đạt mốc ngày. Khai trương dự kiến {data.openDate}.</p>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Theo kênh</h2>
            <ul className="mt-2 text-sm">
              {data.byChannel.map((row) => (
                <li key={row.channel}>
                  {row.label}: {row.orders} đơn · {formatMaybe(row.revenue)}
                </li>
              ))}
              {data.byChannel.length === 0 ? <li>Chưa có đơn xong trong tháng.</li> : null}
            </ul>
            <p className="mt-3 text-sm">Tỉ lệ in lại: {data.reprintRate}% ({data.reprintCount} phiếu)</p>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Chi phí cố định tháng {month}</h2>
            <FixedEditor
              key={month}
              rows={data.fixed}
              onSave={async (rows) => {
                await saveFixedMonth({ data: { month, rows } });
                toast.success("Đã lưu chi phí tháng");
                await queryClient.invalidateQueries({ queryKey: ["profit", month] });
              }}
            />
          </section>
          <section className="glass-card rounded-3xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="font-bold text-primary">Chi phí phát sinh</h2>
              <Link to="/admin/chi-phi" className="inline-flex min-h-11 items-center rounded-full border border-border px-3 text-sm font-semibold">
                Nhập chi phí
              </Link>
            </div>
            <ul className="mt-3 text-sm">
              {data.extras.map((row) => (
                <li key={row.id}>
                  {row.name}: {formatMaybe(row.amount)} {row.note}
                </li>
              ))}
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

function FixedEditor({ rows, onSave }: { rows: { key: string; name: string; amount: number; note: string }[]; onSave: (rows: { key: string; amount: number }[]) => Promise<void> }) {
  const [draft, setDraft] = useState(rows.map((row) => ({ ...row })));
  return (
    <div className="mt-3 space-y-2">
      {draft.map((row, index) => (
        <label key={row.key} className="flex flex-wrap items-center gap-2 text-sm">
          <span className="w-48">{row.name}</span>
          <Input
            className="h-11 w-36"
            value={String(row.amount)}
            onChange={(e) => {
              const next = [...draft];
              next[index] = { ...row, amount: Number(e.target.value) };
              setDraft(next);
            }}
          />
          <span className="text-muted-foreground">{row.note}</span>
        </label>
      ))}
      <Button className="min-h-11" onClick={() => onSave(draft.map((row) => ({ key: row.key, amount: row.amount })))}>
        Lưu chi phí tháng này
      </Button>
    </div>
  );
}
