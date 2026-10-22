/**
 * Hub Cài đặt — nút truy cập phân nhóm (tham khảo StudioBase Manage settings).
 * Kênh cửa hàng + cài đặt chi phí (giá vốn) nằm trong hub; module khác deep-link trang sẵn có.
 */

export type SettingsHubCard = {
  id: string;
  title: string;
  blurb: string;
  /** Path nội bộ hub (?m=) hoặc path tuyệt đối /admin/... */
  to: string;
  search?: { m: string };
  icon: "store" | "channels" | "bell" | "cost" | "target" | "wallet" | "plug" | "backup" | "roles" | "salary" | "ops" | "files";
};

export type SettingsHubGroup = {
  title: string;
  cards: SettingsHubCard[];
};

export const SETTINGS_HUB_GROUPS: SettingsHubGroup[] = [
  {
    title: "Cấu hình vận hành",
    cards: [
      {
        id: "cua-hang",
        title: "Thông tin cửa hàng",
        blurb: "Zalo, giờ mở cửa, giờ ca, sản phẩm hiện trên web, tài khoản nhận CK.",
        to: "/admin/cai-dat",
        search: { m: "cua-hang" },
        icon: "store",
      },
      {
        id: "kenh",
        title: "Kênh cửa hàng",
        blurb: "Bật/tắt và đặt tên kênh bán của Nhà In Thiên Thiên (tại tiệm, Facebook, TikTok, Shopee).",
        to: "/admin/cai-dat",
        search: { m: "kenh" },
        icon: "channels",
      },
      {
        id: "thong-bao",
        title: "Thông báo đẩy",
        blurb: "Bật thông báo trên máy tính / PWA khi có đơn trễ, sàn mới…",
        to: "/admin/thong-bao",
        icon: "bell",
      },
      {
        id: "van-hanh",
        title: "Số liệu vận hành",
        blurb: "Cọc đơn, hòa vốn, định mức kho, giữ ảnh, nhắc khách.",
        to: "/admin/cai-dat",
        search: { m: "van-hanh" },
        icon: "ops",
      },
    ],
  },
  {
    title: "Tài chính & thanh toán",
    cards: [
      {
        id: "chi-phi",
        title: "Cài đặt chi phí",
        blurb: "Giá vốn (mực, hao hụt, ngưỡng lãi) và phí sàn theo kênh.",
        to: "/admin/cai-dat",
        search: { m: "chi-phi" },
        icon: "cost",
      },
      {
        id: "muc-tieu",
        title: "Mục tiêu",
        blurb: "KPI / mục tiêu doanh thu cửa hàng và nhân viên.",
        to: "/admin/muc-tieu",
        icon: "target",
      },
      {
        id: "sepay",
        title: "Kết nối SePay",
        blurb: "Biến động số dư ngân hàng → tự ghi thu vào ví cửa hàng.",
        to: "/admin/sepay",
        icon: "wallet",
      },
      {
        id: "luong",
        title: "Lương và công",
        blurb: "Lương cứng, thử việc, ân hạn và mức trừ đi trễ / vắng.",
        to: "/admin/cai-dat",
        search: { m: "luong" },
        icon: "salary",
      },
    ],
  },
  {
    title: "Kết nối & tích hợp",
    cards: [
      {
        id: "ket-noi",
        title: "Kết nối",
        blurb: "Google Drive, Fanpage Nhà In, TikTok Shop, Shopee, đơn vị vận chuyển.",
        to: "/admin/ket-noi",
        icon: "plug",
      },
      {
        id: "sao-luu",
        title: "Sao lưu & khôi phục",
        blurb: "Sao lưu sổ hằng ngày và khôi phục khi cần.",
        to: "/admin/sao-luu",
        icon: "backup",
      },
    ],
  },
  {
    title: "Bảo mật & nhân sự",
    cards: [
      {
        id: "nhom-quyen",
        title: "Nhóm quyền",
        blurb: "Ẩn/hiện mục menu theo vai trò chủ / sale / sản xuất.",
        to: "/admin/nhom-quyen",
        icon: "roles",
      },
      {
        id: "nguoi-dung",
        title: "Người dùng",
        blurb: "Tài khoản nhân viên, đổi mật khẩu và phân quyền từng người.",
        to: "/admin/cai-dat",
        search: { m: "nguoi-dung" },
        icon: "roles",
      },
      {
        id: "tep",
        title: "Ảnh và nhật ký",
        blurb: "Ảnh đến hạn xóa và nhật ký sửa sổ.",
        to: "/admin/cai-dat",
        search: { m: "tep" },
        icon: "files",
      },
    ],
  },
];

export const SETTINGS_PANELS = ["chi-phi", "cua-hang", "kenh", "luong", "van-hanh", "nguoi-dung", "tep"] as const;
export type SettingsPanel = (typeof SETTINGS_PANELS)[number];

export function parseSettingsPanel(raw: unknown): SettingsPanel | null {
  if (typeof raw !== "string") return null;
  return (SETTINGS_PANELS as readonly string[]).includes(raw) ? (raw as SettingsPanel) : null;
}
