import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  comboPriceError,
  comboWarnings,
  collectedRevenue,
  commissionOf,
  depositFor,
  vnMonth,
  vnYmd,
  formulaQty,
  quoteSku,
  rollMeters,
  round4,
  stockNeeds,
  walkInPublicOffers,
} from "./calc.ts";
import { commissionBasisOf, commissionForSale } from "./commission.ts";
import { contentDisposition, imageBytesMatch, imageMimeAllowed, servedMime } from "./images.ts";
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_TTL_SECONDS, LOGIN_IP_FAIL_LIMIT, LOGIN_LOCK_MS, loginFailIpKey, loginFailKey, loginLocked } from "./login-limit.ts";
import { vnBackupDay } from "./guard.ts";
import { publicContact } from "./public-contact.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import { buildSeed, DEFAULT_SETTINGS, hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "./seed.ts";
import type { BomLine, Material, Order, Settings, Sku } from "./types.ts";

test("hoa hồng 49.100.000đ là 1.473.000đ", () => {
  const amount = commissionOf(49100000, DEFAULT_SETTINGS.commissionTiers);
  assert.equal(amount, 1473000);
});

test("hoa hồng bậc tháng: 0, 100tr, 150tr, 200tr, 250tr", () => {
  const tiers = DEFAULT_SETTINGS.commissionTiers;
  assert.equal(commissionOf(0, tiers), 0);
  assert.equal(commissionOf(100_000_000, tiers), 3_000_000);
  assert.equal(commissionOf(150_000_000, tiers), 5_500_000);
  assert.equal(commissionOf(200_000_000, tiers), 8_000_000);
  assert.equal(commissionOf(250_000_000, tiers), 11_500_000);
});

test("hoa hồng một lần trên cả tháng, toàn tiệm hoặc theo đơn", () => {
  const orders = [60_000_000, 60_000_000].map((total, index) => ({
    id: `o${index}`,
    status: "xong",
    total,
    completedAt: "2026-10-10T04:00:00.000Z",
    updatedAt: "2026-10-10T04:00:00.000Z",
    history: [{ at: "2026-10-10T04:00:00.000Z", from: null, to: "xong", by: index === 0 ? "sale-1" : "sale-2", note: "" }],
  })) as Order[];
  const shopMode = commissionForSale({ orders, settings: DEFAULT_SETTINGS }, "sale-1", "2026-10");
  assert.equal(commissionBasisOf({}), "shop");
  assert.equal(shopMode.basis, "shop");
  assert.equal(shopMode.revenue, 120_000_000);
  assert.equal(shopMode.commission, 4_000_000);
  assert.equal(commissionForSale({ orders, settings: DEFAULT_SETTINGS }, "sale-2", "2026-10").revenue, 120_000_000);
  const handled = { ...DEFAULT_SETTINGS, commissionBasis: "handled" as const };
  assert.equal(commissionForSale({ orders, settings: handled }, "sale-1", "2026-10").revenue, 60_000_000);
  assert.equal(commissionForSale({ orders, settings: handled }, "sale-1", "2026-10").commission, 1_800_000);
  assert.equal(commissionForSale({ orders, settings: handled }, "sale-2", "2026-10").revenue, 60_000_000);
  const september = [{ ...orders[0]!, completedAt: "2026-09-30T04:00:00.000Z", updatedAt: "2026-09-30T04:00:00.000Z" }];
  assert.equal(commissionForSale({ orders: september, settings: handled }, "sale-1", "2026-10").revenue, 0);
});

test("đơn xong 23:30 ngày 31/10 giờ Việt Nam thuộc tháng 10", () => {
  const at = "2026-10-31T16:30:00.000Z";
  assert.equal(vnMonth(at), "2026-10");
  assert.equal(vnYmd(at), "2026-10-31");
  assert.equal(vnBackupDay(new Date(at)), "2026-10-31");
  const order = { status: "xong", total: 50000, completedAt: at, updatedAt: at } as Order;
  assert.equal(collectedRevenue([order], "2026-10"), 50000);
  assert.equal(collectedRevenue([order], "2026-11"), 0);
  const nextMorningUtc = "2026-10-31T17:30:00.000Z";
  assert.equal(vnMonth(nextMorningUtc), "2026-11");
  assert.equal(collectedRevenue([{ ...order, completedAt: nextMorningUtc, updatedAt: nextMorningUtc }], "2026-10"), 0);
  assert.equal(collectedRevenue([{ ...order, completedAt: nextMorningUtc, updatedAt: nextMorningUtc }], "2026-11"), 50000);
});

test("đăng nhập khóa sau 8 lần trong 15 phút", () => {
  const now = Date.parse("2026-10-17T10:00:00.000Z");
  const fails = Array.from({ length: LOGIN_FAIL_LIMIT - 1 }, (_, index) => ({ at: new Date(now - index * 1000).toISOString() }));
  assert.equal(loginLocked(fails, now), false);
  fails.push({ at: new Date(now).toISOString() });
  assert.equal(loginLocked(fails, now), true);
  const stale = fails.map((row, index) => ({ at: new Date(now - LOGIN_LOCK_MS - 1000 - index).toISOString() }));
  assert.equal(loginLocked(stale, now), false);
  assert.equal(loginFailKey("Sale@NhaIn.local"), "login_fail:sale@nhain.local");
  assert.equal(LOGIN_FAIL_TTL_SECONDS, 15 * 60);
  assert.equal(LOGIN_IP_FAIL_LIMIT, 30);
  assert.equal(loginFailIpKey(" 203.0.113.8 "), "login_fail_ip:203.0.113.8");
  assert.equal(loginFailIpKey("bad\rip"), "login_fail_ip:badip");
  assert.equal(loginFailIpKey("   "), "login_fail_ip:unknown");
});

test("ảnh tải lên phải đúng loại và tên file không phá header", () => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const html = new TextEncoder().encode("<html>");
  assert.equal(imageMimeAllowed("image/jpeg"), true);
  assert.equal(imageMimeAllowed("image/svg+xml"), false);
  assert.equal(imageBytesMatch("image/jpeg", jpeg), true);
  assert.equal(imageBytesMatch("image/jpeg", html), false);
  assert.equal(imageBytesMatch("image/png", png), true);
  assert.equal(imageBytesMatch("image/png", jpeg), false);
  assert.equal(servedMime("text/html"), "application/octet-stream");
  assert.equal(servedMime("image/png"), "image/png");
  const header = contentDisposition('anh"\r\n<script>.jpg');
  assert.equal(header.includes("\r"), false);
  assert.equal(header.includes("\n"), false);
  assert.equal(header.split('"').length, 3);
});

test("combo sau không được đắt hơn trên mỗi tấm", () => {
  assert.equal(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 2, price: 180000 }]), null);
  assert.match(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 2, price: 220000 }]) ?? "", /Combo 2/);
});

test("giấy 13x18 xếp vừa khổ 61cm", () => {
  const meters = rollMeters(13, 18, 61, 0.1);
  assert.ok(meters && meters > 0 && meters < 0.2);
});

test("cọc Facebook từ 300.000đ hoặc khổ 40x60", () => {
  const base = { settings: DEFAULT_SETTINGS, channel: "facebook" as const };
  assert.equal(depositFor({ ...base, total: 200000, items: [{ size: "13x18" }] }), 0);
  assert.equal(depositFor({ ...base, total: 300000, items: [{ size: "13x18" }] }), 150000);
  assert.equal(depositFor({ ...base, total: 100000, items: [{ size: "40x60" }] }), 50000);
  assert.equal(depositFor({ ...base, total: 400000, items: [{ size: "13x18" }], channel: "tai_tiem" }), 0);
});

test("máy tính giá: lỗ thì đỏ, dưới 30% thì vàng, thiếu số thì không bịa lãi", () => {
  const sku: Sku = {
    id: "x",
    code: "x",
    groupId: "ep_go",
    name: "x",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 1,
    piecesPerPack: null,
    sort: 1,
  };
  const materials: Material[] = [
    {
      id: "go",
      name: "gỗ",
      buyLabel: "tấm",
      unit: "tấm",
      packSize: 1,
      packPrice: 100000,
      stock: 0,
      minStock: null,
      supplier: "",
      pendingPrice: null,
    },
  ];
  const boms: BomLine[] = [
    { id: "b", skuId: "x", materialId: "go", phase: "print", scope: "sheet", qty: 1, formula: "manual" },
  ];
  const loss = quoteSku({ sku, price: 1000, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(loss.tone, "red");
  const low = quoteSku({ sku, price: 150000, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(low.tone, "yellow");
  assert.ok((low.marginPercent ?? 100) < 30 && (low.profit ?? 0) > 0);
  const missing = quoteSku({ sku, price: null, channel: "tai_tiem", settings: DEFAULT_SETTINGS, boms, materials, affiliate: false });
  assert.equal(missing.profit, null);
  assert.equal(missing.tone, "unknown");
});

test("đóng gói không trừ lúc in, và túi tính theo số tấm", () => {
  const sku: Sku = {
    id: "EG-13x18-C2",
    code: "EG-13x18-C2",
    groupId: "ep_go",
    name: "2 tấm",
    size: "13x18",
    widthCm: 13,
    heightCm: 18,
    sheets: 2,
    piecesPerPack: null,
    sort: 1,
  };
  const boms: BomLine[] = [
    { id: "1", skuId: sku.id, materialId: "giay-pp", phase: "print", scope: "sheet", qty: 0.05, formula: "pp" },
    { id: "2", skuId: sku.id, materialId: "tui", phase: "pack", scope: "sheet", qty: 1, formula: "bag" },
    { id: "3", skuId: sku.id, materialId: "xop", phase: "pack", scope: "parcel", qty: 0.2, formula: "foam" },
  ];
  const print = stockNeeds([{ sku, quantity: 1 }], boms, "print");
  assert.deepEqual(print.needs.map((row) => row.materialId), ["giay-pp"]);
  assert.equal(print.needs[0]?.qty, 0.1);
  const pack = stockNeeds([{ sku, quantity: 1 }], boms, "pack");
  const bag = pack.needs.find((row) => row.materialId === "tui");
  const foam = pack.needs.find((row) => row.materialId === "xop");
  assert.equal(bag?.qty, 2);
  assert.equal(foam?.qty, 0.2);
});

test("seed dùng giá chủ duyệt và catalog khách không hiện Liên hệ khi đã có giá tại tiệm", async () => {
  const state = await buildSeed();
  const price = (code: string, channel: string) =>
    state.prices.find((row) => row.skuId === code && row.channel === channel)?.price ?? null;
  assert.equal(price("TG-13x18-C1", "tai_tiem"), 35000);
  assert.equal(price("TG-13x18-C4", "tiktok"), 249000);
  assert.equal(price("AT-20x30-C1", "tai_tiem"), 59000);
  assert.equal(price("AT-20x30-C1", "tiktok"), 130000);
  assert.equal(price("GK-20x30-C1", "tiktok"), 130000);
  assert.equal(price("NCT-6x9-10", "tiktok"), 99000);
  assert.equal(price("NCT-6x9-1", "tai_tiem"), 10000);
  assert.equal(price("NCT-6x9-1", "tiktok"), null);
  assert.equal(price("TG-13x18-C2", "tiktok"), null);
  assert.equal(price("NX-9x19-C1", "tai_tiem"), 50000);
  assert.equal(price("NX-17x22-C1", "tiktok"), 95000);
  assert.equal(price("EG-40x60-C1", "tai_tiem"), 149000);
  assert.equal(price("EG-13x18-C1", "tai_tiem"), null);
  assert.equal(state.prices.filter((row) => row.price !== null).length, 279);
  const offers = walkInPublicOffers(state);
  assert.ok(offers.length > 0);
  for (const offer of offers) {
    assert.equal(offer.requires_quote, false, offer.code);
    assert.equal(typeof offer.price, "number");
    assert.ok((offer.price ?? 0) > 0, offer.code);
  }
  const offered = new Set(offers.map((row) => row.code));
  assert.equal(offered.has("TG-13x18-C1"), true);
  assert.equal(offered.has("EG-13x18-C1"), false);
  assert.equal(offered.has("NCT-6x9-1"), true);
  assert.equal(offered.has("LUA-6x9-10"), false);
  assert.deepEqual(
    comboWarnings(
      state.skus.filter((sku) => sku.groupId === "trang_guong"),
      state.prices,
      "tai_tiem",
    ),
    [],
  );
  assert.ok(
    comboWarnings(
      state.skus.filter((sku) => sku.groupId === "lua"),
      state.prices,
      "tai_tiem",
    ).length > 0,
  );
  const pack = state.skus.find((sku) => sku.code === "NCT-6x9-10");
  assert.ok(pack);
  assert.equal(pack.sheets, 10);
  assert.equal(formulaQty("magnet-6x9", pack, state.settings), round4(1 / 96));
  const magnet = stockNeeds([{ sku: pack, quantity: 1 }], state.boms, "print").needs.find(
    (row) => row.materialId === "nam-cham",
  );
  assert.equal(magnet?.qty, round4(1 / 96) * 10);
  const priceOf = (id: string) => state.materials.find((row) => row.id === id)?.packPrice;
  assert.equal(priceOf("giay-pp"), 702000);
  assert.equal(priceOf("go-13x18"), 1900);
  assert.equal(priceOf("go-60x90"), 39600);
  assert.equal(priceOf("tui"), null);
  assert.equal(priceOf("carton"), null);
  assert.equal(priceOf("tem"), null);
  assert.equal(state.settings.fbShipping, null);
  assert.equal(state.settings.lateDeductionPerMinute, null);
  assert.equal(state.settings.showAnhThe, false);
  assert.equal(state.settings.showAlbum, false);
  assert.equal(state.settings.showZalo, false);
  assert.equal(state.settings.zaloPhone, "");
  assert.equal(state.settings.fileRetentionDays, 180);
  assert.equal(state.settings.saleBase, 8000000);
  assert.equal(state.settings.productionBase, 11000000);
  const fixed = state.settings.fixedCosts.reduce((sum, row) => sum + row.amount, 0);
  assert.equal(fixed, 29400000);
  assert.equal(state.skus.some((row) => row.code.includes("10x25")), false);
  const car = state.boms.find((row) => row.skuId === "NX-9x19-C1");
  assert.equal(car?.qty, null);
  const bag = formulaQty("bag", state.skus[0]!, state.settings);
  assert.equal(bag, 1);
  const tape = formulaQty("tape", state.skus[0]!, state.settings);
  assert.equal(tape, 0.05);
  assert.equal(state.settings.groupListed.ep_go, true);
  assert.equal(state.settings.groupListed.trang_guong, true);
  assert.equal(state.settings.groupListed.anh_the, false);
  assert.equal(state.settings.groupListed.lua, false);
  assert.equal(state.settings.groupListed.tkb, false);
  const settings: Settings = state.settings;
  assert.equal(settings.marginYellowPercent, 30);
  assert.equal(settings.weeklyOff.length, 0);
});

test("mật khẩu ghi số vòng PBKDF2 và vẫn đọc hash cũ", async () => {
  const hash = await hashPassword("ThienThien#2026", "salt-moi");
  assert.equal(hash.split("$")[1], String(PBKDF2_ITERATIONS));
  assert.match(hash, /^pbkdf2\$100000\$salt-moi\$[0-9a-f]{64}$/);
  assert.equal(await verifyPassword("ThienThien#2026", hash), true);
  assert.equal(await verifyPassword("sai", hash), false);

  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", enc.encode("ThienThien#2026"), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: enc.encode("salt-cu"), iterations: 120000, hash: "SHA-256" },
    key,
    256,
  );
  const hex = [...new Uint8Array(bits)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const legacy = `pbkdf2$salt-cu$${hex}`;
  assert.equal(await verifyPassword("ThienThien#2026", legacy), true);
  assert.equal(await verifyPassword("sai", legacy), false);
  assert.equal(await verifyPassword("ThienThien#2026", "pbkdf2$120001$salt-cu$00"), false);
  assert.equal(await verifyPassword("ThienThien#2026", "khong-phai-hash"), false);
});

test("web ẩn số Zalo khi tắt hoặc sổ cũ chưa ghi", () => {
  const hidden = { phone: "", phoneRaw: "", zalo: "", showZalo: false };
  assert.deepEqual(publicContact({}), hidden);
  assert.deepEqual(publicContact({ zaloPhone: "0778662227" }), hidden);
  assert.deepEqual(publicContact({ showZalo: false, zaloPhone: "0778662227" }), hidden);
  const on = publicContact({ showZalo: true, zaloPhone: "0901111222" });
  assert.equal(on.showZalo, true);
  assert.equal(on.phone, "0901 111 222");
  assert.equal(on.phoneRaw, "0901111222");
  assert.equal(on.zalo, "https://zalo.me/0901111222");
  assert.equal(publicContact({ showZalo: true, zaloPhone: "" }).showZalo, false);

  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  const pages = [
    "../routes/index.tsx",
    "../routes/lien-he.tsx",
    "../routes/tra-cuu.tsx",
    "../routes/dat-in.tsx",
    "../routes/huong-dan.tsx",
    "../routes/san-pham.tsx",
    "../components/site/SiteFooter.tsx",
    "../components/site/SiteHeader.tsx",
    "../lib/brand.ts",
    "./seed.ts",
    "../server/service.ts",
  ];
  for (const file of pages) {
    const source = read(file);
    assert.doesNotMatch(source, /0778662227|0778\s*662\s*227/, file);
  }
  const contact = read("../routes/lien-he.tsx");
  assert.match(contact, /Đặt in online/);
  assert.match(contact, /Tra cứu đơn/);
  assert.doesNotMatch(contact, /MapPin|BRAND\.region/);
  const config = read("../server/service.ts");
  const body = config.slice(config.indexOf("export async function publicConfig"), config.indexOf("let lastFileSweep"));
  assert.match(body, /publicContact\(/);
  assert.doesNotMatch(body, /!== false/);
});

test("sổ cũ đang bật Zalo bị tắt một lần, sau đó giữ ô của chủ", () => {
  assert.equal(DEFAULT_SETTINGS.zaloDefaultMigrated, true);
  assert.equal(DEFAULT_SETTINGS.showZalo, false);
  const state = {
    settings: { showZalo: true, zaloPhone: "0778662227" },
    groups: [
      {
        id: "anh_tho",
        description: "Ảnh thờ. Miễn phí khôi phục, thay áo, đổi nền. Không giới hạn số lần sửa.",
        turnaround: "Có liền",
      },
    ],
  };
  assert.equal(applyStoreMigrations(state), true);
  assert.equal(state.settings.showZalo, false);
  assert.equal(state.settings.zaloDefaultMigrated, true);
  assert.equal(state.groups[0]?.description, "Ảnh thờ. Hỗ trợ chỉnh sửa ảnh cơ bản.");
  assert.equal(state.groups[0]?.turnaround, "Theo đơn");
  state.settings.showZalo = true;
  assert.equal(applyStoreMigrations(state), false);
  assert.equal(state.settings.showZalo, true);

  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  for (const file of ["../routes/index.tsx", "../routes/huong-dan.tsx", "./seed.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /miễn phí|Miễn phí|24–48|ít phút|Có liền|\btặng\b/i, file);
  }
});
