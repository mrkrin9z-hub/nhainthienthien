import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { CHANNELS, CHANNEL_LABEL, type Channel } from "@/domain/types";
import { createWebProduct, getWebProduct, updateWebProduct } from "@/lib/admin.functions";

type QuoteDraft = { price: string; listPrice: string; minTotal: string; sold: boolean };
type SizeRow = {
  skuId?: string;
  width: string;
  height: string;
  sheets: string;
  quotes: Record<Channel, QuoteDraft>;
};

const CHANNEL_HINT: Record<Channel, string> = {
  tai_tiem: "Trực tiếp",
  facebook: "Facebook",
  tiktok: "TikTok",
  shopee: "Shopee",
  ctv: "CTV (chỉ admin)",
  mo_home: "Mơ Home (chỉ admin)",
};

function blankQuote(): QuoteDraft {
  return { price: "", listPrice: "", minTotal: "", sold: false };
}

function emptyQuotes(): Record<Channel, QuoteDraft> {
  return {
    tai_tiem: { price: "", listPrice: "", minTotal: "", sold: true },
    facebook: blankQuote(),
    tiktok: blankQuote(),
    shopee: blankQuote(),
    ctv: blankQuote(),
    mo_home: blankQuote(),
  };
}

function blankRow(): SizeRow {
  return { width: "", height: "", sheets: "1", quotes: emptyQuotes() };
}

function whole(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : Number.NaN;
}

function optionalWhole(value: string): number | null {
  const n = whole(value);
  return Number.isFinite(n) ? n : null;
}

async function uploadCover(slug: string, file: File) {
  const body = new FormData();
  body.set("slug", slug);
  body.set("kind", "cover");
  body.set("file", file);
  const response = await fetch("/api/admin/product-photo", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text());
}

async function uploadGallery(slug: string, file: File) {
  const body = new FormData();
  body.set("slug", slug);
  body.set("kind", "gallery");
  body.set("file", file);
  const response = await fetch("/api/admin/product-photo", { method: "POST", body });
  if (!response.ok) throw new Error(await response.text());
}

function percent(amount: number, rate: number): number {
  return Math.round(amount * rate);
}

export function ProductEditor({
  open,
  onOpenChange,
  groupId = null,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  groupId?: string | null;
  onSaved: () => void;
}) {
  const editing = Boolean(groupId);
  const [name, setName] = useState("");
  const [category, setCategory] = useState("Ảnh gỗ");
  const [description, setDescription] = useState("");
  const [turnaround, setTurnaround] = useState("");
  const [listed, setListed] = useState(true);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);
  const [rows, setRows] = useState<SizeRow[]>([blankRow()]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (!groupId) {
      setName("");
      setCategory("Ảnh gỗ");
      setDescription("");
      setTurnaround("");
      setListed(true);
      setCoverFile(null);
      setGalleryFiles([]);
      setRows([blankRow()]);
      return;
    }
    setLoading(true);
    void getWebProduct({ data: { groupId } })
      .then((product) => {
        setName(product.name);
        setCategory(product.category);
        setDescription(product.description);
        setTurnaround(product.turnaround);
        setListed(product.listed);
        setCoverFile(null);
        setGalleryFiles([]);
        setRows(
          product.sizes.map((size) => ({
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
                    price: quote?.price == null ? "" : String(quote.price),
                    listPrice: quote?.listPrice == null ? "" : String(quote.listPrice),
                    minTotal: quote?.minTotal == null ? "" : String(quote.minTotal),
                    sold: Boolean(quote?.sold),
                  },
                ];
              }),
            ) as Record<Channel, QuoteDraft>,
          })),
        );
      })
      .catch((error) => toast.error((error as Error).message))
      .finally(() => setLoading(false));
  }, [open, groupId]);

  function patchRow(index: number, patch: Partial<SizeRow>) {
    setRows((current) => current.map((row, rowIndex) => (rowIndex === index ? { ...row, ...patch } : row)));
  }

  function patchQuote(index: number, channel: Channel, patch: Partial<QuoteDraft>) {
    setRows((current) =>
      current.map((row, rowIndex) =>
        rowIndex === index ? { ...row, quotes: { ...row.quotes, [channel]: { ...row.quotes[channel], ...patch } } } : row,
      ),
    );
  }

  function copyRetail(index: number) {
    const retail = rows[index]?.quotes.tai_tiem.price ?? "";
    const minTotal = rows[index]?.quotes.tai_tiem.minTotal ?? "";
    if (!retail) {
      toast.error("Nhập giá tại tiệm trước.");
      return;
    }
    setRows((current) =>
      current.map((row, rowIndex) => {
        if (rowIndex !== index) return row;
        const next = { ...row.quotes };
        for (const channel of ["facebook", "tiktok", "shopee"] as Channel[]) {
          next[channel] = { ...next[channel], price: retail, minTotal, sold: true };
        }
        return { ...row, quotes: next };
      }),
    );
  }

  function fillCtv(index: number) {
    const retail = whole(rows[index]?.quotes.tai_tiem.price ?? "");
    if (!Number.isFinite(retail)) {
      toast.error("Nhập giá tại tiệm trước.");
      return;
    }
    patchQuote(index, "ctv", { price: String(percent(retail, 0.9)), sold: true });
  }

  async function save() {
    const sizes = rows.map((row) => {
      const price = whole(row.quotes.tai_tiem.price);
      const quotes: Record<string, { price: number | null; listPrice: number | null; minTotal: number | null; sold: boolean }> = {};
      for (const channel of CHANNELS) {
        const quote = row.quotes[channel];
        quotes[channel] = {
          price: optionalWhole(quote.price),
          listPrice: optionalWhole(quote.listPrice),
          minTotal: optionalWhole(quote.minTotal),
          sold: quote.sold,
        };
      }
      return {
        skuId: row.skuId,
        widthCm: whole(row.width),
        heightCm: whole(row.height),
        sheets: whole(row.sheets),
        price,
        quotes,
        minTotal: optionalWhole(row.quotes.tai_tiem.minTotal),
      };
    });
    setSaving(true);
    try {
      const payload = { name, category, description, turnaround, sizes, listed };
      const saved = editing && groupId
        ? await updateWebProduct({ data: { groupId, ...payload } })
        : await createWebProduct({ data: payload });
      if (coverFile) {
        try {
          await uploadCover(saved.slug, coverFile);
        } catch (error) {
          toast.error(`Đã lưu sản phẩm nhưng chưa lưu ảnh bìa: ${(error as Error).message}`);
        }
      }
      for (const file of galleryFiles) {
        try {
          await uploadGallery(saved.slug, file);
        } catch (error) {
          toast.error(`Chưa lưu ảnh thư viện ${file.name}: ${(error as Error).message}`);
        }
      }
      toast.success(editing ? `Đã lưu ${saved.name}` : listed ? `Đã thêm ${saved.name} lên trang chủ` : `Đã thêm ${saved.name} (đang ẩn)`);
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
          <DialogTitle>{editing ? "Sửa sản phẩm và giá 6 kênh" : "Tạo sản phẩm và giá 6 kênh"}</DialogTitle>
        </DialogHeader>
        {loading ? (
          <p className="text-sm text-muted-foreground">Đang tải sản phẩm…</p>
        ) : (
          <div className="space-y-3">
            <label className="block text-sm font-semibold">
              Tên sản phẩm
              <Input className="mt-1 min-h-11" value={name} onChange={(event) => setName(event.target.value)} placeholder="Ảnh canvas" />
            </label>
            <label className="block text-sm font-semibold">
              Nhóm / danh mục
              <Input className="mt-1 min-h-11" value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Ảnh gỗ" />
            </label>
            <label className="block text-sm font-semibold">
              Mô tả ngắn
              <textarea className="mt-1 min-h-20 w-full rounded-xl border bg-card px-3 py-2 text-sm" value={description} onChange={(event) => setDescription(event.target.value)} />
            </label>
            <label className="block text-sm font-semibold">
              Ghi chú thời gian
              <Input className="mt-1 min-h-11" value={turnaround} onChange={(event) => setTurnaround(event.target.value)} placeholder="Để trống nếu chưa chốt lịch" />
            </label>
            <div className="space-y-3">
              <p className="text-sm font-semibold">Khổ và giá từng kênh</p>
              {rows.map((row, index) => (
                <div key={row.skuId ?? index} className="space-y-3 rounded-2xl border bg-slate-50 p-3">
                  <div className="grid grid-cols-3 gap-2">
                    <label className="text-xs font-semibold text-muted-foreground">
                      Rộng (cm)
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.width} onChange={(event) => patchRow(index, { width: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Cao (cm)
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.height} onChange={(event) => patchRow(index, { height: event.target.value })} />
                    </label>
                    <label className="text-xs font-semibold text-muted-foreground">
                      Số tấm
                      <Input className="mt-1 min-h-11 bg-white" inputMode="numeric" value={row.sheets} onChange={(event) => patchRow(index, { sheets: event.target.value })} />
                    </label>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button type="button" variant="outline" className="min-h-9 text-xs" onClick={() => copyRetail(index)}>
                      Chép giá Tại tiệm sang Facebook/TikTok/Shopee
                    </Button>
                    <Button type="button" variant="outline" className="min-h-9 text-xs" onClick={() => fillCtv(index)}>
                      Tự tính CTV = 90%
                    </Button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                    {CHANNELS.map((channel) => {
                      const quote = row.quotes[channel];
                      return (
                        <div key={channel} className="rounded-xl border bg-white p-2.5">
                          <label className="flex items-center justify-between gap-2 text-xs font-semibold">
                            <span>
                              {CHANNEL_LABEL[channel]}
                              <span className="ml-1 font-normal text-muted-foreground">· {CHANNEL_HINT[channel]}</span>
                            </span>
                            <span className="inline-flex items-center gap-1 font-medium">
                              <input type="checkbox" className="size-4" checked={quote.sold} onChange={(event) => patchQuote(index, channel, { sold: event.target.checked })} />
                              Đang bán
                            </span>
                          </label>
                          <label className="mt-2 block text-[11px] text-muted-foreground">
                            Giá bán
                            <Input className="mt-1 min-h-10" inputMode="numeric" value={quote.price} placeholder="Để trống nếu không bán" onChange={(event) => patchQuote(index, channel, { price: event.target.value.replace(/[^\d]/g, "") })} />
                          </label>
                          <div className="mt-1 grid grid-cols-2 gap-2">
                            <label className="text-[11px] text-muted-foreground">
                              Giá gạch
                              <Input className="mt-1 min-h-10" inputMode="numeric" value={quote.listPrice} onChange={(event) => patchQuote(index, channel, { listPrice: event.target.value.replace(/[^\d]/g, "") })} />
                            </label>
                            <label className="text-[11px] text-muted-foreground">
                              Đơn tối thiểu
                              <Input className="mt-1 min-h-10" inputMode="numeric" value={quote.minTotal} placeholder="vd 30000" onChange={(event) => patchQuote(index, channel, { minTotal: event.target.value.replace(/[^\d]/g, "") })} />
                            </label>
                          </div>
                        </div>
                      );
                    })}
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
            <label className="block text-sm font-semibold">
              Ảnh đại diện (JPG, PNG hoặc WEBP, tối đa 2MB)
              <input className="mt-1 block w-full text-sm" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => setCoverFile(event.target.files?.[0] ?? null)} />
            </label>
            <label className="block text-sm font-semibold">
              Thư viện ảnh thêm
              <input className="mt-1 block w-full text-sm" type="file" multiple accept="image/jpeg,image/png,image/webp" onChange={(event) => setGalleryFiles(Array.from(event.target.files ?? []))} />
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm font-semibold">
              <input type="checkbox" className="size-4" checked={listed} onChange={(event) => setListed(event.target.checked)} />
              Hiện trên trang chủ nhainthienthien.com (chỉ giá tại tiệm)
            </label>
            <Button className="min-h-12 bg-accent text-accent-foreground" disabled={saving} onClick={() => void save()}>
              {saving ? "Đang lưu…" : editing ? "Lưu sản phẩm và giá 6 kênh" : listed ? "Tạo và hiện trên trang chủ" : "Tạo sản phẩm (đang ẩn)"}
            </Button>
            <p className="text-xs text-muted-foreground">Lưu một lần là ghi sản phẩm và giá cả 6 kênh. Giá CTV / Mơ Home chỉ dùng trong quản trị, không hiện trên trang công khai.</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
