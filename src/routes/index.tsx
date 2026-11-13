import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import { ChevronRight, MessageCircle, ReceiptText, ScrollText, ShoppingBag, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { POLICY_CHIPS, ProductCard, ProductCover, ShopInfoBlock } from "@/components/site/shop-ui";
import { catalogQueryOptions, publicConfigQueryOptions } from "@/lib/catalog.functions";
import heroImg from "@/assets/hero-thuc-te.jpg";
import { BRAND, formatVnd } from "@/lib/brand";
import { discountPercent } from "@/lib/ship-estimate";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
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
  const categories = [...new Set(products.map((product) => product.category).filter(Boolean))];

  // Banner combo lấy giá thật từ bảng giá (combo 4 ảnh 13×18).
  const tg = products.find((product) => product.slug === "trang-guong");
  const combo = tg?.variants.find((variant) => variant.width === 13 && variant.height === 18 && variant.sheets === 4);
  const comboPct = combo ? discountPercent(combo.price, combo.list_price) : null;

  return (
    <div className="shop-ui min-h-screen bg-shop-bg">
      <SiteHeader />
      <main className="mx-auto max-w-6xl pb-20 md:px-6 md:pb-0 md:pt-4">
        {/* Banner */}
        <section className="grid gap-2 bg-white p-2 md:grid-cols-[2fr_1fr] md:rounded-sm md:p-3">
          <Link to="/san-pham" className="relative block overflow-hidden rounded-sm">
            <img
              src={heroImg}
              alt="Ảnh tráng gương 40×60 treo tại tiệm Nhà In Thiên Thiên"
              width={800}
              height={1000}
              fetchPriority="high"
              decoding="async"
              className="aspect-[2/1] w-full object-cover md:aspect-[16/7]"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-black/65 via-black/25 to-transparent" />
            <div className="absolute inset-y-0 left-0 flex max-w-[70%] flex-col justify-center p-4 text-white md:p-8">
              <p className="text-[11px] font-semibold uppercase tracking-wide opacity-90">Nhà In Thiên Thiên</p>
              <h1 className="mt-1 text-xl leading-tight md:text-4xl">In ảnh tráng gương 4K theo ảnh của bạn</h1>
              <span className="mt-3 inline-flex w-fit items-center gap-1 rounded-sm bg-cta px-3 py-1.5 text-xs font-semibold text-cta-foreground md:text-sm">
                Mua ngay <ChevronRight className="size-4" />
              </span>
            </div>
          </Link>
          <div className="grid grid-cols-2 gap-2 md:grid-cols-1">
            {combo ? (
              <Link
                to="/san-pham/$slug"
                params={{ slug: "trang-guong" }}
                search={{ v: combo.id }}
                className="flex flex-col justify-center rounded-sm bg-promo-gradient p-3 text-cta-foreground"
              >
                <span className="text-[11px] font-semibold uppercase opacity-90">Combo 4 ảnh 13×18</span>
                <span className="mt-0.5 text-xl font-extrabold md:text-2xl">{formatVnd(combo.price ?? 0)}</span>
                {combo.list_price ? (
                  <span className="text-xs opacity-90">
                    <s>{formatVnd(combo.list_price)}</s>
                    {comboPct ? ` · -${comboPct}%` : ""}
                  </span>
                ) : null}
              </Link>
            ) : null}
            <Link to="/chinh-sach" className="flex flex-col justify-center rounded-sm bg-brand-blue-soft p-3 text-brand-blue">
              <span className="text-[11px] font-semibold uppercase">Giao tận nơi</span>
              <span className="mt-0.5 text-base font-extrabold leading-tight md:text-lg">Freeship đơn từ 300k</span>
              <span className="text-xs text-foreground/70">COD · Nhận tại tiệm 0đ</span>
            </Link>
          </div>
        </section>

        {/* Chính sách */}
        <section className="mt-2 grid grid-cols-4 gap-1 bg-white px-2 py-3 md:rounded-sm">
          {POLICY_CHIPS.map((chip) => (
            <Link key={chip.label} to="/chinh-sach" className="flex flex-col items-center gap-1 text-center">
              <span className="grid size-10 place-items-center rounded-full bg-brand-blue-soft text-brand-blue">
                <chip.icon className="size-5" aria-hidden />
              </span>
              <span className="text-[10px] leading-tight text-foreground/80 md:text-xs">{chip.label}</span>
            </Link>
          ))}
        </section>

        {/* Danh mục */}
        <section className="mt-2 bg-white md:rounded-sm">
          <h2 className="border-b border-border px-3 py-3 text-sm font-semibold uppercase text-muted-foreground">Danh mục</h2>
          <div className="scrollbar-none flex gap-1 overflow-x-auto px-2 py-3">
            {categories.map((category) => {
              const first = products.find((product) => product.category === category);
              return (
                <Link
                  key={category}
                  to="/san-pham"
                  search={{ cat: category }}
                  className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center"
                >
                  {first ? <ProductCover product={first} className="size-14 rounded-full border border-border" /> : null}
                  <span className="text-xs text-foreground">{category}</span>
                </Link>
              );
            })}
            {[
              { to: "/dat-in" as const, label: "Gửi ảnh in", icon: UploadCloud },
              { to: "/tra-cuu" as const, label: "Tra cứu đơn", icon: ReceiptText },
              { to: "/chinh-sach" as const, label: "Chính sách", icon: ScrollText },
            ].map((item) => (
              <Link key={item.to} to={item.to} className="flex w-20 shrink-0 flex-col items-center gap-1.5 text-center">
                <span className="grid size-14 place-items-center rounded-full border border-border bg-brand-blue-soft text-brand-blue">
                  <item.icon className="size-6" aria-hidden />
                </span>
                <span className="text-xs text-foreground">{item.label}</span>
              </Link>
            ))}
          </div>
        </section>

        {/* Gợi ý */}
        <section id="gian-hang" className="mt-2 scroll-mt-24">
          <h2 className="sticky top-14 z-10 border-b-4 border-cta bg-white py-3 text-center text-sm font-semibold uppercase text-brand-blue md:static md:rounded-t-sm">
            Sản phẩm đang bán
          </h2>
          <div className="grid grid-cols-2 gap-1.5 p-1.5 sm:grid-cols-3 md:grid-cols-5 md:gap-2.5 md:px-0">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
          <div className="px-3 pb-3 text-center">
            <Link to="/san-pham" className="inline-flex min-h-10 items-center rounded-sm border border-border bg-white px-10 text-sm text-foreground/80">
              Xem tất cả
            </Link>
          </div>
        </section>

        {/* 3 bước */}
        <section className="mt-2 bg-white p-3 md:rounded-sm md:p-5">
          <h2 className="text-base text-foreground">Đặt in trong 3 bước</h2>
          <ol className="mt-3 grid grid-cols-3 gap-2">
            {STEPS.map((step, i) => (
              <li key={step.title} className="rounded-sm border border-border p-2 text-center md:p-4">
                <step.icon className="mx-auto size-6 text-brand-blue" aria-hidden />
                <p className="mt-1 text-[11px] font-semibold text-sale">Bước {i + 1}</p>
                <h3 className="text-xs font-semibold text-foreground md:text-sm">{step.title}</h3>
                <p className="mt-0.5 hidden text-xs text-muted-foreground md:block">{step.desc}</p>
              </li>
            ))}
          </ol>
        </section>

        <div className="mt-2 md:rounded-sm">
          <ShopInfoBlock hours={config.data?.hours} />
        </div>

        {/* FAQ */}
        <section className="mt-2 bg-white p-3 md:rounded-sm md:p-5">
          <h2 className="text-base text-foreground">Câu hỏi thường gặp</h2>
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
              <MessageCircle className="size-4" /> Nhắn Zalo
            </a>
          ) : (
            <a href={BRAND.messengerUrl} target="_blank" rel="noopener" className="mt-3 inline-flex min-h-10 items-center gap-2 text-sm font-semibold text-sale">
              <MessageCircle className="size-4" /> Chat với shop qua Messenger
            </a>
          )}
        </section>
      </main>

      <SiteFooter />
    </div>
  );
}
