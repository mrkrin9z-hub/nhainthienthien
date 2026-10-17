import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import { moneyLeaks, visibleToRole } from "./access.ts";
import { comboPriceError, comboWarnings, depositBlocks, depositFor, statusChangeError } from "./calc.ts";
import { commitLoop } from "./commit.ts";
import { filesToPurge } from "./files.ts";
import { buildSeed, DEFAULT_SETTINGS } from "./seed.ts";
import { syncOrderStock } from "./stock.ts";
import type { Order, OrderFile } from "./types.ts";
import { buildDashboard, inventoryView, orderDetail } from "./views.ts";

function file(partial: Partial<OrderFile> & Pick<OrderFile, "id" | "kind">): OrderFile {
  return {
    name: "a.jpg",
    mime: "image/jpeg",
    size: 10,
    status: "complete",
    storage: "local",
    path: "data/uploads/a",
    driveFileId: null,
    createdAt: new Date().toISOString(),
    deletedAt: null,
    ...partial,
  };
}

function order(partial: Partial<Order> & Pick<Order, "id" | "code">): Order {
  return {
    channel: "facebook",
    source: "manual",
    customerId: "c",
    status: "nhan_don",
    fulfillment: "pickup",
    address: "",
    customerNote: "",
    internalNote: "ghi chú",
    dueDate: null,
    marketplaceCode: "",
    items: [
      {
        id: "line",
        skuId: "EG-13x18-C1",
        name: "13×18",
        skuCode: "EG-13x18-C1",
        quantity: 1,
        unitPrice: 249000,
        lineTotal: 249000,
      },
    ],
    subtotal: 249000,
    total: 249000,
    depositRequired: 150000,
    depositPaid: 0,
    depositMethod: "ck",
    depositBy: null,
    printDeducted: false,
    packDeducted: false,
    stockWarning: "",
    accessTokenHash: "",
    accessToken: "",
    idempotencyKey: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null,
    files: [],
    history: [],
    ...partial,
  };
}

test("sale và sản xuất không nhận giá vốn, lãi, doanh thu", async () => {
  const state = await buildSeed();
  state.orders.push(order({ id: "o1", code: "TT-1", channel: "tai_tiem", total: 249000 }));
  const sale = visibleToRole("sale", buildDashboard(state, { id: "staff-sale", name: "Sale", role: "sale" }));
  assert.deepEqual(moneyLeaks("sale", sale), []);
  assert.equal("revenueToday" in sale, false);
  assert.equal("profit" in sale, false);
  assert.equal(typeof sale.commission, "number");
  const detail = visibleToRole("production", orderDetail(state, state.orders[0]!, "production"));
  assert.deepEqual(moneyLeaks("production", detail), []);
  assert.equal("total" in detail, false);
  assert.equal("unitPrice" in detail.items[0]!, false);
  assert.equal("listUnitPrice" in detail.items[0]!, false);
  assert.equal("depositRequired" in detail, false);
  assert.equal("depositPaid" in detail, false);
  const stock = visibleToRole("sale", inventoryView(state, "sale"));
  assert.deepEqual(moneyLeaks("sale", stock), []);
  assert.equal("packPrice" in stock.materials[0]!, false);
  const owner = buildDashboard(state, { id: "staff-owner", name: "Chủ", role: "owner" });
  assert.equal(typeof owner.revenueToday, "number");
  assert.equal(moneyLeaks("owner", owner).length, 0);
});

test("trừ kho một lần và hoàn khi lùi bước", async () => {
  const state = await buildSeed();
  const wood = state.materials.find((row) => row.id === "go-13x18");
  const bag = state.materials.find((row) => row.id === "tui");
  assert.ok(wood && bag);
  wood.stock = 10;
  bag.stock = 10;
  const row = order({ id: "o2", code: "TT-2", channel: "tai_tiem", fulfillment: "pickup" });
  state.orders.push(row);
  syncOrderStock(state, row, "in", "staff");
  assert.equal(wood.stock, 9);
  assert.equal(bag.stock, 10);
  syncOrderStock(state, row, "in", "staff");
  assert.equal(wood.stock, 9);
  syncOrderStock(state, row, "giao", "staff");
  assert.equal(bag.stock, 9);
  syncOrderStock(state, row, "giao", "staff");
  assert.equal(bag.stock, 9);
  syncOrderStock(state, row, "nhan_don", "staff");
  assert.equal(wood.stock, 10);
  assert.equal(bag.stock, 10);
  assert.equal(row.printDeducted, false);
  assert.equal(row.packDeducted, false);
});

test("combo đắt hơn trên mỗi tấm thì cảnh báo, bằng nhau thì được", () => {
  assert.equal(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 2, price: 200000 }]), null);
  assert.match(comboPriceError([{ sheets: 1, price: 100000 }, { sheets: 4, price: 500000 }]) ?? "", /Combo 4/);
  const warnings = comboWarnings(
    [
      { id: "a", groupId: "ep_go", size: "13x18", sheets: 1, code: "EG-13x18-C1" },
      { id: "b", groupId: "ep_go", size: "13x18", sheets: 4, code: "EG-13x18-C4" },
    ],
    [
      { skuId: "a", channel: "tai_tiem", price: 100000 },
      { skuId: "b", channel: "tai_tiem", price: 500000 },
    ],
    "tai_tiem",
  );
  assert.equal(warnings.length, 1);
  assert.match(warnings[0]!, /13x18/);
});

test("cọc Facebook chặn thiết kế và in, chủ được ghi đè", () => {
  const base = { settings: DEFAULT_SETTINGS, channel: "facebook" as const };
  assert.equal(depositFor({ ...base, total: null, items: [{ size: "40x60" }] }), null);
  assert.equal(depositFor({ ...base, total: null, items: [{ size: "13x18" }] }), 0);
  assert.equal(depositFor({ ...base, total: 299999, items: [{ size: "13x18" }] }), 0);
  assert.equal(depositFor({ ...base, total: 300000, items: [{ size: "13x18" }] }), 150000);
  assert.equal(depositBlocks("nhan_don", null, 0), false);
  assert.equal(depositBlocks("thiet_ke", null, 0), true);
  assert.equal(depositBlocks("in", null, 0), true);
  assert.equal(depositBlocks("xong", 150000, 0), true);
  assert.equal(depositBlocks("in", 150000, 150000), false);
  assert.equal(depositBlocks("in", 0, 0), false);
  assert.match(
    statusChangeError({ role: "sale", ownerOverride: false, next: "thiet_ke", depositRequired: null, depositPaid: 0 }) ?? "",
    /chưa có giá/,
  );
  assert.equal(
    statusChangeError({ role: "owner", ownerOverride: true, next: "in", depositRequired: null, depositPaid: 0 }),
    null,
  );
  assert.equal(
    statusChangeError({ role: "sale", ownerOverride: false, next: "in", depositRequired: 0, depositPaid: 0 }),
    null,
  );
  assert.match(
    statusChangeError({ role: "production", ownerOverride: false, next: "xong", depositRequired: 0, depositPaid: 0 }) ?? "",
    /Sản xuất/,
  );
});

test("hai lần ghi cùng lúc không mất dữ liệu", async () => {
  let doc = { version: 1, n: 0 };
  let readers = 0;
  let release: () => void = () => undefined;
  const bothRead = new Promise<void>((resolve) => {
    release = resolve;
  });
  const read = async () => {
    const snap = structuredClone(doc);
    readers += 1;
    if (readers >= 2) release();
    await bothRead;
    return snap;
  };
  const write = async (next: { version: number; n: number }, expected: number) => {
    if (doc.version !== expected) return false;
    doc = next;
    return true;
  };
  await Promise.all([
    commitLoop({ read, write, run: (draft) => { draft.n += 1; } }),
    commitLoop({ read, write, run: (draft) => { draft.n += 1; } }),
  ]);
  assert.equal(doc.n, 2);
  assert.equal(doc.version, 3);
});

test("ảnh gốc xoá sau khi đơn xong đủ số ngày, video theo ngày tải lên", async () => {
  const state = await buildSeed();
  const now = Date.now();
  const day = 86400000;
  state.orders.push(
    order({
      id: "done",
      code: "TT-D",
      status: "xong",
      completedAt: new Date(now - 181 * day).toISOString(),
      files: [file({ id: "old", kind: "original", createdAt: new Date(now - 200 * day).toISOString() })],
    }),
    order({
      id: "fresh",
      code: "TT-F",
      status: "xong",
      completedAt: new Date(now - 10 * day).toISOString(),
      files: [file({ id: "new", kind: "original" })],
    }),
    order({
      id: "open",
      code: "TT-O",
      status: "in",
      files: [file({ id: "busy", kind: "original", createdAt: new Date(now - 400 * day).toISOString() })],
    }),
    order({
      id: "vid",
      code: "TT-V",
      status: "giao",
      files: [file({ id: "video", kind: "packing_video", createdAt: new Date(now - 31 * day).toISOString() })],
    }),
  );
  const due = filesToPurge(state, now).map((row) => row.fileId).sort();
  assert.deepEqual(due, ["old", "video"]);
});

test("server không import filesystem ở đầu file và luôn lọc theo vai trò", () => {
  const service = readFileSync(new URL("../server/service.ts", import.meta.url), "utf8");
  const store = readFileSync(new URL("../server/store.ts", import.meta.url), "utf8");
  assert.doesNotMatch(service, /^import\s.+from\s+["']node:fs/m);
  assert.doesNotMatch(store, /^import\s.+from\s+["']node:fs/m);
  assert.ok((service.match(/visibleToRole\(/g) ?? []).length >= 7);
  assert.match(service, /upload:\$\{file\.id\}/);
  assert.match(store, /shop_state/);
  const upload = readFileSync(new URL("../routes/dat-in.tsx", import.meta.url), "utf8");
  assert.doesNotMatch(upload, /supabase/);
  const start = readFileSync(new URL("../start.ts", import.meta.url), "utf8");
  assert.doesNotMatch(start, /supabase/);
});
