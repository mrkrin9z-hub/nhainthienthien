import type { OrderFile, ShopState } from "./types.ts";

const DAY = 86400000;

export type PurgeTarget = {
  orderId: string;
  orderCode: string;
  fileId: string;
  name: string;
  kind: string;
  ageDays: number;
};

/**
 * Ảnh gốc: xoá khi đơn đã xong và đã quá `fileRetentionDays` kể từ lúc xong.
 * Video đóng gói: xoá sau `videoRetentionDays` kể từ lúc tải lên.
 */
export function filesToPurge(state: ShopState, now = Date.now()): PurgeTarget[] {
  const rows: PurgeTarget[] = [];
  for (const order of state.orders) {
    for (const file of order.files) {
      if (file.deletedAt || file.status !== "complete") continue;
      if (file.kind === "packing_video") {
        const ageDays = (now - new Date(file.createdAt).getTime()) / DAY;
        if (ageDays >= state.settings.videoRetentionDays) {
          rows.push({
            orderId: order.id,
            orderCode: order.code,
            fileId: file.id,
            name: file.name,
            kind: file.kind,
            ageDays: Math.floor(ageDays),
          });
        }
        continue;
      }
      if (file.kind !== "original") continue;
      if (order.status !== "xong" || !order.completedAt) continue;
      const ageDays = (now - new Date(order.completedAt).getTime()) / DAY;
      if (ageDays >= state.settings.fileRetentionDays) {
        rows.push({
          orderId: order.id,
          orderCode: order.code,
          fileId: file.id,
          name: file.name,
          kind: file.kind,
          ageDays: Math.floor(ageDays),
        });
      }
    }
  }
  return rows;
}

/** Cùng một file có thể nằm trên đơn và trong album. Chỉ xóa byte khi không còn bản nào sống. */
export function bytesStillShared(state: ShopState, file: OrderFile): boolean {
  const pools = [...state.orders.map((order) => order.files), ...(state.albums ?? []).map((album) => album.files)];
  return pools.some((files) =>
    files.some(
      (item) =>
        item !== file &&
        !item.deletedAt &&
        (item.id === file.id || (item.storage === file.storage && item.path !== "" && item.path === file.path)),
    ),
  );
}
