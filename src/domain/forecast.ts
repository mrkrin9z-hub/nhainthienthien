import type { Material, Movement } from "./types.ts";

/** Phiếu trừ và hoàn của đơn, in lại, mở mực. Nhập hàng và kiểm kho không tính vào mức dùng. */
const USAGE = new Set([
  "Trừ kho khi vào bước in",
  "Trừ kho khi đóng gói xong",
  "Hoàn kho khi lùi khỏi bước in",
  "Hoàn kho khi lùi khỏi đóng gói",
  "In lại",
  "Mở lọ mới",
]);

export const DEFAULT_LEAD_DAYS = 7;

export type MaterialForecast = {
  materialId: string;
  name: string;
  unit: string;
  stock: number;
  used: number;
  avgDaily: number;
  daysLeft: number | null;
  leadTimeDays: number;
  reorder: boolean;
};

export function materialForecast(
  input: { materials: Material[]; movements: Movement[] },
  now = new Date(),
  windowDays = 30,
): MaterialForecast[] {
  const start = now.getTime() - windowDays * 86_400_000;
  const used = new Map<string, number>();
  for (const move of input.movements) {
    if (!USAGE.has(move.reason)) continue;
    const at = Date.parse(move.at);
    if (!Number.isFinite(at) || at < start || at > now.getTime()) continue;
    used.set(move.materialId, (used.get(move.materialId) ?? 0) - move.qty);
  }
  return input.materials.map((material) => {
    const net = Math.max(0, used.get(material.id) ?? 0);
    const avgDaily = Math.round((net / windowDays) * 10000) / 10000;
    const daysLeft = avgDaily > 0 ? Math.floor(material.stock / avgDaily) : null;
    const leadTimeDays = material.leadTimeDays ?? DEFAULT_LEAD_DAYS;
    return {
      materialId: material.id,
      name: material.name,
      unit: material.unit,
      stock: material.stock,
      used: Math.round(net * 10000) / 10000,
      avgDaily,
      daysLeft,
      leadTimeDays,
      reorder: daysLeft !== null && daysLeft < leadTimeDays,
    };
  });
}
