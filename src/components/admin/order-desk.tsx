import { useQuery } from "@tanstack/react-query";
import { MapPin, Minus, Phone, Plus, Trash2, UserRound } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { ProductPickerDialog } from "@/components/admin/product-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { MoneyInput } from "@/components/ui/money-input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { lineAmountAfterDiscount } from "@/domain/calc";
import { vnYmd } from "@/domain/calc";
import { addSkusToLines, normalizeDeskDiscount, normalizeDeskLines, skuTitle } from "@/domain/desk-lines";
import { minTotalForChannel, retargetLinesForChannel } from "@/domain/desk-pricing";
import { skuSoldOn } from "@/domain/mohome";
import { depositMethodLabel, isMarketplace, PAYMENT_METHODS, RETAIL_PAYMENT_METHODS, type PaymentMethod } from "@/domain/order-desk";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";
import { getCustomers } from "@/lib/admin.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";

const control = "min-h-11 w-full rounded-xl border border-input bg-background px-3 text-sm";
const card = "space-y-3 rounded-2xl border border-border/70 bg-card p-4 shadow-sm";

export type DeskSku = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  label: string;
  prices?: Partial<Record<Channel, number | null>>;
  minTotals?: Partial<Record<Channel, number | null>>;
  soldOn?: Channel[];
};

type Line = {
  key: string;
  skuId: string;
  query: string;
  quantity: number;
  unitPrice: string;
  priceTouched: boolean;
  variant: string;
  discount: string;
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
  discount: number | null;
  customerShip: number | null;
  shipBy?: string | null;
  autoCancelAt?: string | null;
  paymentMethod?: PaymentMethod;
  netAmount?: number | null;
  designFileUrl?: string | null;
  albumId?: string | null;
  items?: { skuId: string; quantity: number; variant?: string; unitPrice?: number; discount?: number; priceReason?: string }[];
};

function blankLine(): Line {
  return { key: crypto.randomUUID(), skuId: "", query: "", quantity: 1, unitPrice: "", priceTouched: false, variant: "", discount: "" };
}

function localIso(value: string): string | null {
  if (!value) return null;
  const at = new Date(value);
  return Number.isNaN(at.getTime()) ? null : at.toISOString();
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
  channelOptions,
  retail = false,
  albumId = null,
  initial,
  paidSoFar,
  payments = [],
  transfer = null,
  onSave,
  onCollect,
}: {
  mode: "create" | "edit";
  owner: boolean;
  fieldsLocked: boolean;
  itemsLocked: boolean;
  lockNote: string;
  catalog: DeskSku[];
  channelOptions?: { id: Channel; label: string }[];
  /** Khách lẻ: form ngắn. TikTok và Shopee không tạo tay. */
  retail?: boolean;
  /** Album ảnh gắn vào đơn khi lưu (từ quản lý hình ảnh). */
  albumId?: string | null;
  initial: {
    channel: Channel;
    fullName: string;
    phone: string;
    address: string;
    fulfillment: "pickup" | "delivery";
    note: string;
    dueDate: string;
    marketplaceCode: string;
    discount?: number | null;
    customerShip?: number | null;
    shipBy?: string;
    designFileUrl?: string;
    paymentMethod?: PaymentMethod;
    lines: { key: string; skuId: string; quantity: number; unitPrice: string; variant?: string; discount?: number | string | null }[];
  };
  paidSoFar: number;
  payments?: { at: string; amount: number; method: string; byName: string }[];
  transfer?: { image: string; content: string; bank: string; holder: string; amount: number } | null;
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
  const [discount, setDiscount] = useState(initial.discount == null ? "" : String(initial.discount));
  const [customerShip, setCustomerShip] = useState(initial.customerShip == null ? "" : String(initial.customerShip));
  const [priceReason, setPriceReason] = useState("");
  const [marketplaceCode, setMarketplaceCode] = useState(initial.marketplaceCode);
  const [shipBy, setShipBy] = useState(initial.shipBy ?? "");
  const [commercePay, setCommercePay] = useState<PaymentMethod>(
    initial.paymentMethod || (mode === "create" ? "tien_mat" : ""),
  );
  const [netAmount, setNetAmount] = useState("");
  const [designFileUrl, setDesignFileUrl] = useState(initial.designFileUrl ?? "");
  const [lines, setLines] = useState<Line[]>(
    initial.lines.length
      ? normalizeDeskLines(initial.lines)
      : mode === "create"
        ? []
        : [blankLine()],
  );
  const [deposit, setDeposit] = useState("");
  const [method, setMethod] = useState(mode === "create" ? "Tiền mặt" : "chuyển khoản");
  const [saving, setSaving] = useState(false);
  const [collecting, setCollecting] = useState(false);
  const payChoices = retail ? RETAIL_PAYMENT_METHODS : PAYMENT_METHODS;
  const isCodPay = commercePay === "cod";
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const customers = useQuery({
    queryKey: ["order-customers", fullName],
    queryFn: () => getCustomers({ data: { q: fullName.trim(), includeCancelled: false } }),
    enabled: mode === "create" && fullName.trim().length >= 2,
  });

  /** Form khách lẻ gọn như lúc tạo — ẩn địa chỉ khi lấy tại xưởng, nhãn ngắn. */
  const compact = retail;
  const channelList =
    channelOptions?.length
      ? channelOptions
      : retail && mode === "create"
        ? [
            { id: "tai_tiem" as const, label: "Trực tiếp" },
            { id: "facebook" as const, label: "Facebook" },
          ]
        : (Object.keys(CHANNEL_LABEL) as Channel[]).map((id) => ({ id, label: CHANNEL_LABEL[id] }));
  const safeCatalog = Array.isArray(catalog) ? catalog : [];
  const sellable = useMemo(
    () => safeCatalog.filter((sku) => skuSoldOn(sku, channel)),
    [safeCatalog, channel],
  );

  const priced = useMemo(() => {
    return lines.map((line) => {
      const sku = safeCatalog.find((item) => item.id === line.skuId);
      const listed = sku?.prices?.[channel] ?? null;
      const typed = digits(line.unitPrice);
      const unit = line.priceTouched && Number.isFinite(typed) ? typed : listed;
      const discountText = normalizeDeskDiscount(line.discount);
      const cut = discountText === "" ? 0 : digits(discountText);
      const lineTotal =
        !sku || unit === null
          ? null
          : lineAmountAfterDiscount(unit, line.quantity, minTotalForChannel(sku, channel), Number.isFinite(cut) ? cut : 0);
      return { ...line, sku, listed, unit, lineTotal };
    });
  }, [safeCatalog, channel, lines]);
  const chosen = priced.filter((line) => line.sku);
  const goods = chosen.length > 0 && chosen.every((line) => line.lineTotal !== null) ? chosen.reduce((sum, line) => sum + (line.lineTotal ?? 0), 0) : null;
  const draftPaid = mode === "create" && Number.isFinite(digits(deposit)) ? digits(deposit) : 0;
  const paid = mode === "create" ? draftPaid : paidSoFar;
  const discountAmount = discount.trim() === "" ? 0 : digits(discount);
  const shipAmount = customerShip.trim() === "" ? 0 : digits(customerShip);
  const remain = goods === null || !Number.isFinite(discountAmount) || !Number.isFinite(shipAmount) ? null : goods - discountAmount + shipAmount - paid;
  const suggestions = (customers.data ?? []).slice(0, 6);

  function patchLine(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)));
  }

  function addSkus(skuIds: string[]) {
    setLines((current) => addSkusToLines(current, skuIds, safeCatalog, channel, () => crypto.randomUUID()) as Line[]);
  }

  function changeChannel(next: Channel) {
    setChannel(next);
    if (isMarketplace(next)) setFulfillment("delivery");
    setLines((current) => retargetLinesForChannel(current, safeCatalog, next));
  }

  async function save() {
    const items = priced
      .filter((line) => line.sku)
      .map((line) => ({
        skuId: line.skuId,
        quantity: line.quantity,
        variant: line.variant.trim(),
        ...(line.unit !== null ? { unitPrice: line.unit, ...(line.priceTouched ? { priceReason } : {}) } : {}),
        ...(digits(normalizeDeskDiscount(line.discount)) > 0 ? { discount: digits(normalizeDeskDiscount(line.discount)) } : { discount: 0 }),
      }));
    // Cho phép tạo đơn không sản phẩm để lấy mã QR gửi ảnh trước.
    if (priced.some((line) => line.priceTouched) && !priceReason.trim()) {
      toast.error("Sửa giá cần ghi lý do.");
      return;
    }
    if (mode === "create" && !commercePay) {
      toast.error("Chọn hình thức thanh toán.");
      return;
    }
    const payLabel = depositMethodLabel(commercePay);
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
        depositPaid: isCodPay ? 0 : draftPaid,
        depositMethod: isCodPay || draftPaid <= 0 ? "" : payLabel || method,
        discount: discount.trim() === "" ? null : digits(discount),
        customerShip: customerShip.trim() === "" ? null : digits(customerShip),
        shipBy: localIso(shipBy),
        autoCancelAt: null,
        paymentMethod: commercePay,
        netAmount: netAmount.trim() === "" ? null : digits(netAmount),
        designFileUrl: designFileUrl.trim() || null,
        albumId: albumId || null,
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
        {lockNote ? <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">{lockNote}</p> : null}

        <section className={card}>
          <h2 className="text-base font-bold">Thông tin khách hàng</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Field label="Kênh cửa hàng" required>
              {mode === "create" ? (
                <select className={control} value={channel} disabled={fieldsLocked} onChange={(event) => changeChannel(event.target.value as Channel)}>
                  {channelList.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              ) : (
                <Input className="min-h-11" value={CHANNEL_LABEL[channel]} readOnly />
              )}
            </Field>
            <Field label="Nhận hàng">
              {isMarketplace(channel) ? (
                <Input className="min-h-11" value="Nhãn sàn" readOnly />
              ) : (
                <select
                  className={control}
                  value={fulfillment}
                  disabled={fieldsLocked}
                  onChange={(event) => {
                    const next = event.target.value as "pickup" | "delivery";
                    setFulfillment(next);
                    if (next === "pickup") setAddress("");
                  }}
                >
                  <option value="pickup">Lấy tại xưởng</option>
                  <option value="delivery">{compact ? "Giao" : "Tự giao"}</option>
                </select>
              )}
            </Field>
            <div className="relative md:col-span-2">
              <Field label="Khách hàng" required icon={<UserRound className="size-3.5" />}>
                <Input
                  className="min-h-11"
                  value={fullName}
                  required
                  disabled={fieldsLocked}
                  autoComplete="name"
                  placeholder="Nhập tên hoặc SĐT khách hàng…"
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
            <Field label="Số điện thoại" required icon={<Phone className="size-3.5" />}>
              <Input className="min-h-11" value={phone} required disabled={fieldsLocked} inputMode="tel" autoComplete="tel" onChange={(event) => setPhone(event.target.value)} />
            </Field>
            {compact && fulfillment !== "delivery" ? null : (
            <div className="md:col-span-2">
              <Field label="Địa chỉ" icon={<MapPin className="size-3.5" />}>
                <Input className="min-h-11" value={address} disabled={fieldsLocked} required={fulfillment === "delivery" && !fieldsLocked} onChange={(event) => setAddress(event.target.value)} />
              </Field>
            </div>
            )}
            {channel === "tiktok" || channel === "shopee" ? (
              <Field label="Mã đơn sàn">
                <Input className="min-h-11" value={marketplaceCode} disabled={mode === "edit" || fieldsLocked} onChange={(event) => setMarketplaceCode(event.target.value)} />
              </Field>
            ) : null}
          </div>
        </section>

        <section className={card}>
          <h2 className="text-base font-bold">Ghi chú</h2>
          <Field label="Ghi chú">
            <Textarea className="min-h-28" value={note} disabled={fieldsLocked} placeholder="Ghi chú cho đơn hàng…" onChange={(event) => setNote(event.target.value)} />
          </Field>
          {priced.some((line) => line.priceTouched) ? (
            <Field label="Lý do sửa giá">
              <Input className="min-h-11" value={priceReason} onChange={(event) => setPriceReason(event.target.value)} placeholder="Chỉ chủ sửa giá, và phải ghi lý do" />
            </Field>
          ) : null}
        </section>

        <section className={card}>
          <div className="mb-1 flex items-center justify-between gap-2">
            <h2 className="text-base font-bold">Danh sách sản phẩm</h2>
          </div>
          {priced.length === 0 ? (
            <div className="rounded-xl border border-dashed px-3 py-10 text-center">
              <p className="text-sm text-muted-foreground">
                {mode === "create"
                  ? "Có thể lưu đơn trống để lấy mã QR gửi ảnh trước, rồi thêm sản phẩm sau."
                  : "Chưa có sản phẩm trong đơn."}
              </p>
              {itemsLocked ? null : (
                <Button type="button" className="mt-3 w-full" onClick={() => setPickerOpen(true)}>
                  <Plus className="mr-1 size-4" />
                  Thêm sản phẩm
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {priced.map((line, index) => (
                <ProductLine
                  key={line.key}
                  index={index}
                  line={line}
                  owner={owner}
                  locked={itemsLocked}
                  canRemove={!itemsLocked}
                  onQty={(quantity) => patchLine(line.key, { quantity })}
                  onPrice={(unitPrice) => patchLine(line.key, { unitPrice, priceTouched: true })}
                  onVariant={(variant) => patchLine(line.key, { variant })}
                  onDiscount={(discount) => patchLine(line.key, { discount })}
                  onRemove={() => setLines((current) => current.filter((item) => item.key !== line.key))}
                />
              ))}
              {itemsLocked ? null : (
                <Button type="button" variant="outline" className="w-full" onClick={() => setPickerOpen(true)}>
                  <Plus className="mr-1 size-4" />
                  Thêm sản phẩm
                </Button>
              )}
            </div>
          )}
          {itemsLocked ? null : (
            <ProductPickerDialog open={pickerOpen} onOpenChange={setPickerOpen} catalog={sellable} channel={channel} onConfirm={addSkus} />
          )}
          <div className="space-y-2 border-t pt-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">Tạm tính</span>
              <span className="font-semibold">{goods === null ? "Chưa đủ giá" : formatVnd(goods)}</span>
            </div>
            {fieldsLocked ? null : (
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Giảm giá</span>
                <MoneyInput className="h-9 w-32 text-right" value={discount} placeholder="0" aria-label="Giảm giá" onValueChange={(value) => setDiscount(value == null ? "" : String(value))} />
              </label>
            )}
            <div className="flex items-center justify-between border-t pt-2">
              <span className="font-semibold">Tổng</span>
              <span className="font-semibold">{goods === null ? "—" : formatVnd(Math.max(0, goods - (Number.isFinite(discountAmount) ? discountAmount : 0)))}</span>
            </div>
          </div>
        </section>
      </div>

      <aside className="space-y-4 xl:sticky xl:top-4">
        <section className={card}>
          <h2 className="text-base font-bold">Lịch trình đơn hàng</h2>
          <Field label="Ngày hẹn giao / nhận" required={mode === "create" && !compact}>
            <Input className="min-h-11" type="date" min={vnYmd()} value={dueDate} disabled={fieldsLocked} onChange={(event) => setDueDate(event.target.value)} />
          </Field>
          <p className="text-xs text-muted-foreground">
            {isMarketplace(channel) ? "Đơn sàn in nhãn của TikTok hoặc Shopee." : fulfillment === "delivery" ? "Tự giao — cần địa chỉ khách." : "Khách lấy tại xưởng."}
          </p>
          {fieldsLocked ? null : (
            <div className="space-y-3">
              <Field label="Hạn gửi">
                <Input className="min-h-11" type="datetime-local" value={shipBy} disabled={fieldsLocked} onChange={(event) => setShipBy(event.target.value)} />
              </Field>
              {retail ? null : (
                <Field label="Thực nhận ước tính">
                  <MoneyInput className="min-h-11" value={netAmount} disabled={fieldsLocked} placeholder="Để trống thì tự tính" onValueChange={(value) => setNetAmount(value == null ? "" : String(value))} />
                </Field>
              )}
              <Field label="Link ảnh thiết kế">
                <Input className="min-h-11" value={designFileUrl} disabled={fieldsLocked} placeholder="Link Google Drive" onChange={(event) => setDesignFileUrl(event.target.value)} />
              </Field>
            </div>
          )}
        </section>

        <section className={card}>
          <h2 className="text-base font-bold">Tổng thanh toán</h2>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Tổng thanh toán</span>
              <span className="font-semibold">{goods === null ? "Chưa đủ giá" : formatVnd(Math.max(0, goods - (Number.isFinite(discountAmount) ? discountAmount : 0) + (Number.isFinite(shipAmount) ? shipAmount : 0)))}</span>
            </div>
            {compact ? null : (
              <label className="flex items-center justify-between gap-2">
                <span className="text-muted-foreground">Phí giao khách trả</span>
                <MoneyInput className="h-9 w-32 text-right" value={customerShip} disabled={fieldsLocked} placeholder="Để trống" aria-label="Phí giao khách trả" onValueChange={(value) => setCustomerShip(value == null ? "" : String(value))} />
              </label>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Đã thanh toán</span>
              <span className="font-medium">{formatVnd(isCodPay && mode === "create" ? 0 : paid)}</span>
            </div>
            {payments.length > 0 ? (
              <ul className="space-y-1 border-t pt-2 text-xs text-muted-foreground">
                {payments.map((payment, index) => (
                  <li key={`${payment.at}-${index}`} className="flex justify-between gap-2">
                    <span>
                      {new Date(payment.at).toLocaleString("vi-VN", { hour: "2-digit", minute: "2-digit", day: "2-digit", month: "2-digit" })}
                      {" · "}
                      {payment.method}
                      {payment.byName ? ` · ${payment.byName}` : ""}
                    </span>
                    <span className="shrink-0 font-semibold text-foreground">{formatVnd(payment.amount)}</span>
                  </li>
                ))}
              </ul>
            ) : null}
            {transfer ? (
              <div className="rounded-lg border bg-background p-3 text-center">
                <img src={transfer.image} alt={`Mã chuyển khoản ${transfer.content}`} className="mx-auto h-40 w-40" />
                <p className="mt-2 text-xs text-muted-foreground">
                  {transfer.bank} · {transfer.holder}. Nội dung chuyển khoản: <strong className="text-foreground">{transfer.content}</strong>
                </p>
              </div>
            ) : null}
            <div className="flex justify-between border-t pt-2">
              <span className="text-muted-foreground">{remain !== null && remain < 0 ? "Dư tiền" : "Còn lại"}</span>
              <span className="font-semibold">{remain === null ? "—" : formatVnd(Math.abs(remain))}</span>
            </div>
          </div>
          {mode === "create" || (retail && !fieldsLocked) ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <p className="text-sm font-medium">Thanh toán đơn hàng</p>
              <Field label="Hình thức" required={mode === "create"}>
                <select
                  className={control}
                  value={commercePay}
                  disabled={fieldsLocked}
                  onChange={(event) => {
                    const next = event.target.value as PaymentMethod;
                    setCommercePay(next);
                    const label = depositMethodLabel(next);
                    if (label) setMethod(label);
                    if (next === "cod") setDeposit("");
                  }}
                >
                  {mode === "edit" && !commercePay ? <option value="">Chưa chọn</option> : null}
                  {payChoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </Field>
              {mode === "create" ? (
                isCodPay ? (
                  <p className="text-[12px] text-muted-foreground">
                    COD không thu ngay khi tạo đơn. Tiền thu hộ ghi sau khi đối soát với vận chuyển tại mục Đối soát COD — không tự cộng ví lúc lưu.
                  </p>
                ) : (
                  <>
                    <p className="text-[12px] text-muted-foreground">Số tiền này cộng vào ví của bạn ngay khi lưu đơn. Để 0 nếu chưa thu.</p>
                    <Field label="Số tiền thu lần 1">
                      <MoneyInput placeholder="0" value={deposit} disabled={fieldsLocked} onValueChange={(value) => setDeposit(value == null ? "" : String(value))} />
                    </Field>
                  </>
                )
              ) : (
                <p className="text-[12px] text-muted-foreground">Đổi hình thức rồi bấm Cập nhật. Thu thêm tiền ở ô bên dưới.</p>
              )}
            </div>
          ) : null}
          {mode === "edit" ? (
            <div className="space-y-3 rounded-xl border bg-muted/30 p-3">
              <p className="text-sm font-medium">Thu tiền</p>
              <p className="text-[12px] text-muted-foreground">Ghi nhận sẽ cộng vào ví của bạn.</p>
              <div className="flex items-end gap-2">
                <div className="min-w-0 flex-1">
                  <Field label="Số tiền">
                    <MoneyInput placeholder="Số tiền" value={deposit} disabled={fieldsLocked || !onCollect} onValueChange={(value) => setDeposit(value == null ? "" : String(value))} />
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
                {collecting ? "Đang ghi…" : "Ghi nhận vào ví của bạn"}
              </Button>
            </div>
          ) : null}
          <p className="text-[11px] text-muted-foreground">
            {fieldsLocked
              ? "Đơn sàn không thu thêm và không sửa giá trên web."
              : isCodPay
                ? "COD: sau khi ship trả tiền, đánh dấu đã nhận tại Đối soát COD."
                : channel === "facebook"
                  ? "Đơn Facebook có thể cần cọc trước khi in."
                  : "Cọc có thể để trống, ghi thêm được sau khi mở đơn."}
          </p>
          {albumId ? <p className="text-[11px] font-medium text-primary">Ảnh từ album sẽ gắn vào đơn khi lưu.</p> : null}
          <Button type="submit" className="min-h-12 w-full text-base font-bold" disabled={saving || fieldsLocked}>
            {saving ? "Đang lưu..." : mode === "create" ? "Lưu đơn hàng" : "Cập nhật"}
          </Button>
        </section>
      </aside>
    </form>
  );
}

function Field({ label, children, required, icon }: { label: string; children: ReactNode; required?: boolean; icon?: ReactNode }) {
  return (
    <Label className="block space-y-1 text-sm font-semibold">
      <span className="inline-flex items-center gap-1.5">
        {icon ? <span className="text-muted-foreground">{icon}</span> : null}
        {label}
        {required ? <span className="text-destructive">*</span> : null}
      </span>
      {children}
    </Label>
  );
}

function ProductLine({
  index,
  line,
  owner,
  locked,
  canRemove,
  onQty,
  onPrice,
  onVariant,
  onDiscount,
  onRemove,
}: {
  index: number;
  line: Line & { sku?: DeskSku; listed: number | null; unit: number | null; lineTotal: number | null };
  owner: boolean;
  locked: boolean;
  canRemove: boolean;
  onQty: (quantity: number) => void;
  onPrice: (unitPrice: string) => void;
  onVariant: (variant: string) => void;
  onDiscount: (discount: string) => void;
  onRemove: () => void;
}) {
  const [editVariant, setEditVariant] = useState(Boolean(line.variant.trim()));
  const title = line.sku ? skuTitle(line.sku) : "Chưa chọn sản phẩm";

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-3 shadow-sm">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[15px] leading-snug font-bold text-foreground">{title}</p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            {line.sku ? (
              <span className="rounded-full bg-blue-100 px-2 py-0.5 font-mono text-[11px] font-semibold text-blue-700">
                {line.sku.code}
              </span>
            ) : null}
            {line.variant.trim() && !editVariant ? (
              <button
                type="button"
                className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                disabled={locked}
                onClick={() => setEditVariant(true)}
              >
                {line.variant}
              </button>
            ) : null}
            {!locked && (editVariant || !line.variant.trim()) ? (
              editVariant ? (
                <Input
                  className="h-7 w-36 rounded-full px-2 text-xs"
                  value={line.variant}
                  disabled={locked}
                  placeholder="Mẫu / phân loại"
                  aria-label={`Mẫu dòng ${index + 1}`}
                  onChange={(event) => onVariant(event.target.value)}
                  onBlur={() => {
                    if (!line.variant.trim()) setEditVariant(false);
                  }}
                />
              ) : (
                <button
                  type="button"
                  className="text-[11px] font-medium text-blue-700"
                  onClick={() => setEditVariant(true)}
                >
                  + Mẫu
                </button>
              )
            ) : null}
          </div>
        </div>
        {canRemove ? (
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="size-8 shrink-0 text-red-500 hover:bg-red-50 hover:text-red-600"
            aria-label="Xóa sản phẩm"
            onClick={onRemove}
          >
            <Trash2 className="size-4" />
          </Button>
        ) : null}
      </div>

      <div className="mt-3 grid grid-cols-3 items-end gap-2">
        <label className="min-w-0 space-y-1">
          <span className="block text-[11px] font-semibold text-muted-foreground">Giá:</span>
          {owner && !locked ? (
            <MoneyInput
              className="h-9 rounded-full px-2 text-center text-sm"
              aria-label={`Đơn giá dòng ${index + 1}`}
              placeholder={line.listed === null ? "—" : formatGroupedInt(line.listed)}
              value={line.unitPrice}
              onValueChange={(value) => onPrice(value == null ? "" : String(value))}
            />
          ) : (
            <p className="flex h-9 items-center justify-center text-sm font-medium">
              {line.unit === null ? "Chưa có giá" : formatVnd(line.unit)}
            </p>
          )}
        </label>
        <label className="min-w-0 space-y-1">
          <span className="block text-[11px] font-semibold text-muted-foreground">SL:</span>
          <div className="flex h-9 items-center rounded-full border border-input bg-background">
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground disabled:opacity-40"
              aria-label={`Giảm số lượng dòng ${index + 1}`}
              disabled={locked || line.quantity <= 1}
              onClick={() => onQty(line.quantity - 1)}
            >
              <Minus className="size-3.5" />
            </button>
            <Input
              className="h-8 min-w-0 flex-1 border-0 bg-transparent px-0 text-center shadow-none focus-visible:ring-0"
              inputMode="numeric"
              disabled={locked}
              aria-label={`Số lượng dòng ${index + 1}`}
              value={line.quantity}
              onChange={(event) => onQty(Math.min(500, Math.max(1, Number(event.target.value.replace(/\D/g, "")) || 1)))}
            />
            <button
              type="button"
              className="flex size-8 shrink-0 items-center justify-center text-muted-foreground disabled:opacity-40"
              aria-label={`Tăng số lượng dòng ${index + 1}`}
              disabled={locked || line.quantity >= 500}
              onClick={() => onQty(line.quantity + 1)}
            >
              <Plus className="size-3.5" />
            </button>
          </div>
        </label>
        <label className="min-w-0 space-y-1">
          <span className="block text-[11px] font-semibold text-muted-foreground">Giảm:</span>
          <MoneyInput
            className="h-9 rounded-full px-2 text-center text-sm"
            aria-label={`Giảm giá dòng ${index + 1}`}
            placeholder="0"
            value={line.discount}
            disabled={locked}
            onValueChange={(value) => onDiscount(value == null ? "" : String(value))}
          />
        </label>
      </div>

      <p className="mt-2 text-right text-base font-extrabold text-blue-700">
        {line.sku ? formatMaybe(line.lineTotal) : "—"}
      </p>
    </div>
  );
}
