import { Check } from "lucide-react";

export function ChoiceChip({
  active,
  title,
  detail,
  onClick,
}: {
  active: boolean;
  title: string;
  detail?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`min-h-11 rounded-2xl px-3.5 py-2 text-left text-sm transition active:scale-95 ${
        active ? "bg-[#fff3e0] text-sale shadow-[0_0_0_1.5px_var(--sale)]" : "bg-[#f3f6fa] text-[#123047]/85 hover:shadow-[0_0_0_1px_rgb(180_83_9/0.45)]"
      }`}
    >
      <span className="flex items-center gap-1.5 font-semibold">
        {active ? <Check className="size-3.5 shrink-0" aria-hidden /> : null}
        {title}
      </span>
      {detail ? <span className="mt-0.5 block text-xs font-semibold">{detail}</span> : null}
    </button>
  );
}
