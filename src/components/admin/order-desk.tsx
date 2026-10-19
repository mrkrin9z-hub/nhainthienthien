import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";
import { getCustomers } from "@/lib/admin.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";

const control = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

export type DeskSku = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  label: string;
  prices?: Partial<Record<Channel, number | null>>;
};

type Line = {
  key: string;
  skuId: string;
  query: string;
  quantity: number;
  unitPrice: string;
  priceTouched: boolean;
};

export type DeskSave = {
  channel: Channel;
  fullName: string;
  phone: string;
  address: string;
  fulfillment: "pickup" | "delivery";
  note: string;
  dueDate: string | null;
  marketplaceCode: string;
  depositPaid: number;
  depositMethod: string;
  items?: { skuId: string; quantity: number; unitPrice?: number }[];
};

function blankLine(): Line {
  return { key: crypto.randomUUID(), skuId: "", query: "", quantity: 1, unitPrice: "", priceTouched: false };
}

function digits(value: string): number {
  const clean = value.replace(/[^\d]/g, "");
  return clean ? Number(clean) : Number.NaN;
}

export function OrderDesk({
  mode,
  owner,
  fieldsLocked,
  itemsLocked,
  lockNote,
  catalog,
  initial,
  paidSoFar,
  onSave,
  onCollect,
}: {
  mode: "create" | "edit";
  owner: boolean;
  fieldsLocked: boolean;
  itemsLocked: boolean;
  lockNote: string;
  catalog: DeskSku[];
  initial: {
    channel: Channel;
    fullName: string;
    phone: string;
    address: string;
    fulfillment: "pickup" | "delivery";
    note: string;
    dueDate: string;
    marketplaceCode: string;
    lines: { key: string; skuId: string; quantity: number; unitPrice: string }[];
  };
  paidSoFar: number;
  onSave: (value: DeskSave) => Promise<void>;
  onCollect?: (amount: number, method: string) => Promise<void>;
}) {
  const [channel, setChannel] = useState<Channel>(initial.channel);
  const [fullName, setFullName] = useState(initial.fullName);
  const [phone, setPhone] = useState(initial.phone);
  const [address, setAddress] = useState(initial.address);
  const [fulfillment, setFulfillment] = useState(initial.fulfillment);
  const [note, setNote] = useState(initial.note);
  const [dueDate, setDueDate] = useState(initial.dueDate);
  const [marketplaceCode, setMarketplaceCode] = useState(initial.marketplaceCode);
  const [lines, setLines] = useState<Line[]>(
    initial.lines.length
      ? initial.lines.map((line) => ({ ...line, query: "", priceTouched: line.unitPrice !== "" }))
      : [blankLine()],
  );
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState(mode === "create" ? "Tiền mặt" : "chuyển khoản");
  const [saving, setSaving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const customers = useQuery({
    queryKey: ["order-customers", fullName],
    queryFn: () => getCustomers({ data: { q: fullName.trim(), includeCancelled: false } }),
    enabled: mode === "create" && fullName.trim().length >= 2,
  });

  const priced = useMemo(() => {
    return lines.map((line) => {
      const sku = catalog.find((item) => item.id === line.skuId);
      const listed = sku?.prices?.[channel] ?? null;
      const typed = digits(line.unitPrice);
      const unit = line.priceTouched && Number.isFinite(typed) ? typed : listed;
      const lineTotal = !sku || unit === null ? null : unit * line.quantity;
      return { ...line, sku, listed, unit, lineTotal };
    });
  }, [catalog, channel, lines]);
  const chosen = priced.filter((line) => line.sku);
  const goods = chosen.length > 0 && chosen.every((line) => line.lineTotal !== null) ? chosen.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) : null;
  const draftPaid = mode === "create" && Number.isFinite(digits(deposit)) ? digits(deposit) : 0;
  const paid = mode === "create" ? draftPaid : paidSoFar;
  const remain = goods === null ? null : goods - paid;
  const suggestions = (customers.data ?? []).slice(0, 6);

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseSku(key: string, skuId: string) {
    const sku = catalog.find((item) => item.id === skuId);
    const listed = sku?.prices?.[channel] ?? null;
    patchLine(key, { skuId, query: "", priceTouched: false, unitPrice: listed === null ? "" : String(listed) });
  }

  function changeChannel(next: Channel) {
    setChannel(next);
    setLines((current) =>
      current.map((line) => {
        if (line.priceTouched || !line.skuId) return line;
        const sku = catalog.find((item) => item.id === line.skuId);
        const listed = sku?.prices?.[next] ?? null;
        return { ...line, unitPrice: listed === null ? "" : String(listed) };
      }),
    );
  }

  async function save() {
    const items = priced
      .filter((line) => line.sku)
      .map((line) => ({
        skuId: line.skuId,
        quantity: line.quantity,
        ...(line.unit !== null ? { unitPrice: line.unit } : {}),
      }));
    if (!itemsLocked && !items.length) {
      toast.error("Chọn ít nhất một sản phẩm.");
      return;
    }
    setSaving(true);
    try {
      await onSave({
        channel,
        fullName,
        phone,
        address,
        fulfillment,
        note,
        dueDate: dueDate || null,
        marketplaceCode,
        depositPaid: draftPaid,
        depositMethod: draftPaid > 0 ? method : "",
        ...(itemsLocked ? {} : { items }),
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không lưu được đơn.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3"
      onSubmit={(event) => {
        event.preventDefault();
        if (fieldsLocked) return;
        void save();
      }}
    >
      <div className="space-y-4 xl:col-span-2">
        {lockNote ? <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{lockNote}</p> : null}
        <section className="space-y-4 rounded-md border bg-card p-4">
          <h2 className="text-base font-semibold">Thông tin khách hàng</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Kênh">
              {mode === "create" ? (
                <select className={control} value={channel} disabled={fieldsLocked} onChange={(event) => changeChannel(event.target.value as Channel)}>
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((item) => (
                    <option key={item} value={item}>
                      {CHANNEL_LABEL[item]}
                    </option>
                  ))}
                </select>
              ) : (
                <Input className="min-h-11" value={CHANNEL_LABEL[channel]} readOnly />
              )}
            </Field>
            <Field label="Nhận hàng">
              <select className={control} value={fulfillment} disabled={fieldsLocked} onChange={(event) => setFulfillment(event.target.value as "pickup" | "delivery")}>
                <option value="pickup">Tại tiệm</option>
                <option value="delivery">Giao hàng</option>
              </select>
            </Field>
            <div className="relative">
              <Field label="Khách">
                <Input
                  className="min-h-11"
                  value={fullName}
                  required
                  disabled={fieldsLocked}
                  autoComplete="name"
                  onFocus={() => setSuggestOpen(true)}
                  onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                  onChange={(event) => {
                    setFullName(event.target.value);
                    setSuggestOpen(true);
                  }}
                />
              </Field>
              {mode === "create" && suggestOpen && suggestions.length > 0 ? (
                <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-2xl border border-border bg-card p-1 shadow-lg">
                  {suggestions.map((customer) => (
                    <li key={customer.id}>
                      <button
                        type="button"
                        className="flex min-h-11 w-full flex-col items-start rounded-xl px-3 py-2 text-left hover:bg-muted"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setFullName(customer.name);
                          setPhone(customer.phone);
                          if (customer.address) setAddress(customer.address);
                          setSuggestOpen(false);
                        }}
                      >
                        <span className="font-semibold">{customer.name}</span>
                        <span className="text-xs text-muted-foreground">
                          {customer.phone}
                          {customer.address ? ` · ${customer.address}` : ""}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>
            <Field label="Số điện thoại">
              <Input className="min-h-11" value={phone} required disabled={fieldsLocked} inputMode="tel" autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
            </Field>
            <Field label="Hẹn giao">
              <Input className="min-h-11" type="date" value={dueDate} disabled={fieldsLocked} onChange={(event) => setDueDate(event.target.value)} />
            </Field>
            <Field label="Địa chỉ">
              <Input className="min-h-11" value={address} disabled={fieldsLocked} required={fulfillment === "delivery" && !fieldsLocked} onChange={(event) => setAddress(event.target.value)} />
            </Field>
            {channel === "tiktok" || channel === "shopee" ? (
              <Field label="Mã đơn sàn">
                <Input className="min-h-11" value={marketplaceCode} disabled={mode === "edit" || fieldsLocked} onChange={(event) => setMarketplaceCode(event.target.value)} />
              </Field>
            ) : null}
            <div className="md:col-span-2">
              <Field label="Ghi chú">
                <Textarea value={note} disabled={fieldsLocked} placeholder="Ghi chú cho đơn hàng..." onChange={(event) => setNote(event.target.value)} />
              </Field>
            </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">Danh sách sản phẩm</h2>
            {itemsLocked ? null : (
              <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}>
                <Plus className="mr-1 size-3" />
                Thêm sản phẩm
              </Button>
            )}
          </div>
          <div className="space-y-3">
            {priced.map((line, index) => (
              <ProductLine
                key={line.key}
                index={index}
                line={line}
                catalog={catalog}
                owner={owner}
                locked={itemsLocked}
                canRemove={!itemsLocked && lines.length > 1}
                onQuery={(query) => patchLine(line.key, { query })}
                onSku={(skuId) => chooseSku(line.key, skuId)}
                onQty={(quantity) => patchLine(line.key, { quantity })}
                onPrice={(unitPrice) => patchLine(line.key, { unitPrice, priceTouched: true })}
                onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
              />
            ))}
          </div>
        </section>
      </div>

      <aside className="space-y-3 rounded-md border bg-card p-4 xl:sticky xl:top-4">
        <h2 className="text-base font-semibold">Thanh toán</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Tạm tính</span>
            <span className="font-semibold">{goods === null ? "Chưa đủ giá" : formatVnd(goods)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã thu</span>
            <span className="font-medium">{formatVnd(paid)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{remain !== null && remain < 0 ? "Dư tiền" : "Còn lại"}</span>
            <span className="font-semibold">{remain === null ? "—" : formatVnd(Math.abs(remain))}</span>
          </div>
        </div>
        {mode === "create" ? (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Thu tiền lần 1</p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="Số tiền">
                  <Input inputMode="numeric" placeholder="Số tiền" value={deposit} disabled={fieldsLocked} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} />
                </Field>
              </div>
              <div className="w-36 shrink-0">
                <Field label="Nguồn thu">
                  <select className={control} value={method} disabled={fieldsLocked} onChange={(event) => setMethod(event.target.value)}>
                    <option>Tiền mặt</option>
                    <option>Chuyển khoản</option>
                  </select>
                </Field>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
            <p className="text-sm font-medium">Thu tiền</p>
            <div className="flex items-end gap-2">
              <div className="min-w-0 flex-1">
                <Field label="Số tiền">
                  <Input inputMode="numeric" placeholder="Số tiền" value={deposit} disabled={fieldsLocked || !onCollect} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} />
                </Field>
              </div>
              <div className="w-36 shrink-0">
                <Field label="Nguồn thu">
                  <select className={control} value={method} disabled={fieldsLocked || !onCollect} onChange={(event) => setMethod(event.target.value)}>
                    <option>chuyển khoản</option>
                    <option>tiền mặt</option>
                  </select>
                </Field>
              </div>
            </div>
            <Button
              type="button"
              className="w-full"
              disabled={fieldsLocked || !onCollect || collecting || !deposit}
              onClick={() => {
                if (!onCollect) return;
                setCollecting(true);
                void onCollect(Number(deposit), method)
                  .then(() => setDeposit(""))
                  .catch((error: unknown) => toast.error(error instanceof Error ? error.message : "Không ghi được tiền."))
                  .finally(() => setCollecting(false));
              }}
            >
              {collecting ? "Đang ghi…" : "Ghi nhận"}
            </Button>
          </div>
        )}
        <p className="text-[11px] text-muted-foreground">
          {fieldsLocked
            ? "Đơn sàn không thu thêm và không sửa giá trên web."
            : channel === "facebook"
              ? "Đơn Facebook có thể cần cọc trước khi in."
              : "Cọc có thể để trống, ghi thêm được sau khi mở đơn."}
        </p>
        <Button type="submit" className="w-full" disabled={saving || fieldsLocked}>
          {saving ? "Đang lưu..." : mode === "create" ? "Lưu đơn" : "Cập nhật"}
        </Button>
      </aside>
    </form>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Label className="block space-y-1 text-sm font-semibold">
      <span>{label}</span>
      {children}
    </Label>
  );
}

function ProductLine({
  index,
  line,
  catalog,
  owner,
  locked,
  canRemove,
  onQuery,
  onSku,
  onQty,
  onPrice,
  onRemove,
}: {
  index: number;
  line: Line & { sku?: DeskSku; listed: number | null; unit: number | null; lineTotal: number | null };
  catalog: DeskSku[];
  owner: boolean;
  locked: boolean;
  canRemove: boolean;
  onQuery: (query: string) => void;
  onSku: (skuId: string) => void;
  onQty: (quantity: number) => void;
  onPrice: (unitPrice: string) => void;
  onRemove: () => void;
}) {
  const query = line.query.trim().toLowerCase();
  const visible = catalog.filter((sku) => {
    if (!query || sku.id === line.skuId) return true;
    return `${sku.label} ${sku.code} ${sku.name}`.toLowerCase().includes(query);
  });
  const groups = new Map<string, DeskSku[]>();
  for (const sku of visible) {
    const name = sku.groupName || "Khác";
    const bucket = groups.get(name) ?? [];
    bucket.push(sku);
    groups.set(name, bucket);
  }

  return (
    <div className="rounded-lg border p-3">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium text-muted-foreground">Dòng {index + 1}</p>
        {canRemove ? (
          <Button type="button" size="icon" variant="ghost" aria-label="Xóa dòng" onClick={onRemove}>
            <Trash2 className="size-3" />
          </Button>
        ) : null}
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Field label="Tìm sản phẩm">
          <Input className="min-h-11" placeholder="Tìm mã hoặc tên" value={line.query} disabled={locked} onChange={(event) => onQuery(event.target.value)} aria-label={`Tìm sản phẩm dòng ${index + 1}`} />
        </Field>
        <Field label="Sản phẩm">
          <select className={control} value={line.skuId} disabled={locked} aria-label={`Sản phẩm dòng ${index + 1}`} onChange={(event) => onSku(event.target.value)}>
            <option value="">Chọn sản phẩm</option>
            {[...groups.entries()].map(([name, items]) => (
              <optgroup key={name} label={name}>
                {items.map((sku) => (
                  <option key={sku.id} value={sku.id}>
                    {sku.label}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 md:grid-cols-3">
        <Field label="Đơn giá">
          {owner && !locked ? (
            <Input
              className="min-h-11"
              inputMode="numeric"
              aria-label={`Đơn giá dòng ${index + 1}`}
              placeholder={line.listed === null ? "Chưa có giá" : String(line.listed)}
              value={line.unitPrice}
              onChange={(event) => onPrice(event.target.value.replace(/[^\d]/g, ""))}
            />
          ) : (
            <p className="flex min-h-11 items-center text-sm">{line.unit === null ? "Chưa có giá" : formatVnd(line.unit)}</p>
          )}
        </Field>
        <Field label="Số lượng">
          <Input
            className="min-h-11 text-center"
            type="number"
            min={1}
            max={500}
            disabled={locked}
            aria-label={`Số lượng dòng ${index + 1}`}
            value={line.quantity}
            onChange={(event) => onQty(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}
          />
        </Field>
        <Field label="Thành tiền">
          <p className="flex min-h-11 items-center text-sm font-semibold">{line.sku ? formatMaybe(line.lineTotal) : "—"}</p>
        </Field>
      </div>
    </div>
  );
}
