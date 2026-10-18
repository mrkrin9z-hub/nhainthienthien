import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getMe, getPhotoAlbum, linkPhotoAlbum } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/album/$id")({
  component: AlbumDetailPage,
});

function AlbumDetailPage() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const album = useQuery({ queryKey: ["album", id], queryFn: () => getPhotoAlbum({ data: { albumId: id } }) });
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const data = album.data;
  const canLink = me.data?.role === "owner" || me.data?.role === "sale";

  if (!data) return <p className="text-muted-foreground">{album.isError ? (album.error as Error).message : "Đang tải…"}</p>;

  return (
    <div className="space-y-4">
      <div>
        <Link to="/admin/album" className="text-sm text-muted-foreground">
          Quay lại album
        </Link>
        <h1 className="text-2xl font-extrabold text-primary">{data.phone}</h1>
        <p className="text-sm text-muted-foreground">Album này là thư mục ảnh của số {data.phone}.</p>
      </div>
      {canLink ? (
        <section className="glass-card space-y-3 rounded-3xl p-4">
          <h2 className="font-bold text-primary">Liên kết đơn</h2>
          {data.orderCode ? (
            <p className="text-sm">
              Đang gắn với{" "}
              <Link to="/admin/don-hang/$code" params={{ code: data.orderCode }} className="font-semibold text-primary">
                {data.orderCode}
              </Link>
              . Có thể gắn sang đơn khác.
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">Ảnh sẽ được đưa vào mục Ảnh khách của đơn.</p>
          )}
          <div className="flex flex-wrap items-end gap-2">
            <label className="min-w-0 flex-1 text-sm font-semibold">
              Mã đơn
              <Input className="mt-1 min-h-11" value={code} placeholder="TT..." onChange={(event) => setCode(event.target.value)} />
            </label>
            <Button
              type="button"
              className="min-h-11"
              disabled={busy || code.trim().length < 4}
              onClick={async () => {
                setBusy(true);
                try {
                  const result = await linkPhotoAlbum({ data: { albumId: data.id, code: code.trim() } });
                  toast.success(`Đã gắn vào ${result.orderCode}`);
                  setCode("");
                  await queryClient.invalidateQueries({ queryKey: ["album", id] });
                  await queryClient.invalidateQueries({ queryKey: ["albums"] });
                  await queryClient.invalidateQueries({ queryKey: ["order", result.orderCode] });
                } catch (error) {
                  toast.error((error as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              Liên kết đơn
            </Button>
          </div>
        </section>
      ) : data.orderCode ? (
        <p className="text-sm">
          Gắn với đơn{" "}
          <Link to="/admin/don-hang/$code" params={{ code: data.orderCode }} className="font-semibold text-primary">
            {data.orderCode}
          </Link>
        </p>
      ) : null}
      {data.files.length === 0 ? <p className="text-sm text-muted-foreground">Chưa có ảnh.</p> : null}
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {data.files.map((file) => (
          <li key={file.id} className="glass-card overflow-hidden rounded-2xl">
            <a href={`/api/staff/file/${file.id}`}>
              <img src={`/api/staff/file/${file.id}`} alt={file.name} className="h-36 w-full object-cover" />
              <span className="block truncate px-2 py-2 text-xs font-semibold">{file.name}</span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
