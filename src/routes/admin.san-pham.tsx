import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { GoodsLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState("");
  const [listed, setListed] = useState("all");
  const catalog = products.data ?? [];
  const shown = catalog.filter((product) => {
    if (listed === "on" && !product.listed) return false;
    if (listed === "off" && product.listed) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${product.name} ${product.category}`.toLowerCase().includes(needle);
  });
  const chips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: catalog.length, ...ALL_TONE },
    { id: "on", label: "Đang hiện", count: catalog.filter((product) => product.listed).length, color: "#059669" },
    { id: "off", label: "Đang ẩn", count: catalog.filter((product) => !product.listed).length, color: "#6B7280" },
  ];
  const list = useListPage(shown, `${q}|${listed}`);

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
      setOpen(false);
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
      <PageToolbar
        title="Sản phẩm"
        hint="Sản phẩm đang bật hiện ở gian hàng trang chủ, trang sản phẩm và đặt in. Giá nhập ở đây là giá tại tiệm."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên, mã sản phẩm…"
        actions={
          <Button className="min-h-9" onClick={() => setOpen(true)}>
            Tạo
          </Button>
        }
      />
      <FilterChips label="Trang chủ" value={listed} chips={chips} onChange={setListed} wrap />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="sản phẩm" onPage={list.setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Tạo sản phẩm</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
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
          </div>
        </DialogContent>
      </Dialog>

      <section className="overflow-hidden rounded-md border bg-card">
        {products.isLoading ? <p className="p-4 text-sm text-muted-foreground">Đang tải…</p> : null}
        {products.isError ? <p className="p-4 text-sm font-semibold text-destructive">{(products.error as Error).message}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[40rem] text-left text-[13px]">
            <thead className="bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2.5">STT</th>
                <th className="px-3 py-2.5">Tên sản phẩm</th>
                <th className="px-3 py-2.5">Nhóm SP</th>
                <th className="px-3 py-2.5 text-right">Giá</th>
                <th className="px-3 py-2.5">Quy cách</th>
                <th className="px-3 py-2.5">Trạng thái</th>
              </tr>
            </thead>
            <tbody>
              {list.slice.map((product, index) => (
                <tr key={product.id} className="border-t">
                  <td className="px-3 py-2.5 text-muted-foreground">{list.start + index + 1}</td>
                  <td className="px-3 py-2.5 font-semibold">{product.name}</td>
                  <td className="px-3 py-2.5">{product.category}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{product.from === null ? "—" : formatVnd(product.from)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{product.variants}</td>
                  <td className="px-3 py-2.5">
                    <label className="inline-flex min-h-8 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={product.listed}
                        disabled={busyId === product.id}
                        onChange={(event) => void onListed(product.id, event.target.checked)}
                      />
                      <span className={product.listed ? "font-semibold text-emerald-700" : "text-muted-foreground"}>
                        {product.listed ? "Đang hiện" : "Đang ẩn"}
                      </span>
                    </label>
                  </td>
                </tr>
              ))}
              {products.data && list.slice.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-3 py-6 text-center text-muted-foreground">
                    Không có sản phẩm khớp.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
