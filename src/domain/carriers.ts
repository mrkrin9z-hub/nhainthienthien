import { publicApiMessage } from "./marketplace-api.ts";
import { shipsOut } from "./shipping.ts";
import type { Order } from "./types.ts";

export const CARRIER_IDS = ["ghn", "ghtk", "jt"] as const;
export type CarrierId = (typeof CARRIER_IDS)[number];

export const CARRIER_NAME: Record<CarrierId, string> = {
  ghn: "GHN",
  ghtk: "GHTK",
  jt: "J&T Express",
};

export type CarrierPickup = {
  name: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  ward: string;
};

export type WaybillDraft = {
  code: string;
  name: string;
  phone: string;
  address: string;
  province: string;
  district: string;
  ward: string;
  weightGrams: number;
  cod: number;
  value: number;
  content: string;
  note: string;
  items: { name: string; quantity: number }[];
};

export type CarrierHit = {
  tracking: string;
  fee: number | null;
  status: string;
};

const GHN_STATUS: Record<string, string> = {
  ready_to_pick: "Chờ lấy hàng",
  picking: "Đang lấy hàng",
  money_collect_picking: "Đang thu tiền lúc lấy",
  picked: "Đã lấy hàng",
  storing: "Trong kho",
  sorting: "Đang phân loại",
  transporting: "Đang luân chuyển",
  delivering: "Đang giao",
  money_collect_delivering: "Đang thu tiền lúc giao",
  delivered: "Đã giao",
  delivery_fail: "Giao chưa được",
  waiting_to_return: "Chờ hoàn",
  return: "Yêu cầu hoàn",
  return_transporting: "Đang hoàn",
  return_sorting: "Đang phân loại hoàn",
  returning: "Đang hoàn về",
  return_fail: "Hoàn chưa được",
  returned: "Đã hoàn",
  cancel: "Đã hủy vận đơn",
  exception: "Cần xử lý",
  lost: "Thất lạc",
  damage: "Hư hỏng",
  scrap: "Đã hủy hàng",
};

export function carrierIdFromName(name: string): CarrierId | null {
  const clean = name.trim().toLowerCase();
  if (clean === "ghn") return "ghn";
  if (clean === "ghtk") return "ghtk";
  if (clean === "j&t express" || clean === "jt" || clean === "j&t") return "jt";
  return null;
}

export function blankPickup(): CarrierPickup {
  return { name: "", phone: "", address: "", province: "", district: "", ward: "" };
}

export function readPickup(value: unknown): CarrierPickup {
  const row = asRecord(value);
  return {
    name: clip(text(row?.name), 80),
    phone: clip(text(row?.phone), 20),
    address: clip(text(row?.address), 250),
    province: clip(text(row?.province), 80),
    district: clip(text(row?.district), 80),
    ward: clip(text(row?.ward), 80),
  };
}

export function pickupReady(pickup: CarrierPickup): boolean {
  return (
    pickup.name.trim().length >= 2 &&
    pickup.phone.replace(/\D/g, "").length >= 8 &&
    pickup.address.trim().length >= 4 &&
    pickup.province.trim().length >= 2 &&
    pickup.ward.trim().length >= 2
  );
}

/** Đơn sàn đã có vận đơn của sàn. Không tạo thêm. Đơn đã có mã thì chỉ cập nhật trạng thái. */
export function waybillBlock(order: {
  channel: string;
  status: string;
  fulfillment: string;
  tracking?: string | null;
}): string | null {
  if (order.channel === "tiktok" || order.channel === "shopee") {
    return "Đơn sàn lấy vận đơn từ sàn. Ghi mã bằng tay nếu sàn chưa đổ.";
  }
  if ((order.tracking ?? "").trim()) return "Đơn đã có mã vận đơn.";
  if (
    !shipsOut({
      status: order.status as Order["status"],
      fulfillment: order.fulfillment as Order["fulfillment"],
      channel: order.channel as Order["channel"],
    })
  ) {
    return "Đơn này không giao đi.";
  }
  return null;
}

export function cleanHeader(value: string): string | null {
  const clean = value.trim();
  if (!clean || /[\r\n]/.test(clean) || clean.length > 200) return null;
  return clean;
}

export function ghnAuth(token: string, shopId: string): { token: string; shopId: string } | null {
  const clean = cleanHeader(token);
  const id = shopId.trim();
  if (!clean || !/^\d{1,12}$/.test(id)) return null;
  return { token: clean, shopId: id };
}

export function ghtkAuth(token: string, partner: string): { token: string; partner: string } | null {
  const clean = cleanHeader(token);
  const code = cleanHeader(partner);
  if (!clean || !code) return null;
  return { token: clean, partner: code };
}

export function jtAuth(input: {
  apiAccount: string;
  privateKey: string;
  customerCode: string;
  password: string;
}): { apiAccount: string; privateKey: string; customerCode: string; password: string } | null {
  const apiAccount = cleanHeader(input.apiAccount);
  const privateKey = cleanHeader(input.privateKey);
  const customerCode = cleanHeader(input.customerCode);
  const password = cleanHeader(input.password);
  if (!apiAccount || !privateKey || !customerCode || !password) return null;
  return { apiAccount, privateKey, customerCode, password };
}

export function clampWeight(grams: number): number {
  if (!Number.isInteger(grams) || grams < 50 || grams > 20_000) {
    throw new Error("Khối lượng từ 50 đến 20.000 gram.");
  }
  return grams;
}

export function clampCod(amount: number): number {
  if (!Number.isInteger(amount) || amount < 0 || amount > 50_000_000) {
    throw new Error("Tiền thu hộ từ 0 đến 50.000.000.");
  }
  return amount;
}

export function ghnOrderBody(pickup: CarrierPickup, input: WaybillDraft): Record<string, unknown> {
  const body: Record<string, unknown> = {
    payment_type_id: 1,
    required_note: "CHOXEMHANGKHONGTHU",
    client_order_code: input.code.slice(0, 50),
    from_name: pickup.name.slice(0, 1024),
    from_phone: pickup.phone,
    from_address: pickup.address.slice(0, 1024),
    from_ward_name: pickup.ward,
    from_province_name: pickup.province,
    to_name: input.name.slice(0, 1024),
    to_phone: input.phone,
    to_address: input.address.slice(0, 1024),
    to_ward_name: input.ward,
    to_province_name: input.province,
    cod_amount: input.cod,
    insurance_value: Math.min(input.value, 5_000_000),
    order_value: input.value,
    service_type_id: 2,
    content: (input.content || "Ảnh in").slice(0, 2000),
    weight: input.weightGrams,
    length: 25,
    width: 20,
    height: 3,
    items: (input.items.length ? input.items : [{ name: "Ảnh in", quantity: 1 }]).slice(0, 20).map((item) => ({
      name: item.name.slice(0, 512),
      quantity: Math.max(1, item.quantity),
    })),
  };
  if (pickup.district.trim()) {
    body.from_district_name = pickup.district.trim();
    body.is_new_from_address = false;
  } else body.is_new_from_address = true;
  if (input.district.trim()) {
    body.to_district_name = input.district.trim();
    body.is_new_to_address = false;
  } else body.is_new_to_address = true;
  return body;
}

export function ghtkOrderBody(pickup: CarrierPickup, input: WaybillDraft): Record<string, unknown> {
  if (!pickup.district.trim() || !input.district.trim()) {
    throw new Error("GHTK cần quận/huyện của nơi lấy và nơi giao.");
  }
  const kg = Math.max(0.01, Math.round(input.weightGrams) / 1000);
  return {
    products: [{ name: (input.content || "Ảnh in").slice(0, 500), weight: kg, quantity: 1 }],
    order: {
      id: input.code.slice(0, 250),
      pick_name: pickup.name.slice(0, 500),
      pick_address: pickup.address.slice(0, 255),
      pick_province: pickup.province,
      pick_district: pickup.district,
      pick_ward: pickup.ward,
      pick_tel: pickup.phone,
      name: input.name.slice(0, 500),
      address: input.address.slice(0, 500),
      province: input.province,
      district: input.district,
      ward: input.ward,
      hamlet: "Khác",
      tel: input.phone,
      is_freeship: 1,
      pick_money: input.cod,
      value: input.value,
      transport: "road",
      pick_option: "cod",
      note: input.note.trim().slice(0, 120),
    },
  };
}

export function ghtkFeeQuery(pickup: CarrierPickup, input: WaybillDraft): URLSearchParams {
  if (!pickup.district.trim() || !input.district.trim()) {
    throw new Error("GHTK cần quận/huyện của nơi lấy và nơi giao.");
  }
  return new URLSearchParams({
    pick_province: pickup.province,
    pick_district: pickup.district,
    pick_ward: pickup.ward,
    province: input.province,
    district: input.district,
    ward: input.ward,
    address: input.address,
    weight: String(input.weightGrams),
    value: String(input.value),
    transport: "road",
    deliver_option: "none",
  });
}

export function jtBizObject(
  pickup: CarrierPickup,
  input: WaybillDraft,
  passwordHash: string,
  customerCode: string,
): Record<string, unknown> {
  const kg = (input.weightGrams / 1000).toFixed(2);
  const sender = party(pickup);
  const receiver = party({
    name: input.name,
    phone: input.phone,
    address: input.address,
    province: input.province,
    district: input.district,
    ward: input.ward,
  });
  const goods = Math.min(input.value, 30_000_000);
  const first = input.items[0];
  const biz: Record<string, unknown> = {
    customerCode,
    password: passwordHash,
    txlogisticId: input.code.slice(0, 50),
    orderType: 1,
    selfAddress: 1,
    serviceType: 1,
    payType: "PP_PM",
    productType: "EXPRESS",
    goodsType: "bm000010",
    deliveryType: 1,
    sender,
    receiver,
    items: [
      {
        itemName: (first?.name || "Ảnh in").slice(0, 500),
        englishName: (first?.name || "Print").slice(0, 100),
        number: String(Math.max(1, input.items.reduce((sum, item) => sum + item.quantity, 0))),
        itemValue: String(goods),
      },
    ],
    packageInfo: { weight: kg },
    isInsured: 0,
    goodsValue: goods,
  };
  if (input.cod > 0) biz.codMoney = String(input.cod);
  const note = input.note.trim();
  if (note) biz.remark = note.slice(0, 200);
  return biz;
}

export function jtTraceBiz(customerCode: string, passwordHash: string, billCode: string): string {
  return JSON.stringify({
    billCodes: billCode,
    txlogisticId: "",
    customerCode,
    password: passwordHash,
  });
}

export function parseGhnCreate(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  const data = asRecord(row?.data);
  const tracking = text(data?.order_code);
  if (!ok200(row?.code) || !tracking) throw new Error(publicApiMessage("GHN", text(row?.message)));
  return { tracking, fee: money(data?.total_fee), status: "Đã tạo vận đơn GHN" };
}

export function parseGhnDetail(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  const data = asRecord(row?.data);
  const status = text(data?.status);
  if (!ok200(row?.code) || !data) throw new Error(publicApiMessage("GHN", text(row?.message)));
  return {
    tracking: text(data.order_code),
    fee: null,
    status: GHN_STATUS[status] ?? (status || "GHN chưa có trạng thái"),
  };
}

export function parseGhtkCreate(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  if (!row) throw new Error("GHTK không trả dữ liệu đọc được.");
  if (row.success === true) {
    const order = asRecord(row.order);
    const tracking = text(order?.label);
    if (!tracking) throw new Error(publicApiMessage("GHTK", text(row.message)));
    return { tracking, fee: money(order?.fee), status: "Đã tạo vận đơn GHTK" };
  }
  const error = asRecord(row.error);
  if (text(error?.code) === "ORDER_ID_EXIST") {
    const tracking = text(error?.ghtk_label);
    if (!tracking) throw new Error(publicApiMessage("GHTK", text(row.message)));
    return { tracking, fee: null, status: "Đơn đã có trên GHTK" };
  }
  throw new Error(publicApiMessage("GHTK", text(row.message)));
}

export function parseGhtkStatus(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  const order = asRecord(row?.order);
  if (row?.success !== true || !order) throw new Error(publicApiMessage("GHTK", text(row?.message)));
  return {
    tracking: text(order.label_id),
    fee: money(order.ship_money),
    status: text(order.status_text) || "GHTK chưa có trạng thái",
  };
}

export function parseGhtkFee(payload: unknown): number {
  const row = asRecord(payload);
  const fee = asRecord(row?.fee);
  const amount = money(fee?.fee);
  if (row?.success !== true || amount === null) throw new Error(publicApiMessage("GHTK", text(row?.message) || "Không báo được phí."));
  return amount;
}

export function parseJtCreate(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  const data = asRecord(row?.data);
  const tracking = text(data?.billCode);
  if (!okJt(row?.code) || !tracking) throw new Error(publicApiMessage("J&T", text(row?.msg) || text(row?.message)));
  return { tracking, fee: money(data?.inquiryFee), status: "Đã tạo vận đơn J&T" };
}

export function parseJtTrace(payload: unknown): CarrierHit {
  const row = asRecord(payload);
  const list = Array.isArray(row?.data) ? row.data : [];
  const first = asRecord(list[0]);
  if (!okJt(row?.code) || !first) throw new Error(publicApiMessage("J&T", text(row?.msg) || text(row?.message)));
  const details = Array.isArray(first.details) ? first.details.map((item) => asRecord(item)).filter((item) => item != null) : [];
  const latest = details.reduce<(typeof details)[number] | null>((best, item) => {
    if (!best) return item;
    return text(item.scanTime) >= text(best.scanTime) ? item : best;
  }, null);
  const label = text(latest?.scanTypeName);
  return {
    tracking: text(first.billCode),
    fee: null,
    status: label || "J&T chưa có trạng thái",
  };
}

function party(input: CarrierPickup): Record<string, string> {
  const row: Record<string, string> = {
    name: input.name.slice(0, 40),
    mobile: input.phone.slice(0, 30),
    prov: input.province.slice(0, 40),
    area: input.ward.slice(0, 40),
    address: input.address.slice(0, 250),
  };
  if (input.district.trim()) row.city = input.district.trim().slice(0, 40);
  return row;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function clip(value: string, max: number): string {
  return value.trim().slice(0, max);
}

function money(value: unknown): number | null {
  const amount = typeof value === "number" ? value : typeof value === "string" && value.trim() ? Number(value) : NaN;
  if (!Number.isFinite(amount) || amount < 0) return null;
  return Math.round(amount);
}

function ok200(value: unknown): boolean {
  return value === 200 || value === "200";
}

function okJt(value: unknown): boolean {
  return value === 1 || value === "1";
}
