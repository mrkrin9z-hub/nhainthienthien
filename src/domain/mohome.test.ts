import assert from "node:assert/strict";
import test from "node:test";

import { feeLines } from "./calc.ts";
import { commissionForSale } from "./commission.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import { catalogPrices, channelPriceFor, masterByCode } from "./price-import.ts";
import { businessReport } from "./report.ts";
import { DEFAULT_SETTINGS, buildSeed } from "./seed.ts";
import { syncOrderStock } from "./stock.ts";
import { laborSplit, orderCodePrefix, skuSoldOn } from "./mohome.ts";
import type { ChannelPrice, Order, ShopState } from "./types.ts";

test("Mơ Home có giá riêng, không hoa hồng, không đụng giá Nhà In", async () => {
  const master = masterByCode().get("TG-13x18-C1");
  const internal = channelPriceFor({ id: "TG-13x18-C1", code: "TG-13x18-C1" }, "mo_home", master);
  const walk = channelPriceFor({ id: "TG-13x18-C1", code: "TG-13x18-C1" }, "tai_tiem", master);
  assert.equal(internal.price, null);
  assert.equal(internal.status, "nhap");
  assert.equal(walk.price, 35000);

  const seededPrices = catalogPrices([{ id: "TG-13x18-C1", code: "TG-13x18-C1" }]);
  assert.equal(seededPrices.some((row) => row.channel === "mo_home"), false);
  assert.equal(seededPrices.find((row) => row.channel === "tai_tiem")?.price, 35000);

  assert.deepEqual(feeLines("mo_home", 100000, DEFAULT_SETTINGS, false), []);
  assert.equal(feeLines("tai_tiem", 100000, DEFAULT_SETTINGS, false)[0]?.name, "Hoa hồng sale");

  assert.equal(skuSoldOn({}, "mo_home"), false);
  assert.equal(skuSoldOn({}, "tai_tiem"), true);
  assert.equal(skuSoldOn({ soldOn: ["mo_home"] }, "facebook"), false);
  assert.equal(skuSoldOn({ soldOn: ["mo_home", "tai_tiem"] }, "tai_tiem"), true);

  assert.equal(orderCodePrefix("mo_home", "2026-10-23"), "MH261023");
  assert.equal(orderCodePrefix("shopee", "2026-10-23"), "TT261023");
  assert.deepEqual(laborSplit(11_000_000, 50), { moHome: 5_500_000, nhaIn: 5_500_000, percent: 50 });

  const orders = [
    {
      status: "xong",
      channel: "tai_tiem",
      total: 100000,
      completedAt: "2026-10-05T01:00:00.000Z",
      updatedAt: "2026-10-05T01:00:00.000Z",
      history: [],
    },
    {
      status: "xong",
      channel: "mo_home",
      total: 900000,
      completedAt: "2026-10-05T01:00:00.000Z",
      updatedAt: "2026-10-05T01:00:00.000Z",
      history: [],
    },
  ] as unknown as Order[];
  const pay = commissionForSale({ orders, settings: DEFAULT_SETTINGS }, "sale-1", "2026-10");
  assert.equal(pay.revenue, 100000);
  assert.equal(pay.commission, 3000);

  const seeded = await buildSeed();
  const before = seeded.prices
    .filter((row) => row.skuId === "TG-13x18-C1")
    .map((row) => [row.channel, row.price] as const);
  assert.equal(applyStoreMigrations(seeded), false);
  assert.deepEqual(
    seeded.prices.filter((row) => row.skuId === "TG-13x18-C1").map((row) => [row.channel, row.price]),
    before,
  );
  assert.equal(seeded.prices.some((row) => row.channel === "mo_home"), false);
  assert.equal(seeded.settings.moHomeLaborPercent, 50);
  assert.equal(seeded.settings.groupListed.ep_lua, false);
  assert.equal(seeded.settings.groupListed.photobook, false);
  assert.ok(seeded.groups.some((group) => group.id === "khung_go"));
  assert.equal(seeded.groups.some((group) => group.id === "lua" && group.name.includes("6×9")), true);
  const gloss = seeded.skus.find((sku) => sku.code === "TG-13x18-C1");
  assert.ok(gloss?.soldOn?.includes("tai_tiem"));
  assert.equal(gloss?.soldOn?.includes("mo_home"), false);
  assert.equal(seeded.prices.find((row) => row.skuId === "TG-13x18-C4" && row.channel === "tai_tiem")?.price, 100000);
});

test("báo cáo chia lương sản xuất một lần và kho gắn kênh", () => {
  const stamp = "2026-12-05T02:00:00.000Z";
  const done = (channel: "tai_tiem" | "mo_home", total: number): Order =>
    ({
      id: channel,
      status: "xong",
      channel,
      isTest: false,
      createdAt: stamp,
      completedAt: stamp,
      updatedAt: stamp,
      total,
      items: [],
    }) as Order;
  const state = {
    settings: DEFAULT_SETTINGS,
    skus: [],
    orders: [done("tai_tiem", 100000), done("mo_home", 80000)],
    expenses: [{ id: "e", month: "2026-12", name: "Điện", amount: 10000, note: "", at: stamp, by: null }],
    monthlyFixed: [],
  } as unknown as ShopState;
  const all = businessReport(state, "2026-12", "month", "all");
  const nha = businessReport(state, "2026-12", "month", "nha_in");
  const home = businessReport(state, "2026-12", "month", "mo_home");
  const shop = businessReport(state, "2026-12", "month", "facebook");
  assert.equal(all.revenue, 180000);
  assert.equal(all.costBasis, 29_400_000);
  assert.equal(all.fixedCharged, 29_400_000);
  assert.equal(all.fixedSum, 23_900_000);
  assert.equal(all.net, -29_400_000 - 10000);
  assert.equal(nha.revenue, 100000);
  assert.equal(nha.costBasis, 23_900_000);
  assert.equal(nha.net, -23_900_000 - 10000);
  assert.equal(home.revenue, 80000);
  assert.equal(home.costBasis, 5_500_000);
  assert.equal(home.extraSum, 0);
  assert.equal(home.net, -5_500_000);
  assert.equal(shop.revenue, 0);
  assert.equal(shop.costBasis, 0);
  assert.equal(shop.net, 0);
  assert.equal((nha.net ?? 0) + (home.net ?? 0), all.net);

  const october = businessReport(state, "2026-10", "day");
  assert.equal(october.fixedCharged, 0);
  assert.equal(october.fixedSum, 23_900_000);

  const stock = {
    settings: DEFAULT_SETTINGS,
    materials: [{ id: "tui", name: "Túi", stock: 10 }],
    boms: [{ id: "b", skuId: "TG", materialId: "tui", phase: "print", scope: "sheet", qty: 1, formula: "bag" }],
    skus: [{ id: "TG", code: "TG-13x18-C1", sheets: 1, widthCm: 13, heightCm: 18 }],
    movements: [],
  } as unknown as ShopState;
  const order = {
    id: "o1",
    code: "MH261023-001",
    channel: "mo_home",
    items: [{ skuId: "TG", quantity: 2 }],
    printDeducted: false,
    packDeducted: false,
    stockWarning: "",
    status: "nhan_don",
  } as unknown as Order;
  syncOrderStock(stock, order, "in", "sx");
  assert.equal(stock.movements[0]?.channel, "mo_home");
  assert.equal(stock.movements[0]?.qty, -2);
  assert.equal(stock.movements[0]?.note, "MH261023-001");
  assert.equal(stock.materials[0]?.stock, 8);
});

test("migration gắn cờ bán kênh và không ghi giá Mơ Home", () => {
  const price: ChannelPrice = { skuId: "TG-13x18-C1", channel: "tai_tiem", price: 35000, status: "dang_ban", note: "giữ" };
  const state = {
    settings: {
      zaloDefaultMigrated: true,
      groupListed: { trang_guong: true },
      catalogImport20261022: true,
      hrApproved20261022: true,
      deskBom20261023: true,
      checklist20261023: true,
      menuLinks20261022: true,
      taskMenu20261023: true,
      fixedCosts: DEFAULT_SETTINGS.fixedCosts,
      sepay: DEFAULT_SETTINGS.sepay,
      notifyPrefs: DEFAULT_SETTINGS.notifyPrefs,
      shopChannels: DEFAULT_SETTINGS.shopChannels.filter((row) => row.id !== "mo_home"),
    },
    roleModules: [{ role: "owner" as const, modules: ["/admin"] }],
    packages: [],
    sepaySeen: [],
    groups: [],
    skus: [{ id: "TG-13x18-C1", code: "TG-13x18-C1", groupId: "trang_guong" }],
    prices: [price],
    materials: [],
    boms: [],
    orders: [],
    customers: [],
    staff: [],
    movements: [],
  };
  applyStoreMigrations(state);
  assert.equal(state.prices.length, 1);
  assert.equal(state.prices[0]?.price, 35000);
  assert.equal(state.prices[0]?.note, "giữ");
  assert.deepEqual(state.skus[0]?.soldOn, ["tai_tiem", "facebook", "tiktok", "shopee"]);
  assert.equal(state.settings.moHomeLaborPercent, 50);
  assert.equal(state.settings.groupListed.ep_lua, false);
  assert.equal(state.settings.groupListed.khung_nhom, false);
  assert.ok(state.groups.some((group) => group.id === "photobook"));
  assert.ok(state.settings.shopChannels?.some((row) => row.id === "mo_home" && row.enabled));
  assert.equal(applyStoreMigrations(state), false);
});
