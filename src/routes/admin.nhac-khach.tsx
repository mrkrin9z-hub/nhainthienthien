import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

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
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Nhắc khách</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Khách có đơn cuối đã lâu, hoặc ngày giỗ / ngày đặc biệt sắp tới. Chép tin nhắn rồi gửi tay. Phần mềm không tự gửi.
        </p>
      </div>
      {reminders.isError ? <p className="font-semibold text-destructive">{(reminders.error as Error).message}</p> : null}
      <ul className="space-y-3">
        {(reminders.data ?? []).map((customer) => (
          <li key={customer.id} className="glass-card space-y-2 rounded-3xl p-4">
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
        {reminders.data && reminders.data.length === 0 ? <li className="text-sm text-muted-foreground">Chưa có khách cần nhắc.</li> : null}
      </ul>
    </div>
  );
}
