import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Lock, MoreHorizontal } from "lucide-react";
import { vnMonth } from "@/domain/calc";
import { formatMaybe } from "@/lib/brand";
import { closePayroll, downloadExcel, getMe, getPayroll } from "@/lib/admin.functions";
import { ROLE_LABEL, type Role } from "@/domain/types";

export const Route = createFileRoute("/admin/luong")({
  component: PayrollPage,
});

function monthNow() {
  return vnMonth();
}

function PayrollPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [month, setMonth] = useState(monthNow());
  const [q, setQ] = useState("");
  const [role, setRole] = useState("all");
  const [filters, setFilters] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const payroll = useQuery({ queryKey: ["payroll", month], queryFn: () => getPayroll({ data: { month } }) });
  const source = payroll.data?.rows ?? [];
  const rows = source.filter((row) => {
    if (role !== "all" && row.role !== role) return false;
    const needle = q.trim().toLowerCase();
    return !needle || row.name.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Mọi vai trò", count: source.length, ...ALL_TONE },
    ...(["owner", "sale", "production"] as Role[]).map((id) => ({
      id,
      label: ROLE_LABEL[id],
      count: source.filter((row) => row.role === id).length,
      color: "#1D4ED8",
    })),
  ];
  const list = useListPage(rows, `${month}|${q}|${role}`);
  const owner = me.data?.role === "owner";
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (payroll.isError) return <p className="font-semibold text-destructive">{(payroll.error as Error).message}</p>;
  return (
    <div className="space-y-4">
      <PageToolbar
        title={owner ? "Check lương" : "Lương của tôi"}
        hint={owner ? "Sale 8.000.000đ (thử việc 85%) cộng hoa hồng 3% / 5% / 7%. Sản xuất 11.000.000đ, không thưởng sản phẩm." : "Chỉ hiện lương của tài khoản đang đăng nhập."}
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên"
        filterCount={role === "all" ? 1 : 2}
        onFilter={() => setFilters(true)}
        actions={
          owner ? (
            <>
              <ToolbarButton label="Chốt tháng" icon={Lock} primary onClick={() => setCloseOpen(true)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex size-9 items-center justify-center rounded-md border" aria-label="Thêm thao tác">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
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
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc lương">
        <label className="text-sm font-semibold">
          Tháng lương
          <Input className="mt-1 min-h-11" type="month" aria-label="Tháng lương" value={month} onChange={(e) => setMonth(e.target.value)} />
        </label>
        {owner ? <FilterChips label="Vai trò" value={role} chips={chips} onChange={setRole} wrap /> : null}
      </FilterSheet>
      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Chốt lương tháng {month}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Sau khi chốt, tháng này được đánh dấu đã chốt.</p>
          <DialogFooter>
            <Button
              onClick={() =>
                closePayroll({ data: { month } }).then(() => {
                  toast.success("Đã chốt lương");
                  setCloseOpen(false);
                })
              }
            >
              Chốt tháng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {payroll.data?.locked ? <p className="text-sm font-semibold">Tháng này đã chốt.</p> : null}
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="người" onPage={list.setPage} />
      <div className="grid gap-3">
        {list.slice.map((row) => (
          <article key={row.staffId} className="glass-card rounded-3xl p-4">
            <h2 className="text-lg font-bold text-primary">
              {row.name} · {ROLE_LABEL[row.role as Role]}
            </h2>
            <ul className="mt-2 space-y-1 text-sm">
              <li>Lương cứng: {formatMaybe(row.base)}</li>
              <li>Thưởng KPI: {formatMaybe(row.kpiBonus)} (phương án A không có thưởng KPI)</li>
              {"commission" in row ? <li>Hoa hồng: {formatMaybe(row.commission)}</li> : null}
              {"commissionBasis" in row && row.commissionBasis ? (
                <li>Cách tính hoa hồng: {row.commissionBasis === "handled" ? "Theo đơn người đó xử lý" : "Toàn tiệm"}</li>
              ) : null}
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
