import { createFileRoute } from "@tanstack/react-router";
import { useMutation } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import { Loader2, PackageSearch, X } from "lucide-react";

import { OrderMoney } from "@/components/site/order-money";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SiteFooter } from "@/components/site/SiteFooter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CHANNEL_LABEL, type Channel } from "@/domain/types";
import { publicStatusLabel } from "@/domain/public-status";
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
        content: "Nhập mã đơn hoặc số điện thoại để xem tiến trình đơn tại Nhà In Thiên Thiên.",
      },
      { property: "og:title", content: "Tra cứu đơn in — Nhà In Thiên Thiên" },
      { property: "og:description", content: "Xem các đơn đã đặt, ảnh và tiến trình in ảnh." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: LookupPage,
});

function formatWhen(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", { hour12: false });
}

function channelLabel(channel: string | null): string | null {
  if (!channel) return null;
  return CHANNEL_LABEL[channel as Channel] ?? channel;
}

function LookupPage() {
  const search = Route.useSearch();
  const [code, setCode] = useState(search.code);
  const [phone, setPhone] = useState(search.phone);
  const [result, setResult] = useState<OrderLookupResult | null>(null);
  const [openCode, setOpenCode] = useState("");
  const [openPhoto, setOpenPhoto] = useState<{ token: string; id: string; name: string } | null>(null);

  const mutation = useMutation({
    mutationFn: (input: { code: string; phone: string }) => lookupOrder({ data: input }),
    onSuccess: (data) => {
      setResult(data);
      setOpenCode(data.focus);
      setOpenPhoto(null);
    },
    onError: () => setResult(null),
  });

  useEffect(() => {
    if (search.phone.trim().length < 8) return;
    mutation.mutate({ code: search.code, phone: search.phone });
    // Chỉ tự tra khi mở link từ trang đặt in / gửi ảnh.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search.code, search.phone]);

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    mutation.mutate({ code, phone });
  }

  const opened = result?.orders.find((order) => order.code === openCode) ?? result?.orders[0];

  useEffect(() => {
    if (!openPhoto) return;
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpenPhoto(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [openPhoto]);

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-2xl px-4 py-10 md:px-6">
        <h1 className="text-3xl font-extrabold text-primary md:text-4xl">Tra cứu đơn hàng</h1>
        <p className="mt-2 text-muted-foreground">
          Nhập mã đơn hoặc số điện thoại đã đặt để xem đơn, tiền đã trả, ảnh đã gửi và tiến trình (đã in, đang giao).
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
              <h2 className="text-lg font-bold text-foreground">Chọn đơn hàng</h2>
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
                        onClick={() => {
                          setOpenCode(order.code);
                          setOpenPhoto(null);
                        }}
                        className={`flex w-full flex-wrap items-center justify-between gap-2 rounded-2xl border px-3 py-3 text-left ${active ? "border-primary bg-primary/5" : "border-border bg-background"}`}
                      >
                        <span>
                          <span className="block font-bold text-foreground">{order.code}</span>
                          <span className="text-sm text-muted-foreground">{formatWhen(order.createdAt)}</span>
                        </span>
                        <span className="text-right">
                          <span className="block text-sm font-bold text-primary">{publicStatusLabel(order.status)}</span>
                          <span className="text-sm font-semibold text-foreground">
                            {formatMaybe(order.total) === "—" ? "Liên hệ" : formatMaybe(order.total)}
                          </span>
                          {order.remain != null && order.remain > 0 ? (
                            <span className="block text-xs font-semibold text-destructive">Còn {formatMaybe(order.remain)}</span>
                          ) : null}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>

            <section className="glass-card space-y-4 rounded-3xl p-5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-xl font-bold text-foreground">Đơn {opened.code}</h2>
                <span className="rounded-full bg-primary/10 px-3 py-1 text-sm font-bold text-primary">
                  {publicStatusLabel(opened.status)}
                </span>
              </div>
              <p className="text-sm text-muted-foreground">
                Khách hàng: {opened.customerName}
                {channelLabel(opened.channel) ? ` · ${channelLabel(opened.channel)}` : ""}
                {" · "}
                {opened.fulfillment === "delivery" ? "Giao hàng" : "Nhận tại tiệm"}
                {" · "}
                {opened.fileCount} ảnh
              </p>
              {opened.address ? <p className="text-sm text-muted-foreground">{opened.address}</p> : null}
              {opened.note ? <p className="text-sm text-muted-foreground">Ghi chú: {opened.note}</p> : null}
              {opened.shipping ? (
                <p className="rounded-2xl bg-muted/50 px-3 py-2 text-sm">
                  <span className="font-semibold text-foreground">Vận chuyển: </span>
                  <span className="text-muted-foreground">
                    {[opened.shipping.carrier || null, opened.shipping.tracking || null, opened.shipping.carrierStatus || null]
                      .filter(Boolean)
                      .join(" · ") || "Chưa có mã vận đơn"}
                  </span>
                </p>
              ) : null}

              <ul className="space-y-2 text-sm">
                {opened.items.map((item, index) => (
                  <li key={`${opened.code}-${index}`} className="flex justify-between gap-3">
                    <span className="text-foreground/80">
                      {item.name} — {item.variant} × {item.quantity}
                    </span>
                    <span className="font-semibold text-primary">{item.lineTotal === null ? "Liên hệ" : formatVnd(item.lineTotal)}</span>
                  </li>
                ))}
              </ul>

              <div>
                <h3 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted-foreground">Thanh toán</h3>
                <OrderMoney total={opened.total} depositPaid={opened.depositPaid} remain={opened.remain} />
              </div>

              <div>
                <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Ảnh đã gửi ({opened.fileCount})</h3>
                {opened.photoToken && opened.photos.length ? (
                  <ul className="mt-2 grid grid-cols-3 gap-2">
                    {opened.photos.map((photo) => (
                      <li key={photo.id} className="overflow-hidden rounded-2xl border border-border bg-muted">
                        <button
                          type="button"
                          className="block w-full text-left"
                          onClick={() => setOpenPhoto({ token: opened.photoToken!, id: photo.id, name: photo.name })}
                        >
                          <img
                            src={`/api/public/order-photo/${opened.photoToken}/${photo.id}`}
                            alt={photo.name}
                            className="aspect-square w-full object-cover"
                            onError={(event) => {
                              event.currentTarget.style.display = "none";
                            }}
                          />
                          <span className="block truncate px-2 py-1 text-xs text-muted-foreground">{photo.name}</span>
                          {photo.print ? <span className="block px-2 pb-1 text-[11px] font-semibold text-primary">Đã chọn in</span> : null}
                          {photo.comment ? <span className="block px-2 pb-2 text-[11px] text-foreground/80">{photo.comment}</span> : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="mt-1 text-sm text-muted-foreground">
                    {opened.fileCount > 0 ? "Đã có ảnh trên đơn. Liên hệ tiệm nếu cần xem lại file." : "Chưa có ảnh trong đơn."}
                  </p>
                )}
              </div>

              {opened.history.length ? (
                <div>
                  <h3 className="text-sm font-bold uppercase tracking-wide text-muted-foreground">Tiến trình nhà in</h3>
                  <ol className="mt-2 space-y-2 text-sm">
                    {opened.history.map((item, index) => (
                      <li key={`${opened.code}-${item.at}-${index}`} className="flex gap-3">
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" />
                        <span>
                          <strong className="text-foreground">{publicStatusLabel(item.to)}</strong>{" "}
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
      {openPhoto ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" role="dialog" aria-modal="true" aria-label={openPhoto.name}>
          <button
            type="button"
            className="absolute right-4 top-4 flex size-11 items-center justify-center rounded-full bg-background text-foreground"
            onClick={() => setOpenPhoto(null)}
            aria-label="Đóng"
          >
            <X className="size-5" />
          </button>
          <img
            src={`/api/public/order-photo/${openPhoto.token}/${openPhoto.id}?view=1`}
            alt={openPhoto.name}
            className="max-h-[85vh] max-w-full rounded-2xl object-contain"
          />
        </div>
      ) : null}
    </div>
  );
}
