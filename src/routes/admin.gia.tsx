import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatMaybe } from "@/lib/brand";
import { getBom, getMe, getPriceBoard, runQuote, runRecalc, saveBomQty, savePieces, savePrice } from "@/lib/admin.functions";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";

export const Route = createFileRoute("/admin/gia")({
  component: PricePage,
});

const CHANNELS: Channel[] = ["tai_tiem", "facebook", "tiktok", "shopee"];

function PricePage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const [groupId, setGroupId] = useState("ep_go");
  const [channel, setChannel] = useState<Channel>("tai_tiem");
  const allowed = me.data?.role === "owner" || me.data?.role === "sale";
  const board = useQuery({
    queryKey: ["prices", groupId],
    queryFn: () => getPriceBoard({ data: { groupId } }),
    enabled: allowed,
  });
  const owner = me.data?.role === "owner";
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (me.data?.role === "production") return <p className="text-lg font-semibold text-primary">Chỉ chủ và sale xem bảng giá.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Bảng giá theo kênh</h1>
        <p className="text-sm text-muted-foreground">
          Web khách lấy giá kênh Tại tiệm / Web. Ô trống là chưa có số — không tự đặt giá.
        </p>
      </div>
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
      {(board.data?.warnings ?? []).length > 0 ? (
        <div className="rounded-2xl bg-accent/40 px-4 py-3 text-sm font-semibold text-foreground">
          {(board.data?.warnings ?? []).map((warning) => (
            <p key={warning}>{warning}</p>
          ))}
        </div>
      ) : null}
      <div className="overflow-x-auto rounded-3xl border border-border bg-card">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-3 py-3">Mã</th>
              <th className="px-3 py-3">Quy cách</th>
              <th className="px-3 py-3">Giá</th>
              <th className="px-3 py-3">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {(board.data?.rows ?? []).map((row) => (
              <PriceRow key={`${row.skuId}-${channel}`} row={row} channel={channel} owner={owner} />
            ))}
          </tbody>
        </table>
      </div>
      {owner ? <Calculator skus={board.data?.rows ?? []} /> : <p className="text-sm text-muted-foreground">Máy tính giá vốn và lãi chỉ chủ xem.</p>}
      {owner ? <BomEditor skus={board.data?.rows ?? []} /> : null}
    </div>
  );
}

function PriceRow({
  row,
  channel,
  owner,
}: {
  row: {
    skuId: string;
    code: string;
    name: string;
    piecesPerPack: number | null;
    prices: Record<string, { price: number | null; status: string; note: string }>;
  };
  channel: Channel;
  owner: boolean;
}) {
  const queryClient = useQueryClient();
  const cell = row.prices[channel] ?? { price: null, status: "dang_ban", note: "" };
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

  return (
    <tr className="border-t border-border">
      <td className="px-3 py-3 font-semibold">{row.code}</td>
      <td className="px-3 py-3">
        {row.name}
        {row.code.endsWith("-GOI") ? (
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
        ) : null}
      </td>
      <td className="px-3 py-3">
        <Input className="h-11 w-32" inputMode="numeric" value={price} placeholder="Chưa có" disabled={!owner} onChange={(e) => setPrice(e.target.value.replace(/[^\d]/g, ""))} />
      </td>
      <td className="px-3 py-3">
        <div className="flex gap-2">
          <select className="min-h-11 rounded-xl border bg-background px-2" value={status} disabled={!owner} onChange={(e) => setStatus(e.target.value)}>
            <option value="dang_ban">Đang bán</option>
            <option value="nhap">Nháp</option>
            <option value="cho_duyet">Chờ duyệt</option>
          </select>
          {owner ? (
            <Button className="min-h-11" onClick={save}>
              Lưu
            </Button>
          ) : null}
        </div>
      </td>
    </tr>
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
