import assert from "node:assert/strict";
import test from "node:test";

import { orderKindFolder } from "./drive-path.ts";
import { applyStoreMigrations } from "./migrate-shop.ts";
import { buildSeed } from "./seed.ts";
import { CHECKLIST_TEMPLATES } from "./checklist-catalog.ts";
import {
  applyTaskStatus,
  checklistBadge,
  checklistCards,
  deskAssignee,
  ensureChecklistTasks,
  needsProof,
  orderStepKind,
  SHEET_COVERAGE,
  taskFolderParts,
  taskGroupFolder,
  weekKey,
} from "./checklists.ts";

test("sheet checklist đủ việc và không mang câu hứa ra app", async () => {
  const count = (list: string) => CHECKLIST_TEMPLATES.filter((item) => item.list === list).length;
  assert.equal(count("setup"), 56);
  assert.equal(count("anh"), 73);
  assert.equal(count("sale_ngay"), 19);
  assert.equal(count("sale_tuan"), 9);
  assert.equal(count("chot"), 24);
  assert.equal(count("sop"), 7);
  assert.ok(count("khai_truong") >= 70);
  assert.equal(count("dao_tao"), 10);
  const blob = JSON.stringify(CHECKLIST_TEMPLATES);
  assert.doesNotMatch(blob, /miễn phí|tặng quà|tặng 1/i);
  assert.equal(CHECKLIST_TEMPLATES.find((item) => item.id === "anh-chup-nct")?.link, "https://drive.google.com/file/d/10s9AdkzMF9zLqZqLSwCBrRUyodvnm2Is/view");
  assert.equal(CHECKLIST_TEMPLATES.find((item) => item.id === "anh-video-nct")?.link, "https://drive.google.com/file/d/1F6cDFHSLaOw3F3PRZ6CFB0kxYXF29FGQ/view");
  assert.equal(CHECKLIST_TEMPLATES.find((item) => item.id === "anh-16")?.sheetStatus, "xong");
  assert.equal(CHECKLIST_TEMPLATES.filter((item) => item.section === "Cần chụp").length, 10);
  assert.equal(CHECKLIST_TEMPLATES.filter((item) => item.section === "Quay video").length, 9);
  assert.ok(CHECKLIST_TEMPLATES.filter((item) => item.list === "khai_truong" && item.link).length >= 20);
  assert.ok(CHECKLIST_TEMPLATES.filter((item) => item.list === "sale_ngay").every((item) => item.draft));
  assert.match(CHECKLIST_TEMPLATES.find((item) => item.id === "ngay-1")?.detail ?? "", /chưa duyệt/);
  const seeded = await buildSeed();
  assert.equal(applyStoreMigrations(seeded), false);
  assert.equal(seeded.tasks?.length, CHECKLIST_TEMPLATES.filter((item) => item.repeat === "once").length);
  const bare = { settings: { zaloDefaultMigrated: true, groupListed: {} } };
  assert.equal(ensureChecklistTasks(bare), false);
});

test("việc lặp theo ngày và ảnh đơn theo bước", () => {
  const state = { tasks: [], taskChecks: [] };
  const ymd = "2026-10-23";
  const cards = checklistCards(state, ymd);
  const morning = cards.find((card) => card.id === "sop-1");
  assert.equal(morning?.status, "chua_lam");
  assert.equal(morning?.repeat, "daily");
  applyTaskStatus(state, { taskId: "sop-1", status: "xong", by: "sale", ymd, at: "2026-10-23T01:00:00.000Z" });
  assert.equal(checklistCards(state, ymd).find((card) => card.id === "sop-1")?.status, "xong");
  assert.equal(checklistCards(state, "2026-10-24").find((card) => card.id === "sop-1")?.status, "chua_lam");
  assert.equal(weekKey("2026-10-23"), weekKey("2026-10-19"));
  assert.notEqual(weekKey("2026-10-23"), weekKey("2026-10-26"));
  const open = checklistBadge({ tasks: state.tasks, taskChecks: state.taskChecks }, ymd);
  assert.ok(open > 20);
  assert.equal(orderKindFolder("original"), "1-anh-goc");
  assert.equal(orderKindFolder("design"), "2-ban-sua");
  assert.equal(orderKindFolder("approval"), "4-duyet-va-video");
  assert.equal(orderKindFolder("packing_photo"), "4-duyet-va-video");
  assert.deepEqual(taskFolderParts("Setup kệ", "Lau kệ"), ["Việc tiệm", "Setup kệ", "Lau kệ"]);
  assert.equal(orderStepKind("duyet"), "approval");
  assert.equal(orderStepKind("goi"), "packing_photo");
  assert.equal(orderStepKind("thiet-ke"), "design");
  assert.equal(orderStepKind("anh"), "original");
  assert.ok(SHEET_COVERAGE.some((row) => row.sheet.includes("setup tiệm") && row.gap === ""));
  assert.ok(SHEET_COVERAGE.some((row) => row.gap.length > 0));
});

test("việc giao Admin Sale Sản xuất và chỉ việc nhìn thấy mới cần ảnh", () => {
  const once = CHECKLIST_TEMPLATES.filter((item) => item.repeat === "once");
  assert.equal(once.length, 241);
  assert.ok(once.filter((item) => item.role === "owner").every((item) => deskAssignee(item) === "admin"));
  assert.ok(CHECKLIST_TEMPLATES.filter((item) => item.role === "sale").every((item) => deskAssignee(item) === "sale"));
  assert.ok(CHECKLIST_TEMPLATES.filter((item) => item.role === "production").every((item) => deskAssignee(item) === "production"));
  const shoot = CHECKLIST_TEMPLATES.find((item) => item.section === "Cần chụp");
  assert.ok(shoot);
  assert.equal(needsProof(shoot), true);
  assert.equal(deskAssignee(shoot), "production");
  assert.equal(taskGroupFolder(shoot), "Cần chụp");
  const invoice = CHECKLIST_TEMPLATES.find((item) => item.title.startsWith("Câu 1:"));
  assert.equal(invoice && needsProof(invoice), false);
  const noPhoto = CHECKLIST_TEMPLATES.find((item) => item.title.includes("Không cần chụp"));
  assert.equal(noPhoto && needsProof(noPhoto), false);
  const shelf = CHECKLIST_TEMPLATES.find((item) => item.title.includes("Kệ trưng bày"));
  assert.equal(shelf && needsProof(shelf), true);
  assert.equal(shelf && taskGroupFolder(shelf), "Setup kệ");
  const proof = CHECKLIST_TEMPLATES.filter(needsProof);
  assert.ok(proof.length > 20 && proof.length < 120);
  const cards = checklistCards({ tasks: [], taskChecks: [] }, "2026-10-24");
  assert.equal(cards.find((card) => card.id === shoot.id)?.driveFolder.startsWith("Việc tiệm / Cần chụp / "), true);
  assert.equal(cards.find((card) => card.id === "setup-1-1")?.assignee, "admin");
});
