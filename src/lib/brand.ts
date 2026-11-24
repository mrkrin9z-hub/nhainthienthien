export const BRAND = {
  name: "NHÀ IN THIÊN THIÊN",
  shortName: "Thiên Thiên",
  slogan: "In đẹp từng khoảnh khắc.",
  message: "Bảng giá công khai cho mọi nhà.",
  website: "nhainthienthien.com",
  region: "Xuân Lộc, Đồng Nai",
  address: "Số 67 Đường Ngô Quyền, Khu Phố 4, Xã Xuân Lộc, Đồng Nai",
  shopeeUrl: "https://shopee.vn/nhainthienthien",
  /** Fanpage Facebook Nhà In Thiên Thiên. */
  facebookPageUrl: "https://www.facebook.com/profile.php?id=61595796658051",
  tiktokHandle: "@nhain.thienthien",
  /** Kênh TikTok Shop Nhà In Thiên Thiên. */
  tiktokShopUrl: "https://www.tiktok.com/@nhain.thienthien",
  /** Nút "Chat ngay": Messenger của Page Nhà In Thiên Thiên. */
  messengerUrl: "https://m.me/61595796658051",
} as const;

/** Link sản phẩm trên TikTok Shop theo nhóm web. */
export const TIKTOK_PRODUCT: Record<string, string> = {
  "trang-guong": "1732108414601692940",
  "thoi-khoa-bieu": "1738020808940750604",
  "thoi-khoa-bieu-boc-dan": "1738285097224079116",
  "nam-cham-xe": "1738136614342657804",
  "nam-cham-tu-lanh": "1738154665102968588",
  "anh-lua-6x9": "1733056188514535180",
};

export function tiktokUrl(slug: string): string | null {
  const id = TIKTOK_PRODUCT[slug];
  return id ? `https://shop.tiktok.com/view/product/${id}?region=VN` : null;
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

export function formatMaybe(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return formatVnd(amount);
}
