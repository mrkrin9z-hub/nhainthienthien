import { createServerFn } from "@tanstack/react-start";
import { queryOptions } from "@tanstack/react-query";

export type CatalogVariant = {
  id: string;
  name: string;
  width: number | null;
  height: number | null;
  unit: string;
  price: number | null;
  sale_price: number | null;
  requires_quote: boolean;
  recommended_width_px: number | null;
  recommended_height_px: number | null;
  sort_order: number;
  /** Số tấm trong một lần mua. 1 là bán lẻ, lớn hơn là gói. */
  sheets: number;
};

export type CatalogProduct = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  cover_path: string | null;
  turnaround_text: string;
  sort_order: number;
  variants: CatalogVariant[];
};

export type PublicConfig = {
  name: string;
  showZalo: boolean;
  phone: string;
  phoneRaw: string;
  zalo: string;
  hours: string;
  region: string;
  /** null khi có R2, Drive hoặc Supabase. 10485760 khi ảnh vào KV hoặc đĩa. */
  maxPhotoBytes: number | null;
};

export const getCatalog = createServerFn({ method: "GET" }).handler(async (): Promise<CatalogProduct[]> => {
  const { publicCatalog } = await import("@/server/service");
  return publicCatalog();
});

export const getPublicConfig = createServerFn({ method: "GET" }).handler(async (): Promise<PublicConfig> => {
  const { publicConfig } = await import("@/server/service");
  return publicConfig();
});

export const catalogQueryOptions = queryOptions({
  queryKey: ["catalog"],
  queryFn: () => getCatalog(),
});

export const publicConfigQueryOptions = queryOptions({
  queryKey: ["public-config"],
  queryFn: () => getPublicConfig(),
});

export function minPrice(product: CatalogProduct): number | null {
  const prices = product.variants.map((variant) => variant.price).filter((price): price is number => typeof price === "number");
  return prices.length ? Math.min(...prices) : null;
}

function variantAmount(variant: CatalogVariant): number | null {
  if (variant.requires_quote) return null;
  return variant.sale_price ?? variant.price;
}

/** Một dòng cho mỗi khổ. Nam châm tủ (một khổ, nhiều gói) thì liệt kê từng gói. */
export function offerLines(product: CatalogProduct): { label: string; price: number | null; from: boolean }[] {
  const sized = product.variants.filter((variant) => variant.width && variant.height);
  const sizes = [...new Set(sized.map((variant) => `${variant.width}×${variant.height}`))];
  if (sizes.length > 1) {
    return sizes.map((label) => {
      const prices = sized
        .filter((variant) => `${variant.width}×${variant.height}` === label)
        .map(variantAmount)
        .filter((price): price is number => price !== null);
      return { label, price: prices.length ? Math.min(...prices) : null, from: prices.length > 1 };
    });
  }
  return product.variants.map((variant) => ({ label: variant.name, price: variantAmount(variant), from: false }));
}
