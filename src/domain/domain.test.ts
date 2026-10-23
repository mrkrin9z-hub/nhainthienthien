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
  magnetPiecesOnSheet,
  quoteSku,
  rollMeters,
  round4,
  sheetMargin,
  stockNeeds,
  walkInPublicOffers,
} from "./calc.ts";
import { commissionBasisOf, commissionForSale } from "./commission.ts";
import { contentDisposition, imageBytesMatch, imageMimeAllowed, servedMime } from "./images.ts";
import { crc32, zipNames, zipStored } from "./zip-store.ts";
import { LOGIN_FAIL_LIMIT, LOGIN_FAIL_TTL_SECONDS, LOGIN_IP_FAIL_LIMIT, LOGIN_LOCK_MS, loginFailIpKey, loginFailKey, loginLocked } from "./login-limit.ts";
import { vnBackupDay } from "./guard.ts";
import { publicContact } from "./public-contact.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import { buildSeed, DEFAULT_SETTINGS, hashPassword, PBKDF2_ITERATIONS, verifyPassword } from "./seed.ts";
import { navCounts, stockLabel } from "./views.ts";
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
  assert.match(header, /^inline;/);
  assert.match(contentDisposition("anh.png", true), /^attachment;/);
});

test("zip ảnh lưu tên và đúng checksum", async () => {
  const hello = new TextEncoder().encode("hello");
  assert.equal(crc32(hello), 0x3610a686);
  assert.deepEqual(zipNames(["a.png", "a.png", "b"]), ["a.png", "a-2.png", "b"]);
  const blob = zipStored([
    { name: "a.png", bytes: hello },
    { name: "a.png", bytes: hello },
  ]);
  const bytes = new Uint8Array(await blob.arrayBuffer());
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
  const text = new TextDecoder().decode(bytes);
  assert.match(text, /a\.png/);
  assert.match(text, /a-2\.png/);
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
  assert.equal(price("TG-13x18-C1", "facebook"), 35000);
  assert.equal(price("TG-13x18-C1", "tiktok"), 35000);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tiktok")?.listPrice, 50000);
  assert.equal(price("TG-13x18-C4", "tai_tiem"), 100000);
  assert.equal(price("TG-13x18-C4", "tiktok"), 100000);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C4" && row.channel === "shopee")?.listPrice, 139000);
  assert.equal(price("AT-20x30-C1", "tai_tiem"), 56000);
  assert.equal(price("AT-20x30-C1", "tiktok"), 56000);
  assert.equal(price("GK-20x30-C1", "tiktok"), 56000);
  assert.equal(price("NCT-6x9-10", "tiktok"), 85000);
  assert.equal(price("NCT-6x9-1", "tai_tiem"), null);
  assert.equal(price("NCT-6x9-1", "tiktok"), null);
  assert.equal(price("TG-13x18-C2", "tai_tiem"), 69000);
  assert.equal(price("TG-13x18-C2", "tiktok"), 69000);
  assert.equal(price("TG-13x18-C3", "tai_tiem"), 89000);
  assert.equal(price("TG-13x18-C5", "facebook"), 119000);
  assert.match(state.prices.find((row) => row.skuId === "TG-13x18-C2" && row.channel === "tai_tiem")?.note ?? "", /xác nhận/);
  assert.deepEqual(
    state.staff.map((person) => person.name),
    ["Admin", "Sale", "Sản xuất"],
  );
  assert.equal(price("LUA-6x9-10", "tai_tiem"), 17000);
  assert.equal(price("LUA-6x9-10", "tiktok"), null);
  assert.equal(price("NX-9x19-C1", "tai_tiem"), null);
  assert.equal(price("NX-12x25-C1", "tai_tiem"), 65000);
  assert.equal(price("NX-17x22-C1", "tiktok"), 79000);
  assert.equal(price("EG-40x60-C1", "tai_tiem"), 149000);
  assert.equal(price("EG-13x18-C1", "tai_tiem"), null);
  assert.equal(state.skus.find((sku) => sku.code === "TG-13x18-C1")?.sheetCost, 8657);
  assert.ok(state.prices.filter((row) => row.price !== null).length > 200);
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
  assert.equal(offered.has("EG-40x60-C1"), false);
  assert.equal(offered.has("NCT-6x9-1"), false);
  assert.equal(offered.has("LUA-6x9-10"), true);
  assert.equal(offered.has("NX-12x25-C1"), true);
  assert.equal(offered.has("NX-9x19-C1"), false);
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
  assert.equal(priceOf("tui"), 500);
  assert.equal(priceOf("carton"), 0);
  assert.equal(priceOf("tem"), 0);
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
  assert.equal(fixed, 23900000);
  assert.equal(state.settings.breakevenMonth, 45126608);
  assert.equal(state.settings.breakevenDay, 1735646);
  assert.equal(state.settings.hrDraft?.pendingOwnerApproval, false);
  assert.deepEqual(state.settings.kpiTargets, [25000000, 20000000, 40000000, 60000000]);
  assert.equal(state.settings.hrApproved20261022, true);
  assert.equal(state.settings.catalogImport20261022, true);
  assert.equal(state.skus.some((row) => row.code.includes("10x25")), false);
  const car = state.boms.find((row) => row.skuId === "NX-9x19-C1" && row.materialId === "nam-cham");
  assert.equal(car?.formula, "magnet");
  assert.equal(car?.qty, round4(1 / 33));
  const bag = formulaQty("bag", state.skus[0]!, state.settings);
  assert.equal(bag, 1);
  const tape = formulaQty("tape", state.skus[0]!, state.settings);
  assert.equal(tape, 0.05);
  assert.equal(state.settings.groupListed.ep_go, false);
  assert.equal(state.settings.groupListed.trang_guong, true);
  assert.equal(state.settings.groupListed.anh_the, false);
  assert.equal(state.settings.groupListed.lua, true);
  assert.equal(state.settings.groupListed.tkb, true);
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
  assert.ok(Array.isArray((state as { roleModules?: unknown[] }).roleModules));
  state.settings.showZalo = true;
  assert.equal(applyStoreMigrations(state), false);
  assert.equal(state.settings.showZalo, true);

  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  for (const file of ["../routes/index.tsx", "../routes/huong-dan.tsx", "./seed.ts"]) {
    const source = read(file);
    assert.doesNotMatch(source, /miễn phí|Miễn phí|24–48|ít phút|Có liền|\btặng\b/i, file);
  }
});

test("ảnh ép gỗ và ảnh bo viền gộp một sản phẩm, mã EG và định mức giữ nguyên", async () => {
  const seeded = await buildSeed();
  const cards = seeded.groups.filter((group) => group.name === "Ảnh ép gỗ tráng gương để bàn");
  assert.equal(cards.length, 1);
  assert.equal(cards[0]?.id, "trang_guong");
  assert.equal(cards[0]?.slug, "trang-guong");
  assert.equal(cards[0]?.turnaround, "");
  assert.equal(seeded.groups.some((group) => group.id === "ep_go"), false);
  assert.ok(seeded.groups.every((group) => group.turnaround !== "1–2 ngày"));
  const eg = seeded.skus.find((sku) => sku.code === "EG-40x60-C1");
  const tg = seeded.skus.find((sku) => sku.code === "TG-40x60-C1");
  assert.equal(eg?.id, "EG-40x60-C1");
  assert.equal(eg?.groupId, "trang_guong");
  assert.equal(tg?.groupId, "trang_guong");
  assert.equal(seeded.boms.some((row) => row.skuId === "EG-40x60-C1" && row.materialId === "go-40x60"), true);
  assert.equal(seeded.boms.some((row) => row.skuId === "TG-40x60-C1" && row.materialId === "go-40x60"), true);
  const walkIn: Record<string, number> = {
    "13x18": 35000,
    "15x21": 39000,
    "20x30": 56000,
    "30x45": 86000,
    "40x60": 149000,
    "50x75": 239000,
    "60x90": 319000,
  };
  for (const [size, amount] of Object.entries(walkIn)) {
    const row = seeded.prices.find((price) => price.skuId === `TG-${size}-C1` && price.channel === "tai_tiem");
    assert.equal(row?.price, amount, size);
  }
  const offers = walkInPublicOffers(seeded);
  for (const size of Object.keys(walkIn)) assert.equal(offers.some((row) => row.code === `TG-${size}-C1`), true, size);
  assert.equal(offers.some((row) => row.code.startsWith("EG-")), false);
  assert.equal(offers.filter((row) => row.groupId === "trang_guong").length > 0, true);
  assert.equal(applyStoreMigrations(seeded), false);

  const legacy = {
    settings: { showZalo: false, zaloDefaultMigrated: true, groupListed: { ep_go: true, trang_guong: true } },
    groups: [
      {
        id: "trang_guong",
        name: "Ảnh tráng gương bo viền",
        description: "Để bàn với khổ từ 20×30 trở xuống có chân dựng. Từ 30×45 có móc treo tường.",
        category: "Ảnh trang trí",
        sort: 6,
        turnaround: "1–2 ngày",
      },
      {
        id: "ep_go",
        name: "Ảnh ép gỗ tráng gương",
        description: "Khổ nhỏ hơn nằm ở ảnh tráng gương.",
        turnaround: "1–2 ngày",
      },
      { id: "anh_tho", name: "Ảnh thờ ép gỗ", description: "x", turnaround: "Theo đơn" },
    ],
    skus: [
      { id: "EG-40x60-C1", code: "EG-40x60-C1", groupId: "ep_go" },
      { id: "TG-13x18-C1", code: "TG-13x18-C1", groupId: "trang_guong" },
    ],
    boms: [{ id: "EG-40x60-C1:go-40x60:print", skuId: "EG-40x60-C1", materialId: "go-40x60" }],
    skuMaps: [{ channel: "tiktok" as const, externalSku: "EG-40", skuId: "EG-40x60-C1" }],
    orders: [
      {
        items: [
          { skuId: "EG-40x60-C1", name: "Ảnh ép gỗ tráng gương — 40×60 cm" },
          { skuId: "TG-13x18-C1", name: "Ảnh tráng gương bo viền — 13×18 cm" },
          { skuId: "TG-20x30-C1", name: "Ảnh tráng gương - 20×30 cm" },
        ],
      },
    ],
  };
  assert.equal(applyStoreMigrations(legacy), true);
  assert.equal(legacy.groups.some((group) => group.id === "ep_go"), false);
  assert.equal(legacy.groups.find((group) => group.id === "trang_guong")?.name, "Ảnh ép gỗ tráng gương để bàn");
  assert.equal(legacy.groups.find((group) => group.id === "trang_guong")?.category, "Ảnh gỗ");
  assert.equal(legacy.groups.find((group) => group.id === "trang_guong")?.turnaround, "");
  assert.match(legacy.groups.find((group) => group.id === "trang_guong")?.description ?? "", /13×18 đến 60×90/);
  assert.equal(legacy.groups.find((group) => group.id === "anh_tho")?.turnaround, "Theo đơn");
  assert.equal(legacy.skus[0]?.groupId, "trang_guong");
  assert.equal(legacy.skus[0]?.id, "EG-40x60-C1");
  assert.equal(legacy.boms[0]?.skuId, "EG-40x60-C1");
  assert.equal(legacy.boms[0]?.materialId, "go-40x60");
  assert.equal(legacy.skuMaps[0]?.skuId, "EG-40x60-C1");
  assert.equal(legacy.orders[0]?.items[0]?.skuId, "EG-40x60-C1");
  assert.equal(legacy.orders[0]?.items[0]?.name, "Ảnh ép gỗ tráng gương để bàn — 40×60 cm");
  assert.equal(legacy.orders[0]?.items[1]?.name, "Ảnh ép gỗ tráng gương để bàn — 13×18 cm");
  assert.equal(legacy.orders[0]?.items[2]?.name, "Ảnh ép gỗ tráng gương để bàn - 20×30 cm");
  assert.equal(legacy.settings.groupListed.ep_go, false);
  assert.equal(applyStoreMigrations(legacy), false);

  const renamedByOwner = {
    settings: {
      zaloDefaultMigrated: true,
      groupListed: { ep_go: false, trang_guong: true },
      sepay: { enabled: false, apiKey: "", accountHint: "", webhookPath: "/api/public/sepay", note: "" },
      notifyPrefs: { lateOrders: true, marketplaceNew: true, feedbackReprint: true, cashHandover: true },
      shopChannels: [
        { id: "tai_tiem" as const, enabled: true, label: "Tại tiệm (offline)" },
        { id: "facebook" as const, enabled: true, label: "Online / Facebook" },
        { id: "tiktok" as const, enabled: true, label: "TikTok" },
        { id: "shopee" as const, enabled: true, label: "Shopee" },
      ],
    },
    groups: [{ id: "trang_guong", name: "Tên chủ đã sửa", description: "x", turnaround: "3 ngày" }],
    skus: [{ id: "EG-40x60-C1", code: "EG-40x60-C1", groupId: "trang_guong" }],
    roleModules: [{ role: "owner" as const, modules: ["/admin", "/admin/goi"] }],
    packages: [],
    sepaySeen: [],
  };
  applyStoreMigrations(renamedByOwner);
  assert.equal(renamedByOwner.groups[0]?.name, "Tên chủ đã sửa");
  assert.equal(renamedByOwner.groups[0]?.turnaround, "3 ngày");
  assert.equal(renamedByOwner.settings.shopChannels?.find((row) => row.id === "tai_tiem")?.label, "Tại tiệm (offline)");
  assert.equal(renamedByOwner.settings.shopChannels?.some((row) => row.id === "mo_home"), true);
  assert.equal(applyStoreMigrations(renamedByOwner), false);

  const read = (file: string) => readFileSync(new URL(file, import.meta.url), "utf8");
  for (const file of ["../routes/index.tsx", "../routes/huong-dan.tsx", "../routes/san-pham.tsx", "./seed.ts", "../../README.md"]) {
    assert.doesNotMatch(read(file), /Ảnh tráng gương|ảnh tráng gương|1–2 ngày/, file);
  }
});

test("gỗ TG, nam châm theo khổ và 9 lọ mực", async () => {
  assert.equal(magnetPiecesOnSheet(12, 25, 96), 20);
  assert.equal(magnetPiecesOnSheet(25, 12, 96), 20);
  assert.equal(magnetPiecesOnSheet(17, 22, 96), 12);
  assert.equal(magnetPiecesOnSheet(9, 19, 96), 33);
  assert.equal(magnetPiecesOnSheet(10, 25, 96), 24);
  assert.equal(magnetPiecesOnSheet(6, 9, 96), 96);
  assert.equal(magnetPiecesOnSheet(9, 6, 96), 96);

  const state = await buildSeed();
  const settings = state.settings;
  const gloss = state.skus.find((sku) => sku.code === "TG-13x18-C1");
  assert.ok(gloss);
  assert.equal(gloss.sheetCost, 6757 + 1900);
  const before = sheetMargin("tai_tiem", 35000, 6757, settings);
  const after = sheetMargin("tai_tiem", 35000, gloss.sheetCost ?? null, settings);
  assert.equal(before.profit, 25653);
  assert.equal(after.profit, 23753);
  assert.equal(after.marginPercent, 67.9);
  assert.equal(state.boms.some((row) => row.skuId === "TG-13x18-C4" && row.materialId === "go-13x18" && row.qty === 1), true);
  assert.equal(state.skus.find((sku) => sku.code === "TG-13x18-C4")?.sheetCost, 21592 + 1900 * 4);
  assert.equal(state.prices.find((row) => row.skuId === "TG-13x18-C1" && row.channel === "tai_tiem")?.price, 35000);

  const piece = (code: string) => {
    const sku = state.skus.find((row) => row.code === code);
    assert.ok(sku);
    const pieces = magnetPiecesOnSheet(sku.widthCm ?? 0, sku.heightCm ?? 0, settings.magnetPiecesPerSheet);
    assert.ok(pieces);
    const line = state.boms.find((row) => row.skuId === sku.id && row.materialId === "nam-cham");
    assert.equal(line?.qty, round4(1 / pieces));
    return Math.round(176000 / pieces);
  };
  assert.equal(piece("NX-12x25-C1"), 8800);
  assert.equal(piece("NX-17x22-C1"), 14667);
  assert.equal(piece("NX-9x19-C1"), 5333);
  assert.equal(piece("NCT-6x9-1"), 1833);
  assert.equal(state.skus.find((sku) => sku.code === "NX-12x25-C1")?.sheetCost, 11000 - 7500 + 8800);
  assert.equal(state.skus.find((sku) => sku.code === "NX-17x22-C1")?.sheetCost, 19241);
  assert.match(state.prices.find((row) => row.skuId === "NX-12x25-C1" && row.channel === "tai_tiem")?.note ?? "", /8\.800/);
  assert.equal(state.skus.some((row) => row.code.includes("10x25")), false);
  assert.equal(settings.inkPercent, 4.4);

  const inks = state.materials.filter((row) => row.id.startsWith("muc"));
  assert.deepEqual(inks.map((row) => row.id), ["muc-1", "muc-2", "muc-3", "muc-4", "muc-5", "muc-6", "muc-7", "muc-8", "muc-9"]);
  assert.ok(inks.every((row) => row.packPrice === null && row.unit === "lọ" && row.name.startsWith("Mực màu")));
  assert.equal(state.materials.some((row) => row.id === "muc"), false);

  assert.equal(stockLabel({ stock: -1, minStock: 2, openingCounted: false }), "Tồn âm");
  assert.equal(stockLabel({ stock: 0, minStock: 2, openingCounted: false }), "Chưa đếm");
  assert.equal(stockLabel({ stock: 0, minStock: 2, openingCounted: true }), "Sắp hết");
  assert.equal(stockLabel({ stock: 1, minStock: 2, openingCounted: true }), "Sắp hết");
  assert.equal(stockLabel({ stock: 3, minStock: 2, openingCounted: true }), "Đủ");
  assert.equal(navCounts(state)["/admin/kho"], state.materials.length);

  const legacy = structuredClone(state);
  legacy.settings.deskBom20261023 = false;
  const glossSku = legacy.skus.find((sku) => sku.code === "TG-13x18-C1");
  assert.ok(glossSku);
  glossSku.sheetCost = 6757;
  legacy.boms = legacy.boms.filter((row) => !(row.skuId === "TG-13x18-C1" && row.materialId === "go-13x18"));
  const magnet = legacy.boms.find((row) => row.skuId === "NX-12x25-C1" && row.materialId === "nam-cham");
  assert.ok(magnet);
  magnet.formula = "unknown";
  magnet.qty = null;
  legacy.skus = legacy.skus.filter((sku) => sku.code !== "NX-12x25-C1");
  legacy.prices = legacy.prices.filter((row) => row.skuId !== "NX-12x25-C1");
  legacy.boms = legacy.boms.filter((row) => row.skuId !== "NX-12x25-C1");
  legacy.materials = legacy.materials.filter((row) => !row.id.startsWith("muc"));
  legacy.materials.push({
    id: "muc",
    name: "Mực in",
    buyLabel: "lọ",
    unit: "lọ",
    packSize: 1,
    packPrice: 1100000,
    stock: -1,
    minStock: 2,
    supplier: "",
    pendingPrice: null,
    openingCounted: false,
  });
  assert.equal(applyStoreMigrations(legacy), true);
  assert.equal(legacy.settings.deskBom20261023, true);
  assert.equal(legacy.boms.some((row) => row.skuId === "TG-13x18-C1" && row.materialId === "go-13x18"), true);
  assert.equal(legacy.skus.find((sku) => sku.code === "TG-13x18-C1")?.sheetCost, 8657);
  const restored = legacy.boms.find((row) => row.skuId === "NX-12x25-C1" && row.materialId === "nam-cham");
  assert.equal(restored?.qty, 0.05);
  assert.equal(legacy.prices.find((row) => row.skuId === "NX-12x25-C1" && row.channel === "tai_tiem")?.price, 65000);
  assert.equal(legacy.materials.some((row) => row.id === "muc"), false);
  assert.ok(legacy.materials.filter((row) => row.id.startsWith("muc-")).every((row) => row.stock === 0 && row.packPrice === null));
  assert.equal(applyStoreMigrations(legacy), false);
});
