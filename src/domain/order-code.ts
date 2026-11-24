/** Mã đơn mới: DH0001, DH0002… (tăng dần toàn shop). */

export const ORDER_CODE_PREFIX = "DH";

const DH_RE = /^DH(\d+)$/i;

/** Lấy số thứ tự từ mã DH####. Không khớp → null. */
export function parseDeskOrderSeq(code: string): number | null {
  const match = String(code ?? "")
    .trim()
    .toUpperCase()
    .match(DH_RE);
  if (!match) return null;
  const n = Number(match[1]);
  return Number.isFinite(n) && n > 0 ? n : null;
}

/** Max seq đã dùng từ danh sách mã (+ bộ đếm lưu nếu có). */
export function maxDeskOrderSeq(codes: string[], storedSeq = 0): number {
  let max = Math.max(0, Math.floor(Number(storedSeq) || 0));
  for (const code of codes) {
    const n = parseDeskOrderSeq(code);
    if (n != null) max = Math.max(max, n);
  }
  return max;
}

/** Mã tiếp theo: DH0001… — pad ít nhất 4 chữ số. */
export function formatDeskOrderCode(seq: number): string {
  const n = Math.max(1, Math.floor(seq));
  return `${ORDER_CODE_PREFIX}${String(n).padStart(4, "0")}`;
}

export function nextDeskOrderCode(codes: string[], storedSeq = 0): { code: string; seq: number } {
  const seq = maxDeskOrderSeq(codes, storedSeq) + 1;
  return { code: formatDeskOrderCode(seq), seq };
}
