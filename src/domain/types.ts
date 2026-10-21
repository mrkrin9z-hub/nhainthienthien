export const CHANNELS = ["tai_tiem", "facebook", "tiktok", "shopee"] as const;
export type Channel = (typeof CHANNELS)[number];

/** Kênh bán = “nhánh” vận hành (offline / online / sàn). */
export const CHANNEL_LABEL: Record<Channel, string> = {
  tai_tiem: "Tại tiệm (offline)",
  facebook: "Online / Facebook",
  tiktok: "TikTok",
  shopee: "Shopee",
};

export const ROLES = ["owner", "sale", "production"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Chủ",
  sale: "Sale",
  production: "Sản xuất",
};

export const ORDER_STATUSES = [
  "draft_upload",
  "upload_error",
  "nhan_don",
  "thiet_ke",
  "cho_duyet",
  "in",
  "dong_goi",
  "giao",
  "xong",
  "huy",
] as const;
export type OrderStatus = (typeof ORDER_STATUSES)[number];

export const STATUS_LABEL: Record<OrderStatus, string> = {
  draft_upload: "Đang gửi ảnh",
  upload_error: "Lỗi tải ảnh",
  nhan_don: "Nhận đơn",
  thiet_ke: "Thiết kế",
  cho_duyet: "Chờ khách duyệt",
  in: "In",
  dong_goi: "Đóng gói",
  giao: "Giao",
  xong: "Xong",
  huy: "Hủy",
};

/** Câu sale bấm sao chép khi khách hỏi tình trạng. */
export const STATUS_REPLY: Record<OrderStatus, string> = {
  draft_upload: "Đã nhận đơn, shop đang chuẩn bị hàng, anh/chị chờ chút nhé",
  upload_error: "Ảnh chưa gửi đủ, anh/chị gửi lại giúp shop nhé",
  nhan_don: "Đã nhận đơn, shop đang chuẩn bị hàng, anh/chị chờ chút nhé",
  thiet_ke: "Shop đang thiết kế, anh/chị chờ chút nhé",
  cho_duyet: "Shop gửi mẫu để anh/chị duyệt giúp ạ",
  in: "Đơn đang in, anh/chị chờ chút nhé",
  dong_goi: "Đơn đang đóng gói, anh/chị chờ chút nhé",
  giao: "Đơn đang trên đường giao, anh/chị chú ý điện thoại giúp shop nhé",
  xong: "Đơn đã hoàn tất. Cảm ơn anh/chị đã ủng hộ Nhà In Thiên Thiên.",
  huy: "Đơn đã hủy.",
};

export const PRICE_STATUSES = ["dang_ban", "nhap", "cho_duyet"] as const;
export type PriceStatus = (typeof PRICE_STATUSES)[number];

export const PRICE_STATUS_LABEL: Record<PriceStatus, string> = {
  dang_ban: "Đang bán",
  nhap: "Chưa có giá",
  cho_duyet: "Chờ duyệt",
};

export type Settings = {
  inkPercent: number;
  tiktokFeePercent: number;
  tiktokExtraPercent: number;
  tiktokFixed: number;
  tiktokTaxPercent: number;
  tiktokCommissionPercent: number;
  tiktokAffiliatePercent: number;
  shopeeFeePercent: number;
  shopeeExtraPercent: number;
  shopeeInfra: number;
  shopeePiship: number;
  shopeeTaxPercent: number;
  shopeeCommissionPercent: number;
  shopeeAffiliatePercent: number;
  fbTaxPercent: number;
  fbCommissionPercent: number;
  fbAdsPercent: number;
  fbCodPercent: number;
  fbShipping: number | null;
  walkinCommissionPercent: number;
  marginYellowPercent: number;
  marginRedPercent: number;
  wasteRate: number;
  tapeOrdersPerRoll: number;
  magnetPiecesPerSheet: number;
  ppRollWidthCm: number;
  filmRollWidthCm: number;
  foamRollWidthCm: number;
  foamRollLengthM: number;
  depositMinTotal: number;
  depositPercent: number;
  breakevenMonth: number;
  breakevenDay: number;
  workStart: string;
  workEnd: string;
  /** 0 = Chủ nhật … 6 = Thứ bảy. Trống = làm cả tuần (hợp đồng ghi 8:00–18:00 hằng ngày). */
  weeklyOff: number[];
  lateGraceMinutes: number;
  lateDeductionPerMinute: number | null;
  absenceDeductionPerDay: number | null;
  saleBase: number;
  saleProbationPercent: number;
  productionBase: number;
  kpiTargets: number[];
  commissionTiers: { upto: number | null; percent: number }[];
  /** shop = doanh thu cả tiệm. handled = đơn người đó xử lý. Thiếu thì toàn tiệm. */
  commissionBasis?: "shop" | "handled";
  shopOpenDate: string;
  fileRetentionDays: number;
  videoRetentionDays: number;
  zaloPhone: string;
  /** Chỉ `true` mới hiện số trên web. Thiếu field hoặc false thì ẩn. */
  showZalo?: boolean;
  /** Đã tắt Zalo một lần trên sổ seed cũ. Sau mốc này, ô trong Cài đặt được giữ nguyên. */
  zaloDefaultMigrated?: boolean;
  publicHours: string;
  showAnhThe: boolean;
  showAlbum: boolean;
  groupListed: Record<string, boolean>;
  /** slug → mime khi đã tải ảnh thật lên KV. Thiếu thì web dùng ảnh mẫu. */
  productPhotos?: Record<string, string>;
  marketplaceCutoff: string;
  marketplaceHandover: string;
  /** Số đơn để gắn khách quay lại. Thiếu thì 2. */
  repeatCustomerOrders?: number;
  /** Nhắc khi đơn cuối cách đây ít nhất bấy nhiêu ngày. Thiếu thì 60. */
  remindAfterDays?: number;
  /** Mẫu tin nhắn chép tay. {ten} {so_don} {ngay} {dip} {so_dt}. */
  remindMessage?: string;
  fixedCosts: { key: string; name: string; amount: number; note: string }[];
  rentFromJune2027: number;
  /** Tài khoản nhận chuyển khoản. Thiếu thì đơn không hiện mã QR. */
  bank?: { id: string; account: string; holder: string };
  /** Địa chỉ lấy hàng cho GHN, GHTK, J&T. Không phải khóa. */
  carrierPickup?: {
    name: string;
    phone: string;
    address: string;
    province: string;
    district: string;
    ward: string;
  };
  /** SePay — biến động số dư → ví cửa hàng (cấu hình local). */
  sepay?: SePayConfig;
  /** Cảnh báo trong app (không phải Web Push). */
  notifyPrefs?: NotifyPrefs;
};

export type Staff = {
  id: string;
  email: string;
  name: string;
  role: Role;
  passwordHash: string;
  active: boolean;
  mustChangePassword: boolean;
  probation: boolean;
  hiredAt: string | null;
  /** Chi nhánh / cửa hàng gán cho NV. Thiếu = chưa gán. */
  branchId?: string | null;
  /** Bộ phận (Sale / In ấn / Giao…). Thiếu = chưa gán. */
  departmentId?: string | null;
  /** Bật thì lần đăng nhập sau bắt mã 6 số. Chủ cũng vậy, không ngoại lệ. */
  totpEnabled?: boolean;
  totpSecret?: string | null;
  totpPendingSecret?: string | null;
};

/** Cửa hàng / cơ sở in — filter đơn/ví theo chi nhánh (local). */
export type Branch = {
  id: string;
  name: string;
  address: string;
  phone: string;
  active: boolean;
  sort: number;
};

/** Bộ phận vận hành (Sale / In ấn / Giao nhận…). */
export type Department = {
  id: string;
  name: string;
  note: string;
  active: boolean;
  sort: number;
};

/** Dòng ma trận quyền module (nhóm quyền). `modules` = path `/admin/...`. */
export type RoleModules = {
  role: Role;
  modules: string[];
};

/** Thông báo nội bộ cho nhân viên. */
export type Announcement = {
  id: string;
  title: string;
  body: string;
  at: string;
  by: string | null;
  pinned?: boolean;
};

/** Tài liệu nội bộ (link hoặc ghi chú). */
export type ShopDocument = {
  id: string;
  title: string;
  body: string;
  url: string;
  at: string;
  by: string | null;
};

/** Cấu hình SePay — webhook tiền vào → tự thu đơn (mã CK = mã đơn). */
export type SePayConfig = {
  enabled: boolean;
  /** API Key / Bearer SePay gửi kèm (xác thực webhook) */
  apiKey: string;
  /** Ghi chú / số TK trên SePay */
  accountHint: string;
  /** Path webhook công khai */
  webhookPath: string;
  note: string;
};

/** Gói dịch vụ bán tại xưởng (không phải subscription StudioBase). */
export type ServicePackage = {
  id: string;
  name: string;
  price: number;
  description: string;
  includes: string;
  active: boolean;
  sort: number;
};

/** Nguồn / chiến dịch ads (local — gắn đơn hoặc khách). */
export type Campaign = {
  id: string;
  name: string;
  note: string;
  active: boolean;
  sort: number;
  createdAt: string;
};

export const MESSAGE_TEMPLATE_KINDS = ["remind", "status", "chat", "other"] as const;
export type MessageTemplateKind = (typeof MESSAGE_TEMPLATE_KINDS)[number];

/** Tin mẫu chép tay (OAuth kênh vẫn trên StudioBase). */
export type MessageTemplate = {
  id: string;
  title: string;
  body: string;
  kind: MessageTemplateKind;
  updatedAt: string;
};

/** Tuỳ chọn cảnh báo trong app (Web Push VAPID vẫn Manage). */
export type NotifyPrefs = {
  lateOrders: boolean;
  marketplaceNew: boolean;
  feedbackReprint: boolean;
  cashHandover: boolean;
  browserPrompted?: boolean;
};

export type Group = {
  id: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  turnaround: string;
  sort: number;
  /** Ảnh thẻ / album chỉ hiện khi cài đặt bật. */
  gate: "anh_the" | "album" | null;
};

export type Sku = {
  id: string;
  code: string;
  groupId: string;
  name: string;
  size: string | null;
  widthCm: number | null;
  heightCm: number | null;
  sheets: number;
  piecesPerPack: number | null;
  sort: number;
};

export type ChannelPrice = {
  skuId: string;
  channel: Channel;
  price: number | null;
  status: PriceStatus;
  note: string;
};

export type Material = {
  id: string;
  name: string;
  buyLabel: string;
  /** Đơn vị đang trừ kho. */
  unit: string;
  /** Số đơn vị trong 1 lần mua (cuộn/thùng/tấm). Null nếu chưa biết quy cách. */
  packSize: number | null;
  packPrice: number | null;
  stock: number;
  minStock: number | null;
  /** Ngày chờ hàng. Dưới số ngày tồn này thì báo đặt lại. Thiếu thì 7. */
  leadTimeDays?: number | null;
  supplier: string;
  pendingPrice: number | null;
};

export type BomPhase = "print" | "pack";
export type BomScope = "sheet" | "parcel";

export type BomLine = {
  id: string;
  skuId: string;
  materialId: string;
  phase: BomPhase;
  scope: BomScope;
  qty: number | null;
  formula: string;
};

export type Customer = {
  id: string;
  name: string;
  phone: string;
  phoneNormalized: string;
  address: string;
  note: string;
  createdAt: string;
  tags?: string[];
  /** Ngày lặp lại mỗi năm, ví dụ ngày giỗ. */
  specialDates?: { label: string; month: number; day: number }[];
  /** Địa chỉ đã gặp. Địa chỉ nhập tại tiệm nằm ở `address` và không bị file sàn ghi đè. */
  addresses?: string[];
  /** TikTok Buyer Username hoặc Shopee Người Mua. Chỉ để nhận khách khi số bị che. */
  platformBuyer?: string;
  /** Chiến dịch / nguồn ads gắn khách. */
  campaignId?: string | null;
};

export type OrderFile = {
  id: string;
  name: string;
  mime: string;
  size: number;
  status: "uploading" | "complete" | "error";
  kind: "original" | "design" | "approval" | "packing_video" | "packing_photo";
  storage: "supabase" | "drive" | "local" | "r2" | "kv";
  path: string;
  driveFileId: string | null;
  createdAt: string;
  deletedAt: string | null;
  /** Ảnh gốc khách hoặc sale đánh dấu để in. Thiếu nghĩa là chưa chọn. */
  print?: boolean;
  /** Ghi chú chỉnh sửa / mong muốn của khách trên ảnh này. */
  comment?: string;
};

export type OrderShipping = {
  carrier: string;
  tracking: string;
  shipFee: number | null;
  codAmount: number | null;
  codReceivedAt: string | null;
  /** Trạng thái đọc từ hãng. Không tạo vận đơn. */
  carrierStatus?: string;
};

export type SkuMap = {
  channel: "tiktok" | "shopee";
  externalSku: string;
  skuId: string;
};

export type OrderItem = {
  id: string;
  skuId: string;
  name: string;
  skuCode: string;
  quantity: number;
  unitPrice: number | null;
  lineTotal: number | null;
  /** Giá niêm yết của tiệm lúc nhập đơn sàn. Giá bán trên đơn là tiền sàn. */
  listUnitPrice?: number | null;
};

export type Order = {
  id: string;
  code: string;
  channel: Channel;
  source: "web" | "manual";
  customerId: string;
  status: OrderStatus;
  fulfillment: "pickup" | "delivery";
  address: string;
  customerNote: string;
  internalNote: string;
  dueDate: string | null;
  /** Chiến dịch / nguồn ads gắn đơn. */
  campaignId?: string | null;
  marketplaceCode: string;
  /** Tên người nhận trên sàn. Không ghi đè tên khách đã nhập tại tiệm. */
  recipientName?: string;
  shipping?: OrderShipping;
  items: OrderItem[];
  subtotal: number | null;
  total: number | null;
  depositRequired: number | null;
  depositPaid: number;
  depositMethod: string;
  depositBy: string | null;
  /** Từng lần thu. Đơn cũ chỉ có depositPaid thì ví đọc một khoản tại lúc tạo đơn. */
  payments?: OrderPayment[];
  printDeducted: boolean;
  packDeducted: boolean;
  stockWarning: string;
  accessTokenHash: string;
  accessToken: string;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
  files: OrderFile[];
  history: { at: string; from: OrderStatus | null; to: OrderStatus; by: string | null; note: string }[];
  /** Ba việc xưởng đánh dấu trước khi giao. Ảnh gói là file kind packing_photo. */
  packCheck?: { ep: boolean; bo: boolean; tem: boolean };
  /** Một câu khách trả sau khi giao. */
  feedback?: { at: string; answer: "dung_y" | "sai_mau" | "sai_kho" | "khac"; note: string } | null;
  /** Mỗi lần đổi khổ hoặc số lượng. */
  itemChanges?: {
    at: string;
    by: string | null;
    before: { name: string; quantity: number; unitPrice: number | null }[];
    after: { name: string; quantity: number; unitPrice: number | null }[];
  }[];
};

export type Reprint = {
  id: string;
  orderId: string;
  reportedAt: string;
  reason: string;
  decision: "reprint" | "reject" | null;
  extraCost: number | null;
  materialNote: string;
  overdue: boolean;
  by: string | null;
  uses: { materialId: string; qty: number }[];
};

export type Movement = {
  id: string;
  at: string;
  materialId: string;
  qty: number;
  reason: string;
  orderId: string | null;
  by: string | null;
  note: string;
};

export type StockCount = {
  id: string;
  at: string;
  materialId: string;
  systemQty: number;
  actualQty: number;
  by: string | null;
  note: string;
};

export type Punch = {
  id: string;
  staffId: string;
  inAt: string;
  outAt: string | null;
  lateMinutes: number;
  earlyMinutes: number;
  note: string;
  editedBy: string | null;
};

export type Leave = {
  id: string;
  staffId: string;
  date: string;
  paid: boolean;
  note: string;
};

export type OrderPayment = {
  id: string;
  at: string;
  amount: number;
  method: string;
  by: string | null;
};

export type Expense = {
  id: string;
  month: string;
  name: string;
  amount: number;
  note: string;
  at: string;
  by: string | null;
  category?: string;
  wallet?: string;
};

export type WalletAdjust = {
  id: string;
  at: string;
  wallet: "tien_mat" | "chuyen_khoan";
  amount: number;
  note: string;
  by: string | null;
};

/** Nhân viên nộp tiền mặt đang giữ vào két tiệm. Không tạo thêm dòng thu trên sổ ví cửa hàng. */
export type CashHandover = {
  id: string;
  at: string;
  fromId: string;
  amount: number;
  wallet: "tien_mat";
  note: string;
  by: string | null;
};

export type PayrollLock = { month: string; at: string; by: string };

export type Audit = {
  id: string;
  at: string;
  actorId: string | null;
  action: string;
  entity: string;
  before: unknown;
  after: unknown;
};

export type PhotoAlbum = {
  id: string;
  phone: string;
  createdAt: string;
  updatedAt: string;
  orderId: string | null;
  files: OrderFile[];
};

export type ShopState = {
  version: number;
  settings: Settings;
  staff: Staff[];
  groups: Group[];
  skus: Sku[];
  prices: ChannelPrice[];
  materials: Material[];
  boms: BomLine[];
  customers: Customer[];
  orders: Order[];
  albums?: PhotoAlbum[];
  reprints: Reprint[];
  movements: Movement[];
  counts: StockCount[];
  punches: Punch[];
  leaves: Leave[];
  expenses: Expense[];
  walletAdjusts?: WalletAdjust[];
  handovers?: CashHandover[];
  monthlyFixed: { month: string; key: string; amount: number }[];
  payrollLocks: PayrollLock[];
  audits: Audit[];
  skuMaps?: SkuMap[];
  /** Chi nhánh / cửa hàng (optional — migrate seed nếu thiếu). */
  branches?: Branch[];
  /** Bộ phận (optional). */
  departments?: Department[];
  /** Ma trận module theo role — thiếu = dùng mặc định từ menu. */
  roleModules?: RoleModules[];
  /** Thông báo nội bộ. */
  announcements?: Announcement[];
  /** Kho tài liệu nội bộ. */
  documents?: ShopDocument[];
  /** Chiến dịch / nguồn ads (legacy — không còn menu). */
  campaigns?: Campaign[];
  /** Tin mẫu local (legacy — dùng StudioBase Chat). */
  messageTemplates?: MessageTemplate[];
  /** Gói dịch vụ bán tại xưởng. */
  packages?: ServicePackage[];
  /** Id giao dịch SePay đã xử lý (idempotent). */
  sepaySeen?: string[];
};
