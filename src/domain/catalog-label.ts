type SizedVariant = { width: number | null; height: number | null };

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
