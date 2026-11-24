import { useMemo, useState } from "react";
import { Minus, Plus, Search, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Channel } from "@/domain/types";
import {
  bumpPickerQty,
  filterPickerRows,
  PICKER_CARD_CLASS,
  PICKER_CHOSEN_CARD_CLASS,
  PICKER_SEARCH_INPUT_CLASS,
  PICKER_SEARCH_WRAP_CLASS,
  PICKER_TOOLBAR_CLASS,
  PICKER_TYPE_SELECT_CLASS,
  PICKER_UNPRICED_BUTTON_CLASS,
  pickerChoiceSummary,
  pickerChoices,
  pickerDoneLabel,
  pickerGroupNames,
  pickerQtyOf,
  qtyMapFromLines,
  type PickerQtyMap,
  type PickerSelection,
  type PickerSku,
} from "@/domain/product-picker";
import { formatVnd } from "@/lib/brand";

export type { PickerSku, PickerSelection };

export function ProductPickerDialog({
  open,
  onOpenChange,
  catalog,
  channel,
  initialSelected,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: PickerSku[];
  channel: Channel;
  initialSelected?: PickerSelection[];
  onConfirm: (items: PickerSelection[]) => void;
}) {
  function close(next: boolean) {
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm & dịch vụ</DialogTitle>
        </DialogHeader>
        {open ? (
          <ProductPickerPanel
            catalog={catalog}
            channel={channel}
            initialSelected={initialSelected}
            onConfirm={(items) => {
              onConfirm(items);
              close(false);
            }}
          />
        ) : null}
      </DialogContent>
    </Dialog>
  );
}

export function ProductPickerPanel({
  catalog,
  channel,
  initialSelected,
  onConfirm,
}: {
  catalog: PickerSku[];
  channel: Channel;
  initialSelected?: PickerSelection[];
  onConfirm: (items: PickerSelection[]) => void;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [showUnpriced, setShowUnpriced] = useState(false);
  const [tab, setTab] = useState<"products" | "packages">("products");
  const [selected, setSelected] = useState<PickerQtyMap>(() => qtyMapFromLines(initialSelected));

  const groups = useMemo(() => pickerGroupNames(catalog), [catalog]);
  const rows = useMemo(
    () => (tab === "packages" ? [] : filterPickerRows(catalog, { q, group, showUnpriced, channel })),
    [catalog, group, q, showUnpriced, channel, tab],
  );
  const choices = useMemo(() => pickerChoices(catalog, selected, channel), [catalog, selected, channel]);
  const summary = useMemo(() => pickerChoiceSummary(choices), [choices]);
  const doneLabel = pickerDoneLabel(summary, formatVnd);

  function setQty(skuId: string, quantity: number) {
    setSelected((current) => {
      const next = { ...current };
      if (quantity <= 0) delete next[skuId];
      else next[skuId] = Math.min(500, quantity);
      return next;
    });
  }

  return (
    <>
      <div className="flex gap-2 rounded-full bg-muted p-1">
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-center text-sm ${tab === "products" ? "bg-card font-semibold text-primary shadow-sm" : "font-medium text-muted-foreground"}`}
          onClick={() => setTab("products")}
        >
          Sản phẩm
        </button>
        <button
          type="button"
          className={`flex-1 rounded-full px-3 py-2 text-center text-sm ${tab === "packages" ? "bg-card font-semibold text-primary shadow-sm" : "font-medium text-muted-foreground"}`}
          onClick={() => setTab("packages")}
        >
          Gói dịch vụ
        </button>
      </div>
      {tab === "products" ? (
        <div className={PICKER_TOOLBAR_CLASS}>
          <div className={PICKER_SEARCH_WRAP_CLASS}>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className={PICKER_SEARCH_INPUT_CLASS}
              value={q}
              onChange={(event) => setQ(event.target.value)}
              placeholder="Tìm theo tên hoặc mã sản phẩm…"
              aria-label="Tìm sản phẩm"
            />
          </div>
          <select
            className={PICKER_TYPE_SELECT_CLASS}
            aria-label="Nhóm sản phẩm"
            value={group}
            onChange={(event) => setGroup(event.target.value)}
          >
            <option value="all">Tất cả loại</option>
            {groups.map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
          <button type="button" className={PICKER_UNPRICED_BUTTON_CLASS} onClick={() => setShowUnpriced((value) => !value)}>
            {showUnpriced ? "Đang hiện khổ chưa có giá" : "Hiện khổ chưa có giá"}
          </button>
        </div>
      ) : null}
      <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
        {tab === "packages" ? (
          <li className="py-8 text-center text-sm text-muted-foreground">Chưa có gói dịch vụ trong bảng giá.</li>
        ) : null}
        {tab === "products"
          ? rows.map((sku) => {
              const price = sku.prices?.[channel] ?? null;
              const quantity = pickerQtyOf(selected, sku.id);
              const chosen = quantity > 0;
              return (
                <li key={sku.id}>
                  <div className={chosen ? PICKER_CHOSEN_CARD_CLASS : PICKER_CARD_CLASS}>
                    {chosen ? (
                      <div className="mt-0.5 flex h-8 shrink-0 items-center rounded-full border border-primary/40 bg-card">
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center text-muted-foreground"
                          aria-label={`Giảm số lượng ${sku.name ?? sku.code}`}
                          onClick={() => setSelected((current) => bumpPickerQty(current, sku.id, -1))}
                        >
                          <Minus className="size-3.5" />
                        </button>
                        <span className="min-w-6 text-center text-sm font-bold text-primary" aria-label={`Số lượng ${sku.name ?? sku.code}`}>
                          {quantity}
                        </span>
                        <button
                          type="button"
                          className="flex size-8 items-center justify-center text-muted-foreground"
                          aria-label={`Tăng số lượng ${sku.name ?? sku.code}`}
                          disabled={quantity >= 500}
                          onClick={() => setSelected((current) => bumpPickerQty(current, sku.id, 1))}
                        >
                          <Plus className="size-3.5" />
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setQty(sku.id, 1)}
                        className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full border border-primary/40 text-[10px] font-bold text-primary"
                        aria-label={`Chọn ${sku.name ?? sku.code}`}
                      >
                        +
                      </button>
                    )}
                    <button
                      type="button"
                      className="min-w-0 flex-1 text-left"
                      onClick={() => (chosen ? null : setQty(sku.id, 1))}
                      aria-label={chosen ? `${sku.name} đã chọn` : `Chọn ${sku.name ?? sku.code}`}
                    >
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="font-semibold">{sku.name}</span>
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{sku.code}</span>
                        {chosen ? (
                          <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-primary-foreground">
                            Đã chọn · SL {quantity}
                          </span>
                        ) : null}
                      </span>
                      <span className="mt-0.5 block text-[13px] text-primary">{price === null ? "Chưa có giá" : formatVnd(price)}</span>
                      <span className="block text-[11px] text-muted-foreground">{sku.groupName || "Khác"}</span>
                    </button>
                  </div>
                </li>
              );
            })
          : null}
        {tab === "products" && rows.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">Không có sản phẩm khớp.</li> : null}
      </ul>
      {choices.length > 0 ? (
        <div className="space-y-2 border-t pt-2">
          <p className="text-[11px] font-semibold text-muted-foreground">Đã chọn</p>
          <div className="flex flex-wrap gap-1.5">
            {choices.map((item) => (
              <span key={item.skuId} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[12px] font-medium text-foreground">
                {item.name} × {item.quantity}
                <button
                  type="button"
                  className="flex size-4 items-center justify-center rounded-full text-muted-foreground hover:text-foreground"
                  aria-label={`Xóa ${item.name}`}
                  onClick={() => setQty(item.skuId, 0)}
                >
                  <X className="size-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      ) : null}
      <DialogFooter>
        <Button
          type="button"
          className="w-full"
          aria-label={doneLabel}
          onClick={() => onConfirm(choices.map((item) => ({ skuId: item.skuId, quantity: item.quantity })))}
        >
          {doneLabel}
        </Button>
      </DialogFooter>
    </>
  );
}
