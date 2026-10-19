import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { CheckCircle2 } from "lucide-react";

import { SiteHeader } from "@/components/site/SiteHeader";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { FEEDBACK_ANSWERS, feedbackLabel, type FeedbackAnswer } from "@/domain/print-shop";
import { uploadTokenShape } from "@/domain/order-upload";
import { getFeedbackCard, sendFeedback } from "@/lib/orders.functions";

export const Route = createFileRoute("/danh-gia/$token")({
  head: () => ({
    meta: [
      { title: "Ảnh in đúng ý chưa | Nhà In Thiên Thiên" },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: FeedbackPage,
});

function FeedbackPage() {
  const { token } = Route.useParams();
  const valid = uploadTokenShape(token);
  const queryClient = useQueryClient();
  const card = useQuery({
    queryKey: ["feedback", token],
    queryFn: () => getFeedbackCard({ data: { token } }),
    enabled: valid,
    retry: false,
  });
  const [answer, setAnswer] = useState<FeedbackAnswer | "">("");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const info = card.data;

  async function send() {
    if (!answer) {
      setError("Chọn một câu trả lời.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await sendFeedback({ data: { token, answer, note } });
      await queryClient.invalidateQueries({ queryKey: ["feedback", token] });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Không gửi được.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <SiteHeader />
      <main className="mx-auto max-w-lg px-4 py-8">
        {!valid ? <p className="font-semibold text-destructive">Mã không còn dùng được.</p> : null}
        {valid && card.isLoading ? <p className="text-muted-foreground">Đang mở đơn…</p> : null}
        {valid && card.isError ? <p className="font-semibold text-destructive">{(card.error as Error).message}</p> : null}
        {info ? (
          <section className="space-y-4 rounded-3xl border bg-card p-5">
            <h1 className="text-2xl text-primary">Đơn {info.code}</h1>
            {info.feedback ? (
              <p className="flex items-center gap-2 font-semibold text-primary">
                <CheckCircle2 className="size-5" />
                Đã ghi nhận: {feedbackLabel(info.feedback.answer)}. Cảm ơn anh/chị.
              </p>
            ) : info.open ? (
              <>
                <p className="text-sm text-muted-foreground">Ảnh in đúng ý không? Một câu là đủ.</p>
                <div className="grid grid-cols-2 gap-2">
                  {FEEDBACK_ANSWERS.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`min-h-12 rounded-2xl border px-3 text-sm font-semibold ${answer === item.id ? "border-primary bg-primary text-primary-foreground" : "bg-background"}`}
                      onClick={() => setAnswer(item.id)}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
                {answer && answer !== "dung_y" ? (
                  <Textarea value={note} placeholder="Mô tả ngắn, nếu muốn" onChange={(event) => setNote(event.target.value)} />
                ) : null}
                {error ? <p className="text-sm font-semibold text-destructive">{error}</p> : null}
                <Button type="button" className="min-h-12 w-full" disabled={busy} onClick={() => void send()}>
                  {busy ? "Đang gửi…" : "Gửi"}
                </Button>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">Đơn chưa giao xong. Anh/chị quay lại khi đã nhận hàng.</p>
            )}
          </section>
        ) : null}
      </main>
    </div>
  );
}
