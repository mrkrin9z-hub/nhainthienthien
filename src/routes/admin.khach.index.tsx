import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RotateCcw, UserX } from "lucide-react";

import { RoleGate } from "@/components/role-gate";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ALL_TONE, CHANNEL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { CustomerLinks } from "@/components/admin/sections";
import { formatMaybe } from "@/lib/brand";
import { getCustomers } from "@/lib/admin.functions";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";

export const Route = createFileRoute("/admin/khach/")({
  component: CustomersPage,
});

function CustomersPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <CustomersBody />
    </RoleGate>
  );
}

function CustomersBody() {
  const [q, setQ] = useState("");
  const [includeCancelled, setIncludeCancelled] = useState(false);
  const [channel, setChannel] = useState("all");
  const [repeatOnly, setRepeatOnly] = useState(false);
  const customers = useQuery({
    queryKey: ["customers", q, includeCancelled],
    queryFn: () => getCustomers({ data: { q, includeCancelled } }),
  });
  const rows = customers.data ?? [];
  const channelChips = useMemo<FilterChip[]>(() => {
    return [
      { id: "all", label: "Mọi kênh", count: rows.length, ...ALL_TONE },
      ...CHANNELS.map((id) => {
        const tone = CHANNEL_TONE[id] ?? ALL_TONE;
        return {
          id,
          label: CHANNEL_LABEL[id],
          count: rows.filter((row) => row.channels.includes(CHANNEL_LABEL[id])).length,
          color: tone.color,
          icon: tone.icon,
        };
      }),
    ];
  }, [rows]);
  const shown = rows.filter((customer) => {
    if (repeatOnly && !customer.repeat) return false;
    if (channel !== "all" && !customer.channels.includes(CHANNEL_LABEL[channel as Channel])) return false;
    return true;
  });
  const list = useListPage(shown, `${q}|${channel}|${repeatOnly}|${includeCancelled}`);

  return (
    <div className="space-y-3">
      <CustomerLinks />
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Đang hiện" value={String(shown.length)} />
        <Stat label="Quay lại" value={String(shown.filter((row) => row.repeat).length)} />
        <Stat label="Một đơn" value={String(shown.filter((row) => row.orderCount <= 1).length)} />
      </div>
      <PageToolbar
        title="Khách hàng"
        hint="Cùng một số điện thoại thật là một khách. Số bị che chỉ gộp khi cùng tài khoản sàn, hoặc trùng cả tên và địa chỉ."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tên, số điện thoại hoặc thẻ"
      />
      <FilterChips label="Kênh khách" value={channel} chips={channelChips} onChange={setChannel} />
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        <ToggleChip active={repeatOnly} icon={RotateCcw} label="Quay lại" onClick={() => setRepeatOnly((value) => !value)} />
        <ToggleChip
          active={includeCancelled}
          icon={UserX}
          label={includeCancelled ? "Đang hiện đơn hủy" : "Hiện khách chỉ có đơn hủy"}
          onClick={() => setIncludeCancelled((value) => !value)}
        />
      </div>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="khách" onPage={list.setPage} />
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/40 text-[11px] tracking-wide uppercase">
              <TableHead className="w-14">STT</TableHead>
              <TableHead>Khách hàng</TableHead>
              <TableHead>SĐT</TableHead>
              <TableHead>Kênh</TableHead>
              <TableHead className="text-right">Đơn</TableHead>
              <TableHead className="text-right">Doanh số</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.slice.map((customer, index) => (
              <TableRow key={customer.id}>
                <TableCell className="text-muted-foreground">{list.start + index + 1}</TableCell>
                <TableCell>
                  <Link to="/admin/khach/$id" params={{ id: customer.id }} className="font-medium text-primary">
                    {customer.name}
                  </Link>
                  {customer.repeat ? <Badge variant="secondary" className="ml-2 text-[10px]">Quay lại</Badge> : null}
                  {customer.tags.length ? <p className="text-xs text-muted-foreground">{customer.tags.join(" · ")}</p> : null}
                </TableCell>
                <TableCell>{customer.phone}</TableCell>
                <TableCell className="text-xs">{customer.channels.join(", ") || "—"}</TableCell>
                <TableCell className="text-right">{customer.orderCount}</TableCell>
                <TableCell className="text-right">
                  {customer.totalSpent === null ? "—" : formatMaybe(customer.totalSpent)}
                  {customer.spentIncomplete ? <span className="block text-[11px] text-muted-foreground">Thiếu giá</span> : null}
                </TableCell>
              </TableRow>
            ))}
            {customers.data && shown.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="py-6 text-center text-muted-foreground">
                  {rows.length === 0 ? "Chưa có khách." : "Không có khách khớp bộ lọc."}
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-card p-3">
      <p className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="mt-1 text-xl font-semibold">{value}</p>
    </div>
  );
}

function ToggleChip({
  active,
  icon: Icon,
  label,
  onClick,
}: {
  active: boolean;
  icon: typeof RotateCcw;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold active:scale-95 ${active ? "border-primary bg-primary text-primary-foreground" : "bg-card"}`}
    >
      <Icon className="size-3.5" />
      {label}
    </button>
  );
}
