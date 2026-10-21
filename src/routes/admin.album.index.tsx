import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ListPager, useListPage } from "@/components/admin/list-page";
import { PageToolbar } from "@/components/admin/page-toolbar";
import { Button } from "@/components/ui/button";
import { SHARED_UPLOAD_PATH } from "@/domain/order-upload";
import { getPhotoAlbums } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/album/")({
  component: AlbumListPage,
});

function AlbumListPage() {
  const navigate = useNavigate();
  const albums = useQuery({ queryKey: ["albums"], queryFn: () => getPhotoAlbums() });
  const [search, setSearch] = useState("");
  const [image, setImage] = useState<string | null>(null);
  const link = typeof window === "undefined" ? "" : `${window.location.origin}${SHARED_UPLOAD_PATH}`;
  const filtered = (albums.data ?? []).filter((album) => album.phone.includes(search.replace(/\D/g, "")) || album.orderCode.toLowerCase().includes(search.trim().toLowerCase()));
  const page = useListPage(filtered, search);

  useEffect(() => {
    if (!link) return;
    let cancel = false;
    void import("qrcode").then((QR) =>
      QR.toDataURL(link, { width: 320, margin: 2, errorCorrectionLevel: "M" }).then((url) => {
        if (!cancel) setImage(url);
      }),
    );
    return () => {
      cancel = true;
    };
  }, [link]);

  if (albums.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (albums.isError) return <p className="font-semibold text-destructive">{(albums.error as Error).message}</p>;

  return (
    <div className="space-y-4">
      <PageToolbar title="Album ảnh" hint="Một mã QR cho mọi khách. Album mang tên số điện thoại." search={search} onSearch={setSearch} searchPlaceholder="Tìm số hoặc mã đơn" />
      <section className="glass-card flex flex-col items-center gap-3 rounded-3xl p-4 sm:flex-row sm:items-start">
        {image ? <img src={image} alt="Mã QR gửi ảnh chung" width={220} height={220} className="h-auto w-[220px] max-w-full" /> : <p className="grid h-[220px] w-[220px] place-items-center text-sm text-muted-foreground">Đang tạo mã…</p>}
        <div className="min-w-0 space-y-2">
          <h2 className="font-bold text-primary">Mã chung</h2>
          <p className="text-sm text-muted-foreground">Khách quét, nhập số điện thoại và gửi ảnh. In hoặc gửi mã này một lần.</p>
          {link ? <p className="break-all text-xs text-muted-foreground">{link}</p> : null}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              className="min-h-11"
              onClick={() => {
                void navigator.clipboard.writeText(link).then(
                  () => toast.success("Đã chép liên kết"),
                  () => toast.error("Không chép được"),
                );
              }}
            >
              Chép liên kết
            </Button>
            {image ? (
              <Button asChild type="button" variant="outline" className="min-h-11">
                <a href={image} download="qr-gui-anh.png">
                  Tải mã QR
                </a>
              </Button>
            ) : null}
          </div>
        </div>
      </section>
      <div className="hidden overflow-x-auto rounded-2xl border md:block">
        <table className="w-full text-sm">
          <thead className="bg-muted/40 text-left">
            <tr>
              <th className="px-3 py-2 font-semibold">Số điện thoại</th>
              <th className="px-3 py-2 font-semibold">Ảnh</th>
              <th className="px-3 py-2 font-semibold">Đơn</th>
            </tr>
          </thead>
          <tbody>
            {page.slice.map((album) => (
              <tr
                key={album.id}
                className="cursor-pointer border-t"
                onClick={() => void navigate({ to: "/admin/album/$id", params: { id: album.id } })}
              >
                <td className="px-3 py-3 font-semibold">{album.phone}</td>
                <td className="px-3 py-3">{album.fileCount}</td>
                <td className="px-3 py-3">{album.orderCode || "Chưa gắn"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-2 md:hidden">
        {page.slice.map((album) => (
          <li key={album.id}>
            <Link to="/admin/album/$id" params={{ id: album.id }} className="glass-card block rounded-2xl p-3">
              <p className="font-semibold">{album.phone}</p>
              <p className="text-sm text-muted-foreground">
                {album.fileCount} ảnh · {album.orderCode || "Chưa gắn đơn"}
              </p>
            </Link>
          </li>
        ))}
      </ul>
      {filtered.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có album. Đưa mã QR cho khách quét.</p> : null}
      <ListPager page={page.page} pages={page.pages} total={page.total} start={page.start} count={page.slice.length} noun="album" onPage={page.setPage} />
    </div>
  );
}
