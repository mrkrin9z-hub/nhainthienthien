import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";

import { OrderDesk, type DeskSku } from "@/components/admin/order-desk";
import { isMergedWoodAlias } from "@/domain/calc";
import { normalizeShopChannels } from "@/domain/org-desk";
import type { Channel } from "@/domain/types";
import { createDeskOrder, getMe, getSkuOptions, loadSettings } from "@/lib/admin.functions";

export function CreateOrderForm({
  onCreated,
  initialPhone = "",
  initialName = "",
}: {
  onCreated: (code: string) => void;
  initialPhone?: string;
  initialName?: string;
}) {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions() });
  const settings = useQuery({ queryKey: ["settings"], queryFn: () => loadSettings() });
  const catalog = ((skus.data ?? []) as DeskSku[]).filter((sku) => !isMergedWoodAlias(sku));
  const channels = normalizeShopChannels(settings.data?.settings.shopChannels).filter((row) => row.enabled);

  return (
    <OrderDesk
      mode="create"
      owner={me.data?.role === "owner"}
      fieldsLocked={false}
      itemsLocked={false}
      lockNote=""
      catalog={catalog}
      channelOptions={channels.length ? channels : undefined}
      paidSoFar={0}
      initial={{
        channel: (channels[0]?.id ?? "tai_tiem") as Channel,
        fullName: initialName,
        phone: initialPhone,
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
