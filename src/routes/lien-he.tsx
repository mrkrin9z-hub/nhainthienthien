import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Clock, Globe, MessageCircle, PackageSearch, Phone, UploadCloud } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { BRAND } from "@/lib/brand";
import { publicConfigQueryOptions } from "@/lib/catalog.functions";
import { submitInquiry } from "@/lib/orders.functions";

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
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  const [orderCode, setOrderCode] = useState("");
  const [callback, setCallback] = useState("");
  const [sent, setSent] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Liên hệ</h1>
        <p className="mt-2 text-muted-foreground">
          Đặt in trên web, rồi tra cứu đơn bằng mã đơn và số điện thoại đã đặt.
        </p>

        <div className="mt-8 grid gap-4 sm:grid-cols-2">
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
          <div className="glass-card rounded-3xl p-5">
            <Clock className="size-6 text-accent" />
            <h2 className="mt-3 text-lg font-bold text-foreground">Thời gian làm việc</h2>
            <p className="mt-1 text-sm text-muted-foreground">{hours}</p>
          </div>
        </div>

        <form
          className="glass-card mt-8 space-y-3 rounded-3xl p-5"
          onSubmit={(event) => {
            event.preventDefault();
            setBusy(true);
            setError("");
            void submitInquiry({ data: { name, message, orderCode, phone: callback } })
              .then(() => {
                setSent(true);
                setMessage("");
              })
              .catch((reason: unknown) => setError(reason instanceof Error ? reason.message : "Chưa gửi được."))
              .finally(() => setBusy(false));
          }}
        >
          <h2 className="text-lg font-bold text-foreground">Gửi tin cho xưởng</h2>
          <p className="text-sm text-muted-foreground">Xưởng đọc tin trong trang quản trị. Không cần số của tiệm.</p>
          <div>
            <Label htmlFor="ten">Tên</Label>
            <Input id="ten" className="mt-1 min-h-11" value={name} onChange={(event) => setName(event.target.value)} required />
          </div>
          <div>
            <Label htmlFor="nd">Nội dung</Label>
            <Textarea id="nd" className="mt-1 min-h-28" value={message} onChange={(event) => setMessage(event.target.value)} required />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label htmlFor="madon">Mã đơn (nếu có)</Label>
              <Input id="madon" className="mt-1 min-h-11" value={orderCode} onChange={(event) => setOrderCode(event.target.value)} />
            </div>
            <div>
              <Label htmlFor="sdt">Số để gọi lại (nếu muốn)</Label>
              <Input id="sdt" className="mt-1 min-h-11" inputMode="tel" value={callback} onChange={(event) => setCallback(event.target.value)} />
            </div>
          </div>
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          {sent ? <p className="text-sm font-semibold text-primary">Đã gửi. Xưởng sẽ xem tin này.</p> : null}
          <Button type="submit" className="min-h-11" disabled={busy}>
            {busy ? "Đang gửi…" : "Gửi tin"}
          </Button>
        </form>

        <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="size-4 text-accent" /> {BRAND.website}
        </p>
      </main>
      <SiteFooter />
    </div>
  );
}
