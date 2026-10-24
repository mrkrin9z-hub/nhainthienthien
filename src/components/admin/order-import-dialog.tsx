import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { importMarketplace, previewMarketplace } from "@/lib/admin.functions";
import { formatMaybe } from "@/lib/brand";

type Plan = Awaited<ReturnType<typeof previewMarketplace>>;

function vnWhen(iso: string) {
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return iso.slice(0, 16);
  return at.toLocaleString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** File xuất Seller Center. API sau này đổ vào cùng preview/commit, không tạo đơn tay. */
export function OrderImportDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const [channel, setChannel] = useState<"tiktok" | "shopee">("tiktok");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [busy, setBusy] = useState(false);

  async function readFile(next: File) {
    const bytes = new Uint8Array(await next.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    setFile({ name: next.name, base64: btoa(binary) });
    setPlan(null);
  }

  async function preview() {
    if (!file) return;
    setBusy(true);
    try {
      setPlan(await previewMarketplace({ data: { channel, filename: file.name, base64: file.base64 } }));
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  async function save() {
    if (!file || !plan) return;
    setBusy(true);
    try {
      const result = await importMarketplace({ data: { channel, filename: file.name, base64: file.base64 } });
      const updated = "updated" in result ? result.updated.length : 0;
      toast.success(`Thêm ${result.codes.length} đơn, cập nhật ${updated} đơn`);
      setPlan(null);
      setFile(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["orders"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy(false);
    }
  }

  const updates = plan?.updates ?? [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Nhập đơn sàn</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">TikTok bấm Xuất (xlsx hoặc csv). Shopee xuất file đơn xlsx. Xem trước rồi mới lưu. Nhập lại cùng mã đơn thì cập nhật, không tạo đơn thứ hai.</p>
        <Label htmlFor="import-channel">Sàn</Label>
        <select id="import-channel" className="h-11 w-full rounded-md border bg-background px-3 text-sm" value={channel} onChange={(event) => { setChannel(event.target.value as "tiktok" | "shopee"); setPlan(null); }}>
          <option value="tiktok">TikTok</option>
          <option value="shopee">Shopee</option>
        </select>
        <Label htmlFor="import-file">File xuất</Label>
        <Input id="import-file" type="file" accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" onChange={(event) => { const next = event.target.files?.[0]; if (next) void readFile(next); }} />
        <Button type="button" disabled={!file || busy} onClick={() => void preview()}>{busy ? "Đang đọc…" : "Xem trước"}</Button>
        {plan ? (
          <div className="space-y-2 text-sm">
            <p>{plan.orders.length} đơn mới. {updates.length} đơn sẽ cập nhật. {plan.cancelled} dòng hủy. {plan.issues.length} dòng chưa vào được.</p>
            {plan.orders.slice(0, 8).map((order) => (
              <div key={order.platformOrderId} className="rounded-md border px-3 py-2">
                <p className="font-semibold">Mới · {order.platformOrderId} · {order.buyer}</p>
                {order.items.map((item, index) => (
                  <p key={`${order.platformOrderId}-${index}`} className="text-muted-foreground">{item.externalSku}{item.variation ? ` · ${item.variation}` : ""} · ×{item.quantity} · {formatMaybe(item.platformLineTotal)}</p>
                ))}
                <p className="text-muted-foreground">{order.carrier || "Chưa rõ hãng"} · {order.tracking || "chưa có vận đơn"}{order.shipBy ? ` · hạn ${vnWhen(order.shipBy)}` : ""}</p>
              </div>
            ))}
            {updates.slice(0, 8).map((order) => (
              <div key={`up-${order.platformOrderId}`} className="rounded-md border px-3 py-2">
                <p className="font-semibold">{order.cancel ? "Hủy" : "Cập nhật"} · {order.platformOrderId}</p>
                <p className="text-muted-foreground">{order.carrier || "—"} · {order.tracking || "chưa có vận đơn"} · {order.fileStatus || "giữ bước xưởng"}</p>
                {order.itemNote ? <p className="text-muted-foreground">{order.itemNote}</p> : null}
              </div>
            ))}
            {plan.issues.slice(0, 8).map((issue, index) => (
              <p key={`${issue.orderId}-${index}`} className="text-destructive">{issue.orderId || "Không mã"} · {issue.sku || "—"} · {issue.reason}</p>
            ))}
            <Button type="button" disabled={busy || (plan.orders.length === 0 && updates.length === 0)} onClick={() => void save()}>Lưu vào sổ</Button>
          </div>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}
