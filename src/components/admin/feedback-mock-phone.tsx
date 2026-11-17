import { useEffect, useRef, type CSSProperties } from "react";

import type { FeedbackDraft, FeedbackLine } from "@/domain/feedback-mock";

type Props = {
  draft: FeedbackDraft;
  live?: boolean | undefined;
  onChange?: ((next: FeedbackDraft) => void) | undefined;
  onSelectLine?: ((id: string) => void) | undefined;
  selectedId?: string | null | undefined;
};

const MODERN_BLUE = "#1874FC";
const CLASSIC_BLUE = "#0091FF";
const CLASSIC_BUBBLE = "#D2F0FE";
const MODERN_CHAT_BG = "#F4F3F9";
const CLASSIC_CHAT_BG = "#E3EAF2";

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
      <rect x="13.5" y="0" width="3" height="11" rx="0.7" fill={fill} opacity="0.35" />
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
    <svg width="12" height="20" viewBox="0 0 12 20" aria-hidden>
      <path d="M10 1 2 10l8 9" fill="none" stroke={light ? "#fff" : "#111"} strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function VerifiedBadge() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" aria-hidden className="shrink-0">
      <rect width="13" height="13" rx="2.8" fill="#2A9160" />
      <path
        d="M4.1 3.4c.25-.25.65-.25.9 0l.85.85c.25.25.25.6.05.85L5.4 5.7c.4.8 1.05 1.45 1.85 1.85l.7-.55c.25-.2.6-.2.85.05l.85.85c.25.25.25.65 0 .9l-.6.6c-.3.3-.75.4-1.15.25-1.75-.6-3.25-2.1-3.85-3.85-.15-.4-.05-.85.25-1.15l.6-.6Z"
        fill="#fff"
      />
    </svg>
  );
}

function IconTag() {
  return (
    <span className="relative inline-flex">
      <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
        <path
          d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V4h9l8.6 8.6a2 2 0 0 1 0 2.8Z"
          fill="none"
          stroke="#3A3A3C"
          strokeWidth="1.7"
          strokeLinejoin="round"
        />
        <circle cx="8.2" cy="8.2" r="1.2" fill="#3A3A3C" />
      </svg>
      <span className="absolute -right-1.5 -top-1 grid h-[14px] min-w-[14px] place-items-center rounded-full bg-[#1874FC] px-[3px] text-[9px] font-bold leading-none text-white">
        1
      </span>
    </span>
  );
}

function IconNote() {
  return (
    <svg width="18" height="20" viewBox="0 0 18 20" aria-hidden>
      <path
        d="M2.2 1.4h9.2L16.2 6.2V17.6c0 .9-.7 1.6-1.6 1.6H3.8c-.9 0-1.6-.7-1.6-1.6V3c0-.9.7-1.6 1.6-1.6Z"
        fill="none"
        stroke="#3A3A3C"
        strokeWidth="1.55"
        strokeLinejoin="round"
      />
      <path d="M11.2 1.5V6h4.7" fill="none" stroke="#3A3A3C" strokeWidth="1.55" strokeLinejoin="round" />
      <path d="M5.2 10.2h7.2M5.2 13.4h5.2" stroke="#3A3A3C" strokeWidth="1.35" strokeLinecap="round" />
    </svg>
  );
}

function IconMenu({ light, plain }: { light?: boolean; plain?: boolean }) {
  const stroke = light ? "#fff" : "#3A3A3C";
  if (plain) {
    return (
      <svg width="18" height="14" viewBox="0 0 18 14" aria-hidden>
        <path d="M1 2h16M1 7h16M1 12h16" stroke={stroke} strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  return (
    <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden>
      <circle cx="2" cy="2.5" r="1.3" fill={stroke} />
      <path d="M6 2.5h12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="2" cy="8" r="1.3" fill={stroke} />
      <path d="M6 8h12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="2" cy="13.5" r="1.3" fill={stroke} />
      <path d="M6 13.5h12" stroke={stroke} strokeWidth="1.8" strokeLinecap="round" />
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
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden>
      <path d="M3.2 11.2 20.5 3.5 12.8 20.8l-1.7-7.2-7.9-2.4Z" fill={color} />
    </svg>
  );
}

function IconPlus() {
  return (
    <span className="grid h-[28px] w-[28px] place-items-center rounded-full bg-[#AAAEB1]">
      <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden>
        <path d="M7 2v10M2 7h10" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" />
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
      <div className="relative h-[108px] w-[108px] overflow-hidden rounded-[18px] bg-gradient-to-b from-[#5eb0ff] to-[#1874FC] shadow-sm">
        <div className="absolute left-2 top-2 rounded-md bg-[#ff3b30] px-1.5 py-0.5 text-[13px] font-black text-white shadow">10</div>
        <div className="absolute right-2 top-2 rounded-md bg-[#ff3b30] px-1.5 py-0.5 text-[13px] font-black text-white shadow">10</div>
        <div className="absolute inset-x-0 bottom-2 text-center text-[42px] leading-none">😎</div>
      </div>
    );
  }
  return (
    <div className="relative grid h-[118px] w-[118px] place-items-center">
      <div
        className="grid h-[108px] w-[108px] place-items-center rounded-full"
        style={{
          background: "radial-gradient(circle at 35% 30%, #4aa3ff 0%, #0380FF 55%, #0060d6 100%)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.18), inset 0 2px 0 rgba(255,255,255,0.35)",
        }}
      >
        <span className="translate-y-[2px] text-[58px] leading-none drop-shadow">👍</span>
      </div>
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

function IosKeyboard() {
  const key = (label: string, wide?: number, muted?: boolean) => (
    <div
      key={label}
      className="grid h-[42px] place-items-center rounded-[5px] text-[20px] text-black shadow-[0_1px_0_rgba(0,0,0,0.25)]"
      style={{
        flex: wide ?? 1,
        background: muted ? "#A8AEB8" : "#fff",
        fontSize: muted || label.length > 1 ? 14 : 20,
        fontWeight: muted ? 600 : 400,
      }}
    >
      {label}
    </div>
  );
  return (
    <div className="select-none bg-[#D3D2D7] px-[3px] pb-[4px] pt-[6px]">
      <div className="mb-[6px] flex gap-[5px]">{["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"].map((k) => key(k))}</div>
      <div className="mb-[6px] flex gap-[5px]">{["-", "/", ":", ";", "(", ")", "đ", "&", "@", "”"].map((k) => key(k))}</div>
      <div className="mb-[6px] flex gap-[5px]">
        {key("#+=", 1.15, true)}
        {[".", ",", "?", "!", "'"].map((k) => key(k))}
        {key("⌫", 1.15, true)}
      </div>
      <div className="mb-[4px] flex gap-[5px]">
        {key("ABC", 1.15, true)}
        {key("😊", 0.9, true)}
        {key("VI EN", 3.2)}
        {key("Nhập", 1.35, true)}
      </div>
      <div className="flex items-center justify-between px-4 pt-1 text-[17px] text-black/55">
        <span>🌐</span>
        <span className="h-[5px] w-[120px] rounded-full bg-black" />
        <span>🎤</span>
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
            className="truncate text-[15px] font-bold text-black"
            onCommit={(customerName) => onChange?.({ ...draft, customerName })}
          />
          {!messenger ? <VerifiedBadge /> : null}
        </div>
        <Editable
          live={live}
          value={draft.statusText || "Đang hoạt động"}
          className="block truncate text-[11px] text-[#8E8E93]"
          onCommit={(statusText) => onChange?.({ ...draft, statusText })}
        />
      </div>
      <div className="flex items-center gap-3 pr-1">
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
  if ("side" in prev && "side" in curr && prev.side === curr.side) return 3;
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
                      boxShadow: mine ? "none" : "0 0.5px 0 rgba(0,0,0,0.06)",
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
            classic ? "rounded-md bg-white" : "rounded-full bg-[#EFEFEF]"
          }`}
        >
          <Editable live={live} value={draft.inputHint} onCommit={(inputHint) => onChange?.({ ...draft, inputHint })} />
          <span className="ml-[1px] inline-block h-[16px] w-[2px] bg-[#1874FC]" />
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
