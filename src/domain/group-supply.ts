import { edgeMeters, magnetPiecesOnSheet, rollMeters, round4, wrapM2 } from "./calc.ts";
import type { BomLine, GroupSizeOverride, GroupSupply, Settings, Sku, SupplyScale } from "./types.ts";

export const SUPPLY_SCALE_LABEL: Record<SupplyScale, string> = {
  per_sheet: "Mỗi tấm",
  per_parcel: "Mỗi kiện",
  size_sheet: "Tấm theo khổ (gỗ…)",
  roll_m: "Mét cuộn theo khổ",
  edge_m: "Mét viền theo chu vi",
  wrap_m2: "m² bọc theo khổ",
  area_ml: "ml theo m² (không dùng cho mực)",
  magnet: "Tấm nam châm chia theo khổ",
  tape: "Cuộn băng keo chia theo đơn",
};

type SupplyMaterial = { id: string; unit: string; packSize: number | null; stock?: number; packPrice?: number | null; buyLabel?: string };

type SupplyState = {
  boms: BomLine[];
  settings: Settings;
  materials?: SupplyMaterial[];
  groupSupplies?: GroupSupply[];
  sizeOverrides?: GroupSizeOverride[];
};

const WOOD_GROUPS = ["anh_tho", "giay_khen", "tkb", "trang_guong"] as const;
const DESK_SIZES = ["13x18", "15x21", "20x30"] as const;
const WALL_SIZES = ["30x45", "40x60", "50x75", "60x90"] as const;

function rule(groupId: string, materialId: string, phase: GroupSupply["phase"], scale: SupplyScale, qty: number | null, rollWidthCm?: number): GroupSupply {
  return {
    id: `${groupId}:${materialId}:${phase}:${scale}`,
    groupId,
    materialId,
    phase,
    scale,
    qty,
    ...(rollWidthCm ? { rollWidthCm } : {}),
  };
}

function packRules(groupId: string): GroupSupply[] {
  return [
    rule(groupId, "tui", "pack", "per_sheet", 1),
    rule(groupId, "xop", "pack", "wrap_m2", null),
    rule(groupId, "carton", "pack", "wrap_m2", null),
    rule(groupId, "bang-keo", "pack", "tape", 1),
    rule(groupId, "tem", "pack", "per_parcel", 1),
  ];
}

function printSurface(groupId: string, paperId: string, film: boolean, rollWidthCm: number, filmWidthCm: number): GroupSupply[] {
  return [
    rule(groupId, paperId, "print", "roll_m", null, rollWidthCm),
    ...(film ? [rule(groupId, "mang", "print", "roll_m", null, filmWidthCm)] : []),
  ];
}

/** Định mức gốc, chép từ công thức đang dùng (giấy/màng theo cuộn, gỗ theo khổ, mực theo diện tích). */
export function defaultGroupSupplies(settings: Pick<Settings, "ppRollWidthCm" | "filmRollWidthCm">): GroupSupply[] {
  const paper = settings.ppRollWidthCm || 61;
  const film = settings.filmRollWidthCm || 62;
  const rows: GroupSupply[] = [];
  for (const groupId of WOOD_GROUPS) {
    rows.push(rule(groupId, "go", "print", "size_sheet", 1));
    rows.push(...printSurface(groupId, "giay-pp", true, paper, film));
    rows.push(rule(groupId, "vien", "print", "edge_m", null));
    rows.push(...packRules(groupId));
  }
  rows.push(rule("nam_cham_xe", "nam-cham", "print", "magnet", 1));
  rows.push(...packRules("nam_cham_xe"));
  rows.push(rule("nam_cham_tu", "nam-cham", "print", "magnet", 1));
  rows.push(...printSurface("nam_cham_tu", "giay-pp", true, paper, film));
  rows.push(...packRules("nam_cham_tu"));
  rows.push(...printSurface("lua", "giay-lua", false, paper, film));
  rows.push(...packRules("lua"));
  return rows;
}

export function defaultSizeOverrides(): GroupSizeOverride[] {
  const rows: GroupSizeOverride[] = [];
  for (const groupId of WOOD_GROUPS) {
    for (const size of DESK_SIZES) {
      rows.push({ id: `${groupId}:${size}:chan`, groupId, size, materialId: "chan", phase: "print", qty: 1 });
    }
    for (const size of WALL_SIZES) {
      rows.push({ id: `${groupId}:${size}:moc`, groupId, size, materialId: "moc", phase: "print", qty: 2 });
      rows.push({ id: `${groupId}:${size}:oc`, groupId, size, materialId: "oc", phase: "print", qty: 2 });
    }
  }
  return rows;
}

export function ensureGroupSupplies(state: SupplyState & { settings: Settings }): boolean {
  if (state.settings.groupSupply20261024) return false;
  state.groupSupplies = defaultGroupSupplies(state.settings);
  state.sizeOverrides = defaultSizeOverrides();
  state.settings.groupSupply20261024 = true;
  return true;
}

export function isInkMaterial(materialId: string): boolean {
  return /^muc-[1-9]$/.test(materialId);
}

/** Mực không vào định mức. Tồn đếm theo lọ; ml đã trừ theo bản in không phải số lọ. */
export function ensureInkExpenseModel(state: SupplyState & { boms?: BomLine[] }): boolean {
  if (state.settings.inkExpense20261024) return false;
  if (state.groupSupplies) {
    state.groupSupplies = state.groupSupplies.filter((item) => !isInkMaterial(item.materialId) && item.scale !== "area_ml");
  }
  if (state.sizeOverrides) {
    state.sizeOverrides = state.sizeOverrides.filter((item) => !isInkMaterial(item.materialId));
  }
  if (state.boms) {
    state.boms = state.boms.filter((item) => !isInkMaterial(item.materialId));
  }
  for (const material of state.materials ?? []) {
    if (!isInkMaterial(material.id)) continue;
    const countedAsMl = material.unit === "ml";
    material.unit = "lọ";
    material.packSize = 1;
    material.buyLabel = "một lọ";
    if (countedAsMl) material.stock = 0;
  }
  state.settings.inkExpense20261024 = true;
  return true;
}

/** Lọ mực tồn 0, chưa có giá: chuyển đơn vị sang ml. Không đụng lọ đã có tồn hoặc đã có giá. */
export function ensureInkMillilitres(state: SupplyState): boolean {
  if (state.settings.inkMl20261024) return false;
  for (const material of state.materials ?? []) {
    if (!material.id.startsWith("muc-")) continue;
    const empty = material.stock === 0 && material.packPrice == null && (material.packSize === 1 || material.packSize == null);
    if (material.unit === "lọ" && empty) {
      material.unit = "ml";
      material.packSize = null;
      material.buyLabel = "một lọ — quy cách là số ml trong lọ";
    }
  }
  state.settings.inkMl20261024 = true;
  return true;
}

/** size_sheet lưu tiền tố (`go`), tấm kho là `go-13x18`. Chọn nhầm một tấm thì cắt khổ đi. */
export function sizeSheetMaterialId(materialId: string): string {
  return materialId.trim().replace(/-\d+x\d+$/i, "");
}

const AUTO_SCALES = new Set<SupplyScale>(["roll_m", "edge_m", "wrap_m2"]);

export function scaleQtyIsAutomatic(scale: SupplyScale): boolean {
  return AUTO_SCALES.has(scale);
}

/** Danh sách vật tư trong form nhóm. Tấm theo khổ chỉ hiện tiền tố, không hiện từng khổ. */
export function materialOptionsForScale(
  materials: { id: string; name: string }[],
  scale: SupplyScale,
  currentId: string,
): { id: string; name: string }[] {
  const shelf = materials.filter((material) => !isInkMaterial(material.id));
  if (scale === "size_sheet") {
    const prefixes = new Map<string, string>();
    const label = (prefix: string) => (prefix === "go" ? "Gỗ (tấm theo khổ)" : `${prefix} (tấm theo khổ)`);
    for (const material of shelf) {
      const prefix = material.id.match(/^(.*)-\d+x\d+$/i)?.[1];
      if (prefix && !prefixes.has(prefix)) prefixes.set(prefix, label(prefix));
    }
    const current = sizeSheetMaterialId(currentId);
    if (current && !prefixes.has(current)) prefixes.set(current, label(current));
    return [...prefixes].map(([id, name]) => ({ id, name }));
  }
  const options = shelf.map((material) => ({ id: material.id, name: material.name }));
  if (currentId && !isInkMaterial(currentId) && !options.some((item) => item.id === currentId)) {
    options.unshift({ id: currentId, name: currentId === "go" ? "Gỗ (tấm theo khổ)" : currentId });
  }
  return options;
}

function rollWidth(ruleRow: GroupSupply, settings: Settings): number {
  if (ruleRow.rollWidthCm && ruleRow.rollWidthCm > 0) return ruleRow.rollWidthCm;
  return ruleRow.materialId === "mang" ? settings.filmRollWidthCm : settings.ppRollWidthCm;
}

function areaStockQty(ml: number, materialId: string, materials: SupplyMaterial[] | undefined): number | null {
  const material = materials?.find((item) => item.id === materialId);
  if (!material || /ml/i.test(material.unit)) return ml;
  return null;
}

function scaledQty(ruleRow: GroupSupply, sku: Sku, settings: Settings, materials: SupplyMaterial[] | undefined): { materialId: string; qty: number | null; scope: BomLine["scope"] } {
  const width = sku.widthCm;
  const height = sku.heightCm;
  const prefix = ruleRow.scale === "size_sheet" ? sizeSheetMaterialId(ruleRow.materialId) : ruleRow.materialId;
  const materialId = ruleRow.scale === "size_sheet" && sku.size ? `${prefix}-${sku.size}` : prefix;
  if (ruleRow.scale === "per_sheet" || ruleRow.scale === "size_sheet") {
    return { materialId, qty: ruleRow.qty, scope: "sheet" };
  }
  if (ruleRow.scale === "per_parcel") return { materialId, qty: ruleRow.qty, scope: "parcel" };
  if (ruleRow.scale === "tape") {
    return { materialId, qty: settings.tapeOrdersPerRoll ? round4((ruleRow.qty ?? 1) / settings.tapeOrdersPerRoll) : null, scope: "parcel" };
  }
  if (!width || !height) return { materialId, qty: null, scope: ruleRow.scale === "wrap_m2" ? "parcel" : "sheet" };
  if (ruleRow.scale === "roll_m") return { materialId, qty: rollMeters(width, height, rollWidth(ruleRow, settings), settings.wasteRate), scope: "sheet" };
  if (ruleRow.scale === "edge_m") return { materialId, qty: edgeMeters(width, height), scope: "sheet" };
  if (ruleRow.scale === "wrap_m2") return { materialId, qty: wrapM2(width, height), scope: "parcel" };
  if (ruleRow.scale === "area_ml") {
    const ml = ruleRow.qty === null ? null : round4(((width * height) / 10000) * ruleRow.qty);
    return { materialId, qty: ml === null ? null : areaStockQty(ml, materialId, materials), scope: "sheet" };
  }
  const pieces = magnetPiecesOnSheet(width, height, settings.magnetPiecesPerSheet);
  return { materialId, qty: pieces ? round4((ruleRow.qty ?? 1) / pieces) : null, scope: "sheet" };
}

/**
 * Định mức của một sản phẩm. Nhóm có quy tắc thì tính từ nhóm × khổ.
 * Nhóm chưa có quy tắc thì giữ dòng BOM cũ của mã đó.
 */
export function linesForSku(state: SupplyState, sku: Sku): BomLine[] {
  const rules = (state.groupSupplies ?? []).filter((item) => item.groupId === sku.groupId);
  const overrides = (state.sizeOverrides ?? []).filter((item) => item.groupId === sku.groupId && item.size === sku.size);
  if (!rules.length) return state.boms.filter((item) => item.skuId === sku.id);

  const lines: BomLine[] = [];
  for (const ruleRow of rules) {
    if (isInkMaterial(ruleRow.materialId) || ruleRow.scale === "area_ml") continue;
    const scaled = scaledQty(ruleRow, sku, state.settings, state.materials);
    const override = overrides.find((item) => item.materialId === scaled.materialId && item.phase === ruleRow.phase);
    const qty = override ? override.qty : scaled.qty;
    if (qty === 0) continue;
    lines.push({
      id: `${sku.id}:${scaled.materialId}:${ruleRow.phase}`,
      skuId: sku.id,
      materialId: scaled.materialId,
      phase: ruleRow.phase,
      scope: scaled.scope,
      qty,
      formula: "group",
    });
  }
  for (const override of overrides) {
    if (isInkMaterial(override.materialId)) continue;
    if (override.qty === 0 || override.qty === null) continue;
    if (lines.some((line) => line.materialId === override.materialId && line.phase === override.phase)) continue;
    lines.push({
      id: `${sku.id}:${override.materialId}:${override.phase}`,
      skuId: sku.id,
      materialId: override.materialId,
      phase: override.phase,
      scope: "sheet",
      qty: override.qty,
      formula: "group",
    });
  }
  return lines;
}
