import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { SHARED_UPLOAD_PATH } from "@/domain/order-upload";
import { getPhotoAlbums } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/album/")({
  component: () => (
    <RoleGate allow={["owner", "sale", "production"]}>
      <AlbumHome />
    </RoleGate>
  ),
});

type Row = {
  id: string;
  phone: string;
  customerName: string;
  fileCount: number;
  updatedAt: string;
  orderId: string | null;
  orderCode: string;
};

function AlbumHome() {
  const [rows, setRows] = useState<Row[]>([]);
  const [query, setQuery] = useState("");
  const [link, setLink] = useState("");
  const [qr, setQr] = useState<string | null>(null);

  async function reload() {
    try {
      const list = await getPhotoAlbums();
      setRows(list as Row[]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Không tải được album");
    }
  }

  useEffect(() => {
    void reload();
  }, []);

  useEffect(() => {
    const href = typeof window !== "undefined" ? `${window.location.origin}${SHARED_UPLOAD_PATH}` : SHARED_UPLOAD_PATH;
    setLink(href);
    let cancel = false;
    void import("qrcode").then((QR) => {
      void QR.toDataURL(href, { width: 280, margin: 1, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setQr(url);
      });
    });
    return () => {
      cancel = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase().replace(/\s+/g, "");
    if (!needle) return rows;
    return rows.filter((row) => {
      const phone = row.phone.replace(/\s+/g, "").toLowerCase();
      const name = (row.customerName || "").toLowerCase();
      const code = (row.orderCode || "").toLowerCase();
      return phone.includes(needle) || name.includes(needle) || code.includes(needle);
    });
  }, [rows, query]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">Quản lý hình ảnh</h1>
        <p className="text-sm text-muted-foreground">
          Một mã QR chung. Khách quét, nhập tên + SĐT và gửi ảnh. Nhân viên tìm theo tên hoặc số để lấy ảnh, rồi tạo đơn sau.
        </p>
      </div>

      <section className="flex flex-wrap items-start gap-4 rounded-xl border bg-card p-4">
        {qr ? (
          <img src={qr} alt="Mã QR gửi ảnh" width={140} height={140} className="h-35 w-35 rounded-md border bg-white p-1" />
        ) : (
          <div className="grid h-35 w-35 place-items-center rounded-md border text-xs text-muted-foreground">Đang tạo mã…</div>
        )}
        <div className="min-w-0 flex-1 space-y-2">
          <h2 className="font-semibold text-primary">QR / link gửi ảnh nhanh</h2>
          <p className="break-all font-mono text-sm font-semibold text-primary">{link || SHARED_UPLOAD_PATH}</p>
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              className="min-h-10"
              onClick={() => {
                void navigator.clipboard.writeText(link || SHARED_UPLOAD_PATH).then(
                  () => toast.success("Đã chép link"),
                  () => toast.error("Không chép được"),
                );
              }}
            >
              Chép link
            </Button>
            <Button type="button" variant="outline" className="min-h-10" asChild>
              <a href={link || SHARED_UPLOAD_PATH} target="_blank" rel="noreferrer">
                Mở trang khách
              </a>
            </Button>
          </div>
        </div>
      </section>

      <div className="flex flex-wrap items-center gap-2">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Tìm theo tên hoặc số điện thoại…"
          className="min-h-10 max-w-sm"
        />
        <Button type="button" variant="outline" className="min-h-10" onClick={() => void reload()}>
          Tải lại
        </Button>
      </div>

      <ul className="divide-y rounded-xl border bg-card">
        {filtered.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-2 px-4 py-3">
            <div className="min-w-0">
              <p className="font-semibold text-primary">
                {row.customerName ? `${row.customerName} · ` : ""}
                {row.phone}
              </p>
              <p className="text-xs text-muted-foreground">
                {row.fileCount} ảnh · cập nhật {new Date(row.updatedAt).toLocaleString("vi-VN")}
                {row.orderCode ? ` · đã gắn ${row.orderCode}` : " · chưa gắn đơn"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button asChild variant="outline" className="min-h-10">
                <Link to="/admin/album/$id" params={{ id: row.id }}>
                  Xem ảnh
                </Link>
              </Button>
              {!row.orderId ? (
                <Button asChild className="min-h-10">
                  <Link
                    to="/orders/create"
                    search={{ phone: row.phone, name: row.customerName || undefined, album: row.id }}
                  >
                    Tạo đơn
                  </Link>
                </Button>
              ) : null}
            </div>
          </li>
        ))}
        {!filtered.length ? (
          <li className="px-4 py-8 text-center text-sm text-muted-foreground">
            {rows.length ? "Không khớp tên hoặc số đã tìm." : "Chưa có ảnh. Đưa mã QR cho khách gửi trước."}
          </li>
        ) : null}
      </ul>
    </div>
  );
}
