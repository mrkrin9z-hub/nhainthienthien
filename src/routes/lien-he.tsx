import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Clock, Globe, MapPin, MessageCircle, Phone } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";

export const Route = createFileRoute("/lien-he")({
  head: () => ({
    meta: [
      { title: "Liên hệ Nhà In Thiên Thiên — Xuân Lộc, Đồng Nai" },
      {
        name: "description",
        content:
          "Liên hệ Nhà In Thiên Thiên qua Zalo 0778 662 227 để được tư vấn in ảnh, báo giá và hỗ trợ đơn gấp.",
      },
      { property: "og:title", content: "Liên hệ Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "Zalo 0778 662 227 — tư vấn in ảnh giá xưởng tại Xuân Lộc, Đồng Nai.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: ContactPage,
});

function ContactPage() {
  const config = useQuery(publicConfigQueryOptions);
  const phone = config.data?.phone ?? BRAND.phone;
  const phoneRaw = config.data?.phoneRaw ?? BRAND.phoneRaw;
  const zalo = config.data?.zalo ?? BRAND.zalo;
  const hours = config.data?.hours ?? "08:00 – 20:00";
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Liên hệ</h1>
        <p className="mt-2 text-muted-foreground">
          {BRAND.slogan} {BRAND.message}
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          <a href={zalo} className="glass-card rounded-3xl p-5">
            <MessageCircle className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Zalo tư vấn</h2>
            <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
          </a>
          <a href={`tel:${phoneRaw}`} className="glass-card rounded-3xl p-5">
            <Phone className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Gọi điện</h2>
            <p className="mt-1 text-sm text-muted-foreground">{phone}</p>
          </a>
          <div className="glass-card rounded-3xl p-5">
            <MapPin className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Khu vực</h2>
            <p className="mt-1 text-sm text-muted-foreground">{BRAND.region}</p>
          </div>
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
