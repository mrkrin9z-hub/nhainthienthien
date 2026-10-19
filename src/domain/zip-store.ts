type ZipEntry = { name: string; bytes: Uint8Array };

const CRC_TABLE = new Uint32Array(256);
for (let index = 0; index < 256; index += 1) {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  CRC_TABLE[index] = crc;
}

export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = CRC_TABLE[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

/** Tên trong zip không có thư mục, không trùng. */
export function zipNames(names: string[]): string[] {
  const seen = new Map<string, number>();
  return names.map((name) => {
    const cleaned = name.replace(/[\\/\u0000-\u001f]/g, "_").trim().slice(-120) || "tep";
    const count = seen.get(cleaned) ?? 0;
    seen.set(cleaned, count + 1);
    if (count === 0) return cleaned;
    const dot = cleaned.lastIndexOf(".");
    if (dot > 0) return `${cleaned.slice(0, dot)}-${count + 1}${cleaned.slice(dot)}`;
    return `${cleaned}-${count + 1}`;
  });
}

function u16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function u32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

/** Zip không nén, để trình duyệt lưu một lần cả bộ ảnh. */
export function zipStored(files: ZipEntry[]): Blob {
  const names = zipNames(files.map((file) => file.name));
  const parts: Uint8Array[] = [];
  const centrals: Uint8Array[] = [];
  let offset = 0;
  files.forEach((file, index) => {
    const name = new TextEncoder().encode(names[index] ?? "tep");
    const crc = crc32(file.bytes);
    const local = new Uint8Array(30 + name.length);
    const localView = new DataView(local.buffer);
    u32(localView, 0, 0x04034b50);
    u16(localView, 4, 20);
    u16(localView, 8, 0);
    u32(localView, 14, crc);
    u32(localView, 18, file.bytes.length);
    u32(localView, 22, file.bytes.length);
    u16(localView, 26, name.length);
    local.set(name, 30);
    parts.push(local, file.bytes);
    const central = new Uint8Array(46 + name.length);
    const centralView = new DataView(central.buffer);
    u32(centralView, 0, 0x02014b50);
    u16(centralView, 4, 20);
    u16(centralView, 6, 20);
    u32(centralView, 16, crc);
    u32(centralView, 20, file.bytes.length);
    u32(centralView, 24, file.bytes.length);
    u16(centralView, 28, name.length);
    u32(centralView, 42, offset);
    central.set(name, 46);
    centrals.push(central);
    offset += local.length + file.bytes.length;
  });
  const centralSize = centrals.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  u32(endView, 0, 0x06054b50);
  u16(endView, 8, files.length);
  u16(endView, 10, files.length);
  u32(endView, 12, centralSize);
  u32(endView, 16, offset);
  return new Blob([...parts, ...centrals, end], { type: "application/zip" });
}
