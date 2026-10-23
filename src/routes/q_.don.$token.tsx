import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { useStaffPin } from "@/components/staff-pin";
import { uploadTokenShape } from "@/domain/order-upload";
import { loadPhoneOrder, staffPinStatus } from "@/lib/phone.functions";

export const Route = createFileRoute("/q_/don/$token")({
  head: () => ({ meta: [{ title: "Gửi ảnh thiết kế | Nhà In Thiên Thiên" }, { name: "robots", content: "noindex" }] }),
  component: OrderPhotoPage,
});

const STEPS = [
  { id: "anh", label: "Ảnh khách" },
  { id: "thiet-ke", label: "Bản thiết kế" },
  { id: "duyet", label: "Ảnh duyệt" },
  { id: "goi", label: "Ảnh đóng gói" },
] as const;

function OrderPhotoPage() {
  const { token } = Route.useParams();
  const pinState = useStaffPin();
  const valid = uploadTokenShape(token);
  const ready = useQuery({ queryKey: ["staff-pin"], queryFn: () => staffPinStatus() });
  const [draft, setDraft] = useState("");
  const [step, setStep] = useState<(typeof STEPS)[number]["id"]>("anh");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const client = useQueryClient();
  const order = useQuery({
    queryKey: ["phone-order", token, pinState.pin],
    queryFn: () => loadPhoneOrder({ data: { pin: pinState.pin, token } }),
    enabled: valid && pinState.pin.length === 4,
    retry: false,
  });

  async function upload(file: File) {
    setBusy(true);
    setError("");
    const body = new FormData();
    body.set("pin", pinState.pin);
    body.set("token", token);
    body.set("step", step);
    body.set("file", file);
    try {
      const response = await fetch("/api/public/staff-photo", { method: "POST", body });
      if (!response.ok) throw new Error(await response.text());
      await client.invalidateQueries({ queryKey: ["phone-order", token] });
    } catch (reason) {
      const message = (reason as Error).message;
      if (/PIN/.test(message)) pinState.clear();
      setError(message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-lg space-y-4 bg-background px-3 py-4">
      <header>
        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Nhà In Thiên Thiên</p>
        <h1 className="text-2xl font-extrabold">Gửi ảnh thiết kế</h1>
        {order.data ? <p className="text-lg font-semibold">{order.data.code} · {order.data.customerName}</p> : null}
      </header>
      {!valid ? <p className="text-sm font-semibold text-destructive">Mã đơn không đúng.</p> : null}
      {ready.data && !ready.data.set ? <p className="rounded-2xl border bg-card p-4 text-sm">Chủ chưa đặt mã PIN 4 số trong Cài đặt → Cửa hàng.</p> : null}
      {valid && ready.data?.set && pinState.pin.length !== 4 ? (
        <PinInline value={draft} onChange={setDraft} onDone={(next) => pinState.save(next)} />
      ) : null}
      {order.data ? (
        <>
          <p className="text-sm text-muted-foreground">
            {order.data.drive ? "Ảnh vào thư mục đơn trên Google Drive." : "Ảnh lưu trên máy chủ của đơn, mỗi ảnh tối đa 10MB. Drive chưa nối."}
          </p>
          <div className="grid grid-cols-2 gap-2">
            {STEPS.map((item) => (
              <button
                key={item.id}
                type="button"
                className={`min-h-12 rounded-xl text-sm font-semibold ${step === item.id ? "bg-primary text-primary-foreground" : "border bg-card"}`}
                onClick={() => setStep(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="text-sm">
            Đã có: ảnh khách {order.data.counts.original}, thiết kế {order.data.counts.design}, duyệt {order.data.counts.approval}, gói {order.data.counts.packing_photo}.
          </p>
          <label className={`flex min-h-16 items-center justify-center rounded-2xl border border-dashed text-base font-semibold ${busy ? "opacity-60" : ""}`}>
            {busy ? "Đang gửi…" : "Chụp hoặc chọn ảnh"}
            <input
              className="sr-only"
              type="file"
              accept="image/*"
              capture="environment"
              disabled={busy}
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (file) void upload(file);
              }}
            />
          </label>
          {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
          {order.isError ? <p className="text-sm font-semibold text-destructive">{(order.error as Error).message}</p> : null}
        </>
      ) : null}
      <Link to="/q" className="inline-flex min-h-11 items-center text-sm font-semibold">
        Về việc cần làm
      </Link>
    </main>
  );
}

function PinInline({ value, onChange, onDone }: { value: string; onChange: (value: string) => void; onDone: (pin: string) => void }) {
  return (
    <section className="space-y-3 rounded-2xl border bg-card p-4">
      <h2 className="font-bold">Mã PIN 4 số</h2>
      <p className="text-center font-mono text-3xl tracking-[0.4em]">{value.padEnd(4, "·")}</p>
      <div className="grid grid-cols-3 gap-2">
        {["1", "2", "3", "4", "5", "6", "7", "8", "9", "⌫", "0"].map((key) => (
          <button
            key={key}
            type="button"
            className="min-h-14 rounded-xl border text-xl font-semibold"
            onClick={() => {
              if (key === "⌫") {
                onChange(value.slice(0, -1));
                return;
              }
              const next = `${value}${key}`.slice(0, 4);
              onChange(next);
              if (next.length === 4) onDone(next);
            }}
          >
            {key}
          </button>
        ))}
      </div>
    </section>
  );
}
