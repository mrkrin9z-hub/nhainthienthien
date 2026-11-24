import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, ReceiptText, ScrollText, ShoppingBag, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { POLICY_CHIPS, ProductCard, ProductCover, ShopInfoBlock } from "@/components/site/shop-ui";
import { ShopMapBlock } from "@/components/site/shop-map";
import { catalogQueryOptions, publicConfigQueryOptions } from "@/lib/catalog.functions";
import { HERO_MAIN_DESKTOP, HERO_MAIN_MOBILE, HomeHero } from "@/components/site/home-hero";
import { BRAND } from "@/lib/brand";

export const Route = createFileRoute("/")({
  loader: ({ context }) =>
    Promise.all([
      context.queryClient.ensureQueryData(catalogQueryOptions),
      context.queryClient.ensureQueryData(publicConfigQueryOptions),
    ]),
  head: () => ({
    meta: [
      { title: "Nhà In Thiên Thiên — Gửi ảnh online" },
      {
        name: "description",
        content:
          "In ảnh tráng gương 4K, thời khóa biểu, nam châm và ảnh lụa theo yêu cầu. Gửi ảnh online 3 bước, nhận mã đơn và theo dõi tiến trình.",
      },
      { property: "og:title", content: "Nhà In Thiên Thiên — In đẹp từng khoảnh khắc" },
      {
        property: "og:description",
        content: "Gửi ảnh online, xem bảng giá, nhận tại tiệm hoặc giao hàng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "preload", as: "image", href: HERO_MAIN_MOBILE, media: "(max-width: 767px)", fetchPriority: "high" },
      { rel: "preload", as: "image", href: HERO_MAIN_DESKTOP, media: "(min-width: 768px)", fetchPriority: "high" },
    ],
  }),
  component: HomePage,
});

const FAQS = [
  {
    q: "Ảnh chụp bằng điện thoại in được không?",
    a: "Được. Ảnh điện thoại đời mới in tốt tới khổ 40×60 cm. Tiệm sẽ kiểm tra và báo trước nếu ảnh chưa đủ nét cho khổ bạn chọn.",
  },
  {
    q: "Thanh toán như thế nào?",
    a: "Nhận COD khi giao hàng. Tại tiệm thanh toán tiền mặt hoặc chuyển khoản. Đơn từ 300.000đ hoặc có ảnh từ 40×60 trở lên cần cọc 50% trước khi làm hàng.",
  },
  {
    q: "Phí ship bao nhiêu?",
    a: "Ảnh 13×18 đến 40×60, thời khóa biểu, ảnh lụa, nam châm: 25.000đ, đơn từ 300.000đ thì 0đ phí ship. Ảnh 50×75 và 60×90: 30.000đ, đơn từ 450.000đ thì 0đ phí ship. Nhận tại tiệm: 0đ.",
  },
  {
    q: "In lại hoặc đổi trả thế nào?",
    a: "Lỗi do xưởng (in sai, trầy, bể khi giao, có video mở hàng): in lại không tính tiền nếu khách báo trong 3 ngày sau khi nhận. Hàng in theo yêu cầu không đổi trả vì đổi ý.",
  },
  {
    q: "Khi nào thì biết tiến trình đơn?",
    a: "Sau khi nhận đơn, tiệm cập nhật từng bước trên trang tra cứu. Tiệm hỗ trợ chỉnh sửa ảnh cơ bản.",
  },
];


const STEPS = [
  { icon: ShoppingBag, title: "Chọn sản phẩm", desc: "Chọn khổ, combo, bỏ vào giỏ." },
  { icon: UploadCloud, title: "Gửi ảnh", desc: "Tải ảnh gốc từ điện thoại." },
  { icon: ReceiptText, title: "Đặt hàng", desc: "Nhập SĐT, địa chỉ, nhận mã đơn." },
];

function HomePage() {
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data?.showZalo === true && Boolean(config.data.zalo);
  const zalo = showZalo ? (config.data?.zalo ?? "") : "";
  const phone = showZalo ? (config.data?.phone ?? "") : "";
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];

  return (
    <div className="shop-ui min-h-screen bg-shop-bg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-2.5 pb-20 md:px-6 md:pb-0 md:pt-5">
        <HomeHero
          products={products}
          title={config.data?.heroTitle}
          subtitle={config.data?.heroSubtitle}
          banner={config.data?.banner}
        />

        {/* Chính sách */}
        <section className="card mt-3 grid grid-cols-4 gap-1 px-2 py-3.5 md:py-4">
          {POLICY_CHIPS.map((chip) => (
            <Link key={chip.label} to="/chinh-sach" className="flex flex-col items-center gap-1 text-center">
              <span className="grid size-11 place-items-center rounded-2xl bg-gradient-to-b from-[#eef5fc] to-[#e1edf9] text-brand-blue">
                <chip.icon className="size-5" aria-hidden />
              </span>
              <span className="text-[10px] leading-tight text-foreground/80 md:text-xs">{chip.label}</span>
            </Link>
          ))}
        </section>

        {/* Danh mục */}
        <section className="card mt-3">
          <h2 className="section-title px-3.5 pt-3.5">Danh mục</h2>
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-2 pb-3.5 pt-3">
            {categories.map((category) => {
              const first = products.find((product) => product.category === category);
              return (
                <Link
                  key={category}
                  to="/san-pham"
                  search={{ cat: category }}
                  className="home-tile group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center transition-transform duration-200 hover:-translate-y-1"
                >
                  {first ? <ProductCover product={first} className="size-14 rounded-2xl shadow-[0_0_0_1px_rgb(18_48_71/0.06),0_6px_14px_-8px_rgb(18_48_71/0.35)]" /> : null}
                  <span className="text-xs text-foreground">{category}</span>
                </Link>
              );
            })}
            {[
              { to: "/dat-in" as const, label: "Gửi ảnh in", icon: UploadCloud },
              { to: "/tra-cuu" as const, label: "Tra cứu đơn", icon: ReceiptText },
              { to: "/chinh-sach" as const, label: "Chính sách", icon: ScrollText },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="home-tile group flex w-20 shrink-0 flex-col items-center gap-1.5 text-center transition-transform duration-200 hover:-translate-y-1">
                <span className="grid size-14 place-items-center rounded-2xl bg-gradient-to-b from-[#eef5fc] to-[#e1edf9] text-brand-blue">
                  <item.icon className="size-6" aria-hidden />
                </span>
                <span className="text-xs text-foreground">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {config.data?.commitments?.length ? (
          <section className="card mt-3 px-3.5 py-3.5">
            <h2 className="section-title">Cam kết của tiệm</h2>
            <ul className="mt-2 space-y-1.5 text-sm text-foreground/80">
              {config.data.commitments.map((item) => (
                <li key={item}>• {item}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {/* Gợi ý */}
        <section id="gian-hang" className="mt-4 scroll-mt-24">
          <h2 className="section-title px-1 pb-2.5">
            Sản phẩm đang bán
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 md:grid-cols-5 md:gap-3">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="px-3 pb-1 pt-4 text-center">
            <Link to="/san-pham" className="btn-ghost inline-flex min-h-11 items-center px-10 text-sm font-semibold">
              Xem tất cả
            </Link>
          </div>
        </section>

        {/* 3 bước */}
        <section className="card mt-3 p-3.5 md:p-5">
          <h2 className="section-title">Đặt in trong 3 bước</h2>
          <ol className="mt-3 grid grid-cols-3 gap-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-2xl bg-[#f5f8fc] p-2.5 text-center md:p-4">
                <step.icon className="mx-auto size-6 text-brand-blue" aria-hidden />
                <p className="mt-1 text-[11px] font-semibold text-sale">Bước {i + 1}</p>
                <h3 className="text-xs font-semibold text-foreground md:text-sm">{step.title}</h3>
                <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-3">
          <ShopInfoBlock hours={config.data?.hours} phone={phone} zalo={zalo} />
        </div>

        <ShopMapBlock address={config.data?.address} mapsUrl={config.data?.mapsUrl} hours={config.data?.hours} />

        {/* FAQ */}
        <section className="card mt-3 p-3.5 md:p-5">
          <h2 className="section-title">Câu hỏi thường gặp</h2>
          <div className="mt-2 divide-y divide-border">
            {FAQS.map((f) => (
              <details key={f.q} className="group py-3">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-3 text-sm font-semibold text-foreground marker:hidden">
                  {f.q}
                  <ChevronRight className="size-4 shrink-0 text-muted-foreground transition group-open:rotate-90" />
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
          {showZalo ? (
            <a href={zalo} className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-sale">
              <MessageCircle className="size-4" /> Nhắn Zalo {phone}
            </a>
          ) : (
            <a href={BRAND.messengerUrl} target="_blank" rel="noopener" className="btn-soft mt-3 inline-flex min-h-10 items-center gap-2 px-4 text-sm">
              <MessageCircle className="size-4" /> Chat với shop qua Messenger
            </a>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
