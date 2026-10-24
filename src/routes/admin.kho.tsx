import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { AccessHub, HubBack } from "@/components/admin/access-hub";
import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { FilterSheet, PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { CircleCheck, CircleDashed, ClipboardList, Droplets, MoreHorizontal, Package, PackagePlus, PackageSearch, TriangleAlert } from "lucide-react";
import { formatMaybe } from "@/lib/brand";
import { WasteDesk } from "@/components/admin/waste-desk";
import { approvePrice, countStock, downloadExcel, getInventory, getMe, markInkOpened, receiveStock, saveMaterial } from "@/lib/admin.functions";

const STOCK_MODES = ["ton", "nhap", "hong", "phieu", "muc"] as const;
type StockMode = (typeof STOCK_MODES)[number];

export const Route = createFileRoute("/admin/kho")({
  validateSearch: (search: Record<string, unknown>): { m: StockMode | "" } => ({
    m: STOCK_MODES.includes(search.m as StockMode) ? (search.m as StockMode) : "",
  }),
  component: StockPage,
});

function StockPage() {
  const { m } = Route.useSearch();
  if (!m) return <StockHub />;
  if (m === "hong") {
    return (
      <div className="space-y-4">
        <HubBack to="/admin/kho" label="Kho vật tư" />
        <WasteDesk />
      </div>
    );
  }
  return <StockBody />;
}

function StockHub() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  return (
    <AccessHub
      title="Kho vật tư"
      hint="Tồn, nhập, phiếu xuất và báo hỏng — mở từng mục bằng nút truy cập."
      role={me.data?.role}
      groups={[
        {
          title: "Tồn kho",
          cards: [
            { id: "ton", title: "Tồn kho", blurb: "Số đang có, sắp hết, tồn âm và vật tư chưa đếm.", to: "/admin/kho", search: { m: "ton" }, icon: Package },
            { id: "phieu", title: "Nhập xuất", blurb: "Phiếu nhập, trừ kho và kênh đã dùng vật tư.", to: "/admin/kho", search: { m: "phieu" }, icon: ClipboardList },
          ],
        },
        {
          title: "Nhập và hao hụt",
          cards: [
            { id: "nhap", title: "Nhập vật tư", blurb: "Ghi lần mua giấy, gỗ, nam châm hoặc mực.", to: "/admin/kho", search: { m: "nhap" }, icon: PackagePlus, roles: ["owner", "sale"] },
            { id: "muc", title: "Mở lọ mực", blurb: "Trừ một lọ khi mở màu mới. Mực tính lãi vẫn là 4,4%.", to: "/admin/kho", search: { m: "muc" }, icon: Droplets, roles: ["owner", "sale"] },
            { id: "hong", title: "Báo hỏng", blurb: "Phiếu hỏng, hao hụt và ảnh kèm theo.", to: "/admin/kho", search: { m: "hong" }, icon: TriangleAlert },
          ],
        },
      ]}
    />
  );
}

function StockBody() {
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
  const [receiveOpen, setReceiveOpen] = useState(false);
  const [inkOpen, setInkOpen] = useState(false);
  const [receiveId, setReceiveId] = useState("");
  const [packs, setPacks] = useState("1");
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
    return !needle || `${move.materialName} ${move.reason} ${move.note} ${move.channelLabel ?? ""}`.toLowerCase().includes(needle);
  });
  const moveList = useListPage(movements, q);

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  }

  const opened = (stock.data?.materials ?? []).find((material) => material.id === openId) ?? null;

  const titles: Record<Exclude<StockMode, "hong">, string> = {
    ton: "Tồn kho vật tư",
    nhap: "Nhập vật tư",
    phieu: "Nhập xuất",
    muc: "Mở lọ mực",
  };

  return (
    <div className="space-y-4">
      <HubBack to="/admin/kho" label="Kho vật tư" />
      {m === "ton" || m === "phieu" ? (
      <PageToolbar
        title={titles[m]}
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
      ) : (
        <h1 className="text-2xl font-extrabold text-primary">{titles[m]}</h1>
      )}
      {m === "ton" ? (
      <FilterSheet open={filters} onClose={() => setFilters(false)} title="Bộ lọc vật tư">
        <FilterChips label="Tồn kho" value={stockFilter} chips={stockChips} onChange={setStockFilter} wrap />
      </FilterSheet>
      ) : null}
      {m === "ton" ? (
      <>
      <Dialog open={inkOpen} onOpenChange={setInkOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Mở lọ mực mới</DialogTitle>
          </DialogHeader>
          <InkList inks={inks} onOpen={async (ink) => {
            await markInkOpened({ data: { materialId: ink.id } });
            toast.success(`Đã trừ 1 lọ ${ink.name}`);
            await refresh();
          }} />
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
      </>
      ) : null}
      {m === "nhap" && canIn ? (
        <section className="max-w-lg space-y-3 rounded-2xl border bg-card p-4">
          <label className="text-sm font-semibold">
            Vật tư
            <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" aria-label="Chọn vật tư" value={receiveId} onChange={(event) => setReceiveId(event.target.value)}>
              <option value="">Chọn vật tư</option>
              {allMaterials.map((material) => (
                <option key={material.id} value={material.id}>{material.name}</option>
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
              await refresh();
            }}
          >
            Nhập
          </Button>
        </section>
      ) : null}
      {m === "muc" && canIn ? (
        <section className="rounded-2xl border bg-card p-4">
          <p className="mb-3 text-sm text-muted-foreground">Mỗi màu một lọ. Mã màu để trống cho đến khi có mã Canon. Mực tính lãi vẫn là 4,4% giá bán.</p>
          <InkList inks={inks} onOpen={async (ink) => {
            await markInkOpened({ data: { materialId: ink.id } });
            toast.success(`Đã trừ 1 lọ ${ink.name}`);
            await refresh();
          }} />
        </section>
      ) : null}
      {m === "phieu" ? (
      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Nhập xuất</h2>
        {(stock.data?.usageByChannel ?? []).length > 0 ? (
          <p className="mt-1 text-sm text-muted-foreground">
            Phiếu trừ theo kênh: {(stock.data?.usageByChannel ?? []).map((row) => `${row.label} ${row.lines}`).join(" · ")}
          </p>
        ) : null}
        <div className="mt-2">
          <ListPager page={moveList.page} pages={moveList.pages} total={moveList.total} start={moveList.start} count={moveList.slice.length} noun="phiếu" onPage={moveList.setPage} />
        </div>
        <ul className="mt-2 space-y-1 text-sm">
          {moveList.slice.map((move) => (
            <li key={move.id}>
              {move.materialName}: {move.qty} · {move.reason} {move.note}
              {move.channelLabel ? ` · ${move.channelLabel}` : ""}
            </li>
          ))}
          {moveList.total === 0 ? <li className="text-muted-foreground">{(stock.data?.movements ?? []).length === 0 ? "Chưa có phiếu." : "Không có phiếu khớp bộ lọc."}</li> : null}
        </ul>
      </section>
      ) : null}
    </div>
  );
}

function InkList({
  inks,
  onOpen,
}: {
  inks: { id: string; name: string; stock: number; unit: string; stockLabel: string }[];
  onOpen: (ink: { id: string; name: string }) => Promise<void>;
}) {
  return (
    <ul className="space-y-2">
      {inks.map((ink) => (
        <li key={ink.id} className="flex items-center justify-between gap-3 text-sm">
          <span>
            <span className="font-semibold">{ink.name}</span>
            <span className="text-muted-foreground"> · {ink.stock} {ink.unit} · {ink.stockLabel}</span>
          </span>
          <Button variant="outline" className="min-h-11" onClick={() => void onOpen(ink)}>
            Mở lọ mới
          </Button>
        </li>
      ))}
    </ul>
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
