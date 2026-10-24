import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { lazy, Suspense } from "react";

import { getMe } from "@/lib/admin.functions";

const OrderManager = lazy(() => import("@/components/admin/order-manager").then((mod) => ({ default: mod.OrderManager })));

export const Route = createFileRoute("/admin/don-hang/")({
  validateSearch: (search: Record<string, unknown>): { status: string; q: string } => ({
    status: typeof search.status === "string" && search.status ? search.status : "can_lam",
    q: typeof search.q === "string" ? search.q : "",
  }),
  component: OrdersPage,
});

function OrdersPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const navigate = Route.useNavigate();
  const { status, q } = Route.useSearch();
  if (!me.data) return null;
  return (
    <Suspense fallback={null}>
      <OrderManager
        status={status}
        q={q}
        onStatus={(next, query) => {
          void navigate({ to: "/admin/don-hang", search: { status: next, q: query } });
        }}
      />
    </Suspense>
  );
}
