export const BRAND = {
  name: "NHÀ IN THIÊN THIÊN",
  shortName: "Thiên Thiên",
  slogan: "In đẹp từng khoảnh khắc.",
  message: "Giá xưởng cho mọi nhà.",
  website: "nhainthienthien.com",
  phone: "0778 662 227",
  phoneRaw: "0778662227",
  zalo: "https://zalo.me/0778662227",
  region: "Xuân Lộc, Đồng Nai",
} as const;

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

export function formatMaybe(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return formatVnd(amount);
}
