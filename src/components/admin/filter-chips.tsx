import type { LucideIcon } from "lucide-react";
import {
  Ban,
  CircleAlert,
  CircleCheck,
  Inbox,
  ListFilter,
  MessageSquare,
  Music,
  Package,
  PenLine,
  Printer,
  Share2,
  ShoppingBag,
  Store,
  Truck,
  Upload,
} from "lucide-react";

import { cn } from "@/lib/utils";

export type ChipTone = { color: string; icon: LucideIcon };

export const STATUS_TONE: Record<string, ChipTone> = {
  draft_upload: { color: "#6B7280", icon: Upload },
  upload_error: { color: "#B91C1C", icon: CircleAlert },
  nhan_don: { color: "#2563EB", icon: Inbox },
  thiet_ke: { color: "#7C3AED", icon: PenLine },
  cho_duyet: { color: "#D97706", icon: MessageSquare },
  in: { color: "#0284C7", icon: Printer },
  dong_goi: { color: "#0F766E", icon: Package },
  giao: { color: "#EA580C", icon: Truck },
  xong: { color: "#059669", icon: CircleCheck },
  huy: { color: "#DC2626", icon: Ban },
};

export const CHANNEL_TONE: Record<string, ChipTone> = {
  tai_tiem: { color: "#1D4ED8", icon: Store },
  facebook: { color: "#1877F2", icon: Share2 },
  tiktok: { color: "#111827", icon: Music },
  shopee: { color: "#EE4D2D", icon: ShoppingBag },
};

export const ALL_TONE: ChipTone = { color: "#4B5563", icon: ListFilter };

export type FilterChip = {
  id: string;
  label: string;
  count?: number | undefined;
  color: string;
  icon?: LucideIcon | undefined;
};

export function FilterChips({
  label,
  value,
  chips,
  onChange,
  wrap = false,
}: {
  label: string;
  value: string;
  chips: FilterChip[];
  onChange: (id: string) => void;
  wrap?: boolean;
}) {
  return (
    <div
      role="tablist"
      aria-label={label}
      className={cn(
        "flex gap-1.5",
        wrap
          ? "flex-wrap"
          : "overflow-x-auto scrollbar-none rounded-2xl border border-border/70 bg-muted/50 p-1.5 md:flex-wrap md:overflow-visible",
      )}
      style={wrap ? undefined : { WebkitOverflowScrolling: "touch" }}
    >
      {chips.map((chip) => {
        const active = value === chip.id;
        const Icon = chip.icon;
        return (
          <button
            key={chip.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(chip.id)}
            className="inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3 text-[12px] font-semibold whitespace-nowrap transition-transform active:scale-95 md:min-h-8 md:text-[11px]"
            style={{
              borderColor: active ? chip.color : "transparent",
              backgroundColor: active ? chip.color : `${chip.color}18`,
              color: active ? "#fff" : chip.color,
            }}
          >
            {Icon ? <Icon className="size-3.5" /> : null}
            <span>{chip.label}</span>
            {chip.count != null ? (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold"
                style={{
                  backgroundColor: active ? "rgba(255,255,255,0.3)" : `${chip.color}28`,
                  color: active ? "#fff" : chip.color,
                }}
              >
                {chip.count}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
