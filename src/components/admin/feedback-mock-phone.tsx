import { useEffect, useRef, type CSSProperties, type ReactNode } from "react";

import type { FeedbackDraft, FeedbackLine } from "@/domain/feedback-mock";

type Props = {
  draft: FeedbackDraft;
  live?: boolean | undefined;
  onChange?: ((next: FeedbackDraft) => void) | undefined;
  onSelectLine?: ((id: string) => void) | undefined;
  selectedId?: string | null | undefined;
};

const MODERN_BLUE = "#006AFF";
const CLASSIC_BLUE = "#0091FF";
const CLASSIC_BUBBLE = "#D2F0FE";
const MODERN_CHAT_BG = "#F2F1F6";
const CLASSIC_CHAT_BG = "#E3EAF2";
const ICON_STROKE = "#1C1C1E";
const KEY_MUTED = "#AEB3BC";
const KEY_RETURN = "#8E9299";
const KEYBOARD_BG = "#D1D3D9";

function patchLine(draft: FeedbackDraft, id: string, partial: Partial<FeedbackLine>): FeedbackDraft {
  return {
    ...draft,
    lines: draft.lines.map((line) => (line.id === id ? ({ ...line, ...partial } as FeedbackLine) : line)),
  };
}

function Battery({ percent, charging, light }: { percent: number; charging: boolean; light?: boolean }) {
  const fill = Math.max(8, Math.min(100, percent));
  const low = percent <= 20 && !charging;
  const body = charging ? "#34C759" : low ? "#FF3B30" : light ? "#fff" : "#111";
  const empty = light ? "rgba(255,255,255,0.32)" : "#C7C7CC";
  const tip = light ? "rgba(255,255,255,0.55)" : "#C7C7CC";
  return (
    <span className="relative inline-flex h-[13px] w-[28px] items-center" aria-hidden>
      <span className="relative h-[12px] w-[25px] overflow-hidden rounded-[4px]" style={{ background: empty }}>
        <span className="absolute inset-[1px] overflow-hidden rounded-[3px]" style={{ background: empty }}>
          <span className="absolute inset-y-0 left-0 rounded-[2.5px]" style={{ width: `${fill}%`, background: body }} />
        </span>
        <span className="absolute inset-0 grid place-items-center text-[9px] font-bold leading-none tabular-nums text-white">
          {percent}
        </span>
      </span>
      <span className="ml-[1px] h-[5px] w-[1.6px] rounded-r-[1px]" style={{ background: tip }} />
    </span>
  );
}

function Signal({ light }: { light?: boolean }) {
  const fill = light ? "#fff" : "#111";
  return (
    <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden>
      <rect x="0" y="3.5" width="3" height="7.5" rx="0.7" fill={fill} />
      <rect x="4.5" y="2" width="3" height="9" rx="0.7" fill={fill} />
      <rect x="9" y="0.5" width="3" height="10.5" rx="0.7" fill={fill} />
      <rect x="13.5" y="0" width="3" height="11" rx="0.7" fill={fill} />
    </svg>
  );
}

function Wifi({ light }: { light?: boolean }) {
  return (
    <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden>
      <path
        d="M7.5 2.9c1.85 0 3.5.72 4.72 1.9l-1.15 1.15A5 5 0 0 0 7.5 4.5a5 5 0 0 0-3.57 1.45L2.78 4.8A6.6 6.6 0 0 1 7.5 2.9Zm0 2.55c1.1 0 2.08.42 2.82 1.12L9.1 7.8A2.5 2.5 0 0 0 7.5 7.2c-.7 0-1.33.27-1.8.72L4.5 6.6A4 4 0 0 1 7.5 5.45Zm0 2.7c.45 0 .85.17 1.15.46L7.5 10.1 6.35 8.6c.3-.28.7-.45 1.15-.45Z"
        fill={light ? "#fff" : "#111"}
      />
    </svg>
  );
}

function Chevron({ light }: { light?: boolean }) {
  return (
    <svg width="10" height="18" viewBox="0 0 10 18" aria-hidden>
      <path d="M8.5 1 1.5 9l7 8" fill="none" stroke={light ? "#fff" : ICON_STROKE} strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

/** Zalo verified (ảnh thật): ô xanh + ống nghe trắng. */
function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden className="shrink-0">
      <rect width="13" height="13" rx="2.6" fill="#2ECC71" />
      <path
        d="M3.55 3.9c.2-.2.52-.2.72 0l.9.9c.2.2.2.5.04.7L4.7 6c.4.8 1.05 1.45 1.85 1.85l.5-.5c.2-.16.5-.16.7.04l.9.9c.2.2.2.52 0 .72l-.48.48c-.24.24-.6.32-.92.2-1.7-.6-3.15-2.05-3.75-3.75-.12-.32-.04-.68.2-.92L3.55 3.9Z"
        fill="#fff"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <span className="relative inline-flex h-[22px] w-[22px] items-center justify-center">
      {/* Ảnh thật: thẻ giá nghiêng ~45° */}
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden style={{ transform: "rotate(45deg)" }}>
        <path
          d="M4 3.2h8.2l8.4 8.4a1.9 1.9 0 0 1 0 2.7l-5.3 5.3a1.9 1.9 0 0 1-2.7 0L4 11.2V3.2Z"
          fill="none"
          stroke={ICON_STROKE}
          strokeWidth="1.45"
          strokeLinejoin="round"
        />
        <circle cx="8.2" cy="7.4" r="1.35" fill="none" stroke={ICON_STROKE} strokeWidth="1.35" />
      </svg>
      <span className="absolute -right-[3px] -top-[4px] grid h-[13px] min-w-[13px] place-items-center rounded-full bg-[#64B5F6] px-[3px] text-[8px] font-bold leading-none text-white">
        1
      </span>
    </span>
  );
}

function IconNote() {
  /** Ảnh thật: hình vuông, góc dưới-phải gập. */
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden>
      <path
        d="M3.2 2.2h11.6c.7 0 1.2.5 1.2 1.2v8.4L12.2 15.8H3.2c-.7 0-1.2-.5-1.2-1.2V3.4c0-.7.5-1.2 1.2-1.2Z"
        fill="none"
        stroke={ICON_STROKE}
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M16 11.8H12.4V15.4" fill="none" stroke={ICON_STROKE} strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function IconMenu({ light, plain }: { light?: boolean; plain?: boolean }) {
  const stroke = light ? "#fff" : ICON_STROKE;
  if (plain) {
    return (
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
        <path d="M1 2h16M1 7h16M1 12h16" stroke={stroke} strokeWidth="1.6" strokeLinecap="round" />
      </svg>
    );
  }
  /** Zalo: ba gạch + chấm vuông bên trái. */
  return (
    <svg width="19" height="15" viewBox="0 0 19 15" aria-hidden>
      <rect x="1.1" y="1.5" width="2.2" height="2.2" rx="0.45" fill={stroke} />
      <path d="M5.6 2.6h12" stroke={stroke} strokeWidth="1.55" strokeLinecap="round" />
      <rect x="1.1" y="6.4" width="2.2" height="2.2" rx="0.45" fill={stroke} />
      <path d="M5.6 7.5h12" stroke={stroke} strokeWidth="1.55" strokeLinecap="round" />
      <rect x="1.1" y="11.3" width="2.2" height="2.2" rx="0.45" fill={stroke} />
      <path d="M5.6 12.4h12" stroke={stroke} strokeWidth="1.55" strokeLinecap="round" />
    </svg>
  );
}

function IconPhone({ light }: { light?: boolean }) {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden>
      <path
        d="M6.6 3.8c.5-.5 1.3-.5 1.8 0l1.7 1.7c.5.5.5 1.2.1 1.7L8.8 9.1c.8 1.6 2.1 2.9 3.7 3.7l1.9-1.4c.5-.4 1.2-.4 1.7.1l1.7 1.7c.5.5.5 1.3 0 1.8l-1.2 1.2c-.6.6-1.5.8-2.3.5-3.5-1.2-6.5-4.2-7.7-7.7-.3-.8-.1-1.7.5-2.3L6.6 3.8Z"
        fill="none"
        stroke={light ? "#fff" : "#3A3A3C"}
        strokeWidth="1.7"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function IconVideo({ light }: { light?: boolean }) {
  return (
    <svg width="20" height="16" viewBox="0 0 22 16" aria-hidden>
      <rect x="1" y="2" width="13" height="12" rx="2.5" fill="none" stroke={light ? "#fff" : "#3A3A3C"} strokeWidth="1.7" />
      <path d="M15 6.2 20.5 3.5v9L15 9.8Z" fill="none" stroke={light ? "#fff" : "#3A3A3C"} strokeWidth="1.7" strokeLinejoin="round" />
    </svg>
  );
}

function IconSend({ color = MODERN_BLUE }: { color?: string }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.2 11.15 20.6 3.55c.7-.3 1.35.4 1 1.1L14.2 21.6c-.28.62-1.18.55-1.35-.1l-1.7-5.95-5.95-1.7c-.65-.18-.72-1.08-.1-1.35Z" fill={color} />
    </svg>
  );
}

function IconPlus() {
  return (
    <span className="grid h-[28px] w-[28px] place-items-center rounded-full bg-[#AEB2B6]">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="2.1" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function IconStickerFace() {
  return (
    <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden>
      <rect x="2" y="2" width="24" height="24" rx="6" fill="none" stroke="#8E8E93" strokeWidth="1.6" />
      <circle cx="10" cy="12" r="1.6" fill="#8E8E93" />
      <circle cx="18" cy="12" r="1.6" fill="#8E8E93" />
      <path d="M9 17.5c1.4 2 3 2.8 5 2.8s3.6-.8 5-2.8" fill="none" stroke="#8E8E93" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function Avatar({ src, name, size }: { src: string; name: string; size: number }) {
  const letter = (name.trim()[0] || "K").toUpperCase();
  if (src) {
    return (
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className="shrink-0 rounded-full object-cover"
        style={{ width: size, height: size }}
        draggable={false}
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-[#7aa2ff] font-bold text-white"
      style={{ width: size, height: size, fontSize: size * 0.4 }}
    >
      {letter}
    </span>
  );
}

function Editable({
  value,
  live,
  className,
  style,
  multiline,
  onCommit,
}: {
  value: string;
  live?: boolean | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
  multiline?: boolean | undefined;
  onCommit: (next: string) => void;
}) {
  if (!live) {
    return (
      <span className={className} style={style}>
        {multiline
          ? value.split("\n").map((part, index) => (
              <span key={`${index}-${part}`}>
                {index ? <br /> : null}
                {part}
              </span>
            ))
          : value}
      </span>
    );
  }
  return (
    <span
      key={value}
      className={`${className ?? ""} outline-none focus:bg-black/[0.04]`}
      style={style}
      contentEditable
      suppressContentEditableWarning
      onBlur={(event) => {
        const text = event.currentTarget.innerText.replace(/\u00a0/g, " ").replace(/\n$/, "");
        if (text !== value) onCommit(text);
      }}
      onKeyDown={(event) => {
        if (!multiline && event.key === "Enter") {
          event.preventDefault();
          event.currentTarget.blur();
        }
      }}
    >
      {value}
    </span>
  );
}

function Sticker({ sticker }: { sticker: "thumb" | "1010" }) {
  if (sticker === "1010") {
    return (
      <div className="relative h-[108px] w-[108px] overflow-hidden rounded-[18px] bg-gradient-to-b from-[#5eb0ff] to-[#006AFF] shadow-sm">
        <div className="absolute left-2 top-2 rounded-md bg-[#ff3b30] px-1.5 py-0.5 text-[13px] font-black text-white shadow">10</div>
        <div className="absolute right-2 top-2 rounded-md bg-[#ff3b30] px-1.5 py-0.5 text-[13px] font-black text-white shadow">10</div>
        <div className="absolute inset-x-0 bottom-2 text-center text-[42px] leading-none">😎</div>
      </div>
    );
  }
  /** Flat Messenger/Zalo Like trên nền trắng — khớp ảnh thật. */
  return (
    <div
      className="grid h-[118px] w-[118px] place-items-center rounded-[16px] bg-white"
      style={{ boxShadow: "0 0.5px 1px rgba(0,0,0,0.10)" }}
    >
      <svg width="84" height="84" viewBox="0 0 84 84" aria-hidden>
        <path
          d="M17 37h12.2V67H17c-2.4 0-4.3-1.9-4.3-4.3V41.3c0-2.4 1.9-4.3 4.3-4.3Z"
          fill="#0084FF"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
        <path
          d="M29.2 37 37.8 12.6c.9-2.5 4-3.5 6.1-2l3.5 2.4c1.5 1.1 2.1 3.1 1.3 4.8L44.2 30.5H68c3.7 0 6.4 3.5 5.4 7.1l-5.7 21c-.8 2.7-3.3 4.6-6.1 4.6H29.2V37Z"
          fill="#0084FF"
          stroke="#fff"
          strokeWidth="2.4"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}

function HeartReaction({
  count,
  live,
  onCommit,
}: {
  count: number;
  live?: boolean | undefined;
  onCommit: (n: number) => void;
}) {
  return (
    <span className="absolute -bottom-[8px] right-1 inline-flex items-center gap-[2px] rounded-full border border-black/10 bg-white px-[5px] py-[1px] shadow-sm">
      <span className="text-[11px] leading-none">❤️</span>
      {count > 1 ? (
        <Editable
          live={live}
          value={String(count)}
          className="text-[10px] font-semibold text-black/70"
          onCommit={(value) => onCommit(Number(value) || 1)}
        />
      ) : null}
    </span>
  );
}

function KeyShell({
  children,
  wide,
  muted,
  dark,
  className,
}: {
  children: ReactNode;
  wide?: number;
  muted?: boolean;
  dark?: boolean;
  className?: string;
}) {
  const background = dark ? KEY_RETURN : muted ? KEY_MUTED : "#fff";
  return (
    <div
      className={`grid h-[42px] place-items-center rounded-[5.5px] text-black ${className ?? ""}`}
      style={{
        flex: wide ?? 1,
        background,
        boxShadow: "0 1px 0 rgba(0,0,0,0.30)",
      }}
    >
      {children}
    </div>
  );
}

function IconBackspace() {
  return (
    <svg width="23" height="17" viewBox="0 0 23 17" aria-hidden>
      <path
        d="M8.2 1.35h12A1.9 1.9 0 0 1 22.1 3.25v10.5a1.9 1.9 0 0 1-1.9 1.9H8.2L1.55 8.6 8.2 1.35Z"
        fill="none"
        stroke={ICON_STROKE}
        strokeWidth="1.35"
        strokeLinejoin="round"
      />
      <path d="M11.35 5.2 16.4 11.1M16.4 5.2 11.35 11.1" stroke={ICON_STROKE} strokeWidth="1.45" strokeLinecap="round" />
    </svg>
  );
}

function IconEmojiKey() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <circle cx="11" cy="11" r="7.6" fill="none" stroke={ICON_STROKE} strokeWidth="1.35" />
      <circle cx="8.1" cy="9.3" r="1.05" fill={ICON_STROKE} />
      <circle cx="13.9" cy="9.3" r="1.05" fill={ICON_STROKE} />
      <path d="M7.6 13.2c1.15 1.55 2.55 2.25 3.4 2.25s2.25-.7 3.4-2.25" fill="none" stroke={ICON_STROKE} strokeWidth="1.3" strokeLinecap="round" />
    </svg>
  );
}

function IconGlobe() {
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" aria-hidden>
      <circle cx="11" cy="11" r="7.6" fill="none" stroke="#636366" strokeWidth="1.25" />
      <path
        d="M3.4 11h15.2M11 3.4c2.45 2.5 2.45 12.7 0 15.2M11 3.4c-2.45 2.5-2.45 12.7 0 15.2"
        fill="none"
        stroke="#636366"
        strokeWidth="1.15"
      />
      <ellipse cx="11" cy="11" rx="3.4" ry="7.6" fill="none" stroke="#636366" strokeWidth="1.1" />
    </svg>
  );
}

function IconMic() {
  return (
    <svg width="15" height="22" viewBox="0 0 15 22" aria-hidden>
      <rect x="4.4" y="1.6" width="6.2" height="11" rx="3.1" fill="none" stroke="#636366" strokeWidth="1.3" />
      <path
        d="M2.2 10.4c0 3 2.4 5.4 5.3 5.4s5.3-2.4 5.3-5.4M7.5 15.8v3.5M4.5 19.3h6"
        fill="none"
        stroke="#636366"
        strokeWidth="1.3"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IosKeyboard() {
  const char = (label: string) => (
    <KeyShell key={label}>
      <span className="text-[22px] font-light leading-none tracking-tight">{label}</span>
    </KeyShell>
  );
  return (
    <div className="select-none px-[3px] pb-[1px] pt-[8px]" style={{ background: KEYBOARD_BG }}>
      <div className="mb-[8px] flex gap-[6px] px-[3px]">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map(char)}</div>
      <div className="mb-[8px] flex gap-[6px] px-[3px]">{["-", "/", ":", ";", "(", ")", "đ", "&", "@", '"'].map(char)}</div>
      <div className="mb-[8px] flex gap-[6px] px-[3px]">
        <KeyShell wide={1.35} muted>
          <span className="text-[14px] font-normal">#+=</span>
        </KeyShell>
        {[".", ",", "?", "!", "'"].map(char)}
        <KeyShell wide={1.35} muted>
          <IconBackspace />
        </KeyShell>
      </div>
      <div className="mb-[4px] flex gap-[6px] px-[3px]">
        <KeyShell wide={1.25} muted>
          <span className="text-[14px] font-normal">ABC</span>
        </KeyShell>
        <KeyShell wide={0.95} muted>
          <IconEmojiKey />
        </KeyShell>
        <KeyShell wide={3.35} className="relative">
          <span className="absolute bottom-[5px] right-[7px] text-[9px] font-medium tracking-[0.04em] text-black/30">VI EN</span>
        </KeyShell>
        <KeyShell wide={1.35} dark>
          <span className="text-[15px] font-normal text-black">Nhập</span>
        </KeyShell>
      </div>
      <div className="flex items-end justify-between px-[18px] pb-[6px] pt-[6px]">
        <IconGlobe />
        <span className="mb-[2px] h-[5px] w-[128px] rounded-full bg-black" />
        <IconMic />
      </div>
    </div>
  );
}

function Header({ draft, live, onChange }: Props) {
  const classic = draft.platform === "zalo_classic";
  const messenger = draft.platform === "messenger";

  if (classic) {
    return (
      <div>
        <div className="flex items-center gap-2 px-2 pb-[10px] pt-1 text-white" style={{ background: CLASSIC_BLUE }}>
          <span className="pl-1">
            <Chevron light />
          </span>
          <div className="min-w-0 flex-1">
            <Editable
              live={live}
              value={draft.customerName}
              className="block truncate text-[17px] font-semibold leading-tight"
              onCommit={(customerName) => onChange?.({ ...draft, customerName })}
            />
            {draft.stranger ? (
              <span className="mt-[3px] inline-block rounded-full bg-black/20 px-2 py-[1px] text-[10px] font-semibold tracking-wide">
                NGƯỜI LẠ
              </span>
            ) : (
              <Editable
                live={live}
                value={draft.statusText}
                className="mt-[1px] block truncate text-[12px] text-white/85"
                onCommit={(statusText) => onChange?.({ ...draft, statusText })}
              />
            )}
          </div>
          <div className="flex items-center gap-3.5 pr-2">
            <IconPhone light />
            <IconVideo light />
            <IconMenu light plain />
          </div>
        </div>
        {draft.stranger ? (
          <div className="flex justify-center border-b border-black/5 bg-white py-[9px]">
            <span className="inline-flex items-center gap-1.5 text-[14px] font-semibold text-black">
              <svg width="16" height="16" viewBox="0 0 16 16" aria-hidden>
                <circle cx="7" cy="5.5" r="2.4" fill="none" stroke="#111" strokeWidth="1.4" />
                <path d="M2.5 13c0-2.4 2-4 4.5-4s4.5 1.6 4.5 4" fill="none" stroke="#111" strokeWidth="1.4" strokeLinecap="round" />
                <path d="M12.2 4.2v4M10.2 6.2h4" stroke="#111" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
              Kết bạn
            </span>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 border-b border-[#E5E5EA] bg-white px-2 py-[8px]">
      <div className="relative flex items-center pl-1">
        <Chevron />
        {draft.unreadBadge ? (
          <span className="absolute -right-2 -top-1 grid min-h-[16px] min-w-[16px] place-items-center rounded-full bg-[#1874FC] px-[4px] text-[10px] font-bold text-white">
            {draft.unreadBadge}
          </span>
        ) : null}
      </div>
      <Avatar src={draft.customerAvatar} name={draft.customerName} size={32} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1">
          <Editable
            live={live}
            value={draft.customerName}
            className="truncate text-[15px] font-semibold text-black"
            onCommit={(customerName) => onChange?.({ ...draft, customerName })}
          />
          {!messenger ? <VerifiedBadge /> : null}
        </div>
        <Editable
          live={live}
          value={draft.statusText || "Đang hoạt động"}
          className="block truncate text-[11px] font-normal text-[#8E8E93]"
          onCommit={(statusText) => onChange?.({ ...draft, statusText })}
        />
      </div>
      <div className="flex items-center gap-[9px] pr-1">
        {messenger ? (
          <>
            <IconPhone />
            <IconVideo />
          </>
        ) : (
          <>
            <IconTag />
            <IconNote />
            <IconMenu />
          </>
        )}
      </div>
    </div>
  );
}

function showCustomerAvatar(lines: FeedbackLine[], index: number): boolean {
  const line = lines[index];
  if (!line || line.kind === "date" || line.kind === "status" || line.side !== "customer") return false;
  if (line.kind === "text" && line.showAvatar === false) return false;
  for (let i = index + 1; i < lines.length; i += 1) {
    const next = lines[i]!;
    if (next.kind === "date" || next.kind === "status") break;
    if (next.side === "customer") return false;
    break;
  }
  return true;
}

function gapBefore(lines: FeedbackLine[], index: number): number {
  if (index === 0) return 4;
  const prev = lines[index - 1]!;
  const curr = lines[index]!;
  if (prev.kind === "date" || curr.kind === "date" || prev.kind === "status" || curr.kind === "status") return 12;
  if ("side" in prev && "side" in curr && prev.side === curr.side) return 5;
  return 14;
}

export function FeedbackMockPhone({ draft, live, onChange, onSelectLine, selectedId }: Props) {
  const classic = draft.platform === "zalo_classic";
  const shopBg = classic ? CLASSIC_BUBBLE : MODERN_BLUE;
  const shopColor = classic ? "#111" : "#fff";
  const chatBg = classic ? CLASSIC_CHAT_BG : MODERN_CHAT_BG;
  const statusLight = classic;
  const threadRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = threadRef.current;
    if (!node) return;
    node.scrollTop = node.scrollHeight;
  }, [draft.lines.length, draft.lines.at(-1)?.id]);

  return (
    <div
      id="feedback-mock-capture"
      className="mx-auto w-[390px] overflow-hidden text-black"
      style={{
        fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Helvetica Neue', Arial, sans-serif",
        background: chatBg,
      }}
    >
      <div
        className="flex items-end justify-between px-5 pb-[3px] pt-[14px] text-[15px] font-semibold"
        style={{ background: classic ? CLASSIC_BLUE : "#fff", color: classic ? "#fff" : "#111" }}
      >
        <Editable
          live={live}
          value={draft.clock}
          className="min-w-[52px] tracking-tight"
          style={{ color: classic ? "#fff" : "#111" }}
          onCommit={(clock) => onChange?.({ ...draft, clock })}
        />
        <div className="flex items-center gap-[6px] pb-[1px]">
          <Signal light={statusLight} />
          <Wifi light={statusLight} />
          <Battery percent={draft.battery} charging={draft.charging} light={statusLight} />
        </div>
      </div>

      <Header draft={draft} live={live} onChange={onChange} />

      <div
        ref={threadRef}
        className="flex max-h-[460px] min-h-[320px] flex-col overflow-y-auto px-2 pb-3 pt-1"
        style={{ background: chatBg }}
      >
        {draft.lines.map((line, index) => {
          const marginTop = gapBefore(draft.lines, index);
          if (line.kind === "date") {
            return (
              <div key={line.id} className="flex justify-center" style={{ marginTop }}>
                <Editable
                  live={live}
                  value={line.text}
                  className={
                    classic
                      ? "rounded-full bg-[#B5B8BF] px-2.5 py-[2px] text-[11px] text-white"
                      : "px-1 text-[12px] text-[#8E8E93]"
                  }
                  onCommit={(text) => onChange?.(patchLine(draft, line.id, { text }))}
                />
              </div>
            );
          }
          if (line.kind === "status") {
            return (
              <div key={line.id} className="flex justify-end pr-1" style={{ marginTop: 4 }}>
                <Editable
                  live={live}
                  value={`✓ ${line.text}`}
                  className="text-[11px] text-black/40"
                  onCommit={(text) => onChange?.(patchLine(draft, line.id, { text: text.replace(/^✓\s*/, "") }))}
                />
              </div>
            );
          }

          const mine = line.side === "shop";
          const selected = selectedId === line.id;
          const avatar = !mine && showCustomerAvatar(draft.lines, index);

          return (
            <div
              key={line.id}
              className={`relative flex items-end gap-[6px] ${mine ? "justify-end" : "justify-start"} ${
                selected ? "rounded-xl ring-2 ring-[#1874FC]/35" : ""
              }`}
              style={{ marginTop }}
              onClick={() => onSelectLine?.(line.id)}
            >
              {!mine ? (
                <div className="mb-[1px] w-6 shrink-0">{avatar ? <Avatar src={draft.customerAvatar} name={draft.customerName} size={24} /> : null}</div>
              ) : null}
              <div className="relative max-w-[78%]">
                {line.kind === "sticker" ? (
                  <Sticker sticker={line.sticker} />
                ) : (
                  <div
                    className="px-[12px] py-[8px] text-[15px] leading-[1.35]"
                    style={{
                      background: mine ? shopBg : "#fff",
                      color: mine ? shopColor : "#111",
                      borderRadius: classic ? 14 : 18,
                      boxShadow: "none",
                    }}
                  >
                    <Editable
                      live={live}
                      multiline
                      value={line.text}
                      className="block whitespace-pre-wrap break-words"
                      onCommit={(text) => onChange?.(patchLine(draft, line.id, { text }))}
                    />
                    {line.time ? (
                      <Editable
                        live={live}
                        value={line.time}
                        className="mt-[2px] block text-[10px] text-black/35"
                        style={{ textAlign: classic ? "left" : "right" }}
                        onCommit={(time) => onChange?.(patchLine(draft, line.id, { time }))}
                      />
                    ) : null}
                  </div>
                )}
                {line.hearts ? (
                  <HeartReaction
                    count={line.hearts}
                    live={live}
                    onCommit={(hearts) => onChange?.(patchLine(draft, line.id, { hearts }))}
                  />
                ) : null}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex items-center gap-2 border-t border-black/[0.04] bg-white px-2 py-[8px]">
        {classic ? <IconStickerFace /> : <IconPlus />}
        <div
          className={`flex min-h-[36px] flex-1 items-center px-3 text-[14px] text-black/55 ${
            classic ? "rounded-md bg-white" : "rounded-full bg-[#EFEFF0]"
          }`}
        >
          <Editable live={live} value={draft.inputHint} onCommit={(inputHint) => onChange?.({ ...draft, inputHint })} />
          {live ? <span className="ml-[1px] inline-block h-[16px] w-[2px] bg-[#006AFF]" /> : null}
        </div>
        <span className="pr-1">
          <IconSend color={classic ? CLASSIC_BLUE : MODERN_BLUE} />
        </span>
      </div>

      {draft.showKeyboard ? (
        <IosKeyboard />
      ) : (
        <div className="bg-white pb-2 pt-1">
          <div className="mx-auto h-[5px] w-[120px] rounded-full bg-black" />
        </div>
      )}
    </div>
  );
}
