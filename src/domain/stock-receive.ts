export type StockPick = { id: string; name: string; unit: string };

/** Đơn vị lần mua. Gỗ tính tấm, giấy và màng tính cuộn, mực tính lọ. */
export function purchaseUnit(material: StockPick): string {
  const blob = `${material.id} ${material.name}`.toLowerCase();
  if (/mực|muc-/.test(blob)) return "lọ";
  if (/^go-|tấm nền gỗ|\bgỗ\b/.test(blob)) return "tấm";
  if (/giấy|giay/.test(blob)) return "cuộn";
  if (/màng|(^|\s)mang(\s|$)/.test(blob)) return "cuộn";
  if (/nam châm|nam-cham/.test(blob)) return "tấm";
  if (/băng keo|bang-keo|xốp|xop/.test(blob)) return "cuộn";
  return material.unit;
}

export function sizeLabel(material: { id: string; name: string }): string {
  const found = `${material.id} ${material.name}`.match(/(\d+)\s*[x×]\s*(\d+)/i);
  return found ? `${found[1]}×${found[2]}` : "";
}

export function familyKey(material: { id: string }): string {
  return material.id.replace(/-\d+x\d+$/i, "");
}

/** Mọi khổ cùng họ, ví dụ gỗ 13×18 đến 60×90. */
export function familySizes<T extends { id: string; name: string }>(materials: T[], materialId: string): T[] {
  const current = materials.find((item) => item.id === materialId);
  if (!current) return [];
  const key = familyKey(current);
  const siblings = materials.filter((item) => familyKey(item) === key && sizeLabel(item));
  return siblings.length > 1 ? siblings : [];
}
