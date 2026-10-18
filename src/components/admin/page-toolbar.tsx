import type { ReactNode } from "react";
import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";
import { Search, SlidersHorizontal, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export function PageToolbar({
  title,
  hint,
  actions,
  search,
  onSearch,
  searchPlaceholder = "Tìm kiếm…",
  filterCount = 0,
  onFilter,
  below,
}: {
  title: string;
  hint?: string | undefined;
  actions?: ReactNode | undefined;
  search?: string | undefined;
  onSearch?: ((value: string) => void) | undefined;
  searchPlaceholder?: string | undefined;
  filterCount?: number | undefined;
  onFilter?: (() => void) | undefined;
  below?: ReactNode | undefined;
}) {
  const showSearch = onSearch != null;
  return (
    <div className="space-y-3 rounded-2xl border border-border/70 bg-card p-3 shadow-xs sm:p-4">
      <div className="flex items-center gap-1.5">
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-lg font-semibold tracking-tight text-primary sm:text-xl">{title}</h1>
          {hint ? <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">{hint}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 items-center gap-1">{actions}</div> : null}
      </div>
      {showSearch || onFilter ? (
        <div className="flex items-center gap-1.5">
          {showSearch ? (
            <div className="relative min-w-0 flex-1">
              <Search className="pointer-events-none absolute top-1/2 left-3 z-[1] size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search ?? ""}
                onChange={(event) => onSearch(event.target.value)}
                placeholder={searchPlaceholder}
                aria-label={searchPlaceholder}
                className="h-11 rounded-xl pr-10 pl-9 text-base sm:h-9 sm:text-sm"
              />
              {search ? (
                <button
                  type="button"
                  className="absolute top-1/2 right-1 flex size-9 -translate-y-1/2 items-center justify-center rounded-full text-muted-foreground active:scale-95"
                  aria-label="Xóa tìm kiếm"
                  onClick={() => onSearch("")}
                >
                  <X className="size-3.5" />
                </button>
              ) : null}
            </div>
          ) : null}
          {onFilter ? (
            <button
              type="button"
              className="relative flex size-11 shrink-0 items-center justify-center rounded-full border bg-background active:scale-[0.97] sm:hidden"
              aria-label="Bộ lọc"
              onClick={onFilter}
            >
              <SlidersHorizontal className="size-4" />
              {filterCount > 0 ? (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                  {filterCount > 9 ? "9+" : filterCount}
                </span>
              ) : null}
            </button>
          ) : null}
        </div>
      ) : null}
      {below}
    </div>
  );
}

const actionClass = (primary?: boolean) =>
  cn(
    "touch-manipulation inline-flex shrink-0 items-center justify-center whitespace-nowrap rounded-full text-sm font-medium transition-transform active:scale-[0.97]",
    primary
      ? "h-11 gap-1.5 bg-primary px-3 text-primary-foreground shadow-sm sm:h-9"
      : "size-11 border bg-background sm:h-9 sm:w-auto sm:gap-1.5 sm:px-2.5",
  );

export function ToolbarButton({
  label,
  icon: Icon,
  primary,
  onClick,
  disabled,
}: {
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button type="button" className={actionClass(primary)} aria-label={label} title={label} onClick={onClick} disabled={disabled}>
      <Icon className="size-4 shrink-0" />
      <span className={primary ? "text-xs leading-none font-medium sm:text-sm" : "hidden text-sm leading-none sm:inline"}>{label}</span>
    </button>
  );
}

export function ToolbarLink({
  label,
  icon: Icon,
  primary,
  to,
}: {
  label: string;
  icon: LucideIcon;
  primary?: boolean;
  to: "/admin/don-moi";
}) {
  return (
    <Link to={to} className={actionClass(primary)} aria-label={label} title={label}>
      <Icon className="size-4 shrink-0" />
      <span className={primary ? "text-xs leading-none font-medium sm:text-sm" : "hidden text-sm leading-none sm:inline"}>{label}</span>
    </Link>
  );
}

export function FilterSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => { if (!next) onClose(); }}>
      <SheetContent side="bottom" className="max-h-[85vh] overflow-y-auto rounded-t-3xl pb-[max(1.25rem,env(safe-area-inset-bottom))]">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
        </SheetHeader>
        <div className="mt-4 flex flex-col gap-4">{children}</div>
        <Button className="mt-5 min-h-12 w-full" onClick={onClose}>
          Áp dụng
        </Button>
      </SheetContent>
    </Sheet>
  );
}

export function ClearFilters({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-sm font-semibold text-primary active:scale-95 md:min-h-8" onClick={onClick}>
      <X className="size-4" />
      Xóa lọc
    </button>
  );
}
