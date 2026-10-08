-- Fix authenticated private Realtime access, add shared music delete voting, and keep deleted objects cleaned up.

drop policy if exists "gc hangout realtime authenticated read" on realtime.messages;
drop policy if exists "gc hangout realtime authenticated write" on realtime.messages;

create policy "gc hangout realtime authenticated read"
on realtime.messages
for select to authenticated
using (
  (select realtime.topic()) in ('gc-hangout:main', 'gc-hangout-game:main')
  and extension in ('broadcast','presence')
);

create policy "gc hangout realtime authenticated write"
on realtime.messages
for insert to authenticated
with check (
  (select realtime.topic()) in ('gc-hangout:main', 'gc-hangout-game:main')
  and extension in ('broadcast','presence')
);

alter table public.gc_music_votes
  drop constraint if exists gc_music_votes_action_check;

alter table public.gc_music_votes
  add constraint gc_music_votes_action_check
  check (action in ('pause','resume','skip','delete'));

create or replace function public.gc_music_delete_vote(p_track_id uuid)
returns public.gc_music_state
language plpgsql
security definer
set search_path=public
as $$
declare
  v_state public.gc_music_state;
  v_active integer;
  v_votes integer;
  v_required integer;
  v_next uuid;
  v_now timestamptz := now();
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;

  select * into v_state
  from public.gc_music_state
  where room_id='main'
  for update;

  if not exists (
    select 1 from public.gc_music_tracks
    where id=p_track_id and room_id='main' and status='ready' and expires_at>v_now
  ) then
    return v_state;
  end if;

  insert into public.gc_music_votes(room_id,track_id,action,user_id)
  values('main',p_track_id,'delete',auth.uid())
  on conflict do nothing;

  delete from public.gc_room_sessions
  where room_id='main' and last_seen<v_now-interval '20 seconds';

  insert into public.gc_room_sessions(room_id,user_id,last_seen)
  values('main',auth.uid(),v_now)
  on conflict(room_id,user_id) do update set last_seen=excluded.last_seen;

  delete from public.gc_music_votes
  where room_id='main'
    and track_id=p_track_id
    and user_id not in (
      select user_id from public.gc_room_sessions
      where room_id='main' and last_seen>=v_now-interval '20 seconds'
    );

  select count(*)::integer into v_active
  from public.gc_room_sessions
  where room_id='main' and last_seen>=v_now-interval '20 seconds';

  v_active:=greatest(v_active,1);
  v_required:=ceil(v_active/2.0);

  select count(*)::integer into v_votes
  from public.gc_music_votes
  where room_id='main' and track_id=p_track_id and action='delete';

  if v_votes<v_required then
    update public.gc_music_state
      set revision=revision+1,updated_at=v_now
      where room_id='main'
      returning * into v_state;
    return v_state;
  end if;

  delete from public.gc_music_queue where room_id='main' and track_id=p_track_id;
  update public.gc_music_tracks
    set status='deleted'
    where id=p_track_id and room_id='main';

  if v_state.current_track_id is distinct from p_track_id then
    update public.gc_music_state
      set revision=revision+1,updated_at=v_now
      where room_id='main'
      returning * into v_state;
  else
    select q.track_id into v_next
    from public.gc_music_queue q
    join public.gc_music_tracks t on t.id=q.track_id
    where q.room_id='main' and t.status='ready' and t.expires_at>v_now
    order by q.queue_position
    limit 1;

    if v_next is not null then
      delete from public.gc_music_queue where room_id='main' and track_id=v_next;
      update public.gc_music_state
        set current_track_id=v_next,status='playing',position=0,started_at=v_now,
            revision=revision+1,updated_at=v_now
        where room_id='main'
        returning * into v_state;
    else
      update public.gc_music_state
        set current_track_id=null,status='stopped',position=0,started_at=null,
            revision=revision+1,updated_at=v_now
        where room_id='main'
        returning * into v_state;
    end if;
  end if;

  delete from public.gc_music_votes where room_id='main' and track_id=p_track_id;
  return v_state;
end $$;

revoke all on function public.gc_music_delete_vote(uuid) from public,anon;
grant execute on function public.gc_music_delete_vote(uuid) to authenticated;
