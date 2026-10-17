const LEGACY_ANH_THO = "Miễn phí khôi phục, thay áo, đổi nền. Không giới hạn số lần sửa.";
const NEXT_ANH_THO = "Hỗ trợ chỉnh sửa ảnh cơ bản.";
const GLOSS_NAME = "Ảnh ép gỗ tráng gương bo viền";
const LEGACY_GLOSS_NAMES = ["Ảnh tráng gương bo viền", "Ảnh tráng gương"] as const;
const LEGACY_SMALLER_SIZES = "nằm ở ảnh tráng gương";
const NEXT_SMALLER_SIZES = "nằm ở ảnh ép gỗ tráng gương bo viền";

type Migratable = {
  settings: { showZalo?: boolean; zaloDefaultMigrated?: boolean };
  groups?: { id: string; name?: string; description: string; turnaround: string }[];
  orders?: { items: { name: string }[] }[];
};

/** Đổi tên cũ đúng nguyên văn. Tên chủ đã sửa thì giữ. */
function renameGlossLabel(value: string): string | null {
  for (const legacy of LEGACY_GLOSS_NAMES) {
    if (value === legacy) return GLOSS_NAME;
    for (const separator of [" — ", " - "]) {
      if (value.startsWith(`${legacy}${separator}`)) return GLOSS_NAME + value.slice(legacy.length);
    }
  }
  return null;
}

/**
 * Sổ seed lúc Zalo mặc định bật thì tắt một lần.
 * Khi `zaloDefaultMigrated` đã có, ô Cài đặt của chủ được giữ.
 * Câu tặng trên ảnh thờ cũ được đổi nếu còn nguyên câu đó.
 * Nhóm ảnh tráng gương đổi thành ảnh ép gỗ tráng gương bo viền. Ảnh ép gỗ giữ nguyên.
 */
export function applyStoreMigrations(state: Migratable): boolean {
  let changed = false;
  if (state.settings.zaloDefaultMigrated !== true) {
    state.settings.showZalo = false;
    state.settings.zaloDefaultMigrated = true;
    changed = true;
  }
  for (const group of state.groups ?? []) {
    if (group.description.includes(LEGACY_ANH_THO)) {
      group.description = group.description.replace(LEGACY_ANH_THO, NEXT_ANH_THO);
      changed = true;
    }
    if (group.id === "anh_tho" && group.turnaround === "Có liền") {
      group.turnaround = "Theo đơn";
      changed = true;
    }
    if (group.id === "trang_guong" && group.name) {
      const next = renameGlossLabel(group.name);
      if (next) {
        group.name = next;
        changed = true;
      }
    }
    if (group.id === "ep_go" && group.description.includes(LEGACY_SMALLER_SIZES)) {
      group.description = group.description.replace(LEGACY_SMALLER_SIZES, NEXT_SMALLER_SIZES);
      changed = true;
    }
  }
  for (const order of state.orders ?? []) {
    for (const item of order.items) {
      const next = renameGlossLabel(item.name);
      if (next) {
        item.name = next;
        changed = true;
      }
    }
  }
  return changed;
}
