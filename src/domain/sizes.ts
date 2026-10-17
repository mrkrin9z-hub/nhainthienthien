/** Ảnh in (ép gỗ, giấy khen, tráng gương). */
export const PHOTO_PRINT_SIZES = ["13x18", "15x21", "20x30", "30x45", "40x60", "50x75", "60x90"] as const;

/** Nam châm tủ lạnh (ảnh). */
export const FRIDGE_MAGNET_SIZES = ["6x9"] as const;

/** Nam châm dán xe, sản phẩm riêng. */
export const CAR_MAGNET_SIZES = ["9x19", "17x22"] as const;

const PRINT_GROUPS = new Set(["ep_go", "giay_khen", "trang_guong"]);

export function sizeFitsProduct(groupId: string, size: string | null): boolean {
  if (groupId === "nam_cham_tu") return size === "6x9";
  if (groupId === "nam_cham_xe") return (CAR_MAGNET_SIZES as readonly string[]).includes(size ?? "");
  if (groupId === "anh_tho") {
    return size !== null && size !== "13x18" && size !== "15x21" && (PHOTO_PRINT_SIZES as readonly string[]).includes(size);
  }
  if (groupId === "tkb") return size === "20x30";
  if (PRINT_GROUPS.has(groupId)) return size !== null && (PHOTO_PRINT_SIZES as readonly string[]).includes(size);
  if (groupId === "lua") return size === "6x9";
  if (groupId === "anh_the") return size === "4x6";
  if (groupId === "album") return size === null;
  return false;
}
