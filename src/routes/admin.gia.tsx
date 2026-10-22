import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ALL_TONE, FilterChips, type FilterChip } from "@/components/admin/filter-chips";
import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { GoodsLinks } from "@/components/admin/sections";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMaybe } from "@/lib/brand";
import { cloneShelf, createPriceSize, getBom, getMe, getPriceBoard, importPriceSheet, pullCatalog, runQuote, runRecalc, saveBomQty, savePieces, savePrice } from "@/lib/admin.functions";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";

export const Route = createFileRoute("/admin/gia")({
  component: PricePage,
});

const CHANNELS: Channel[] = ["tai_tiem", "facebook", "tiktok", "shopee"];

function PricePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [groupId, setGroupId] = useState("trang_guong");
  const [channel, setChannel] = useState<Channel>("tai_tiem");
  const allowed = me.data?.role === "owner" || me.data?.role === "sale";
  const board = useQuery({
    queryKey: ["prices", groupId],
    queryFn: () => getPriceBoard({ data: { groupId } }),
    enabled: allowed,
  });
  const owner = me.data?.role === "owner";
  const [createOpen, setCreateOpen] = useState(false);
  const [excelOpen, setExcelOpen] = useState(false);
  const [q, setQ] = useState("");
  const [priced, setPriced] = useState("all");
  const priceRows = (board.data?.rows ?? []).filter((row) => {
    const cell = row.prices[channel];
    if (priced === "co" && (cell?.price ?? null) === null) return false;
    if (priced === "trong" && (cell?.price ?? null) !== null) return false;
    const needle = q.trim().toLowerCase();
    return !needle || `${row.code} ${row.name}`.toLowerCase().includes(needle);
  });
  const priceChips: FilterChip[] = [
    { id: "all", label: "Tất cả", count: board.data?.rows.length ?? 0, ...ALL_TONE },
    { id: "co", label: "Đã có giá", count: (board.data?.rows ?? []).filter((row) => (row.prices[channel]?.price ?? null) !== null).length, color: "#059669" },
    { id: "trong", label: "Chưa có giá", count: (board.data?.rows ?? []).filter((row) => (row.prices[channel]?.price ?? null) === null).length, color: "#D97706" },
  ];
  const list = useListPage(priceRows, `${groupId}|${channel}|${q}|${priced}`);
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role === "production") return <p className="text-lg font-semibold text-primary">Chỉ chủ và sale xem bảng giá.</p>;

  return (
    <div className="space-y-4">
      <GoodsLinks />
      <PageToolbar
        title="Bảng giá theo kênh"
        hint="Giá chung cho tại tiệm, web và Facebook. TikTok/Shopee: giá bán là giá sau giảm, niêm yết để đối chiếu. Lãi tính từ vốn bảng 22/10, mực 4,4%, hoa hồng 3% tại tiệm và Facebook, sàn 27% + 11.000đ, quảng cáo Facebook 10% và đóng gói 8.000đ."
        search={q}
        onSearch={setQ}
        searchPlaceholder="Tìm mã hoặc quy cách…"
        actions={
          owner ? (
            <>
              <Button variant="outline" className="min-h-11" onClick={() => setExcelOpen(true)}>
                Tạo từ Excel
              </Button>
              <Button className="min-h-11" onClick={() => setCreateOpen(true)}>
                Tạo
              </Button>
            </>
          ) : null
        }
      />
      {owner ? (
        <>
          <CreatePriceDialog
            groupId={groupId}
            groupName={(board.data?.groups ?? []).find((group) => group.id === groupId)?.name ?? ""}
            open={createOpen}
            onOpenChange={setCreateOpen}
          />
          <ExcelPriceDialog
            groupId={groupId}
            groupName={(board.data?.groups ?? []).find((group) => group.id === groupId)?.name ?? ""}
            open={excelOpen}
            onOpenChange={setExcelOpen}
          />
        </>
      ) : null}
      <div className="flex flex-wrap gap-2">
        {(board.data?.groups ?? []).map((group) => (
          <button
            key={group.id}
            type="button"
            onClick={() => setGroupId(group.id)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${groupId === group.id ? "bg-accent text-accent-foreground" : "bg-card"}`}
          >
            {group.name}
          </button>
        ))}
      </div>
      <div className="flex flex-wrap gap-2">
        {CHANNELS.map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setChannel(item)}
            className={`min-h-11 rounded-full px-4 text-sm font-semibold ${channel === item ? "bg-primary text-primary-foreground" : "bg-card"}`}
          >
            {CHANNEL_LABEL[item]}
          </button>
        ))}
      </div>
      {owner ? <ShelfTools groupId={groupId} channel={channel} /> : null}
      {(board.data?.warnings ?? []).length > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-4 py-3 text-sm font-semibold text-foreground">
          {(board.data?.warnings ?? []).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <FilterChips label="Giá kênh đang chọn" value={priced} chips={priceChips} onChange={setPriced} />
      <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="khổ" onPage={list.setPage} />
      <div className="overflow-hidden rounded-md border bg-card">
        <div className="hidden grid-cols-[3rem_7rem_minmax(0,1.2fr)_8rem_7rem_minmax(0,1fr)] gap-2 border-b bg-muted/40 px-3 py-2.5 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase md:grid">
          <span>STT</span>
          <span>Mã SP</span>
          <span>Tên sản phẩm</span>
          <span>Giá bán</span>
          <span>Lãi</span>
          <span>Trạng thái</span>
        </div>
        <div className="divide-y">
          {list.slice.map((row, index) => (
            <PriceRow key={`${row.skuId}-${channel}`} row={row} channel={channel} owner={owner} stt={list.start + index + 1} />
          ))}
        </div>
      </div>
      {owner ? <Calculator skus={board.data?.rows ?? []} /> : <p className="text-sm text-muted-foreground">Máy tính giá vốn và lãi chỉ chủ xem.</p>}
      {owner ? <BomEditor skus={board.data?.rows ?? []} /> : null}
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

function PriceRow({
  row,
  channel,
  owner,
  stt,
}: {
  row: {
    skuId: string;
    code: string;
    name: string;
    piecesPerPack: number | null;
    sheetCost?: number | null;
    prices: Record<string, { price: number | null; listPrice?: number | null; status: string; note: string; profit?: number | null; marginPercent?: number | null }>;
  };
  channel: Channel;
  owner: boolean;
  stt: number;
}) {
  const queryClient = useQueryClient();
  const cell = row.prices[channel] ?? { price: null, status: "dang_ban", note: "" };
  const margin =
    cell.profit === null || cell.profit === undefined
      ? "Chưa đủ số"
      : `${formatMaybe(cell.profit)}${cell.marginPercent === null || cell.marginPercent === undefined ? "" : ` · ${cell.marginPercent}%`}`;
  const [price, setPrice] = useState(cell.price === null ? "" : String(cell.price));
  const [status, setStatus] = useState(cell.status);
  const [pieces, setPieces] = useState(row.piecesPerPack === null ? "" : String(row.piecesPerPack));

  async function save() {
    try {
      await savePrice({
        data: {
          skuId: row.skuId,
          channel,
          price: price.trim() === "" ? null : Number(price),
          status: status as "dang_ban" | "nhap" | "cho_duyet",
          note: cell.note,
        },
      });
      toast.success("Đã lưu giá");
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const pack = row.code.endsWith("-GOI") ? (
    <div className="mt-1 flex items-center gap-2">
      <Input className="h-10 w-24" placeholder="Số miếng" value={pieces} onChange={(e) => setPieces(e.target.value)} disabled={!owner} />
      {owner ? (
        <Button
          size="sm"
          variant="outline"
          onClick={async () => {
            await savePieces({ data: { skuId: row.skuId, pieces: pieces.trim() === "" ? null : Number(pieces) } });
            toast.success("Đã lưu số miếng gói");
          }}
        >
          Lưu gói
        </Button>
      ) : null}
    </div>
  ) : null;

  return (
    <article className="grid gap-3 p-3 md:grid-cols-[3rem_7rem_minmax(0,1.2fr)_8rem_7rem_minmax(0,1fr)] md:items-center md:gap-2 md:px-3">
      <p className="hidden text-[13px] text-muted-foreground md:block">{stt}</p>
      <p className="font-semibold md:text-[13px]">
        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[12px]">{row.code}</span>
      </p>
      <div className="text-[13px]">
        <p className="font-medium">{row.name}</p>
        <p className="text-xs text-muted-foreground">Vốn {formatMaybe(row.sheetCost)}</p>
        {pack}
      </div>
      <div>
        <Input className="h-9 md:w-full" inputMode="numeric" value={price} placeholder="Chưa có" disabled={!owner} aria-label={`Giá ${row.name}`} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        {cell.listPrice != null && cell.listPrice !== cell.price ? (
          <p className="mt-1 text-xs text-muted-foreground">Niêm yết {formatMaybe(cell.listPrice)}</p>
        ) : null}
      </div>
      <p className="text-xs font-semibold">{margin}</p>
      <div className="flex gap-2">
        <select className="min-h-9 min-w-0 flex-1 rounded-md border bg-background px-2 text-[13px]" value={status} disabled={!owner} aria-label={`Trạng thái ${row.name}`} onChange={(e) => setStatus(e.target.value)}>
          <option value="dang_ban">Đang bán</option>
          <option value="nhap">Chưa có giá</option>
          <option value="cho_duyet">Chờ duyệt</option>
        </select>
        {owner ? (
          <Button className="min-h-9 shrink-0" onClick={save}>
            Lưu
          </Button>
        ) : null}
      </div>
    </article>
  );
}

function CreatePriceDialog({
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
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [sheets, setSheets] = useState("1");
  const [walkIn, setWalkIn] = useState("");
  const [facebook, setFacebook] = useState("");
  const [tiktok, setTiktok] = useState("");
  const [shopee, setShopee] = useState("");
  const [saving, setSaving] = useState(false);

  function digits(value: string) {
    return value.replace(/[^\d]/g, "");
  }

  async function save() {
    if (!width || !height || !sheets || !walkIn) {
      toast.error("Nhập rộng, cao, số tấm và giá tại tiệm.");
      return;
    }
    const prices: Partial<Record<Channel, number>> = {};
    if (walkIn) prices.tai_tiem = Number(walkIn);
    if (facebook) prices.facebook = Number(facebook);
    if (tiktok) prices.tiktok = Number(tiktok);
    if (shopee) prices.shopee = Number(shopee);
    setSaving(true);
    try {
      const result = await createPriceSize({
        data: {
          groupId,
          widthCm: Number(width),
          heightCm: Number(height),
          sheets: Number(sheets),
          prices,
        },
      });
      toast.success(result.created ? "Đã tạo khổ giá" : "Khổ này đã có, đã cập nhật giá");
      onOpenChange(false);
      setWidth("");
      setHeight("");
      setSheets("1");
      setWalkIn("");
      setFacebook("");
      setTiktok("");
      setShopee("");
      await queryClient.invalidateQueries({ queryKey: ["prices"] });
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Tạo khổ giá{groupName ? ` · ${groupName}` : ""}</DialogTitle>
        </DialogHeader>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className="text-sm font-semibold">
            Rộng (cm)
            <Input className="mt-1 min-h-11" inputMode="numeric" value={width} onChange={(event) => setWidth(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            Cao (cm)
            <Input className="mt-1 min-h-11" inputMode="numeric" value={height} onChange={(event) => setHeight(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            Số tấm
            <Input className="mt-1 min-h-11" inputMode="numeric" value={sheets} onChange={(event) => setSheets(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            Giá tại tiệm
            <Input className="mt-1 min-h-11" inputMode="numeric" value={walkIn} onChange={(event) => setWalkIn(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            Facebook
            <Input className="mt-1 min-h-11" inputMode="numeric" placeholder="Để trống nếu chưa có" value={facebook} onChange={(event) => setFacebook(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold">
            TikTok
            <Input className="mt-1 min-h-11" inputMode="numeric" placeholder="Để trống nếu chưa có" value={tiktok} onChange={(event) => setTiktok(digits(event.target.value))} />
          </label>
          <label className="text-sm font-semibold sm:col-span-2">
            Shopee
            <Input className="mt-1 min-h-11" inputMode="numeric" placeholder="Để trống nếu chưa có" value={shopee} onChange={(event) => setShopee(digits(event.target.value))} />
          </label>
        </div>
        <DialogFooter>
          <Button className="min-h-11" disabled={saving} onClick={() => void save()}>
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

function Calculator({ skus }: { skus: { skuId: string; code: string; name: string }[] }) {
  const [skuId, setSkuId] = useState("");
  const [channel, setChannel] = useState<Channel>("tiktok");
  useEffect(() => {
    if (!skus.some((sku) => sku.skuId === skuId)) setSkuId(skus[0]?.skuId ?? "");
  }, [skus, skuId]);
  const [price, setPrice] = useState("");
  const [affiliate, setAffiliate] = useState(false);
  const [result, setResult] = useState<Awaited<ReturnType<typeof runQuote>> | null>(null);

  async function run() {
    if (!skuId) return;
    try {
      const quote = await runQuote({
        data: { skuId, channel, price: price.trim() === "" ? null : Number(price), affiliate },
      });
      setResult(quote);
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  const tone =
    result?.tone === "red" ? "bg-destructive/15" : result?.tone === "yellow" ? "bg-accent/30" : result?.tone === "ok" ? "bg-emerald-100" : "bg-card";

  return (
    <section className="glass-card rounded-3xl p-5">
      <h2 className="text-lg font-bold text-primary">Máy tính giá</h2>
      <p className="text-sm text-muted-foreground">Lãi gộp = giá bán − vật tư − mực − phí kênh. Chưa đủ số thì không hiện lãi.</p>
      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <label className="text-sm font-semibold">
          Sản phẩm
          <select className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
            {skus.map((sku) => (
              <option key={sku.skuId} value={sku.skuId}>
                {sku.code} · {sku.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Kênh
          <select className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3" value={channel} onChange={(e) => setChannel(e.target.value as Channel)}>
            {CHANNELS.map((item) => (
              <option key={item} value={item}>
                {CHANNEL_LABEL[item]}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Giá bán (để trống = lấy bảng giá)
          <Input className="mt-1 min-h-12" value={price} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
        </label>
        <label className="flex min-h-12 items-center gap-2 text-sm font-semibold">
          <input type="checkbox" checked={affiliate} onChange={(e) => setAffiliate(e.target.checked)} />
          Có affiliate 10%
        </label>
      </div>
      <Button className="mt-3 min-h-12 bg-accent text-accent-foreground" onClick={run}>
        Tính lãi gộp
      </Button>
      {result ? (
        <div className={`mt-4 rounded-2xl p-4 ${tone}`}>
          <p className="text-sm">Giá bán: {formatMaybe(result.price)}</p>
          <p className="text-sm">Vật tư: {result.materialIncomplete ? "Chưa đủ số" : formatMaybe(result.material)}</p>
          <p className="text-sm">Mực: {formatMaybe(result.ink)}</p>
          <p className="text-sm">Phí kênh: {result.feesIncomplete ? "Chưa đủ số" : formatMaybe(result.fees)}</p>
          {result.shippingUnknown ? <p className="text-sm font-semibold">Phí ship Facebook chưa có số, chưa trừ vào lãi.</p> : null}
          <p className="mt-2 text-xl font-extrabold">
            {result.tone === "red" ? "LỖ · " : result.tone === "yellow" ? "Lãi thấp · " : ""}
            {result.profit === null ? "Chưa đủ số để tính lãi" : `${formatMaybe(result.profit)} (${result.marginPercent}%)`}
          </p>
          <ul className="mt-2 space-y-1 text-xs text-muted-foreground">
            {result.lines.map((line, index) => (
              <li key={`${line.name}-${index}`}>
                {line.name}: {line.amount === null ? "chưa có số" : formatMaybe(line.amount)} · {line.detail}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}

function BomEditor({ skus }: { skus: { skuId: string; code: string }[] }) {
  const [skuId, setSkuId] = useState("");
  const queryClient = useQueryClient();
  const bom = useQuery({
    queryKey: ["bom", skuId],
    queryFn: () => getBom({ data: { skuId } }),
    enabled: Boolean(skuId),
  });

  return (
    <section className="glass-card rounded-3xl p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-lg font-bold text-primary">Định mức vật tư</h2>
        <Button
          variant="outline"
          className="min-h-11"
          onClick={async () => {
            const result = await runRecalc();
            toast.success(`Đã tính lại ${result.changed} dòng định mức`);
            await queryClient.invalidateQueries({ queryKey: ["bom"] });
          }}
        >
          Tính lại từ công thức
        </Button>
      </div>
      <Label className="mt-3 block">SKU</Label>
      <select className="mt-1 min-h-12 w-full rounded-xl border bg-background px-3" value={skuId} onChange={(e) => setSkuId(e.target.value)}>
        <option value="">Chọn mã</option>
        {skus.map((sku) => (
          <option key={sku.skuId} value={sku.skuId}>
            {sku.code}
          </option>
        ))}
      </select>
      <ul className="mt-3 space-y-2">
        {(bom.data ?? []).map((line) => (
          <BomLine key={line.id} line={line} />
        ))}
      </ul>
    </section>
  );
}

function BomLine({ line }: { line: { id: string; materialName: string; unit: string; qty: number | null; phase: string; scope: string } }) {
  const [qty, setQty] = useState(line.qty === null ? "" : String(line.qty));
  return (
    <li className="flex flex-wrap items-center gap-2 rounded-2xl bg-background px-3 py-2 text-sm">
      <span className="min-w-40 font-semibold">{line.materialName}</span>
      <span className="text-muted-foreground">{line.phase === "print" ? "Khi in" : "Khi đóng gói"} · {line.scope === "sheet" ? "mỗi tấm" : "mỗi kiện"}</span>
      <Input className="h-10 w-28" value={qty} placeholder="Chưa có" onChange={(e) => setQty(e.target.value)} />
      <span>{line.unit}</span>
      <Button
        size="sm"
        variant="outline"
        onClick={async () => {
          await saveBomQty({ data: { bomId: line.id, qty: qty.trim() === "" ? null : Number(qty) } });
          toast.success("Đã lưu định mức");
        }}
      >
        Lưu
      </Button>
    </li>
  );
}
