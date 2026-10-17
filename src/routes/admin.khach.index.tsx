import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { RoleGate } from "@/components/role-gate";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { getCustomers } from "@/lib/admin.functions";

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
  const customers = useQuery({
    queryKey: ["customers", q, includeCancelled],
    queryFn: () => getCustomers({ data: { q, includeCancelled } }),
  });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Khách hàng</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Cùng một số điện thoại thật là một khách. Số bị che chỉ gộp khi cùng tài khoản sàn, hoặc trùng cả tên và địa chỉ. Khách chỉ còn đơn hủy được ẩn.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Input className="min-h-12 min-w-0 flex-1" placeholder="Tên, số điện thoại hoặc thẻ" value={q} onChange={(e) => setQ(e.target.value)} />
        <button
          type="button"
          className="inline-flex min-h-12 items-center rounded-xl bg-card px-4 text-sm font-semibold"
          onClick={() => setIncludeCancelled((value) => !value)}
        >
          {includeCancelled ? "Ẩn đơn hủy" : "Hiện khách chỉ có đơn hủy"}
        </button>
      </div>
      <ul className="space-y-2">
        {(customers.data ?? []).map((customer) => (
          <li key={customer.id}>
            <Link to="/admin/khach/$id" params={{ id: customer.id }} className="glass-card block rounded-3xl p-4">
              <p className="font-bold text-primary">
                {customer.name}
                {customer.repeat ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-xs font-bold text-accent-foreground">Quay lại</span> : null}
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
        {customers.data && customers.data.length === 0 ? <li className="text-sm text-muted-foreground">Chưa có khách.</li> : null}
      </ul>
    </div>
  );
}
