import { useEffect, useState } from "react";

function initialDay(dayKey: string, focusDay?: string) {
  const keys = dayKey.split("|").filter(Boolean);
  if (focusDay && keys.includes(focusDay)) return focusDay;
  return keys.at(-1) ?? "";
}

import type { WasteCompare, WasteDayStat, WasteMonth, WasteSlice } from "@/domain/waste";
import { formatMaybe } from "@/lib/brand";

type MonthView = Pick<WasteMonth, "wasteCost" | "wasteRate" | "wasteUnknown" | "wasteLines" | "byMaterial" | "byReason" | "byPerson" | "byChannel">;

export function WasteCostReport({
  month,
  summary,
  days,
  compare,
  focusDay,
}: {
  month: string;
  summary: MonthView;
  days: WasteDayStat[];
  compare: WasteCompare;
  focusDay?: string;
}) {
  const dayKey = days.map((row) => row.day).join("|");
  const [picked, setPicked] = useState(() => initialDay(dayKey, focusDay));
  useEffect(() => {
    setPicked(initialDay(dayKey, focusDay));
  }, [dayKey, focusDay]);
  const selected = days.find((row) => row.day === picked) ?? null;
  const maxDay = Math.max(1, ...days.map((row) => row.wasteCost));
  const maxMonth = Math.max(1, summary.wasteCost, compare.previousCost);

  return (
    <section className="glass-card space-y-4 rounded-3xl p-4">
      <div>
        <h2 className="font-bold text-primary">Hao hụt tháng {month}</h2>
        <p className="mt-1 text-sm">
          {summary.wasteLines} phiếu · {formatMaybe(summary.wasteCost)}
          {summary.wasteRate === null ? " · chưa có doanh thu để tính %" : ` · ${summary.wasteRate}% doanh thu`}
        </p>
        {summary.wasteUnknown > 0 ? <p className="mt-1 text-sm text-muted-foreground">{summary.wasteUnknown} phiếu chưa có giá mua, chưa cộng vào tiền.</p> : null}
      </div>
      <div>
        <h3 className="text-sm font-semibold">So với tháng {compare.previousMonth}</h3>
        <ul className="mt-2 space-y-2">
          <BarRow label="Tháng này" cost={summary.wasteCost} rate={summary.wasteRate} max={maxMonth} />
          <BarRow label="Tháng trước" cost={compare.previousCost} rate={compare.previousRate} max={maxMonth} />
        </ul>
        <p className="mt-2 text-sm">
          Lệch {formatMaybe(compare.costDelta)}
          {compare.rateDelta === null ? "" : ` · ${compare.rateDelta > 0 ? "+" : ""}${compare.rateDelta} điểm % doanh thu`}
        </p>
      </div>
      <div>
        <h3 className="text-sm font-semibold">Theo ngày</h3>
        {days.length === 0 ? <p className="mt-1 text-sm text-muted-foreground">Chưa có phiếu trong tháng.</p> : null}
        <ul className="mt-2 space-y-1">
          {days.map((row) => (
            <li key={row.day}>
              <button type="button" className="grid w-full grid-cols-[6.2rem_1fr] items-center gap-2 text-left" aria-pressed={row.day === picked} onClick={() => setPicked(row.day)}>
                <span className={`text-sm ${row.day === picked ? "font-semibold" : ""}`}>{row.day}</span>
                <BarTrack cost={row.wasteCost} max={maxDay} caption={`${formatMaybe(row.wasteCost)}${row.wasteRate === null ? "" : ` · ${row.wasteRate}%`}`} />
              </button>
            </li>
          ))}
        </ul>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <CostTable title="Tháng này theo vật tư" rows={summary.byMaterial} />
        <CostTable title="Tháng này theo lý do" rows={summary.byReason} />
        <CostTable title="Tháng này theo người" rows={summary.byPerson} />
        <CostTable title="Tháng này theo kênh" rows={summary.byChannel} />
      </div>
      <div>
        <h3 className="font-semibold text-primary">Trong ngày {selected?.day ?? "—"}</h3>
        {selected ? (
          <>
            <p className="mt-1 text-sm">
              {selected.wasteLines} phiếu · {formatMaybe(selected.wasteCost)}
              {selected.wasteRate === null ? " · chưa có doanh thu trong ngày" : ` · ${selected.wasteRate}% doanh thu ngày`}
            </p>
            {selected.wasteUnknown > 0 ? <p className="mt-1 text-sm text-muted-foreground">{selected.wasteUnknown} phiếu chưa có giá mua.</p> : null}
            <div className="mt-3 grid gap-4 sm:grid-cols-2">
              <CostTable title="Vật tư" rows={selected.byMaterial} />
              <CostTable title="Lý do" rows={selected.byReason} />
              <CostTable title="Người" rows={selected.byPerson} />
              <CostTable title="Kênh" rows={selected.byChannel} />
            </div>
          </>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">Chưa có phiếu trong ngày.</p>
        )}
      </div>
    </section>
  );
}

function BarRow({ label, cost, rate, max }: { label: string; cost: number; rate: number | null; max: number }) {
  return (
    <li className="grid grid-cols-[6.2rem_1fr] items-center gap-2">
      <span className="text-sm">{label}</span>
      <BarTrack cost={cost} max={max} caption={`${formatMaybe(cost)}${rate === null ? "" : ` · ${rate}%`}`} />
    </li>
  );
}

function BarTrack({ cost, max, caption }: { cost: number; max: number; caption: string }) {
  const width = cost > 0 ? Math.max(4, Math.round((cost / max) * 100)) : 0;
  return (
    <span className="block">
      <span className="block h-2 overflow-hidden rounded-full bg-muted">
        <span className="block h-2 rounded-full bg-primary" style={{ width: `${width}%` }} />
      </span>
      <span className="text-sm tabular-nums">{caption}</span>
    </span>
  );
}

function CostTable({ title, rows }: { title: string; rows: WasteSlice[] }) {
  const total = rows.reduce((sum, row) => sum + row.cost, 0);
  return (
    <table className="w-full text-sm">
      <caption className="mb-1 text-left font-semibold">{title}</caption>
      <thead>
        <tr className="text-left text-muted-foreground">
          <th className="py-1 font-medium">Hạng mục</th>
          <th className="py-1 text-right font-medium">Tiền</th>
          <th className="py-1 text-right font-medium">% doanh thu</th>
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td className="py-1 text-muted-foreground" colSpan={3}>
              Chưa có.
            </td>
          </tr>
        ) : (
          rows.map((row) => (
            <tr key={row.key} className="border-t">
              <td className="py-1">{row.label}</td>
              <td className="py-1 text-right tabular-nums">{formatMaybe(row.cost)}</td>
              <td className="py-1 text-right tabular-nums">{row.rate === null ? "—" : `${row.rate}%`}</td>
            </tr>
          ))
        )}
        {rows.length > 0 ? (
          <tr className="border-t font-semibold">
            <td className="py-1">Tổng</td>
            <td className="py-1 text-right tabular-nums">{formatMaybe(total)}</td>
            <td />
          </tr>
        ) : null}
      </tbody>
    </table>
  );
}
