import { useMemo, useState } from "react";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

function vnToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(new Date());
}

function shiftDay(day: string, delta: number): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  date.setUTCDate(date.getUTCDate() + delta);
  return date.toISOString().slice(0, 10);
}

function monthStart(day: string): string {
  return `${day.slice(0, 7)}-01`;
}

function monthEnd(day: string): string {
  const [y, m] = day.split("-").map(Number);
  const last = new Date(Date.UTC(y ?? 2026, m ?? 1, 0)).getUTCDate();
  return `${day.slice(0, 7)}-${String(last).padStart(2, "0")}`;
}

function weekStart(day: string): string {
  const [y, m, d] = day.split("-").map(Number);
  const date = new Date(Date.UTC(y ?? 2026, (m ?? 1) - 1, d ?? 1));
  const mondayOffset = (date.getUTCDay() + 6) % 7;
  return shiftDay(day, -mondayOffset);
}

const PRESETS = [
  { id: "all", label: "Tất cả thời gian" },
  { id: "today", label: "Hôm nay" },
  { id: "yesterday", label: "Hôm qua" },
  { id: "week", label: "Tuần này" },
  { id: "month-to-date", label: "Đầu tháng đến nay" },
  { id: "month", label: "Tháng này" },
  { id: "last-month", label: "Tháng trước" },
] as const;

function rangeFor(id: (typeof PRESETS)[number]["id"]): { from: string; to: string } {
  const today = vnToday();
  if (id === "all") return { from: "", to: "" };
  if (id === "today") return { from: today, to: today };
  if (id === "yesterday") {
    const day = shiftDay(today, -1);
    return { from: day, to: day };
  }
  if (id === "week") return { from: weekStart(today), to: today };
  if (id === "month-to-date") return { from: monthStart(today), to: today };
  if (id === "month") return { from: monthStart(today), to: monthEnd(today) };
  const previous = shiftDay(monthStart(today), -1);
  return { from: monthStart(previous), to: monthEnd(previous) };
}

export function DateRangeField({
  from,
  to,
  onChange,
}: {
  from: string;
  to: string;
  onChange: (from: string, to: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftFrom, setDraftFrom] = useState(from);
  const [draftTo, setDraftTo] = useState(to);
  const label = useMemo(() => {
    if (!from && !to) return "Tất cả thời gian";
    if (from && to && from === to) return from.split("-").reverse().join("/");
    return `${from ? from.split("-").reverse().join("/") : "…"} – ${to ? to.split("-").reverse().join("/") : "…"}`;
  }, [from, to]);

  return (
    <Popover
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (next) {
          setDraftFrom(from);
          setDraftTo(to);
        }
      }}
    >
      <PopoverTrigger asChild>
        <button type="button" className="inline-flex h-9 items-center gap-2 rounded-[10px] border border-[#e5e7eb] bg-white px-3 text-[13px] font-medium">
          <CalendarDays className="size-3.5 text-muted-foreground" />
          {label}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[min(100vw-2rem,34rem)] rounded-2xl p-3">
        <div className="grid gap-3 sm:grid-cols-[11rem_minmax(0,1fr)]">
          <div className="flex flex-col gap-1">
            <p className="px-2 text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">Chọn nhanh</p>
            {PRESETS.map((preset) => (
              <button
                key={preset.id}
                type="button"
                className="rounded-full px-3 py-1.5 text-left text-[13px] font-medium hover:bg-[#e0eefe]"
                onClick={() => {
                  const next = rangeFor(preset.id);
                  setDraftFrom(next.from);
                  setDraftTo(next.to);
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
          <div className="space-y-2">
            <label className="block text-xs text-muted-foreground">
              Từ ngày
              <input className="mt-1 h-9 w-full rounded-[10px] border px-2" type="date" value={draftFrom} onChange={(event) => setDraftFrom(event.target.value)} />
            </label>
            <label className="block text-xs text-muted-foreground">
              Đến ngày
              <input className="mt-1 h-9 w-full rounded-[10px] border px-2" type="date" value={draftTo} onChange={(event) => setDraftTo(event.target.value)} />
            </label>
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={() => setOpen(false)}>Đóng</Button>
          <Button
            type="button"
            className="rounded-full"
            onClick={() => {
              onChange(draftFrom, draftTo);
              setOpen(false);
            }}
          >
            Xác nhận
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function vnDayOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(date);
}
