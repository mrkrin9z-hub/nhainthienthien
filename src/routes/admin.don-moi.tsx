import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeskOrder, getCustomers, getMe, getSkuOptions } from "@/lib/admin.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";
import { isMergedWoodAlias } from "@/domain/calc";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";

export const Route = createFileRoute("/admin/don-moi")({
  component: NewOrderPage,
});

const control = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";

type SkuOption = {
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

function blankLine(): Line {
  return { key: crypto.randomUUID(), skuId: "", query: "", quantity: 1, unitPrice: "", priceTouched: false };
}

function digits(value: string): number {
  const clean = value.replace(/[^\d]/g, "");
  return clean ? Number(clean) : Number.NaN;
}

function NewOrderPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <NewOrderBody />
    </RoleGate>
  );
}

function NewOrderBody() {
  const router = useRouter();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const skus = useQuery({ queryKey: ["sku-options"], queryFn: () => getSkuOptions() });
  const owner = me.data?.role === "owner";
  const catalog = ((skus.data ?? []) as SkuOption[]).filter((sku) => !isMergedWoodAlias(sku));
  const [channel, setChannel] = useState<Channel>("tai_tiem");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [fulfillment, setFulfillment] = useState<"pickup" | "delivery">("pickup");
  const [note, setNote] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [marketplaceCode, setMarketplaceCode] = useState("");
  const [lines, setLines] = useState<Line[]>([blankLine()]);
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState("Tiền mặt");
  const [saving, setSaving] = useState(false);
  const [suggestOpen, setSuggestOpen] = useState(false);
  const customers = useQuery({
    queryKey: ["order-customers", fullName],
    queryFn: () => getCustomers({ data: { q: fullName.trim(), includeCancelled: false } }),
    enabled: fullName.trim().length >= 2,
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
  const total = chosen.length > 0 && chosen.every((line) => line.lineTotal !== null) ? chosen.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) : null;
  const paid = digits(deposit);
  const paidAmount = Number.isFinite(paid) ? paid : 0;
  const remain = total === null ? null : total - paidAmount;

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function chooseSku(key: string, skuId: string) {
    const sku = catalog.find((item) => item.id === skuId);
    const listed = sku?.prices?.[channel] ?? null;
    patchLine(key, {
      skuId,
      query: "",
      priceTouched: false,
      unitPrice: listed === null ? "" : String(listed),
    });
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

  const suggestions = (customers.data ?? []).slice(0, 6);

  return (
    <form
      className="grid grid-cols-1 items-start gap-4 xl:grid-cols-3"
      onSubmit={async (event) => {
        event.preventDefault();
        const items = priced
          .filter((line) => line.sku)
          .map((line) => ({
            skuId: line.skuId,
            quantity: line.quantity,
            ...(owner && line.priceTouched && line.unit !== null ? { unitPrice: line.unit } : {}),
          }));
        if (!items.length) {
          toast.error("Chọn ít nhất một sản phẩm.");
          return;
        }
        setSaving(true);
        try {
          const result = await createDeskOrder({
            data: {
              channel,
              fullName,
              phone,
              address,
              fulfillment,
              note,
              dueDate: dueDate || null,
              marketplaceCode,
              depositPaid: paidAmount,
              depositMethod: paidAmount > 0 ? method : "",
              items,
            },
          });
          toast.success(`Đã tạo ${result.code}`);
          router.navigate({ to: "/admin/don-hang/$code", params: { code: result.code } });
        } catch (error) {
          toast.error((error as Error).message);
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="space-y-4 xl:col-span-2">
        <div>
          <Link to="/admin/don-hang" className="text-sm text-muted-foreground">
            Quay lại đơn hàng
          </Link>
          <h1 className="text-2xl font-bold">Tạo đơn mới</h1>
          <p className="text-sm text-muted-foreground">Khách, kênh và dòng sản phẩm. Giá lấy theo kênh. Sale không sửa giá. Trạng thái lúc tạo là Nhận đơn.</p>
        </div>

        <section className="space-y-4 rounded-md border bg-card p-4">
          <h2 className="text-base font-semibold">Thông tin khách hàng</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
              <Field label="Kênh">
                <select className={control} value={channel} onChange={(event) => changeChannel(event.target.value as Channel)}>
                  {(Object.keys(CHANNEL_LABEL) as Channel[]).map((item) => (
                    <option key={item} value={item}>
                      {CHANNEL_LABEL[item]}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Trạng thái">
                <Input className="min-h-11" value="Nhận đơn" readOnly />
              </Field>
              <div className="relative">
                <Field label="Khách">
                  <Input
                    className="min-h-11"
                    value={fullName}
                    required
                    autoComplete="name"
                    onFocus={() => setSuggestOpen(true)}
                    onBlur={() => window.setTimeout(() => setSuggestOpen(false), 150)}
                    onChange={(event) => {
                      setFullName(event.target.value);
                      setSuggestOpen(true);
                    }}
                  />
                </Field>
                {suggestOpen && suggestions.length > 0 ? (
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
                <Input className="min-h-11" value={phone} required inputMode="tel" autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
              </Field>
              <Field label="Nhận hàng">
                <select className={control} value={fulfillment} onChange={(event) => setFulfillment(event.target.value as "pickup" | "delivery")}>
                  <option value="pickup">Tại tiệm</option>
                  <option value="delivery">Giao hàng</option>
                </select>
              </Field>
              <Field label="Hẹn giao">
                <Input className="min-h-11" type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
              </Field>
              <div className={channel === "tiktok" || channel === "shopee" ? "" : "md:col-span-2"}>
                <Field label="Địa chỉ">
                  <Input className="min-h-11" value={address} required={fulfillment === "delivery"} onChange={(event) => setAddress(event.target.value)} />
                </Field>
              </div>
              {channel === "tiktok" || channel === "shopee" ? (
                <Field label="Mã đơn sàn">
                  <Input className="min-h-11" value={marketplaceCode} onChange={(event) => setMarketplaceCode(event.target.value)} />
                </Field>
              ) : null}
              <div className="md:col-span-2">
                <Field label="Ghi chú">
                  <Textarea value={note} placeholder="Ghi chú cho đơn hàng..." onChange={(event) => setNote(event.target.value)} />
                </Field>
              </div>
          </div>
        </section>

        <section className="rounded-md border bg-card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-base font-semibold">Danh sách sản phẩm</h2>
            <Button type="button" size="sm" variant="outline" onClick={() => setLines((current) => [...current, blankLine()])}>
              <Plus className="mr-1 size-3" />
              Thêm sản phẩm
            </Button>
          </div>
          <div className="space-y-3">
            {priced.map((line, index) => (
              <ProductLine
                key={line.key}
                index={index}
                line={line}
                catalog={catalog}
                owner={owner}
                canRemove={lines.length > 1}
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
            <span className="font-semibold">{total === null ? "Chưa đủ giá" : formatVnd(total)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Đã thu</span>
            <span className="font-medium">{formatVnd(paidAmount)}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{remain !== null && remain < 0 ? "Dư tiền" : "Còn lại"}</span>
            <span className="font-semibold">{remain === null ? "—" : formatVnd(Math.abs(remain))}</span>
          </div>
        </div>
        <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
          <p className="text-sm font-medium">Thu tiền lần 1</p>
          <div className="flex items-end gap-2">
            <div className="min-w-0 flex-1">
              <Field label="Số tiền">
                <Input inputMode="numeric" placeholder="Số tiền" value={deposit} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} />
              </Field>
            </div>
            <div className="w-36 shrink-0">
              <Field label="Nguồn thu">
                <select className={control} value={method} onChange={(event) => setMethod(event.target.value)}>
                  <option>Tiền mặt</option>
                  <option>Chuyển khoản</option>
                </select>
              </Field>
            </div>
          </div>
        </div>
        <p className="text-[11px] text-muted-foreground">
          {channel === "facebook" ? "Đơn Facebook có thể cần cọc trước khi in." : "Cọc có thể để trống, ghi thêm được sau khi mở đơn."}
        </p>
        <Button type="submit" className="w-full" disabled={saving}>
          {saving ? "Đang lưu..." : "Lưu đơn"}
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
  canRemove,
  onQuery,
  onSku,
  onQty,
  onPrice,
  onRemove,
}: {
  index: number;
  line: Line & { sku?: SkuOption; listed: number | null; unit: number | null; lineTotal: number | null };
  catalog: SkuOption[];
  owner: boolean;
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
  const groups = new Map<string, SkuOption[]>();
  for (const sku of visible) {
    const name = sku.groupName || "Khác";
    const bucket = groups.get(name) ?? [];
    bucket.push(sku);
    groups.set(name, bucket);
  }
  const selected = line.sku;

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
          <Input className="min-h-11" placeholder="Tìm mã hoặc tên" value={line.query} onChange={(event) => onQuery(event.target.value)} aria-label={`Tìm sản phẩm dòng ${index + 1}`} />
        </Field>
        <Field label="Sản phẩm">
          <select className={control} value={line.skuId} aria-label={`Sản phẩm dòng ${index + 1}`} onChange={(event) => onSku(event.target.value)}>
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
          {owner ? (
            <Input
              className="min-h-11"
              inputMode="numeric"
              aria-label={`Đơn giá ${selected?.name ?? index + 1}`}
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
