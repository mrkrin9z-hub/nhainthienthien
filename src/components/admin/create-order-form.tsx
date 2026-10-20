import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { OrderDesk, type DeskSku } from "@/components/admin/order-desk";
import { isMergedWoodAlias } from "@/domain/calc";
import type { Channel } from "@/domain/types";
import { createDeskOrder, getMe, getSkuOptions } from "@/lib/admin.functions";

export function CreateOrderForm({ onCreated }: { onCreated: (code: string) => void }) {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions() });
  const catalog = ((skus.data ?? []) as DeskSku[]).filter((sku) => !isMergedWoodAlias(sku));

  return (
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
        onCreated(result.code);
      }}
    />
  );
}
