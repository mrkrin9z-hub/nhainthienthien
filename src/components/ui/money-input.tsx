import { useLayoutEffect, useRef, type ChangeEvent, type ComponentProps } from "react";

import { Input } from "@/components/ui/input";
import { caretAfterFormat, formatGroupedInt, groupedIntValue } from "@/domain/grouped-number";

type Props = Omit<ComponentProps<typeof Input>, "type" | "inputMode" | "value" | "onChange"> & {
  value: number | string | null | undefined;
  onValueChange: (value: number | null) => void;
};

/** Ô nhập tiền: gõ 150000 hiện 150.000, state/API vẫn là số nguyên. */
export function MoneyInput({ value, onValueChange, className, onFocus, onBlur, ...props }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  const caret = useRef<number | null>(null);
  const display = formatGroupedInt(value);

  useLayoutEffect(() => {
    const node = ref.current;
    if (!node || caret.current == null) return;
    const pos = Math.max(0, Math.min(node.value.length, caret.current));
    node.setSelectionRange(pos, pos);
    caret.current = null;
  }, [display]);

  function handleChange(event: ChangeEvent<HTMLInputElement>) {
    const nextDisplay = formatGroupedInt(event.target.value);
    caret.current = caretAfterFormat(event.target.value, event.target.selectionStart ?? event.target.value.length, nextDisplay);
    onValueChange(groupedIntValue(event.target.value));
  }

  return (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      autoComplete="off"
      spellCheck={false}
      className={className}
      value={display}
      onChange={handleChange}
      onFocus={onFocus}
      onBlur={onBlur}
    />
  );
}
