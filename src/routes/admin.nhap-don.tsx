import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { OrderLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { deleteSkuMap, getMarketplaceSync, getSkuMaps, importMarketplace, previewMarketplace, pullMarketplace, storeSkuMap } from "@/lib/admin.functions";
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
  const [mapQuery, setMapQuery] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const mapRows = (maps.data?.maps ?? []).filter((row) => {
    if (row.channel !== channel) return false;
    const needle = mapQuery.trim().toLowerCase();
    return !needle || `${row.externalSku} ${row.skuCode}`.toLowerCase().includes(needle);
  });
  const mapPage = useListPage(mapRows, `${channel}|${mapQuery}`);

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
      <OrderLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Nhập đơn sàn</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Đơn API đổ vào cùng sổ này. File Excel vẫn dùng khi cần đơn cũ hơn 7 ngày. Dòng mô tả dưới tiêu đề bị bỏ. Số điện thoại bị che vẫn nhập, ghi SĐT bị ẩn. Đơn Đã hủy không vào sổ. Tiền trên đơn là tiền sàn; giá niêm yết chỉ để đối chiếu. Đơn vào trạng thái Nhận đơn, kho trừ khi chuyển sang In và Giao như đơn thường.
        </p>
      </div>
      <ApiPull />
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
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="font-bold text-primary">Bảng gắn mã SKU</h2>
            <p className="text-sm text-muted-foreground">Mã trên sàn trỏ tới mã của tiệm. Dòng chưa gắn mã bị đánh dấu, không tạo đơn.</p>
          </div>
          <Button className="min-h-11" type="button" onClick={() => setMapOpen(true)}>
            Tạo map
          </Button>
        </div>
        <Dialog open={mapOpen} onOpenChange={setMapOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Tạo map SKU</DialogTitle>
            </DialogHeader>
            <label className="block text-sm font-semibold">
              SKU trên sàn
              <Input className="mt-1 min-h-12" placeholder="SKU trên sàn" value={externalSku} onChange={(e) => setExternalSku(e.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Mã của tiệm
              <select className="mt-1 min-h-12 w-full rounded-xl border bg-card px-3" value={skuId} onChange={(e) => setSkuId(e.target.value)} aria-label="Mã của tiệm">
                <option value="">Mã của tiệm</option>
                {(maps.data?.skus ?? []).map((sku) => (
                  <option key={sku.id} value={sku.id}>{sku.label}</option>
                ))}
              </select>
            </label>
            <DialogFooter>
              <Button
                className="min-h-12"
                onClick={async () => {
                  try {
                    await storeSkuMap({ data: { channel, externalSku, skuId } });
                    setExternalSku("");
                    setSkuId("");
                    setMapOpen(false);
                    toast.success("Đã lưu map");
                    await queryClient.invalidateQueries({ queryKey: ["sku-maps"] });
                  } catch (error) {
                    toast.error((error as Error).message);
                  }
                }}
              >
                Lưu map
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Input className="min-h-11" placeholder="Tìm mã sàn hoặc mã tiệm" aria-label="Tìm map SKU" value={mapQuery} onChange={(e) => setMapQuery(e.target.value)} />
        <ListPager page={mapPage.page} pages={mapPage.pages} total={mapPage.total} start={mapPage.start} count={mapPage.slice.length} noun="map" onPage={mapPage.setPage} />
        <ul className="space-y-2 text-sm">
          {mapPage.slice.map((row) => (
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

function ApiPull() {
  const sync = useQuery({ queryKey: ["marketplace-sync"], queryFn: () => getMarketplaceSync() });
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState<"tiktok" | "shopee" | null>(null);
  async function pull(channel: "tiktok" | "shopee") {
    setBusy(channel);
    try {
      const result = await pullMarketplace({ data: { channel } });
      toast.success(`Đã đổ ${result.codes.length} đơn. Bỏ qua ${result.duplicateCount} đơn đã có.`);
      if (result.issueCount) toast.message(`${result.issueCount} dòng chưa vào sổ vì chưa map SKU hoặc thiếu số.`);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(null);
    }
  }
  return (
    <section className="glass-card space-y-3 rounded-3xl p-4">
      <h2 className="font-bold text-primary">Lấy đơn từ API</h2>
      <p className="text-sm text-muted-foreground">
        Chủ nối shop ở Kết nối. Khi đã nối, mở trang này hoặc danh sách đơn sẽ tự lấy đơn 7 ngày. Bấm lại nếu cần ngay. Đơn trùng mã sàn bị bỏ qua.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button className="min-h-12" disabled={!sync.data?.tiktok || busy !== null} onClick={() => pull("tiktok")}>
          {busy === "tiktok" ? "Đang lấy TikTok…" : "Lấy đơn TikTok"}
        </Button>
        <Button className="min-h-12" disabled={!sync.data?.shopee || busy !== null} onClick={() => pull("shopee")}>
          {busy === "shopee" ? "Đang lấy Shopee…" : "Lấy đơn Shopee"}
        </Button>
      </div>
      {sync.data && !sync.data.tiktok && !sync.data.shopee ? <p className="text-sm text-muted-foreground">Chưa nối shop nào. File Excel phía dưới vẫn nhập được.</p> : null}
    </section>
  );
}
