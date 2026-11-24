import { useMemo, useState } from "react";
import { Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Channel } from "@/domain/types";
import {
  filterPickerRows,
  PICKER_SEARCH_INPUT_CLASS,
  PICKER_SEARCH_WRAP_CLASS,
  PICKER_TOOLBAR_CLASS,
  PICKER_TYPE_SELECT_CLASS,
  PICKER_UNPRICED_BUTTON_CLASS,
  pickerGroupNames,
} from "@/domain/product-picker";
import { formatVnd } from "@/lib/brand";

export type PickerSku = {
  id: string;
  code: string;
  name: string;
  groupName: string;
  label: string;
  prices?: Partial<Record<Channel, number | null>>;
};

export function ProductPickerDialog({
  open,
  onOpenChange,
  catalog,
  channel,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  catalog: PickerSku[];
  channel: Channel;
  onConfirm: (skuIds: string[]) => void;
}) {
  const [q, setQ] = useState("");
  const [group, setGroup] = useState("all");
  const [showUnpriced, setShowUnpriced] = useState(false);

  const groups = useMemo(() => pickerGroupNames(catalog), [catalog]);

  const rows = useMemo(
    () => filterPickerRows(catalog, { q, group, showUnpriced, channel }),
    [catalog, group, q, showUnpriced, channel],
  );

  function pick(id: string) {
    onConfirm([id]);
  }

  function close(next: boolean) {
    if (!next) {
      setQ("");
      setGroup("all");
      
    }
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="flex max-h-[90vh] max-w-2xl flex-col gap-3 overflow-hidden">
        <DialogHeader>
          <DialogTitle>Chọn sản phẩm & dịch vụ</DialogTitle>
        </DialogHeader>
        <div className="flex gap-2 rounded-full bg-muted p-1">
          <span className="flex-1 rounded-full bg-card px-3 py-2 text-center text-sm font-semibold text-primary shadow-sm">Sản phẩm</span>
          <span className="flex-1 rounded-full px-3 py-2 text-center text-sm font-medium text-muted-foreground">Gói dịch vụ</span>
        </div>
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
        <ul className="min-h-0 flex-1 space-y-2 overflow-y-auto pr-1">
          {rows.map((sku) => {
            const price = sku.prices?.[channel] ?? null;
            return (
              <li key={sku.id}>
                <button
                  type="button"
                  onClick={() => pick(sku.id)}
                  className="flex w-full items-start gap-3 rounded-md border border-border bg-card px-3 py-2.5 text-left hover:border-primary hover:bg-primary/5"
                >
                  <span className="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border border-primary/40 text-[10px] font-bold text-primary">
                    +
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{sku.name}</span>
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 font-mono text-[11px] font-semibold text-primary">{sku.code}</span>
                    </span>
                    <span className="mt-0.5 block text-[13px] text-primary">{price === null ? "Chưa có giá" : formatVnd(price)}</span>
                    <span className="block text-[11px] text-muted-foreground">{sku.groupName || "Khác"}</span>
                  </span>
                </button>
              </li>
            );
          })}
          {rows.length === 0 ? <li className="py-8 text-center text-sm text-muted-foreground">Không có sản phẩm khớp.</li> : null}
        </ul>
        <DialogFooter>
          <Button type="button" className="w-full" onClick={() => close(false)}>
            Xong
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
