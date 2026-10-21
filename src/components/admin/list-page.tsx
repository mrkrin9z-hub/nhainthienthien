import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

/** Một trang danh sách, cùng cỡ trang đơn của StudioBase manage. */
export const LIST_PAGE_SIZE = 30;

export function useListPage<T>(rows: T[], resetKey: string) {
  const [page, setPage] = useState(1);
  useEffect(() => {
    setPage(1);
  }, [resetKey]);
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / LIST_PAGE_SIZE));
  const safe = Math.min(page, pages);
  const start = (safe - 1) * LIST_PAGE_SIZE;
  return {
    page: safe,
    pages,
    total,
    start,
    slice: rows.slice(start, start + LIST_PAGE_SIZE),
    setPage,
  };
}

export function ListPager({
  page,
  pages,
  total,
  start,
  count,
  noun,
  onPage,
}: {
  page: number;
  pages: number;
  total: number;
  start: number;
  count: number;
  noun: string;
  onPage: (page: number) => void;
}) {
  const shown = total === 0 ? 0 : count;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 text-[13px] text-muted-foreground">
      <p>
        Hiển thị <span className="font-semibold text-foreground">{shown}</span> / {total} {noun}
      </p>
      {pages > 1 ? (
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" className="min-h-11" disabled={page <= 1} onClick={() => onPage(page - 1)}>
            Trước
          </Button>
          <span>
            {page}/{pages}
          </span>
          <Button type="button" variant="outline" className="min-h-11" disabled={page >= pages} onClick={() => onPage(page + 1)}>
            Sau
          </Button>
        </div>
      ) : null}
    </div>
  );
}
