import assert from "node:assert/strict";
import test from "node:test";

import { DEFAULT_ROLE_MODULES, ensureOrgCollections, modulesForStoredRole, sortBySortThenName } from "./org-desk.ts";

test("ensureOrgCollections seed roleModules / sepay / packages", () => {
  const state = { settings: {} } as {
    settings: {
      sepay?: { enabled: boolean; apiKey: string; accountHint: string; webhookPath: string; note: string };
      notifyPrefs?: { lateOrders: boolean; marketplaceNew: boolean; feedbackReprint: boolean; cashHandover: boolean };
    };
    roleModules?: { role: "owner" | "sale" | "production"; modules: string[] }[];
    packages?: unknown[];
    sepaySeen?: string[];
  };
  assert.equal(ensureOrgCollections(state), true);
  assert.ok(state.settings.sepay);
  assert.equal(typeof state.settings.sepay?.apiKey, "string");
  assert.ok(state.settings.notifyPrefs);
  assert.deepEqual(state.packages, []);
  assert.equal(state.roleModules?.length, 3);
  assert.equal(ensureOrgCollections(state), false);
});

test("ensureOrgCollections gỡ path menu cũ và rename tin-mau", () => {
  const state = {
    settings: {
      sepay: { enabled: false, apiKey: "", accountHint: "", webhookPath: "/api/public/sepay", note: "" },
      notifyPrefs: { lateOrders: true, marketplaceNew: true, feedbackReprint: true, cashHandover: true },
    },
    roleModules: [
      { role: "owner" as const, modules: ["/admin", "/admin/chi-nhanh", "/admin/tin-mau"] },
      { role: "sale" as const, modules: ["/admin"] },
      { role: "production" as const, modules: ["/admin"] },
    ],
    packages: [],
    sepaySeen: [],
  };
  assert.equal(ensureOrgCollections(state), true);
  const owner = state.roleModules.find((r) => r.role === "owner")?.modules ?? [];
  assert.ok(!owner.includes("/admin/chi-nhanh"));
  assert.ok(!owner.includes("/admin/tin-mau"));
  assert.ok(owner.includes("/admin/studio/tin-mau"));
  assert.equal(ensureOrgCollections(state), false);
});

test("modulesForStoredRole trả null khi thiếu hoặc rỗng", () => {
  assert.equal(modulesForStoredRole("sale", undefined), null);
  assert.equal(modulesForStoredRole("sale", [{ role: "sale", modules: [] }]), null);
  assert.deepEqual(modulesForStoredRole("owner", DEFAULT_ROLE_MODULES)?.[0], "/admin");
});

test("sortBySortThenName ổn định", () => {
  const rows = sortBySortThenName([
    { sort: 2, name: "B" },
    { sort: 1, name: "A" },
    { sort: 1, name: "C" },
  ]);
  assert.deepEqual(
    rows.map((r) => r.name),
    ["A", "C", "B"],
  );
});
