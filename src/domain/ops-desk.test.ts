import assert from "node:assert/strict";
import test from "node:test";

import {
  formatVnDay,
  groupOrdersByDay,
  groupOrdersByTaskColumn,
  opsCalendarDay,
  opsIsOpenStatus,
  shiftMonth,
} from "./ops-desk.ts";

test("ngày lịch ưu tiên hẹn giao, không thì ngày tạo VN", () => {
  assert.equal(opsCalendarDay({ dueDate: "2026-10-25", createdAt: "2026-10-01T03:00:00.000Z" }), "2026-10-25");
  assert.equal(opsCalendarDay({ dueDate: "  ", createdAt: "2026-10-20T17:00:00.000Z" }), "2026-10-21");
  assert.equal(opsCalendarDay({ dueDate: null, createdAt: "2026-10-20T17:00:00.000Z" }), "2026-10-21");
});

test("gom đơn theo ngày trong tháng và cột công việc", () => {
  const orders = [
    {
      id: "1",
      code: "TT260101-002",
      status: "in",
      createdAt: "2026-10-01T01:00:00.000Z",
      dueDate: "2026-10-05",
      customerName: "A",
      itemSummary: "Phóng",
    },
    {
      id: "2",
      code: "TT260101-001",
      status: "nhan_don",
      createdAt: "2026-10-04T10:00:00.000Z",
      dueDate: null,
      customerName: "B",
      itemSummary: "Khung",
    },
    {
      id: "3",
      code: "TT260101-003",
      status: "xong",
      createdAt: "2026-09-01T01:00:00.000Z",
      dueDate: "2026-09-10",
      customerName: "C",
      itemSummary: "Album",
    },
  ];
  const days = groupOrdersByDay(orders, "2026-10");
  assert.equal(days.length, 2);
  assert.equal(days[0]?.day, "2026-10-04");
  assert.equal(days[0]?.orders[0]?.code, "TT260101-001");
  assert.equal(days[1]?.day, "2026-10-05");
  assert.equal(days[1]?.orders[0]?.code, "TT260101-002");

  const cols = groupOrdersByTaskColumn(orders.filter((o) => opsIsOpenStatus(o.status)));
  assert.ok(cols.find((c) => c.id === "in")?.orders.some((o) => o.code === "TT260101-002"));
  assert.ok(cols.find((c) => c.id === "nhan_don")?.orders.length === 1);
  assert.ok(!opsIsOpenStatus("xong"));
});

test("đổi tháng và format ngày VN", () => {
  assert.equal(shiftMonth("2026-01", -1), "2025-12");
  assert.equal(shiftMonth("2026-12", 1), "2027-01");
  assert.match(formatVnDay("2026-10-25"), /25/);
});
