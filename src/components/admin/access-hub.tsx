import { Link } from "@tanstack/react-router";
import type { LucideIcon } from "lucide-react";

import type { Role } from "@/domain/types";

export type AccessCard = {
  id: string;
  title: string;
  blurb: string;
  to: string;
  search?: Record<string, string>;
  icon: LucideIcon;
  roles?: Role[];
};

export type AccessGroup = {
  title: string;
  cards: AccessCard[];
};

export function AccessHub({
  title,
  hint,
  groups,
  role,
}: {
  title: string;
  hint: string;
  groups: AccessGroup[];
  role?: Role;
}) {
  const visible = groups
    .map((group) => ({
      ...group,
      cards: group.cards.filter((card) => !card.roles || (role ? card.roles.includes(role) : true)),
    }))
    .filter((group) => group.cards.length > 0);

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-extrabold text-primary">{title}</h1>
        <p className="mt-1 text-sm text-muted-foreground">{hint}</p>
      </div>
      {visible.map((group) => (
        <section key={group.title} className="space-y-3">
          <h2 className="text-sm font-bold tracking-wide text-muted-foreground uppercase">{group.title}</h2>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {group.cards.map((card) => {
              const Icon = card.icon;
              return (
                <Link
                  key={card.id}
                  to={card.to}
                  search={card.search as never}
                  className="flex min-h-[5.5rem] gap-3 rounded-2xl border bg-card px-4 py-3 shadow-sm transition hover:border-primary/40 hover:bg-muted/30"
                >
                  <span className="mt-0.5 flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <Icon className="size-5" />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-foreground">{card.title}</span>
                    <span className="mt-0.5 block text-sm text-muted-foreground">{card.blurb}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

export function HubBack({ to, label, search }: { to: string; label: string; search?: Record<string, string> }) {
  return (
    <Link to={to} search={search as never} className="text-sm text-muted-foreground hover:text-primary">
      ← {label}
    </Link>
  );
}
