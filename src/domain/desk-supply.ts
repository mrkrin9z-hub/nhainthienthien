import { formulaQty, magnetPiecesOnSheet, materialUnitCost, money } from "./calc.ts";
import { channelPriceFor, masterByCode, MIN_STOCK_20261022, nx12MagnetNote, sheetCostFor } from "./price-import.ts";
import { CHANNELS, type BomLine, type ChannelPrice, type Material, type Settings, type Sku } from "./types.ts";

/** Ước tính phôi nam châm trên dòng NX-12×25 của bảng 22/10. Thay bằng 176.000 ÷ số miếng. */
export const MAGNET_12x25_ESTIMATE = 7500;

const INK_MIN = MIN_STOCK_20261022.muc ?? 2;

export function inkBottle(index: number): Material {
  return {
    id: `muc-${index}`,
    name: `Mực màu ${index}`,
    buyLabel: "lọ — chưa có mã màu",
    unit: "lọ",
    packSize: 1,
    packPrice: null,
    stock: 0,
    minStock: INK_MIN,
    supplier: "",
    pendingPrice: null,
    openingCounted: false,
    code: "",
  };
}

export function inkBottles(): Material[] {
  return Array.from({ length: 9 }, (_, index) => inkBottle(index + 1));
}

type CostSku = { code: string; size: string | null; sheets: number };

/** Vốn bảng giá sau khi cộng tấm gỗ (mã TG) hoặc đổi ước tính nam châm 12×25. Null = giữ nguyên. */
export function deskSheetCost(sku: CostSku, materials: Material[], settings: Settings): number | null {
  const base = sheetCostFor(sku.code);
  if (base === null) return null;
  if (sku.code.startsWith("TG-") && sku.size) {
    const wood = materials.find((item) => item.id === `go-${sku.size}`);
    const unit = wood ? materialUnitCost(wood) : null;
    if (unit === null) return null;
    const sheets = sku.sheets > 0 ? sku.sheets : 1;
    return base + money(unit * sheets);
  }
  if (sku.code === "NX-12x25-C1") {
    const magnet = materials.find((item) => item.id === "nam-cham");
    const pieces = magnetPiecesOnSheet(12, 25, settings.magnetPiecesPerSheet);
    if (!magnet || magnet.packPrice === null || !pieces) return null;
    return base - MAGNET_12x25_ESTIMATE + money(magnet.packPrice / pieces);
  }
  return null;
}

export function applyDeskSheetCosts(skus: CostSku[], materials: Material[], settings: Settings): void {
  for (const sku of skus) {
    const next = deskSheetCost(sku, materials, settings);
    if (next !== null) (sku as { sheetCost?: number | null }).sheetCost = next;
  }
}

type DeskState = {
  settings: Settings;
  skus?: Sku[];
  boms?: BomLine[];
  materials?: Material[];
  prices?: ChannelPrice[];
};

function addBom(
  boms: BomLine[],
  sku: Sku,
  materialId: string,
  phase: BomLine["phase"],
  scope: BomLine["scope"],
  formula: string,
  qty: number | null,
) {
  const id = `${sku.id}:${materialId}:${phase}`;
  if (boms.some((line) => line.id === id || (line.skuId === sku.id && line.materialId === materialId && line.phase === phase))) return;
  boms.push({ id, skuId: sku.id, materialId, phase, scope, formula, qty });
}

/**
 * Gắn gỗ cho mọi mã TG, định mức nam châm theo khổ, thêm NX-12×25 nếu sổ cũ thiếu,
 * và đổi một dòng Mực in thành 9 lọ placeholder. Tồn âm của lọ cũ không copy sang.
 * Chạy một lần. Sổ không có giá cố định thì bỏ qua.
 */
export function applyDeskSupplies(state: DeskState): boolean {
  const settings = state.settings;
  if (settings.deskBom20261023) return false;
  if (!settings.fixedCosts || !state.skus?.length || !state.boms || !state.materials?.length || !state.prices) return false;
  const skus = state.skus;
  const boms = state.boms;
  const materials = state.materials;
  const prices = state.prices;

  for (const sku of skus) {
    if (!sku.code.startsWith("TG-") || !sku.size) continue;
    addBom(boms, sku, `go-${sku.size}`, "print", "sheet", "wood", 1);
  }

  for (const line of boms) {
    if (line.materialId !== "nam-cham" || line.formula === "manual") continue;
    const sku = skus.find((item) => item.id === line.skuId);
    if (!sku?.widthCm || !sku.heightCm) continue;
    const pieces = magnetPiecesOnSheet(sku.widthCm, sku.heightCm, settings.magnetPiecesPerSheet);
    line.formula = "magnet";
    line.qty = pieces ? Math.round((1 / pieces) * 10000) / 10000 : null;
  }

  if (!skus.some((sku) => sku.code === "NX-12x25-C1")) {
    const sku: Sku = {
      id: "NX-12x25-C1",
      code: "NX-12x25-C1",
      groupId: "nam_cham_xe",
      name: "12×25 cm",
      size: "12x25",
      widthCm: 12,
      heightCm: 25,
      sheets: 1,
      piecesPerPack: null,
      sort: Math.max(0, ...skus.map((item) => item.sort ?? 0)) + 1,
    };
    skus.push(sku);
    const row = masterByCode().get(sku.code);
    for (const channel of CHANNELS) {
      if (prices.some((price) => price.skuId === sku.id && price.channel === channel)) continue;
      prices.push(channelPriceFor(sku, channel, row));
    }
    addBom(boms, sku, "nam-cham", "print", "sheet", "magnet", formulaQty("magnet", sku, settings));
    addBom(boms, sku, "tui", "pack", "sheet", "bag", formulaQty("bag", sku, settings));
    addBom(boms, sku, "xop", "pack", "parcel", "foam", formulaQty("foam", sku, settings));
    addBom(boms, sku, "carton", "pack", "parcel", "carton", formulaQty("carton", sku, settings));
    addBom(boms, sku, "bang-keo", "pack", "parcel", "tape", formulaQty("tape", sku, settings));
    addBom(boms, sku, "tem", "pack", "parcel", "label", formulaQty("label", sku, settings));
  }

  if (!materials.some((item) => item.id === "muc-1")) {
    const at = materials.findIndex((item) => item.id === "muc");
    const bottles = inkBottles();
    if (at >= 0) materials.splice(at, 1, ...bottles);
    else materials.push(...bottles);
  } else {
    const at = materials.findIndex((item) => item.id === "muc");
    if (at >= 0) materials.splice(at, 1);
  }

  applyDeskSheetCosts(skus, materials, settings);
  const note = nx12MagnetNote(
    materials.find((item) => item.id === "nam-cham")?.packPrice ?? 176000,
    settings.magnetPiecesPerSheet,
  );
  for (const price of prices) {
    if (price.skuId === "NX-12x25-C1" && price.note === "Đổi từ 9×19 ngày 22/10. Vốn vật tư là ước tính.") price.note = note;
  }

  settings.deskBom20261023 = true;
  return true;
}
