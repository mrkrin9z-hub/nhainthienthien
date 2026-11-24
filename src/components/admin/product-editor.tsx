import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createWebProduct, getWebProduct, getWebProducts, updateWebProduct } from "@/lib/admin.functions";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";
import { normalizeProductCode, productCodeFromName } from "@/domain/web-product";

type QuoteDraft = { price: string; sold: boolean };
type SizeDraft = {
  skuId?: string;
  width: string;
  height: string;
  sheets: string;
  quotes: Record<Channel, QuoteDraft>;
};

function blankQuotes(): Record<Channel, QuoteDraft> {
  return Object.fromEntries(CHANNELS.map((channel) => [channel, { price: "", sold: channel === "tai_tiem" }])) as Record<
    Channel,
    QuoteDraft
  >;
}

function blankRow(): SizeDraft {
  return { width: "15", height: "21", sheets: "1", quotes: blankQuotes() };
}

function whole(value: string): number {
  const n = Number(value.trim());
  if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0) throw new Error("Khổ/giá phải là số nguyên dương.");
  return n;
}

function optionalWhole(value: string): number | null {
  if (!value.trim()) return null;
  return whole(value);
}

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
  /** Khi có groupId → chỉ sửa đúng sản phẩm đó. */
  groupId?: string | null;
};

export function ProductEditor({ open, onOpenChange, onSaved, groupId = null }: Props) {
  const editing = Boolean(groupId);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [rows, setRows] = useState<SizeDraft[]>([blankRow()]);
  useEffect(() => {
    if (!open) return;
    let alive = true;
    void (async () => {
      setLoading(true);
      try {
        const products = await getWebProducts();
        if (!alive) return;
        const cats = [...new Set(products.map((item) => item.category).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
        setCategories(cats);
        if (!groupId) {
          setName("");
          setCode("");
          setCodeTouched(false);
          setCategory(cats[0] ?? "");
          setDescription("");
          setRows([blankRow()]);
          return;
        }
        const product = await getWebProduct({ data: { groupId } });
        if (!alive) return;
        setName(product.name);
        setCode(normalizeProductCode(product.id) || product.id);
        setCodeTouched(true);
        setCategory(product.category);
        setDescription(product.description);
        setRows(
          product.sizes.length
            ? product.sizes.map((size) => ({
                skuId: size.skuId,
                width: String(size.widthCm),
                height: String(size.heightCm),
                sheets: String(size.sheets),
                quotes: Object.fromEntries(
                  CHANNELS.map((channel) => {
                    const quote = size.quotes[channel];
                    return [
                      channel,
                      {
                        price: quote?.price != null ? String(quote.price) : "",
                        sold: Boolean(quote?.sold),
                      },
                    ];
                  }),
                ) as Record<Channel, QuoteDraft>,
              }))
            : [blankRow()],
        );
      } catch (error) {
        toast.error((error as Error).message);
        onOpenChange(false);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [open, groupId, onOpenChange]);

  const title = editing ? `Sửa sản phẩm · ${code || groupId}` : "Tạo sản phẩm";

  const categoryOptions = useMemo(() => {
    if (category && !categories.includes(category)) return [...categories, category];
    return categories;
  }, [categories, category]);

  function patchRow(index: number, patch: Partial<SizeDraft>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  function patchQuote(index: number, channel: Channel, patch: Partial<QuoteDraft>) {
    setRows((current) =>
      current.map((row, i) => {
        if (i !== index) return row;
        return { ...row, quotes: { ...row.quotes, [channel]: { ...row.quotes[channel], ...patch } } };
      }),
    );
  }

  function onNameChange(value: string) {
    setName(value);
    if (!editing && !codeTouched) setCode(productCodeFromName(value));
  }

  async function save() {
    const sizes = rows.map((row) => {
      const quotes: Record<string, { price: number | null; sold: boolean }> = {};
      for (const channel of CHANNELS) {
        const quote = row.quotes[channel];
        quotes[channel] = {
          price: optionalWhole(quote.price),
          sold: quote.sold,
        };
      }
      const retail =
        quotes["tai_tiem"]?.price
        ?? CHANNELS.map((channel) => quotes[channel]?.price).find((price): price is number => price != null);
      if (retail == null) throw new Error(`Khổ ${row.width}×${row.height} cần ít nhất một giá.`);
      return {
        skuId: row.skuId,
        widthCm: whole(row.width),
        heightCm: whole(row.height),
        sheets: whole(row.sheets),
        price: retail,
        quotes,
      };
    });
    setSaving(true);
    try {
      const payload = {
        name,
        code: normalizeProductCode(code) || productCodeFromName(name),
        category,
        description,
        turnaround: "",
        sizes,
      };
      const saved =
        editing && groupId
          ? await updateWebProduct({ data: { groupId, ...payload } })
          : await createWebProduct({ data: payload });
      toast.success(editing ? `Đã lưu ${saved.name}` : `Đã thêm ${saved.name}`);
      onOpenChange(false);
      onSaved();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải sản phẩm…</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Tên sản phẩm
              <Input
                className="mt-1 min-h-11"
                value={name}
                onChange={(event) => onNameChange(event.target.value)}
                placeholder="Ảnh ép gỗ"
              />
            </label>
            <label className="block text-sm font-semibold">
              Mã sản phẩm
              <Input
                className="mt-1 min-h-11 font-mono uppercase"
                value={code}
                disabled={editing}
                onChange={(event) => {
                  setCodeTouched(true);
                  setCode(normalizeProductCode(event.target.value));
                }}
                placeholder="AEG"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {editing ? "Mã cố định khi sửa — chỉ sửa đúng sản phẩm này." : "Tự lấy từ tên viết tắt liền không dấu; có thể sửa trước khi lưu."}
              </span>
            </label>
            <label className="block text-sm font-semibold">
              Nhóm sản phẩm
              <Input
                className="mt-1 min-h-11"
                list="product-category-options"
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                placeholder="Ảnh gỗ"
              />
              <datalist id="product-category-options">
                {categoryOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Chọn từ nhóm đã có hoặc gõ nhóm mới.
              </span>
            </label>
            <label className="block text-sm font-semibold">
              Mô tả
              <textarea
                className="mt-1 min-h-20 w-full rounded-xl border bg-card px-3 py-2 text-sm"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
            </label>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Khổ và giá từng kênh</p>
              {rows.map((row, index) => (
                <div key={row.skuId ?? index} className="space-y-3 rounded-2xl border bg-slate-50 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Rộng (cm)
                      <Input
                        className="mt-1 min-h-11 bg-white"
                        inputMode="numeric"
                        value={row.width}
                        onChange={(event) => patchRow(index, { width: event.target.value })}
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Cao (cm)
                      <Input
                        className="mt-1 min-h-11 bg-white"
                        inputMode="numeric"
                        value={row.height}
                        onChange={(event) => patchRow(index, { height: event.target.value })}
                      />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Số tấm
                      <Input
                        className="mt-1 min-h-11 bg-white"
                        inputMode="numeric"
                        value={row.sheets}
                        onChange={(event) => patchRow(index, { sheets: event.target.value })}
                      />
                    </label>
                  </div>
                  <div className="overflow-x-auto rounded-xl border bg-white">
                    <table className="w-full min-w-[28rem] text-left text-sm">
                      <thead className="border-b bg-slate-50 text-xs text-muted-foreground">
                        <tr>
                          <th className="px-3 py-2 font-semibold">Kênh</th>
                          <th className="px-3 py-2 font-semibold">Giá</th>
                          <th className="px-3 py-2 font-semibold">Đang bán</th>
                        </tr>
                      </thead>
                      <tbody>
                        {CHANNELS.map((channel) => {
                          const quote = row.quotes[channel];
                          return (
                            <tr key={channel} className="border-b last:border-0">
                              <td className="px-3 py-2 font-medium">{CHANNEL_LABEL[channel]}</td>
                              <td className="px-3 py-2">
                                <MoneyInput
                                  className="min-h-10"
                                  value={quote.price}
                                  placeholder="Để trống nếu không bán"
                                  onValueChange={(value) =>
                                    patchQuote(index, channel, { price: value == null ? "" : String(value) })
                                  }
                                />
                              </td>
                              <td className="px-3 py-2">
                                <label className="inline-flex items-center gap-2 text-xs font-medium">
                                  <input
                                    type="checkbox"
                                    className="size-4"
                                    checked={quote.sold}
                                    onChange={(event) => patchQuote(index, channel, { sold: event.target.checked })}
                                  />
                                  {quote.sold ? "Đang bán" : "Không bán"}
                                </label>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" className="min-h-11" onClick={() => setRows((current) => [...current, blankRow()])}>
                  Thêm khổ
                </Button>
                {rows.length > 1 ? (
                  <Button type="button" variant="outline" className="min-h-11" onClick={() => setRows((current) => current.slice(0, -1))}>
                    Bớt khổ cuối
                  </Button>
                ) : null}
              </div>
            </div>
            <Button className="min-h-12 bg-accent text-accent-foreground" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : editing ? "Lưu sản phẩm" : "Tạo sản phẩm"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
