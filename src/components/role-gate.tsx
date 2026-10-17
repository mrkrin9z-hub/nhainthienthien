import type { ReactNode } from "react";
import { useQuery } from "@tanstack/react-query";

import type { Role } from "@/domain/types";
import { getMe } from "@/lib/admin.functions";

export function RoleGate({ allow, deny, children }: { allow: Role[]; deny: string; children: ReactNode }) {
  const me = useQuery({ queryKey: ["me"], queryFn: () => getMe() });
  if (me.isLoading) return <p className="text-muted-foreground">Đang tải…</p>;
  if (!me.data || !allow.includes(me.data.role)) {
    return <p className="text-lg font-semibold text-primary">{deny}</p>;
  }
  return children;
}
