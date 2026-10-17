import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

import { Input } from "@/components/ui/input";
import { getCustomers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/khach/")({
  component: CustomersPage,
});

function CustomersPage() {
  const [q, setQ] = useState("");
  const customers = useQuery({ queryKey: ["customers", q], queryFn: () => getCustomers({ data: { q } }) });
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">Khách hàng</h1>
      <Input className="min-h-12" placeholder="Tên hoặc số điện thoại" value={q} onChange={(e) => setQ(e.target.value)} />
      <ul className="space-y-2">
        {(customers.data ?? []).map((customer) => (
          <li key={customer.id}>
            <Link to="/admin/khach/$id" params={{ id: customer.id }} className="glass-card block rounded-3xl p-4">
              <p className="font-bold text-primary">{customer.name}</p>
              <p className="text-sm text-muted-foreground">
                {customer.phone} · {customer.orders} đơn
              </p>
            </Link>
          </li>
        ))}
        {customers.data && customers.data.length === 0 ? <li className="text-sm text-muted-foreground">Chưa có khách.</li> : null}
      </ul>
    </div>
  );
}
