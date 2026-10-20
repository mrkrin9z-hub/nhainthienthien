import {
  CHANNEL_LABEL,
  ROLE_LABEL,
  STATUS_LABEL,
  type Channel,
  type OrderStatus,
  type Role,
} from "@/domain/types";

/** Prefer client maps so UI stays correct even if a Worker deploy mangles UTF-8 literals. */
export function statusLabelOf(status: string, fallback?: string): string {
  if (status in STATUS_LABEL) return STATUS_LABEL[status as OrderStatus];
  return fallback || status;
}

export function channelLabelOf(channel: string, fallback?: string): string {
  if (channel in CHANNEL_LABEL) return CHANNEL_LABEL[channel as Channel];
  return fallback || channel;
}

export function roleLabelOf(role: string, fallback?: string): string {
  if (role in ROLE_LABEL) return ROLE_LABEL[role as Role];
  return fallback || role;
}
