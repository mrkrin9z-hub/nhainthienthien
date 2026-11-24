import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { formatMaybe, formatVnd } from "@/lib/brand";
import { cloneShelf, createPriceSize, createProductGroup, getGroupSupply, getMe, getPriceBoard, importPriceSheet, pullCatalog, runQuote, saveGroupSupply, savePieces, savePrice, setSkuSold } from "@/lib/admin.functions";
import { SUPPLY_SCALE_LABEL, materialOptionsForScale, scaleQtyIsAutomatic } from "@/domain/group-supply";
import { SUPPLY_SCALES, type SupplyScale } from "@/domain/types";
import { DESK_CHANNEL_LABEL } from "@/domain/order-desk";
import { isMoHomeGroup } from "@/domain/mohome";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";
import { ProductEditor } from "@/components/admin/product-editor";
import { MoreHorizontal, Settings } from "lucide-react";


export function PricePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [groupId, setGroupId] = useState("all");
  const [channel, setChannel] = useState<Channel | "all">("all");
  const [inStock, setInStock] = useState(false);
  const allowed = me.data?.role === "owner" || me.data?.role === "sale";
  const board = useQuery({
    queryKey: ["prices", "catalog"],
    queryFn: () => getPriceBoard({ data: {} }),
    enabled: allowed,
  });
  const owner = me.data?.role === "owner";
  const [createOpen, setCreateOpen] = useState(false);
  const [editGroupId, setEditGroupId] = useState<string | null>(null);
  const [productOpen, setProductOpen] = useState(false);
  const [groupOpen, setGroupOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [q, setQ] = useState("");
  const displayChannel: Channel = channel === "all" ? "tai_tiem" : channel;
  const excelGroup = groupId === "all" ? (board.data?.groups[0]?.id ?? "trang_guong") : groupId;
  const priceRows = (board.data?.rows ?? []).filter((row) => {
    if (groupId !== "all" && row.groupId !== groupId) return false;
    if (channel !== "all") {
      const onChannel = row.soldOn?.includes(channel) || row.prices[channel]?.price != null;
      if (!onChannel) return false;
    }
    if (inStock) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${row.code} ${row.name}`.toLowerCase().includes(needle);
  });
  const list = useListPage(priceRows, `${groupId}|${channel}|${q}|${inStock}`);
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role === "production") return <p className="text-lg font-semibold text-primary">Chỉ chủ và sale xem bảng giá.</p>;

  const selectClass = "h-10 rounded-xl border border-slate-200 bg-white px-3 text-sm";
  return (
    <div className="space-y-4 bg-slate-50">
      <PageToolbar
        title="Sản phẩm"
        hint="Mỗi mã có giá riêng cho 6 kênh. Ô khác giá tại tiệm được tô cam. Giá CTV và Mơ Home chỉ dùng trong quản trị, không hiện trên trang chủ. * là còn vật tư chưa có giá mua."
        actions={
          owner ? (
            <>
              <Button variant="outline" className="min-h-10 rounded-xl bg-white" onClick={() => setExcelOpen(true)}>
                Nhập Excel
              </Button>
              <Button variant="outline" className="min-h-10 rounded-xl bg-white" onClick={() => setSettingsOpen(true)}>
                <Settings className="mr-1 size-4" />
                Cài đặt
              </Button>
              <Button variant="outline" className="min-h-10 rounded-xl bg-white" onClick={() => setGroupOpen(true)}>
                Nhóm sản phẩm
              </Button>
              <Button variant="outline" className="min-h-10 rounded-xl bg-white" onClick={() => { setEditGroupId(null); setProductOpen(true); }}>
                Tạo sản phẩm
              </Button>
              <Button className="min-h-10 rounded-xl bg-blue-600 hover:bg-blue-700" onClick={() => setCreateOpen(true)}>
                + Tạo khổ
              </Button>
            </>
          ) : null
        }
      />
      {owner ? (
        <>
          <GroupSupplyDialog open={groupOpen} onOpenChange={setGroupOpen} />
          <CreatePriceDialog
            groups={board.data?.groups ?? []}
            groupId={excelGroup}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <ExcelPriceDialog
            groupId={excelGroup}
            groupName={(board.data?.groups ?? []).find((group) => group.id === excelGroup)?.name ?? ""}
            open={excelOpen}
            onOpenChange={setExcelOpen}
          />
          <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
            <DialogContent className="max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Cài đặt giá</DialogTitle>
              </DialogHeader>
              <ShelfTools groupId={excelGroup} channel={displayChannel === "mo_home" ? "tai_tiem" : displayChannel} />
              <p className="text-sm text-muted-foreground">Giá vốn tính từ định mức nhóm × khổ và giá mua vật tư mới nhất. Phí kênh nằm ở Cài đặt chi phí.</p>
            </DialogContent>
          </Dialog>
        </>
      ) : null}
      <input
        value={q}
        onChange={(event) => setQ(event.target.value)}
        placeholder="Tìm tên, mã sản phẩm..."
        aria-label="Tìm tên, mã sản phẩm..."
        className="h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 text-sm"
      />
      <div className="flex flex-wrap items-center gap-2">
        <select className={selectClass} aria-label="Tất cả nhóm" value={groupId} onChange={(event) => setGroupId(event.target.value)}>
          <option value="all">Tất cả nhóm</option>
          {(board.data?.groups ?? []).map((group) => (
            <option key={group.id} value={group.id}>
              {group.name}
            </option>
          ))}
        </select>
        <select className={selectClass} aria-label="Tất cả kênh" value={channel} onChange={(event) => setChannel(event.target.value as Channel | "all")}>
          <option value="all">Tất cả kênh</option>
          {CHANNELS.map((item) => (
            <option key={item} value={item}>
              {DESK_CHANNEL_LABEL[item]}
            </option>
          ))}
        </select>
        <label className="flex h-10 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium">
          <Switch checked={inStock} onCheckedChange={setInStock} aria-label="Có tồn kho" />
          Có tồn kho
        </label>
      </div>
      {(board.data?.rows.length ?? 0) === 0 && !board.isLoading ? (
        <p className="rounded-2xl bg-card px-4 py-3 text-sm">
          Nhóm này chưa có mã. Bấm + Tạo, chọn nhóm và khổ. Vật tư lấy từ định mức của nhóm.
        </p>
      ) : null}
      {(board.data?.warnings ?? []).length > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-4 py-3 text-sm font-semibold text-foreground">
          {(board.data?.warnings ?? []).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <ProductEditor
        open={Boolean(editGroupId) || productOpen}
        groupId={editGroupId}
        onOpenChange={(next) => {
          if (!next) {
            setEditGroupId(null);
            setProductOpen(false);
          }
        }}
        onSaved={() => void board.refetch()}
      />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="sản phẩm" onPage={list.setPage} />
      <div className="space-y-3 md:hidden">
        {list.slice.map((row, index) => (
          <PriceCard
            key={row.skuId}
            row={row}
            groupName={(board.data?.groups ?? []).find((group) => group.id === row.groupId)?.name ?? row.groupId}
            owner={owner}
            stt={list.start + index + 1}
            onEdit={() => setEditGroupId(row.groupId)}
          />
        ))}
      </div>
      <div className="hidden overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm md:block">
        <table className="w-full min-w-[1180px] text-sm">
          <thead>
            <tr className="border-b text-left text-[11px] font-semibold tracking-wide text-slate-500 uppercase">
              <th className="px-3 py-3">STT</th>
              <th className="px-3 py-3">Mã SP</th>
              <th className="px-3 py-3">Tên sản phẩm</th>
              <th className="px-3 py-3">Nhóm SP</th>
              {CHANNELS.map((item) => (
                <th key={item} className={`px-2 py-3 text-right ${channel !== "all" && channel !== item ? "opacity-40" : ""}`}>
                  {DESK_CHANNEL_LABEL[item]}
                </th>
              ))}
              <th className="px-3 py-3" />
            </tr>
          </thead>
          <tbody>
            {list.slice.map((row, index) => (
              <PriceRow
                key={row.skuId}
                row={row}
                focusChannel={channel === "all" ? null : channel}
                groupName={(board.data?.groups ?? []).find((group) => group.id === row.groupId)?.name ?? row.groupId}
                owner={owner}
                stt={list.start + index + 1}
                onEdit={() => setEditGroupId(row.groupId)}
              />
            ))}
          </tbody>
        </table>
        {inStock ? <p className="px-4 py-8 text-center text-sm text-slate-500">Chưa có tồn thành phẩm. Hàng in theo đơn, vật tư nằm ở Kho.</p> : null}
      </div>
    </div>
  );
}

function ShelfTools({ groupId, channel }: { groupId: string; channel: Channel }) {
  const queryClient = useQueryClient();
  const [busy, setBusy] = useState("");
  const [overwrite, setOverwrite] = useState(false);
  const market = channel === "tiktok" || channel === "shopee";

  async function pull(source: "tiktok" | "shopee") {
    setBusy(source);
    try {
      const result = await pullCatalog({ data: { channel: source } });
      const extra = result.more ? " Còn trang sau, bấm lại." : "";
      toast.success(`${result.created} mã mới, ${result.priced} giá cập nhật.${extra}`);
      if (result.skipped.length) toast.message(result.skipped[0] ?? "");
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy("");
    }
  }

  async function copy(from: "tiktok" | "shopee") {
    if (channel !== "tai_tiem" && channel !== "facebook") return;
    setBusy(from);
    try {
      const result = await cloneShelf({ data: { groupId, from, to: channel, overwrite } });
      toast.success(`Đã nhân bản ${result.copied} giá. Giữ nguyên ${result.kept} ô đã có số.`);
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setBusy("");
    }
  }

  if (market) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" className="min-h-11" disabled={busy !== ""} onClick={() => pull(channel)}>
          {busy === channel ? "Đang lấy sản phẩm…" : "Lấy sản phẩm từ sàn"}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Button type="button" variant="outline" className="min-h-11" disabled={busy !== ""} onClick={() => copy("tiktok")}>
        {busy === "tiktok" ? "Đang nhân bản…" : "Nhân bản giá TikTok"}
      </Button>
      <Button type="button" variant="outline" className="min-h-11" disabled={busy !== ""} onClick={() => copy("shopee")}>
        {busy === "shopee" ? "Đang nhân bản…" : "Nhân bản giá Shopee"}
      </Button>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input type="checkbox" checked={overwrite} onChange={(event) => setOverwrite(event.target.checked)} />
        Ghi đè giá đã nhập
      </label>
    </div>
  );
}

const PRICE_STATUS: Record<string, string> = {
  dang_ban: "Đang bán",
  nhap: "Chưa có giá",
  cho_duyet: "Chờ duyệt",
};

const CHANNEL_PILL: Record<Channel, string> = {
  tai_tiem: "bg-slate-100 text-slate-700",
  facebook: "bg-blue-100 text-blue-800",
  tiktok: "bg-pink-100 text-pink-800",
  shopee: "bg-orange-100 text-orange-800",
  ctv: "bg-emerald-100 text-emerald-800",
  mo_home: "bg-violet-100 text-violet-800",
};

function PriceRow({
  row,
  focusChannel,
  groupName,
  owner,
  stt,
  onEdit,
}: {
  row: {
    skuId: string;
    groupId: string;
    code: string;
    name: string;
    piecesPerPack: number | null;
    sheetCost?: number | null;
    soldOn?: Channel[];
    prices: Record<string, { price: number | null; listPrice?: number | null; minTotal?: number | null; status: string; note: string; profit?: number | null; marginPercent?: number | null; cost?: number | null; costKnown?: number; costIncomplete?: boolean; sold?: boolean }>;
  };
  focusChannel: Channel | null;
  groupName: string;
  owner: boolean;
  stt: number;
  onEdit?: () => void;
}) {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editChannel, setEditChannel] = useState<Channel>("tai_tiem");
  const cell = row.prices[editChannel] ?? { price: null, status: "dang_ban", note: "" };
  const [price, setPrice] = useState("");
  const [listPrice, setListPrice] = useState("");
  const [minTotal, setMinTotal] = useState("");
  const [status, setStatus] = useState(cell.status);
  const [note, setNote] = useState(cell.note);
  const [pieces, setPieces] = useState("");
  const [sold, setSold] = useState(Boolean(cell.sold));
  const [saving, setSaving] = useState(false);
  const [quote, setQuote] = useState<Awaited<ReturnType<typeof runQuote>> | null>(null);
  const pack = row.code.endsWith("-GOI");
  const retail = row.prices['tai_tiem']?.price ?? null;

  function begin(channel: Channel) {
    const current = row.prices[channel] ?? { price: null, status: "dang_ban", note: "", listPrice: null, minTotal: null, sold: false };
    setEditChannel(channel);
    setPrice(current.price === null ? "" : String(current.price));
    setListPrice(current.listPrice == null ? "" : String(current.listPrice));
    setMinTotal(current.minTotal == null ? "" : String(current.minTotal));
    setStatus(current.status);
    setNote(current.note);
    setPieces(row.piecesPerPack === null ? "" : String(row.piecesPerPack));
    setSold(Boolean(current.sold));
    setQuote(null);
    setOpen(true);
    if (owner) {
      void runQuote({ data: { skuId: row.skuId, channel, price: null, affiliate: false } })
        .then(setQuote)
        .catch(() => setQuote(null));
    }
  }

  async function toggleSold(channel: Channel, next: boolean) {
    try {
      await setSkuSold({ data: { skuId: row.skuId, channel, sold: next } });
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function save() {
    setSaving(true);
    try {
      await savePrice({
        data: {
          skuId: row.skuId,
          channel: editChannel,
          price: price.trim() === "" ? null : Number(price),
          status: status as "dang_ban" | "nhap" | "cho_duyet",
          note,
          listPrice: listPrice.trim() === "" ? null : Number(listPrice),
          minTotal: minTotal.trim() === "" ? null : Number(minTotal),
        },
      });
      if (pack) {
        await savePieces({ data: { skuId: row.skuId, pieces: pieces.trim() === "" ? null : Number(pieces) } });
      }
      toast.success("Đã lưu giá");
      setOpen(false);
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <tr className="border-b last:border-0">
      <td className="px-3 py-3 text-slate-500">{stt}</td>
      <td className="px-3 py-3">
        <span className="rounded-md bg-slate-100 px-1.5 py-0.5 font-mono text-xs">{row.code}</span>
      </td>
      <td className="max-w-[220px] whitespace-normal break-words px-3 py-3 font-medium text-slate-900">{row.name}</td>
      <td className="px-3 py-3 text-slate-600">{groupName}</td>
      {CHANNELS.map((item) => {
        const offer = row.prices[item] ?? { price: null, status: "nhap", sold: false, listPrice: null, minTotal: null };
        const differs = offer.price != null && retail != null && offer.price !== retail;
        const dim = focusChannel !== null && focusChannel !== item;
        return (
          <td key={item} className={`px-2 py-2 text-right ${dim ? "opacity-40" : ""}`}>
            <button
              type="button"
              className={`w-full rounded-lg px-1.5 py-1 text-right tabular-nums ${owner ? "hover:bg-slate-50" : ""} ${differs ? "font-semibold text-amber-700" : "font-medium text-slate-900"}`}
              onClick={() => owner && begin(item)}
              disabled={!owner}
            >
              {offer.price == null ? "—" : formatVnd(offer.price)}
            </button>
            {offer.listPrice != null && offer.price != null && offer.listPrice > offer.price ? (
              <p className="text-[10px] text-slate-400 line-through tabular-nums">{formatVnd(offer.listPrice)}</p>
            ) : null}
            {offer.minTotal ? <p className="text-[10px] text-slate-500">min {formatVnd(offer.minTotal)}</p> : null}
            <label className="mt-1 inline-flex items-center gap-1 text-[10px] text-slate-500">
              <input
                type="checkbox"
                className="size-3"
                checked={Boolean(offer.sold)}
                disabled={!owner}
                aria-label={`Bán ${row.code} kênh ${DESK_CHANNEL_LABEL[item]}`}
                onChange={(event) => void toggleSold(item, event.target.checked)}
              />
              {offer.sold ? "Bán" : "Ẩn"}
            </label>
          </td>
        );
      })}
      <td className="px-3 py-3 text-right">
        {owner ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button type="button" className="inline-flex size-9 items-center justify-center rounded-lg hover:bg-slate-100" aria-label={`Menu ${row.code}`}>
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit ? <DropdownMenuItem onClick={onEdit}>Sửa sản phẩm & giá 6 kênh</DropdownMenuItem> : null}
              {CHANNELS.map((item) => (
                <DropdownMenuItem key={item} onClick={() => begin(item)}>
                  Sửa giá {DESK_CHANNEL_LABEL[item]}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </td>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Sửa giá · {row.code}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">{row.name} · {CHANNEL_LABEL[editChannel]}</p>
            {owner ? (
              <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
                <input type="checkbox" checked={sold} onChange={(event) => void toggleSold(editChannel, event.target.checked)} />
                Bán ở kênh này
              </label>
            ) : null}
            <label className="block text-sm font-semibold">
              Giá bán
              <MoneyInput className="mt-1 min-h-11" value={price} placeholder="Chưa có" aria-label={`Giá ${row.name}`} onValueChange={(value) => setPrice(value == null ? "" : String(value))} />
            </label>
            <label className="block text-sm font-semibold">
              Giá gạch (nếu có)
              <MoneyInput className="mt-1 min-h-11" value={listPrice} placeholder="Không gạch" onValueChange={(value) => setListPrice(value == null ? "" : String(value))} />
            </label>
            <label className="block text-sm font-semibold">
              Tối thiểu / dòng
              <MoneyInput className="mt-1 min-h-11" value={minTotal} placeholder="Không" onValueChange={(value) => setMinTotal(value == null ? "" : String(value))} />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">Ví dụ ảnh lụa 6×9 lẻ: 1–10 ảnh vẫn tính 30.000đ.</span>
            </label>
            <label className="block text-sm font-semibold">
              Trạng thái
              <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3 text-sm" value={status} aria-label={`Trạng thái ${row.name}`} onChange={(e) => setStatus(e.target.value)}>
                <option value="dang_ban">Đang bán</option>
                <option value="nhap">Chưa có giá</option>
                <option value="cho_duyet">Chờ duyệt</option>
              </select>
            </label>
            <label className="block text-sm font-semibold">
              Ghi chú
              <Input className="mt-1 min-h-11" value={note} onChange={(e) => setNote(e.target.value)} />
            </label>
            {pack ? (
              <label className="block text-sm font-semibold">
                Số miếng trong gói
                <Input className="mt-1 min-h-11" inputMode="numeric" value={pieces} placeholder="Chưa có" onChange={(e) => setPieces(e.target.value.replace(/[^\d]/g, ""))} />
              </label>
            ) : null}
            <div className="rounded-xl bg-slate-50 px-3 py-2 text-sm">
              <p className="font-semibold">Giá vốn {quote?.materialIncomplete ? "(chưa đủ giá mua)" : ""}: {quote ? formatMaybe(quote.material ?? quote.materialKnown) : "Đang tính…"}</p>
              <p>Lãi: {quote?.profit == null ? "Chưa đủ số" : `${formatMaybe(quote.profit)} (${quote.marginPercent}%)`}</p>
              <ul className="mt-1 space-y-0.5 text-xs text-muted-foreground">
                {(quote?.lines ?? []).filter((line) => line.detail !== `${""}`).slice(0, 12).map((line) => (
                  <li key={`${line.name}-${line.detail}`}>{line.name}: {line.amount == null ? "chưa có giá" : formatMaybe(line.amount)} · {line.detail}</li>
                ))}
              </ul>
              <p className="mt-1 text-xs text-muted-foreground">Định mức sửa ở Nhóm sản phẩm, không nhập lại từng mã.</p>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : "Lưu giá"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </tr>
  );
}

function CreatePriceDialog({
  groups,
  groupId,
  open,
  onOpenChange,
}: {
  groups: { id: string; name: string }[];
  groupId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<"sp" | "combo">("sp");
  const [pickedGroup, setPickedGroup] = useState(groupId);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sheets, setSheets] = useState("1");
  const [price, setPrice] = useState("");
  const [channels, setChannels] = useState<Channel[]>(["tai_tiem", "facebook"]);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  function digits(value: string) {
    return value.replace(/[^\d]/g, "");
  }

  async function save() {
    const found = name.match(/(\d+)\s*[x×]\s*(\d+)/);
    const widthCm = Number(width || found?.[1] || "");
    const heightCm = Number(height || found?.[2] || "");
    const sheetCount = tab === "combo" ? Math.max(2, Number(sheets || "2")) : Number(sheets || "1");
    const internal = isMoHomeGroup(pickedGroup);
    if (!name.trim() || !price || !widthCm || !heightCm || !pickedGroup) {
      toast.error("Nhập tên, nhóm, khổ và giá.");
      return;
    }
    if (!internal && !channels.includes("tai_tiem")) {
      toast.error("Nhóm Nhà In cần chọn kênh Tại tiệm. Giá Mơ Home không copy sang.");
      return;
    }
    if (internal && !channels.includes("mo_home") && !channels.includes("tai_tiem")) {
      toast.error("Nhóm Mơ Home cần giá nội bộ.");
      return;
    }
    const amount = Number(price);
    const prices: Partial<Record<Channel, number>> = {};
    for (const item of channels) prices[item] = amount;
    setSaving(true);
    try {
      const result = await createPriceSize({
        data: {
          groupId: pickedGroup,
          widthCm,
          heightCm,
          sheets: sheetCount,
          prices,
          ...(code.trim() ? { code: code.trim() } : {}),
        },
      });
      toast.success(result.created ? "Đã thêm sản phẩm" : "Khổ này đã có, đã cập nhật giá");
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  function toggleChannel(item: Channel) {
    setChannels((current) => (current.includes(item) ? current.filter((id) => id !== item) : [...current, item]));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto rounded-2xl sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Thêm sản phẩm mới</DialogTitle>
        </DialogHeader>
        <p className="sr-only">Tạo khổ giá</p>
        <div className="flex gap-2">
          {(["sp", "combo"] as const).map((item) => (
            <button
              key={item}
              type="button"
              className={`min-h-10 flex-1 rounded-xl text-sm font-semibold ${tab === item ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-600"}`}
              onClick={() => {
                setTab(item);
                setSheets(item === "combo" ? "2" : "1");
              }}
            >
              {item === "sp" ? "Sản phẩm" : "Combo"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Mã sản phẩm*
            <Input className="mt-1 min-h-11" value={code} placeholder="Để trống nếu tự sinh" onChange={(event) => setCode(event.target.value)} />
          </label>
          <label className="text-sm font-semibold">
            Giá (VNĐ)*
            <MoneyInput className="mt-1 min-h-11" value={price} onValueChange={(value) => setPrice(value == null ? "" : String(value))} />
          </label>
        </div>
        <label className="text-sm font-semibold">
          Tên sản phẩm*
          <Input className="mt-1 min-h-11" value={name} placeholder="Ảnh gỗ 40×60" onChange={(event) => setName(event.target.value)} />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="text-sm font-semibold">
            Rộng cm*
            <Input className="mt-1 min-h-11" inputMode="numeric" value={width} onChange={(event) => setWidth(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            Cao cm*
            <Input className="mt-1 min-h-11" inputMode="numeric" value={height} onChange={(event) => setHeight(digits(event.target.value))} />
          </label>
        </div>
        {tab === "combo" ? (
          <label className="text-sm font-semibold">
            Số tấm
            <Input className="mt-1 min-h-11" inputMode="numeric" value={sheets} onChange={(event) => setSheets(digits(event.target.value))} />
          </label>
        ) : null}
        <label className="text-sm font-semibold">
          Nhóm sản phẩm*
          <select className="mt-1 min-h-11 w-full rounded-xl border bg-white px-3 text-sm" value={pickedGroup} onChange={(event) => setPickedGroup(event.target.value)}>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Kênh bán</p>
            <div className="flex gap-2 text-xs font-semibold text-blue-600">
              <button type="button" onClick={() => setChannels([...CHANNELS])}>Chọn tất cả</button>
              <button type="button" onClick={() => setChannels([])}>Bỏ chọn</button>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {CHANNELS.map((item) => (
              <label key={item} className="flex min-h-10 items-center gap-2 rounded-xl border bg-white px-3 text-sm">
                <input type="checkbox" checked={channels.includes(item)} onChange={() => toggleChannel(item)} />
                {DESK_CHANNEL_LABEL[item]}
              </label>
            ))}
          </div>
        </div>
        <label className="text-sm font-semibold">
          Mô tả
          <textarea className="mt-1 min-h-24 w-full rounded-xl border bg-white px-3 py-2 text-sm" value={detail} onChange={(event) => setDetail(event.target.value)} />
        </label>
        <DialogFooter>
          <Button className="min-h-11 rounded-xl bg-blue-600 hover:bg-blue-700" disabled={saving} onClick={() => void save()}>
            Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExcelPriceDialog({
  groupId,
  groupName,
  open,
  onOpenChange,
}: {
  groupId: string;
  groupName: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const queryClient = useQueryClient();
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [saving, setSaving] = useState(false);

  async function readFile(next: File) {
    const bytes = new Uint8Array(await next.arrayBuffer());
    let binary = "";
    for (let i = 0; i < bytes.length; i += 0x8000) binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    setFile({ name: next.name, base64: btoa(binary) });
  }

  async function save() {
    if (!file) return;
    setSaving(true);
    try {
      const result = await importPriceSheet({ data: { groupId, filename: file.name, base64: file.base64 } });
      toast.success(`Đã tạo ${result.created} khổ, cập nhật ${result.updated} giá`);
      setFile(null);
      onOpenChange(false);
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) setFile(null);
        onOpenChange(next);
      }}
    >
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tạo từ Excel{groupName ? ` · ${groupName}` : ""}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Dòng đầu là tiêu đề. Cột: Rộng, Cao, Số tấm, Giá tại tiệm. Có thể thêm Facebook, TikTok, Shopee hoặc Mã. Mã đã có thì chỉ sửa giá, không đổi tên.
        </p>
        <Label htmlFor="price-excel">File CSV hoặc Excel</Label>
        <Input
          id="price-excel"
          className="min-h-11"
          type="file"
          accept=".csv,.xlsx,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          onChange={(event) => {
            const next = event.target.files?.[0];
            if (next) void readFile(next);
          }}
        />
        <DialogFooter>
          <Button className="min-h-11" disabled={!file || saving} onClick={() => void save()}>
            Tạo
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DraftRule = { materialId: string; phase: "print" | "pack"; scale: SupplyScale; qty: string; rollWidthCm: string };
type DraftOverride = { size: string; materialId: string; phase: "print" | "pack"; qty: string };

function blankRule(): DraftRule {
  return { materialId: "", phase: "print", scale: "per_sheet", qty: "1", rollWidthCm: "" };
}

function GroupSupplyDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const queryClient = useQueryClient();
  const board = useQuery({ queryKey: ["group-supply"], queryFn: () => getGroupSupply(), enabled: open });
  const [groupId, setGroupId] = useState("");
  const [name, setName] = useState("");
  const [rules, setRules] = useState<DraftRule[]>([]);
  const [overrides, setOverrides] = useState<DraftOverride[]>([]);
  const [saving, setSaving] = useState(false);

  function load(id: string) {
    setGroupId(id);
    const data = board.data;
    if (!data) return;
    setRules(
      data.rules
        .filter((rule) => rule.groupId === id)
        .map((rule) => ({
          materialId: rule.materialId,
          phase: rule.phase,
          scale: rule.scale,
          qty: rule.qty === null ? "" : String(rule.qty),
          rollWidthCm: rule.rollWidthCm ? String(rule.rollWidthCm) : "",
        })),
    );
    setOverrides(
      data.overrides
        .filter((row) => row.groupId === id)
        .map((row) => ({
          size: row.size,
          materialId: row.materialId,
          phase: row.phase,
          qty: row.qty === null ? "" : String(row.qty),
        })),
    );
  }

  async function createGroup() {
    setSaving(true);
    try {
      const created = await createProductGroup({ data: { name } });
      toast.success(`Đã tạo nhóm ${created.name}`);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["group-supply"] });
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
      setGroupId(created.id);
      setRules([]);
      setOverrides([]);
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  async function save() {
    if (!groupId) return;
    setSaving(true);
    try {
      const numberOrNull = (value: string) => (value.trim() === "" ? null : Number(value));
      await saveGroupSupply({
        data: {
          groupId,
          rules: rules
            .filter((rule) => rule.materialId)
            .map((rule) => ({
              materialId: rule.materialId,
              phase: rule.phase,
              scale: rule.scale,
              qty: numberOrNull(rule.qty),
              rollWidthCm: numberOrNull(rule.rollWidthCm),
            })),
          overrides: overrides
            .filter((row) => row.size.trim() && row.materialId)
            .map((row) => ({ size: row.size.trim(), materialId: row.materialId, phase: row.phase, qty: numberOrNull(row.qty) })),
        },
      });
      toast.success("Đã lưu định mức nhóm");
      await queryClient.invalidateQueries({ queryKey: ["group-supply"] });
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  const materials = board.data?.materials ?? [];
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>Nhóm sản phẩm</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          Chọn vật tư nhóm dùng và cách tính theo khổ. Sản phẩm chỉ cần nhóm và khổ. Combo là số tấm nhân khổ đó. Mực không chọn ở đây: mua lọ thì ghi phiếu nhập hoặc chi mục Mực in.
        </p>
        <div className="flex flex-wrap gap-2">
          <Input className="min-h-11 max-w-xs" value={name} placeholder="Tên nhóm, ví dụ Ảnh gỗ" aria-label="Tên nhóm sản phẩm" onChange={(event) => setName(event.target.value)} />
          <Button type="button" variant="outline" className="min-h-11" disabled={saving || name.trim().length < 2} onClick={() => void createGroup()}>
            Tạo nhóm
          </Button>
        </div>
        <label className="block text-sm font-semibold">
          Nhóm
          <select className="mt-1 min-h-11 w-full rounded-md border bg-background px-3" aria-label="Chọn nhóm sản phẩm" value={groupId} onChange={(event) => load(event.target.value)}>
            <option value="">Chọn nhóm</option>
            {(board.data?.groups ?? []).map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
        </label>
        {groupId ? (
          <>
            <div className="space-y-2">
              {rules.map((rule, index) => (
                <div key={`${rule.materialId}-${index}`} className="grid gap-2 rounded-xl border p-2 md:grid-cols-5">
                  <select className="min-h-11 rounded-md border bg-background px-2 text-sm" aria-label={`Vật tư ${index + 1}`} value={rule.materialId} onChange={(event) => setRules((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, materialId: event.target.value } : item)))}>
                    <option value="">Vật tư</option>
                    {materialOptionsForScale(materials, rule.scale, rule.materialId).map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                  <select className="min-h-11 rounded-md border bg-background px-2 text-sm" aria-label={`Cách tính ${index + 1}`} value={rule.scale} onChange={(event) => setRules((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, scale: event.target.value as SupplyScale, materialId: event.target.value === "size_sheet" ? item.materialId.replace(/-\d+x\d+$/i, "") : item.materialId } : item)))}>
                    {SUPPLY_SCALES.filter((scale) => scale !== "area_ml").map((scale) => (
                      <option key={scale} value={scale}>{SUPPLY_SCALE_LABEL[scale]}</option>
                    ))}
                  </select>
                  <select className="min-h-11 rounded-md border bg-background px-2 text-sm" aria-label={`Lúc dùng ${index + 1}`} value={rule.phase} onChange={(event) => setRules((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, phase: event.target.value as "print" | "pack" } : item)))}>
                    <option value="print">Khi in</option>
                    <option value="pack">Khi đóng gói</option>
                  </select>
                  <Input className="min-h-11" inputMode="decimal" aria-label={`Số lượng ${index + 1}`} disabled={scaleQtyIsAutomatic(rule.scale)} value={scaleQtyIsAutomatic(rule.scale) ? "" : rule.qty} placeholder={rule.scale === "area_ml" ? "ml / m²" : scaleQtyIsAutomatic(rule.scale) ? "Tự tính theo khổ" : "Số lượng"} onChange={(event) => setRules((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, qty: event.target.value } : item)))} />
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setRules((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Xóa</Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setRules((rows) => [...rows, blankRule()])}>Thêm vật tư</Button>
            </div>
            <div className="space-y-2">
              <p className="text-sm font-semibold">Ngoại lệ theo khổ</p>
              {overrides.map((row, index) => (
                <div key={`${row.size}-${index}`} className="grid gap-2 md:grid-cols-4">
                  <Input className="min-h-11" aria-label={`Khổ ${index + 1}`} value={row.size} placeholder="13x18" onChange={(event) => setOverrides((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, size: event.target.value } : item)))} />
                  <select className="min-h-11 rounded-md border bg-background px-2 text-sm" aria-label={`Vật tư ngoại lệ ${index + 1}`} value={row.materialId} onChange={(event) => setOverrides((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, materialId: event.target.value } : item)))}>
                    <option value="">Vật tư</option>
                    {materials.filter((material) => !material.id.startsWith("muc-")).map((material) => (
                      <option key={material.id} value={material.id}>{material.name}</option>
                    ))}
                  </select>
                  <Input className="min-h-11" inputMode="decimal" aria-label={`Số ngoại lệ ${index + 1}`} value={row.qty} placeholder="Số / tấm" onChange={(event) => setOverrides((rows) => rows.map((item, rowIndex) => (rowIndex === index ? { ...item, qty: event.target.value } : item)))} />
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setOverrides((rows) => rows.filter((_, rowIndex) => rowIndex !== index))}>Xóa</Button>
                </div>
              ))}
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setOverrides((rows) => [...rows, { size: "", materialId: "", phase: "print", qty: "1" }])}>Thêm ngoại lệ</Button>
            </div>
            <DialogFooter>
              <Button type="button" className="min-h-11" disabled={saving} onClick={() => void save()}>
                {saving ? "Đang lưu…" : "Lưu định mức"}
              </Button>
            </DialogFooter>
          </>
        ) : null}
      </DialogContent>
    </Dialog>
  );
}


function PriceCard({
  row,
  groupName,
  owner,
  stt,
  onEdit,
}: {
  row: {
    skuId: string;
    groupId: string;
    code: string;
    name: string;
    prices: Record<string, { price: number | null; listPrice?: number | null; minTotal?: number | null; status: string; sold?: boolean }>;
  };
  groupName: string;
  owner: boolean;
  stt: number;
  onEdit?: () => void;
}) {
  return (
    <article className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-wide text-slate-500 uppercase">#{stt} · {row.code}</p>
          <h3 className="mt-1 text-base font-semibold leading-snug break-words text-slate-900">{row.name}</h3>
          <p className="text-xs text-slate-500">{groupName}</p>
        </div>
        {owner && onEdit ? (
          <Button type="button" variant="outline" className="min-h-9 shrink-0" onClick={onEdit}>
            Sửa
          </Button>
        ) : null}
      </div>
      <dl className="mt-3 grid grid-cols-2 gap-2">
        {CHANNELS.map((item) => {
          const offer = row.prices[item] ?? { price: null, sold: false, minTotal: null };
          return (
            <div key={item} className="rounded-xl bg-slate-50 px-2.5 py-2">
              <dt className="text-[11px] font-semibold text-slate-500">{DESK_CHANNEL_LABEL[item]}</dt>
              <dd className="text-sm font-semibold tabular-nums text-slate-900">{offer.price == null ? "—" : formatVnd(offer.price)}</dd>
              {offer.minTotal ? <p className="text-[10px] text-slate-500">min {formatVnd(offer.minTotal)}</p> : null}
              <p className="text-[10px] text-slate-500">{offer.sold ? "Đang bán" : "Không bán"}</p>
            </div>
          );
        })}
      </dl>
    </article>
  );
}
