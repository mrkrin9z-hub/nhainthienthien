import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Plus, Send, X } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  chatCatalog,
  chatStatus,
  createConversationOrder,
  listChatConversations,
  listChatMessages,
  listConversationOrders,
  sendChatMessage,
} from "@/lib/chat.functions";
import { formatMaybe } from "@/lib/brand";
import { getMe } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/chat")({
  component: ChatInboxPage,
});

type ChannelFilter = "all" | "messenger" | "comment" | "zalo_oa" | "zalo";

function channelKind(row: Record<string, unknown>): ChannelFilter {
  const raw = String(row.channel_type || row.channel || row.source || "").toLowerCase();
  if (raw.includes("comment") || String(row.id || "").startsWith("comment:")) return "comment";
  if (raw.includes("zalo") && raw.includes("oa")) return "zalo_oa";
  if (raw.includes("zalo")) return "zalo";
  if (raw.includes("messenger") || raw.includes("facebook") || raw.includes("meta")) return "messenger";
  return "messenger";
}

function formatWhen(value?: string | null) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleString("vi-VN", { hour12: false });
}

function ChatInboxPage() {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  const status = useQuery({
    queryKey: ["chat-status"],
    queryFn: () => chatStatus(),
    enabled: me.data?.role === "owner" || me.data?.role === "sale",
    refetchInterval: 60_000,
  });

  if (me.isLoading || status.isLoading) return <p className="text-muted-foreground">Đang mở hộp thoại…</p>;
  if (me.data?.role !== "owner" && me.data?.role !== "sale") {
    return <p className="font-semibold text-primary">Chỉ chủ và sale dùng Chat StudioBase.</p>;
  }
  if (!status.data?.configured) {
    return (
      <div className="space-y-3 rounded-2xl border bg-card p-5">
        <h1 className="text-2xl font-extrabold text-primary">Chat & tạo đơn in</h1>
        <p className="text-sm text-muted-foreground">
          Kết nối StudioBase Partner Chat API để tư vấn Messenger / Zalo / Comment và tạo đơn gắn hội thoại.
        </p>
        <p className="text-sm">
          Vào <Link to="/admin/ket-noi" className="font-semibold text-primary underline">Kết nối</Link> lưu{" "}
          <strong>StudioBase Chat API key</strong> và <strong>Anon key</strong> (tạo key tại StudioBase → Cài đặt → Partner
          Chat).
        </p>
      </div>
    );
  }

  return <ChatWorkspace />;
}

function ChatWorkspace() {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [replyCommentId, setReplyCommentId] = useState<string | null>(null);
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "info">("list");
  const [orderOpen, setOrderOpen] = useState(false);

  const conversations = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => listChatConversations({ data: { includeComments: true } }),
    refetchInterval: 8_000,
  });

  const rows = useMemo(() => {
    const list = conversations.data?.conversations ?? [];
    if (filter === "all") return list;
    return list.filter((row) => channelKind(row as Record<string, unknown>) === filter);
  }, [conversations.data, filter]);

  useEffect(() => {
    if (!activeId && rows[0]?.id) setActiveId(String(rows[0].id));
  }, [rows, activeId]);

  const messages = useQuery({
    queryKey: ["chat-messages", activeId],
    queryFn: () => listChatMessages({ data: { conversationId: activeId! } }),
    enabled: Boolean(activeId),
    refetchInterval: 5_000,
  });

  const orders = useQuery({
    queryKey: ["chat-orders", activeId],
    queryFn: () => listConversationOrders({ data: { conversationId: activeId! } }),
    enabled: Boolean(activeId),
    refetchInterval: 15_000,
  });

  const catalog = useQuery({
    queryKey: ["chat-catalog"],
    queryFn: () => chatCatalog(),
    staleTime: 60_000,
  });

  const active = rows.find((row) => String(row.id) === activeId) as Record<string, unknown> | undefined;

  const send = useMutation({
    mutationFn: () =>
      sendChatMessage({
        data: {
          conversationId: activeId!,
          content: draft,
          ...(replyCommentId ? { externalCommentId: replyCommentId } : {}),
        },
      }),
    onSuccess: async () => {
      setDraft("");
      setReplyCommentId(null);
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const customerName = String(active?.customer_name || active?.external_user_name || active?.page_name || "Khách");
  const customerPhone = String(active?.customer_phone || messages.data?.suggestedPhone || "");

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Chat & tạo đơn in</h1>
          <p className="text-sm text-muted-foreground">Hội thoại StudioBase → tư vấn → tạo đơn gắn chat (ngôn ngữ xưởng in).</p>
        </div>
        <div className="flex gap-1 md:hidden">
          {(
            [
              ["list", "Hội thoại"],
              ["chat", "Chat"],
              ["info", "Đơn"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={`rounded-full px-3 py-1.5 text-xs font-semibold ${mobilePane === id ? "bg-primary text-primary-foreground" : "bg-muted"}`}
              onClick={() => setMobilePane(id)}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["all", "Tất cả"],
            ["messenger", "Messenger"],
            ["comment", "Comment"],
            ["zalo_oa", "Zalo OA"],
            ["zalo", "Zalo CN"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setFilter(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-semibold ${filter === id ? "bg-primary text-primary-foreground" : "border bg-card"}`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 md:grid-cols-[minmax(16rem,0.9fr)_minmax(0,1.3fr)_minmax(16rem,1fr)]">
        <section className={`min-h-0 overflow-hidden rounded-2xl border bg-card ${mobilePane === "list" ? "block" : "hidden md:block"}`}>
          <div className="border-b px-3 py-2 text-sm font-semibold">Hội thoại ({rows.length})</div>
          <ul className="h-full overflow-y-auto">
            {conversations.isLoading ? <li className="p-3 text-sm text-muted-foreground">Đang tải…</li> : null}
            {rows.map((row) => {
              const id = String(row.id);
              const activeRow = id === activeId;
              const kind = channelKind(row as Record<string, unknown>);
              return (
                <li key={id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left ${activeRow ? "bg-primary/5" : "hover:bg-muted/40"}`}
                    onClick={() => {
                      setActiveId(id);
                      setMobilePane("chat");
                      setReplyCommentId(null);
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">
                        {String(row.customer_name || row.external_user_name || "Khách")}
                      </span>
                      <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{kind}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{String(row.last_message_preview || "")}</span>
                    <span className="text-[11px] text-muted-foreground">{formatWhen(String(row.last_message_at || ""))}</span>
                  </button>
                </li>
              );
            })}
            {!conversations.isLoading && rows.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Chưa có hội thoại.</li>
            ) : null}
          </ul>
        </section>

        <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card ${mobilePane === "chat" ? "flex" : "hidden md:flex"}`}>
          <div className="border-b px-3 py-2">
            <p className="font-semibold text-foreground">{active ? customerName : "Chọn hội thoại"}</p>
            {active ? (
              <p className="text-xs text-muted-foreground">
                {String(active.page_name || active.channel || "")}
                {customerPhone ? ` · ${customerPhone}` : ""}
              </p>
            ) : null}
            {replyCommentId ? (
              <p className="mt-1 text-xs font-semibold text-accent">
                Đang trả lời bình luận ·{" "}
                <button type="button" className="underline" onClick={() => setReplyCommentId(null)}>
                  Hủy
                </button>
              </p>
            ) : null}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {(messages.data?.messages ?? []).map((item) => {
              const outbound = String(item.direction || "") === "outbound";
              const isComment = Boolean(item.external_comment_id) || String(activeId || "").startsWith("comment:");
              return (
                <div key={String(item.id)} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${outbound ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {isComment && !outbound ? (
                      <span className="mb-1 inline-block rounded bg-amber-500/20 px-1.5 text-[10px] font-bold text-amber-800">BL</span>
                    ) : null}
                    {item.media_url ? (
                      <a href={String(item.media_url)} target="_blank" rel="noreferrer" className="block">
                        <img src={String(item.media_url)} alt="" className="mb-1 max-h-48 rounded-xl object-cover" />
                      </a>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{String(item.content || "")}</p>
                    <p className={`mt-1 text-[10px] ${outbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatWhen(String(item.created_at || ""))}
                    </p>
                    {!outbound && item.external_comment_id ? (
                      <button
                        type="button"
                        className="mt-1 text-[11px] font-semibold underline"
                        onClick={() => setReplyCommentId(String(item.external_comment_id))}
                      >
                        Trả lời bình luận
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
          <form
            className="flex gap-2 border-t p-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!activeId || !draft.trim()) return;
              send.mutate();
            }}
          >
            <Input
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              placeholder="Nhập tin nhắn…"
              className="min-h-11"
              disabled={!activeId || send.isPending}
            />
            <Button type="submit" className="min-h-11 shrink-0" disabled={!activeId || send.isPending || !draft.trim()}>
              {send.isPending ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </form>
        </section>

        <section className={`min-h-0 overflow-y-auto rounded-2xl border bg-card p-3 ${mobilePane === "info" ? "block" : "hidden md:block"}`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <h2 className="font-bold text-primary">Thông tin & đơn</h2>
            <Button type="button" size="sm" disabled={!activeId} onClick={() => setOrderOpen(true)}>
              <Plus className="size-4" />
              Tạo đơn in
            </Button>
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Khách: </span>
              <strong>{customerName}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">SĐT gợi ý: </span>
              {customerPhone || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Nguồn: </span>
              {String(active?.page_name || active?.channel || "—")}
            </p>
          </div>
          <h3 className="mt-4 text-xs font-bold uppercase tracking-wide text-muted-foreground">Đơn gắn hội thoại</h3>
          <ul className="mt-2 space-y-2">
            {(orders.data?.orders ?? []).map((order) => (
              <li key={String(order.id)} className="rounded-xl border px-3 py-2 text-sm">
                <p className="font-semibold text-primary">{String(order.code || order.id)}</p>
                <p className="text-xs text-muted-foreground">
                  {String(order.status_name || "—")}
                  {order.printHint ? ` · ${order.printHint}` : ""}
                </p>
                <p className="mt-1 text-sm">
                  Tổng {formatMaybe(order.total_amount as number | null)} · Cọc {formatMaybe(order.paid_amount as number | null)}
                </p>
                {order.notes ? <p className="text-xs text-muted-foreground">{String(order.notes)}</p> : null}
              </li>
            ))}
            {!orders.isLoading && (orders.data?.orders?.length ?? 0) === 0 ? (
              <li className="text-sm text-muted-foreground">Chưa có đơn gắn chat này.</li>
            ) : null}
          </ul>
        </section>
      </div>

      {orderOpen && activeId ? (
        <CreateOrderSheet
          conversationId={activeId}
          defaultName={customerName}
          defaultPhone={customerPhone}
          channel={String(active?.channel || "Facebook")}
          catalog={catalog.data}
          onClose={() => setOrderOpen(false)}
          onCreated={async () => {
            setOrderOpen(false);
            await queryClient.invalidateQueries({ queryKey: ["chat-orders", activeId] });
            toast.success("Đã tạo đơn gắn hội thoại");
          }}
        />
      ) : null}
    </div>
  );
}

function CreateOrderSheet({
  conversationId,
  defaultName,
  defaultPhone,
  channel,
  catalog,
  onClose,
  onCreated,
}: {
  conversationId: string;
  defaultName: string;
  defaultPhone: string;
  channel: string;
  catalog:
    | {
        branches: { id: string; name?: string }[];
        categories: { id: string; name?: string }[];
        products: { id: string; name?: string; price?: number }[];
      }
    | undefined;
  onClose: () => void;
  onCreated: () => void | Promise<void>;
}) {
  const [name, setName] = useState(defaultName === "Khách" ? "" : defaultName);
  const [phone, setPhone] = useState(defaultPhone);
  const [branchId, setBranchId] = useState(catalog?.branches[0]?.id ?? "");
  const [categoryId, setCategoryId] = useState(catalog?.categories[0]?.id ?? "");
  const [photoTbd, setPhotoTbd] = useState(true);
  const [photoDate, setPhotoDate] = useState("");
  const [paid, setPaid] = useState("0");
  const [notes, setNotes] = useState("");
  const [productName, setProductName] = useState("Phóng ảnh");
  const [qty, setQty] = useState("1");
  const [price, setPrice] = useState("150000");
  const [productId, setProductId] = useState<string>("");

  useEffect(() => {
    if (!branchId && catalog?.branches[0]?.id) setBranchId(catalog.branches[0].id);
    if (!categoryId && catalog?.categories[0]?.id) setCategoryId(catalog.categories[0].id);
  }, [catalog, branchId, categoryId]);

  const total = Math.max(0, Number(qty) || 0) * Math.max(0, Number(price) || 0);

  const create = useMutation({
    mutationFn: () =>
      createConversationOrder({
        data: {
          conversationId,
          customer_name: name.trim() || "Khách",
          customer_phone: phone.trim(),
          branch_id: branchId,
          category_id: categoryId,
          is_photo_date_tbd: photoTbd,
          ...(photoTbd || !photoDate ? {} : { photo_date: new Date(photoDate).toISOString() }),
          total_amount: total,
          paid_amount: Math.max(0, Number(paid) || 0),
          notes,
          channel: channel || "Facebook",
          client_request_id: crypto.randomUUID(),
          items: [
            {
              ...(productId ? { product_id: productId } : {}),
              product_name: productName.trim() || "Sản phẩm in",
              quantity: Math.max(1, Math.round(Number(qty) || 1)),
              price: Math.max(0, Number(price) || 0),
            },
          ],
        },
      }),
    onSuccess: () => void onCreated(),
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-3xl bg-background p-4 shadow-xl">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-primary">Tạo đơn in</h2>
          <button type="button" aria-label="Đóng" onClick={onClose}>
            <X className="size-5" />
          </button>
        </div>
        <div className="space-y-3 text-sm">
          <div className="space-y-1">
            <Label>Tên khách</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} className="min-h-11" />
          </div>
          <div className="space-y-1">
            <Label>Số điện thoại</Label>
            <Input value={phone} onChange={(e) => setPhone(e.target.value)} className="min-h-11" inputMode="tel" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label>Chi nhánh</Label>
              <select className="min-h-11 w-full rounded-md border bg-background px-2" value={branchId} onChange={(e) => setBranchId(e.target.value)}>
                {(catalog?.branches ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Loại đơn</Label>
              <select className="min-h-11 w-full rounded-md border bg-background px-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
                {(catalog?.categories ?? []).map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name || item.id}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input type="checkbox" checked={photoTbd} onChange={(e) => setPhotoTbd(e.target.checked)} />
            Chưa chốt ngày nhận / hẹn in
          </label>
          {!photoTbd ? (
            <div className="space-y-1">
              <Label>Ngày nhận / hẹn in</Label>
              <Input type="datetime-local" value={photoDate} onChange={(e) => setPhotoDate(e.target.value)} className="min-h-11" />
            </div>
          ) : null}
          <div className="space-y-1">
            <Label>Sản phẩm catalog (tuỳ chọn)</Label>
            <select
              className="min-h-11 w-full rounded-md border bg-background px-2"
              value={productId}
              onChange={(e) => {
                const id = e.target.value;
                setProductId(id);
                const hit = catalog?.products.find((item) => item.id === id);
                if (hit?.name) setProductName(hit.name);
                if (typeof hit?.price === "number") setPrice(String(hit.price));
              }}
            >
              <option value="">— Nhập tay —</option>
              {(catalog?.products ?? []).map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name || item.id}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div className="col-span-3 space-y-1 sm:col-span-1">
              <Label>Tên SP</Label>
              <Input value={productName} onChange={(e) => setProductName(e.target.value)} className="min-h-11" />
            </div>
            <div className="space-y-1">
              <Label>SL</Label>
              <Input value={qty} onChange={(e) => setQty(e.target.value)} className="min-h-11" inputMode="numeric" />
            </div>
            <div className="space-y-1">
              <Label>Đơn giá</Label>
              <Input value={price} onChange={(e) => setPrice(e.target.value)} className="min-h-11" inputMode="numeric" />
            </div>
          </div>
          <div className="space-y-1">
            <Label>Tiền cọc</Label>
            <Input value={paid} onChange={(e) => setPaid(e.target.value)} className="min-h-11" inputMode="numeric" />
          </div>
          <div className="space-y-1">
            <Label>Ghi chú kỹ thuật in</Label>
            <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} placeholder="Giấy bóng, giao Grab…" />
          </div>
          <p className="font-semibold">
            Tổng đơn: <span className="text-accent">{formatMaybe(total)}</span>
          </p>
          <Button
            type="button"
            className="min-h-11 w-full"
            disabled={create.isPending || !branchId || !categoryId || phone.trim().length < 8}
            onClick={() => create.mutate()}
          >
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            Tạo đơn gắn hội thoại
          </Button>
        </div>
      </div>
    </div>
  );
}
