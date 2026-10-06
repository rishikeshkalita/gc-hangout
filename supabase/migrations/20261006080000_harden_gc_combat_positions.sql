create table if not exists public.gc_room_positions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  x double precision not null default 0,
  z double precision not null default 0,
  rot double precision not null default 0,
  updated_at timestamptz not null default now()
);

alter table public.gc_room_positions enable row level security;
revoke all on table public.gc_room_positions from anon, authenticated, public;

create or replace function public.gc_update_combat_position(
  p_x double precision,
  p_z double precision,
  p_rot double precision
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  uid uuid := (select auth.uid());
  previous public.gc_room_positions%rowtype;
  elapsed double precision;
  max_distance double precision;
  distance double precision;
begin
  if uid is null then return false; end if;
  if abs(coalesce(p_x,9999)) > 100 or abs(coalesce(p_z,9999)) > 100 or abs(coalesce(p_rot,9999)) > 100 then
    return false;
  end if;

  select * into previous from public.gc_room_positions where user_id = uid for update;
  if found then
    elapsed := greatest(extract(epoch from (now() - previous.updated_at)), 0.03);
    max_distance := 5.25 * elapsed + 0.75;
    distance := sqrt(power(p_x - previous.x, 2) + power(p_z - previous.z, 2));
    if distance > max_distance then return false; end if;
  end if;

  insert into public.gc_room_positions(user_id,x,z,rot,updated_at)
  values (uid,p_x,p_z,p_rot,now())
  on conflict (user_id) do update
    set x=excluded.x,z=excluded.z,rot=excluded.rot,updated_at=excluded.updated_at;
  return true;
end;
$$;

revoke execute on function public.gc_update_combat_position(double precision,double precision,double precision)
  from public, anon, service_role;
grant execute on function public.gc_update_combat_position(double precision,double precision,double precision)
  to authenticated;

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
  attacker_position public.gc_room_positions%rowtype;
  target_position public.gc_room_positions%rowtype;
  distance double precision;
  facing double precision;
  target_angle double precision;
begin
  if attacker is null then
    return query select false, 0, false, 'not_authenticated'::text; return;
  end if;
  if p_target_id is null or p_target_id = attacker then
    return query select false, 0, false, 'invalid_target'::text; return;
  end if;

  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values (attacker, 3, null) on conflict (user_id) do nothing;

  select last_attack_at into attacker_last
  from public.gc_room_combat where user_id = attacker for update;

  if attacker_last is not null and now() - attacker_last < interval '450 milliseconds' then
    return query select false, 0, false, 'rate_limited'::text; return;
  end if;

  select * into attacker_position from public.gc_room_positions
  where user_id = attacker and updated_at > now() - interval '3 seconds';
  if not found then
    return query select false, 0, false, 'attacker_position_unavailable'::text; return;
  end if;

  select * into target_position from public.gc_room_positions
  where user_id = p_target_id and updated_at > now() - interval '3 seconds';
  if not found then
    return query select false, 0, false, 'target_position_unavailable'::text; return;
  end if;

  distance := sqrt(power(target_position.x - attacker_position.x, 2) + power(target_position.z - attacker_position.z, 2));
  target_angle := atan2(target_position.x - attacker_position.x, target_position.z - attacker_position.z);
  facing := abs(atan2(sin(target_angle - attacker_position.rot), cos(target_angle - attacker_position.rot)));

  if distance > 1.9 then
    return query select false, 0, false, 'out_of_range'::text; return;
  end if;
  if facing > 1.25 then
    return query select false, 0, false, 'not_facing_target'::text; return;
  end if;

  update public.gc_room_combat set last_attack_at = now() where user_id = attacker;
  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values (p_target_id, 3, null) on conflict (user_id) do nothing;

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

create or replace function public.gc_reset_combat_state()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare uid uuid := (select auth.uid());
begin
  if uid is null then return false; end if;
  insert into public.gc_room_combat(user_id, health, last_attack_at)
  values (uid,3,null)
  on conflict (user_id) do update set health=3,last_attack_at=null;
  insert into public.gc_room_positions(user_id,x,z,rot,updated_at)
  values (uid,0,0,0,now())
  on conflict (user_id) do update set x=0,z=0,rot=0,updated_at=now();
  return true;
end;
$$;

revoke execute on function public.gc_reset_combat_state() from public, anon, service_role;
grant execute on function public.gc_reset_combat_state() to authenticated;
