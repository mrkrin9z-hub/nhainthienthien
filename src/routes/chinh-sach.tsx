import { createFileRoute, Link } from "@tanstack/react-router";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { BRAND } from "@/lib/brand";
import { DEPOSIT, NO_RETURN, PAYMENT, PUBLIC_HOURS, REPRINT, SHIP_LARGE, SHIP_PICKUP, SHIP_SMALL } from "@/lib/public-policy";

export const Route = createFileRoute("/chinh-sach")({
  head: () => ({
    meta: [
      { title: "Chính sách bán hàng — Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Phí ship, thanh toán COD, đặt cọc, in lại và đổi trả tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Chính sách bán hàng — Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "Phí ship, COD, cọc 50%, in lại khi lỗi do xưởng và không đổi trả vì đổi ý.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: PolicyPage,
});

const SECTIONS = [
  { title: "Phí ship — ảnh nhỏ", body: SHIP_SMALL },
  { title: "Phí ship — ảnh lớn", body: SHIP_LARGE },
  { title: "Nhận tại tiệm", body: SHIP_PICKUP },
  { title: "Thanh toán", body: PAYMENT },
  { title: "Đặt cọc", body: DEPOSIT },
  { title: "In lại", body: REPRINT },
  { title: "Đổi trả", body: NO_RETURN },
  { title: "Giờ mở cửa", body: PUBLIC_HOURS },
];

function PolicyPage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Chính sách bán hàng</h1>
        <p className="mt-2 text-muted-foreground">
          Áp dụng khi đặt trên web, Facebook hoặc Zalo của {BRAND.shortName}. Đơn TikTok và Shopee theo quy định của sàn.
        </p>
        <p className="mt-1 text-sm text-muted-foreground">{BRAND.address}</p>

        <div className="mt-8 space-y-5">
          {SECTIONS.map((section) => (
            <section key={section.title} className="glass-card rounded-3xl p-5">
              <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{section.body}</p>
            </section>
          ))}
        </div>

        <p className="mt-8 text-sm">
          <Link to="/dat-in" className="font-semibold text-primary hover:underline">
            Đặt in online
          </Link>
          {" · "}
          <Link to="/huong-dan" className="font-semibold text-primary hover:underline">
            Hướng dẫn gửi ảnh
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
