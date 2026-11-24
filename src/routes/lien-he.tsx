import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, MapPin, MessageCircle, PackageSearch, Phone, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BRAND, mapsDirectionsUrl } from "@/lib/brand";
import { ShopLinksBlock } from "@/components/site/shop-links";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

export const Route = createFileRoute("/lien-he")({
  head: () => ({
    meta: [
      { title: "Liên hệ Nhà In Thiên Thiên" },
      {
        name: "description",
        content: "Đặt in online hoặc tra cứu đơn đã gửi tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Liên hệ Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "Đặt in online và tra cứu đơn hàng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const phone = showZalo ? config.data?.phone ?? "" : "";
  const phoneRaw = showZalo ? config.data?.phoneRaw ?? "" : "";
  const zalo = showZalo ? config.data?.zalo ?? "" : "";
  const hours = config.data?.hours ?? "08:00–18:00";
  const address = config.data?.address || BRAND.address;
  const mapsHref = mapsDirectionsUrl(config.data?.mapsUrl);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Liên hệ</h1>
        <p className="mt-2 text-muted-foreground">
          Đặt in trên web, rồi tra cứu đơn bằng mã đơn và số điện thoại đã đặt.
        </p>

        <section className="glass-card mt-6 rounded-3xl p-5">
          <ShopLinksBlock />
          <p className="mt-3 text-sm text-muted-foreground">Nhắn fanpage để được tư vấn, hoặc mua ngay trên TikTok Shop / Shopee nếu bạn quen dùng sàn.</p>
        </section>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <Link to="/dat-in" className="glass-card rounded-3xl p-5">
            <UploadCloud className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Đặt in online</h2>
            <p className="mt-1 text-sm text-muted-foreground">Chọn quy cách, gửi ảnh và nhận mã đơn.</p>
          </Link>
          <Link to="/tra-cuu" className="glass-card rounded-3xl p-5">
            <PackageSearch className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Tra cứu đơn</h2>
            <p className="mt-1 text-sm text-muted-foreground">Nhập mã đơn và số điện thoại đã đặt để xem tiến trình.</p>
          </Link>
          {showZalo ? (
            <a href={zalo} className="glass-card rounded-3xl p-5">
              <MessageCircle className="size-6 text-accent" />
              <h2 className="mt-3 text-lg font-bold text-foreground">Zalo tư vấn</h2>
              <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
            </a>
          ) : null}
          {showZalo ? (
            <a href={`tel:${phoneRaw}`} className="glass-card rounded-3xl p-5">
              <Phone className="size-6 text-accent" />
              <h2 className="mt-3 text-lg font-bold text-foreground">Gọi điện</h2>
              <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
            </a>
          ) : null}
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            aria-label="Địa chỉ tiệm — mở Google Maps (tab mới)"
            data-shop-address
            className="glass-card rounded-3xl p-5 transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <MapPin className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Địa chỉ tiệm</h2>
            <p className="mt-1 text-sm text-muted-foreground">{address}</p>
            <p className="mt-2 text-sm font-semibold text-sale">Chỉ đường trên Google Maps</p>
          </a>
          <div className="glass-card rounded-3xl p-5">
            <Clock className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Thời gian làm việc</h2>
            <p className="mt-1 text-sm text-muted-foreground">{hours}</p>
          </div>
        </div>

        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="size-4 text-accent" /> {BRAND.website}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
