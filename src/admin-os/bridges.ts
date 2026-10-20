/**
 * Module chưa có API Partner / chưa port local — hiện bridge trong shell
 * (deep-link StudioBase Manage hoặc “đang kết nối”).
 * Không gồm garment / AI tools (studio-chụp).
 */
export type BridgePhase = 2 | 3 | 4;

export type StudioBridge = {
  slug: string;
  label: string;
  managePath: string;
  phase: BridgePhase;
  blurb: string;
};

export const STUDIO_BRIDGES: Record<string, StudioBridge> = {
  lich: {
    slug: "lich",
    label: "Lịch nhận / hẹn in",
    managePath: "/manage/calendar",
    phase: 2,
    blurb: "Lịch theo ngày nhận ảnh, hẹn in và giao — đổi nhãn từ “Ngày chụp”.",
  },
  "cong-viec": {
    slug: "cong-viec",
    label: "Công việc",
    managePath: "/manage/tasks",
    phase: 2,
    blurb: "Checklist đơn: nhận file → xử lý → in → giao.",
  },
  "chien-dich": {
    slug: "chien-dich",
    label: "Chiến dịch",
    managePath: "/manage/campaigns",
    phase: 4,
    blurb: "Nguồn / chiến dịch ads (tuỳ chọn).",
  },
  "nhom-quyen": {
    slug: "nhom-quyen",
    label: "Nhóm quyền",
    managePath: "/manage/settings/roles",
    phase: 2,
    blurb: "Role + matrix quyền module (Staff Mode).",
  },
  "bo-phan": {
    slug: "bo-phan",
    label: "Bộ phận",
    managePath: "/manage/settings/departments",
    phase: 2,
    blurb: "Sale / In ấn / Giao nhận…",
  },
  "chi-nhanh": {
    slug: "chi-nhanh",
    label: "Cửa hàng / chi nhánh",
    managePath: "/manage/settings/branches",
    phase: 2,
    blurb: "Cơ sở in — filter đơn/ví theo chi nhánh.",
  },
  "muc-tieu": {
    slug: "muc-tieu",
    label: "Mục tiêu KPI",
    managePath: "/manage/settings/targets",
    phase: 3,
    blurb: "KPI cửa hàng / nhân viên.",
  },
  sepay: {
    slug: "sepay",
    label: "SePay",
    managePath: "/manage/settings/sepay",
    phase: 3,
    blurb: "Biến động số dư → ví cửa hàng.",
  },
  "thong-bao": {
    slug: "thong-bao",
    label: "Thông báo đẩy",
    managePath: "/manage/settings/notifications",
    phase: 4,
    blurb: "Web Push / PWA.",
  },
  "tin-mau": {
    slug: "tin-mau",
    label: "Tin mẫu & kênh chat",
    managePath: "/manage/messages/settings",
    phase: 4,
    blurb: "Nối Fanpage/Zalo, tin mẫu, auto-reply — OAuth trên StudioBase.",
  },
  "danh-gia": {
    slug: "danh-gia",
    label: "Đánh giá sau giao",
    managePath: "/manage/order-feedback",
    phase: 4,
    blurb: "Feedback khách sau khi giao in.",
  },
  goi: {
    slug: "goi",
    label: "Gói dịch vụ",
    managePath: "/manage/subscription",
    phase: 4,
    blurb: "Gói StudioBase của owner.",
  },
  "huong-dan": {
    slug: "huong-dan",
    label: "Hướng dẫn",
    managePath: "/manage/guide",
    phase: 4,
    blurb: "Tài liệu vận hành.",
  },
  "thong-bao-noi-bo": {
    slug: "thong-bao-noi-bo",
    label: "Thông báo nội bộ",
    managePath: "/manage/announcements",
    phase: 4,
    blurb: "Announcements nội bộ.",
  },
  "tai-lieu": {
    slug: "tai-lieu",
    label: "Tài liệu",
    managePath: "/manage/documents",
    phase: 4,
    blurb: "Kho tài liệu nội bộ.",
  },
};

/** Origin Manage (deep-link). Có thể đổi qua VITE_STUDIOBASE_MANAGE_ORIGIN lúc build. */
export const STUDIOBASE_MANAGE_ORIGIN =
  (typeof import.meta !== "undefined" &&
    (import.meta as ImportMeta & { env?: { VITE_STUDIOBASE_MANAGE_ORIGIN?: string } }).env?.VITE_STUDIOBASE_MANAGE_ORIGIN?.replace(
      /\/$/,
      "",
    )) ||
  "https://studiobase.vn";

export function studioManageUrl(managePath: string): string {
  const path = managePath.startsWith("/") ? managePath : `/${managePath}`;
  return `${STUDIOBASE_MANAGE_ORIGIN}${path}`;
}
