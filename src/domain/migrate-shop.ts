const LEGACY_ANH_THO = "Miễn phí khôi phục, thay áo, đổi nền. Không giới hạn số lần sửa.";
const NEXT_ANH_THO = "Hỗ trợ chỉnh sửa ảnh cơ bản.";

type Migratable = {
  settings: { showZalo?: boolean; zaloDefaultMigrated?: boolean };
  groups?: { id: string; description: string; turnaround: string }[];
};

/**
 * Sổ seed lúc Zalo mặc định bật thì tắt một lần.
 * Khi `zaloDefaultMigrated` đã có, ô Cài đặt của chủ được giữ.
 * Câu tặng trên ảnh thờ cũ được đổi nếu còn nguyên câu đó.
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
  }
  return changed;
}
