import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { vnMonth } from "@/domain/calc";
import { ROLE_LABEL, type Role } from "@/domain/types";
import { formatMaybe } from "@/lib/brand";
import { getMe, getPayroll } from "@/lib/admin.functions";
import { CircleHelp } from "lucide-react";

export const Route = createFileRoute("/admin/thuong")({
  component: BonusPage,
});

function BonusPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [month, setMonth] = useState(vnMonth());
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(false);
  const [help, setHelp] = useState(false);
  const payroll = useQuery({ queryKey: ["payroll", month], queryFn: () => getPayroll({ data: { month } }) });
  if (me.data && me.data.role === "production") {
    return <p className="text-sm">Sản xuất không có thưởng sản phẩm. Lương cứng nằm ở Check lương.</p>;
  }
  const rows = (payroll.data?.rows ?? []).filter((row) => {
    const needle = q.trim().toLowerCase();
    return !needle || row.name.toLowerCase().includes(needle);
  });
  return (
    <div className="space-y-3">
      <PageToolbar
        title="Check thưởng"
        hint="Thưởng đang dùng là hoa hồng sale 3% / 5% / 7% trên doanh thu đã thu. Sản xuất không có thưởng sản phẩm."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên"
        filterCount={1}
        onFilter={() => setFilters(true)}
        actions={<ToolbarButton label="Cách tính" icon={CircleHelp} primary onClick={() => setHelp(true)} />}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc thưởng">
        <label className="text-sm font-semibold">
          Tháng
          <Input className="mt-1 min-h-11" type="month" aria-label="Tháng thưởng" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </FilterSheet>
      <Dialog open={help} onOpenChange={setHelp}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cách tính thưởng</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            Hoa hồng sale: 3% đến 100 triệu doanh thu đã thu, 5% từ 100 đến 200 triệu, 7% từ 200 triệu. Sản xuất nhận lương cứng, không thưởng theo sản phẩm. Tháng trước khai trương thì thưởng bằng 0.
          </p>
        </DialogContent>
      </Dialog>
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {rows.map((row) => (
          <li key={row.staffId} className="flex items-center justify-between gap-3 px-3 py-3">
            <div>
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-muted-foreground">
                {ROLE_LABEL[row.role as Role]} · doanh thu {formatMaybe(row.revenue)}
                {row.kpiPercent != null ? ` · ${row.kpiPercent}% mục tiêu` : ""}
              </p>
            </div>
            <p className="font-semibold">{row.role === "sale" ? formatMaybe(row.commission) : "0đ"}</p>
          </li>
        ))}
      </ul>
      {payroll.data && rows.length === 0 ? <p className="text-sm text-muted-foreground">Không có người khớp.</p> : null}
    </div>
  );
}
