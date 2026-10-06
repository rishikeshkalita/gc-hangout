create table if not exists public.gc_room_combat (
  user_id uuid primary key references auth.users(id) on delete cascade,
  health smallint not null default 3 check (health between 0 and 3),
  last_attack_at timestamptz
);

alter table public.gc_room_combat enable row level security;
revoke all on table public.gc_room_combat from anon, authenticated, public;
grant select on table public.gc_room_combat to authenticated;

drop policy if exists "gc combat own health" on public.gc_room_combat;
create policy "gc combat own health"
on public.gc_room_combat
for select
to authenticated
using ((select auth.uid()) = user_id);

create or replace function public.gc_apply_attack(
  p_target_id uuid,
  p_attacker_x double precision,
  p_attacker_z double precision,
  p_attacker_rot double precision,
  p_target_x double precision,
  p_target_z double precision
)
returns table(accepted boolean, target_health integer, defeated boolean, reason text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  attacker uuid := (select auth.uid());
  attacker_last timestamptz;
  current_health integer;
  distance double precision;
  facing double precision;
  target_angle double precision;
begin
  if attacker is null then
    return query select false, 0, false, 'not_authenticated'::text;
    return;
  end if;

  if p_target_id is null or p_target_id = attacker then
    return query select false, 0, false, 'invalid_target'::text;
    return;
  end if;

  if abs(coalesce(p_attacker_x, 9999)) > 100
     or abs(coalesce(p_attacker_z, 9999)) > 100
     or abs(coalesce(p_target_x, 9999)) > 100
     or abs(coalesce(p_target_z, 9999)) > 100
     or abs(coalesce(p_attacker_rot, 9999)) > 100 then
    return query select false, 0, false, 'invalid_position'::text;
    return;
  end if;

  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values (attacker, 3, null)
  on conflict (user_id) do nothing;

  select last_attack_at
    into attacker_last
    from public.gc_room_combat
   where user_id = attacker
   for update;

  if attacker_last is not null and now() - attacker_last < interval '450 milliseconds' then
    return query select false, 0, false, 'rate_limited'::text;
    return;
  end if;

  if not exists (select 1 from auth.users where id = p_target_id) then
    return query select false, 0, false, 'target_not_found'::text;
    return;
  end if;

  distance := sqrt(power(p_target_x - p_attacker_x, 2) + power(p_target_z - p_attacker_z, 2));
  target_angle := atan2(p_target_x - p_attacker_x, p_target_z - p_attacker_z);
  facing := abs(atan2(sin(target_angle - p_attacker_rot), cos(target_angle - p_attacker_rot)));

  if distance > 1.9 then
    return query select false, 0, false, 'out_of_range'::text;
    return;
  end if;

  if facing > 1.25 then
    return query select false, 0, false, 'not_facing_target'::text;
    return;
  end if;

  update public.gc_room_combat
     set last_attack_at = now()
   where user_id = attacker;

  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values (p_target_id, 3, null)
  on conflict (user_id) do nothing;

  update public.gc_room_combat
     set health = greatest(0, health - 1)
   where user_id = p_target_id
   returning health into current_health;

  return query select true, current_health, current_health = 0, 'hit'::text;
end;
$$;

revoke execute on function public.gc_apply_attack(uuid,double precision,double precision,double precision,double precision,double precision)
  from public, anon, service_role;
grant execute on function public.gc_apply_attack(uuid,double precision,double precision,double precision,double precision,double precision)
  to authenticated;
