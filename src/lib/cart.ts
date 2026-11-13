import { useCallback, useSyncExternalStore } from "react";

/** Giỏ hàng trên máy khách (localStorage). Đơn thật chỉ tạo ở /dat-in. */
export type CartLine = { variantId: string; qty: number; design?: string };

const KEY = "tt-cart-v1";
const EMPTY: CartLine[] = [];
let snapshot: CartLine[] | null = null;
const listeners = new Set<() => void>();

function read(): CartLine[] {
  if (typeof window === "undefined") return EMPTY;
  if (snapshot) return snapshot;
  try {
    const raw = JSON.parse(window.localStorage.getItem(KEY) ?? "[]");
    snapshot = Array.isArray(raw)
      ? raw
          .filter((l) => l && typeof l.variantId === "string" && Number(l.qty) > 0)
          .map((l) => ({ variantId: l.variantId, qty: Math.min(500, Math.round(Number(l.qty))), ...(l.design ? { design: String(l.design) } : {}) }))
      : [];
  } catch {
    snapshot = [];
  }
  return snapshot;
}

function write(next: CartLine[]) {
  snapshot = next.filter((l) => l.qty > 0);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    /* bộ nhớ đầy hoặc chế độ riêng tư: giữ trong phiên */
  }
  listeners.forEach((fn) => fn());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  const onStorage = (event: StorageEvent) => {
    if (event.key === KEY) {
      snapshot = null;
      fn();
    }
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(fn);
    window.removeEventListener("storage", onStorage);
  };
}

const same = (a: CartLine, variantId: string, design?: string) => a.variantId === variantId && (a.design ?? "") === (design ?? "");

export function useCart() {
  const lines = useSyncExternalStore(subscribe, read, () => EMPTY);
  const add = useCallback((variantId: string, qty: number, design?: string) => {
    const cur = read();
    const hit = cur.find((l) => same(l, variantId, design));
    write(
      hit
        ? cur.map((l) => (l === hit ? { ...l, qty: Math.min(500, l.qty + qty) } : l))
        : [...cur, { variantId, qty: Math.min(500, qty), ...(design ? { design } : {}) }],
    );
  }, []);
  const setQty = useCallback((variantId: string, design: string | undefined, qty: number) => {
    write(read().map((l) => (same(l, variantId, design) ? { ...l, qty: Math.max(0, Math.min(500, qty)) } : l)));
  }, []);
  const remove = useCallback((variantId: string, design?: string) => {
    write(read().filter((l) => !same(l, variantId, design)));
  }, []);
  const clear = useCallback(() => write([]), []);
  const count = lines.reduce((sum, l) => sum + l.qty, 0);
  return { lines, count, add, setQty, remove, clear };
}

/** Chuỗi ?items= cho /dat-in: "id:qty,id:qty" (gộp các mẫu cùng mã). */
export function itemsParam(lines: CartLine[]): string {
  const merged = new Map<string, number>();
  for (const l of lines) merged.set(l.variantId, (merged.get(l.variantId) ?? 0) + l.qty);
  return [...merged].map(([id, qty]) => `${id}:${qty}`).join(",");
}

/** Ghi chú mẫu khách chọn, gửi kèm đơn. */
export function designNote(lines: CartLine[], nameOf: (variantId: string) => string): string {
  const parts = lines.filter((l) => l.design).map((l) => `${nameOf(l.variantId)}: ${l.design} × ${l.qty}`);
  return parts.length ? `Mẫu khách chọn: ${parts.join("; ")}` : "";
}
