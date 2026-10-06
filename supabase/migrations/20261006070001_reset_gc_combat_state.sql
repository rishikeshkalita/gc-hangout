create or replace function public.gc_reset_combat_state()
returns boolean
language sql
security definer
set search_path = ''
as $$
  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values ((select auth.uid()), 3, null)
  on conflict (user_id) do update
    set health = 3, last_attack_at = null;
  select (select auth.uid()) is not null;
$$;
revoke execute on function public.gc_reset_combat_state() from public, anon, service_role;
grant execute on function public.gc_reset_combat_state() to authenticated;