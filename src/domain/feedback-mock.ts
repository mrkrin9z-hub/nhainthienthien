export type FeedbackPlatform = "zalo" | "zalo_classic" | "messenger";

export type FeedbackSide = "customer" | "shop";

export type FeedbackLine =
  | { id: string; kind: "date"; text: string }
  | {
      id: string;
      kind: "text";
      side: FeedbackSide;
      text: string;
      time?: string;
      hearts?: number;
      showAvatar?: boolean;
    }
  | { id: string; kind: "sticker"; side: FeedbackSide; sticker: "thumb" | "1010"; hearts?: number }
  | {
      id: string;
      kind: "image";
      side: FeedbackSide;
      /** data: URL local — không upload server. */
      src: string;
      hearts?: number;
      showAvatar?: boolean;
    }
  | { id: string; kind: "status"; text: string };

export type FeedbackDraft = {
  platform: FeedbackPlatform;
  customerName: string;
  customerAvatar: string;
  statusText: string;
  stranger: boolean;
  /** Zalo classic: chip GỌI LẠI dưới header. */
  callbackBanner: boolean;
  showKeyboard: boolean;
  clock: string;
  battery: number;
  charging: boolean;
  unreadBadge: string;
  inputHint: string;
  lines: FeedbackLine[];
};

export type FeedbackTemplate = {
  id: string;
  label: string;
  draft: FeedbackDraft;
};

function nid(): string {
  return crypto.randomUUID();
}

export function newLineId(): string {
  return nid();
}

const shopThanks = [
  { id: "t1", kind: "text" as const, side: "shop" as const, text: "dạ em cảm ơn ạ" },
  { id: "t2", kind: "text" as const, side: "shop" as const, text: "có dịp ủng hộ tiệm em nhé ạ" },
];

export const FEEDBACK_TEMPLATES: FeedbackTemplate[] = [
  {
    id: "zalo-dep-lam",
    label: "Zalo · Ảnh đẹp lắm",
    draft: {
      platform: "zalo",
      customerName: "Dương Trang",
      customerAvatar: "",
      statusText: "vừa Đã xem lúc 20:03",
      stranger: false,
      callbackBanner: false,
      showKeyboard: true,
      clock: "20:03",
      battery: 20,
      charging: false,
      unreadBadge: "",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "d1", kind: "date", text: "Hôm nay" },
        {
          id: "s1",
          kind: "text",
          side: "shop",
          text: "dạ em cảm ơn chị nhiều ạ ❤️\ncó dịp ủng hộ tiệm em nhé ạ",
        },
        ...shopThanks.map((line, index) => ({ ...line, id: `s${index + 2}` })),
        { id: "st", kind: "status", text: "Đã gửi" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Chị nhận hình rồi quá xuất sắc hk nghĩ là nó to và đẹp vậy 👍👍",
          showAvatar: true,
        },
        { id: "c2", kind: "sticker", side: "customer", sticker: "thumb" },
      ],
    },
  },
  {
    id: "zalo-ung-lam",
    label: "Zalo · Ưng lắm",
    draft: {
      platform: "zalo",
      customerName: "Nguyễn Minh Tây",
      customerAvatar: "",
      statusText: "vừa Đã xem lúc 11:41",
      stranger: false,
      callbackBanner: false,
      showKeyboard: true,
      clock: "11:48",
      battery: 86,
      charging: false,
      unreadBadge: "2",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "c1", kind: "text", side: "customer", text: "Mấy ngày nhận d e", showAvatar: true },
        { id: "s1", kind: "text", side: "shop", text: "2-4 ngày" },
        { id: "d1", kind: "date", text: "Hôm nay" },
        { id: "c2", kind: "text", side: "customer", text: "C nhận d ảnh rồi", showAvatar: true },
        { id: "c3", kind: "text", side: "customer", text: "Ưng lắm e" },
        { id: "c4", kind: "sticker", side: "customer", sticker: "thumb" },
        { id: "s2", kind: "text", side: "shop", text: "Dạ em cảm ơn ạ" },
        { id: "s3", kind: "text", side: "shop", text: "Có dịp ủng hộ tiệm em nhé" },
        { id: "st", kind: "status", text: "Đã gửi" },
      ],
    },
  },
  {
    id: "zalo-dep-lun",
    label: "Zalo · Cực đẹp lun",
    draft: {
      platform: "zalo",
      customerName: "Thanh Huyền",
      customerAvatar: "",
      statusText: "vừa xem lúc 10:53",
      stranger: false,
      callbackBanner: false,
      showKeyboard: true,
      clock: "10:55",
      battery: 64,
      charging: false,
      unreadBadge: "",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "d1", kind: "date", text: "Hôm nay" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Nhận ảnh rồi e ơi cực đẹp lun 😍",
          showAvatar: true,
        },
        { id: "s1", kind: "text", side: "shop", text: "dạ em cảm ơn ạ" },
        { id: "s2", kind: "text", side: "shop", text: "có dịp ủng hộ tiệm em nhé ạ" },
        { id: "st", kind: "status", text: "Đã gửi" },
      ],
    },
  },
  {
    id: "zalo-10-10",
    label: "Zalo · Sticker 10/10",
    draft: {
      platform: "zalo",
      customerName: "Ngọc Ánh",
      customerAvatar: "",
      statusText: "vừa Đã xem lúc 16:09 hôm qua",
      stranger: false,
      callbackBanner: false,
      showKeyboard: false,
      clock: "08:41",
      battery: 43,
      charging: false,
      unreadBadge: "",
      inputHint: "Facebook: Tiệm Ảnh 1996-In Ảnh Giá Rẻ Theo Yêu Cầu",
      lines: [
        { id: "d0", kind: "date", text: "23 Sep 2026" },
        { id: "d1", kind: "date", text: "Hôm qua" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Thật sự ảnh quá đẹp rõ và sáng 😍",
          showAvatar: true,
          hearts: 1,
        },
        { id: "c2", kind: "text", side: "customer", text: "Em cảm ơn shop nhiều ạ ❤️", hearts: 1 },
        { id: "s1", kind: "text", side: "shop", text: "dạ em cảm ơn mình nhiều ạ", hearts: 1 },
        { id: "s2", kind: "text", side: "shop", text: "có dịp ủng hộ tiệm em nhé ạ" },
        { id: "st", kind: "status", text: "Đã gửi" },
        { id: "c3", kind: "sticker", side: "customer", sticker: "1010" },
      ],
    },
  },
  {
    id: "zalo-xuat-sac",
    label: "Zalo · Chuyên nghiệp",
    draft: {
      platform: "zalo_classic",
      customerName: "Dr Bear H Dim",
      customerAvatar: "",
      statusText: "Truy cập 35 phút trước",
      stranger: false,
      callbackBanner: true,
      showKeyboard: false,
      clock: "17:50",
      battery: 58,
      charging: false,
      unreadBadge: "",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "d1", kind: "date", text: "07:48 27/04/2026" },
        { id: "s1", kind: "text", side: "shop", text: "Em gửi rồi ạ", time: "07:48" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Dạ. Tiệm làm nhanh thật",
          time: "07:48",
          showAvatar: true,
          hearts: 1,
        },
        {
          id: "c2",
          kind: "text",
          side: "customer",
          text: "Mình nhận được hình hôm qua rồi nha ạ. Ảnh in đẹp, đúng thực tế, khung chắc chắn. Làm việc nhanh gọn lẹ và chuyên nghiệp quá ạ",
          time: "07:50",
          hearts: 4,
        },
        { id: "c3", kind: "text", side: "customer", text: "Cảm ơn Tiệm", time: "07:50", hearts: 1 },
        { id: "s2", kind: "text", side: "shop", text: "dạ em cảm ơn mình nhiều lắm ạ", time: "08:03" },
        { id: "s3", kind: "text", side: "shop", text: "có dịp ủng hộ tiệm em nhé ạ", time: "08:03" },
        { id: "c4", kind: "text", side: "customer", text: "Ok em nhé", time: "08:03", showAvatar: true },
      ],
    },
  },
  {
    id: "zalo-xinh-lam",
    label: "Zalo · Xinh lắm (header xanh)",
    draft: {
      platform: "zalo_classic",
      customerName: "Đào Ninh",
      customerAvatar: "",
      statusText: "Vừa mới truy cập",
      stranger: false,
      callbackBanner: false,
      showKeyboard: false,
      clock: "16:02",
      battery: 71,
      charging: false,
      unreadBadge: "",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "d1", kind: "date", text: "15:55 03/09/2026" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Ảnh xinh lắm e ơi",
          time: "15:55",
          showAvatar: true,
          hearts: 2,
        },
        { id: "c2", kind: "text", side: "customer", text: "Em ưng lắm luôn", time: "15:56", hearts: 1 },
        { id: "s1", kind: "text", side: "shop", text: "Dạ em cảm ơn ạ", time: "15:58" },
        { id: "s2", kind: "text", side: "shop", text: "Có dịp ủng hộ tiệm em nhé ạ", time: "15:58" },
        { id: "st", kind: "status", text: "Đã nhận" },
      ],
    },
  },
  {
    id: "zalo-ket-ban",
    label: "Zalo · Người lạ / Kết bạn",
    draft: {
      platform: "zalo_classic",
      customerName: "Triệu Vy",
      customerAvatar: "",
      statusText: "",
      stranger: true,
      callbackBanner: false,
      showKeyboard: true,
      clock: "16:05",
      battery: 12,
      charging: true,
      unreadBadge: "",
      inputHint: "Zalo 0363466460",
      lines: [
        { id: "d1", kind: "date", text: "16:04 Hôm nay" },
        { id: "c1", kind: "text", side: "customer", text: "dạ vâng ạ", time: "16:05", showAvatar: true, hearts: 1 },
        {
          id: "c2",
          kind: "text",
          side: "customer",
          text: "em nhận được ảnh rồi ạ hình đẹp lắm nữa em sẽ ủng hộ tiếp ạ",
          time: "16:05",
          hearts: 3,
        },
        { id: "s1", kind: "text", side: "shop", text: "Dạ em cảm ơn ạ", time: "16:05" },
        { id: "s2", kind: "text", side: "shop", text: "Có dịp ủng hộ tiệm em ạ", time: "16:05" },
        { id: "st", kind: "status", text: "Đã nhận" },
      ],
    },
  },
  {
    id: "messenger-dep",
    label: "Messenger · Cảm ơn shop",
    draft: {
      platform: "messenger",
      customerName: "Ngọc Ánh",
      customerAvatar: "",
      statusText: "Đang hoạt động",
      stranger: false,
      callbackBanner: false,
      showKeyboard: false,
      clock: "08:41",
      battery: 43,
      charging: false,
      unreadBadge: "",
      inputHint: "Aa",
      lines: [
        { id: "d1", kind: "date", text: "Hôm qua" },
        {
          id: "c1",
          kind: "text",
          side: "customer",
          text: "Thật sự ảnh quá đẹp rõ và sáng",
          showAvatar: true,
          hearts: 1,
        },
        { id: "c2", kind: "text", side: "customer", text: "Em cảm ơn shop nhiều ạ" },
        { id: "s1", kind: "text", side: "shop", text: "dạ em cảm ơn mình nhiều ạ" },
        { id: "s2", kind: "text", side: "shop", text: "có dịp ủng hộ tiệm em nhé ạ" },
        { id: "st", kind: "status", text: "Đã gửi" },
        { id: "c3", kind: "sticker", side: "customer", sticker: "thumb" },
      ],
    },
  },
];

export function cloneDraft(draft: FeedbackDraft): FeedbackDraft {
  return structuredClone(draft);
}

export function emptyTextLine(side: FeedbackSide): FeedbackLine {
  return {
    id: nid(),
    kind: "text",
    side,
    text: side === "customer" ? "Ảnh đẹp lắm ạ" : "dạ em cảm ơn ạ",
    showAvatar: side === "customer",
  };
}

export function platformLabel(platform: FeedbackPlatform): string {
  if (platform === "zalo") return "Zalo (header trắng)";
  if (platform === "zalo_classic") return "Zalo (header xanh)";
  return "Messenger";
}
