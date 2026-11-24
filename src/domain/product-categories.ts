/** Chuẩn hoá tên nhóm sản phẩm. */
export function normalizeCategoryName(raw: string): string {
  return String(raw ?? "").replace(/\s+/g, " ").trim();
}

/** Hợp danh mục đã lưu + category đang dùng trên sản phẩm. */
export function mergeProductCategories(saved: string[] | null | undefined, used: string[]): string[] {
  const map = new Map<string, string>();
  for (const raw of [...(saved ?? []), ...used]) {
    const name = normalizeCategoryName(raw);
    if (name.length < 2) continue;
    const key = name.toLocaleLowerCase("vi");
    if (!map.has(key)) map.set(key, name);
  }
  return [...map.values()].sort((a, b) => a.localeCompare(b, "vi"));
}

export function categoryExists(list: string[], name: string): boolean {
  const key = normalizeCategoryName(name).toLocaleLowerCase("vi");
  return list.some((item) => item.toLocaleLowerCase("vi") === key);
}
