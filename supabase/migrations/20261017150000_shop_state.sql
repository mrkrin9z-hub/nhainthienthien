-- Sổ nội bộ giai đoạn 1. Chỉ service role đọc/ghi. Web không mở bảng này cho khách.
create table if not exists public.shop_state (
  id integer primary key default 1 check (id = 1),
  version integer not null default 1,
  doc jsonb not null,
  updated_at timestamptz not null default now()
);

alter table public.shop_state enable row level security;
revoke all on public.shop_state from public, anon, authenticated;
grant all on public.shop_state to service_role;
