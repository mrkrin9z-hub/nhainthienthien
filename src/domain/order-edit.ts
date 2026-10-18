/** Đơn đã khóa hoặc đã trừ kho thì không cho đổi sản phẩm. */
export function orderRevisionBlock(
  order: { status: string; printDeducted: boolean; packDeducted: boolean },
  changingItems: boolean,
): string | null {
  if (order.status === "huy" || order.status === "xong") return "Mở lại đơn trước khi sửa.";
  if (changingItems && (order.printDeducted || order.packDeducted)) {
    return "Đơn đã trừ kho. Lùi về trước bước In rồi mới sửa sản phẩm.";
  }
  return null;
}
