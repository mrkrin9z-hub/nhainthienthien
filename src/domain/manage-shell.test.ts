import assert from "node:assert/strict";
import test from "node:test";

import { STUDIO_BRIDGES } from "../admin-os/bridges.ts";
import { ADMIN_MODULE_GROUPS, MANAGE_SKIP, modulesForRole } from "../admin-os/modules.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import type { RoleModules, Settings } from "./types.ts";

test("menu phẳng có Hình ảnh và Media mở rộng trên slide", () => {
  const titles = ADMIN_MODULE_GROUPS.map((group) => group.title);
  assert.deepEqual(titles, ["Tổng quan", "Đơn hàng", "Hình ảnh", "Media", "Sản xuất", "Sản phẩm", "Kho vật tư", "Thống kê báo cáo", "Thống kê khách hàng", "Nhân sự", "Cài đặt"]);
  const media = ADMIN_MODULE_GROUPS.find((group) => group.title === "Media");
  assert.ok(media);
  assert.deepEqual(
    media.items.map((item) => item.label),
    ["Kho source", "Feedback"],
  );
  assert.deepEqual(
    media.items.map((item) => item.to),
    ["/admin/media", "/admin/feedback-gia"],
  );
  assert.deepEqual(media.items[0]?.search, { m: "drive" });
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  assert.equal(paths.includes("/admin/in-don"), false);
  assert.equal(paths.includes("/admin/giao-hang"), false);
  assert.deepEqual([...MANAGE_SKIP].sort(), ["/manage/garments", "/manage/tools"].sort());
});

test("không còn bridge StudioBase; menu không kéo trang phụ", () => {
  const paths = ADMIN_MODULE_GROUPS.flatMap((group) => group.items).map((item) => item.to);
  for (const hidden of [
    "/admin/chien-dich",
    "/admin/chi-nhanh",
    "/admin/bo-phan",
    "/admin/studio/tin-mau",
    "/admin/tin-mau",
    "/admin/goi",
    "/admin/sepay",
    "/admin/danh-gia",
    "/admin/nhac-khach",
    "/admin/cong-viec",
    "/admin/chat",
    "/admin/lich",
    "/admin/in-don",
    "/admin/chuyen-nop",
    "/admin/duyet-chi",
  ]) {
    assert.equal(paths.includes(hidden), false, hidden);
  }
  assert.deepEqual(STUDIO_BRIDGES, {});
  const modes = ADMIN_MODULE_GROUPS.flatMap((g) => g.items).map((i) => i.mode);
  assert.ok(modes.every((mode) => mode === "live" || mode === undefined));
  assert.ok(!modes.includes("bridge" as never));
});

test("modulesForRole tôn trọng role và danh sách allowed", () => {
  const sale = modulesForRole("sale").flatMap((g) => g.items).map((i) => i.label);
  assert.deepEqual(sale, ["Tổng quan", "Đơn hàng", "Hình ảnh", "Kho source", "Feedback", "Quản lý sản phẩm", "Kho vật tư", "Thống kê khách hàng", "Nhân sự"]);
  const production = modulesForRole("production").flatMap((g) => g.items).map((i) => i.label);
  assert.deepEqual(production, ["Tổng quan", "Đơn hàng", "Hình ảnh", "Kho source", "Sản xuất", "Kho vật tư", "Nhân sự"]);
  const trimmed = modulesForRole("sale", ["/admin/don-hang", "/admin/san-pham"]).flatMap((g) => g.items).map((i) => i.to);
  assert.deepEqual(trimmed, ["/admin/don-hang", "/admin/san-pham"]);
});

test("owner thấy đủ mục kể cả Hình ảnh và Feedback; không thấy SePay, gói hay chat trên menu", () => {
  const owner = modulesForRole("owner").flatMap((group) => group.items).map((item) => item.to);
  assert.deepEqual(owner, [
    "/admin",
    "/admin/don-hang",
    "/admin/album",
    "/admin/media",
    "/admin/feedback-gia",
    "/admin/san-xuat",
    "/admin/san-pham",
    "/admin/kho",
    "/admin/bao-cao",
    "/admin/khach",
    "/admin/viec",
    "/admin/cai-dat",
  ]);
  assert.equal(owner.includes("/admin/thu"), false);
  assert.equal(owner.includes("/admin/sepay"), false);
  assert.equal(owner.includes("/admin/goi"), false);
  assert.equal(owner.includes("/admin/danh-gia"), false);
  assert.equal(owner.includes("/admin/thong-bao"), false);
  assert.equal(owner.includes("/admin/tin-mau"), false);
});

test("migration gắn Media vào roleModules sổ cũ một lần", () => {
  const roleModules: RoleModules[] = [
    { role: "owner", modules: ["/admin", "/admin/album"] },
    { role: "sale", modules: ["/admin", "/admin/album"] },
    { role: "production", modules: ["/admin", "/admin/album"] },
  ];
  const state = {
    settings: {
      zaloDefaultMigrated: true,
      mediaMenu20261117: false,
      menuLinks20261022: true,
      taskMenu20261023: true,
      catalogImport20261022: true,
      hrApproved20261022: true,
      orderDesk20261024: true,
      deskBom20261023: true,
      groupSupply20261024: true,
      inkMl20261024: true,
      inkExpense20261024: true,
      checklist20261023: true,
      fixedCosts: [{ key: "x", label: "x", amount: 1 }],
    } as unknown as Settings,
    roleModules,
    groups: [],
    skus: [],
    prices: [],
    materials: [],
    boms: [],
    orders: [],
    staff: [],
  };
  assert.equal(applyStoreMigrations(state), true);
  assert.equal(state.settings.mediaMenu20261117, true);
  assert.ok(roleModules[0]!.modules.includes("/admin/media"));
  assert.ok(roleModules[0]!.modules.includes("/admin/feedback-gia"));
  assert.ok(roleModules[1]!.modules.includes("/admin/feedback-gia"));
  assert.ok(roleModules[2]!.modules.includes("/admin/media"));
  assert.equal(roleModules[2]!.modules.includes("/admin/feedback-gia"), false);
  // Chạy lại không gắn trùng.
  const before = roleModules[0]!.modules.filter((path) => path === "/admin/media").length;
  applyStoreMigrations(state);
  assert.equal(roleModules[0]!.modules.filter((path) => path === "/admin/media").length, before);
});

test("migration gắn Quản lý trang chủ và Ảnh sản phẩm vào menu một lần", () => {
  const roleModules: RoleModules[] = [
    { role: "owner", modules: ["/admin", "/admin/gia"] },
    { role: "sale", modules: ["/admin", "/admin/gia"] },
    { role: "production", modules: ["/admin"] },
  ];
  const state = {
    settings: {
      zaloDefaultMigrated: true,
      mediaMenu20261117: true,
      homepageMenu20261124: false,
      menuLinks20261022: true,
      taskMenu20261023: true,
      catalogImport20261022: true,
      hrApproved20261022: true,
      orderDesk20261024: true,
      deskBom20261023: true,
      groupSupply20261024: true,
      inkMl20261024: true,
      inkExpense20261024: true,
      checklist20261023: true,
      fixedCosts: [{ key: "x", label: "x", amount: 1 }],
    } as unknown as Settings,
    roleModules,
    groups: [],
    skus: [],
    prices: [],
    materials: [],
    boms: [],
    orders: [],
    staff: [],
  };
  assert.equal(applyStoreMigrations(state), true);
  assert.equal(state.settings.homepageMenu20261124, true);
  for (const path of ["/admin/trang-chu", "/admin/san-pham", "/admin/gia", "/admin/anh"]) {
    assert.ok(roleModules[0]!.modules.includes(path), path);
    assert.ok(roleModules[1]!.modules.includes(path), path);
  }
  assert.equal(roleModules[2]!.modules.includes("/admin/trang-chu"), false);
  applyStoreMigrations(state);
  assert.equal(roleModules[0]!.modules.filter((path) => path === "/admin/trang-chu").length, 1);
});
