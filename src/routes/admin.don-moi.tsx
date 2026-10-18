import { createFileRoute, Link, useRouter } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { OrderLinks } from "@/components/admin/sections";
import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { createDeskOrder, getCustomers, getMe, getSkuOptions } from "@/lib/admin.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";
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
  const catalog = (skus.data ?? []) as SkuOption[];
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
      className="space-y-4 pb-24 md:pb-0"
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
      <OrderLinks />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <Link to="/admin/don-hang" className="text-sm font-semibold text-muted-foreground">
            Quay lại
          </Link>
          <h1 className="text-2xl font-extrabold text-primary">Tạo đơn hàng mới</h1>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">Nhận đơn</span>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-6">
        <div className="space-y-4 lg:col-span-2">
          <section className="glass-card space-y-4 rounded-3xl p-4">
            <h2 className="text-base font-bold text-primary">Thông tin khách hàng</h2>
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
              <div className={fulfillment === "delivery" ? "md:col-span-2" : ""}>
                <Field label="Địa chỉ">
                  <Input className="min-h-11" value={address} required={fulfillment === "delivery"} onChange={(event) => setAddress(event.target.value)} />
                </Field>
              </div>
              {channel === "tiktok" || channel === "shopee" ? (
                <Field label="Mã đơn sàn">
                  <Input className="min-h-11" value={marketplaceCode} onChange={(event) => setMarketplaceCode(event.target.value)} />
                </Field>
              ) : null}
            </div>
            <Field label="Ghi chú">
              <Textarea value={note} placeholder="Ghi chú cho đơn hàng..." onChange={(event) => setNote(event.target.value)} />
            </Field>
          </section>

          <section className="glass-card space-y-3 rounded-3xl p-4">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-bold text-primary">Danh sách sản phẩm</h2>
              <Button type="button" variant="outline" className="min-h-11" onClick={() => setLines((current) => [...current, blankLine()])}>
                Thêm sản phẩm
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">Giá lấy theo kênh. Sale không sửa giá. Chủ sửa đơn giá ngay trên dòng.</p>
            <div className="hidden grid-cols-12 gap-2 border-b pb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground md:grid">
              <div className="col-span-1">STT</div>
              <div className="col-span-5">Sản phẩm</div>
              <div className="col-span-2 text-right">Đơn giá</div>
              <div className="col-span-2 text-center">SL</div>
              <div className="col-span-1 text-right">Thành tiền</div>
              <div className="col-span-1" />
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

        <aside className="lg:sticky lg:top-4 lg:self-start">
          <section className="glass-card space-y-3 rounded-3xl p-4">
            <h2 className="text-base font-bold text-primary">Thanh toán</h2>
            <dl className="space-y-2 text-sm">
              <Row label="Sản phẩm" value={String(chosen.length)} />
              <Row label="Tổng" value={total === null ? "Chưa đủ giá" : formatVnd(total)} strong />
              <Row label="Đã thu" value={paidAmount > 0 ? formatVnd(paidAmount) : "0đ"} />
              <Row label={remain !== null && remain < 0 ? "Dư tiền" : "Còn lại"} value={remain === null ? "—" : formatVnd(Math.abs(remain))} strong />
            </dl>
            <Field label="Thu lần 1">
              <Input className="min-h-11" inputMode="numeric" placeholder="Số tiền" value={deposit} onChange={(event) => setDeposit(event.target.value.replace(/[^\d]/g, ""))} />
            </Field>
            <div className="grid grid-cols-2 gap-2">
              {["Tiền mặt", "Chuyển khoản"].map((item) => (
                <button
                  key={item}
                  type="button"
                  aria-pressed={method === item}
                  className={`min-h-11 rounded-xl border text-sm font-semibold ${method === item ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background"}`}
                  onClick={() => setMethod(item)}
                >
                  {item}
                </button>
              ))}
            </div>
            {channel === "facebook" ? (
              <p className="text-xs text-muted-foreground">Đơn Facebook có thể cần cọc trước khi in. Số đã thu ghi ở đây, hoặc ghi thêm trên trang đơn.</p>
            ) : (
              <p className="text-xs text-muted-foreground">Có thể để trống. Cọc ghi thêm được sau khi mở đơn.</p>
            )}
            <Button type="submit" disabled={saving} className="hidden min-h-12 w-full bg-accent text-accent-foreground md:inline-flex">
              {saving ? "Đang lưu..." : "Lưu đơn hàng"}
            </Button>
          </section>
        </aside>
      </div>

      <div className="fixed inset-x-0 z-20 border-t border-border bg-card p-3 md:hidden bottom-[calc(4.25rem+env(safe-area-inset-bottom))]">
        <Button type="submit" disabled={saving} className="min-h-12 w-full bg-accent text-accent-foreground">
          {saving ? "Đang lưu..." : "Lưu đơn hàng"}
        </Button>
      </div>
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

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className={`flex items-center justify-between gap-3 ${strong ? "font-bold text-primary" : ""}`}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
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
    <article className="grid grid-cols-1 gap-2 rounded-2xl border border-border p-3 md:grid-cols-12 md:items-center md:rounded-none md:border-0 md:p-0">
      <div className="text-sm font-bold text-muted-foreground md:col-span-1">{index + 1}</div>
      <div className="space-y-1 md:col-span-5">
        <Input className="min-h-11" placeholder="Tìm mã hoặc tên" value={line.query} onChange={(event) => onQuery(event.target.value)} aria-label={`Tìm sản phẩm dòng ${index + 1}`} />
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
      </div>
      <div className="md:col-span-2 md:text-right">
        {owner ? (
          <Input
            className="min-h-11 md:text-right"
            inputMode="numeric"
            aria-label={`Đơn giá ${selected?.name ?? index + 1}`}
            placeholder={line.listed === null ? "Chưa có giá" : String(line.listed)}
            value={line.unitPrice}
            onChange={(event) => onPrice(event.target.value.replace(/[^\d]/g, ""))}
          />
        ) : (
          <p className="min-h-11 py-2 text-sm md:text-right">{line.unit === null ? "Chưa có giá" : formatVnd(line.unit)}</p>
        )}
      </div>
      <div className="flex items-center justify-center gap-1 md:col-span-2">
        <button type="button" className="min-h-11 min-w-11 rounded-xl border border-border" aria-label="Giảm số lượng" onClick={() => onQty(Math.max(1, line.quantity - 1))}>
          −
        </button>
        <Input
          className="min-h-11 w-16 text-center"
          type="number"
          min={1}
          max={500}
          aria-label={`Số lượng dòng ${index + 1}`}
          value={line.quantity}
          onChange={(event) => onQty(Math.min(500, Math.max(1, Number(event.target.value) || 1)))}
        />
        <button type="button" className="min-h-11 min-w-11 rounded-xl border border-border" aria-label="Tăng số lượng" onClick={() => onQty(Math.min(500, line.quantity + 1))}>
          +
        </button>
      </div>
      <p className="text-sm font-semibold md:col-span-1 md:text-right">{line.sku ? formatMaybe(line.lineTotal) : "—"}</p>
      <div className="md:col-span-1 md:text-right">
        {canRemove ? (
          <button type="button" className="min-h-11 text-sm font-semibold text-destructive" onClick={onRemove}>
            Xóa
          </button>
        ) : null}
      </div>
    </article>
  );
}
