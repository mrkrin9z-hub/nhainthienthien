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
  /** Link Google Maps anh gửi (rút gọn). Nút "Chỉ đường" mở đúng link này. */
  mapsUrl: "https://maps.app.goo.gl/KMDTbrLZ7TM4sHR76?g_st=ic",
} as const;

/**
 * Place CID lấy từ curl -sIL link rút gọn:
 * Location → ftid=0x317453427e249353:0x8ce70c5bc9b7b617 (cid = 0x8ce70c5bc9b7b617).
 * Query: Nhà In Thiên Thiên, 67 Ngô Quyền, Xuân Lộc, Đồng Nai.
 */
export const SHOP_MAPS_CID = "10153097473295889943";

/** Link sản phẩm trên TikTok Shop theo nhóm web. */
export const TIKTOK_PRODUCT: Record<string, string> = {
  "trang-guong": "1732108414601692940",
  "thoi-khoa-bieu": "1738020808940750604",
  "thoi-khoa-bieu-boc-dan": "1738285097224079116",
  "nam-cham-xe": "1738136614342657804",
  "nam-cham-tu-lanh": "1738154665102968588",
  "anh-lua-6x9": "1733056188514535180",
};

/** Handle TikTok Shop cũ — không dùng trên trang công khai. */
export const RETIRED_TIKTOK_HANDLES = ["xuonginthienthien"] as const;

function bareTiktokHandle(raw: string): string {
  return raw.trim().replace(/^@+/, "").toLowerCase();
}

/** Handle hợp lệ hiện tại; handle đã nghỉ hoặc sai định dạng thì về @nhain.thienthien. */
export function tiktokHandleOrDefault(raw?: string | null): string {
  const bare = bareTiktokHandle(raw || BRAND.tiktokHandle);
  if (!bare || (RETIRED_TIKTOK_HANDLES as readonly string[]).includes(bare) || !/^[a-z0-9._]{2,24}$/i.test(bare)) {
    return BRAND.tiktokHandle;
  }
  return `@${bare}`;
}

export function tiktokShopUrlFor(handle?: string | null): string {
  return `https://www.tiktok.com/${tiktokHandleOrDefault(handle)}`;
}

/** Thêm https nếu thiếu; trả null nếu không phải URL http(s). */
export function ensureHttpsUrl(raw: string | null | undefined): string | null {
  if (raw == null) return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(trimmed) ? trimmed : `https://${trimmed.replace(/^\/\//, "")}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "http:" && url.protocol !== "https:") return null;
    return url.href;
  } catch {
    return null;
  }
}

export function tiktokProductIdFromUrl(raw: string): string | null {
  const href = ensureHttpsUrl(raw);
  if (!href) return null;
  const match = href.match(/\/(?:view\/)?product\/(\d{6,})/i) ?? href.match(/[?&](?:product_id|id)=(\d{6,})/i);
  return match?.[1] ?? null;
}

export function tiktokProductUrl(productId: string, handle?: string | null): string {
  const id = productId.trim();
  const h = tiktokHandleOrDefault(handle).slice(1);
  return `https://www.tiktok.com/@${h}/product/${id}`;
}

/**
 * Chuẩn hóa link TikTok: thêm https, đổi shop.tiktok.com/view (dễ lỗi/mở app),
 * bỏ handle cũ, fallback về shop https://www.tiktok.com/@nhain.thienthien.
 */
export function resolveTiktokHref(raw?: string | null, handle?: string | null): string {
  const shop = tiktokShopUrlFor(handle);
  const href = ensureHttpsUrl(raw);
  if (!href) return shop;
  let url: URL;
  try {
    url = new URL(href);
  } catch {
    return shop;
  }
  const host = url.hostname.replace(/^www\./, "").toLowerCase();
  const retired = (RETIRED_TIKTOK_HANDLES as readonly string[]).some(
    (item) => url.pathname.toLowerCase().includes(item) || href.toLowerCase().includes(`@${item}`),
  );
  const productId = tiktokProductIdFromUrl(href);
  if (retired) return productId ? tiktokProductUrl(productId) : shop;
  if (host === "shop.tiktok.com" || host === "tiktok.com") {
    if (productId) return tiktokProductUrl(productId, handle);
    const profile = url.pathname.match(/^\/@([A-Za-z0-9._]+)/);
    if (profile) return tiktokShopUrlFor(profile[1]);
    return shop;
  }
  return shop;
}

export function resolveFacebookHref(raw?: string | null): string {
  const href = ensureHttpsUrl(raw);
  if (!href) return BRAND.facebookPageUrl;
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "facebook.com" || host === "fb.com" || host === "m.facebook.com") return href;
  } catch {
    /* fallback */
  }
  return BRAND.facebookPageUrl;
}

export function resolveShopeeHref(raw?: string | null): string {
  const href = ensureHttpsUrl(raw);
  if (!href) return BRAND.shopeeUrl;
  try {
    const host = new URL(href).hostname.replace(/^www\./, "").toLowerCase();
    if (host === "shopee.vn" || host.endsWith(".shopee.vn") || host === "shopee.com" || host.endsWith(".shopee.com")) return href;
  } catch {
    /* fallback */
  }
  return BRAND.shopeeUrl;
}

/** Link TikTok Shop của sản phẩm; không có id thì về trang shop. */
export function tiktokUrl(slug: string, override?: string | null): string {
  const fromOverride = override?.trim() ? resolveTiktokHref(override) : null;
  if (fromOverride && tiktokProductIdFromUrl(fromOverride)) return fromOverride;
  const id = TIKTOK_PRODUCT[slug];
  if (id) return tiktokProductUrl(id);
  return fromOverride || tiktokShopUrlFor();
}


const MAPS_HOSTS = [
  "google.com",
  "google.com.vn",
  "maps.google.com",
  "maps.google.com.vn",
  "maps.app.goo.gl",
  "goo.gl",
];

function isMapsHost(hostname: string): boolean {
  const host = hostname.replace(/^www\./, "").toLowerCase();
  return MAPS_HOSTS.some((item) => host === item || host.endsWith(`.${item}`));
}

/** Link "Chỉ đường": giữ đúng URL anh gửi / CMS nếu là Google Maps; không thì mặc định. */
export function mapsDirectionsUrl(raw?: string | null): string {
  const href = ensureHttpsUrl(raw);
  if (!href) return BRAND.mapsUrl;
  try {
    if (isMapsHost(new URL(href).hostname)) return href;
  } catch {
    /* fallback */
  }
  return BRAND.mapsUrl;
}

/**
 * iframe embed (không cần API key): cid của tiệm khi dùng link chính thức,
 * hoặc q=/cid= từ URL Maps khác, hoặc tìm theo địa chỉ.
 */
export function mapsEmbedUrl(raw?: string | null, address?: string | null): string {
  const fallbackQ = (address?.trim() || BRAND.address);
  const defaultEmbed = `https://www.google.com/maps?cid=${SHOP_MAPS_CID}&hl=vi&output=embed`;
  const href = ensureHttpsUrl(raw);
  if (!href || href.includes("maps.app.goo.gl/KMDTbrLZ7TM4sHR76") || href.includes(`cid=${SHOP_MAPS_CID}`) || href.toLowerCase().includes("0x8ce70c5bc9b7b617")) {
    return defaultEmbed;
  }
  try {
    const url = new URL(href);
    if (!isMapsHost(url.hostname)) {
      return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQ)}&hl=vi&output=embed`;
    }
    if (url.pathname.includes("/maps/embed") || url.searchParams.get("output") === "embed") return href;
    const cid = url.searchParams.get("cid");
    if (cid && /^\d+$/.test(cid)) return `https://www.google.com/maps?cid=${cid}&hl=vi&output=embed`;
    const q = url.searchParams.get("q") || url.searchParams.get("query");
    if (q) return `https://www.google.com/maps?q=${encodeURIComponent(q)}&hl=vi&output=embed`;
    const at = href.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/);
    if (at) return `https://www.google.com/maps?q=${at[1]},${at[2]}&hl=vi&z=17&output=embed`;
    if (url.hostname.replace(/^www\./, "").toLowerCase().includes("goo.gl")) {
      return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQ)}&hl=vi&output=embed`;
    }
  } catch {
    /* fallback */
  }
  return `https://www.google.com/maps?q=${encodeURIComponent(fallbackQ)}&hl=vi&output=embed`;
}

export function formatVnd(amount: number): string {
  return new Intl.NumberFormat("vi-VN").format(Math.round(amount)) + "đ";
}

export function formatMaybe(amount: number | null | undefined): string {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return "—";
  return formatVnd(amount);
}
