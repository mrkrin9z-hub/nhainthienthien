/** Tìm đơn theo mã (DH0001 hoặc TT261124-001 cũ) hoặc id (UUID), không phân biệt hoa thường. */
export function findOrderByRef<T extends { id: string; code: string }>(
  orders: T[] | null | undefined,
  ref: string | null | undefined,
): T | undefined {
  const key = (ref ?? "").trim();
  if (!key) return undefined;
  const upper = key.toUpperCase();
  return (orders ?? []).find((item) => item.id === key || item.code.toUpperCase() === upper);
}

/** Đường dẫn chi tiết đơn trên bàn làm việc — luôn dùng /admin/don-hang/$code, nhận cả mã và id. */
export function staffOrderHref(codeOrId: string): string {
  return `/admin/don-hang/${(codeOrId ?? "").trim()}`;
}
