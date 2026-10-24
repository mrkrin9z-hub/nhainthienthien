import { createFileRoute } from "@tanstack/react-router";

import { OrderManager } from "@/components/admin/order-manager";

export const Route = createFileRoute("/admin/don-hang/")({
  validateSearch: (search: Record<string, unknown>): { status: string; q: string } => ({
    status: typeof search.status === "string" && search.status ? search.status : "can_lam",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const navigate = Route.useNavigate();
  const { status, q } = Route.useSearch();
  return (
    <OrderManager
      status={status}
      q={q}
      onStatus={(next, query) => {
        void navigate({ to: "/admin/don-hang", search: { status: next, q: query } });
      }}
    />
  );
}
