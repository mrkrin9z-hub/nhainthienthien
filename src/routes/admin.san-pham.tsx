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
import { ProductEditor } from "@/components/admin/product-editor";
import { getMe, getWebProducts, setWebProductListed } from "@/lib/admin.functions";
import { formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/admin/san-pham")({
  validateSearch: (search: Record<string, unknown>): { m: string } => ({
    m: search.m === "nhap" ? "nhap" : "",
  }),
  component: WebProductsPage,
});

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
  const [busyId, setBusyId] = useState<string | null>(null);
  const [open, setOpen] = useState(m === "nhap" && staff);
  const [editId, setEditId] = useState<string | null>(null);
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

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["web-products"] });
    await queryClient.invalidateQueries({ queryKey: ["catalog"] });
    await queryClient.invalidateQueries({ queryKey: ["settings"] });
    await queryClient.invalidateQueries({ queryKey: ["group-photos"] });
    await queryClient.invalidateQueries({ queryKey: ["prices"] });
  }

  async function onListed(groupId: string, next: boolean) {
    setBusyId(groupId);
    try {
      await setWebProductListed({ data: { groupId, listed: next } });
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
        title={m === "nhap" ? "Nhập sản phẩm" : "Sản phẩm & Giá"}
        hint="Tạo hoặc sửa sản phẩm cùng lúc với giá cả 6 kênh, ảnh và hiện trên trang chủ. Giá CTV / Mơ Home chỉ dùng khi tạo đơn trong quản trị, không hiện trên nhainthienthien.com."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm tên, nhóm, đường dẫn…"
        filterCount={listed === "all" ? 0 : 1}
        onFilter={() => setFilters(true)}
        actions={staff ? <ToolbarButton label="Tạo sản phẩm" icon={Plus} primary onClick={() => { setEditId(null); setOpen(true); }} /> : null}
      />
      <p className="text-sm text-muted-foreground">
        Ảnh nhiều tấm nằm ở{" "}
        <Link to="/admin/anh" className="font-semibold text-accent">
          Ảnh sản phẩm
        </Link>
        . Giá từng ô cũng sửa được ở{" "}
        <Link to="/admin/gia" className="font-semibold text-accent">
          Bảng giá 6 kênh
        </Link>
        .
      </p>
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc sản phẩm">
        <FilterChips label="Trang chủ" value={listed} chips={chips} onChange={setListed} wrap />
      </FilterSheet>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="sản phẩm" onPage={list.setPage} />
      <ProductEditor
        open={open}
        groupId={editId}
        onOpenChange={(next) => {
          setOpen(next);
          if (!next) setEditId(null);
        }}
        onSaved={() => void refresh()}
      />

      <section className="overflow-x-auto rounded-2xl border bg-card">
        <table className="w-full min-w-[720px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              <th className="px-3 py-3">Ảnh</th>
              <th className="px-3 py-3">Tên sản phẩm</th>
              <th className="px-3 py-3">Nhóm</th>
              <th className="px-3 py-3 text-right">Giá từ</th>
              <th className="px-3 py-3">Biến thể</th>
              <th className="px-3 py-3">Trang chủ</th>
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.slice.map((product) => (
              <tr key={product.id} className="border-b last:border-0">
                <td className="px-3 py-2.5 text-xs text-muted-foreground">{product.cover ? "Có ảnh" : "Chưa có"}</td>
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
                <td className="px-3 py-2.5 text-right">
                  {staff ? (
                    <Button
                      variant="outline"
                      className="min-h-9"
                      onClick={() => {
                        setEditId(product.id);
                        setOpen(true);
                      }}
                    >
                      Sửa
                    </Button>
                  ) : null}
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
      </section>
    </div>
  );
}
