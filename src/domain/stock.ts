import { statusRank, stockNeeds } from "./calc.ts";
import type { Order, OrderStatus, ShopState } from "./types.ts";

const PRINT_OUT = "Trừ kho khi vào bước in";
const PACK_OUT = "Trừ kho khi đóng gói xong";
const PRINT_BACK = "Hoàn kho khi lùi khỏi bước in";
const PACK_BACK = "Hoàn kho khi lùi khỏi đóng gói";

function reasons(phase: "print" | "pack") {
  return phase === "print" ? { out: PRINT_OUT, back: PRINT_BACK } : { out: PACK_OUT, back: PACK_BACK };
}

/** Số đã trừ ròng cho đơn và pha này (trừ − hoàn). */
function netTaken(state: ShopState, orderId: string, phase: "print" | "pack"): Map<string, number> {
  const { out, back } = reasons(phase);
  const map = new Map<string, number>();
  for (const move of state.movements) {
    if (move.orderId !== orderId) continue;
    if (move.reason !== out && move.reason !== back) continue;
    map.set(move.materialId, Math.round(((map.get(move.materialId) ?? 0) - move.qty) * 10000) / 10000);
  }
  return map;
}

function take(state: ShopState, order: Order, phase: "print" | "pack", by: string | null) {
  const { needs, missing } = stockNeeds(
    order.items.map((item) => {
      const sku = state.skus.find((row) => row.id === item.skuId);
      if (!sku) throw new Error("Không thấy quy cách của đơn.");
      return { sku, quantity: item.quantity };
    }),
    state.boms,
    phase,
  );
  const names: string[] = [];
  for (const id of missing) names.push(state.materials.find((material) => material.id === id)?.name ?? id);
  for (const need of needs) {
    if (need.materialId === "tem" && order.channel === "tai_tiem" && order.fulfillment === "pickup") continue;
    const material = state.materials.find((item) => item.id === need.materialId);
    if (!material) continue;
    material.stock = Math.round((material.stock - need.qty) * 10000) / 10000;
    state.movements.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      materialId: material.id,
      qty: -need.qty,
      reason: reasons(phase).out,
      orderId: order.id,
      by,
      note: order.code,
      channel: order.channel,
    });
  }
  order.stockWarning = names.length ? `Chưa trừ được: ${[...new Set(names)].join(", ")} (chưa có định mức).` : "";
}

function giveBack(state: ShopState, order: Order, phase: "print" | "pack", by: string | null) {
  for (const [materialId, qty] of netTaken(state, order.id, phase)) {
    if (qty <= 0) continue;
    const material = state.materials.find((item) => item.id === materialId);
    if (!material) continue;
    material.stock = Math.round((material.stock + qty) * 10000) / 10000;
    state.movements.unshift({
      id: crypto.randomUUID(),
      at: new Date().toISOString(),
      materialId,
      qty,
      reason: reasons(phase).back,
      orderId: order.id,
      by,
      note: order.code,
      channel: order.channel,
    });
  }
}

function holds(status: OrderStatus, from: "in" | "giao"): boolean {
  if (status === "huy" || status === "draft_upload" || status === "upload_error") return false;
  return statusRank(status) >= statusRank(from);
}

/**
 * Trừ kho khi vào In (vật tư in) và khi vào Giao (đóng gói xong).
 * Lùi bước hoặc hủy thì hoàn đúng số đã trừ. Gọi lại cùng trạng thái không trừ thêm.
 */
export function syncOrderStock(state: ShopState, order: Order, next: OrderStatus, by: string | null) {
  const printOn = holds(next, "in");
  const packOn = holds(next, "giao");
  if (printOn && !order.printDeducted) {
    take(state, order, "print", by);
    order.printDeducted = true;
  } else if (!printOn && order.printDeducted) {
    giveBack(state, order, "print", by);
    order.printDeducted = false;
  }
  if (packOn && !order.packDeducted) {
    take(state, order, "pack", by);
    order.packDeducted = true;
  } else if (!packOn && order.packDeducted) {
    giveBack(state, order, "pack", by);
    order.packDeducted = false;
  }
}
