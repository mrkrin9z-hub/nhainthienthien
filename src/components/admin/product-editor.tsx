import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { createWebProduct, getWebProduct, getWebProducts, updateWebProduct } from "@/lib/admin.functions";
import { MoneyInput } from "@/components/ui/money-input";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHANNEL_LABEL, CHANNELS, type Channel } from "@/domain/types";
import {
  normalizeProductCode,
  productCodeFromName,
  suggestProductCode,
  suggestProductName,
} from "@/domain/web-product";

type QuoteDraft = { price: string; sold: boolean };

function blankQuotes(): Record<Channel, QuoteDraft> {
  return Object.fromEntries(CHANNELS.map((channel) => [channel, { price: "", sold: channel === "tai_tiem" }])) as Record<
    Channel,
    QuoteDraft
  >;
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
  const [nameTouched, setNameTouched] = useState(false);
  const [code, setCode] = useState("");
  const [codeTouched, setCodeTouched] = useState(false);
  const [category, setCategory] = useState("");
  const [categories, setCategories] = useState<string[]>([]);
  const [description, setDescription] = useState("");
  const [width, setWidth] = useState("13");
  const [height, setHeight] = useState("18");
  const [sheets, setSheets] = useState("1");
  const [skuId, setSkuId] = useState<string | undefined>();
  const [quotes, setQuotes] = useState<Record<Channel, QuoteDraft>>(blankQuotes);
  const [legacySizes, setLegacySizes] = useState(0);

  function refreshSuggestions(next: { category?: string; width?: string; height?: string; sheets?: string }) {
    if (editing) return;
    const cat = next.category ?? category;
    const w = Number((next.width ?? width).trim());
    const h = Number((next.height ?? height).trim());
    const s = Number((next.sheets ?? sheets).trim());
    if (!(w > 0 && h > 0 && s > 0)) return;
    if (!codeTouched) setCode(suggestProductCode({ category: cat, widthCm: w, heightCm: h, sheets: s }));
    if (!nameTouched && cat.trim().length >= 2) {
      setName(suggestProductName({ category: cat, widthCm: w, heightCm: h, sheets: s }));
    }
  }

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
          const cat = cats[0] ?? "Tráng gương";
          setName("");
          setNameTouched(false);
          setCode("");
          setCodeTouched(false);
          setCategory(cat);
          setDescription("");
          setWidth("13");
          setHeight("18");
          setSheets("1");
          setSkuId(undefined);
          setQuotes(blankQuotes());
          setLegacySizes(0);
          setCode(suggestProductCode({ category: cat, widthCm: 13, heightCm: 18, sheets: 1 }));
          setName(suggestProductName({ category: cat, widthCm: 13, heightCm: 18, sheets: 1 }));
          return;
        }
        const product = await getWebProduct({ data: { groupId } });
        if (!alive) return;
        const size = product.sizes[0];
        setName(product.name);
        setNameTouched(true);
        setCode(normalizeProductCode(product.id) || product.id);
        setCodeTouched(true);
        setCategory(product.category);
        setDescription(product.description);
        setLegacySizes(product.sizes.length);
        if (size) {
          setSkuId(size.skuId);
          setWidth(String(size.widthCm));
          setHeight(String(size.heightCm));
          setSheets(String(size.sheets));
          setQuotes(
            Object.fromEntries(
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
          );
        } else {
          setSkuId(undefined);
          setWidth("13");
          setHeight("18");
          setSheets("1");
          setQuotes(blankQuotes());
        }
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

  function patchQuote(channel: Channel, patch: Partial<QuoteDraft>) {
    setQuotes((current) => ({ ...current, [channel]: { ...current[channel], ...patch } }));
  }

  async function save() {
    setSaving(true);
    try {
      const quoteMap: Record<string, { price: number | null; sold: boolean }> = {};
      for (const channel of CHANNELS) {
        const quote = quotes[channel];
        quoteMap[channel] = {
          price: optionalWhole(quote.price),
          sold: quote.sold,
        };
      }
      const retail =
        quoteMap["tai_tiem"]?.price
        ?? CHANNELS.map((channel) => quoteMap[channel]?.price).find((price): price is number => price != null);
      if (retail == null) throw new Error("Cần ít nhất một giá kênh.");
      const size = {
        skuId,
        widthCm: whole(width),
        heightCm: whole(height),
        sheets: whole(sheets),
        price: retail,
        quotes: quoteMap,
      };
      const payload = {
        name,
        code: normalizeProductCode(code) || productCodeFromName(name),
        category,
        description,
        turnaround: "",
        sizes: [size],
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
            {legacySizes > 1 ? (
              <p className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-950">
                Mã cũ đang gom {legacySizes} khổ/combo. Lưu sẽ chỉ giữ khổ đang sửa — các khổ khác ngừng bán.
                Nên tạo từng mã riêng (vd TG-13x18, Combo13x18-02) cùng nhóm.
              </p>
            ) : null}
            <label className="block text-sm font-semibold">
              Nhóm sản phẩm
              <Input
                className="mt-1 min-h-11"
                list="product-category-options"
                value={category}
                onChange={(event) => {
                  const value = event.target.value;
                  setCategory(value);
                  refreshSuggestions({ category: value });
                }}
                placeholder="Tráng gương"
              />
              <datalist id="product-category-options">
                {categoryOptions.map((item) => (
                  <option key={item} value={item} />
                ))}
              </datalist>
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                Chỉ là nhãn nhóm (vd Tráng gương). Mỗi khổ/combo vẫn là một mã riêng.
              </span>
            </label>
            <div className="grid grid-cols-3 gap-2">
              <label className="text-sm font-semibold">
                Rộng (cm)
                <Input
                  className="mt-1 min-h-11"
                  inputMode="numeric"
                  value={width}
                  onChange={(event) => {
                    setWidth(event.target.value);
                    refreshSuggestions({ width: event.target.value });
                  }}
                />
              </label>
              <label className="text-sm font-semibold">
                Cao (cm)
                <Input
                  className="mt-1 min-h-11"
                  inputMode="numeric"
                  value={height}
                  onChange={(event) => {
                    setHeight(event.target.value);
                    refreshSuggestions({ height: event.target.value });
                  }}
                />
              </label>
              <label className="text-sm font-semibold">
                Số tấm
                <Input
                  className="mt-1 min-h-11"
                  inputMode="numeric"
                  value={sheets}
                  onChange={(event) => {
                    setSheets(event.target.value);
                    refreshSuggestions({ sheets: event.target.value });
                  }}
                />
              </label>
            </div>
            <p className="text-xs text-muted-foreground">
              Số tấm = 1 → sản phẩm lẻ. ≥ 2 → combo (mã kiểu Combo13x18-02), giá nhập riêng.
            </p>
            <label className="block text-sm font-semibold">
              Tên sản phẩm
              <Input
                className="mt-1 min-h-11"
                value={name}
                onChange={(event) => {
                  setNameTouched(true);
                  setName(event.target.value);
                }}
                placeholder="Tráng gương 13×18 cm"
              />
            </label>
            <label className="block text-sm font-semibold">
              Mã sản phẩm
              <Input
                className="mt-1 min-h-11 font-mono"
                value={code}
                disabled={editing}
                onChange={(event) => {
                  setCodeTouched(true);
                  setCode(normalizeProductCode(event.target.value));
                }}
                placeholder="TG-13x18"
              />
              <span className="mt-1 block text-xs font-normal text-muted-foreground">
                {editing
                  ? "Mã cố định khi sửa — chỉ sửa đúng sản phẩm này."
                  : "Tự gợi ý theo nhóm + khổ (combo → Combo13x18-02). Có thể sửa trước khi lưu."}
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
            <div className="space-y-2">
              <p className="text-sm font-semibold">Giá từng kênh</p>
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
                      const quote = quotes[channel];
                      return (
                        <tr key={channel} className="border-b last:border-0">
                          <td className="px-3 py-2 font-medium">{CHANNEL_LABEL[channel]}</td>
                          <td className="px-3 py-2">
                            <MoneyInput
                              className="min-h-10"
                              value={quote.price}
                              placeholder="Để trống nếu không bán"
                              onValueChange={(value) => patchQuote(channel, { price: value == null ? "" : String(value) })}
                            />
                          </td>
                          <td className="px-3 py-2">
                            <label className="inline-flex items-center gap-2 text-xs font-medium">
                              <input
                                type="checkbox"
                                className="size-4"
                                checked={quote.sold}
                                onChange={(event) => patchQuote(channel, { sold: event.target.checked })}
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
            <Button className="min-h-12 bg-accent text-accent-foreground" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : editing ? "Lưu sản phẩm" : "Tạo sản phẩm"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
