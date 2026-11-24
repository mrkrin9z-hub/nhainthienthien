import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { Plus } from "lucide-react";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHANNELS, CHANNEL_LABEL, type Channel } from "@/domain/types";
import { createWebProduct, getMe, getWebProducts, setWebProductListed } from "@/lib/admin.functions";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/admin/san-pham")({
  validateSearch: (search: Record<string, unknown>): { m: string } => ({
    m: search.m === "nhap" ? "nhap" : "",
  }),
  component: WebProductsPage,
});

type SizeRow = {
  width: string;
  height: string;
  sheets: string;
  price: string;
  minTotal: string;
  channels: Record<Exclude<Channel, "tai_tiem">, string>;
};

const blankChannels = (): SizeRow["channels"] => ({
  facebook: "",
  tiktok: "",
  shopee: "",
  ctv: "",
  mo_home: "",
});

const blankRow = (): SizeRow => ({ width: "", height: "", sheets: "1", price: "", minTotal: "", channels: blankChannels() });

function whole(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

function optionalWhole(value: string): number | undefined {
  const n = whole(value);
  return Number.isFinite(n) ? n : undefined;
}

async function uploadCover(slug: string, file: File) {
  const body = new FormData();
  body.set("slug", slug);
  body.set("kind", "cover");
  body.set("file", file);
  const response = await fetch("/api/admin/product-photo", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text());
}

function WebProductsPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem sản phẩm.">
      <WebProductsBody />
    </RoleGate>
  );
}

function WebProductsBody() {
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const staff = me.data?.role === "owner" || me.data?.role === "sale";
  const { m } = Route.useSearch();
  const products = useQuery({ queryKey: ["web-products"], queryFn: () => getWebProducts() });
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Ảnh gỗ");
  const [description, setDescription] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [listedOnCreate, setListedOnCreate] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [rows, setRows] = useState<SizeRow[]>([blankRow()]);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(m === "nhap" && staff);
  const [filters, setFilters] = useState(false);
  useEffect(() => {
    if (m === "nhap" && staff) setOpen(true);
  }, [m, staff]);
  const [q, setQ] = useState("");
  const [listed, setListed] = useState("all");
  const catalog = products.data ?? [];
  const shown = catalog.filter((product) => {
    if (listed === "on" && !product.listed) return false;
    if (listed === "off" && product.listed) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${product.name} ${product.category} ${product.slug}`.toLowerCase().includes(needle);
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

  function updateChannel(index: number, channel: Exclude<Channel, "tai_tiem">, value: string) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, channels: { ...row.channels, [channel]: value } } : row,
      ),
    );
  }

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["web-products"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.invalidateQueries({ queryKey: ["group-photos"] });
    await queryClient.invalidateQueries({ queryKey: ["prices"] });
  }

  async function onCreate() {
    const sizes = rows.map((row) => {
      const prices: Partial<Record<Channel, number>> = {};
      for (const channel of CHANNELS) {
        if (channel === "tai_tiem") continue;
        const amount = optionalWhole(row.channels[channel]);
        if (amount != null) prices[channel] = amount;
      }
      return {
        widthCm: whole(row.width),
        heightCm: whole(row.height),
        sheets: whole(row.sheets),
        price: whole(row.price),
        prices: Object.keys(prices).length ? prices : undefined,
        minTotal: optionalWhole(row.minTotal) ?? null,
      };
    });
    setSaving(true);
    try {
      const created = await createWebProduct({
        data: { name, category, description, turnaround, sizes, listed: listedOnCreate },
      });
      if (coverFile) {
        try {
          await uploadCover(created.slug, coverFile);
        } catch (error) {
          toast.error(`Đã tạo sản phẩm nhưng chưa lưu ảnh: ${(error as Error).message}`);
        }
      }
      toast.success(listedOnCreate ? `Đã thêm ${created.name} lên trang chủ` : `Đã thêm ${created.name} (đang ẩn)`);
      setName("");
      setDescription("");
      setTurnaround("");
      setListedOnCreate(true);
      setCoverFile(null);
      setRows([blankRow()]);
      setOpen(false);
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function onListed(groupId: string, listedNext: boolean) {
    setBusyId(groupId);
    try {
      await setWebProductListed({ data: { groupId, listed: listedNext } });
      toast.success(listedNext ? "Đã hiện trên trang chủ" : "Đã ẩn khỏi trang chủ");
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  async function onCover(slug: string, file: File | undefined) {
    if (!file) return;
    setBusyId(slug);
    try {
      await uploadCover(slug, file);
      toast.success("Đã đổi ảnh đại diện — trang chủ dùng ảnh này ngay, không cần deploy lại.");
      await refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <div className="space-y-6">
      <PageToolbar
        title={m === "nhap" ? "Nhập sản phẩm" : "Sản phẩm trang chủ"}
        hint="Tạo sản phẩm mới, nhập giá từng kênh, bật hiện trên trang chủ và tải ảnh đại diện. Giá CTV / Mơ Home chỉ dùng khi tạo đơn trong quản trị, không hiện trên nhainthienthien.com."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên, nhóm, đường dẫn…"
        filterCount={listed === "all" ? 0 : 1}
        onFilter={() => setFilters(true)}
        actions={staff ? <ToolbarButton label="Tạo sản phẩm" icon={Plus} primary onClick={() => setOpen(true)} /> : null}
      />
      <p className="text-sm text-muted-foreground">
        Thư viện ảnh (nhiều tấm) và đổi ảnh các sản phẩm cũ nằm ở{" "}
        <Link to="/admin/anh" className="font-semibold text-accent">
          Ảnh web
        </Link>
        . Ảnh vừa tải sẽ hiện ở trang chủ và /san-pham/… từ dữ liệu, không cần sửa code.
      </p>
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc sản phẩm">
        <FilterChips label="Trang chủ" value={listed} chips={chips} onChange={setListed} wrap />
      </FilterSheet>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="sản phẩm" onPage={list.setPage} />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Tạo sản phẩm</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Tên sản phẩm
              <Input className="mt-1 min-h-11" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ảnh canvas" />
            </label>
            <label className="block text-sm font-semibold">
              Nhóm / danh mục
              <Input className="mt-1 min-h-11" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ảnh gỗ" />
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
            <div className="space-y-3">
              <p className="text-sm font-semibold">Khổ, biến thể và giá theo kênh</p>
              {rows.map((row, index) => (
                <div key={index} className="space-y-2 rounded-2xl border bg-slate-50 p-3">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Rộng (cm)
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.width} onChange={(event) => updateRow(index, { width: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Cao (cm)
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.height} onChange={(event) => updateRow(index, { height: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Số tấm
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.sheets} onChange={(event) => updateRow(index, { sheets: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Giá tại tiệm (đ)
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.price} onChange={(event) => updateRow(index, { price: event.target.value })} placeholder="89000" />
                    </label>
                  </div>
                  <label className="block text-xs font-semibold text-muted-foreground">
                    Tối thiểu / dòng (đ, không bắt buộc)
                    <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.minTotal} onChange={(event) => updateRow(index, { minTotal: event.target.value })} placeholder="Ví dụ 30000" />
                  </label>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {CHANNELS.filter((channel) => channel !== "tai_tiem").map((channel) => (
                      <label key={channel} className="text-xs font-semibold text-muted-foreground">
                        {CHANNEL_LABEL[channel]}
                        <Input
                          className="mt-1 min-h-11 bg-white"
                          inputMode="numeric"
                          value={row.channels[channel]}
                          placeholder="Để trống nếu chưa bán"
                          onChange={(event) => updateChannel(index, channel, event.target.value)}
                        />
                      </label>
                    ))}
                  </div>
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
            <label className="block text-sm font-semibold">
              Ảnh đại diện (JPG, PNG hoặc WEBP, tối đa 2MB)
              <input
                className="mt-1 block w-full text-sm"
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)}
              />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4" checked={listedOnCreate} onChange={(event) => setListedOnCreate(event.target.checked)} />
              Hiện trên trang chủ nhainthienthien.com (chỉ giá tại tiệm)
            </label>
            <Button className="min-h-12 bg-accent text-accent-foreground" disabled={saving} onClick={() => void onCreate()}>
              {saving ? "Đang thêm…" : listedOnCreate ? "Tạo và hiện trên trang chủ" : "Tạo sản phẩm (đang ẩn)"}
            </Button>
            <p className="text-xs text-muted-foreground">
              Đường dẫn /san-pham/… được tạo từ tên. Ảnh và sản phẩm mới lên thẳng trang chủ từ dữ liệu, không cần deploy lại. Thêm nhiều ảnh ở{" "}
              <Link to="/admin/anh" className="font-semibold text-accent">
                Ảnh web
              </Link>
              .
            </p>
          </div>
        </DialogContent>
      </Dialog>

      <section className="overflow-hidden rounded-md border bg-card">
        {products.isLoading ? <p className="p-4 text-sm text-muted-foreground">Đang tải…</p> : null}
        {products.isError ? <p className="p-4 text-sm font-semibold text-destructive">{(products.error as Error).message}</p> : null}
        <div className="overflow-x-auto">
          <table className="w-full min-w-[48rem] text-left text-[13px]">
            <thead className="bg-muted/40 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="px-3 py-2.5">STT</th>
                <th className="px-3 py-2.5">Ảnh</th>
                <th className="px-3 py-2.5">Tên sản phẩm</th>
                <th className="px-3 py-2.5">Nhóm SP</th>
                <th className="px-3 py-2.5 text-right">Giá tại tiệm</th>
                <th className="px-3 py-2.5">Quy cách</th>
                <th className="px-3 py-2.5">Trang chủ</th>
              </tr>
            </thead>
            <tbody>
              {list.slice.map((product, index) => (
                <tr key={product.id} className="border-t">
                  <td className="px-3 py-2.5 text-muted-foreground">{list.start + index + 1}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex items-center gap-2">
                      {product.cover ? (
                        <img src={`/api/public/product-photo/${product.slug}`} alt="" className="size-12 rounded-lg object-cover" />
                      ) : (
                        <div className="flex size-12 items-center justify-center rounded-lg bg-slate-100 text-[10px] text-slate-500">Chưa có</div>
                      )}
                      <label className="text-xs font-semibold text-accent">
                        {product.cover ? "Đổi" : "Tải ảnh"}
                        <input
                          className="sr-only"
                          type="file"
                          accept="image/jpeg,image/png,image/webp"
                          disabled={busyId === product.slug}
                          onChange={(event) => {
                            const file = event.target.files?.[0];
                            event.target.value = "";
                            void onCover(product.slug, file);
                          }}
                        />
                      </label>
                    </div>
                    {product.gallery ? <p className="mt-1 text-[11px] text-muted-foreground">{product.gallery} ảnh thư viện</p> : null}
                  </td>
                  <td className="px-3 py-2.5">
                    <p className="font-semibold">{product.name}</p>
                    <p className="text-xs text-muted-foreground">/{product.slug}</p>
                  </td>
                  <td className="px-3 py-2.5">{product.category}</td>
                  <td className="px-3 py-2.5 text-right font-semibold">{product.from === null ? "—" : formatVnd(product.from)}</td>
                  <td className="px-3 py-2.5 text-muted-foreground">{product.variants}</td>
                  <td className="px-3 py-2.5">
                    <label className="inline-flex min-h-8 items-center gap-2">
                      <input
                        type="checkbox"
                        className="size-4"
                        checked={product.listed}
                        disabled={!staff || busyId === product.id}
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
                  <td colSpan={7} className="px-3 py-6 text-center text-muted-foreground">
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
