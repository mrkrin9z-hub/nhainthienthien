import { comboPriceError, formulaQty, isMergedWoodAlias, priceOf } from "./calc.ts";
import { isMoHomeGroup, soldOnForNewSku, withChannelSold } from "./mohome.ts";
import type { BomLine, Channel, ChannelPrice, Group, Material, Settings, Sku } from "./types.ts";
import { CHANNELS } from "./types.ts";
import { uniqueKey } from "./web-product.ts";

export type PriceDraft = {
  code: string | null;
  widthCm: number | null;
  heightCm: number | null;
  sheets: number;
  prices: Partial<Record<Channel, number>>;
};

type Col = "code" | "width" | "height" | "sheets" | "size" | Channel;

const HEADER: Record<string, Col> = {
  ma: "code",
  code: "code",
  sku: "code",
  rong: "width",
  "rong cm": "width",
  width: "width",
  ngang: "width",
  cao: "height",
  "cao cm": "height",
  height: "height",
  "so tam": "sheets",
  sheets: "sheets",
  kho: "size",
  "quy cach": "size",
  "kich thuoc": "size",
  gia: "tai_tiem",
  "gia ban": "tai_tiem",
  "tai tiem": "tai_tiem",
  "gia tai tiem": "tai_tiem",
  "tai tiem web": "tai_tiem",
  facebook: "facebook",
  fb: "facebook",
  tiktok: "tiktok",
  "tik tok": "tiktok",
  shopee: "shopee",
};

/** Đọc bảng giá từ dòng Excel/CSV. Dòng đầu là tiêu đề. */
export function parsePriceRows(rows: string[][]): PriceDraft[] {
  if (!rows.length) throw new Error("File trống.");
  const header = rows[0]!.map(columnOf);
  if (!header.some((col) => col === "width" || col === "size" || col === "code")) {
    throw new Error("Dòng tiêu đề cần có Rộng, Cao, Số tấm và Giá tại tiệm. Có thể thêm Mã, Facebook, TikTok, Shopee.");
  }
  if (!header.some((col) => col === "tai_tiem" || col === "facebook" || col === "tiktok" || col === "shopee")) {
    throw new Error("Dòng tiêu đề cần có cột giá: Giá tại tiệm, Facebook, TikTok hoặc Shopee.");
  }
  const drafts: PriceDraft[] = [];
  const problems: string[] = [];
  for (let index = 1; index < rows.length; index++) {
    const row = rows[index] ?? [];
    if (!row.some((cell) => cell.trim())) continue;
    try {
      drafts.push(draftFrom(header, row, index + 1));
    } catch (error) {
      problems.push((error as Error).message);
    }
    if (drafts.length + problems.length > 200) throw new Error("Tối đa 200 dòng mỗi lần.");
  }
  if (problems.length) throw new Error(problems.slice(0, 5).join(" "));
  if (!drafts.length) throw new Error("Không có dòng giá nào.");
  return drafts;
}

export function applyPriceDrafts(
  state: {
    groups: Group[];
    skus: Sku[];
    prices: ChannelPrice[];
    boms: BomLine[];
    materials: Material[];
    settings: Settings;
  },
  groupId: string,
  drafts: PriceDraft[],
): { created: number; updated: number } {
  const group = state.groups.find((item) => item.id === groupId);
  if (!group) throw new Error("Không thấy nhóm giá.");
  if (!drafts.length) throw new Error("Không có dòng giá nào.");
  if (drafts.length > 200) throw new Error("Tối đa 200 dòng mỗi lần.");

  const pending = new Map<string, { sku: Sku; isNew: boolean; prices: Partial<Record<Channel, number>> }>();
  const taken = new Set(state.skus.map((sku) => sku.code));

  for (const draft of drafts) {
    const found = findSku(state.skus, pending, groupId, draft);
    if (found) {
      const current = pending.get(found.id);
      if (current) current.prices = { ...current.prices, ...draft.prices };
      else pending.set(found.id, { sku: found, isNew: false, prices: { ...draft.prices } });
      continue;
    }
    if (draft.widthCm === null || draft.heightCm === null) {
      throw new Error(draft.code ? `Không thấy mã ${draft.code}.` : "Thiếu khổ.");
    }
    if (!isMoHomeGroup(groupId) && draft.prices.tai_tiem === undefined) {
      throw new Error(`Khổ ${draft.widthCm}×${draft.heightCm} cần giá tại tiệm.`);
    }
    if (isMoHomeGroup(groupId) && draft.prices.mo_home === undefined && draft.prices.tai_tiem === undefined) {
      throw new Error(`Khổ ${draft.widthCm}×${draft.heightCm} cần giá nội bộ Mơ Home.`);
    }
    const peers = state.skus.filter((sku) => sku.groupId === groupId && !isMergedWoodAlias(sku));
    const code = draft.code ? freshCode(draft.code, taken) : nextCode(peers, draft, taken);
    taken.add(code);
    const sku: Sku = {
      id: code,
      code,
      groupId,
      name: draft.sheets === 1 ? `${draft.widthCm}×${draft.heightCm} cm` : `${draft.widthCm}×${draft.heightCm} cm · ${draft.sheets} tấm`,
      size: `${draft.widthCm}x${draft.heightCm}`,
      widthCm: draft.widthCm,
      heightCm: draft.heightCm,
      sheets: draft.sheets,
      piecesPerPack: peers.some((item) => item.piecesPerPack !== null) ? draft.sheets : null,
      sort: nextSort(state.skus, pending, groupId),
      soldOn: soldOnForNewSku(groupId, draft.prices),
    };
    pending.set(sku.id, { sku, isNew: true, prices: { ...draft.prices } });
  }

  const createdSkus = [...pending.values()].filter((item) => item.isNew).map((item) => item.sku);
  const all = [...state.skus, ...createdSkus];
  for (const channel of CHANNELS) {
    const sizes = new Set(
      [...pending.values()]
        .filter((item) => item.prices[channel] !== undefined && item.sku.size)
        .map((item) => `${item.sku.groupId}|${item.sku.size}`),
    );
    for (const key of sizes) {
      const [gid, size] = key.split("|");
      const siblings = all.filter(
        (sku) => sku.groupId === gid && sku.size === size && !sku.code.endsWith("-GOI") && !isMergedWoodAlias(sku),
      );
      const error = comboPriceError(
        siblings.map((sku) => ({
          sheets: sku.sheets,
          price: priceAfter(state.prices, pending, sku.id, channel),
        })),
      );
      if (error) throw new Error(error);
    }
  }

  let created = 0;
  let updated = 0;
  for (const item of pending.values()) {
    if (item.isNew) {
      item.sku.soldOn = soldOnForNewSku(groupId, item.prices);
      state.skus.push(item.sku);
      state.boms.push(...copiedBoms(state, groupId, item.sku));
      created += 1;
    } else updated += 1;
    for (const channel of CHANNELS) {
      const price = item.prices[channel];
      if (price === undefined) continue;
      item.sku.soldOn = withChannelSold(item.sku, channel, true);
      const row = state.prices.find((entry) => entry.skuId === item.sku.id && entry.channel === channel);
      if (!row) {
        state.prices.push({
          skuId: item.sku.id,
          channel,
          price,
          status: "dang_ban",
          note: channel === "tai_tiem" ? "Thêm từ bảng giá" : "",
        });
      } else {
        row.price = price;
        row.status = "dang_ban";
      }
    }
  }
  return { created, updated };
}

function findSku(
  skus: Sku[],
  pending: Map<string, { sku: Sku; isNew: boolean; prices: Partial<Record<Channel, number>> }>,
  groupId: string,
  draft: PriceDraft,
): Sku | undefined {
  if (draft.code) {
    const byCode = skus.find((sku) => sku.code === draft.code) ?? [...pending.values()].find((item) => item.sku.code === draft.code)?.sku;
    if (byCode && byCode.groupId !== groupId) throw new Error(`Mã ${draft.code} thuộc nhóm khác.`);
    if (byCode) return byCode;
  }
  if (draft.widthCm === null || draft.heightCm === null) return undefined;
  const same = (sku: Sku) =>
    sku.groupId === groupId &&
    sku.widthCm === draft.widthCm &&
    sku.heightCm === draft.heightCm &&
    sku.sheets === draft.sheets &&
    !isMergedWoodAlias(sku);
  return skus.find(same) ?? [...pending.values()].find((item) => same(item.sku))?.sku;
}

function freshCode(code: string, taken: Set<string>): string {
  const clean = code.trim();
  if (clean.startsWith("EG-")) throw new Error("Không tạo mã EG.");
  if (!/^[A-Za-z][A-Za-z0-9-]{1,48}$/.test(clean)) throw new Error(`Mã ${clean} không hợp lệ.`);
  if (taken.has(clean)) throw new Error(`Mã ${clean} đã có.`);
  return clean;
}

function nextCode(peers: Sku[], draft: PriceDraft, taken: Set<string>): string {
  const sample = peers.find((sku) => prefixOf(sku.code));
  const prefix = sample ? prefixOf(sample.code)! : "KH";
  const gloss = sample ? /-C\d+$/.test(sample.code) : true;
  const body = gloss
    ? `${prefix}-${draft.widthCm}x${draft.heightCm}-C${draft.sheets}`
    : `${prefix}-${draft.widthCm}x${draft.heightCm}-${draft.sheets}`;
  const code = uniqueKey(body, taken);
  if (code.startsWith("EG-")) throw new Error("Không tạo mã EG.");
  return code;
}

function prefixOf(code: string): string | null {
  return (
    /^([A-Za-z][A-Za-z0-9]*)-\d+x\d+-C\d+$/.exec(code)?.[1] ??
    /^(WEB-.+)-\d+x\d+-\d+$/.exec(code)?.[1] ??
    /^([A-Za-z][A-Za-z0-9]*)-\d+x\d+-\d+$/.exec(code)?.[1] ??
    null
  );
}

function nextSort(skus: Sku[], pending: Map<string, { sku: Sku }>, groupId: string): number {
  const sorts = [
    ...skus.filter((sku) => sku.groupId === groupId).map((sku) => sku.sort),
    ...[...pending.values()].filter((item) => item.sku.groupId === groupId).map((item) => item.sku.sort),
  ];
  return Math.max(0, ...sorts) + 1;
}

function priceAfter(
  prices: ChannelPrice[],
  pending: Map<string, { prices: Partial<Record<Channel, number>> }>,
  skuId: string,
  channel: Channel,
): number | null {
  const next = pending.get(skuId)?.prices[channel];
  if (next !== undefined) return next;
  return priceOf(prices, skuId, channel)?.price ?? null;
}

function copiedBoms(
  state: { skus: Sku[]; boms: BomLine[]; materials: Material[]; settings: Settings },
  groupId: string,
  sku: Sku,
): BomLine[] {
  const peers = state.skus.filter(
    (item) => item.groupId === groupId && item.id !== sku.id && !isMergedWoodAlias(item) && state.boms.some((line) => line.skuId === item.id),
  );
  const area = (item: Sku) => Math.abs((item.widthCm ?? 0) * (item.heightCm ?? 0) - (sku.widthCm ?? 0) * (sku.heightCm ?? 0));
  const sibling = peers.filter((item) => item.sheets === sku.sheets).sort((a, b) => area(a) - area(b))[0] ?? peers[0];
  if (!sibling) return [];
  const lines: BomLine[] = [];
  for (const line of state.boms.filter((item) => item.skuId === sibling.id)) {
    let materialId = line.materialId;
    if (line.formula === "wood") {
      materialId = `go-${sku.size}`;
      if (!state.materials.some((item) => item.id === materialId)) continue;
    } else if (!state.materials.some((item) => item.id === materialId)) continue;
    const id = `${sku.id}:${materialId}:${line.phase}`;
    if (state.boms.some((item) => item.id === id) || lines.some((item) => item.id === id)) continue;
    lines.push({
      id,
      skuId: sku.id,
      materialId,
      phase: line.phase,
      scope: line.scope,
      formula: line.formula,
      qty: line.formula === "manual" ? line.qty : formulaQty(line.formula, sku, state.settings),
    });
  }
  return lines;
}

function draftFrom(header: (Col | null)[], row: string[], line: number): PriceDraft {
  const cell = (col: Col) => {
    const index = header.indexOf(col);
    return index < 0 ? "" : (row[index] ?? "").trim();
  };
  const size = parseSize(cell("size"));
  const width = wholeOrNull(cell("width"), `Dòng ${line}: chiều rộng`);
  const height = wholeOrNull(cell("height"), `Dòng ${line}: chiều cao`);
  const sheetsRaw = cell("sheets");
  const sheets = sheetsRaw ? whole(sheetsRaw, `Dòng ${line}: số tấm`, 1, 100) : 1;
  const widthCm = width ?? size?.w ?? null;
  const heightCm = height ?? size?.h ?? null;
  if (widthCm !== null) whole(String(widthCm), `Dòng ${line}: chiều rộng`, 1, 200);
  if (heightCm !== null) whole(String(heightCm), `Dòng ${line}: chiều cao`, 1, 200);
  const prices: Partial<Record<Channel, number>> = {};
  for (const channel of CHANNELS) {
    const raw = cell(channel);
    if (!raw) continue;
    const price = parseMoney(raw);
    if (price === null || !Number.isInteger(price) || price < 1000 || price > 100_000_000) {
      throw new Error(`Dòng ${line}: giá phải là số nguyên từ 1000 đến 100000000.`);
    }
    prices[channel] = price;
  }
  if (!Object.keys(prices).length) throw new Error(`Dòng ${line} thiếu giá.`);
  const code = cell("code") || null;
  if (!code && (widthCm === null || heightCm === null)) throw new Error(`Dòng ${line} thiếu khổ hoặc mã.`);
  return { code, widthCm, heightCm, sheets, prices };
}

function columnOf(value: string): Col | null {
  return HEADER[fold(value)] ?? null;
}

function fold(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/đ/g, "d")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSize(value: string): { w: number; h: number } | null {
  const match = /(\d+)\s*[x×*]\s*(\d+)/i.exec(value);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

function parseMoney(value: string): number | null {
  const text = value.trim().replace(/\s/g, "").replace(/đ$/i, "").replace(/vnd$/i, "");
  if (!text) return null;
  if (/^\d{1,3}(\.\d{3})+$/.test(text) || /^\d{1,3}(,\d{3})+$/.test(text)) return Number(text.replace(/[.,]/g, ""));
  if (!/^\d+$/.test(text)) return null;
  return Number(text);
}

function wholeOrNull(value: string, label: string): number | null {
  if (!value.trim()) return null;
  return whole(value, label, 1, 200);
}

function whole(value: string, label: string, min: number, max: number): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${label} phải là số nguyên.`);
  const number = Number(value);
  if (number < min || number > max) throw new Error(`${label} phải từ ${min} đến ${max}.`);
  return number;
}
