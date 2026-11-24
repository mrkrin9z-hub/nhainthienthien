/** Tách chữ số từ ô nhập tiền: bỏ dấu chấm/phẩy, khoảng trắng, chữ đ, ký tự khác. */
export function parseGroupedDigits(raw: string): string {
  return String(raw ?? "").replace(/[^\d]/g, "").replace(/^0+(?=\d)/, "");
}

/** 150000 → 150.000 (dấu chấm hàng nghìn kiểu Việt Nam). */
export function formatGroupedDigits(digits: string): string {
  const clean = parseGroupedDigits(digits);
  if (!clean) return "";
  return clean.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

export function groupedIntValue(raw: string | number | null | undefined): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.round(raw) : null;
  const digits = parseGroupedDigits(String(raw ?? ""));
  if (!digits) return null;
  const value = Number(digits);
  return Number.isFinite(value) ? value : null;
}

export function formatGroupedInt(value: number | string | null | undefined): string {
  if (value === null || value === undefined || value === "") return "";
  if (typeof value === "number") {
    if (!Number.isFinite(value)) return "";
    return formatGroupedDigits(String(Math.round(Math.abs(value))));
  }
  return formatGroupedDigits(value);
}

/** Đặt lại con trỏ sau khi thêm/bớt dấu chấm, giữ đúng số chữ số bên trái caret. */
export function caretAfterFormat(before: string, caret: number, after: string): number {
  const left = parseGroupedDigits(before.slice(0, Math.max(0, caret)));
  if (!left) return 0;
  let seen = 0;
  for (let i = 0; i < after.length; i += 1) {
    if (/\d/.test(after[i] ?? "")) {
      seen += 1;
      if (seen === left.length) return i + 1;
    }
  }
  return after.length;
}
