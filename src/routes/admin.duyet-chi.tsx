import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { FilterSheet, PageToolbar } from "@/components/admin/page-toolbar";
import { RoleGate } from "@/components/role-gate";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { vnMonth, vnYmd } from "@/domain/calc";
import { formatVnd } from "@/lib/brand";
import { approveExpense, getMoneyDesk } from "@/lib/admin.functions";
import { MoreHorizontal } from "lucide-react";

export const Route = createFileRoute("/admin/duyet-chi")({
  component: ApprovePage,
});

function ApprovePage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ duyệt chi.">
      <ApproveBody />
    </RoleGate>
  );
}

function ApproveBody() {
  const [month, setMonth] = useState(vnMonth());
  const [q, setQ] = useState("");
  const [filters, setFilters] = useState(false);
  const queryClient = useQueryClient();
  const desk = useQuery({ queryKey: ["money", month], queryFn: () => getMoneyDesk({ data: { month } }) });
  const rows = (desk.data?.expenses ?? []).filter((row) => {
    if (!row.pending) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${row.name} ${row.note}`.toLowerCase().includes(needle);
  });

  return (
    <div className="space-y-3">
      <PageToolbar
        title="Duyệt chi"
        hint="Khoản mới chờ xác nhận. Tiền đã chi vẫn nằm trong sổ, duyệt chỉ để chủ kiểm lại."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm khoản chi"
        filterCount={1}
        onFilter={() => setFilters(true)}
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc duyệt chi">
        <label className="text-sm font-semibold">
          Tháng
          <Input className="mt-1 min-h-11" type="month" aria-label="Tháng duyệt chi" value={month} onChange={(event) => setMonth(event.target.value)} />
        </label>
      </FilterSheet>
      <ul className="divide-y overflow-hidden rounded-md border bg-card">
        {rows.map((row) => (
          <li key={row.id} className="flex items-center gap-3 px-3 py-3">
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{row.name}</p>
              <p className="text-sm text-muted-foreground">
                {vnYmd(row.at) || row.month} · {row.categoryLabel} · chờ duyệt
              </p>
            </div>
            <p className="font-semibold">{formatVnd(row.amount)}</p>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-8 items-center justify-center rounded-md border" aria-label={`Thao tác ${row.name}`}>
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={async () => {
                    try {
                      await approveExpense({ data: { id: row.id } });
                      toast.success("Đã duyệt chi");
                      await queryClient.invalidateQueries({ queryKey: ["money", month] });
                    } catch (error) {
                      toast.error((error as Error).message);
                    }
                  }}
                >
                  Duyệt
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        ))}
      </ul>
      {desk.data && rows.length === 0 ? <p className="text-sm text-muted-foreground">Không có khoản chi chờ duyệt.</p> : null}
    </div>
  );
}
