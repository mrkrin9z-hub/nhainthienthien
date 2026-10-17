import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { downloadExcel, getMe, getProfit, saveExpense, saveFixedMonth } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/loi-nhuan")({
  component: ProfitPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
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
  const [name, setName] = useState("");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const data = report.data;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-extrabold text-primary">Chi phí và lợi nhuận</h1>
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
            <h2 className="font-bold text-primary">Chi phí phát sinh</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <Input className="min-h-11 w-40" placeholder="Tên khoản" value={name} onChange={(e) => setName(e.target.value)} />
              <Input className="min-h-11 w-32" placeholder="Số tiền" value={amount} onChange={(e) => setAmount(e.target.value)} />
              <Input className="min-h-11 w-40" placeholder="Ghi chú hóa đơn" value={note} onChange={(e) => setNote(e.target.value)} />
              <Button
                className="min-h-11"
                onClick={async () => {
                  await saveExpense({ data: { month, name, amount: Number(amount), note } });
                  setName("");
                  setAmount("");
                  setNote("");
                  toast.success("Đã thêm");
                  await queryClient.invalidateQueries({ queryKey: ["profit", month] });
                }}
              >
                Thêm
              </Button>
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
