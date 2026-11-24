import { useQuery } from "@tanstack/react-query";
import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { ProductEditor } from "@/components/admin/product-editor";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { workbookXml } from "@/domain/excel";
import { productExcelTemplateRows, productsToExcelRows } from "@/domain/product-excel";
import { CHANNEL_LABEL, CHANNELS } from "@/domain/types";
import { formatVnd } from "@/lib/brand";
import {
  createProductCategoryFn,
  deleteProductCategoryFn,
  deleteWebProductFn,
  getMe,
  getProductCategories,
  getWebProduct,
  getWebProducts,
  importWebProducts,
  renameProductCategoryFn,
} from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/san-pham")({
  component: AdminProductsPage,
  validateSearch: (search: Record<string, unknown>) => ({
    m: search["m"] === "nhap" ? ("nhap" as const) : undefined,
  }),
});

function AdminProductsPage() {
  const { m } = Route.useSearch();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const products = useQuery({ queryKey: ["web-products"], queryFn: () => getWebProducts() });
  const categories = useQuery({ queryKey: ["product-categories"], queryFn: () => getProductCategories() });
  const [createOpen, setCreateOpen] = useState(m === "nhap");
  const [editId, setEditId] = useState<string | null>(null);
  const [groupsOpen, setGroupsOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [importing, setImporting] = useState(false);
  const [pendingFile, setPendingFile] = useState<{ name: string; base64: string } | null>(null);
  const [conflictPreview, setConflictPreview] = useState<string[]>([]);
  const [q, setQ] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const rows = useMemo(() => {
    const list = products.data ?? [];
    const needle = q.trim().toLocaleLowerCase("vi");
    return list.filter((item) => {
      if (categoryFilter !== "all") {
        if (item.category.trim().toLocaleLowerCase("vi") !== categoryFilter.toLocaleLowerCase("vi")) return false;
      }
      if (!needle) return true;
      const hay = `${item.name} ${item.category} ${item.code ?? item.id}`.toLocaleLowerCase("vi");
      return hay.includes(needle);
    });
  }, [products.data, q, categoryFilter]);

  const categoryOptions = categories.data?.categories ?? [];

  function refresh() {
    void products.refetch();
    void categories.refetch();
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
      const source = rows.length ? rows : (products.data ?? []);
      const detailed = await Promise.all(
        source.map(async (item) => {
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

  async function removeProduct(item: { id: string; name: string; code?: string }) {
    const label = (item.code ?? item.id).toUpperCase();
    const ok = window.confirm(`Xóa sản phẩm ${label} — ${item.name}?\nKhông hoàn tác. Đơn đang dùng mã này sẽ chặn xóa.`);
    if (!ok) return;
    setDeletingId(item.id);
    try {
      await deleteWebProductFn({ data: { groupId: item.id } });
      toast.success(`Đã xóa ${label}`);
      if (editId === item.id) setEditId(null);
      refresh();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-bold tracking-tight">Quản lý sản phẩm</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Mỗi mã = một khổ hoặc một combo. Nhóm (vd Tráng gương) quản lý riêng rồi gắn khi tạo sản phẩm.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" className="min-h-11" onClick={() => setGroupsOpen(true)}>
            Quản lý nhóm
          </Button>
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

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-3">
        <Input
          className="min-h-11 max-w-sm"
          placeholder="Tìm mã, tên, nhóm…"
          value={q}
          onChange={(event) => setQ(event.target.value)}
          aria-label="Tìm sản phẩm"
        />
        <select
          className="min-h-11 rounded-xl border border-input bg-background px-3 text-sm font-medium"
          value={categoryFilter}
          onChange={(event) => setCategoryFilter(event.target.value)}
          aria-label="Lọc theo nhóm"
        >
          <option value="all">Tất cả nhóm</option>
          {categoryOptions.map((item) => (
            <option key={item.name} value={item.name}>
              {item.name} ({item.productCount})
            </option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground">
          Hiện {rows.length}/{products.data?.length ?? 0} sản phẩm
        </p>
      </div>

      {products.isLoading ? (
        <p className="text-sm text-muted-foreground">Đang tải…</p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[56rem] text-left text-sm">
            <thead className="border-b bg-slate-50 text-xs uppercase tracking-wide text-muted-foreground">
              <tr>
                <th className="px-3 py-3 font-semibold">STT</th>
                <th className="px-3 py-3 font-semibold">Mã</th>
                <th className="px-3 py-3 font-semibold">Tên</th>
                <th className="px-3 py-3 font-semibold">Nhóm</th>
                <th className="px-3 py-3 font-semibold">Khổ / combo</th>
                <th className="px-3 py-3 font-semibold">Giá từng kênh</th>
                <th className="px-3 py-3 font-semibold">Thao tác</th>
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
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" variant="outline" className="min-h-10" onClick={() => setEditId(item.id)}>
                          Sửa
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          className="min-h-10 border-rose-300 text-rose-700 hover:bg-rose-50"
                          disabled={deletingId === item.id}
                          onClick={() => void removeProduct(item)}
                        >
                          {deletingId === item.id ? "Đang xóa…" : "Xóa"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {!rows.length ? (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-sm text-muted-foreground">
                    {products.data?.length
                      ? "Không khớp bộ lọc. Thử đổi nhóm hoặc xóa ô tìm."
                      : "Chưa có sản phẩm. Tạo nhóm trước (nếu cần), rồi tạo lẻ hoặc nhập Excel."}
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

      <CategoryManagerDialog
        open={groupsOpen}
        onOpenChange={setGroupsOpen}
        canDelete={me.data?.role === "owner"}
        onChanged={refresh}
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

function CategoryManagerDialog({
  open,
  onOpenChange,
  canDelete,
  onChanged,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  canDelete: boolean;
  onChanged: () => void;
}) {
  const cats = useQuery({ queryKey: ["product-categories"], queryFn: () => getProductCategories(), enabled: open });
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<string | null>(null);
  const [editName, setEditName] = useState("");

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        onOpenChange(next);
        if (!next) {
          setName("");
          setEditing(null);
          setEditName("");
        }
      }}
    >
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Quản lý nhóm sản phẩm</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Tạo / đổi tên nhóm (vd Tráng gương). Đổi tên sẽ cập nhật mọi sản phẩm trong nhóm. Xóa chỉ khi không còn sản phẩm.
          </p>
          <form
            className="flex flex-wrap gap-2"
            onSubmit={async (event) => {
              event.preventDefault();
              setBusy(true);
              try {
                await createProductCategoryFn({ data: { name } });
                toast.success(`Đã tạo nhóm «${name.trim()}»`);
                setName("");
                await cats.refetch();
                onChanged();
              } catch (error) {
                toast.error((error as Error).message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <Input
              className="min-h-11 min-w-[12rem] flex-1"
              placeholder="Tên nhóm mới…"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
              minLength={2}
              maxLength={40}
            />
            <Button type="submit" className="min-h-11" disabled={busy || name.trim().length < 2}>
              {busy ? "Đang tạo…" : "Tạo nhóm"}
            </Button>
          </form>
          <ul className="max-h-80 space-y-1 overflow-auto rounded-xl border p-2">
            {(cats.data?.categories ?? []).map((item) => (
              <li key={item.name} className="rounded-lg px-2 py-2 text-sm hover:bg-muted/50">
                {editing === item.name ? (
                  <form
                    className="flex flex-wrap items-center gap-2"
                    onSubmit={async (event) => {
                      event.preventDefault();
                      setBusy(true);
                      try {
                        const result = await renameProductCategoryFn({ data: { from: item.name, to: editName } });
                        toast.success(
                          result.updated
                            ? `Đã đổi tên · cập nhật ${result.updated} sản phẩm`
                            : `Đã đổi tên nhóm thành «${result.name}»`,
                        );
                        setEditing(null);
                        setEditName("");
                        await cats.refetch();
                        onChanged();
                      } catch (error) {
                        toast.error((error as Error).message);
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    <Input
                      className="min-h-10 min-w-[10rem] flex-1"
                      value={editName}
                      onChange={(event) => setEditName(event.target.value)}
                      autoFocus
                      required
                      minLength={2}
                      maxLength={40}
                      aria-label={`Đổi tên nhóm ${item.name}`}
                    />
                    <Button type="submit" size="sm" className="min-h-10" disabled={busy || editName.trim().length < 2}>
                      Lưu
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      className="min-h-10"
                      disabled={busy}
                      onClick={() => {
                        setEditing(null);
                        setEditName("");
                      }}
                    >
                      Hủy
                    </Button>
                  </form>
                ) : (
                  <div className="flex items-center justify-between gap-2">
                    <span>
                      <span className="font-semibold">{item.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground">{item.productCount} sản phẩm</span>
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="min-h-9"
                        disabled={busy}
                        onClick={() => {
                          setEditing(item.name);
                          setEditName(item.name);
                        }}
                      >
                        Sửa tên
                      </Button>
                      {canDelete ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          className="min-h-9 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
                          disabled={busy || item.productCount > 0}
                          title={item.productCount > 0 ? "Còn sản phẩm trong nhóm" : "Xóa nhóm"}
                          onClick={async () => {
                            if (!window.confirm(`Xóa nhóm «${item.name}»?`)) return;
                            setBusy(true);
                            try {
                              await deleteProductCategoryFn({ data: { name: item.name } });
                              toast.success("Đã xóa nhóm");
                              await cats.refetch();
                              onChanged();
                            } catch (error) {
                              toast.error((error as Error).message);
                            } finally {
                              setBusy(false);
                            }
                          }}
                        >
                          Xóa
                        </Button>
                      ) : null}
                    </div>
                  </div>
                )}
              </li>
            ))}
            {!cats.data?.categories?.length ? (
              <li className="px-2 py-6 text-center text-sm text-muted-foreground">Chưa có nhóm. Tạo nhóm đầu tiên ở trên.</li>
            ) : null}
          </ul>
        </div>
      </DialogContent>
    </Dialog>
  );
}
