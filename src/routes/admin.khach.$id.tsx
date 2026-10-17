import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";

import { RoleGate } from "@/components/role-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { formatMaybe } from "@/lib/brand";
import { getCustomer, saveCustomer } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/khach/$id")({
  component: CustomerPage,
});

function CustomerPage() {
  return (
    <RoleGate allow={["owner", "sale"]} deny="Chỉ chủ và sale xem.">
      <CustomerBody />
    </RoleGate>
  );
}

function CustomerBody() {
  const { id } = Route.useParams();
  const queryClient = useQueryClient();
  const customer = useQuery({ queryKey: ["customer", id], queryFn: () => getCustomer({ data: { id } }) });
  const [note, setNote] = useState<string | null>(null);
  const [tags, setTags] = useState<string | null>(null);
  const [label, setLabel] = useState("Ngày giỗ");
  const [when, setWhen] = useState("");
  if (!customer.data) return <p className="text-muted-foreground">{customer.isError ? (customer.error as Error).message : "Đang tải…"}</p>;
  const data = customer.data;
  const dates = data.specialDates ?? [];
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-extrabold text-primary">
        {data.name}
        {data.repeat ? <span className="ml-2 rounded-full bg-accent px-2 py-0.5 text-sm font-bold text-accent-foreground">Quay lại</span> : null}
      </h1>
      <p className="text-sm">
        {data.phone}
        {data.address ? ` · ${data.address}` : ""}
      </p>
      {data.addresses.length > 1 ? <p className="text-sm">Địa chỉ khác: {data.addresses.filter((item) => item !== data.address).join(" · ")}</p> : null}
      {data.platformBuyers.length ? <p className="text-sm">Tài khoản sàn: {data.platformBuyers.join(", ")}</p> : null}
      <p className="text-sm">
        {data.orderCount} đơn · {data.channels.join(", ") || "Chưa có kênh"} · Đã chi {data.totalSpent === null ? "chưa có" : formatMaybe(data.totalSpent)}
        {data.spentIncomplete ? " (một số đơn chưa có giá)" : ""}
      </p>
      <label className="block text-sm font-semibold">
        Thẻ
        <Input className="mt-1 min-h-12" value={tags ?? data.tags.join(", ")} onChange={(e) => setTags(e.target.value)} placeholder="ảnh thờ, giỗ" />
      </label>
      <label className="block text-sm font-semibold">
        Ghi chú
        <Textarea className="mt-1" value={note ?? data.note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú chăm sóc" />
      </label>
      <section className="space-y-2">
        <h2 className="font-bold text-primary">Ngày cần nhớ</h2>
        <ul className="space-y-1 text-sm">
          {dates.map((date) => (
            <li key={`${date.label}-${date.month}-${date.day}`} className="flex items-center justify-between gap-2">
              <span>
                {date.label} · {String(date.day).padStart(2, "0")}/{String(date.month).padStart(2, "0")}
              </span>
              <Button
                variant="outline"
                className="min-h-11"
                onClick={async () => {
                  await saveCustomer({
                    data: {
                      id,
                      note: note ?? data.note,
                      tags: (tags ?? data.tags.join(", ")).split(",").map((tag) => tag.trim()).filter(Boolean),
                      specialDates: dates.filter((item) => item !== date),
                    },
                  });
                  toast.success("Đã xóa ngày");
                  await queryClient.invalidateQueries({ queryKey: ["customer", id] });
                }}
              >
                Xóa
              </Button>
            </li>
          ))}
          {dates.length === 0 ? <li className="text-muted-foreground">Chưa có ngày giỗ hay ngày đặc biệt.</li> : null}
        </ul>
        <div className="grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
          <Input className="min-h-12" value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Ngày giỗ" />
          <Input className="min-h-12" type="date" value={when} onChange={(e) => setWhen(e.target.value)} />
          <Button
            className="min-h-12"
            onClick={async () => {
              const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(when);
              if (!match) {
                toast.error("Chọn ngày");
                return;
              }
              await saveCustomer({
                data: {
                  id,
                  note: note ?? data.note,
                  tags: (tags ?? data.tags.join(", ")).split(",").map((tag) => tag.trim()).filter(Boolean),
                  specialDates: [...dates, { label: label.trim() || "Ngày nhớ", month: Number(match[2]), day: Number(match[3]) }],
                },
              });
              setWhen("");
              toast.success("Đã thêm ngày");
              await queryClient.invalidateQueries({ queryKey: ["customer", id] });
            }}
          >
            Thêm ngày
          </Button>
        </div>
      </section>
      <Button
        className="min-h-12"
        onClick={async () => {
          await saveCustomer({
            data: {
              id,
              note: note ?? data.note,
              tags: (tags ?? data.tags.join(", ")).split(",").map((tag) => tag.trim()).filter(Boolean),
              specialDates: dates,
            },
          });
          toast.success("Đã lưu khách");
          await queryClient.invalidateQueries({ queryKey: ["customer", id] });
          await queryClient.invalidateQueries({ queryKey: ["customers"] });
        }}
      >
        Lưu ghi chú
      </Button>
      <h2 className="text-lg font-bold text-primary">Đơn đã đặt</h2>
      <ul className="space-y-2">
        {data.orders.map((order) => (
          <li key={order.id}>
            <Link to="/admin/don-hang/$code" params={{ code: order.code }} className="glass-card block rounded-3xl p-4">
              <p className="font-bold">{order.code}</p>
              <p className="text-sm text-muted-foreground">
                {order.channelLabel} · {order.statusLabel} · {order.total === null ? "Chưa có giá" : formatMaybe(order.total)}
              </p>
              <p className="text-sm">{order.itemSummary}</p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
