import assert from "node:assert/strict";
import test from "node:test";

import {
  DEFAULT_ROLE_MODULES,
  defaultBranches,
  defaultDepartments,
  ensureOrgCollections,
  modulesForStoredRole,
  sortBySortThenName,
} from "./org-desk.ts";

test("ensureOrgCollections seed cửa hàng / bộ phận / roleModules / sepay", () => {
  const state = {
    settings: {},
  } as {
    settings: { sepay?: { enabled: boolean; accountHint: string; webhookPath: string; note: string } };
    branches?: ReturnType<typeof defaultBranches>;
    departments?: ReturnType<typeof defaultDepartments>;
    roleModules?: typeof DEFAULT_ROLE_MODULES;
    announcements?: unknown[];
    documents?: unknown[];
  };
  assert.equal(ensureOrgCollections(state), true);
  assert.equal(state.branches?.length, 1);
  assert.equal(state.departments?.length, 3);
  assert.equal(state.roleModules?.length, 3);
  assert.ok(state.settings.sepay);
  assert.deepEqual(state.announcements, []);
  assert.deepEqual(state.documents, []);
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
