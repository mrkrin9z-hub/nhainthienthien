import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { OrderDesk, type DeskSku } from "@/components/admin/order-desk";
import { RoleGate } from "@/components/role-gate";
import { isMergedWoodAlias } from "@/domain/calc";
import type { Channel } from "@/domain/types";
import { createDeskOrder, getMe, getSkuOptions } from "@/lib/admin.functions";

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
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions() });
  const catalog = ((skus.data ?? []) as DeskSku[]).filter((sku) => !isMergedWoodAlias(sku));

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/don-hang" className="text-sm text-muted-foreground">
          Quay lại đơn hàng
        </Link>
        <h1 className="text-2xl font-bold">Tạo đơn mới</h1>
        <p className="text-sm text-muted-foreground">Cùng form với sửa đơn. Khách bên trái, thanh toán bên phải. Giá lấy theo kênh. Sale không sửa giá.</p>
      </div>
      <OrderDesk
        mode="create"
        owner={me.data?.role === "owner"}
        fieldsLocked={false}
        itemsLocked={false}
        lockNote=""
        catalog={catalog}
        paidSoFar={0}
        initial={{
          channel: "tai_tiem" as Channel,
          fullName: "",
          phone: "",
          address: "",
          fulfillment: "pickup",
          note: "",
          dueDate: "",
          marketplaceCode: "",
          lines: [],
        }}
        onSave={async (value) => {
          const result = await createDeskOrder({
            data: {
              channel: value.channel,
              fullName: value.fullName,
              phone: value.phone,
              address: value.address,
              fulfillment: value.fulfillment,
              note: value.note,
              dueDate: value.dueDate,
              marketplaceCode: value.marketplaceCode,
              depositPaid: value.depositPaid,
              depositMethod: value.depositMethod,
              items: value.items ?? [],
            },
          });
          toast.success(`Đã tạo ${result.code}`);
          void router.navigate({ to: "/admin/don-hang/$code", params: { code: result.code } });
        }}
      />
    </div>
  );
}
