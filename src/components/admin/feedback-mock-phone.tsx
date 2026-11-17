import type { FeedbackDraft, FeedbackLine } from "@/domain/feedback-mock";

function Battery({ percent, charging, danger }: { percent: number; charging: boolean; danger: boolean }) {
  const fill = Math.max(5, Math.min(100, percent));
  return (
    <span className="inline-flex items-center gap-0.5 text-[11px] font-semibold tabular-nums" style={{ color: danger ? "#ff3b30" : "#111" }}>
      <span>{percent}</span>
      <span className="relative inline-block h-[11px] w-[24px] rounded-[3px] border border-current/80 p-[1px]">
        <span
          className="block h-full rounded-[1.5px]"
          style={{ width: `${fill}%`, background: danger ? "#ff3b30" : "#111" }}
        />
        <span className="absolute -right-[3px] top-[2.5px] h-[5px] w-[1.5px] rounded-r bg-current/80" />
      </span>
      {charging ? <span className="text-[10px] leading-none">⚡</span> : null}
    </span>
  );
}

function StatusBar({ draft }: { draft: FeedbackDraft }) {
  const danger = draft.battery <= 20;
  return (
    <div className="flex items-center justify-between px-5 pb-1 pt-3 text-[15px] font-semibold text-black">
      <span className="min-w-[54px] tracking-tight">{draft.clock}</span>
      <div className="flex items-center gap-1.5">
        <svg width="17" height="11" viewBox="0 0 17 11" aria-hidden>
          <rect x="0" y="3.5" width="3" height="7.5" rx="0.6" fill="#111" />
          <rect x="4.5" y="2" width="3" height="9" rx="0.6" fill="#111" />
          <rect x="9" y="0.5" width="3" height="10.5" rx="0.6" fill="#111" />
          <rect x="13.5" y="0" width="3" height="11" rx="0.6" fill="#111" opacity="0.35" />
        </svg>
        <svg width="15" height="11" viewBox="0 0 15 11" aria-hidden>
          <path d="M7.5 3.2c1.7 0 3.2.7 4.3 1.8l-1.1 1.1A4.5 4.5 0 0 0 7.5 4.8c-1.2 0-2.3.5-3.1 1.3L3.3 5A6 6 0 0 1 7.5 3.2Zm0 2.4c1 0 1.9.4 2.6 1.1L8.9 7.9A2.2 2.2 0 0 0 7.5 7.4c-.6 0-1.1.2-1.5.6L4.9 6.7A3.7 3.7 0 0 1 7.5 5.6Zm0 2.5c.4 0 .8.2 1 .5L7.5 10 6.5 8.6c.2-.3.6-.5 1-.5Z" fill="#111" />
        </svg>
        <Battery percent={draft.battery} charging={draft.charging} danger={danger} />
      </div>
    </div>
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
      />
    );
  }
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-sky-400 to-indigo-500 text-white"
      style={{ width: size, height: size, fontSize: size * 0.42, fontWeight: 700 }}
    >
      {letter}
    </span>
  );
}

function Sticker({ sticker }: { sticker: "thumb" | "1010" }) {
  if (sticker === "1010") {
    return (
      <div className="flex h-[88px] w-[88px] flex-col items-center justify-center rounded-2xl bg-[#2f80ed] text-white shadow-sm">
        <span className="text-2xl font-black leading-none">10</span>
        <span className="text-[10px] font-bold opacity-90">/ 10</span>
      </div>
    );
  }
  return (
    <div className="grid h-[92px] w-[92px] place-items-center rounded-full bg-[#2f80ed] text-[52px] shadow-sm">
      👍
    </div>
  );
}

function Bubble({
  line,
  draft,
  classic,
}: {
  line: Extract<FeedbackLine, { kind: "text" | "sticker" }>;
  draft: FeedbackDraft;
  classic: boolean;
}) {
  const mine = line.side === "shop";
  const messenger = draft.platform === "messenger";
  const shopBg = classic ? "#cce6ff" : messenger ? "#0084ff" : "#0084ff";
  const shopColor = classic ? "#111" : "#fff";
  return (
    <div className={`flex items-end gap-1.5 ${mine ? "justify-end" : "justify-start"}`}>
      {!mine ? (
        <div className="mb-0.5 w-7 shrink-0">
          {line.kind === "text" && line.showAvatar !== false ? <Avatar src={draft.customerAvatar} name={draft.customerName} size={28} /> : null}
        </div>
      ) : null}
      <div className={`relative max-w-[78%] ${mine ? "items-end" : "items-start"}`}>
        {line.kind === "sticker" ? (
          <Sticker sticker={line.sticker} />
        ) : (
          <div
            className="whitespace-pre-wrap break-words px-3 py-[8px] text-[15px] leading-[1.35]"
            style={{
              background: mine ? shopBg : "#fff",
              color: mine ? shopColor : "#111",
              borderRadius: mine ? "18px 18px 4px 18px" : "18px 18px 18px 4px",
              boxShadow: mine ? "none" : "0 0 0 0.5px rgba(0,0,0,0.06)",
            }}
          >
            {line.text}
            {line.time ? (
              <div className="mt-0.5 text-right text-[10px] text-black/35">{line.time}</div>
            ) : null}
          </div>
        )}
        {line.hearts ? (
          <span
            className={`absolute -bottom-2 ${mine ? "left-1" : "right-1"} inline-flex items-center gap-0.5 rounded-full bg-white px-1 py-[1px] text-[11px] shadow`}
          >
            ❤️ <span className="font-semibold text-black/70">{line.hearts}</span>
          </span>
        ) : null}
      </div>
    </div>
  );
}

function IosKeyboard() {
  const row1 = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "0"];
  const row2 = ["-", "/", ":", ";", "(", ")", "$", "&", "@", "”"];
  const row3 = [".", ",", "?", "!", "'"];
  return (
    <div className="bg-[#d1d3d9] px-1.5 pb-2 pt-1.5" style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif" }}>
      <div className="mb-1.5 grid grid-cols-10 gap-1">
        {row1.map((key) => (
          <div key={key} className="grid h-10 place-items-center rounded-[5px] bg-white text-[20px] font-normal shadow-sm">
            {key}
          </div>
        ))}
      </div>
      <div className="mb-1.5 grid grid-cols-10 gap-1">
        {row2.map((key) => (
          <div key={key} className="grid h-10 place-items-center rounded-[5px] bg-white text-[18px] shadow-sm">
            {key}
          </div>
        ))}
      </div>
      <div className="mb-1.5 flex gap-1">
        <div className="grid h-10 w-12 place-items-center rounded-[5px] bg-[#adb0b8] text-[13px] font-semibold text-black">ABC</div>
        <div className="grid flex-1 grid-cols-5 gap-1">
          {row3.map((key) => (
            <div key={key} className="grid h-10 place-items-center rounded-[5px] bg-white text-[18px] shadow-sm">
              {key}
            </div>
          ))}
        </div>
        <div className="grid h-10 w-12 place-items-center rounded-[5px] bg-[#adb0b8] text-[16px]">⌫</div>
      </div>
      <div className="flex gap-1">
        <div className="grid h-10 w-12 place-items-center rounded-[5px] bg-[#adb0b8] text-[12px] font-semibold">123</div>
        <div className="grid h-10 flex-1 place-items-center rounded-[5px] bg-white text-[15px] text-black/70 shadow-sm">VI EN</div>
        <div className="grid h-10 w-16 place-items-center rounded-[5px] bg-[#adb0b8] text-[14px] font-semibold">Nhập</div>
      </div>
      <div className="mt-1.5 flex items-center justify-between px-3 text-[18px] text-black/70">
        <span>🌐</span>
        <span className="mx-auto h-1 w-28 rounded-full bg-black/80" />
        <span>🎤</span>
      </div>
    </div>
  );
}

function Header({ draft }: { draft: FeedbackDraft }) {
  const classic = draft.platform === "zalo_classic";
  const messenger = draft.platform === "messenger";
  if (classic) {
    return (
      <div>
        <div className="flex items-center gap-2 bg-[#0084ff] px-2 pb-2 pt-1 text-white">
          <span className="text-[28px] font-light leading-none">‹</span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-semibold leading-tight">{draft.customerName}</p>
            {draft.stranger ? (
              <span className="mt-0.5 inline-block rounded-full bg-black/20 px-2 py-[1px] text-[10px] font-semibold tracking-wide">
                NGƯỜI LẠ
              </span>
            ) : draft.statusText ? (
              <p className="truncate text-[11px] text-white/85">{draft.statusText}</p>
            ) : null}
          </div>
          <div className="flex items-center gap-3 pr-1 text-[18px]">
            <span>📞</span>
            <span>📹</span>
            <span>☰</span>
          </div>
        </div>
        {draft.stranger ? (
          <div className="flex justify-center border-b bg-white py-2">
            <span className="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-[13px] font-semibold text-[#0084ff]">
              👤+ Kết bạn
            </span>
          </div>
        ) : null}
      </div>
    );
  }
  return (
    <div className="flex items-center gap-2 border-b border-black/5 bg-white px-2 py-2">
      <div className="relative">
        <span className="text-[28px] font-light leading-none text-black/80">‹</span>
        {draft.unreadBadge ? (
          <span className="absolute -right-2 top-0 grid min-w-[16px] place-items-center rounded-full bg-[#0084ff] px-1 text-[10px] font-bold text-white">
            {draft.unreadBadge}
          </span>
        ) : null}
      </div>
      <Avatar src={draft.customerAvatar} name={draft.customerName} size={36} />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-1 truncate text-[15px] font-bold text-black">
          {draft.customerName}
          {!messenger ? <span className="text-[11px] text-emerald-500">▣</span> : null}
        </p>
        <p className="truncate text-[11px] text-black/45">{draft.statusText || "Đang hoạt động"}</p>
      </div>
      <div className="flex items-center gap-3 pr-1 text-[16px] text-black/70">
        {messenger ? (
          <>
            <span>📞</span>
            <span>🎥</span>
          </>
        ) : (
          <>
            <span className="relative">
              🏷️
              <span className="absolute -right-1 -top-1 grid h-3.5 min-w-3.5 place-items-center rounded-full bg-[#0084ff] text-[8px] font-bold text-white">
                1
              </span>
            </span>
            <span>📄</span>
            <span>☰</span>
          </>
        )}
      </div>
    </div>
  );
}

export function FeedbackMockPhone({ draft }: { draft: FeedbackDraft }) {
  const classic = draft.platform === "zalo_classic";
  return (
    <div
      id="feedback-mock-capture"
      className="mx-auto w-[390px] overflow-hidden bg-[#eef1f5] text-black shadow-xl"
      style={{ fontFamily: "-apple-system, BlinkMacSystemFont, 'SF Pro Text', 'Segoe UI', system-ui, sans-serif" }}
    >
      <StatusBar draft={draft} />
      <Header draft={draft} />
      <div className="flex min-h-[420px] flex-col gap-2 px-2 py-3" style={{ background: classic ? "#e8eef5" : "#eef1f5" }}>
        {draft.lines.map((line) => {
          if (line.kind === "date") {
            return (
              <div key={line.id} className="flex justify-center py-1">
                <span className="rounded-full bg-black/10 px-2.5 py-0.5 text-[11px] text-black/55">{line.text}</span>
              </div>
            );
          }
          if (line.kind === "status") {
            return (
              <div key={line.id} className="flex justify-end pr-1">
                <span className="inline-flex items-center gap-1 text-[11px] text-black/45">✓ {line.text}</span>
              </div>
            );
          }
          return <Bubble key={line.id} line={line} draft={draft} classic={classic} />;
        })}
      </div>
      <div className="flex items-center gap-2 border-t border-black/5 bg-white px-2 py-2">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-[#e8e8ed] text-[18px] text-black/50">
          {classic ? "🙂" : "+"}
        </span>
        <div className="flex min-h-9 flex-1 items-center rounded-full bg-[#f0f0f3] px-3 text-[14px] text-black/55">
          {draft.inputHint}
          <span className="ml-0.5 inline-block h-4 w-[2px] animate-pulse bg-[#0084ff]" />
        </div>
        <span className="text-[20px] text-[#0084ff]">➤</span>
      </div>
      {draft.showKeyboard ? <IosKeyboard /> : <div className="bg-white pb-2 pt-1"><div className="mx-auto h-1 w-28 rounded-full bg-black/80" /></div>}
    </div>
  );
}
