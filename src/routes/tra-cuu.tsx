import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, PackageSearch } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { lookupOrder, type OrderLookupResult } from "@/lib/orders.functions";
import { formatMaybe, formatVnd } from "@/lib/brand";

export const Route = createFileRoute("/tra-cuu")({
  validateSearch: (search: Record<string, unknown>): { code: string; phone: string } => ({
    code: typeof search.code === "string" ? search.code : "",
    phone: typeof search.phone === "string" ? search.phone : "",
  }),
  head: () => ({
    meta: [
      { title: "Tra cứu đơn in — Nhà In Thiên Thiên" },
      {
        name: "description",
        content: "Nhập số điện thoại để xem lịch sử đặt in và tiến trình từng đơn tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Tra cứu đơn in — Nhà In Thiên Thiên" },
      { property: "og:description", content: "Xem các đơn đã đặt và tiến trình in ảnh." },
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

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", { hour12: false });
}

function LookupPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code);
  const [phone, setPhone] = useState(search.phone);
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const [openCode, setOpenCode] = useState("");

  const mutation = useMutation({
    mutationFn: (input: { code: string; phone: string }) => lookupOrder({ data: input }),
    onSuccess: (data) => {
      setResult(data);
      setOpenCode(data.focus);
    },
    onError: () => setResult(null),
  });

  useEffect(() => {
    if (search.phone.trim().length < 8) return;
    mutation.mutate({ code: search.code, phone: search.phone });
    // Chỉ tự tra khi mở link từ trang đặt in.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.phone]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ code, phone });
  }

  const opened = result?.orders.find((order) => order.code === openCode) ?? result?.orders[0];

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Tra cứu đơn hàng</h1>
        <p className="mt-2 text-muted-foreground">
          Nhập số điện thoại đã đặt để xem lịch sử đơn. Có mã đơn thì nhập thêm để mở đúng đơn đó.
        </p>

        <form onSubmit={onSubmit} className="glass-card mt-6 space-y-4 rounded-3xl p-5">
          <div className="space-y-1.5">
            <Label htmlFor="phone">Số điện thoại</Label>
            <Input
              id="phone"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              inputMode="tel"
              autoComplete="tel"
              placeholder="Số đã dùng khi đặt"
              className="h-12"
              required
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="code">Mã đơn</Label>
            <Input
              id="code"
              value={code}
              onChange={(event) => setCode(event.target.value)}
              placeholder="Không bắt buộc, ví dụ TT260101-001"
              className="h-12"
            />
          </div>
          <Button
            type="submit"
            size="lg"
            disabled={mutation.isPending}
            className="w-full bg-accent text-accent-foreground hover:bg-accent/90"
          >
            {mutation.isPending ? <Loader2 className="size-4 animate-spin" /> : <PackageSearch className="size-4" />}
            Tra cứu
          </Button>
          {mutation.isError ? (
            <p className="text-sm font-semibold text-destructive">{(mutation.error as Error).message}</p>
          ) : null}
        </form>

        {result && opened ? (
          <div className="mt-6 space-y-4">
            <section className="glass-card rounded-3xl p-5">
              <h2 className="text-lg font-bold text-foreground">Lịch sử đặt hàng</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {result.orders.length} đơn của {result.customerName}
              </p>
              <ul className="mt-3 space-y-2">
                {result.orders.map((order) => {
                  const active = order.code === opened.code;
                  return (
                    <li key={order.code}>
                      <button
                        type="button"
                        onClick={() => setOpenCode(order.code)}
                        className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left ${active ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                      >
                        <span>
                          <span className="block font-bold text-foreground">{order.code}</span>
                          <span className="text-sm text-muted-foreground">{formatWhen(order.createdAt)}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-bold text-primary">{STATUS_LABEL[order.status] ?? order.status}</span>
                          <span className="text-sm font-semibold text-foreground">{formatMaybe(order.total) === "—" ? "Liên hệ" : formatMaybe(order.total)}</span>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="glass-card rounded-3xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-foreground">Đơn {opened.code}</h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                  {STATUS_LABEL[opened.status] ?? opened.status}
                </span>
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Khách hàng: {opened.customerName} • {opened.fileCount} ảnh • {opened.fulfillment === "delivery" ? "Giao tận nơi" : "Nhận tại xưởng"}
              </p>
              {opened.address ? <p className="mt-1 text-sm text-muted-foreground">{opened.address}</p> : null}

              <ul className="mt-4 space-y-2 text-sm">
                {opened.items.map((item, index) => (
                  <li key={`${opened.code}-${index}`} className="flex justify-between gap-3">
                    <span className="text-foreground/80">
                      {item.name} — {item.variant} × {item.quantity}
                    </span>
                    <span className="font-semibold text-primary">{item.lineTotal === null ? "Liên hệ" : formatVnd(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 flex justify-between border-t border-border pt-3 text-base font-bold">
                <span>Tạm tính</span>
                <span className="text-accent">{formatMaybe(opened.total) === "—" ? "Liên hệ" : formatMaybe(opened.total)}</span>
              </div>

              {opened.history.length ? (
                <div className="mt-5">
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Tiến trình</h3>
                  <ol className="mt-2 space-y-2 text-sm">
                    {opened.history.map((item, index) => (
                      <li key={`${opened.code}-${item.at}-${index}`} className="flex gap-3">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                        <span>
                          <strong className="text-foreground">{STATUS_LABEL[item.to] ?? item.to}</strong>{" "}
                          <span className="text-muted-foreground">{formatWhen(item.at)}</span>
                          {item.note ? <span className="block text-muted-foreground">{item.note}</span> : null}
                        </span>
                      </li>
                    ))}
                  </ol>
                </div>
              ) : null}
            </section>
          </div>
        ) : null}
      </main>
      <SiteFooter />
    </div>
  );
}
