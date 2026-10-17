import { createFileRoute, Link } from "@tanstack/react-router";
import { CheckCircle2 } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/huong-dan")({
  head: () => ({
    meta: [
      { title: "Hướng dẫn đặt in online — Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Hướng dẫn chọn sản phẩm, chuẩn bị ảnh gốc chất lượng cao và gửi ảnh đặt in online tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Hướng dẫn đặt in online — Nhà In Thiên Thiên" },
      {
        property: "og:description",
        content: "3 bước gửi ảnh đặt in và mẹo chuẩn bị file ảnh sắc nét.",
      },
      { property: "og:type", content: "article" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GuidePage,
});

const GUIDE = [
  {
    title: "Bước 1 — Chọn sản phẩm và quy cách",
    points: [
      "Chọn ảnh ép gỗ, ảnh thờ, giấy khen ép gỗ, ảnh tráng gương hoặc nam châm. Giá lấy từ bảng giá tại tiệm.",
      "Chọn kích thước và số lượng cho từng quy cách.",
    ],
  },
  {
    title: "Bước 2 — Gửi ảnh gốc",
    points: [
      "Gửi file gốc từ máy ảnh hoặc điện thoại, không chụp lại màn hình.",
      "Định dạng JPG, PNG, WEBP hoặc HEIC. Mỗi ảnh tối đa 10MB khi tiệm chưa kết nối Google Drive.",
      "Ảnh càng lớn (cạnh dài trên 2000px) thì bản in càng sắc nét.",
    ],
  },
  {
    title: "Bước 3 — Số điện thoại và địa chỉ",
    points: [
      "Gửi ảnh xong mới nhập họ tên và số điện thoại. Số này dùng để tra cứu đơn.",
      "Chọn nhận tại xưởng hoặc giao tận nơi kèm địa chỉ chi tiết.",
    ],
  },
];

function GuidePage() {
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Hướng dẫn đặt in</h1>
        <p className="mt-2 text-muted-foreground">
          Chỉ mất vài phút để gửi ảnh và nhận mã đơn theo dõi.
        </p>

        <div className="mt-8 space-y-5">
          {GUIDE.map((section) => (
            <section key={section.title} className="glass-card rounded-3xl p-5">
              <h2 className="text-lg font-bold text-foreground">{section.title}</h2>
              <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
                {section.points.map((p) => (
                  <li key={p} className="flex gap-2">
                    <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-accent" />
                    <span>{p}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-8">
          <Button asChild size="lg" className="bg-accent text-accent-foreground hover:bg-accent/90">
            <Link to="/dat-in">Bắt đầu đặt in</Link>
          </Button>
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}
