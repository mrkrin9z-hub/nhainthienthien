/** Byte Windows-1252 cho các dấu hay bị hiểu nhầm khi UTF-8 đọc sai bảng mã. */
const CP1252_BYTE: Record<number, number> = {
  0x20ac: 0x80,
  0x201a: 0x82,
  0x0192: 0x83,
  0x201e: 0x84,
  0x2026: 0x85,
  0x2020: 0x86,
  0x2021: 0x87,
  0x02c6: 0x88,
  0x2030: 0x89,
  0x0160: 0x8a,
  0x2039: 0x8b,
  0x0152: 0x8c,
  0x017d: 0x8e,
  0x2018: 0x91,
  0x2019: 0x92,
  0x201c: 0x93,
  0x201d: 0x94,
  0x2022: 0x95,
  0x2013: 0x96,
  0x2014: 0x97,
  0x02dc: 0x98,
  0x2122: 0x99,
  0x0161: 0x9a,
  0x203a: 0x9b,
  0x0153: 0x9c,
  0x017e: 0x9e,
  0x0178: 0x9f,
};

function toByte(code: number): number | null {
  if (code <= 0xff) return code;
  return CP1252_BYTE[code] ?? null;
}

function utf8Score(value: string): number {
  let score = 0;
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    if (code === 0x2014 || code === 0x2013) score += 2;
    if (code > 255) score += 1;
  }
  return score;
}

/**
 * Sửa chữ UTF-8 bị đọc thành Latin-1/CP1252 (ví dụ "Táº¡o", "â€”").
 * Chuỗi tiếng Việt đã đúng thì giữ nguyên, chỉ thay cụm gạch ngang hỏng nằm trong câu.
 */
export function repairMojibake(value: string): string {
  if (!value) return value;
  let next = value.replaceAll("â€”", "—").replaceAll("\u00e2\u0080\u0094", "—").replaceAll("\u00e2\u20ac\u201d", "—").replaceAll(" â ", " — ");
  const bytes: number[] = [];
  for (const char of next) {
    const byte = toByte(char.codePointAt(0) ?? 0);
    if (byte === null) return next;
    bytes.push(byte);
  }
  let decoded = "";
  try {
    decoded = new TextDecoder("utf-8", { fatal: true }).decode(Uint8Array.from(bytes));
  } catch {
    return next;
  }
  if (decoded === next) return next;
  if (utf8Score(decoded) <= utf8Score(next)) return next;
  return decoded;
}

export function repairTextField<T extends string | null | undefined>(value: T): T {
  if (typeof value !== "string" || !value) return value;
  const next = repairMojibake(value);
  return (next === value ? value : next) as T;
}
