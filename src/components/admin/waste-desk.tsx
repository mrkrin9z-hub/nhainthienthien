import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ClipboardCheck, MoreHorizontal, PackageSearch, TriangleAlert } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar, ToolbarButton } from "@/components/admin/page-toolbar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { WasteSlice } from "@/domain/waste";
import { formatMaybe } from "@/lib/brand";
import { approveDamage, closeDamageDay, countStock, editDamage, getWaste, reportDamage, voidDamage } from "@/lib/admin.functions";

const selectClass = "mt-1 min-h-12 w-full rounded-md border bg-background px-3 text-sm";

type WasteReasonId = "in_loi" | "lech_vien" | "bong_mang" | "rach" | "roi_vo" | "khac" | "chua_ro";

type WasteRow = {
  id: string;
  day: string;
  materialId: string;
  materialName: string;
  unit: string;
  qty: number;
  reason: WasteReasonId;
  reasonLabel: string;
  orderCode: string;
  channelLabel: string;
  byName: string;
  note: string;
  status: "pending" | "confirmed" | "approved" | "void";
  statusLabel: string;
  photoId: string | null;
  cost: number | null;
};

export function WasteDesk() {
  const desk = useQuery({ queryKey: ["waste"], queryFn: () => getWaste() });
  const queryClient = useQueryClient();
  const data = desk.data;
  const [reportOpen, setReportOpen] = useState(false);
  const [closeOpen, setCloseOpen] = useState(false);
  const [countOpen, setCountOpen] = useState(false);
  const [editRow, setEditRow] = useState<WasteRow | null>(null);
  const list = useListPage(data?.rows ?? [], String(data?.pending ?? 0));

  async function refresh() {
    await queryClient.invalidateQueries({ queryKey: ["waste"] });
    await queryClient.invalidateQueries({ queryKey: ["stock"] });
    await queryClient.invalidateQueries({ queryKey: ["profit"] });
    await queryClient.invalidateQueries({ queryKey: ["report"] });
    await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
  }

  return (
    <div className="space-y-4">
      <PageToolbar
        title="Báo hỏng"
        hint="Trừ kho ngay khi báo. Chốt ngày không trừ thêm. Hủy đơn không hoàn phiếu này."
        actions={
          <>
            <ToolbarButton label="Báo hỏng" icon={TriangleAlert} primary onClick={() => setReportOpen(true)} />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button type="button" className="inline-flex size-9 items-center justify-center rounded-md border" aria-label="Thêm thao tác">
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {data?.canClose ? (
                  <DropdownMenuItem onClick={() => setCloseOpen(true)}>
                    <ClipboardCheck className="mr-2 size-4" />
                    Chốt ngày
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuItem onClick={() => setCountOpen(true)}>
                  <PackageSearch className="mr-2 size-4" />
                  Kiểm kho
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </>
        }
      />
      {desk.isLoading ? <p className="text-muted-foreground">Đang tải…</p> : null}
      {desk.isError ? <p className="font-semibold text-destructive">{(desk.error as Error).message}</p> : null}
      {data ? (
        <>
          <p className="text-sm font-semibold">Chờ duyệt: {data.pending}</p>
          {data.showCost && data.summary.wasteAlert ? (
            <p className="text-sm font-semibold text-destructive">
              Hao hụt {data.summary.wasteRate}% doanh thu, vượt ngưỡng {data.summary.wasteThreshold}%.
            </p>
          ) : null}
          {data.showCost && data.summary.wasteUnknown > 0 ? (
            <p className="text-sm text-muted-foreground">{data.summary.wasteUnknown} phiếu chưa có giá mua, chưa tính vào tiền hao hụt.</p>
          ) : null}
          <section className="glass-card rounded-3xl p-4">
            <ListPager page={list.page} pages={list.pages} total={list.total} start={list.start} count={list.slice.length} noun="phiếu" onPage={list.setPage} />
            <ul className="mt-2 space-y-2">
              {list.slice.map((row) => (
                <li key={row.id} className={`rounded-xl border px-3 py-2 text-sm ${row.status === "approved" ? "" : "border-primary/40"}`}>
                  <p className="font-semibold">
                    {row.materialName}: {row.qty} {row.unit}
                  </p>
                  <p className="text-muted-foreground">
                    {row.day} · {row.reasonLabel} · {row.orderCode || "Không thuộc đơn"} · {row.channelLabel}
                    {row.byName ? ` · ${row.byName}` : ""} · {row.statusLabel}
                    {data.showCost ? ` · ${row.cost === null ? "chưa có giá" : formatMaybe(row.cost)}` : ""}
                  </p>
                  {row.note ? <p>{row.note}</p> : null}
                  {row.photoId ? (
                    <img src={`/api/staff/file/${row.photoId}?thumb=1&view=1`} alt={`Ảnh hỏng ${row.materialName}`} className="mt-2 h-16 w-16 rounded-md object-cover" />
                  ) : null}
                  {data.canApprove ? (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {row.status !== "approved" ? (
                        <Button
                          variant="outline"
                          className="min-h-11"
                          onClick={async () => {
                            try {
                              await approveDamage({ data: { id: row.id } });
                              toast.success("Đã duyệt");
                              await refresh();
                            } catch (error) {
                              toast.error(error instanceof Error ? error.message : "Không duyệt được.");
                            }
                          }}
                        >
                          Duyệt
                        </Button>
                      ) : null}
                      <Button variant="outline" className="min-h-11" onClick={() => setEditRow(row)}>
                        Sửa
                      </Button>
                    </div>
                  ) : null}
                </li>
              ))}
              {list.total === 0 ? <li className="text-muted-foreground">Chưa có phiếu hỏng.</li> : null}
            </ul>
          </section>
          <section className="glass-card rounded-3xl p-4">
            <h2 className="font-bold text-primary">Tháng {data.month}</h2>
            <p className="mt-1 text-sm">
              {data.summary.wasteLines} phiếu / {data.summary.placed} đơn
              {data.showCost ? ` · ${formatMaybe(data.summary.wasteCost)}` : ""}
              {data.showCost && data.summary.wasteRate !== null ? ` · ${data.summary.wasteRate}% doanh thu` : ""}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">Phiếu không gắn kênh tính vào Nhà In.</p>
            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <Groups title="Theo ngày" rows={data.summary.byDay} showCost={data.showCost} />
              <Groups title="Theo vật tư" rows={data.summary.byMaterial} showCost={data.showCost} />
              <Groups title="Theo lý do" rows={data.summary.byReason} showCost={data.showCost} />
              <Groups title="Theo người" rows={data.summary.byPerson} showCost={data.showCost} />
              <Groups title="Theo kênh" rows={data.summary.byChannel} showCost={data.showCost} />
            </div>
          </section>
          <ReportDialog
            open={reportOpen}
            day={data.day}
            materials={data.materials}
            orders={data.orders}
            reasons={data.reasons}
            onClose={() => setReportOpen(false)}
            onDone={refresh}
          />
          <CloseDialog open={closeOpen} day={data.day} pending={data.rows.filter((row) => row.day === data.day && row.status === "pending").length} onClose={() => setCloseOpen(false)} onDone={refresh} />
          <CountDialog open={countOpen} materials={data.materials} onClose={() => setCountOpen(false)} onDone={refresh} />
          <EditDialog row={editRow} materials={data.materials} reasons={data.reasons} onClose={() => setEditRow(null)} onDone={refresh} />
        </>
      ) : null}
    </div>
  );
}

function Groups({ title, rows, showCost }: { title: string; rows: WasteSlice[]; showCost: boolean }) {
  return (
    <div>
      <h3 className="text-sm font-semibold">{title}</h3>
      <ul className="mt-1 text-sm">
        {rows.slice(0, 6).map((row) => (
          <li key={row.key}>
            {row.label}: {row.lines} · {row.qty}
            {showCost ? ` · ${formatMaybe(row.cost)}` : ""}
          </li>
        ))}
        {rows.length === 0 ? <li className="text-muted-foreground">Chưa có.</li> : null}
      </ul>
    </div>
  );
}

function ReportDialog({
  open,
  day,
  materials,
  orders,
  reasons,
  onClose,
  onDone,
}: {
  open: boolean;
  day: string;
  materials: { id: string; name: string; unit: string; stock: number }[];
  orders: { id: string; code: string; channelLabel: string; customerName: string }[];
  reasons: { id: string; label: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [orderId, setOrderId] = useState("");
  const [materialId, setMaterialId] = useState("");
  const [qty, setQty] = useState("1");
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setOrderId("");
    setMaterialId("");
    setQty("1");
    setReason("");
    setNote("");
    setFile(null);
  }, [open]);

  async function submit() {
    const amount = Number(qty);
    if (!materialId) return toast.error("Chọn vật tư.");
    if (!(amount > 0)) return toast.error("Số lượng phải lớn hơn 0.");
    if (!reason) return toast.error("Chọn lý do.");
    setSaving(true);
    try {
      let photoBase64 = "";
      let photoName = "";
      let photoMime = "";
      if (file) {
        photoBase64 = await fileToBase64(file);
        photoName = file.name;
        photoMime = file.type || "image/jpeg";
      }
      await reportDamage({
        data: {
          materialId,
          qty: amount,
          reason: reason as "in_loi",
          orderId: orderId || null,
          note,
          ...(photoBase64 ? { photoName, photoMime, photoBase64 } : {}),
        },
      });
      toast.success(`Đã trừ kho ngày ${day}`);
      setNote("");
      setFile(null);
      onClose();
      await onDone();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không ghi được.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Báo hỏng</DialogTitle>
        </DialogHeader>
        <label className="text-sm font-semibold">
          Đơn
          <select className={selectClass} aria-label="Đơn hàng" value={orderId} onChange={(event) => setOrderId(event.target.value)}>
            <option value="">Không thuộc đơn</option>
            {orders.map((order) => (
              <option key={order.id} value={order.id}>
                {order.code} · {order.channelLabel}
                {order.customerName ? ` · ${order.customerName}` : ""}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Vật tư
          <select className={selectClass} aria-label="Vật tư" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            <option value="">Chọn vật tư</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · tồn {material.stock} {material.unit}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Số lượng
          <Input className="mt-1 min-h-12" inputMode="decimal" aria-label="Số lượng hỏng" value={qty} onChange={(event) => setQty(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Lý do
          <select className={selectClass} aria-label="Lý do hỏng" value={reason} onChange={(event) => setReason(event.target.value)}>
            <option value="">Chọn lý do</option>
            {reasons.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Ghi chú
          <Textarea className="mt-1" aria-label="Ghi chú hỏng" value={note} onChange={(event) => setNote(event.target.value)} />
        </label>
        <label className="text-sm font-semibold">
          Ảnh, không bắt buộc
          <Input className="mt-1 min-h-12" type="file" accept="image/*" capture="environment" aria-label="Ảnh hỏng" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <Button className="min-h-12" disabled={saving} onClick={() => void submit()}>
          Ghi hao hụt
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CloseDialog({
  open,
  day,
  pending,
  onClose,
  onDone,
}: {
  open: boolean;
  day: string;
  pending: number;
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [saving, setSaving] = useState(false);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Chốt ngày {day}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Phiếu mới báo hôm nay: {pending}. Thêm phiếu thiếu bằng Báo hỏng trước khi chốt. Chốt không trừ kho thêm.</p>
        <Button
          className="min-h-12"
          disabled={saving}
          onClick={async () => {
            setSaving(true);
            try {
              await closeDamageDay({ data: { day } });
              toast.success("Đã chốt danh sách");
              onClose();
              await onDone();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Không chốt được.");
            } finally {
              setSaving(false);
            }
          }}
        >
          Chốt danh sách hôm nay
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function CountDialog({
  open,
  materials,
  onClose,
  onDone,
}: {
  open: boolean;
  materials: { id: string; name: string; unit: string; stock: number }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [materialId, setMaterialId] = useState("");
  const [actual, setActual] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => {
    if (!open) return;
    setMaterialId("");
    setActual("");
  }, [open]);
  return (
    <Dialog open={open} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Kiểm kho</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">Thiếu so với sổ thì ghi một phiếu hao hụt chưa rõ lý do. Khớp sổ thì không trừ thêm.</p>
        <label className="text-sm font-semibold">
          Vật tư
          <select className={selectClass} aria-label="Vật tư kiểm kho" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
            <option value="">Chọn vật tư</option>
            {materials.map((material) => (
              <option key={material.id} value={material.id}>
                {material.name} · sổ {material.stock} {material.unit}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-semibold">
          Số đếm được
          <Input className="mt-1 min-h-12" inputMode="decimal" aria-label="Số đếm được" value={actual} onChange={(event) => setActual(event.target.value)} />
        </label>
        <Button
          className="min-h-12"
          disabled={saving}
          onClick={async () => {
            if (!materialId) return toast.error("Chọn vật tư.");
            const counted = Number(actual);
            if (!Number.isFinite(counted) || counted < 0) return toast.error("Số đếm không hợp lệ.");
            setSaving(true);
            try {
              await countStock({ data: { materialId, actual: counted, note: "Kiểm kho" } });
              toast.success("Đã ghi kiểm kho");
              onClose();
              await onDone();
            } catch (error) {
              toast.error(error instanceof Error ? error.message : "Không ghi được.");
            } finally {
              setSaving(false);
            }
          }}
        >
          Ghi số đếm
        </Button>
      </DialogContent>
    </Dialog>
  );
}

function EditDialog({
  row,
  materials,
  reasons,
  onClose,
  onDone,
}: {
  row: WasteRow | null;
  materials: { id: string; name: string; unit: string; stock: number }[];
  reasons: { id: string; label: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  return (
    <Dialog open={Boolean(row)} onOpenChange={(next) => (next ? undefined : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Sửa phiếu hỏng</DialogTitle>
        </DialogHeader>
        {row ? <EditForm key={row.id} row={row} materials={materials} reasons={reasons} onClose={onClose} onDone={onDone} /> : null}
      </DialogContent>
    </Dialog>
  );
}

function EditForm({
  row,
  materials,
  reasons,
  onClose,
  onDone,
}: {
  row: WasteRow;
  materials: { id: string; name: string; unit: string; stock: number }[];
  reasons: { id: string; label: string }[];
  onClose: () => void;
  onDone: () => Promise<void>;
}) {
  const [materialId, setMaterialId] = useState(row.materialId);
  const [qty, setQty] = useState(String(row.qty));
  const [reason, setReason] = useState(row.reason);
  const [note, setNote] = useState(row.note);
  const [saving, setSaving] = useState(false);
  const options = row.reason === "chua_ro" ? [{ id: "chua_ro", label: "Hao hụt chưa rõ lý do" }, ...reasons] : reasons;

  return (
    <>
      <label className="text-sm font-semibold">
        Vật tư
        <select className={selectClass} aria-label="Vật tư phiếu hỏng" value={materialId} onChange={(event) => setMaterialId(event.target.value)}>
          {materials.map((material) => (
            <option key={material.id} value={material.id}>
              {material.name}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Số lượng
        <Input className="mt-1 min-h-12" inputMode="decimal" aria-label="Số lượng sửa" value={qty} onChange={(event) => setQty(event.target.value)} />
      </label>
      <label className="text-sm font-semibold">
        Lý do
        <select className={selectClass} aria-label="Lý do sửa" value={reason} onChange={(event) => setReason(event.target.value as WasteReasonId)}>
          {options.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>
      <label className="text-sm font-semibold">
        Ghi chú
        <Textarea className="mt-1" aria-label="Ghi chú sửa" value={note} onChange={(event) => setNote(event.target.value)} />
      </label>
      <Button
        className="min-h-12"
        disabled={saving}
        onClick={async () => {
          const amount = Number(qty);
          if (!(amount > 0)) return toast.error("Số lượng phải lớn hơn 0.");
          setSaving(true);
          try {
            await editDamage({ data: { id: row.id, qty: amount, reason, materialId, note } });
            toast.success("Đã sửa phiếu");
            onClose();
            await onDone();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Không sửa được.");
          } finally {
            setSaving(false);
          }
        }}
      >
        Lưu
      </Button>
      <Button
        variant="outline"
        className="min-h-12"
        disabled={saving}
        onClick={async () => {
          setSaving(true);
          try {
            await voidDamage({ data: { id: row.id } });
            toast.success("Đã hủy phiếu và trả kho");
            onClose();
            await onDone();
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Không hủy được.");
          } finally {
            setSaving(false);
          }
        }}
      >
        Hủy phiếu
      </Button>
    </>
  );
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      const comma = result.indexOf(",");
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Không đọc được ảnh."));
    reader.readAsDataURL(file);
  });
}
