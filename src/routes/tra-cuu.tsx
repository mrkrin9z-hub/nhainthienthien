import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { Loader2, PackageSearch } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupOrder, type OrderLookupResult } from "@/lib/orders.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/tra-cuu")({
  head: () => ({
    meta: [
      { title: "Tra cứu đơn in — Nhà In Thiên Thiên" },
      {
        name: "description",
        content:
          "Nhập mã đơn và số điện thoại để xem tiến trình đơn in ảnh tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Tra cứu đơn in — Nhà In Thiên Thiên" },
      { property: "og:description", content: "Theo dõi tiến trình đơn in ảnh của bạn." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LookupPage,
});

export const STATUS_LABEL: Record<string, string> = {
  draft_upload: "Đang gửi ảnh",
  upload_error: "Lỗi tải ảnh",
  nhan_don: "Đã nhận đơn",
  thiet_ke: "Đang thiết kế",
  cho_duyet: "Chờ khách duyệt",
  in: "Đang in",
  dong_goi: "Đang đóng gói",
  giao: "Đang giao",
  xong: "Hoàn tất",
  huy: "Đã hủy",
};

function LookupPage() {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [result, setResult] = useState<OrderLookupResult | null>(null);

  const mutation = useMutation({
    mutationFn: () => lookupOrder({ data: { code, phone } }),
    onSuccess: (data) => setResult(data),
    onError: () => setResult(null),
  });

  function onSubmit(e: FormEvent) {
    e.preventDefault();
    mutation.mutate();
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Tra cứu đơn hàng</h1>
        <p className="mt-2 text-muted-foreground">
          Nhập mã đơn dạng TT260101-001 cùng số điện thoại đã đặt.
        </p>

        <form onSubmit={onSubmit} className="glass-card mt-6 space-y-4 rounded-3xl p-5">
          <div className="space-y-1.5">
            <Label htmlFor="code">Mã đơn</Label>
            <Input
              id="code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="TT260101-001"
              className="h-12"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
              placeholder="Số đã dùng khi đặt"
              className="h-12"
              required
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={mutation.isPending}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {mutation.isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PackageSearch className="size-4" />
            )}
            Tra cứu
          </Button>
          {mutation.isError ? (
            <p className="text-sm font-semibold text-destructive">
              Không tìm thấy đơn hàng khớp mã đơn và số điện thoại.
            </p>
          ) : null}
        </form>

        {result ? (
          <section className="glass-card mt-6 rounded-3xl p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-xl font-bold text-foreground">Đơn {result.code}</h2>
              <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                {STATUS_LABEL[result.status] ?? result.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              Khách hàng: {result.customerName} • {result.fileCount} ảnh •{" "}
              {result.fulfillment === "delivery" ? "Giao tận nơi" : "Nhận tại xưởng"}
            </p>

            <ul className="mt-4 space-y-2 text-sm">
              {result.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span className="text-foreground/80">
                    {item.name} — {item.variant} × {item.quantity}
                  </span>
                  <span className="font-semibold text-primary">{item.lineTotal === null ? "Liên hệ" : formatVnd(item.lineTotal)}</span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
              <span>Tạm tính</span>
              <span className="text-accent">{formatMaybe(result.total) === "—" ? "Liên hệ" : formatMaybe(result.total)}</span>
            </div>

            {result.history.length ? (
              <div className="mt-5">
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">
                  Tiến trình
                </h3>
                <ol className="mt-2 space-y-2 text-sm">
                  {result.history.map((h, i) => (
                    <li key={i} className="flex gap-3">
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                      <span>
                        <strong className="text-foreground">
                          {STATUS_LABEL[h.to] ?? h.to}
                        </strong>{" "}
                        <span className="text-muted-foreground">
                          {new Date(h.at).toLocaleString("vi-VN")}
                        </span>
                        {h.note ? (
                          <span className="block text-muted-foreground">{h.note}</span>
                        ) : null}
                      </span>
                    </li>
                  ))}
                </ol>
              </div>
            ) : null}
          </section>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
