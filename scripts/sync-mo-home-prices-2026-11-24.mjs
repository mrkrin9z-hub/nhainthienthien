#!/usr/bin/env node
/**
 * Đồng bộ giá kênh mo_home theo bảng Đại lý Mơ Home đã chốt 24/11/2026
 * (data.json['mh'], 60 dòng, chỉ bán lẻ, không combo/gói, không tối thiểu).
 *
 * Usage:
 *   node scripts/sync-mo-home-prices-2026-11-24.mjs <shop_state.json> --apply
 *   node scripts/sync-mo-home-prices-2026-11-24.mjs <shop_state.json>
 */
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const DATA = resolve(dirname(fileURLToPath(import.meta.url)), "../../../bang-gia-final-2111/data.json");
const NOTE = "Giá Đại lý Mơ Home chốt 24/11/2026 (bán lẻ, không combo, không tối thiểu).";
const apply = process.argv.includes("--apply");
const file = process.argv.slice(2).find((a) => !a.startsWith("-"));
if (!file) {
  console.error("Usage: node scripts/sync-mo-home-prices-2026-11-24.mjs <shop_state.json> [--apply]");
  process.exit(2);
}

const data = JSON.parse(readFileSync(DATA, "utf8"));
const mh = data.mh;
if (!Array.isArray(mh) || mh.length !== 60) {
  throw new Error(`data.json mh phải có đúng 60 dòng, nhận ${mh?.length}`);
}

function officialCodes(row) {
  const [product, size, kind] = row;
  const p = String(product);
  const k = String(kind || "");
  if (p === "Ảnh tráng gương ép gỗ 4K HD" && k.startsWith("Bo viền")) return [`TG-${size}-C1`];
  if (p === "Ảnh tráng gương ép gỗ 4K HD" && k.startsWith("Khung tivi")) return [`LCD-${size}-C1`];
  if (p === "Ảnh tráng gương ép gỗ 4K HD" && k.startsWith("Khung hộp")) return [`HOP-${size}-C1`];
  if (p === "Ảnh tráng gương ép gỗ 4K HD" && k.startsWith("Khung nhôm")) return [`NHOM-${size}-C1`];
  if (p.includes("khung tivi (LCD) size nhỏ")) return [`LCD-${size}-C1`];
  if (p.includes("tràn viền") && p.includes("Ảnh tráng gương") && !p.includes("size lớn")) return [`TG-${size}-C1`];
  if (p.includes("Ảnh ép gỗ lụa") && size === "60x120") return [`EL-${size}-C1`];
  if (p.startsWith("Ảnh ép gỗ lụa")) return [`EL-${size}-C1`];
  if (p.startsWith("Ảnh lụa in rời")) return [`LR-${size}-C1`];
  if (p.startsWith("Thời khóa biểu ép gỗ")) return ["TKB-20x30-C1"];
  if (p.startsWith("Thời khóa biểu tráng gương mica")) return ["TKBBD-20x30-C1"];
  if (p.startsWith("Nam châm tủ lạnh")) return ["NCT-6x9-1"];
  if (p.startsWith("Ảnh lụa 6x9") || p.startsWith("Ảnh lụa 6×9")) return ["LUA-6x9-1"];
  if (p.includes("Lái Mới")) return ["NX-12x25-C1"];
  if (p.startsWith("Giấy khen")) return ["GKN-20x30-C1"];
  if (p.startsWith("Album PTB")) return [`PB-${size}-C1`];
  if (p.includes("Ảnh tráng gương") && p.includes("bo viền") && size === "60x120") return ["TG-60x120-C1"];
  if (p.includes("khung hộp / nhôm") && size === "60x120") return ["HOP-60x120-C1", "NHOM-60x120-C1"];
  throw new Error(`Chưa map dòng Mơ Home: ${JSON.stringify(row.slice(0, 4))}`);
}

const officialPrice = new Map(); // code -> price
const officialRows = [];
for (const row of mh) {
  const price = row[3];
  const codes = officialCodes(row);
  officialRows.push({ product: row[0], size: row[1], kind: row[2], price, codes });
  for (const code of codes) {
    if (officialPrice.has(code) && officialPrice.get(code) !== price) {
      throw new Error(`Giá xung đột ${code}: ${officialPrice.get(code)} vs ${price}`);
    }
    officialPrice.set(code, price);
  }
}

function isComboOrPack(sku) {
  if ((sku.piecesPerPack ?? 0) > 1) return true;
  if ((sku.sheets ?? 1) > 1) return true;
  if (/^LUA-6x9-/.test(sku.code) && sku.code !== "LUA-6x9-1") return true;
  if (/^NCT-6x9-/.test(sku.code) && sku.code !== "NCT-6x9-1") return true;
  if (/-C[2-9]$/.test(sku.code)) return true;
  if (/Gói\s|combo/i.test(sku.name || "")) return true;
  return false;
}

function priceKey(prices, skuId, channel) {
  return prices.findIndex((row) => row.skuId === skuId && row.channel === channel);
}

function ensureRow(prices, skuId, channel) {
  let i = priceKey(prices, skuId, channel);
  if (i < 0) {
    prices.push({ skuId, channel, price: null, status: "nhap", note: "" });
    i = prices.length - 1;
  }
  return prices[i];
}

function unsellMoHome(sku, prices) {
  const sold = Array.isArray(sku.soldOn) ? sku.soldOn.filter((c) => c !== "mo_home") : sku.soldOn;
  const changed = [];
  if (Array.isArray(sku.soldOn) && sku.soldOn.includes("mo_home")) {
    sku.soldOn = sold;
    changed.push("soldOn");
  }
  const i = priceKey(prices, sku.id, "mo_home");
  if (i >= 0) {
    const row = prices[i];
    if (row.status !== "nhap" || row.price != null || row.minTotal) {
      row.status = "nhap";
      row.price = null;
      if (row.minTotal != null) row.minTotal = null;
      row.note = NOTE + " Gói/combo không bán trên mo_home.";
      changed.push("price");
    }
  }
  return changed;
}

const wrap = JSON.parse(readFileSync(file, "utf8"));
const doc = wrap.doc ?? wrap;
const skus = doc.skus ?? [];
const prices = doc.prices ?? [];
const byCode = new Map(skus.map((s) => [s.code, s]));
const changes = [];

for (const code of officialPrice.keys()) {
  if (!byCode.has(code)) throw new Error(`Thiếu SKU ${code} trong shop_state`);
}

// 1) Apply official singles
for (const [code, price] of officialPrice) {
  const sku = byCode.get(code);
  const bits = [];
  const sold = Array.isArray(sku.soldOn) ? [...sku.soldOn] : [];
  if (code === "NCT-6x9-1") {
    if (JSON.stringify(sold) !== JSON.stringify(["mo_home"])) {
      sku.soldOn = ["mo_home"];
      bits.push(`soldOn ${JSON.stringify(sold)} → ["mo_home"]`);
    }
  } else if (!sold.includes("mo_home")) {
    sold.push("mo_home");
    sku.soldOn = sold;
    bits.push("thêm mo_home vào soldOn");
  }
  const row = ensureRow(prices, sku.id, "mo_home");
  if (row.price !== price) {
    bits.push(`giá ${row.price} → ${price}`);
    row.price = price;
  }
  if (row.status !== "dang_ban") {
    bits.push(`status ${row.status} → dang_ban`);
    row.status = "dang_ban";
  }
  if (row.minTotal != null && row.minTotal !== 0) {
    bits.push(`xóa minTotal ${row.minTotal}`);
    row.minTotal = null;
  }
  row.note = NOTE;
  if (bits.length) changes.push({ code, bits });
}

// 2) Unsell packs/combos and any other mo_home SKU not on the official list
for (const sku of skus) {
  const official = officialPrice.has(sku.code);
  if (official) continue;
  const sold = sku.soldOn;
  const on = Array.isArray(sold) && sold.includes("mo_home");
  const i = priceKey(prices, sku.id, "mo_home");
  const row = i >= 0 ? prices[i] : null;
  const selling = on || (row && row.status === "dang_ban" && row.price != null);
  if (!selling && !isComboOrPack(sku)) continue;
  if (selling || (row && (row.price != null || row.status === "dang_ban"))) {
    const bits = unsellMoHome(sku, prices);
    if (bits.length) changes.push({ code: sku.code, bits: [`gỡ mo_home (${isComboOrPack(sku) ? "combo/gói" : "không có trong bảng mh"})`, ...bits] });
  }
}

function soldOn(sku) {
  return sku.soldOn;
}

const soldEmpty = [];
const channels = ["tai_tiem", "facebook", "tiktok", "shopee", "ctv", "mo_home"];
for (const sku of skus) {
  if ((sku.code || "").startsWith("EG-")) continue;
  const listed = soldOn(sku);
  for (const channel of channels) {
    const sold = listed == null ? ["tai_tiem", "facebook", "tiktok", "shopee"].includes(channel) : listed.includes(channel);
    if (!sold) continue;
    const row = prices.find((p) => p.skuId === sku.id && p.channel === channel);
    if (!row || row.price == null || row.status !== "dang_ban") soldEmpty.push(`${sku.code}:${channel}`);
  }
}

const moSold = skus.filter((s) => Array.isArray(s.soldOn) && s.soldOn.includes("mo_home"));
const mismatch = [];
for (const sku of moSold) {
  const row = prices.find((p) => p.skuId === sku.id && p.channel === "mo_home");
  const expect = officialPrice.get(sku.code);
  if (expect == null) mismatch.push(`${sku.code} đang bán mo_home nhưng không có trong bảng mh`);
  else if (!row || row.price !== expect || row.status !== "dang_ban") {
    mismatch.push(`${sku.code} giá live ${row?.price}/${row?.status} ≠ ${expect}`);
  }
  if (row?.minTotal) mismatch.push(`${sku.code} còn minTotal ${row.minTotal} trên mo_home`);
  if (isComboOrPack(sku)) mismatch.push(`${sku.code} là combo/gói vẫn bật mo_home`);
}
for (const [code, price] of officialPrice) {
  const sku = byCode.get(code);
  const row = prices.find((p) => p.skuId === sku.id && p.channel === "mo_home");
  const on = Array.isArray(sku.soldOn) && sku.soldOn.includes("mo_home");
  if (!on || !row || row.price !== price || row.status !== "dang_ban") {
    mismatch.push(`thiếu/sai official ${code} (sold=${on} price=${row?.price} status=${row?.status})`);
  }
}

const nct = byCode.get("NCT-6x9-1");
const nctSold = nct?.soldOn;
if (!nct || JSON.stringify(nctSold) !== JSON.stringify(["mo_home"])) {
  mismatch.push(`NCT-6x9-1 soldOn phải là ["mo_home"], nhận ${JSON.stringify(nctSold)}`);
}

const report = {
  version: wrap.version ?? doc.version,
  officialSkuCount: officialPrice.size,
  officialRowCount: mh.length,
  moHomeSelling: moSold.length,
  moHomeCodes: moSold.map((s) => s.code).sort(),
  changes,
  soldEmpty,
  mismatch,
  applied: apply,
};

if (apply) {
  const next = (wrap.version ?? doc.version ?? 0) + 1;
  wrap.version = next;
  doc.version = next;
  writeFileSync(file, JSON.stringify(wrap, null, 0));
  report.version = next;
}

console.log(JSON.stringify(report, null, 2));
if (soldEmpty.length || mismatch.length) process.exit(1);
