import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ProductEditor } from "@/components/admin/product-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { workbookXml } from "@/domain/excel";
import { productExcelTemplateRows, productsToExcelRows } from "@/domain/product-excel";
import { CHANNEL_LABEL, CHANNELS } from "@/domain/types";
import { formatVnd } from "@/lib/brand";
import { getWebProduct, getWebProducts, importWebProducts } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/san-pham")({
  component: AdminProductsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    m: search["m"] === "nhap" ? ("nhap" as const) : undefined,
  }),
});

function AdminProductsPage() {
  const { m } = Route.useSearch();
  const products = useQuery({ queryKey: ["web-products"], queryFn: () => getWebProducts() });
  const [createOpen, setCreateOpen] = useState(m === "nhap");
  const [editId, setEditId] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; base64: string } | null>(null);
  const [conflictPreview, setConflictPreview] = useState<string[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => products.data ?? [], [products.data]);

  function refresh() {
    void products.refetch();
  }

  function downloadBlob(filename: string, xml: string) {
    const blob = new Blob([xml], { type: "application/vnd.ms-excel" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportTemplate() {
    downloadBlob("mau-san-pham.xls", workbookXml([{ name: "SanPham", rows: productExcelTemplateRows() }]));
    toast.success("Đã tải file mẫu Excel.");
  }

  async function exportCurrent() {
    try {
      const detailed = await Promise.all(
        rows.map(async (item) => {
          const full = await getWebProduct({ data: { groupId: item.id } });
          return {
            code: item.code ?? item.id,
            name: full.name,
            category: full.category,
            description: full.description,
            sizes: full.sizes
              .filter((size) => size.widthCm != null && size.heightCm != null)
              .map((size) => ({
                widthCm: size.widthCm as number,
                heightCm: size.heightCm as number,
                sheets: size.sheets,
                quotes: Object.fromEntries(
                  CHANNELS.map((channel) => {
                    const quote = size.quotes[channel];
                    return [channel, { price: quote?.price ?? null, sold: Boolean(quote?.sold) }];
                  }),
                ),
              })),
          };
        }),
      );
      downloadBlob("san-pham.xls", workbookXml([{ name: "SanPham", rows: productsToExcelRows(detailed) }]));
      toast.success("Đã xuất danh sách sản phẩm.");
    } catch (error) {
      toast.error((error as Error).message);
    }
  }

  async function onPickFile(file: File | null) {
    if (!file) return;
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) binary += String.fromCharCode(bytes[i]!);
    const base64 = btoa(binary);
    setPendingFile({ name: file.name, base64 });
    setConflictPreview([]);
    setImportOpen(true);
  }

  async function runImport(overwrite: boolean) {
    if (!pendingFile) return;
    setImporting(true);
    try {
      const result = await importWebProducts({
        data: { filename: pendingFile.name, base64: pendingFile.base64, overwrite },
      });
      const parts: string[] = [];
      if (result.created) parts.push(`tạo mới ${result.created}`);
      if (result.overwritten) parts.push(`ghi đè ${result.overwritten}`);
      if (result.skipped) parts.push(`bỏ qua ${result.skipped} (trùng, chưa ghi đè)`);
      toast.success(parts.length ? `Nhập xong: ${parts.join(", ")}.` : "Không có dòng nào được nhập.");
      if (result.overwrittenNames?.length) {
        toast.message("Đã ghi đè", { description: result.overwrittenNames.slice(0, 8).join("\n") });
      }
      if (result.skippedNames?.length) {
        toast.message("Bỏ qua vì trùng (chưa ghi đè)", {
          description: result.skippedNames.slice(0, 8).join("\n"),
        });
        setConflictPreview(result.skippedNames);
      } else {
        setImportOpen(false);
        setPendingFile(null);
        setConflictPreview([]);
      }
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setImporting(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Quản lý sản phẩm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi mã = một khổ hoặc một combo (giá riêng). Cùng nhóm (vd Tráng gương) nhưng không gộp nhiều khổ vào một mã.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={exportTemplate}>
            Xuất file mẫu
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => void exportCurrent()} disabled={!rows.length}>
            Xuất Excel
          </Button>
          <Button type="button" variant="outline" className="min-h-11" onClick={() => fileRef.current?.click()}>
            Tạo bằng Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
            className="hidden"
            onChange={(event) => void onPickFile(event.target.files?.[0] ?? null)}
          />
          <Button type="button" className="min-h-11 bg-accent text-accent-foreground" onClick={() => setCreateOpen(true)}>
            Tạo sản phẩm lẻ
          </Button>
        </div>
      </div>

      {products.isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[52rem] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">STT</th>
                <th className="px-3 py-3 font-semibold">Mã</th>
                <th className="px-3 py-3 font-semibold">Tên</th>
                <th className="px-3 py-3 font-semibold">Nhóm</th>
                <th className="px-3 py-3 font-semibold">Khổ / combo</th>
                <th className="px-3 py-3 font-semibold">Giá từng kênh</th>
                <th className="px-3 py-3 font-semibold">Sửa</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((item, index) => {
                const size = item.sizes?.[0];
                const multi = (item.sizes ?? []).length > 1;
                return (
                  <tr key={item.id} className="border-b last:border-0 align-top">
                    <td className="px-3 py-3 tabular-nums text-muted-foreground">{index + 1}</td>
                    <td className="px-3 py-3 font-mono text-xs font-semibold uppercase">
                      {(item.code ?? item.id).replace(/_/g, "-").toUpperCase()}
                    </td>
                    <td className="px-3 py-3 font-medium">{item.name}</td>
                    <td className="px-3 py-3">{item.category}</td>
                    <td className="px-3 py-3 text-sm">
                      {size ? (
                        <>
                          {size.widthCm ?? "?"}×{size.heightCm ?? "?"} cm
                          {(size.sheets ?? 1) > 1 ? ` · Combo ${size.sheets} tấm` : " · lẻ"}
                          {multi ? (
                            <span className="mt-1 block text-xs text-amber-700">Mã cũ gom {item.sizes!.length} khổ — nên tách</span>
                          ) : null}
                        </>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3">
                      <div className="text-xs leading-relaxed">
                        {size
                          ? CHANNELS.map((channel) => {
                              const quote = size.quotes?.[channel];
                              if (!quote) return null;
                              return (
                                <p key={channel} className={quote.sold ? "text-foreground" : "text-muted-foreground"}>
                                  {CHANNEL_LABEL[channel]}:{" "}
                                  {quote.price != null ? formatVnd(quote.price) : "—"}
                                  {quote.sold ? "" : " · không bán"}
                                </p>
                              );
                            })
                          : (
                            <p className="text-muted-foreground">
                              {item.from != null ? `Từ ${formatVnd(item.from)}` : "Chưa có giá"}
                            </p>
                          )}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <Button type="button" variant="outline" className="min-h-10" onClick={() => setEditId(item.id)}>
                        Sửa
                      </Button>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    Chưa có sản phẩm. Tạo lẻ hoặc nhập từ Excel (mỗi dòng một mã).
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      )}

      <ProductEditor open={createOpen} onOpenChange={setCreateOpen} onSaved={refresh} />
      <ProductEditor
        open={Boolean(editId)}
        groupId={editId}
        onOpenChange={(open) => {
          if (!open) setEditId(null);
        }}
        onSaved={refresh}
      />

      <Dialog
        open={importOpen}
        onOpenChange={(open) => {
          setImportOpen(open);
          if (!open) {
            setPendingFile(null);
            setConflictPreview([]);
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Nhập sản phẩm từ Excel</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 text-sm">
            <p>
              File: <span className="font-semibold">{pendingFile?.name ?? "—"}</span>
            </p>
            <p className="text-muted-foreground">
              Mỗi dòng = một mã (một khổ hoặc một combo). Trùng mã/tên: chọn «Ghi đè» để cập nhật, hoặc «Chỉ tạo mới» để bỏ qua.
            </p>
            {conflictPreview.length ? (
              <div className="rounded-xl border border-amber-300 bg-amber-50 px-3 py-2 text-amber-950">
                <p className="font-semibold">Trùng — cần ghi đè nếu muốn cập nhật:</p>
                <ul className="mt-1 list-disc pl-5 text-xs">
                  {conflictPreview.slice(0, 12).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button type="button" variant="outline" className="min-h-11" disabled={importing} onClick={() => void runImport(false)}>
                {importing ? "Đang nhập…" : "Chỉ tạo mới (bỏ qua trùng)"}
              </Button>
              <Button type="button" className="min-h-11 bg-accent text-accent-foreground" disabled={importing} onClick={() => void runImport(true)}>
                {importing ? "Đang nhập…" : "Ghi đè nếu trùng"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
