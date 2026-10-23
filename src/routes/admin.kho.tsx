import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CircleCheck, CircleDashed, MoreHorizontal, PackagePlus, PackageSearch, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { formatMaybe } from "@/lib/brand";
import { approvePrice, countStock, downloadExcel, getInventory, getMe, markInkOpened, receiveStock, saveMaterial } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/kho")({
  validateSearch: (search: Record<string, unknown>): { m: string } => ({
    m: search.m === "nhap" ? "nhap" : "",
  }),
  component: StockPage,
});

function StockPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => getInventory() });
  const owner = me.data?.role === "owner";
  const canIn = me.data?.role === "owner" || me.data?.role === "sale";
  const queryClient = useQueryClient();
  const { m } = Route.useSearch();
  const [q, setQ] = useState("");
  const [stockFilter, setStockFilter] = useState("all");
  const [openId, setOpenId] = useState<string | null>(null);
  const [filters, setFilters] = useState(false);
  const [receiveOpen, setReceiveOpen] = useState(m === "nhap");
  const [inkOpen, setInkOpen] = useState(false);
  const [receiveId, setReceiveId] = useState("");
  const [packs, setPacks] = useState("1");
  useEffect(() => {
    if (m === "nhap") setReceiveOpen(true);
  }, [m]);
  const allMaterials = stock.data?.materials ?? [];
  const inks = allMaterials.filter((material) => /^muc-[1-9]$/.test(material.id));
  const materials = allMaterials.filter((material) => {
    if (stockFilter !== "all" && material.stockLabel !== stockFilter) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${material.name} ${material.code ?? ""}`.toLowerCase().includes(needle);
  });
  const countLabel = (label: string) => allMaterials.filter((material) => material.stockLabel === label).length;
  const stockChips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: allMaterials.length, ...ALL_TONE },
    { id: "Chưa đếm", label: "Chưa đếm", count: countLabel("Chưa đếm"), color: "#B45309", icon: CircleDashed },
    { id: "Tồn âm", label: "Tồn âm", count: countLabel("Tồn âm"), color: "#DC2626", icon: TriangleAlert },
    { id: "Sắp hết", label: "Sắp hết", count: countLabel("Sắp hết"), color: "#DC2626", icon: PackageSearch },
    { id: "Đủ", label: "Đủ", count: countLabel("Đủ"), color: "#059669", icon: CircleCheck },
  ];
  const list = useListPage(materials, `${q}|${stockFilter}`);
  const movements = (stock.data?.movements ?? []).filter((move) => {
    const needle = q.trim().toLowerCase();
    return !needle || `${move.materialName} ${move.reason} ${move.note}`.toLowerCase().includes(needle);
  });
  const moveList = useListPage(movements, q);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  }

  const opened = (stock.data?.materials ?? []).find((material) => material.id === openId) ?? null;

  return (
    <div className="space-y-4">
      <PageToolbar
        title={m === "nhap" ? "Nhập vật tư" : "Tồn kho vật tư"}
        hint="Chưa đếm là chưa ghi tồn đầu. Tồn âm là đã trừ nhưng chưa nhập. Hàng bán làm theo đơn."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm vật tư…"
        filterCount={stockFilter === "all" ? 0 : 1}
        onFilter={() => setFilters(true)}
        actions={
          canIn ? (
            <>
              <ToolbarButton label="Nhập vật tư" icon={PackagePlus} primary onClick={() => setReceiveOpen(true)} />
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button type="button" className="inline-flex size-9 items-center justify-center rounded-md border" aria-label="Thêm thao tác">
                    <MoreHorizontal className="size-4" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => setInkOpen(true)}>Mở lọ mực mới</DropdownMenuItem>
                  {me.data && me.data.role !== "production" ? (
                    <DropdownMenuItem
                      onClick={async () => {
                        const file = await downloadExcel({ data: { kind: "stock", month: "all" } });
                        download(file.filename, file.xml);
                      }}
                    >
                      Xuất tồn
                    </DropdownMenuItem>
                  ) : null}
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          ) : null
        }
      />
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc vật tư">
        <FilterChips label="Tồn kho" value={stockFilter} chips={stockChips} onChange={setStockFilter} wrap />
      </FilterSheet>
      <Dialog open={inkOpen} onOpenChange={setInkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mở lọ mực mới</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">Mỗi màu một lọ. Mã màu để trống cho đến khi có mã Canon. Mực tính lãi vẫn là 4,4% giá bán.</p>
          <ul className="space-y-2">
            {inks.map((ink) => (
              <li key={ink.id} className="flex items-center justify-between gap-3 text-sm">
                <span>
                  <span className="font-semibold">{ink.name}</span>
                  <span className="text-muted-foreground"> · {ink.stock} {ink.unit} · {ink.stockLabel}</span>
                </span>
                <Button
                  variant="outline"
                  className="min-h-11"
                  onClick={async () => {
                    await markInkOpened({ data: { materialId: ink.id } });
                    toast.success(`Đã trừ 1 lọ ${ink.name}`);
                    await refresh();
                  }}
                >
                  Mở lọ mới
                </Button>
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>
      <Dialog open={receiveOpen} onOpenChange={setReceiveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nhập vật tư</DialogTitle>
          </DialogHeader>
          <label className="text-sm font-semibold">
            Vật tư
            <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" aria-label="Chọn vật tư" value={receiveId} onChange={(event) => setReceiveId(event.target.value)}>
              <option value="">Chọn vật tư</option>
              {allMaterials.map((material) => (
                <option key={material.id} value={material.id}>
                  {material.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm font-semibold">
            Số lần mua
            <Input className="mt-1 min-h-11" inputMode="numeric" aria-label="Số lần mua" value={packs} onChange={(event) => setPacks(event.target.value.replace(/[^\d]/g, ""))} />
          </label>
          <Button
            className="min-h-11"
            disabled={!receiveId || !Number(packs)}
            onClick={async () => {
              await receiveStock({ data: { materialId: receiveId, packs: Number(packs), packPrice: null, supplier: "", note: "" } });
              toast.success(owner ? "Đã nhập kho" : "Đã nhập kho. Giá mới chờ chủ duyệt.");
              setReceiveOpen(false);
              await refresh();
            }}
          >
            Nhập
          </Button>
        </DialogContent>
      </Dialog>
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="vật tư" onPage={list.setPage} />
      <div className="overflow-hidden rounded-md border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Vật tư</TableHead>
              <TableHead className="text-right">Tồn</TableHead>
              <TableHead className="hidden text-right sm:table-cell">30 ngày</TableHead>
              <TableHead className="text-right">Trạng thái</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {list.slice.map((material) => (
              <TableRow key={material.id} className="cursor-pointer" onClick={() => setOpenId(material.id)}>
                <TableCell>
                  <p className="font-semibold">{material.name}</p>
                  <p className="text-xs text-muted-foreground">{material.buyLabel}</p>
                </TableCell>
                <TableCell className="text-right font-semibold">
                  {material.stock} {material.unit}
                </TableCell>
                <TableCell className="hidden text-right sm:table-cell">
                  {material.avgDaily} {material.unit}/ngày
                </TableCell>
                <TableCell className={`text-right ${material.stockLabel === "Tồn âm" || material.stockLabel === "Sắp hết" ? "font-semibold text-destructive" : material.stockLabel === "Chưa đếm" ? "font-semibold text-amber-700" : "text-muted-foreground"}`}>
                  {material.stockLabel}
                </TableCell>
              </TableRow>
            ))}
            {stock.data && materials.length === 0 ? (
              <TableRow>
                <TableCell colSpan={4} className="py-6 text-center text-muted-foreground">
                  Không có vật tư khớp.
                </TableCell>
              </TableRow>
            ) : null}
          </TableBody>
        </Table>
      </div>
      <Dialog open={opened !== null} onOpenChange={(open) => { if (!open) setOpenId(null); }}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          {opened ? (
            <>
              <DialogHeader>
                <DialogTitle>{opened.name}</DialogTitle>
              </DialogHeader>
              <p className="text-sm text-muted-foreground">{opened.buyLabel}</p>
              <p className="text-xl font-extrabold">
                {opened.stock} {opened.unit}
              </p>
              <p className="text-sm font-semibold">{opened.stockLabel}</p>
              <p className="text-sm">
                30 ngày qua dùng {opened.avgDaily} {opened.unit}/ngày
                {opened.daysLeft === null ? " · chưa đủ nhịp để tính số ngày còn." : ` · còn khoảng ${opened.daysLeft} ngày.`}
              </p>
              {opened.reorder ? (
                <p className="text-sm font-semibold text-destructive">Nên đặt hàng: còn dưới {opened.leadTimeDays} ngày chờ hàng.</p>
              ) : null}
              {owner ? (
                <p className="text-sm">
                  Giá mua: {opened.packPrice === null ? "chưa có" : formatMaybe(opened.packPrice)}
                  {opened.pendingPrice !== null ? ` · chờ duyệt ${formatMaybe(opened.pendingPrice)}` : ""}
                </p>
              ) : null}
              {owner && opened.pendingPrice !== null ? (
                <Button className="min-h-12" onClick={() => approvePrice({ data: { materialId: opened.id } }).then(refresh)}>
                  Duyệt giá mua
                </Button>
              ) : null}
              <MaterialForms key={opened.id} material={opened} owner={owner} canIn={canIn} onDone={refresh} />
            </>
          ) : null}
        </DialogContent>
      </Dialog>
      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Nhập xuất</h2>
        <div className="mt-2">
          <ListPager page={moveList.page} pages={moveList.pages} total={moveList.total} start={moveList.start} count={moveList.slice.length} noun="phiếu" onPage={moveList.setPage} />
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {moveList.slice.map((move) => (
            <li key={move.id}>
              {move.materialName}: {move.qty} · {move.reason} {move.note}
            </li>
          ))}
          {moveList.total === 0 ? <li className="text-muted-foreground">{(stock.data?.movements ?? []).length === 0 ? "Chưa có phiếu." : "Không có phiếu khớp bộ lọc."}</li> : null}
        </ul>
      </section>
    </div>
  );
}

function MaterialForms({
  material,
  owner,
  canIn,
  onDone,
}: {
  material: {
    id: string;
    name: string;
    code?: string;
    packPrice?: number | null;
    packSize?: number | null;
    minStock: number | null;
    supplier: string;
    leadTimeDays: number;
  };
  owner: boolean;
  canIn: boolean;
  onDone: () => Promise<void>;
}) {
  const [packs, setPacks] = useState("1");
  const [price, setPrice] = useState("");
  const [supplier, setSupplier] = useState(material.supplier);
  const [actual, setActual] = useState("");
  const [minStock, setMinStock] = useState(material.minStock === null ? "" : String(material.minStock));
  const [packPrice, setPackPrice] = useState(material.packPrice == null ? "" : String(material.packPrice));
  const [leadTime, setLeadTime] = useState(String(material.leadTimeDays));
  const [name, setName] = useState(material.name);
  const [code, setCode] = useState(material.code ?? "");
  const ink = /^muc-[1-9]$/.test(material.id);

  return (
    <div className="mt-3 space-y-3">
      {canIn ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Input className="h-12 w-full sm:w-20" value={packs} onChange={(e) => setPacks(e.target.value)} />
          <Input className="h-12 w-full sm:w-28" placeholder="Giá mua" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input className="col-span-2 h-12 w-full sm:col-span-1 sm:w-32" placeholder="Nơi mua" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <Button
            className="min-h-12"
            onClick={async () => {
              await receiveStock({
                data: {
                  materialId: material.id,
                  packs: Number(packs),
                  packPrice: price.trim() === "" ? null : Number(price),
                  supplier,
                  note: "",
                },
              });
              toast.success(owner ? "Đã nhập kho" : "Đã nhập kho. Giá mới chờ chủ duyệt.");
              await onDone();
            }}
          >
            Nhập
          </Button>
        </div>
      ) : null}
      <div className="flex flex-wrap gap-2">
        <Input className="h-11 w-28" placeholder="Tồn đếm" value={actual} onChange={(e) => setActual(e.target.value)} />
        <Button
          variant="outline"
          className="min-h-12"
          onClick={async () => {
            await countStock({ data: { materialId: material.id, actual: Number(actual), note: "Kiểm kho" } });
            toast.success("Đã ghi kiểm kho");
            await onDone();
          }}
        >
          Ghi số đếm
        </Button>
      </div>
      {ink && canIn ? (
        <Button
          variant="outline"
          className="min-h-12"
          onClick={async () => {
            await markInkOpened({ data: { materialId: material.id } });
            toast.success(`Đã trừ 1 lọ ${name}`);
            await onDone();
          }}
        >
          Mở lọ mới
        </Button>
      ) : null}
      {owner ? (
        <div className="flex flex-wrap gap-2 md:col-span-2">
          {ink ? (
            <>
              <Input className="h-11 w-40" aria-label="Tên màu mực" placeholder="Tên màu" value={name} onChange={(e) => setName(e.target.value)} />
              <Input className="h-11 w-36" aria-label="Mã mực" placeholder="Mã màu" value={code} onChange={(e) => setCode(e.target.value)} />
            </>
          ) : null}
          <Input className="h-11 w-32" placeholder="Giá / lần mua" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} />
          <Input className="h-11 w-28" placeholder="Tồn tối thiểu" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          <Input className="h-11 w-28" placeholder="Ngày chờ hàng" value={leadTime} onChange={(e) => setLeadTime(e.target.value)} />
          <Button
            variant="outline"
            className="min-h-12"
            onClick={async () => {
              await saveMaterial({
                data: {
                  materialId: material.id,
                  packPrice: packPrice.trim() === "" ? null : Number(packPrice),
                  packSize: material.packSize,
                  minStock: minStock.trim() === "" ? null : Number(minStock),
                  supplier,
                  leadTimeDays: leadTime.trim() === "" ? null : Number(leadTime),
                  ...(ink ? { name, code } : {}),
                },
              });
              toast.success("Đã lưu vật tư");
              await onDone();
            }}
          >
            Lưu giá / mức tối thiểu
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function download(filename: string, xml: string) {
  const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
