import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { GoodsLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createWebProduct, getWebProducts, setWebProductListed } from "@/lib/admin.functions";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/admin/san-pham")({
  component: WebProductsPage,
});

type SizeRow = { width: string; height: string; sheets: string; price: string };

const blankRow = (): SizeRow => ({ width: "", height: "", sheets: "1", price: "" });

function whole(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

function WebProductsPage() {
  return (
    <RoleGate allow={["owner"]} deny="Chỉ chủ thêm sản phẩm lên trang chủ.">
      <WebProductsBody />
    </RoleGate>
  );
}

function WebProductsBody() {
  const queryClient = useQueryClient();
  const products = useQuery({ queryKey: ["web-products"], queryFn: () => getWebProducts() });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Ảnh gỗ");
  const [description, setDescription] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [rows, setRows] = useState<SizeRow[]>([blankRow()]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  function updateRow(index: number, patch: Partial<SizeRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["web-products"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.invalidateQueries({ queryKey: ["group-photos"] });
  }

  async function onCreate() {
    const sizes = rows.map((row) => ({
      widthCm: whole(row.width),
      heightCm: whole(row.height),
      sheets: whole(row.sheets),
      price: whole(row.price),
    }));
    setSaving(true);
    try {
      const created = await createWebProduct({
        data: { name, category, description, turnaround, sizes },
      });
      toast.success(`Đã thêm ${created.name} lên trang chủ`);
      setName("");
      setDescription("");
      setTurnaround("");
      setRows([blankRow()]);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onListed(groupId: string, listed: boolean) {
    setBusyId(groupId);
    try {
      await setWebProductListed({ data: { groupId, listed } });
      toast.success(listed ? "Đã hiện trên trang chủ" : "Đã ẩn khỏi trang chủ");
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <GoodsLinks />
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Sản phẩm trên web</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sản phẩm đang bật hiện ở gian hàng trang chủ, trang sản phẩm và đặt in. Giá nhập ở đây là giá tại tiệm.
        </p>
      </div>

      <section className="glass-card space-y-3 rounded-3xl p-4">
        <h2 className="font-bold text-primary">Thêm sản phẩm</h2>
        <label className="block text-sm font-semibold">
          Tên
          <Input className="mt-1 min-h-11" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ảnh canvas" />
        </label>
        <label className="block text-sm font-semibold">
          Nhóm
          <Input className="mt-1 min-h-11" value={category} onChange={(event) => setCategory(event.target.value)} />
        </label>
        <label className="block text-sm font-semibold">
          Mô tả ngắn
          <textarea
            className="mt-1 min-h-20 w-full rounded-xl border bg-card px-3 py-2 text-sm"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
          />
        </label>
        <label className="block text-sm font-semibold">
          Ghi chú thời gian
          <Input className="mt-1 min-h-11" value={turnaround} onChange={(event) => setTurnaround(event.target.value)} placeholder="Để trống nếu chưa chốt lịch" />
        </label>
        <div className="space-y-2">
          <p className="text-sm font-semibold">Khổ và giá</p>
          {rows.map((row, index) => (
            <div key={index} className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <label className="text-xs font-semibold text-muted-foreground">
                Rộng (cm)
                <Input className="mt-1 min-h-11" inputMode="numeric" value={row.width} onChange={(event) => updateRow(index, { width: event.target.value })} />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Cao (cm)
                <Input className="mt-1 min-h-11" inputMode="numeric" value={row.height} onChange={(event) => updateRow(index, { height: event.target.value })} />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Số tấm
                <Input className="mt-1 min-h-11" inputMode="numeric" value={row.sheets} onChange={(event) => updateRow(index, { sheets: event.target.value })} />
              </label>
              <label className="text-xs font-semibold text-muted-foreground">
                Giá (đ)
                <Input className="mt-1 min-h-11" inputMode="numeric" value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} placeholder="89000" />
              </label>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" className="min-h-11" onClick={() => setRows((current) => [...current, blankRow()])}>
              Thêm khổ
            </Button>
            {rows.length > 1 ? (
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setRows((current) => current.slice(0, -1))}>
                Bớt khổ cuối
              </Button>
            ) : null}
          </div>
        </div>
        <Button className="min-h-12 bg-accent text-accent-foreground" disabled={saving} onClick={() => void onCreate()}>
          {saving ? "Đang thêm…" : "Hiện trên trang chủ"}
        </Button>
        <p className="text-xs text-muted-foreground">
          Ảnh mẫu dùng tạm. Đổi ảnh thật ở <Link to="/admin/anh" className="font-semibold text-accent">Ảnh web</Link>.
          Kênh Facebook, TikTok và Shopee để trống đến khi sửa ở Bảng giá.
        </p>
      </section>

      <section className="space-y-2">
        <h2 className="font-bold text-primary">Đang có trong sổ</h2>
        {products.isLoading ? <p className="text-sm text-muted-foreground">Đang tải…</p> : null}
        {products.isError ? <p className="text-sm font-semibold text-destructive">{(products.error as Error).message}</p> : null}
        <ul className="space-y-2">
          {(products.data ?? []).map((product) => (
            <li key={product.id} className="glass-card flex items-center gap-3 rounded-3xl p-3">
              <label className="flex min-h-11 flex-1 items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  className="size-5"
                  checked={product.listed}
                  disabled={busyId === product.id}
                  onChange={(event) => void onListed(product.id, event.target.checked)}
                />
                <span className="min-w-0">
                  <span className="block font-bold text-foreground">{product.name}</span>
                  <span className="block text-muted-foreground">
                    {product.category} · {product.variants} quy cách
                    {product.from === null ? "" : ` · từ ${formatVnd(product.from)}`}
                    {product.listed ? " · đang hiện" : " · đang ẩn"}
                  </span>
                </span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
