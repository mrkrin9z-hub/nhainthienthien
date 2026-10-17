import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatMaybe } from "@/lib/brand";
import { approvePrice, countStock, downloadExcel, getInventory, getMe, markInkOpened, receiveStock, saveMaterial } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/kho")({
  component: StockPage,
});

function StockPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const stock = useQuery({ queryKey: ["stock"], queryFn: () => getInventory() });
  const owner = me.data?.role === "owner";
  const canIn = me.data?.role === "owner" || me.data?.role === "sale";
  const queryClient = useQueryClient();

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Kho</h1>
          <p className="text-sm text-muted-foreground">Tồn đầu kỳ đang là 0. Đếm thực tế rồi nhập. Giá túi, carton, tem để trống.</p>
        </div>
        <div className="flex gap-2">
          <Button className="min-h-11" variant="outline" onClick={() => markInkOpened().then(() => refresh()).then(() => toast.success("Đã trừ 1 lọ mực"))}>
            Mở lọ mực mới
          </Button>
          {me.data && me.data.role !== "production" ? (
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              const file = await downloadExcel({ data: { kind: "stock", month: "all" } });
              download(file.filename, file.xml);
            }}
          >
            Xuất tồn
          </Button>
          ) : null}
        </div>
      </div>
      <div className="space-y-3">
        {(stock.data?.materials ?? []).map((material) => (
          <article key={material.id} className={`rounded-3xl border p-4 ${material.low ? "border-destructive bg-destructive/10" : "glass-card"}`}>
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div>
                <h2 className="font-bold text-primary">{material.name}</h2>
                <p className="text-sm text-muted-foreground">{material.buyLabel}</p>
              </div>
              <p className="text-xl font-extrabold">
                {material.stock} {material.unit}
              </p>
            </div>
            {owner ? (
              <p className="mt-1 text-sm">
                Giá mua: {material.packPrice === null ? "chưa có" : formatMaybe(material.packPrice)}
                {material.pendingPrice !== null ? ` · chờ duyệt ${formatMaybe(material.pendingPrice)}` : ""}
              </p>
            ) : null}
            {owner && material.pendingPrice !== null ? (
              <Button className="mt-2 min-h-11" onClick={() => approvePrice({ data: { materialId: material.id } }).then(refresh)}>
                Duyệt giá mua
              </Button>
            ) : null}
            <MaterialForms material={material} owner={owner} canIn={canIn} onDone={refresh} />
          </article>
        ))}
      </div>
      <section className="glass-card rounded-3xl p-4">
        <h2 className="font-bold text-primary">Nhập xuất gần đây</h2>
        <ul className="mt-2 space-y-1 text-sm">
          {(stock.data?.movements ?? []).slice(0, 20).map((move) => (
            <li key={move.id}>
              {move.materialName}: {move.qty} · {move.reason} {move.note}
            </li>
          ))}
          {(stock.data?.movements ?? []).length === 0 ? <li className="text-muted-foreground">Chưa có phiếu.</li> : null}
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
  material: { id: string; packPrice?: number | null; packSize?: number | null; minStock: number | null; supplier: string };
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

  return (
    <div className="mt-3 grid gap-2 md:grid-cols-2">
      {canIn ? (
        <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
          <Input className="h-12 w-full sm:w-20" value={packs} onChange={(e) => setPacks(e.target.value)} />
          <Input className="h-12 w-full sm:w-28" placeholder="Giá mua" value={price} onChange={(e) => setPrice(e.target.value)} />
          <Input className="col-span-2 h-12 w-full sm:col-span-1 sm:w-32" placeholder="Nơi mua" value={supplier} onChange={(e) => setSupplier(e.target.value)} />
          <Button
            className="min-h-11"
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
          className="min-h-11"
          onClick={async () => {
            await countStock({ data: { materialId: material.id, actual: Number(actual), note: "Kiểm kho" } });
            toast.success("Đã ghi kiểm kho");
            await onDone();
          }}
        >
          Ghi số đếm
        </Button>
      </div>
      {owner ? (
        <div className="flex flex-wrap gap-2 md:col-span-2">
          <Input className="h-11 w-32" placeholder="Giá / lần mua" value={packPrice} onChange={(e) => setPackPrice(e.target.value)} />
          <Input className="h-11 w-28" placeholder="Tồn tối thiểu" value={minStock} onChange={(e) => setMinStock(e.target.value)} />
          <Button
            variant="outline"
            className="min-h-11"
            onClick={async () => {
              await saveMaterial({
                data: {
                  materialId: material.id,
                  packPrice: packPrice.trim() === "" ? null : Number(packPrice),
                  packSize: material.packSize,
                  minStock: minStock.trim() === "" ? null : Number(minStock),
                  supplier,
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
