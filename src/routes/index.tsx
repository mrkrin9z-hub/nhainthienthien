import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Camera,
  CheckCircle2,
  Clock,
  Heart,
  MessageCircle,
  ShieldCheck,
  Sparkles,
  Truck,
  UploadCloud,
} from "lucide-react";

import { LOGO_SQUARE } from "@/lib/assets";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { catalogQueryOptions, minPrice, publicConfigQueryOptions } from "@/lib/catalog.functions";
import { catalogImage } from "@/lib/product-images";
import { BRAND, formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/")({
  loader: ({ context }) => context.queryClient.ensureQueryData(catalogQueryOptions),
  head: () => ({
    meta: [
      { title: "Nhà In Thiên Thiên — In ảnh giá xưởng, gửi ảnh online" },
      {
        name: "description",
        content:
          "In ảnh ép gỗ, ảnh thờ, giấy khen và nam châm tại Xuân Lộc, Đồng Nai. Gửi ảnh online 3 bước, nhận mã đơn và theo dõi tiến trình.",
      },
      { property: "og:title", content: "Nhà In Thiên Thiên — In đẹp từng khoảnh khắc" },
      {
        property: "og:description",
        content: "Gửi ảnh online, in đẹp giá xưởng, giao tận nơi hoặc nhận tại xưởng.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: HomePage,
});

const STEPS = [
  {
    icon: Camera,
    title: "Chọn sản phẩm",
    desc: "Chọn quy cách, kích thước và số lượng ngay trên bảng giá.",
  },
  {
    icon: UploadCloud,
    title: "Gửi ảnh gốc",
    desc: "Tải ảnh từ điện thoại, không cần cài ứng dụng nào.",
  },
  {
    icon: Clock,
    title: "Nhận mã đơn",
    desc: "Theo dõi tiến trình và nhận hàng tận nơi hoặc tại xưởng.",
  },
];

const BENEFITS = [
  { icon: ShieldCheck, title: "Giá xưởng", desc: "Bảng giá công khai, không phát sinh." },
  { icon: Clock, title: "Trả nhanh 24–48h", desc: "Đơn gấp hỗ trợ ưu tiên trong ngày." },
  { icon: Truck, title: "Giao tận nơi", desc: "Nhận tại xưởng hoặc giao toàn quốc." },
  { icon: Heart, title: "Kiểm ảnh thủ công", desc: "Chỉnh sáng, canh nét trước khi in." },
];

const REASONS = [
  "Xem trước giá từng kích thước, không cần hỏi tới lui.",
  "Kỹ thuật viên kiểm tra độ phân giải và báo lại nếu ảnh chưa đủ nét.",
  "In sai màu, sai kích thước — xưởng in lại miễn phí.",
  "Ảnh gốc của bạn được lưu riêng tư, lưu 6 tháng rồi xoá.",
];

const FAQS = [
  {
    q: "Ảnh chụp bằng điện thoại in được không?",
    a: "Được. Ảnh điện thoại đời mới in tốt tới khổ 40×60 cm. Xưởng sẽ kiểm tra và báo trước nếu ảnh chưa đủ nét cho khổ bạn chọn.",
  },
  {
    q: "Thanh toán như thế nào?",
    a: "Bạn đặt đơn trước, xưởng xác nhận qua Zalo rồi mới thanh toán. Nhận tại xưởng hoặc chuyển khoản trước khi giao.",
  },
  {
    q: "Bao lâu thì nhận được hàng?",
    a: "Phần lớn đơn hoàn tất trong 24–48 giờ. Ảnh thờ làm nhanh, không giới hạn số lần sửa. Đơn số lượng lớn sẽ được báo lịch cụ thể.",
  },
];

function HomePage() {
  const { data: products } = useSuspenseQuery(catalogQueryOptions);
  const config = useQuery(publicConfigQueryOptions);
  const showZalo = config.data ? config.data.showZalo : true;
  const zalo = showZalo ? (config.data?.zalo || BRAND.zalo) : "";
  const phone = showZalo ? (config.data?.phone || BRAND.phone) : "";
  const featured = products.slice(0, 6);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="pb-24 md:pb-0">
        {/* Hero */}
        <section className="mx-auto grid max-w-6xl items-center gap-8 px-4 py-10 md:grid-cols-2 md:px-6 md:py-16">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-accent">
              <Sparkles className="size-3.5 shrink-0" /> {BRAND.message}
            </span>
            <h1 className="mt-4 text-[2rem] font-extrabold leading-[1.15] text-primary sm:text-4xl md:text-5xl">
              {BRAND.slogan}
            </h1>
            <p className="mt-4 text-base leading-relaxed text-muted-foreground md:text-lg">
              Gửi ảnh online chỉ với 3 bước — ảnh ép gỗ, ảnh thờ, giấy khen ép gỗ và nam châm,
              in tại xưởng ở {BRAND.region}.
            </p>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <Button
                asChild
                size="lg"
                className="min-h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90 sm:w-auto"
              >
                <Link to="/dat-in">
                  Gửi ảnh đặt in <ArrowRight className="size-4" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:w-auto">
                <Link to="/san-pham">Xem sản phẩm & bảng giá</Link>
              </Button>
            </div>

            {showZalo ? (
              <a
                href={zalo}
                className="mt-4 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-primary"
              >
                <MessageCircle className="size-4 shrink-0 text-accent" /> Zalo tư vấn {phone}
              </a>
            ) : null}

          </div>

          <div className="glass-card rounded-3xl p-6">
            <img src={LOGO_SQUARE} alt="Logo Nhà In Thiên Thiên" className="mx-auto h-24 w-24 object-contain" />
            <p className="mt-4 text-center text-sm font-bold uppercase tracking-wide text-accent">In tại xưởng</p>
            <ul className="mt-4 space-y-2 text-sm text-foreground">
              <li>Ảnh tráng gương, ảnh ép gỗ</li>
              <li>Ảnh thờ và giấy khen</li>
              <li>Nam châm dán xe, nam châm tủ lạnh</li>
            </ul>
            <p className="mt-4 text-center text-sm text-muted-foreground">
              {config.data?.hours || "08:00 – 20:00"} · {BRAND.region}
            </p>
          </div>
        </section>

        {/* 3 bước */}
        <section className="mx-auto max-w-6xl px-4 md:px-6">
          <h2 className="text-2xl font-extrabold text-primary md:text-3xl">Đặt in trong 3 bước</h2>
          <p className="mt-2 text-sm text-muted-foreground md:text-base">
            Không cần ra tiệm, làm trọn vẹn trên điện thoại trong vài phút.
          </p>
          <div className="mt-5 grid gap-4 sm:grid-cols-3">
            {STEPS.map((step, i) => (
              <div key={step.title} className="glass-card rounded-3xl p-5">
                <div className="flex items-center gap-3">
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                    <step.icon className="size-5" />
                  </span>
                  <span className="text-xs font-bold uppercase text-accent">Bước {i + 1}</span>
                </div>
                <h3 className="mt-3 text-lg font-bold text-foreground">{step.title}</h3>
                <p className="mt-1 text-sm text-muted-foreground">{step.desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Sản phẩm nổi bật */}
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6">
          <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-4">
            <h2 className="min-w-0 text-2xl font-extrabold text-primary md:text-3xl">
              Sản phẩm nổi bật
            </h2>
            <Link to="/san-pham" className="shrink-0 text-sm font-semibold text-accent">
              Xem tất cả
            </Link>
          </div>

          <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {featured.map((product) => (
              <article key={product.id} className="glass-card overflow-hidden rounded-3xl">
                <img
                  src={catalogImage(product.slug, product.cover_path)}
                  alt={`Ảnh mẫu ${product.name}`}
                  loading="lazy"
                  width={800}
                  height={600}
                  className="h-44 w-full object-cover sm:h-40 lg:h-44"
                />
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-wide text-accent">
                    {product.category}
                  </p>
                  <h3 className="mt-1 text-xl font-bold text-foreground">{product.name}</h3>
                  <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">
                    {product.description}
                  </p>
                  <div className="mt-4 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3">
                    <span className="min-w-0 text-sm text-muted-foreground">
                      Từ{" "}
                      <strong className="text-base text-accent">
                        {minPrice(product) === null ? "Liên hệ" : formatVnd(minPrice(product)!)}
                      </strong>
                    </span>
                    <Button asChild size="sm" className="min-h-11 shrink-0">
                      <Link to="/dat-in" search={{ product: product.slug }}>
                        Đặt in <ArrowRight className="size-4" />
                      </Link>
                    </Button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>

        {/* Vì sao chọn */}
        <section className="mx-auto max-w-6xl px-4 md:px-6">
          <div className="glass-card rounded-3xl p-5 md:p-8">
            <div className="grid gap-8 md:grid-cols-2">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold text-primary md:text-3xl">
                  Vì sao khách chọn Thiên Thiên?
                </h2>
                <ul className="mt-5 space-y-3">
                  {REASONS.map((r) => (
                    <li key={r} className="flex gap-3">
                      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-accent" />
                      <span className="text-sm leading-relaxed text-foreground/85 md:text-base">
                        {r}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                {BENEFITS.map((b) => (
                  <div key={b.title} className="glass-panel rounded-2xl p-4">
                    <b.icon className="size-6 text-accent" />
                    <h3 className="mt-3 text-base font-bold text-foreground">{b.title}</h3>
                    <p className="mt-1 text-sm text-muted-foreground">{b.desc}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="mx-auto max-w-3xl px-4 md:px-6">
          <h2 className="text-2xl font-extrabold text-primary md:text-3xl">Câu hỏi thường gặp</h2>
          <div className="mt-5 space-y-3">
            {FAQS.map((f) => (
              <details key={f.q} className="glass-card group rounded-3xl p-5">
                <summary className="cursor-pointer list-none text-base font-bold text-foreground marker:hidden">
                  {f.q}
                </summary>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA cuối */}
        <section className="mx-auto max-w-6xl px-4 py-12 md:px-6 md:py-16">
          <div className="glass-card rounded-3xl bg-primary/5 p-6 text-center md:p-10">
            <h2 className="text-2xl font-extrabold text-primary md:text-3xl">
              Sẵn sàng in kỷ niệm của bạn?
            </h2>
            <p className="mx-auto mt-3 max-w-xl text-sm text-muted-foreground md:text-base">
              Gửi ảnh ngay hôm nay, xưởng báo lại trong ít phút và giao hàng chỉ sau 24–48 giờ.
            </p>
            <div className="mx-auto mt-6 flex max-w-md flex-col gap-3 sm:flex-row sm:justify-center">
              <Button
                asChild
                size="lg"
                className="min-h-12 w-full bg-accent text-accent-foreground hover:bg-accent/90 sm:w-auto"
              >
                <Link to="/dat-in">
                  Gửi ảnh đặt in <ArrowRight className="size-4" />
                </Link>
              </Button>
              {showZalo ? (
                <Button asChild size="lg" variant="outline" className="min-h-12 w-full sm:w-auto">
                  <a href={zalo}>
                    <MessageCircle className="size-4" /> Nhắn Zalo
                  </a>
                </Button>
              ) : null}
            </div>
          </div>
        </section>
      </main>

      {/* Thanh CTA cố định trên mobile */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-2.5 backdrop-blur md:hidden">
        <div className="flex items-center gap-2">
          {showZalo ? (
            <Button asChild variant="outline" className="min-h-12 flex-1">
              <a href={zalo}>
                <MessageCircle className="size-4" /> Zalo
              </a>
            </Button>
          ) : null}
          <Button
            asChild
            className="min-h-12 flex-[1.6] bg-accent text-accent-foreground hover:bg-accent/90"
          >
            <Link to="/dat-in">
              <UploadCloud className="size-4" /> Gửi ảnh đặt in
            </Link>
          </Button>
        </div>
      </div>

      <SiteFooter />
    </div>
  );
}
