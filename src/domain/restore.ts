import type { ShopState } from "./types.ts";

export type RestoreSummary = {
  keep: string[];
  replace: string[];
};

/** Khôi phục sổ nhưng giữ tài khoản, mật khẩu và mã 2 lớp đang dùng. */
export function applyRestore(current: ShopState, incoming: ShopState): ShopState {
  const next = structuredClone(incoming);
  next.staff = structuredClone(current.staff);
  next.version = current.version;
  return next;
}

export function restoreSummary(current: ShopState, incoming: ShopState): RestoreSummary {
  const priced = incoming.prices.filter((row) => row.price !== null).length;
  return {
    keep: ["Tài khoản nhân viên", "Mật khẩu", "Xác thực 2 lớp"],
    replace: [
      `Đơn hàng: ${incoming.orders.length} (đang có ${current.orders.length})`,
      `Khách: ${incoming.customers.length} (đang có ${current.customers.length})`,
      `Giá bán: ${priced} dòng có số`,
      `Kho: ${incoming.materials.length} vật tư, tồn theo bản sao`,
      "Cài đặt, công thức và nhật ký trong bản sao",
    ],
  };
}
