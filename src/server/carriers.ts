import {
  ghnOrderBody,
  ghtkFeeQuery,
  ghtkOrderBody,
  jtBizObject,
  jtTraceBiz,
  parseGhnCreate,
  parseGhnDetail,
  parseGhtkCreate,
  parseGhtkFee,
  parseGhtkStatus,
  parseJtCreate,
  parseJtTrace,
  type CarrierHit,
  type CarrierPickup,
  type WaybillDraft,
} from "../domain/carriers.ts";
import { jtBusinessPassword, jtHeaderDigest } from "./carrier-sign.ts";

/** Cổng chính thức. GHN developer.ghn.vn, GHTK services.giaohangtietkiem.vn, J&T open.jtexpress.vn. */
const GHN_API = "https://online-gateway.ghn.vn/shiip/public-api";
const GHTK_API = "https://services.giaohangtietkiem.vn";
const JT_API = "https://ylopenapi.jtexpress.vn/webopenplatformapi/api";

type FetchLike = typeof fetch;

export async function createGhnWaybill(
  auth: { token: string; shopId: string },
  pickup: CarrierPickup,
  draft: WaybillDraft,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const payload = await postJson(
    `${GHN_API}/v2/shipping-order/create`,
    { Token: auth.token, ShopId: auth.shopId },
    ghnOrderBody(pickup, draft),
    fetchImpl,
    "GHN",
  );
  return parseGhnCreate(payload);
}

export async function trackGhn(
  auth: { token: string; shopId: string },
  orderCode: string,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const payload = await send(
    `${GHN_API}/v2/shipping-order/detail?order_code=${encodeURIComponent(orderCode)}`,
    { method: "GET", headers: { Token: auth.token, ShopId: auth.shopId } },
    fetchImpl,
    "GHN",
  );
  return parseGhnDetail(payload);
}

export async function createGhtkWaybill(
  auth: { token: string; partner: string },
  pickup: CarrierPickup,
  draft: WaybillDraft,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const payload = await postJson(
    `${GHTK_API}/services/shipment/order`,
    { Token: auth.token, "X-Client-Source": auth.partner },
    ghtkOrderBody(pickup, draft),
    fetchImpl,
    "GHTK",
  );
  return parseGhtkCreate(payload);
}

export async function trackGhtk(
  auth: { token: string; partner: string },
  label: string,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const payload = await send(
    `${GHTK_API}/services/shipment/v2/${encodeURIComponent(label)}`,
    { method: "GET", headers: { Token: auth.token, "X-Client-Source": auth.partner } },
    fetchImpl,
    "GHTK",
  );
  return parseGhtkStatus(payload);
}

export async function quoteGhtkFee(
  auth: { token: string; partner: string },
  pickup: CarrierPickup,
  draft: WaybillDraft,
  fetchImpl: FetchLike = fetch,
): Promise<number> {
  const payload = await send(
    `${GHTK_API}/services/shipment/fee?${ghtkFeeQuery(pickup, draft).toString()}`,
    { method: "GET", headers: { Token: auth.token, "X-Client-Source": auth.partner } },
    fetchImpl,
    "GHTK",
  );
  return parseGhtkFee(payload);
}

export async function createJtWaybill(
  auth: { apiAccount: string; privateKey: string; customerCode: string; password: string },
  pickup: CarrierPickup,
  draft: WaybillDraft,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const biz = JSON.stringify(jtBizObject(pickup, draft, jtBusinessPassword(auth.password), auth.customerCode));
  const payload = await postJt(auth, biz, `${JT_API}/order/addOrder`, fetchImpl);
  return parseJtCreate(payload);
}

export async function trackJt(
  auth: { apiAccount: string; privateKey: string; customerCode: string; password: string },
  billCode: string,
  fetchImpl: FetchLike = fetch,
): Promise<CarrierHit> {
  const biz = jtTraceBiz(auth.customerCode, jtBusinessPassword(auth.password), billCode);
  const payload = await postJt(auth, biz, `${JT_API}/logistics/trace`, fetchImpl);
  return parseJtTrace(payload);
}

async function postJson(
  url: string,
  headers: Record<string, string>,
  body: Record<string, unknown>,
  fetchImpl: FetchLike,
  name: string,
): Promise<unknown> {
  return send(
    url,
    { method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(body) },
    fetchImpl,
    name,
  );
}

async function postJt(
  auth: { apiAccount: string; privateKey: string },
  biz: string,
  url: string,
  fetchImpl: FetchLike,
): Promise<unknown> {
  return send(
    url,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
        apiAccount: auth.apiAccount,
        digest: jtHeaderDigest(biz, auth.privateKey),
        timestamp: String(Date.now()),
      },
      body: new URLSearchParams({ bizContent: biz }).toString(),
    },
    fetchImpl,
    "J&T",
  );
}

async function send(url: string, init: RequestInit, fetchImpl: FetchLike, name: string): Promise<unknown> {
  let response: Response;
  try {
    response = await fetchImpl(url, { ...init, redirect: "error", signal: AbortSignal.timeout(20_000) });
  } catch {
    throw new Error(`Không gọi được ${name}.`);
  }
  const raw = await response.text();
  if (raw.length > 400_000) throw new Error(`${name} trả dữ liệu quá dài.`);
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error(`${name} không trả dữ liệu đọc được.`);
  }
}
