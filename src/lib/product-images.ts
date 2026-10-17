import imgGoLua from "@/assets/prod-anh-go-lua.jpg";
import imgTrangGuong from "@/assets/prod-trang-guong.jpg";
import imgAnhThe from "@/assets/prod-anh-the.jpg";
import imgPhucHoi from "@/assets/prod-phuc-hoi-anh-cu.jpg";
import imgNamCham from "@/assets/prod-anh-nam-cham.jpg";
import imgAlbum from "@/assets/prod-album.jpg";

export const PRODUCT_IMAGES: Record<string, string> = {
  "anh-ep-go": imgGoLua,
  "anh-tho": imgPhucHoi,
  "giay-khen": imgGoLua,
  "nam-cham-xe": imgNamCham,
  "nam-cham-tu-lanh": imgNamCham,
  "anh-go-lua": imgGoLua,
  "trang-guong": imgTrangGuong,
  "thoi-khoa-bieu": imgGoLua,
  "anh-lua-6x9": imgTrangGuong,
  "anh-the": imgAnhThe,
  "phuc-hoi-anh-cu": imgPhucHoi,
  "anh-nam-cham": imgNamCham,
  album: imgAlbum,
};

export const FALLBACK_PRODUCT_IMAGE = imgGoLua;

export function productImage(slug: string): string {
  return PRODUCT_IMAGES[slug] ?? FALLBACK_PRODUCT_IMAGE;
}

export function catalogImage(slug: string, coverPath?: string | null): string {
  return coverPath || productImage(slug);
}
