import { createFileRoute, Link, useRouter } from "@tanstack/react-router";

import { CreateOrderForm } from "@/components/admin/create-order-form";
import { RoleGate } from "@/components/role-gate";

export const Route = createFileRoute("/admin/don-moi")({
  component: NewOrderPage,
});

function NewOrderPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <NewOrderBody />
    </RoleGate>
  );
}

function NewOrderBody() {
  const router = useRouter();

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/don-hang" className="text-sm text-muted-foreground">
          Quay lại đơn hàng
        </Link>
        <h1 className="text-2xl font-bold">Tạo đơn mới</h1>
        <p className="text-sm text-muted-foreground">Cùng form với sửa đơn. Khách bên trái, thanh toán bên phải. Giá lấy theo kênh. Sale không sửa giá.</p>
      </div>
      <CreateOrderForm onCreated={(code) => void router.navigate({ to: "/admin/don-hang/$code", params: { code } })} />
    </div>
  );
}
