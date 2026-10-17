import { APPROVED_PRICES } from "./approved-prices.ts";
import { DEFAULT_REMIND_MESSAGE } from "./crm.ts";
import { formulaQty } from "./calc.ts";
import { CAR_MAGNET_SIZES, FRIDGE_MAGNET_SIZES, PHOTO_PRINT_SIZES } from "./sizes.ts";
import type {
  BomLine,
  Channel,
  ChannelPrice,
  Group,
  Material,
  Settings,
  ShopState,
  Sku,
} from "./types.ts";
import { CHANNELS } from "./types.ts";

export const INITIAL_PASSWORD = "ThienThien#2026";

export const DEFAULT_SETTINGS: Settings = {
  inkPercent: 4.4,
  tiktokFeePercent: 14.5,
  tiktokExtraPercent: 6,
  tiktokFixed: 3000,
  tiktokTaxPercent: 1.5,
  tiktokCommissionPercent: 3,
  tiktokAffiliatePercent: 10,
  shopeeFeePercent: 16,
  shopeeExtraPercent: 6,
  shopeeInfra: 3000,
  shopeePiship: 2700,
  shopeeTaxPercent: 1.5,
  shopeeCommissionPercent: 3,
  shopeeAffiliatePercent: 10,
  fbTaxPercent: 1.5,
  fbCommissionPercent: 3,
  fbAdsPercent: 10,
  fbCodPercent: 1.2,
  fbShipping: null,
  walkinCommissionPercent: 3,
  marginYellowPercent: 30,
  marginRedPercent: 0,
  wasteRate: 0.1,
  tapeOrdersPerRoll: 20,
  magnetPiecesPerSheet: 96,
  ppRollWidthCm: 61,
  filmRollWidthCm: 62,
  foamRollWidthCm: 140,
  foamRollLengthM: 100,
  depositMinTotal: 300000,
  depositPercent: 50,
  breakevenMonth: 49100000,
  breakevenDay: 1640000,
  workStart: "08:00",
  workEnd: "18:00",
  weeklyOff: [],
  lateGraceMinutes: 0,
  lateDeductionPerMinute: null,
  absenceDeductionPerDay: null,
  saleBase: 8000000,
  saleProbationPercent: 85,
  productionBase: 11000000,
  kpiTargets: [25000000, 40000000, 49100000, 49100000],
  commissionTiers: [
    { upto: 100000000, percent: 3 },
    { upto: 200000000, percent: 5 },
    { upto: null, percent: 7 },
  ],
  commissionBasis: "shop",
  shopOpenDate: "2026-12-01",
  fileRetentionDays: 180,
  videoRetentionDays: 30,
  zaloPhone: "",
  showZalo: false,
  zaloDefaultMigrated: true,
  publicHours: "08:00 – 20:00",
  showAnhThe: false,
  showAlbum: false,
  groupListed: {
    ep_go: true,
    anh_tho: true,
    giay_khen: true,
    nam_cham_xe: true,
    nam_cham_tu: true,
    trang_guong: true,
    tkb: false,
    lua: false,
    anh_the: false,
    album: false,
  },
  marketplaceCutoff: "14:00",
  marketplaceHandover: "18:00",
  repeatCustomerOrders: 2,
  remindAfterDays: 60,
  remindMessage: DEFAULT_REMIND_MESSAGE,
  rentFromJune2027: 4000000,
  fixedCosts: [
    { key: "mat_bang", name: "Mặt bằng", amount: 3500000, note: "T12/2026–T5/2027. Từ T6/2027 dùng mức trong cài đặt." },
    { key: "dien", name: "Điện", amount: 2000000, note: "" },
    { key: "nuoc", name: "Nước", amount: 100000, note: "" },
    { key: "wifi", name: "Wifi / điện thoại", amount: 200000, note: "" },
    { key: "vpp", name: "Văn phòng phẩm", amount: 300000, note: "" },
    { key: "luong_sx", name: "Lương NV sản xuất", amount: 11000000, note: "" },
    { key: "luong_sale", name: "Lương sale", amount: 8000000, note: "Phương án A, lương cứng." },
    { key: "bao_tri", name: "Bảo trì máy", amount: 500000, note: "" },
    { key: "khau_hao", name: "Khấu hao máy", amount: 125000, note: "30 triệu ÷ 240 tháng" },
    { key: "marketing", name: "Marketing", amount: 3000000, note: "" },
    { key: "phan_mem", name: "Phần mềm", amount: 100000, note: "" },
    { key: "khac", name: "Khác", amount: 75000, note: "Cộng các khoản mặc định là 29.400.000đ/tháng." },
    { key: "vat_tu_phu", name: "Vật tư phụ khoán", amount: 500000, note: "" },
  ],
};

function sizeCm(code: string): { code: string; w: number; h: number } {
  const [w, h] = code.split("x");
  return { code, w: Number(w), h: Number(h) };
}

const SIZES = PHOTO_PRINT_SIZES.map(sizeCm);

const WOOD_PRICE: Record<string, number> = {
  "13x18": 1900,
  "15x21": 2500,
  "20x30": 4400,
  "30x45": 9900,
  "40x60": 17700,
  "50x75": 28500,
  "60x90": 39600,
};

function material(
  id: string,
  name: string,
  buyLabel: string,
  unit: string,
  packSize: number | null,
  packPrice: number | null,
): Material {
  return {
    id,
    name,
    buyLabel,
    unit,
    packSize,
    packPrice,
    stock: 0,
    minStock: null,
    supplier: "",
    pendingPrice: null,
  };
}

function groups(): Group[] {
  return [
    {
      id: "ep_go",
      name: "Ảnh ép gỗ tráng gương",
      slug: "anh-ep-go",
      category: "Ảnh gỗ",
      description: "Ảnh ép gỗ tráng gương khổ 40×60, 50×75 và 60×90, bán lẻ và combo. Khổ nhỏ hơn nằm ở ảnh tráng gương.",
      turnaround: "1–2 ngày",
      sort: 1,
      gate: null,
    },
    {
      id: "anh_tho",
      name: "Ảnh thờ ép gỗ",
      slug: "anh-tho",
      category: "Ảnh gỗ",
      description: "Ảnh thờ ép gỗ tráng gương, khổ 20×30 đến 60×90. Hỗ trợ chỉnh sửa ảnh cơ bản.",
      turnaround: "Theo đơn",
      sort: 2,
      gate: null,
    },
    {
      id: "giay_khen",
      name: "Giấy khen ép gỗ",
      slug: "giay-khen",
      category: "Ảnh gỗ",
      description: "Giấy khen ép gỗ tráng gương, khổ A5 (15×21), A4 (20×30) và A3 (30×45).",
      turnaround: "1–2 ngày",
      sort: 3,
      gate: null,
    },
    {
      id: "nam_cham_xe",
      name: "Ảnh nam châm dán xe",
      slug: "nam-cham-xe",
      category: "Nam châm",
      description: "Ảnh ép lụa nam châm dán xe. Size 9×19 và 17×22.",
      turnaround: "1–2 ngày",
      sort: 4,
      gate: null,
    },
    {
      id: "nam_cham_tu",
      name: "Nam châm tủ lạnh 6×9 Bản Đặc Biệt",
      slug: "nam-cham-tu-lanh",
      category: "Nam châm",
      description: "Nam châm tủ lạnh tráng gương 6×9, Bản Đặc Biệt. Tại xưởng có bán lẻ một tấm. Kênh khác chỉ bán theo gói.",
      turnaround: "1–2 ngày",
      sort: 5,
      gate: null,
    },
    {
      id: "trang_guong",
      name: "Ảnh tráng gương bo viền",
      slug: "trang-guong",
      category: "Ảnh trang trí",
      description: "Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.",
      turnaround: "1–2 ngày",
      sort: 6,
      gate: null,
    },
    {
      id: "tkb",
      name: "Thời khóa biểu ép gỗ",
      slug: "thoi-khoa-bieu",
      category: "Ảnh gỗ",
      description: "Thời khóa biểu ép gỗ tráng gương khổ 20×30.",
      turnaround: "1–2 ngày",
      sort: 7,
      gate: null,
    },
    {
      id: "lua",
      name: "Ảnh lụa 6×9",
      slug: "anh-lua-6x9",
      category: "Ảnh lụa",
      description: "Ảnh lụa 6×9, bán theo gói.",
      turnaround: "1–2 ngày",
      sort: 8,
      gate: null,
    },
    {
      id: "anh_the",
      name: "Ảnh thẻ",
      slug: "anh-the",
      category: "Ẩn",
      description: "Chưa mở bán. Bật trong Cài đặt khi tiệm nhận in ảnh thẻ.",
      turnaround: "Trong ngày",
      sort: 9,
      gate: "anh_the",
    },
    {
      id: "album",
      name: "Album",
      slug: "album",
      category: "Ẩn",
      description: "Chưa mở bán. Bật trong Cài đặt khi tiệm nhận làm album.",
      turnaround: "Liên hệ",
      sort: 10,
      gate: "album",
    },
  ];
}

type Spec = {
  groupId: string;
  prefix: string;
  sizes: { code: string; w: number; h: number }[];
  combos: number[];
  /** Gói bán theo số tấm. Mã là prefix-size-số, ví dụ NCT-6x9-10. */
  packs?: number[];
  kind: "wood" | "gloss" | "car" | "fridge" | "silk" | "none";
};

const SPECS: Spec[] = [
  { groupId: "ep_go", prefix: "EG", sizes: SIZES, combos: [1, 2, 3, 4, 5], kind: "wood" },
  {
    groupId: "anh_tho",
    prefix: "AT",
    sizes: PHOTO_PRINT_SIZES.filter((code) => code !== "13x18" && code !== "15x21").map(sizeCm),
    combos: [1, 2, 3, 4, 5],
    kind: "wood",
  },
  { groupId: "giay_khen", prefix: "GK", sizes: SIZES, combos: [1, 2, 3, 4, 5], kind: "wood" },
  {
    groupId: "nam_cham_xe",
    prefix: "NX",
    sizes: CAR_MAGNET_SIZES.map(sizeCm),
    combos: [1],
    kind: "car",
  },
  {
    groupId: "nam_cham_tu",
    prefix: "NCT",
    sizes: FRIDGE_MAGNET_SIZES.map(sizeCm),
    combos: [],
    packs: [1, 5, 10, 20, 50],
    kind: "fridge",
  },
  { groupId: "trang_guong", prefix: "TG", sizes: SIZES, combos: [1, 2, 3, 4, 5], kind: "gloss" },
  { groupId: "tkb", prefix: "TKB", sizes: [{ code: "20x30", w: 20, h: 30 }], combos: [1, 2, 3, 4, 5], kind: "wood" },
  {
    groupId: "lua",
    prefix: "LUA",
    sizes: [{ code: "6x9", w: 6, h: 9 }],
    combos: [],
    packs: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 120, 240],
    kind: "silk",
  },
  { groupId: "anh_the", prefix: "ATHE", sizes: [{ code: "4x6", w: 4, h: 6 }], combos: [1], kind: "none" },
  { groupId: "album", prefix: "ALBUM", sizes: [], combos: [], kind: "none" },
];

function buildCatalog(settings: Settings): { skus: Sku[]; boms: BomLine[] } {
  const skus: Sku[] = [];
  const boms: BomLine[] = [];
  let sort = 0;
  const addBom = (sku: Sku, materialId: string, phase: BomLine["phase"], scope: BomLine["scope"], formula: string) => {
    boms.push({
      id: `${sku.id}:${materialId}:${phase}`,
      skuId: sku.id,
      materialId,
      phase,
      scope,
      formula,
      qty: formulaQty(formula, sku, settings),
    });
  };
  for (const spec of SPECS) {
    if (spec.groupId === "album") {
      const sku: Sku = {
        id: "ALBUM",
        code: "ALBUM",
        groupId: "album",
        name: "Thiết kế theo yêu cầu",
        size: null,
        widthCm: null,
        heightCm: null,
        sheets: 1,
        piecesPerPack: null,
        sort: ++sort,
      };
      skus.push(sku);
      continue;
    }
    const units = spec.packs?.length ? spec.packs : spec.combos;
    for (const size of spec.sizes) {
      for (const count of units) {
        const packed = Boolean(spec.packs?.length);
        const code = packed ? `${spec.prefix}-${size.code}-${count}` : `${spec.prefix}-${size.code}-C${count}`;
        const name = packed
          ? count === 1
            ? `1 tấm ${size.w}×${size.h}`
            : `Gói ${count} tấm ${size.w}×${size.h}`
          : count === 1
            ? `${size.w}×${size.h} cm`
            : `${size.w}×${size.h} cm · ${count} tấm`;
        const sku: Sku = {
          id: code,
          code,
          groupId: spec.groupId,
          name,
          size: size.code,
          widthCm: size.w,
          heightCm: size.h,
          sheets: count,
          piecesPerPack: packed ? count : null,
          sort: ++sort,
        };
        skus.push(sku);
        if (spec.kind === "none") continue;
        if (spec.kind === "wood" || spec.kind === "gloss") {
          addBom(sku, "giay-pp", "print", "sheet", "pp");
          addBom(sku, "mang", "print", "sheet", "film");
          addBom(sku, "vien", "print", "sheet", "edge");
          if (spec.kind === "wood") addBom(sku, `go-${size.code}`, "print", "sheet", "wood");
          if (["13x18", "15x21", "20x30"].includes(size.code)) addBom(sku, "chan", "print", "sheet", "stand");
          if (["30x45", "40x60", "50x75", "60x90"].includes(size.code)) {
            addBom(sku, "moc", "print", "sheet", "hook");
            addBom(sku, "oc", "print", "sheet", "screw");
          }
        }
        if (spec.kind === "car") addBom(sku, "nam-cham", "print", "sheet", "unknown");
        if (spec.kind === "fridge") {
          addBom(sku, "giay-pp", "print", "sheet", "pp-pack");
          addBom(sku, "mang", "print", "sheet", "film-pack");
          addBom(sku, "nam-cham", "print", "sheet", "magnet-6x9");
        }
        if (spec.kind === "silk") addBom(sku, "giay-lua", "print", "sheet", "silk-pack");
        addBom(sku, "tui", "pack", "sheet", "bag");
        addBom(sku, "xop", "pack", "parcel", "foam");
        addBom(sku, "carton", "pack", "parcel", "carton");
        addBom(sku, "bang-keo", "pack", "parcel", "tape");
        addBom(sku, "tem", "pack", "parcel", "label");
      }
    }
  }
  return { skus, boms };
}

function materials(): Material[] {
  const list: Material[] = [
    material("giay-pp", "Giấy PP (in tráng gương)", "cuộn 61cm × 50m", "m", 50, 702000),
    material("giay-lua", "Giấy lụa", "cuộn 61cm × 40m", "m", 40, 732000),
    material("mang", "Màng tráng gương", "cuộn 62cm × 70m", "m", 70, 1215000),
    material("muc", "Mực in", "lọ", "lọ", 1, 1100000),
    material("vien", "Viền bo", "thùng 600m", "m", 600, 870000),
    material("nam-cham", "Nam châm dẻo", "tấm 62cm × 1m", "tấm", 1, 176000),
    material("chan", "Chân nhựa để bàn", "cái", "cái", 1, 1000),
    material("moc", "Móc treo", "cái", "cái", 1, 0),
    material("oc", "Ốc vít", "cái", "cái", 1, 0),
    material("tui", "Túi bọc ảnh", "cái", "cái", 1, null),
    material("xop", "Xốp wrap", "cuộn 140cm × 100m", "m2", 140, 500000),
    material("carton", "Carton bọc", "tấm/cuộn", "m2", null, null),
    material("bang-keo", "Băng keo", "cuộn", "cuộn", 1, 28000),
    material("tem", "Tem / nhãn vận đơn", "cuộn giấy in nhiệt", "tem", null, null),
  ];
  for (const size of SIZES) {
    list.push(
      material(`go-${size.code}`, `Tấm nền gỗ ${size.w}×${size.h}`, "tấm cắt sẵn", "tấm", 1, WOOD_PRICE[size.code] ?? null),
    );
  }
  return list;
}

const APPROVED_PRICE = new Map(APPROVED_PRICES.map((row) => [`${row.code}|${row.channel}`, row.price]));

function prices(skus: Sku[]): ChannelPrice[] {
  const rows: ChannelPrice[] = [];
  for (const sku of skus) {
    for (const channel of CHANNELS) {
      const known = APPROVED_PRICE.get(`${sku.code}|${channel}`) ?? null;
      rows.push({
        skuId: sku.id,
        channel: channel as Channel,
        price: known,
        status: known === null ? "nhap" : "dang_ban",
        note:
          known === null
            ? ""
            : channel === "shopee"
              ? "Shopee chưa có giá riêng — tạm bằng TikTok (BANG-GIA-THEO-KENH-v2)."
              : "Bảng giá chủ duyệt 17/10/2026.",
      });
    }
  }
  return rows;
}

/** Workers từ chối PBKDF2 trên 100000 vòng. Hash mới ghi số vòng vào giữa. */
export const PBKDF2_ITERATIONS = 100000;

async function derivePbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode(salt), iterations, hash: "SHA-256" },
    key,
    256,
  );
  return [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function hashPassword(password: string, salt = crypto.randomUUID()): Promise<string> {
  const hex = await derivePbkdf2(password, salt, PBKDF2_ITERATIONS);
  return `pbkdf2$${PBKDF2_ITERATIONS}$${salt}$${hex}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  let iterations = PBKDF2_ITERATIONS;
  let salt = "";
  let hex = "";
  if (parts.length === 4 && parts[0] === "pbkdf2") {
    iterations = Number(parts[1]);
    salt = parts[2] ?? "";
    hex = parts[3] ?? "";
  } else if (parts.length === 3 && parts[0] === "pbkdf2") {
    iterations = 120000;
    salt = parts[1] ?? "";
    hex = parts[2] ?? "";
  } else {
    return false;
  }
  if (!salt || !hex || !Number.isInteger(iterations) || iterations < 1) return false;
  try {
    const next = await derivePbkdf2(password, salt, iterations);
    return next === hex;
  } catch {
    return false;
  }
}

export async function buildSeed(): Promise<ShopState> {
  const settings = structuredClone(DEFAULT_SETTINGS);
  const { skus, boms } = buildCatalog(settings);
  const passwordHash = await hashPassword(INITIAL_PASSWORD);
  const staffBase = {
    passwordHash,
    active: true,
    mustChangePassword: true,
    probation: false,
    hiredAt: null,
    totpEnabled: false,
    totpSecret: null,
    totpPendingSecret: null,
  };
  return {
    version: 1,
    settings,
    staff: [
      { ...staffBase, id: "staff-owner", email: "chu@nhainthienthien.local", name: "Chủ tiệm", role: "owner" },
      { ...staffBase, id: "staff-sale", email: "sale@nhainthienthien.local", name: "Nhân viên sale", role: "sale" },
      {
        ...staffBase,
        id: "staff-sx",
        email: "sx@nhainthienthien.local",
        name: "Nhân viên sản xuất",
        role: "production",
      },
    ],
    groups: groups(),
    skus,
    prices: prices(skus),
    materials: materials(),
    boms,
    customers: [],
    orders: [],
    reprints: [],
    movements: [],
    counts: [],
    punches: [],
    leaves: [],
    expenses: [],
    monthlyFixed: [],
    payrollLocks: [],
    audits: [],
  };
}

export function recalcBoms(state: ShopState): number {
  let changed = 0;
  for (const bom of state.boms) {
    if (bom.formula === "manual" || bom.formula === "unknown") continue;
    const sku = state.skus.find((s) => s.id === bom.skuId);
    if (!sku) continue;
    const next = formulaQty(bom.formula, sku, state.settings);
    if (next !== bom.qty) {
      bom.qty = next;
      changed += 1;
    }
  }
  return changed;
}
