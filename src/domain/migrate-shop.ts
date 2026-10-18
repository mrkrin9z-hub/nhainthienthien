const LEGACY_ANH_THO = "Miễn phí khôi phục, thay áo, đổi nền. Không giới hạn số lần sửa.";
const NEXT_ANH_THO = "Hỗ trợ chỉnh sửa ảnh cơ bản.";
const GLOSS_NAME = "Ảnh ép gỗ tráng gương bo viền";
const WOOD_NAME = "Ảnh ép gỗ tráng gương";
const LEGACY_GLOSS_NAMES = ["Ảnh tráng gương bo viền", "Ảnh tráng gương"] as const;
const LEGACY_SMALLER_SIZES = "nằm ở ảnh tráng gương";
const NEXT_SMALLER_SIZES = "nằm ở ảnh ép gỗ tráng gương bo viền";
const OLD_GLOSS_DESCRIPTION = "Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.";
const NEXT_GLOSS_DESCRIPTION =
  "Khổ 13×18 đến 60×90. Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.";
const PROMISED_TURNAROUND = "1–2 ngày";
const MERGED_GROUP = "trang_guong";
const LEGACY_GROUP = "ep_go";

type ShopGroup = {
  id: string;
  name?: string;
  description: string;
  turnaround: string;
  category?: string;
  sort?: number;
};

type Migratable = {
  settings: {
    showZalo?: boolean;
    zaloDefaultMigrated?: boolean;
    groupListed?: Record<string, boolean>;
  };
  groups?: ShopGroup[];
  skus?: { id: string; code: string; groupId: string }[];
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
  if (value === GLOSS_NAME || value.startsWith(`${GLOSS_NAME} — `) || value.startsWith(`${GLOSS_NAME} - `)) return null;
  if (value === WOOD_NAME) return GLOSS_NAME;
  for (const separator of [" — ", " - "]) {
    if (value.startsWith(`${WOOD_NAME}${separator}`)) return GLOSS_NAME + value.slice(WOOD_NAME.length);
  }
  return null;
}

/**
 * Sổ seed lúc Zalo mặc định bật thì tắt một lần.
 * Khi `zaloDefaultMigrated` đã có, ô Cài đặt của chủ được giữ.
 * Câu tặng trên ảnh thờ cũ được đổi nếu còn nguyên câu đó.
 * Ảnh ép gỗ và ảnh ép gỗ tráng gương bo viền là một sản phẩm. Mã EG chuyển sang nhóm đó.
 * Câu hẹn 1–2 ngày trên thẻ được bỏ.
 */
export function applyStoreMigrations(state: Migratable): boolean {
  let changed = false;
  if (state.settings.zaloDefaultMigrated !== true) {
    state.settings.showZalo = false;
    state.settings.zaloDefaultMigrated = true;
    changed = true;
  }
  const groups = state.groups ?? [];
  for (const group of groups) {
    if (group.description.includes(LEGACY_ANH_THO)) {
      group.description = group.description.replace(LEGACY_ANH_THO, NEXT_ANH_THO);
      changed = true;
    }
    if (group.id === "anh_tho" && group.turnaround === "Có liền") {
      group.turnaround = "Theo đơn";
      changed = true;
    }
    if (group.id === MERGED_GROUP && group.name) {
      const next = renameGlossLabel(group.name);
      if (next) {
        group.name = next;
        changed = true;
      }
    }
    if (group.id === LEGACY_GROUP && group.description.includes(LEGACY_SMALLER_SIZES)) {
      group.description = group.description.replace(LEGACY_SMALLER_SIZES, NEXT_SMALLER_SIZES);
      changed = true;
    }
    if (group.turnaround === PROMISED_TURNAROUND) {
      group.turnaround = "";
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
  if (groups.some((group) => group.id === MERGED_GROUP)) {
    for (const sku of state.skus ?? []) {
      if ((sku.groupId === LEGACY_GROUP || sku.code.startsWith("EG-")) && sku.groupId !== MERGED_GROUP) {
        sku.groupId = MERGED_GROUP;
        changed = true;
      }
    }
    const gloss = groups.find((group) => group.id === MERGED_GROUP);
    if (gloss && gloss.description === OLD_GLOSS_DESCRIPTION) {
      gloss.description = NEXT_GLOSS_DESCRIPTION;
      changed = true;
    }
    if (gloss && gloss.category === "Ảnh trang trí") {
      gloss.category = "Ảnh gỗ";
      changed = true;
    }
    if (gloss && gloss.sort === 6) {
      gloss.sort = 1;
      changed = true;
    }
    const legacyAt = groups.findIndex((group) => group.id === LEGACY_GROUP);
    if (legacyAt >= 0) {
      groups.splice(legacyAt, 1);
      changed = true;
    }
    const listed = state.settings.groupListed ?? (state.settings.groupListed = {});
    if (listed.ep_go !== false && listed.trang_guong === false) {
      listed.trang_guong = true;
      changed = true;
    }
    if (listed.ep_go !== false) {
      listed.ep_go = false;
      changed = true;
    }
  }
  return changed;
}
