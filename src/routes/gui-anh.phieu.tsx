import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { CheckCircle2, ImageIcon, Phone, UserRound } from "lucide-react";

import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";
import { getAlbumReceipt } from "@/lib/orders.functions";

export const Route = createFileRoute("/gui-anh/phieu")({
  validateSearch: (search: Record<string, unknown>) => ({
    album: typeof search.album === "string" ? search.album : "",
    phone: typeof search.phone === "string" ? search.phone : "",
    name: typeof search.name === "string" ? search.name : "",
    count: typeof search.count === "string" ? search.count : "",
  }),
  head: () => ({
    meta: [
      { title: "Đã gửi ảnh | Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: AlbumReceiptPage,
});

function AlbumReceiptPage() {
  const search = Route.useSearch();
  const config = useQuery(publicConfigQueryOptions);
  const receipt = useQuery({
    queryKey: ["album-receipt", search.album, search.phone],
    queryFn: () => getAlbumReceipt({ data: { albumId: search.album, phone: search.phone } }),
    enabled: Boolean(search.album && search.phone),
  });
  const data = receipt.data;
  const name = data?.customerName || search.name || "";
  const phone = data?.phone || search.phone;
  const count = data?.fileCount ?? (Number(search.count) || 0);
  const albumCode = (data?.albumId || search.album).slice(0, 8).toUpperCase();
  const hours = config.data?.hours;
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const loading = Boolean(search.album && search.phone) && receipt.isLoading;
  const missing = !search.album || !search.phone;

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto w-full max-w-lg px-4 py-10">
        {missing ? (
          <section className="glass-card space-y-3 rounded-3xl p-6 text-center">
            <h1 className="text-2xl font-extrabold text-primary">Không thấy phiếu gửi ảnh</h1>
            <p className="text-sm text-muted-foreground">Quét lại mã QR của tiệm rồi gửi ảnh để nhận phiếu xác nhận.</p>
            <Button asChild className="min-h-12 w-full bg-accent text-accent-foreground">
              <Link to="/gui-anh">Gửi ảnh</Link>
            </Button>
          </section>
        ) : loading ? (
          <p className="text-center text-muted-foreground">Đang mở phiếu…</p>
        ) : receipt.isError && !search.count ? (
          <section className="glass-card space-y-3 rounded-3xl p-6 text-center">
            <h1 className="text-2xl font-extrabold text-primary">Chưa mở được phiếu</h1>
            <p className="text-sm text-muted-foreground">{receipt.error instanceof Error ? receipt.error.message : "Thử lại hoặc hỏi tiệm."}</p>
            <Button asChild className="min-h-12 w-full" variant="outline">
              <Link to="/gui-anh">Gửi lại ảnh</Link>
            </Button>
          </section>
        ) : (
          <section className="glass-card space-y-5 rounded-3xl p-6">
            <div className="text-center">
              <CheckCircle2 className="mx-auto size-14 text-emerald-600" />
              <h1 className="mt-3 text-3xl font-extrabold text-primary">Đã tải ảnh thành công</h1>
              <p className="mt-2 text-sm text-muted-foreground">
                Tiệm đã nhận ảnh. Giữ phiếu này để đối chiếu khi lấy hàng hoặc hỏi tiến độ.
              </p>
            </div>
            <dl className="space-y-3 rounded-2xl border border-border/70 bg-card p-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <UserRound className="size-4" /> Họ tên
                </dt>
                <dd className="font-semibold text-foreground">{name || "—"}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <Phone className="size-4" /> Số điện thoại
                </dt>
                <dd className="font-semibold tabular-nums text-foreground">{phone}</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="flex items-center gap-2 text-muted-foreground">
                  <ImageIcon className="size-4" /> Số ảnh đã nhận
                </dt>
                <dd className="font-semibold text-foreground">{count} ảnh</dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Mã album</dt>
                <dd className="font-mono font-semibold tracking-wide text-foreground">{albumCode}</dd>
              </div>
              {hours ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Giờ mở cửa</dt>
                  <dd className="text-foreground">{hours}</dd>
                </div>
              ) : null}
            </dl>
            {data?.fileNames?.length ? (
              <p className="text-xs text-muted-foreground">Ảnh: {data.fileNames.slice(0, 8).join(", ")}{data.fileNames.length > 8 ? "…" : ""}</p>
            ) : null}
            {showZalo ? (
              <a href={config.data?.zalo} className="block text-center text-sm font-semibold text-sale">
                Nhắn Zalo {config.data?.phone} nếu cần bổ sung ảnh
              </a>
            ) : null}
            <div className="flex flex-col gap-3">
              <Button asChild className="min-h-12 bg-accent text-accent-foreground">
                <Link to="/tra-cuu" search={{ phone }}>
                  Tra cứu đơn
                </Link>
              </Button>
              <Button asChild variant="outline" className="min-h-12">
                <Link to="/gui-anh">Gửi thêm ảnh</Link>
              </Button>
            </div>
          </section>
        )}
      </main>
      <SiteFooter />
    </div>
  );
}
