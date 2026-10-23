import { normalizeShopChannels } from "./org-desk.ts";
import type { Channel, Settings, Sku } from "./types.ts";
import { CHANNEL_LABEL } from "./types.ts";

/** Bốn kênh khách ngoài. Mơ Home không nằm trong nhóm này. */
export const NHA_IN_CHANNELS = ["tai_tiem", "facebook", "tiktok", "shopee"] as const satisfies readonly Channel[];

export const MO_HOME_CHANNEL = "mo_home" as const satisfies Channel;

/** Nhóm hàng nội bộ. Khác nhóm `lua` (ảnh lụa 6×9 của Nhà In). */
export const MO_HOME_GROUPS: {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  turnaround: string;
  sort: number;
  gate: null;
}[] = [
  {
    id: "ep_lua",
    name: "Ép gỗ lụa",
    slug: "ep-go-lua",
    category: "Mơ Home",
    description: "Ép gỗ lụa bán nội bộ cho Mơ Home. Chưa có mã cho đến khi có bảng giá.",
    turnaround: "",
    sort: 11,
    gate: null,
  },
  {
    id: "khung_go",
    name: "Khung gỗ",
    slug: "khung-go",
    category: "Mơ Home",
    description: "Khung gỗ bán nội bộ cho Mơ Home. Chưa có mã cho đến khi có bảng giá.",
    turnaround: "",
    sort: 12,
    gate: null,
  },
  {
    id: "khung_nhom",
    name: "Khung nhôm",
    slug: "khung-nhom",
    category: "Mơ Home",
    description: "Khung nhôm bán nội bộ cho Mơ Home. Chưa có mã cho đến khi có bảng giá.",
    turnaround: "",
    sort: 13,
    gate: null,
  },
  {
    id: "photobook",
    name: "Album photobook",
    slug: "album-photobook",
    category: "Mơ Home",
    description: "Album photobook bán nội bộ cho Mơ Home. Chưa có mã cho đến khi có bảng giá.",
    turnaround: "",
    sort: 14,
    gate: null,
  },
];

export const MO_HOME_GROUP_IDS = new Set(MO_HOME_GROUPS.map((group) => group.id));

export const DEFAULT_MO_HOME_LABOR_PERCENT = 50;

export function isMoHomeGroup(groupId: string): boolean {
  return MO_HOME_GROUP_IDS.has(groupId);
}

/** Phần lương sản xuất tính cho Mơ Home. Thiếu thì 50. */
export function moHomeLaborPercent(settings: { moHomeLaborPercent?: number | null }): number {
  const value = settings.moHomeLaborPercent;
  if (value === undefined || value === null || !Number.isFinite(value)) return DEFAULT_MO_HOME_LABOR_PERCENT;
  return Math.min(100, Math.max(0, value));
}

/** productionBase là lương sản xuất cả người. Mơ Home lấy %, Nhà In lấy phần còn lại. */
export function laborSplit(productionBase: number, percent: number): { moHome: number; nhaIn: number; percent: number } {
  const safe = Math.min(100, Math.max(0, percent));
  const moHome = Math.round((productionBase * safe) / 100);
  return { moHome, nhaIn: productionBase - moHome, percent: safe };
}

/**
 * Mã chưa có cờ thì bán ở 4 kênh Nhà In, không bán Mơ Home.
 * Cờ rỗng cũng vậy, để sổ cũ không bị tắt hàng.
 */
export function skuSoldOn(sku: { soldOn?: Channel[] | null }, channel: Channel): boolean {
  const listed = sku.soldOn;
  if (!listed || listed.length === 0) return channel !== MO_HOME_CHANNEL;
  return listed.includes(channel);
}

export function withChannelSold(sku: { soldOn?: Channel[] | null }, channel: Channel, sold: boolean): Channel[] {
  const current = sku.soldOn && sku.soldOn.length > 0 ? [...sku.soldOn] : [...NHA_IN_CHANNELS];
  if (sold) return current.includes(channel) ? current : [...current, channel];
  return current.filter((item) => item !== channel);
}

/** TT + yymmdd cho khách ngoài. MH + yymmdd cho Mơ Home. */
export function orderCodePrefix(channel: Channel, ymd: string): string {
  const stamp = ymd.slice(2).replaceAll("-", "");
  return `${channel === MO_HOME_CHANNEL ? "MH" : "TT"}${stamp}`;
}

export type ReportScope = "all" | "nha_in" | Channel;

export function orderInScope(channel: Channel, scope: ReportScope): boolean {
  if (scope === "all") return true;
  if (scope === "nha_in") return channel !== MO_HOME_CHANNEL;
  return channel === scope;
}

export function reportScopeLabel(scope: ReportScope): string {
  if (scope === "all") return "Tất cả";
  if (scope === "nha_in") return "Nhà In";
  return CHANNEL_LABEL[scope];
}

export function singleChannelScope(scope: ReportScope): boolean {
  return scope !== "all" && scope !== "nha_in" && scope !== MO_HOME_CHANNEL;
}

export type LaborBill = {
  percent: number;
  moHome: number;
  nhaIn: number;
  /** Định phí trừ lương sản xuất đã ghi sổ. */
  otherFixed: number;
  /** Định phí của phạm vi, trước khi xét ngày khai trương. */
  basis: number;
  /** Số trừ vào lãi của phạm vi này. Trước khai trương thì 0. */
  charged: number;
  note: string;
};

export function laborBill(
  settings: Pick<Settings, "productionBase" | "moHomeLaborPercent" | "shopOpenDate">,
  fixed: { key: string; amount: number }[],
  scope: ReportScope,
  costsApply: boolean,
): LaborBill {
  const percent = moHomeLaborPercent(settings);
  const split = laborSplit(settings.productionBase, percent);
  const salaryBooked = fixed.find((row) => row.key === "luong_sx")?.amount ?? 0;
  const otherFixed = fixed.reduce((sum, row) => sum + row.amount, 0) - salaryBooked;
  let basis = 0;
  let note = "";
  if (scope === "all") {
    basis = otherFixed + split.nhaIn + split.moHome;
    note = `Lương sản xuất ${settings.productionBase.toLocaleString("vi-VN")}đ chia ${percent}% cho Mơ Home và ${100 - percent}% cho Nhà In. Dòng lương cũ trong định phí được thay bằng hai phần này, không cộng trùng.`;
  } else if (scope === "nha_in") {
    basis = otherFixed + split.nhaIn;
    note = `Nhà In chịu định phí tiệm và ${100 - percent}% lương sản xuất. Doanh thu Mơ Home không tính vào đây.`;
  } else if (scope === MO_HOME_CHANNEL) {
    basis = split.moHome;
    note = `Mơ Home chỉ chịu ${percent}% lương sản xuất. Không hoa hồng sale, không mặt bằng, không chi phí phát sinh của tiệm.`;
  } else {
    basis = 0;
    note = "Đây là lãi gộp của một kênh Nhà In. Lương sản xuất và định phí dùng chung, xem Nhà In hoặc Tất cả.";
  }
  return {
    percent,
    moHome: split.moHome,
    nhaIn: split.nhaIn,
    otherFixed,
    basis,
    charged: costsApply ? basis : 0,
    note,
  };
}

export function soldOnForNewSku(groupId: string, prices: Partial<Record<Channel, number>>): Channel[] {
  if (isMoHomeGroup(groupId)) {
    const on: Channel[] = [MO_HOME_CHANNEL];
    for (const channel of NHA_IN_CHANNELS) {
      if (prices[channel] !== undefined) on.push(channel);
    }
    return on;
  }
  const on: Channel[] = [...NHA_IN_CHANNELS];
  if (prices.mo_home !== undefined) on.push(MO_HOME_CHANNEL);
  return on;
}

export function ensureMoHome(state: {
  settings: Settings;
  groups?: {
    id: string;
    name?: string;
    slug?: string;
    category?: string;
    description: string;
    turnaround: string;
    sort?: number;
    gate?: "anh_the" | "album" | null;
  }[];
  skus?: (Sku | { id: string; soldOn?: Channel[] | null })[];
}): boolean {
  let changed = false;
  if (state.settings.moHomeLaborPercent === undefined) {
    state.settings.moHomeLaborPercent = DEFAULT_MO_HOME_LABOR_PERCENT;
    changed = true;
  }
  const groups = state.groups ?? (state.groups = []);
  const listed = state.settings.groupListed ?? (state.settings.groupListed = {});
  for (const group of MO_HOME_GROUPS) {
    if (!groups.some((item) => item.id === group.id)) {
      groups.push({ ...group });
      changed = true;
    }
    if (listed[group.id] === undefined) {
      listed[group.id] = false;
      changed = true;
    }
  }
  for (const sku of state.skus ?? []) {
    if (!sku.soldOn || sku.soldOn.length === 0) {
      sku.soldOn = [...NHA_IN_CHANNELS];
      changed = true;
    }
  }
  const nextChannels = normalizeShopChannels(state.settings.shopChannels);
  const current = state.settings.shopChannels ?? [];
  const sameChannels =
    nextChannels.length === current.length &&
    nextChannels.every((row, index) => {
      const hit = current[index];
      return Boolean(hit && hit.id === row.id && hit.enabled === row.enabled && hit.label === row.label);
    });
  if (!sameChannels) {
    state.settings.shopChannels = nextChannels;
    changed = true;
  }
  return changed;
}
