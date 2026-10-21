import {
  applyShelfOffers,
  offersFromShopeeItem,
  offersFromTiktokProduct,
  shopeeListPage,
  tiktokSearchPage,
  type ShelfOffer,
} from "@/domain/catalog-sync";
import {
  LOOKBACK_SEC,
  PULL_GAP_MS,
  SHOPEE_API,
  TIKTOK_API,
  TIKTOK_AUTH,
  expireAtFromApi,
  linesFromShopeeOrders,
  linesFromTiktokOrders,
  parseShopeeLink,
  parseTiktokLink,
  publicApiMessage,
  shopeeAuthorizeUrl,
  shopeeBase,
  shopeeSign,
  tiktokAuthorizeUrl,
  tiktokSign,
  tokenFresh,
  type ShopeeLink,
  type TiktokLink,
} from "@/domain/marketplace-api";
import type { ParsedLine } from "@/domain/marketplace";
import { readIntegrationSecret, saveIntegrationSecret } from "@/server/secrets";
import { importMarketplaceOrders, importShelf, setIntegration, type Actor } from "@/server/service";

type Dict = Record<string, unknown>;
type Channel = "tiktok" | "shopee";

const MISSING: Record<Channel, string> = {
  tiktok: "Chưa kết nối TikTok Shop. Chủ vào Kết nối, nhập App key và bấm Kết nối TikTok Shop.",
  shopee: "Chưa kết nối Shopee. Chủ vào Kết nối, nhập Partner ID và bấm Kết nối Shopee.",
};

function asRecord(value: unknown): Dict | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Dict;
}

function text(value: unknown): string {
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return "";
}

function num(value: unknown): number {
  return typeof value === "number" && Number.isFinite(value) ? value : Number(text(value));
}

async function readJson(res: Response): Promise<unknown> {
  const raw = await res.text();
  if (raw.length > 5_000_000) throw new Error("Sàn trả về quá lớn.");
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    throw new Error("Sàn trả về dữ liệu không đọc được.");
  }
}

async function requestJson(url: string, init: RequestInit, fail: string): Promise<unknown> {
  try {
    const res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000) });
    return await readJson(res);
  } catch (error) {
    if (error instanceof Error && /Sàn trả về/.test(error.message)) throw error;
    throw new Error(fail);
  }
}

function tiktokData(payload: unknown): Dict {
  const row = asRecord(payload);
  if (!row) throw new Error("TikTok Shop không trả lời.");
  if (row.code !== 0 && row.code !== "0") throw new Error(publicApiMessage("TikTok Shop", text(row.message)));
  return asRecord(row.data) ?? {};
}

function shopeeOk(payload: unknown): Dict {
  const row = asRecord(payload);
  if (!row) throw new Error("Shopee không trả lời.");
  if (text(row.error)) throw new Error(publicApiMessage("Shopee", text(row.message) || text(row.error)));
  return row;
}

async function tiktokCall(input: {
  appKey: string;
  appSecret: string;
  accessToken: string;
  path: string;
  query: Record<string, string>;
  body?: string;
}): Promise<Dict> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const query = { ...input.query, app_key: input.appKey, timestamp };
  const body = input.body ?? "";
  const sign = await tiktokSign(input.appSecret, input.path, query, body);
  const params = new URLSearchParams({ ...query, sign });
  const payload = await requestJson(
    `${TIKTOK_API}${input.path}?${params.toString()}`,
    {
      method: body ? "POST" : "GET",
      headers: { "content-type": "application/json", "x-tts-access-token": input.accessToken },
      body: body || undefined,
    },
    "Không gọi được TikTok Shop.",
  );
  return tiktokData(payload);
}

async function shopeeCall(input: {
  partnerId: string;
  partnerKey: string;
  path: string;
  accessToken?: string;
  shopId?: string;
  query?: Record<string, string>;
  body?: string;
}): Promise<Dict> {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const sign = await shopeeSign(
    input.partnerKey,
    shopeeBase({ partnerId: input.partnerId, path: input.path, timestamp, accessToken: input.accessToken, shopId: input.shopId }),
  );
  const params = new URLSearchParams({
    partner_id: input.partnerId,
    timestamp,
    sign,
    ...(input.accessToken ? { access_token: input.accessToken } : {}),
    ...(input.shopId ? { shop_id: input.shopId } : {}),
    ...(input.query ?? {}),
  });
  const payload = await requestJson(
    `${SHOPEE_API}${input.path}?${params.toString()}`,
    {
      method: input.body ? "POST" : "GET",
      headers: { "content-type": "application/json" },
      body: input.body,
    },
    "Không gọi được Shopee.",
  );
  return shopeeOk(payload);
}

function pickShop(raw: unknown): { cipher: string; id: string } | null {
  if (!Array.isArray(raw)) return null;
  const shops = raw.map((item) => asRecord(item)).filter((item): item is Dict => Boolean(item));
  const chosen = shops.find((shop) => text(shop.region).toUpperCase() === "VN") ?? shops[0];
  const cipher = text(chosen?.cipher);
  if (!cipher) return null;
  return { cipher, id: text(chosen?.id) };
}

async function refreshTiktok(appKey: string, appSecret: string, link: TiktokLink): Promise<TiktokLink> {
  const params = new URLSearchParams({
    app_key: appKey,
    app_secret: appSecret,
    refresh_token: link.refreshToken,
    grant_type: "refresh_token",
  });
  const data = tiktokData(await requestJson(`${TIKTOK_AUTH}/api/v2/token/refresh?${params.toString()}`, { method: "GET" }, "Không gọi được TikTok Shop."));
  const accessToken = text(data.access_token);
  const refreshToken = text(data.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("TikTok Shop chưa cấp token mới. Hãy kết nối lại.");
  const next: TiktokLink = {
    ...link,
    accessToken,
    refreshToken,
    expireAt: expireAtFromApi(num(data.access_token_expire_in), Date.now()),
  };
  await saveIntegrationSecret("tiktok_shop", JSON.stringify(next));
  return next;
}

async function refreshShopee(partnerId: string, partnerKey: string, link: ShopeeLink): Promise<ShopeeLink> {
  const row = await shopeeCall({
    partnerId,
    partnerKey,
    path: "/api/v2/auth/access_token/get",
    body: JSON.stringify({ refresh_token: link.refreshToken, partner_id: Number(partnerId), shop_id: Number(link.shopId) }),
  });
  const accessToken = text(row.access_token);
  const refreshToken = text(row.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("Shopee chưa cấp token mới. Hãy kết nối lại.");
  const next: ShopeeLink = {
    ...link,
    accessToken,
    refreshToken,
    expireAt: expireAtFromApi(num(row.expire_in), Date.now()),
  };
  await saveIntegrationSecret("shopee_shop", JSON.stringify(next));
  return next;
}

async function liveTiktok(touchOrders = true): Promise<{ appKey: string; appSecret: string; link: TiktokLink }> {
  const appKey = (await readIntegrationSecret("tiktok_app_key")).trim();
  const appSecret = (await readIntegrationSecret("tiktok_app_secret")).trim();
  const link = parseTiktokLink(await readIntegrationSecret("tiktok_shop"));
  if (!appKey || !appSecret || !link) throw new Error(MISSING.tiktok);
  if (!touchOrders) {
    const fresh = tokenFresh(link.expireAt, Date.now()) ? link : await refreshTiktok(appKey, appSecret, link);
    return { appKey, appSecret, link: fresh };
  }
  const stamped = { ...link, pulledAt: Date.now() };
  await saveIntegrationSecret("tiktok_shop", JSON.stringify(stamped));
  const fresh = tokenFresh(stamped.expireAt, Date.now()) ? stamped : await refreshTiktok(appKey, appSecret, stamped);
  return { appKey, appSecret, link: fresh };
}

async function liveShopee(touchOrders = true): Promise<{ partnerId: string; partnerKey: string; link: ShopeeLink }> {
  const partnerId = (await readIntegrationSecret("shopee_partner_id")).trim();
  const partnerKey = (await readIntegrationSecret("shopee_partner_key")).trim();
  const link = parseShopeeLink(await readIntegrationSecret("shopee_shop"));
  if (!partnerId || !partnerKey || !link) throw new Error(MISSING.shopee);
  if (!touchOrders) {
    const fresh = tokenFresh(link.expireAt, Date.now()) ? link : await refreshShopee(partnerId, partnerKey, link);
    return { partnerId, partnerKey, link: fresh };
  }
  const stamped = { ...link, pulledAt: Date.now() };
  await saveIntegrationSecret("shopee_shop", JSON.stringify(stamped));
  const fresh = tokenFresh(stamped.expireAt, Date.now()) ? stamped : await refreshShopee(partnerId, partnerKey, stamped);
  return { partnerId, partnerKey, link: fresh };
}

async function fetchTiktokLines(): Promise<ParsedLine[]> {
  const { appKey, appSecret, link } = await liveTiktok();
  const now = Math.floor(Date.now() / 1000);
  const orders: unknown[] = [];
  let page = "";
  for (let i = 0; i < 8; i++) {
    const query: Record<string, string> = { shop_cipher: link.shopCipher, page_size: "50", sort_field: "create_time", sort_order: "DESC" };
    if (page) query.page_token = page;
    const body = JSON.stringify({ create_time_ge: now - LOOKBACK_SEC, create_time_lt: now + 60 });
    const data = await tiktokCall({ appKey, appSecret, accessToken: link.accessToken, path: "/order/202309/orders/search", query, body });
    if (Array.isArray(data.orders)) orders.push(...data.orders);
    page = text(data.next_page_token);
    if (!page) break;
  }
  return linesFromTiktokOrders(orders);
}

async function fetchShopeeLines(): Promise<ParsedLine[]> {
  const { partnerId, partnerKey, link } = await liveShopee();
  const now = Math.floor(Date.now() / 1000);
  const sns: string[] = [];
  let cursor = "";
  for (let i = 0; i < 8; i++) {
    const query: Record<string, string> = {
      time_range_field: "create_time",
      time_from: String(now - LOOKBACK_SEC),
      time_to: String(now),
      page_size: "50",
      response_optional_fields: "order_status",
    };
    if (cursor) query.cursor = cursor;
    const row = await shopeeCall({
      partnerId,
      partnerKey,
      path: "/api/v2/order/get_order_list",
      accessToken: link.accessToken,
      shopId: link.shopId,
      query,
    });
    const response = asRecord(row.response) ?? {};
    const list = Array.isArray(response.order_list) ? response.order_list : [];
    for (const item of list) {
      const sn = text(asRecord(item)?.order_sn);
      if (sn) sns.push(sn);
    }
    if (response.more !== true) break;
    cursor = text(response.next_cursor);
    if (!cursor) break;
  }
  const orders: unknown[] = [];
  const fields = "buyer_username,recipient_address,item_list,estimated_shipping_fee,actual_shipping_fee,total_amount,payment_method,shipping_carrier,package_list";
  for (let i = 0; i < sns.length; i += 50) {
    const row = await shopeeCall({
      partnerId,
      partnerKey,
      path: "/api/v2/order/get_order_detail",
      accessToken: link.accessToken,
      shopId: link.shopId,
      query: { order_sn_list: sns.slice(i, i + 50).join(","), response_optional_fields: fields },
    });
    const response = asRecord(row.response);
    if (Array.isArray(response?.order_list)) orders.push(...response.order_list);
  }
  return linesFromShopeeOrders(orders);
}

const PAGE = 10;

async function fetchTiktokOffers(): Promise<{ offers: ShelfOffer[]; next: string }> {
  const { appKey, appSecret, link } = await liveTiktok(false);
  const query: Record<string, string> = { shop_cipher: link.shopCipher, page_size: String(PAGE) };
  if (link.catalogToken) query.page_token = link.catalogToken;
  const data = await tiktokCall({
    appKey,
    appSecret,
    accessToken: link.accessToken,
    path: "/product/202309/products/search",
    query,
    body: JSON.stringify({ status: "ACTIVATE" }),
  });
  const page = tiktokSearchPage(data);
  const offers: ShelfOffer[] = [];
  for (const id of page.ids) {
    const detail = await tiktokCall({
      appKey,
      appSecret,
      accessToken: link.accessToken,
      path: `/product/202309/products/${id}`,
      query: { shop_cipher: link.shopCipher },
    });
    offers.push(...offersFromTiktokProduct(detail));
  }
  const saved: TiktokLink = { ...link, catalogAt: page.next ? link.catalogAt : Date.now(), catalogToken: page.next };
  await saveIntegrationSecret("tiktok_shop", JSON.stringify(saved));
  return { offers, next: page.next };
}

async function fetchShopeeOffers(): Promise<{ offers: ShelfOffer[]; next: string }> {
  const { partnerId, partnerKey, link } = await liveShopee(false);
  const offset = /^\d{1,8}$/.test(link.catalogToken) ? link.catalogToken : "0";
  const listed = await shopeeCall({
    partnerId,
    partnerKey,
    path: "/api/v2/product/get_item_list",
    accessToken: link.accessToken,
    shopId: link.shopId,
    query: { offset, page_size: String(PAGE), item_status: "NORMAL" },
  });
  const page = shopeeListPage(asRecord(listed.response));
  const offers: ShelfOffer[] = [];
  if (page.ids.length) {
    const info = await shopeeCall({
      partnerId,
      partnerKey,
      path: "/api/v2/product/get_item_base_info",
      accessToken: link.accessToken,
      shopId: link.shopId,
      query: { item_id_list: page.ids.join(",") },
    });
    const items = Array.isArray(asRecord(info.response)?.item_list) ? (asRecord(info.response)?.item_list as unknown[]) : [];
    for (const raw of items) {
      const item = asRecord(raw);
      if (!item) continue;
      if (item.has_model === true) {
        const itemId = text(item.item_id);
        if (!/^\d{1,20}$/.test(itemId)) continue;
        const models = await shopeeCall({
          partnerId,
          partnerKey,
          path: "/api/v2/product/get_model_list",
          accessToken: link.accessToken,
          shopId: link.shopId,
          query: { item_id: itemId },
        });
        offers.push(...offersFromShopeeItem(item, asRecord(models.response)));
      } else {
        offers.push(...offersFromShopeeItem(item, null));
      }
    }
  }
  const next = page.nextOffset === null ? "" : String(page.nextOffset);
  const saved: ShopeeLink = { ...link, catalogAt: next ? link.catalogAt : Date.now(), catalogToken: next };
  await saveIntegrationSecret("shopee_shop", JSON.stringify(saved));
  return { offers, next };
}

export async function pullCatalogNow(actor: Actor, channel: Channel) {
  const batch = channel === "tiktok" ? await fetchTiktokOffers() : await fetchShopeeOffers();
  const applied = await importShelf(actor, batch.offers);
  return { ...applied, more: Boolean(batch.next) };
}

export async function pullMarketplaceNow(actor: Actor, channel: Channel) {
  const lines = channel === "tiktok" ? await fetchTiktokLines() : await fetchShopeeLines();
  return importMarketplaceOrders(actor, channel, lines);
}

function catalogDue(link: { catalogAt: number; catalogToken: string }, now: number): boolean {
  if (link.catalogToken) return true;
  return now - link.catalogAt >= PULL_GAP_MS;
}

export async function pullDueMarketplace(actor: Actor) {
  if (actor.role !== "owner" && actor.role !== "sale") return;
  const now = Date.now();
  const tiktok = parseTiktokLink(await readIntegrationSecret("tiktok_shop"));
  if (tiktok && now - tiktok.pulledAt >= PULL_GAP_MS) {
    try {
      await pullMarketplaceNow(actor, "tiktok");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "TikTok Shop");
    }
  }
  const shopee = parseShopeeLink(await readIntegrationSecret("shopee_shop"));
  if (shopee && now - shopee.pulledAt >= PULL_GAP_MS) {
    try {
      await pullMarketplaceNow(actor, "shopee");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Shopee");
    }
  }
  if (actor.role !== "owner") return;
  const tiktokNow = parseTiktokLink(await readIntegrationSecret("tiktok_shop"));
  if (tiktokNow && catalogDue(tiktokNow, now)) {
    try {
      await pullCatalogNow(actor, "tiktok");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "TikTok Shop");
    }
  }
  const shopeeNow = parseShopeeLink(await readIntegrationSecret("shopee_shop"));
  if (shopeeNow && catalogDue(shopeeNow, now)) {
    try {
      await pullCatalogNow(actor, "shopee");
    } catch (error) {
      console.error(error instanceof Error ? error.message : "Shopee");
    }
  }
}

export async function tiktokStartUrl(state: string): Promise<string> {
  const serviceId = (await readIntegrationSecret("tiktok_service_id")).trim();
  const appKey = (await readIntegrationSecret("tiktok_app_key")).trim();
  const appSecret = (await readIntegrationSecret("tiktok_app_secret")).trim();
  if (!serviceId || !appKey || !appSecret) throw new Error("thieu");
  return tiktokAuthorizeUrl(serviceId, state);
}

export async function shopeeStartUrl(redirect: string): Promise<string> {
  const partnerId = (await readIntegrationSecret("shopee_partner_id")).trim();
  const partnerKey = (await readIntegrationSecret("shopee_partner_key")).trim();
  if (!/^\d{1,20}$/.test(partnerId) || !partnerKey) throw new Error("thieu");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const path = "/api/v2/shop/auth_partner";
  const sign = await shopeeSign(partnerKey, shopeeBase({ partnerId, path, timestamp }));
  return shopeeAuthorizeUrl({ partnerId, timestamp, sign, redirect });
}

export async function connectTiktok(actor: Actor, code: string) {
  const appKey = (await readIntegrationSecret("tiktok_app_key")).trim();
  const appSecret = (await readIntegrationSecret("tiktok_app_secret")).trim();
  if (!appKey || !appSecret || !code.trim()) throw new Error("thieu");
  const params = new URLSearchParams({ app_key: appKey, app_secret: appSecret, auth_code: code.trim(), grant_type: "authorized_code" });
  const data = tiktokData(await requestJson(`${TIKTOK_AUTH}/api/v2/token/get?${params.toString()}`, { method: "GET" }, "Không gọi được TikTok Shop."));
  const accessToken = text(data.access_token);
  const refreshToken = text(data.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("TikTok Shop chưa cấp token.");
  const shops = await tiktokCall({ appKey, appSecret, accessToken, path: "/authorization/202309/shops", query: {} });
  const shop = pickShop(shops.shops);
  if (!shop) throw new Error("Không thấy shop TikTok đã ủy quyền.");
  const link: TiktokLink = {
    accessToken,
    refreshToken,
    expireAt: expireAtFromApi(num(data.access_token_expire_in), Date.now()),
    shopCipher: shop.cipher,
    shopId: shop.id,
    pulledAt: 0,
    catalogAt: 0,
    catalogToken: "",
  };
  await setIntegration(actor, "tiktok_shop", JSON.stringify(link));
}

export async function connectShopee(actor: Actor, code: string, shopId: string) {
  if (!/^\d{1,20}$/.test(shopId) || !code.trim()) throw new Error("Shopee không trả shop.");
  const partnerId = (await readIntegrationSecret("shopee_partner_id")).trim();
  const partnerKey = (await readIntegrationSecret("shopee_partner_key")).trim();
  if (!/^\d{1,20}$/.test(partnerId) || !partnerKey) throw new Error("thieu");
  const row = await shopeeCall({
    partnerId,
    partnerKey,
    path: "/api/v2/auth/token/get",
    body: JSON.stringify({ code: code.trim(), shop_id: Number(shopId), partner_id: Number(partnerId) }),
  });
  const accessToken = text(row.access_token);
  const refreshToken = text(row.refresh_token);
  if (!accessToken || !refreshToken) throw new Error("Shopee chưa cấp token.");
  const link: ShopeeLink = {
    accessToken,
    refreshToken,
    expireAt: expireAtFromApi(num(row.expire_in), Date.now()),
    shopId,
    pulledAt: 0,
    catalogAt: 0,
    catalogToken: "",
  };
  await setIntegration(actor, "shopee_shop", JSON.stringify(link));
}
