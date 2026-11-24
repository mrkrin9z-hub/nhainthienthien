/**
 * Ảnh mẫu cho trang sản phẩm (bản giao diện kiểu sàn, nháp 13/11/2026).
 * Ảnh lấy từ bộ ảnh đang đăng trên TikTok Shop của Nhà In Thiên Thiên, lưu trong public/media.
 * Không có số liệu đánh giá, đã bán — chỉ ảnh.
 */

export type MediaItem = { kind: "image"; src: string; alt: string } | { kind: "video"; src: string; poster?: string; alt: string };

export type DesignOption = { key: string; label: string; image: string };

type ProductMedia = {
  /** Ảnh bìa lưới trang chủ / danh mục (ưu tiên hơn ảnh KV admin). */
  listingCover?: string;
  /** Ảnh chung cho mọi lựa chọn. */
  gallery?: string[];
  /** Ảnh theo khổ, khóa "13x18". Khổ không có bộ riêng thì dùng `sizeFallback`. */
  bySize?: Record<string, string[]>;
  sizeFallback?: Record<string, string>;
  /** Link video mp4 (chưa có video nào, để sẵn chỗ). */
  video?: string | null;
  /** Ảnh bìa đang sai sản phẩm thì không hiện, dùng khung trống. */
  placeholderCover?: boolean;
  /** In từ ảnh của khách: trang thanh toán hiện ô gửi ảnh (không bắt buộc). */
  printsCustomerPhotos?: boolean;
  /** Mẫu thiết kế khách chọn (ghi vào ghi chú đơn). */
  designs?: { title: string; options: DesignOption[] };
};

const sp = (name: string, count: number) => Array.from({ length: count }, (_, i) => `/media/sp/${name}-${i + 1}.webp`);
const ai = (name: string, count: number) => Array.from({ length: count }, (_, i) => `/media/sp/${name}-ai-${i + 1}.webp`);
const withAi = (name: string, aiCount: number, existingCount: number) => [...ai(name, aiCount), ...sp(name, existingCount)];

const TKB_NAMES = [
  "Khủng long",
  "Công chúa",
  "Vũ trụ",
  "Cờ đỏ hoa sen",
  "Xe cộ",
  "Thú rừng",
  "Đại dương",
  "Kỳ lân",
  "Bóng đá",
  "Đồ dùng học tập",
];

const pad = (n: number) => String(n).padStart(2, "0");

export const PRODUCT_MEDIA: Record<string, ProductMedia> = {
  "trang-guong": {
    listingCover: "/media/sp/cover-trang-guong.webp",
    bySize: {
      "13x18": withAi("tg-13x18", 3, 4),
      "15x21": withAi("tg-15x21", 2, 3),
      "20x30": withAi("tg-20x30", 2, 4),
      "30x45": ["/media/sp/tg-30x45-ai-1.webp", "/media/sp/tg-30x45-real-1.webp"],
      "40x60": withAi("tg-40x60", 2, 4),
      "50x75": withAi("tg-50x75", 2, 5),
      "60x90": withAi("tg-60x90", 1, 5),
    },
    video: null,
    printsCustomerPhotos: true,
  },
  "nam-cham-xe": {
    listingCover: "/media/sp/lai-moi-ai-1.webp",
    gallery: withAi("lai-moi", 2, 9),
    video: null,
    designs: {
      title: "Chọn mẫu",
      options: Array.from({ length: 20 }, (_, i) => ({
        key: `Mẫu ${pad(i + 1)}`,
        label: `Mẫu ${pad(i + 1)}`,
        image: `/media/mau/lai-moi-${pad(i + 1)}.webp`,
      })),
    },
  },
  "thoi-khoa-bieu": {
    listingCover: "/media/sp/tkb-ai-1.webp",
    gallery: withAi("tkb", 1, 7),
    video: null,
    designs: {
      title: "Chọn mẫu",
      options: TKB_NAMES.map((name, i) => ({
        key: `Mẫu ${i + 1} ${name}`,
        label: `Mẫu ${i + 1} ${name}`,
        image: `/media/mau/tkb-${pad(i + 1)}.webp`,
      })),
    },
  },
  "thoi-khoa-bieu-boc-dan": {
    listingCover: "/media/sp/tkb-bd-ai-1.webp",
    gallery: ["/media/sp/tkb-bd-ai-1.webp", "/media/sp/tkb-bd-real-1.webp"],
    video: null,
  },
  "nam-cham-tu-lanh": { listingCover: "/media/sp/nct-ai-1.webp", gallery: withAi("nct", 2, 9), video: null, printsCustomerPhotos: true },
  "anh-lua-6x9": { listingCover: "/media/sp/lua-ai-1.webp", gallery: withAi("lua", 2, 5), video: null, printsCustomerPhotos: true },
};

export function mediaFor(slug: string): ProductMedia {
  return PRODUCT_MEDIA[slug] ?? {};
}

/**
 * Sản phẩm in từ ảnh khách gửi: ảnh tráng gương, nam châm tủ lạnh, ảnh lụa.
 * Lái Mới, TKB (ép gỗ và mica) in theo mẫu có sẵn + tên bé, không cần ảnh.
 */
export function needsCustomerPhotos(slug: string): boolean {
  return mediaFor(slug).printsCustomerPhotos === true;
}

export function hasPlaceholderCover(slug: string): boolean {
  return mediaFor(slug).placeholderCover === true;
}

/** Bộ ảnh/video cho trang chi tiết, theo khổ đang chọn (nếu có). */
export function galleryFor(slug: string, cover: string | null, sizeKey: string | null, name: string): MediaItem[] {
  const media = mediaFor(slug);
  let images: string[] = [];
  if (media.bySize && sizeKey) {
    const key = media.bySize[sizeKey] ? sizeKey : media.sizeFallback?.[sizeKey];
    images = (key && media.bySize[key]) || [];
  }
  if (!images.length && media.gallery) images = media.gallery;
  const items: MediaItem[] = [];
  if (media.video) items.push({ kind: "video", src: media.video, alt: `Video ${name}` });
  if (!images.length && cover && !media.placeholderCover) images = [cover];
  images.forEach((src, i) => items.push({ kind: "image", src, alt: `Ảnh mẫu ${name} ${i + 1}` }));
  return items;
}

/** Ảnh nhỏ cho một dòng giỏ hàng / đơn: ảnh đầu của khổ đó, hoặc ảnh bìa. */
export function variantThumb(
  product: { slug: string; cover_path: string | null; name: string },
  variant: { width: number | null; height: number | null },
): string | null {
  const key = variant.width && variant.height ? `${variant.width}x${variant.height}` : null;
  const first = galleryFor(product.slug, product.cover_path, key, product.name).find((m) => m.kind === "image");
  return first?.src ?? null;
}
