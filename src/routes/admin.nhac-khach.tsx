import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bell, CalendarDays } from "lucide-react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { CustomerLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { getReminders } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/nhac-khach")({
  component: RemindPage,
});

function RemindPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <RemindBody />
    </RoleGate>
  );
}

function RemindBody() {
  const reminders = useQuery({ queryKey: ["reminders"], queryFn: () => getReminders() });
  const [q, setQ] = useState("");
  const [kind, setKind] = useState("all");
  const rows = reminders.data ?? [];
  const chips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: rows.length, ...ALL_TONE },
    { id: "quiet", label: "Lâu chưa in", count: rows.filter((row) => row.reasons.some((reason) => reason.startsWith("Đơn cuối"))).length, color: "#D97706", icon: Bell },
    { id: "date", label: "Ngày đặc biệt", count: rows.filter((row) => row.reasons.some((reason) => !reason.startsWith("Đơn cuối"))).length, color: "#7C3AED", icon: CalendarDays },
  ];
  const shown = rows.filter((customer) => {
    if (kind === "quiet" && !customer.reasons.some((reason) => reason.startsWith("Đơn cuối"))) return false;
    if (kind === "date" && !customer.reasons.some((reason) => !reason.startsWith("Đơn cuối"))) return false;
    const needle = q.trim().toLowerCase();
    if (!needle) return true;
    return `${customer.name} ${customer.phone} ${customer.reasons.join(" ")}`.toLowerCase().includes(needle);
  });
  return (
    <div className="space-y-3">
      <CustomerLinks />
      <PageToolbar
        title="Nhắc khách"
        hint="Khách có đơn cuối đã lâu, hoặc ngày giỗ / ngày đặc biệt sắp tới. Chép tin nhắn rồi gửi tay. Phần mềm không tự gửi."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên hoặc số điện thoại…"
      />
      <FilterChips label="Lý do nhắc" value={kind} chips={chips} onChange={setKind} />
      {reminders.isError ? <p className="font-semibold text-destructive">{(reminders.error as Error).message}</p> : null}
      <ul className="space-y-3">
        {shown.map((customer) => (
          <li key={customer.id} className="space-y-2 rounded-2xl border border-border/70 bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <Link to="/admin/khach/$id" params={{ id: customer.id }} className="font-bold text-primary">
                  {customer.name}
                </Link>
                <p className="text-sm text-muted-foreground">{customer.phone}</p>
              </div>
              <p className="text-sm">{customer.reasons.join(" · ")}</p>
            </div>
            <p className="rounded-2xl bg-background p-3 text-sm">{customer.message}</p>
            <Button
              variant="outline"
              className="min-h-12"
              onClick={() => {
                void navigator.clipboard.writeText(customer.message);
                toast.success("Đã chép tin nhắn");
              }}
            >
              Chép tin nhắn
            </Button>
          </li>
        ))}
        {reminders.data && shown.length === 0 ? <li className="text-sm text-muted-foreground">{rows.length === 0 ? "Chưa có khách cần nhắc." : "Không có khách khớp bộ lọc."}</li> : null}
      </ul>
    </div>
  );
}
