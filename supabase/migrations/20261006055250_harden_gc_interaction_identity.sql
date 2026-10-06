-- Applied to Supabase project ypfrlglzblxcsilzkomx on 2026-10-06.
-- Keep this file in source control so the production schema change is reproducible.

create or replace function public.gc_claim_interaction(
  p_object_id text,
  p_holder_id text,
  p_action text,
  p_lease_seconds integer default 30
)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare
  v_holder_id text := trim(p_holder_id);
begin
  if auth.uid() is null then return false; end if;
  if v_holder_id <> auth.uid()::text then return false; end if;
  if length(trim(p_object_id)) = 0 or length(trim(p_object_id)) > 120 then return false; end if;
  if p_action not in ('sit','sleep','watch','eat','drink') then return false; end if;
  if p_lease_seconds < 5 or p_lease_seconds > 120 then return false; end if;

  insert into public.gc_room_interactions(object_id,holder_id,action,lease_until,updated_at)
  values(trim(p_object_id),v_holder_id,p_action,now()+make_interval(secs=>p_lease_seconds),now())
  on conflict (object_id) do update
    set holder_id=excluded.holder_id,
        action=excluded.action,
        lease_until=excluded.lease_until,
        updated_at=now()
    where public.gc_room_interactions.holder_id=v_holder_id
       or public.gc_room_interactions.lease_until < now();

  return exists(
    select 1 from public.gc_room_interactions
    where object_id=trim(p_object_id)
      and holder_id=v_holder_id
      and lease_until>now()
  );
end;
$function$;

create or replace function public.gc_release_interaction(p_object_id text,p_holder_id text)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare v_holder_id text := trim(p_holder_id);
begin
  if auth.uid() is null or v_holder_id <> auth.uid()::text then return false; end if;
  delete from public.gc_room_interactions where object_id=trim(p_object_id) and holder_id=v_holder_id;
  return found;
end;
$function$;

create or replace function public.gc_touch_interaction(p_object_id text,p_holder_id text,p_lease_seconds integer default 30)
returns boolean
language plpgsql
security definer
set search_path to ''
as $function$
declare v_holder_id text := trim(p_holder_id);
begin
  if auth.uid() is null or v_holder_id <> auth.uid()::text then return false; end if;
  update public.gc_room_interactions
  set lease_until=now()+make_interval(secs=>greatest(5,least(120,p_lease_seconds))),updated_at=now()
  where object_id=trim(p_object_id) and holder_id=v_holder_id and lease_until>now();
  return found;
end;
$function$;

revoke all on function public.gc_claim_interaction(text,text,text,integer) from public,anon,service_role;
revoke all on function public.gc_release_interaction(text,text) from public,anon,service_role;
revoke all on function public.gc_touch_interaction(text,text,integer) from public,anon,service_role;
grant execute on function public.gc_claim_interaction(text,text,text,integer) to authenticated;
grant execute on function public.gc_release_interaction(text,text) to authenticated;
grant execute on function public.gc_touch_interaction(text,text,integer) to authenticated;
revoke all on table public.gc_room_interactions from anon,authenticated;

drop policy if exists "gc hangout realtime read" on realtime.messages;
drop policy if exists "gc hangout realtime write" on realtime.messages;

create policy "gc hangout realtime read"
on realtime.messages
for select to authenticated
using (realtime.topic()='gc-hangout-main' and extension in ('broadcast','presence'));

create policy "gc hangout realtime write"
on realtime.messages
for insert to authenticated
with check (realtime.topic()='gc-hangout-main' and extension in ('broadcast','presence'));
