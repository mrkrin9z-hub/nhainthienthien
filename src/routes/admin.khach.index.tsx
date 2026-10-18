import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { RotateCcw, UserX } from "lucide-react";

import { RoleGate } from "@/components/role-gate";
import { ALL_TONE, CHANNEL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { PageToolbar } from "@/components/admin/page-toolbar";
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

  return (
    <div className="space-y-3">
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
      <p className="text-xs text-muted-foreground">Hiển thị {shown.length} khách</p>
      <ul className="space-y-2">
        {shown.map((customer) => (
          <li key={customer.id}>
            <Link to="/admin/khach/$id" params={{ id: customer.id }} className="block rounded-2xl border border-border/70 bg-card p-4">
              <p className="font-semibold text-primary">
                {customer.name}
                {customer.repeat ? <span className="ml-2 rounded-full bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground">Quay lại</span> : null}
              </p>
              <p className="text-sm text-muted-foreground">
                {customer.phone} · {customer.orderCount} đơn · {customer.totalSpent === null ? "Chưa có doanh số" : formatMaybe(customer.totalSpent)}
                {customer.spentIncomplete ? " (thiếu giá một số đơn)" : ""}
              </p>
              {customer.channels.length ? <p className="text-sm">{customer.channels.join(", ")}</p> : null}
              {customer.tags.length ? <p className="text-sm">{customer.tags.join(" · ")}</p> : null}
            </Link>
          </li>
        ))}
        {customers.data && shown.length === 0 ? <li className="text-sm text-muted-foreground">{rows.length === 0 ? "Chưa có khách." : "Không có khách khớp bộ lọc."}</li> : null}
      </ul>
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
