type SizedVariant = { width: number | null; height: number | null };

export type SheetVariant = SizedVariant & {
  id: string;
  name: string;
  sheets: number;
  sort_order: number;
};

export type SizeChoice<T extends SheetVariant> = {
  key: string;
  label: string;
  variants: T[];
};

/** Gom biến thể theo khổ. Trong một khổ, xếp số tấm tăng dần. */
export function sizeChoices<T extends SheetVariant>(variants: T[]): SizeChoice<T>[] {
  const choices: SizeChoice<T>[] = [];
  const index = new Map<string, SizeChoice<T>>();
  for (const variant of variants) {
    const sized = variant.width != null && variant.height != null && variant.width > 0 && variant.height > 0;
    const key = sized ? `${variant.width}x${variant.height}` : variant.id;
    const label = sized ? `${variant.width}×${variant.height} cm` : variant.name;
    let choice = index.get(key);
    if (!choice) {
      choice = { key, label, variants: [] };
      index.set(key, choice);
      choices.push(choice);
    }
    choice.variants.push(variant);
  }
  for (const choice of choices) {
    choice.variants.sort((a, b) => a.sheets - b.sheets || a.sort_order - b.sort_order);
  }
  const firstSort = (choice: SizeChoice<T>) => Math.min(...choice.variants.map((variant) => variant.sort_order));
  choices.sort((a, b) => firstSort(a) - firstSort(b));
  return choices;
}

/** Mã thêm 1 tờ album photobook (PB-*-T1 hoặc tên chứa "Thêm 1 tờ"). */
export function isExtraSheetVariant(variant: { id?: string | null; name?: string | null }): boolean {
  if (/thêm\s*1\s*tờ/i.test(variant.name ?? "")) return true;
  return /(?:^|[^A-Za-z0-9])[A-Za-z0-9]+-\d+x\d+-T1(?:$|[^A-Za-z0-9])/i.test(variant.id ?? "");
}

export function sheetOptionLabel(sheets: number, variant?: { id?: string | null; name?: string | null }): string {
  if (variant && isExtraSheetVariant(variant)) return "Thêm 1 tờ";
  const count = Number.isFinite(sheets) && sheets > 0 ? Math.round(sheets) : 1;
  return `${count} tấm`;
}

/** Nhãn chip phân loại trên trang sản phẩm (1 tấm / Combo / Gói, hoặc Thêm 1 tờ). */
export function packOptionLabel(variant: { id?: string | null; name?: string | null; sheets: number }, unit = "tấm"): string {
  if (isExtraSheetVariant(variant)) return "Thêm 1 tờ";
  const sheets = Number.isFinite(variant.sheets) && variant.sheets > 0 ? Math.round(variant.sheets) : 1;
  if (sheets <= 1) return `1 ${unit}`;
  return sheets <= 5 ? `Combo ${sheets} ${unit}` : `Gói ${sheets} ${unit}`;
}

/** Giữ số tấm đang chọn khi đổi khổ, nếu khổ mới có cùng số tấm. Giữ "Thêm 1 tờ" khi đổi khổ album. */
export function matchingSheet<T extends SheetVariant>(variants: T[], sheets: number | null, current?: T | null): T | undefined {
  if (current && isExtraSheetVariant(current)) {
    const extra = variants.find((variant) => isExtraSheetVariant(variant));
    if (extra) return extra;
  }
  if (sheets != null) {
    const same = variants.find((variant) => variant.sheets === sheets && !isExtraSheetVariant(variant));
    if (same) return same;
    const fallback = variants.find((variant) => variant.sheets === sheets);
    if (fallback) return fallback;
  }
  return variants.find((variant) => !isExtraSheetVariant(variant)) ?? variants[0];
}

/** Đếm khổ, không đếm từng mức giá. Một khổ nhiều gói thì ghi thêm số gói. */
export function sizeSummary(variants: SizedVariant[]): string {
  const sizes = new Set(
    variants
      .filter((variant) => variant.width && variant.height)
      .map((variant) => `${variant.width}×${variant.height}`),
  );
  if (sizes.size === 0) return variants.length === 1 ? "1 quy cách" : `${variants.length} quy cách`;
  if (sizes.size === 1 && variants.length > 1) return `1 kích thước · ${variants.length} gói`;
  return `${sizes.size} kích thước`;
}
