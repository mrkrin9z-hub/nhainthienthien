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
      className={`min-h-11 rounded-2xl border px-3 py-2 text-left text-sm transition active:scale-95 ${
        active ? "border-accent bg-accent/10 text-accent" : "border-border bg-card text-foreground/80"
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
