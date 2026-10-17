import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSkuMap, getSkuMaps, importMarketplace, previewMarketplace, storeSkuMap } from "@/lib/admin.functions";
import { EXPECTED_COLUMNS } from "@/domain/marketplace";
import { formatMaybe } from "@/lib/brand";

export const Route = createFileRoute("/admin/nhap-don")({
  component: ImportPage,
});

function ImportPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <ImportBody />
    </RoleGate>
  );
}

type Plan = Awaited<ReturnType<typeof previewMarketplace>>;

function ImportBody() {
  const queryClient = useQueryClient();
  const maps = useQuery({ queryKey: ["sku-maps"], queryFn: () => getSkuMaps() });
  const [channel, setChannel] = useState<"tiktok" | "shopee">("tiktok");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [externalSku, setExternalSku] = useState("");
  const [skuId, setSkuId] = useState("");

  async function readFile(next: File) {
    const bytes = new Uint8Array(await next.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) {
      binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    }
    setFile({ name: next.name, base64: btoa(binary) });
    setPlan(null);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Nhập đơn sàn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Tải file xuất từ TikTok Shop hoặc Shopee Seller Center (CSV hoặc XLSX). Dòng mô tả dưới tiêu đề bị bỏ. Số điện thoại bị che vẫn nhập, ghi SĐT bị ẩn. Đơn Đã hủy không vào sổ. Tiền trên đơn là tiền sàn; giá niêm yết chỉ để đối chiếu. Đơn vào trạng thái Nhận đơn, kho trừ khi chuyển sang In và Giao như đơn thường.
        </p>
      </div>
      <section className="glass-card space-y-2 rounded-3xl p-4 text-sm">
        <h2 className="font-bold text-primary">Cột cần có</h2>
        <ul className="list-disc space-y-1 pl-5 text-muted-foreground">
          {EXPECTED_COLUMNS.map((column) => (
            <li key={column}>{column}</li>
          ))}
        </ul>
      </section>
      <section className="glass-card space-y-3 rounded-3xl p-4">
        <Label htmlFor="channel">Sàn</Label>
        <select id="channel" className="min-h-12 w-full rounded-xl border bg-card px-3" value={channel} onChange={(e) => setChannel(e.target.value as "tiktok" | "shopee")}>
          <option value="tiktok">TikTok Shop</option>
          <option value="shopee">Shopee</option>
        </select>
        <Label htmlFor="file">File đơn</Label>
        <Input
          id="file"
          className="min-h-12"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) void readFile(next);
          }}
        />
        <Button
          className="min-h-12"
          disabled={!file}
          onClick={async () => {
            if (!file) return;
            try {
              const next = await previewMarketplace({ data: { channel, filename: file.name, base64: file.base64 } });
              setPlan(next);
            } catch (error) {
              toast.error((error as Error).message);
            }
          }}
        >
          Xem trước
        </Button>
        {plan ? (
          <div className="space-y-2 text-sm">
            <p>
              {plan.orders.length} đơn sẽ nhập. {plan.duplicates.length} đơn đã có, bỏ qua. {plan.cancelled} đơn đã hủy, bỏ qua. {plan.issues.length} dòng chưa nhập được.
            </p>
            {plan.orders.slice(0, 20).map((order) => (
              <div key={order.platformOrderId} className="rounded-2xl bg-background px-3 py-2">
                <p className="font-semibold">
                  {order.platformOrderId} · {order.buyer}
                  {order.codAmount != null ? ` · COD ${formatMaybe(order.codAmount)}` : ""}
                  {order.flags.length ? ` · ${order.flags.join(", ")}` : ""}
                </p>
                {order.items.map((item, index) => (
                  <p key={`${order.platformOrderId}-${item.externalSku}-${index}`} className="text-muted-foreground">
                    {item.quantity}× {item.name || item.externalSku} · Sàn {formatMaybe(item.platformLineTotal)} · Niêm yết{" "}
                    {item.listUnitPrice === null ? "chưa có" : formatMaybe(item.listUnitPrice * item.quantity)}
                    {item.difference === null ? "" : ` · Lệch ${formatMaybe(item.difference)}`}
                  </p>
                ))}
              </div>
            ))}
            {plan.issues.slice(0, 30).map((issue, index) => (
              <p key={`${issue.orderId}-${issue.sku}-${index}`} className="text-destructive">
                {issue.orderId || "Không mã"} · {issue.sku || "—"} · {issue.reason}
              </p>
            ))}
            <Button
              className="min-h-12 bg-accent text-accent-foreground"
              disabled={plan.orders.length === 0}
              onClick={async () => {
                if (!file) return;
                try {
                  const result = await importMarketplace({ data: { channel, filename: file.name, base64: file.base64 } });
                  toast.success(`Đã nhập ${result.codes.length} đơn`);
                  setPlan(null);
                  await queryClient.invalidateQueries({ queryKey: ["orders"] });
                } catch (error) {
                  toast.error((error as Error).message);
                }
              }}
            >
              Nhập đơn đã khớp
            </Button>
          </div>
        ) : null}
      </section>
      <section className="glass-card space-y-3 rounded-3xl p-4">
        <h2 className="font-bold text-primary">Bảng map SKU</h2>
        <p className="text-sm text-muted-foreground">SKU trên sàn trỏ tới mã của tiệm. Dòng chưa map bị đánh dấu, không tạo đơn.</p>
        <div className="grid gap-2 md:grid-cols-3">
          <Input className="min-h-12" placeholder="SKU trên sàn" value={externalSku} onChange={(e) => setExternalSku(e.target.value)} />
          <select className="min-h-12 rounded-xl border bg-card px-3" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
            <option value="">Mã của tiệm</option>
            {(maps.data?.skus ?? []).map((sku) => (
              <option key={sku.id} value={sku.id}>{sku.label}</option>
            ))}
          </select>
          <Button
            className="min-h-12"
            onClick={async () => {
              await storeSkuMap({ data: { channel, externalSku, skuId } });
              setExternalSku("");
              toast.success("Đã lưu map");
              await queryClient.invalidateQueries({ queryKey: ["sku-maps"] });
            }}
          >
            Lưu map
          </Button>
        </div>
        <ul className="space-y-2 text-sm">
          {(maps.data?.maps ?? []).filter((row) => row.channel === channel).map((row) => (
            <li key={`${row.channel}-${row.externalSku}`} className="flex flex-wrap items-center justify-between gap-2">
              <span>{row.externalSku} → {row.skuCode}</span>
              <Button variant="outline" className="min-h-11" onClick={() => deleteSkuMap({ data: { channel: row.channel, externalSku: row.externalSku } }).then(() => queryClient.invalidateQueries({ queryKey: ["sku-maps"] }))}>
                Xóa
              </Button>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
