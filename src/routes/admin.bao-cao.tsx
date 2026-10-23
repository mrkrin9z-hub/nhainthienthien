import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FilterSheet, PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";
import { formatMaybe } from "@/lib/brand";
import { getReport, saveFixedMonth } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/bao-cao")({
  component: ReportPage,
});

function monthNow() {
  return vnMonth();
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
  const [scope, setScope] = useState<"all" | "nha_in" | Channel>("all");
  const [filters, setFilters] = useState(false);
  const queryClient = useQueryClient();
  const report = useQuery({ queryKey: ["report", month, grain, scope], queryFn: () => getReport({ data: { month, grain, scope } }) });
  const data = report.data;
  const progress = data?.breakEvenPercent === null || data?.breakEvenPercent === undefined ? 0 : Math.min(100, Math.max(0, data.breakEvenPercent));

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Báo cáo tổng"
        hint="Doanh thu và lãi gộp lấy đơn đã xong, trừ đơn thử. Lọc Nhà In, Mơ Home hoặc từng kênh. Lãi ròng trừ định phí chỉ từ tháng khai trương. Mơ Home không có hoa hồng sale."
        filterCount={1}
        onFilter={() => setFilters(true)}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc báo cáo">
        <label className="text-sm font-semibold">
          Tháng
          <Input className="mt-1 min-h-11" type="month" aria-label="Tháng báo cáo" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        <div className="flex flex-wrap gap-2">
          {(["day", "week", "month"] as const).map((item) => (
            <Button key={item} variant={grain === item ? "default" : "outline"} className="min-h-11" onClick={() => setGrain(item)}>
              {item === "day" ? "Ngày" : item === "week" ? "Tuần" : "Tháng"}
            </Button>
          ))}
        </div>
      </FilterSheet>
      <div className="flex flex-wrap gap-2">
        {(["all", "nha_in", ...CHANNELS] as const).map((item) => (
          <Button key={item} variant={scope === item ? "default" : "outline"} className="min-h-11" onClick={() => setScope(item)}>
            {item === "all" ? "Tất cả" : item === "nha_in" ? "Nhà In" : CHANNEL_LABEL[item]}
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
            <Stat label="Chi phí cố định" value={formatMaybe(data.costBasis)} />
            <Stat label="Chi phí phát sinh" value={formatMaybe(data.extraSum)} />
            <Stat label="Hao hụt" value={formatMaybe(data.wasteCost)} />
            <Stat label="Lãi ròng" value={data.net === null ? "Chưa đủ số" : formatMaybe(data.net)} />
            <Stat label="Giá trị đơn trung bình" value={data.averageOrder === null ? "—" : formatMaybe(data.averageOrder)} />
            <Stat label="Tỉ lệ hủy" value={data.cancelRate === null ? "—" : `${data.cancelRate}% (${data.cancelled}/${data.placed})`} />
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Lương sản xuất theo kênh</h2>
            <p className="mt-1 text-sm">{data.laborNote}</p>
            <p className="mt-2 text-sm font-semibold">
              Mơ Home {formatMaybe(data.moHomeLabor)} · Nhà In {formatMaybe(data.nhaInLabor)} · {data.laborPercent}%
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Tháng này tính vào lãi: {formatMaybe(data.fixedCharged)}.</p>
          </section>
          {data.scope === "nha_in" ? (
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Hòa vốn tháng</h2>
            <p className="mt-1 text-sm text-muted-foreground">Lãi gộp so với chi phí cố định tháng này.</p>
            <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted">
              <div className="h-full bg-primary" style={{ width: `${progress}%` }} />
            </div>
            <p className="mt-2 text-sm font-semibold">{data.breakEvenPercent === null ? "Chưa đủ lãi gộp để tính." : `${data.breakEvenPercent}%`}</p>
          </section>
          ) : null}
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Chi phí phát sinh tháng {month}</h2>
            <p className="mt-1 text-sm text-muted-foreground">Khoản này trừ riêng, không gộp vào chi phí cố định. Lãi ròng = lãi gộp − chi phí cố định − chi phí phát sinh − hao hụt.</p>
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
            <h2 className="font-bold text-primary">Hao hụt</h2>
            <p className="mt-1 text-sm">
              {data.wasteLines} phiếu / {data.placed} đơn
              {data.wasteRate === null ? "" : ` · ${data.wasteRate}% doanh thu`}
            </p>
            {data.wasteAlert ? (
              <p className="mt-1 text-sm font-semibold text-destructive">
                Vượt ngưỡng {data.wasteThreshold}%.
              </p>
            ) : null}
            {data.wasteUnknown > 0 ? <p className="mt-1 text-sm">{data.wasteUnknown} phiếu chưa có giá mua.</p> : null}
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <WasteLines title="Theo ngày" rows={data.wasteByDay} />
              <WasteLines title="Theo vật tư" rows={data.wasteByMaterial} />
              <WasteLines title="Theo lý do" rows={data.wasteByReason} />
              <WasteLines title="Theo người" rows={data.wasteByPerson} />
              <WasteLines title="Theo kênh" rows={data.wasteByChannel} />
            </div>
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

function WasteLines({ title, rows }: { title: string; rows: { key: string; label: string; lines: number; qty: number; cost: number }[] }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 text-sm">
        {rows.slice(0, 6).map((row) => (
          <li key={row.key}>
            {row.label}: {row.lines} · {row.qty} · {formatMaybe(row.cost)}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-muted-foreground">Chưa có.</li> : null}
      </ul>
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
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(rows.map((row) => ({ ...row })));
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(draft.map((row) => ({ key: row.key, amount: Number.isFinite(row.amount) ? row.amount : 0 })));
      setOpen(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mt-3 space-y-3">
      <div className="flex justify-end">
        <Button
          type="button"
          className="min-h-11"
          onClick={() => {
            setDraft(rows.map((row) => ({ ...row })));
            setOpen(true);
          }}
        >
          Sửa
        </Button>
      </div>
      <div className="overflow-hidden rounded-md border">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="px-3 py-2">Khoản</th>
              <th className="px-3 py-2 text-right">Số tiền</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.key} className="border-t">
                <td className="px-3 py-2">{row.name}</td>
                <td className="px-3 py-2 text-right font-semibold">{formatMaybe(row.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Sửa chi phí tháng</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {draft.map((row, index) => (
              <label key={row.key} className="block text-sm font-semibold">
                {row.name}
                <Input
                  className="mt-1 min-h-11"
                  inputMode="numeric"
                  value={String(row.amount)}
                  onChange={(event) => {
                    const next = [...draft];
                    next[index] = { ...row, amount: Number(event.target.value.replace(/[^\d]/g, "")) };
                    setDraft(next);
                  }}
                />
              </label>
            ))}
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu chi phí tháng này"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
