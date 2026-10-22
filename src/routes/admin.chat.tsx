import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MessageCircle, Plus, Send } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { ShopConversation } from "@/domain/shop-chat";
import {
  chatStatus,
  createChatConversation,
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

type ChannelFilter = "all" | "messenger" | "comment" | "zalo_oa" | "zalo" | "manual";

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
    return <p className="font-semibold text-primary">Chỉ chủ và sale dùng Chat Thiên Thiên.</p>;
  }

  return (
    <ChatWorkspace
      pageConnected={Boolean(status.data?.pageConnected)}
      pageName={status.data?.pageName ?? null}
    />
  );
}

function ChatWorkspace({ pageConnected, pageName }: { pageConnected: boolean; pageName: string | null }) {
  const queryClient = useQueryClient();
  const [filter, setFilter] = useState<ChannelFilter>("all");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [mobilePane, setMobilePane] = useState<"list" | "chat" | "info">("list");
  const [composeOpen, setComposeOpen] = useState(false);

  const conversations = useQuery({
    queryKey: ["chat-conversations"],
    queryFn: () => listChatConversations(),
    refetchInterval: 8_000,
  });

  const rows = useMemo(() => {
    const list = (conversations.data?.conversations ?? []) as ShopConversation[];
    if (filter === "all") return list;
    return list.filter((row) => row.channel === filter);
  }, [conversations.data, filter]);

  useEffect(() => {
    if (!activeId && rows[0]?.id) setActiveId(rows[0].id);
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

  const active = rows.find((row) => row.id === activeId);

  const send = useMutation({
    mutationFn: () =>
      sendChatMessage({
        data: {
          conversationId: activeId!,
          content: draft,
        },
      }),
    onSuccess: async () => {
      setDraft("");
      await queryClient.invalidateQueries({ queryKey: ["chat-messages", activeId] });
      await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
    },
    onError: (error) => toast.error((error as Error).message),
  });

  const customerName = active?.customerName || "Khách";
  const customerPhone = active?.customerPhone || messages.data?.suggestedPhone || "";

  return (
    <div className="flex h-[calc(100dvh-7.5rem)] min-h-[28rem] flex-col gap-3">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-extrabold text-primary">Chat Thiên Thiên</h1>
          <p className="text-sm text-muted-foreground">
            Hội thoại của Fanpage Nhà In — lưu local. Không lấy tin nhắn từ studiobase.vn.
          </p>
          {pageConnected ? (
            <p className="mt-1 text-xs font-semibold text-primary">Đang nối: {pageName || "Fanpage Thiên Thiên"}</p>
          ) : (
            <p className="mt-1 text-xs text-muted-foreground">
              Chưa nối Fanpage. Vào{" "}
              <Link to="/admin/ket-noi" className="font-semibold text-primary underline">
                Kết nối
              </Link>{" "}
              bấm Kết nối Fanpage bằng Facebook (không lấy inbox StudioBase).
            </p>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          <Button type="button" className="min-h-11" onClick={() => setComposeOpen(true)}>
            <Plus className="size-4" />
            Hội thoại mới
          </Button>
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
      </div>

      <div className="flex flex-wrap gap-1">
        {(
          [
            ["all", "Tất cả"],
            ["messenger", "Messenger"],
            ["comment", "Comment"],
            ["zalo_oa", "Zalo OA"],
            ["zalo", "Zalo CN"],
            ["manual", "Nội bộ"],
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
              const activeRow = row.id === activeId;
              return (
                <li key={row.id}>
                  <button
                    type="button"
                    className={`flex w-full flex-col gap-0.5 border-b px-3 py-2.5 text-left ${activeRow ? "bg-primary/5" : "hover:bg-muted/40"}`}
                    onClick={() => {
                      setActiveId(row.id);
                      setMobilePane("chat");
                    }}
                  >
                    <span className="flex items-center justify-between gap-2">
                      <span className="truncate font-semibold text-foreground">{row.customerName || "Khách"}</span>
                      <span className="shrink-0 text-[10px] font-bold uppercase text-muted-foreground">{row.channel}</span>
                    </span>
                    <span className="truncate text-xs text-muted-foreground">{row.lastMessagePreview || ""}</span>
                    <span className="text-[11px] text-muted-foreground">{formatWhen(row.lastMessageAt)}</span>
                  </button>
                </li>
              );
            })}
            {!conversations.isLoading && rows.length === 0 ? (
              <li className="p-4 text-sm text-muted-foreground">Chưa có hội thoại. Tạo nội bộ hoặc kết nối Facebook để nhận Messenger.</li>
            ) : null}
          </ul>
        </section>

        <section className={`flex min-h-0 flex-col overflow-hidden rounded-2xl border bg-card ${mobilePane === "chat" ? "flex" : "hidden md:flex"}`}>
          <div className="border-b px-3 py-2">
            <p className="font-semibold text-foreground">{active ? customerName : "Chọn hội thoại"}</p>
            {active ? (
              <p className="text-xs text-muted-foreground">
                {active.pageName}
                {customerPhone ? ` · ${customerPhone}` : ""}
              </p>
            ) : null}
          </div>
          <div className="flex-1 space-y-2 overflow-y-auto px-3 py-3">
            {(messages.data?.messages ?? []).map((item) => {
              const outbound = item.direction === "outbound";
              return (
                <div key={item.id} className={`flex ${outbound ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${outbound ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                    {item.mediaUrl ? (
                      <a href={item.mediaUrl} target="_blank" rel="noreferrer" className="block">
                        <img src={item.mediaUrl} alt="" className="mb-1 max-h-48 rounded-xl object-cover" />
                      </a>
                    ) : null}
                    <p className="whitespace-pre-wrap break-words">{item.content}</p>
                    <p className={`mt-1 text-[10px] ${outbound ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                      {formatWhen(item.createdAt)}
                    </p>
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
            {activeId ? (
              <Button asChild size="sm">
                <a href={`/orders/create?chat=${encodeURIComponent(activeId)}&phone=${encodeURIComponent(customerPhone)}&name=${encodeURIComponent(customerName === "Khách" ? "" : customerName)}`}>
                  <Plus className="size-4" />
                  Tạo đơn in
                </a>
              </Button>
            ) : (
              <Button type="button" size="sm" disabled>
                <Plus className="size-4" />
                Tạo đơn in
              </Button>
            )}
          </div>
          <div className="space-y-2 text-sm">
            <p>
              <span className="text-muted-foreground">Khách: </span>
              <strong>{customerName}</strong>
            </p>
            <p>
              <span className="text-muted-foreground">SĐT: </span>
              {customerPhone || "—"}
            </p>
            <p>
              <span className="text-muted-foreground">Nguồn: </span>
              {active?.pageName || "—"}
            </p>
          </div>
          <h3 className="mt-4 text-xs font-bold tracking-wide text-muted-foreground uppercase">Đơn gắn hội thoại</h3>
          <ul className="mt-2 space-y-2">
            {(orders.data?.orders ?? []).map((order) => (
              <li key={order.id} className="rounded-xl border px-3 py-2 text-sm">
                <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="font-semibold text-primary underline">
                  {order.code}
                </Link>
                <p className="text-xs text-muted-foreground">{order.statusLabel}</p>
                <p className="mt-1 text-sm">
                  Tổng {formatMaybe(order.total)} · Cọc {formatMaybe(order.depositPaid)}
                </p>
              </li>
            ))}
            {!orders.isLoading && (orders.data?.orders?.length ?? 0) === 0 ? (
              <li className="text-sm text-muted-foreground">Chưa có đơn gắn chat này.</li>
            ) : null}
          </ul>
        </section>
      </div>

      {composeOpen ? (
        <ComposeSheet
          onClose={() => setComposeOpen(false)}
          onCreated={async (id) => {
            setComposeOpen(false);
            setActiveId(id);
            await queryClient.invalidateQueries({ queryKey: ["chat-conversations"] });
            toast.success("Đã tạo hội thoại");
          }}
        />
      ) : null}
    </div>
  );
}

function ComposeSheet({ onClose, onCreated }: { onClose: () => void; onCreated: (id: string) => void | Promise<void> }) {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [first, setFirst] = useState("");
  const create = useMutation({
    mutationFn: () =>
      createChatConversation({
        data: {
          customerName: name.trim() || "Khách",
          customerPhone: phone.trim(),
          channel: "manual",
          firstMessage: first.trim() || undefined,
        },
      }),
    onSuccess: (result) => void onCreated(result.id),
    onError: (error) => toast.error((error as Error).message),
  });

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-3 sm:items-center">
      <div className="w-full max-w-md space-y-3 rounded-3xl bg-background p-4 shadow-xl">
        <h2 className="text-lg font-extrabold text-primary">Hội thoại nội bộ</h2>
        <p className="text-xs text-muted-foreground">Lưu trong app Thiên Thiên. Không đồng bộ StudioBase.</p>
        <div className="space-y-1">
          <Label>Tên khách</Label>
          <Input className="min-h-11" value={name} onChange={(e) => setName(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label>SĐT</Label>
          <Input className="min-h-11" value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" />
        </div>
        <div className="space-y-1">
          <Label>Tin đầu (tuỳ chọn)</Label>
          <Input className="min-h-11" value={first} onChange={(e) => setFirst(e.target.value)} />
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" className="min-h-11 flex-1" onClick={onClose}>
            Hủy
          </Button>
          <Button type="button" className="min-h-11 flex-1" disabled={create.isPending} onClick={() => create.mutate()}>
            {create.isPending ? <Loader2 className="size-4 animate-spin" /> : <MessageCircle className="size-4" />}
            Tạo
          </Button>
        </div>
      </div>
    </div>
  );
}
