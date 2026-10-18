import { WALLETS, type WalletId } from "@/domain/money";

export function WalletToggle({ value, onChange }: { value: WalletId; onChange: (id: WalletId) => void }) {
  return (
    <div className="grid grid-cols-2 gap-2">
      {WALLETS.map((wallet) => (
        <button
          key={wallet.id}
          type="button"
          aria-pressed={value === wallet.id}
          className={`min-h-11 rounded-xl border text-sm font-semibold ${value === wallet.id ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card"}`}
          onClick={() => onChange(wallet.id)}
        >
          {wallet.label}
        </button>
      ))}
    </div>
  );
}
