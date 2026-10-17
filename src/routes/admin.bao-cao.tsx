import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { getReport, saveFixedMonth } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/bao-cao")({
  component: ReportPage,
});

function monthNow() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit" }).format(new Date()).slice(0, 7);
}

function ReportPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ xem.">
      <ReportBody />
    </RoleGate>
  );
}

function ReportBody() {
  const [month, setMonth] = useState(monthNow());
  const [grain, setGrain] = useState<"day" | "week" | "month">("day");
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["report", month, grain], queryFn: () => getReport({ data: { month, grain } }) });
  const data = report.data;
  const progress = data?.breakEvenPercent === null || data?.breakEvenPercent === undefined ? 0 : Math.min(100, Math.max(0, data.breakEvenPercent));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Báo cáo</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Doanh thu và lãi gộp lấy đơn đã xong. Lãi ròng = lãi gộp − chi phí cố định − chi phí phát sinh. Mặc định chi phí cố định 29.400.000đ/tháng. Chi phí phát sinh ghi ở trang Chi phí và lợi nhuận.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="min-h-12 max-w-xs" type="month" value={month} onChange={(e) => setMonth(e.target.value)} />
        {(["day", "week", "month"] as const).map((item) => (
          <Button key={item} variant={grain === item ? "default" : "outline"} className="min-h-12" onClick={() => setGrain(item)}>
            {item === "day" ? "Ngày" : item === "week" ? "Tuần" : "Tháng"}
          </Button>
        ))}
      </div>
      {report.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {report.isError ? <p className="font-semibold text-destructive">{(report.error as Error).message}</p> : null}
      {data ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <Stat label="Doanh thu" value={formatMaybe(data.revenue)} />
            <Stat label="Lãi gộp" value={data.incomplete ? "Chưa đủ giá vốn" : formatMaybe(data.gross)} />
            <Stat label="Chi phí cố định" value={formatMaybe(data.fixedSum)} />
            <Stat label="Chi phí phát sinh" value={formatMaybe(data.extraSum)} />
            <Stat label="Lãi ròng" value={data.net === null ? "Chưa đủ số" : formatMaybe(data.net)} />
            <Stat label="Giá trị đơn trung bình" value={data.averageOrder === null ? "—" : formatMaybe(data.averageOrder)} />
            <Stat label="Tỉ lệ hủy" value={data.cancelRate === null ? "—" : `${data.cancelRate}% (${data.cancelled}/${data.placed})`} />
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Hòa vốn tháng</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lãi gộp so với chi phí cố định tháng này.</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold">{data.breakEvenPercent === null ? "Chưa đủ lãi gộp để tính." : `${data.breakEvenPercent}%`}</p>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Chi phí phát sinh tháng {month}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Khoản này trừ riêng, không gộp vào chi phí cố định. Lãi ròng = lãi gộp − chi phí cố định − chi phí phát sinh.</p>
            <ul className="mt-2 space-y-1 text-sm">
              {data.extras.map((row) => (
                <li key={`${row.name}-${row.amount}-${row.note}`}>
                  {row.name}: {formatMaybe(row.amount)}
                  {row.note ? ` · ${row.note}` : ""}
                </li>
              ))}
              {data.extras.length === 0 ? <li>Tháng này chưa ghi chi phí phát sinh (0đ).</li> : null}
            </ul>
            <p className="mt-2 font-semibold">Cộng chi phí phát sinh: {formatMaybe(data.extraSum)}</p>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Theo {grain === "day" ? "ngày" : grain === "week" ? "tuần" : "tháng"}</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.series.map((row) => (
                <li key={row.key}>
                  {row.label}: {row.orders} đơn · {formatMaybe(row.revenue)}
                  {row.incomplete ? " · lãi chưa đủ số" : ` · lãi gộp ${formatMaybe(row.gross)}`}
                </li>
              ))}
              {data.series.length === 0 ? <li>Chưa có đơn xong trong tháng.</li> : null}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Theo kênh</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.byChannel.map((row) => (
                <li key={row.channel}>
                  {row.label}: {row.orders} đơn · {formatMaybe(row.revenue)}
                  {row.incomplete ? "" : ` · lãi gộp ${formatMaybe(row.gross)}`}
                </li>
              ))}
              {data.byChannel.length === 0 ? <li>Chưa có đơn xong.</li> : null}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Theo khổ</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.bySize.map((row) => (
                <li key={row.size}>
                  {row.size}: {row.qty} · {formatMaybe(row.revenue)}
                </li>
              ))}
              {data.bySize.length === 0 ? <li>Chưa có dòng hàng.</li> : null}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Hàng bán nhiều</h2>
            <ul className="mt-2 space-y-1 text-sm">
              {data.topProducts.map((row) => (
                <li key={row.name}>
                  {row.name}: {row.qty} · {formatMaybe(row.revenue)}
                </li>
              ))}
              {data.topProducts.length === 0 ? <li>Chưa có.</li> : null}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Chi phí cố định tháng {month}</h2>
            <FixedEditor
              key={month + data.fixed.map((row) => row.amount).join(",")}
              rows={data.fixed}
              onSave={async (rows) => {
                await saveFixedMonth({ data: { month, rows } });
                toast.success("Đã lưu chi phí tháng");
                await queryClient.invalidateQueries({ queryKey: ["report", month, grain] });
              }}
            />
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

function FixedEditor({
  rows,
  onSave,
}: {
  rows: { key: string; name: string; amount: number; note: string }[];
  onSave: (rows: { key: string; amount: number }[]) => Promise<void>;
}) {
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
        </label>
      ))}
      <Button className="min-h-11" onClick={() => onSave(draft.map((row) => ({ key: row.key, amount: Number.isFinite(row.amount) ? row.amount : 0 })))}>
        Lưu chi phí tháng này
      </Button>
    </div>
  );
}
