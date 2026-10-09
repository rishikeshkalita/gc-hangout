create table if not exists public.gc_room_players (
  client_id text primary key,
  room_id text not null default 'main',
  user_id uuid not null references auth.users(id) on delete cascade,
  payload jsonb not null,
  last_seen timestamptz not null default now(),
  constraint gc_room_players_client_id_length check (char_length(client_id) between 8 and 100),
  constraint gc_room_players_room_main check (room_id = 'main')
);

create index if not exists gc_room_players_active_idx
  on public.gc_room_players (room_id, last_seen desc);

alter table public.gc_room_players enable row level security;
grant select, insert, update, delete on public.gc_room_players to authenticated;

create policy "gc room players read active room"
  on public.gc_room_players for select to authenticated
  using (room_id = 'main' and last_seen > now() - interval '20 seconds');

create policy "gc room players insert own session"
  on public.gc_room_players for insert to authenticated
  with check (room_id = 'main' and user_id = (select auth.uid()));

create policy "gc room players update own session"
  on public.gc_room_players for update to authenticated
  using (user_id = (select auth.uid()))
  with check (room_id = 'main' and user_id = (select auth.uid()));

create policy "gc room players delete own session"
  on public.gc_room_players for delete to authenticated
  using (user_id = (select auth.uid()));

comment on table public.gc_room_players is
  'Short-lived, database-backed player snapshots for GC Hangout multiplayer fallback.';
