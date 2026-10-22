import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";

import { CreateOrderForm } from "@/components/admin/create-order-form";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/orders/create")({
  validateSearch: (search: Record<string, unknown>) => ({
    phone: typeof search.phone === "string" ? search.phone : undefined,
    name: typeof search.name === "string" ? search.name : undefined,
    chat: typeof search.chat === "string" ? search.chat : undefined,
  }),
  component: CreateOrderPage,
});

function CreateOrderPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <CreateOrderBody />
    </RoleGate>
  );
}

function CreateOrderBody() {
  const router = useRouter();
  const search = Route.useSearch();

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-3">
        <Link
          to="/admin/don-hang"
          className="mt-1 flex size-9 shrink-0 items-center justify-center rounded-full border bg-card text-muted-foreground hover:text-primary"
          aria-label="Quay lại đơn hàng"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Tạo đơn hàng mới</h1>
          <p className="text-sm text-muted-foreground">Khách, kênh, sản phẩm và thanh toán — lưu một lần.</p>
        </div>
      </div>
      <CreateOrderForm
        initialPhone={search.phone}
        initialName={search.name}
        onCreated={(code) => void router.navigate({ to: "/admin/don-hang/$code", params: { code } })}
      />
    </div>
  );
}
