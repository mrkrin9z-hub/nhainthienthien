/**
 * Gỡ bán các mã alias/ngừng bán còn tick "Bán" nhưng trống giá;
 * kiểm tra 0 dòng đang bán bị — và 0 cảnh báo combo (chỉ tính gói dang_ban).
 */
import { readFileSync, writeFileSync } from "node:fs";

const path = process.argv[2];
if (!path) {
  console.error("usage: node unsell-and-verify-prices.mjs shop_state.json [--apply]");
  process.exit(1);
}
const apply = process.argv.includes("--apply");
const wrap = JSON.parse(readFileSync(path, "utf8"));
const state = wrap.doc ?? wrap;
const skus = state.skus ?? [];
const prices = state.prices ?? [];

const LUA_KEEP = new Set(["LUA-6x9-1", "LUA-6x9-50", "LUA-6x9-100", "LUA-6x9-200", "LUA-6x9-300", "LUA-6x9-500"]);
function shouldUnsell(sku) {
  const code = sku.code || sku.id;
  if (code.startsWith("EG-")) return true;
  if (code === "NCT-6x9-1") return true;
  if (code === "TKB-20x30-C4" || code === "TKB-20x30-C5") return true;
  if (code === "ATHE-4x6-C1" || code.startsWith("ALBUM")) return true;
  if (code === "NX-9x19-C1" || code === "NX-17x22-C1") return true;
  if (code.startsWith("LUA-6x9-") && !LUA_KEEP.has(code) && !code.endsWith("-GOI")) return true;
  return false;
}

function priceOf(skuId, channel) {
  return prices.find((row) => row.skuId === skuId && row.channel === channel);
}

function soldOn(sku, channel) {
  const listed = sku.soldOn;
  if (listed == null) return ["tai_tiem", "facebook", "tiktok", "shopee"].includes(channel);
  return listed.includes(channel);
}

const unsell = skus.filter(shouldUnsell);
if (apply) {
  for (const sku of unsell) {
    sku.soldOn = [];
    for (const row of prices.filter((item) => item.skuId === sku.id)) {
      row.status = "nhap";
    }
  }
}

const channels = ["tai_tiem", "facebook", "tiktok", "shopee", "ctv", "mo_home"];
const soldEmpty = [];
for (const sku of skus) {
  if ((sku.code || "").startsWith("EG-")) continue;
  for (const channel of channels) {
    if (!soldOn(sku, channel)) continue;
    const row = priceOf(sku.id, channel);
    if (!row || row.price == null || row.status !== "dang_ban") {
      soldEmpty.push(`${sku.code}:${channel}:${row?.price ?? "null"}:${row?.status ?? "missing"}`);
    }
  }
}

function perSheet(price, sheets) {
  return price / sheets;
}
const warnings = [];
for (const channel of ["tai_tiem", "facebook", "tiktok", "shopee"]) {
  const groups = new Map();
  for (const sku of skus) {
    if (!sku.size || (sku.code || "").endsWith("-GOI") || (sku.code || "").startsWith("EG-")) continue;
    const key = `${sku.groupId}:${sku.size}`;
    const list = groups.get(key) ?? [];
    list.push(sku);
    groups.set(key, list);
  }
  for (const list of groups.values()) {
    const known = list
      .map((sku) => {
        const row = priceOf(sku.id, channel);
        const live = row && row.status !== "nhap" && row.status !== "cho_duyet" ? row.price : null;
        return live != null && sku.sheets > 0 ? { sheets: sku.sheets, price: live, size: sku.size } : null;
      })
      .filter(Boolean)
      .sort((a, b) => a.sheets - b.sheets);
    for (let i = 1; i < known.length; i++) {
      const prev = known[i - 1];
      const cur = known[i];
      if (perSheet(cur.price, cur.sheets) > perSheet(prev.price, prev.sheets) + 0.0001) {
        warnings.push(`${channel}: ${cur.size} · Combo ${cur.sheets} tấm có giá mỗi tấm cao hơn combo ${prev.sheets} tấm.`);
      }
    }
  }
}

if (apply) writeFileSync(path, JSON.stringify(wrap), "utf8");
const result = {
  version: wrap.version ?? state.version,
  skuCount: skus.length,
  unsellCodes: unsell.map((sku) => sku.code),
  applied: apply,
  soldEmpty,
  warnings,
};
console.log(JSON.stringify(result, null, 2));
if (soldEmpty.length || warnings.length) process.exit(2);
