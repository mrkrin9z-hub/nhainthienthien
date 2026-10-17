import { strFromU8, unzipSync } from "fflate";

export function parseCsv(text: string): string[][] {
  const src = text.replace(/^\uFEFF/, "");
  const delimiter = detectDelimiter(src);
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let quoted = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]!;
    if (quoted) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"';
          i += 1;
        } else quoted = false;
      } else cell += ch;
      continue;
    }
    if (ch === '"') {
      quoted = true;
      continue;
    }
    if (ch === delimiter) {
      row.push(cell);
      cell = "";
      continue;
    }
    if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && src[i + 1] === "\n") i += 1;
      row.push(cell);
      cell = "";
      if (row.some((part) => part.trim())) rows.push(row);
      row = [];
      continue;
    }
    cell += ch;
  }
  row.push(cell);
  if (row.some((part) => part.trim())) rows.push(row);
  return rows;
}

function detectDelimiter(text: string): "," | "\t" | ";" {
  const line = text.split(/\r?\n/, 1)[0] ?? "";
  const counts: Record<"," | "\t" | ";", number> = { ",": 0, "\t": 0, ";": 0 };
  let quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (ch === '"') quoted = !quoted;
    else if (!quoted && (ch === "," || ch === "\t" || ch === ";")) counts[ch] += 1;
  }
  if (counts["\t"] >= counts[","] && counts["\t"] >= counts[";"] && counts["\t"] > 0) return "\t";
  if (counts[";"] > counts[","]) return ";";
  return ",";
}

export function rowsFromXlsx(bytes: Uint8Array): string[][] {
  let files: Record<string, Uint8Array>;
  try {
    files = unzipSync(bytes);
  } catch {
    throw new Error("Không đọc được file Excel.");
  }
  const sheetName = Object.keys(files).find((name) => /xl\/worksheets\/sheet1\.xml$/.test(name));
  if (!sheetName) throw new Error("File Excel không có sheet đầu.");
  const shared = parseSharedStrings(files["xl/sharedStrings.xml"]);
  return parseSheet(strFromU8(files[sheetName]!), shared);
}

export function rowsFromUpload(filename: string, bytes: Uint8Array): string[][] {
  const lower = filename.toLowerCase();
  const zip = bytes.length > 2 && bytes[0] === 0x50 && bytes[1] === 0x4b;
  if (lower.endsWith(".xlsx") || zip) return rowsFromXlsx(bytes);
  return parseCsv(new TextDecoder().decode(bytes));
}

function parseSharedStrings(bytes: Uint8Array | undefined): string[] {
  if (!bytes) return [];
  const xml = strFromU8(bytes);
  const out: string[] = [];
  const items = xml.match(/<si\b[\s\S]*?<\/si>/g) ?? [];
  for (const item of items) {
    const texts = [...item.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1] ?? ""));
    out.push(texts.join(""));
  }
  return out;
}

function parseSheet(xml: string, shared: string[]): string[][] {
  const rows: string[][] = [];
  const rawRows = xml.match(/<row\b[\s\S]*?<\/row>/g) ?? [];
  for (const raw of rawRows) {
    const cells = [...raw.matchAll(/<c\b([^>]*)>([\s\S]*?)<\/c>/g)];
    if (!cells.length) continue;
    let width = 0;
    const placed: { index: number; value: string }[] = [];
    for (const cell of cells) {
      const attrs = cell[1] ?? "";
      const body = cell[2] ?? "";
      const ref = /r="([A-Z]+)\d+"/.exec(attrs)?.[1] ?? "";
      const index = ref ? colIndex(ref) : placed.length;
      const type = /t="([^"]+)"/.exec(attrs)?.[1] ?? "";
      const value = cellValue(body, type, shared);
      placed.push({ index, value });
      width = Math.max(width, index + 1);
    }
    const row = Array.from({ length: width }, () => "");
    for (const item of placed) row[item.index] = item.value;
    if (row.some((part) => part.trim())) rows.push(row);
  }
  return rows;
}

function cellValue(body: string, type: string, shared: string[]): string {
  if (type === "inlineStr") {
    return [...body.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)].map((match) => decodeXml(match[1] ?? "")).join("");
  }
  const raw = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1] ?? "";
  if (type === "s") return shared[Number(raw)] ?? "";
  return decodeXml(raw);
}

function colIndex(letters: string): number {
  let n = 0;
  for (const char of letters) n = n * 26 + (char.charCodeAt(0) - 64);
  return n - 1;
}

function decodeXml(value: string): string {
  return value
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&apos;", "'")
    .replaceAll("&amp;", "&");
}
