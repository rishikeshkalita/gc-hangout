-- Shared uploaded music wave: room library, queue, voting, expiry and native playback state.

create table if not exists public.gc_music_tracks (
  id uuid primary key default gen_random_uuid(),
  room_id text not null default 'main',
  uploader_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  artist text not null default 'Unknown artist',
  filename text not null,
  mime_type text not null,
  file_size bigint not null check (file_size > 0 and file_size <= 26214400),
  duration double precision not null default 0 check (duration >= 0),
  storage_path text not null unique,
  uploaded_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '72 hours'),
  status text not null default 'uploading' check (status in ('uploading','ready','expired','invalid','deleted')),
  created_at timestamptz not null default now()
);

create table if not exists public.gc_music_queue (
  id uuid primary key default gen_random_uuid(),
  room_id text not null default 'main',
  track_id uuid not null references public.gc_music_tracks(id) on delete cascade,
  added_by uuid not null references auth.users(id) on delete cascade,
  queue_position bigint not null,
  created_at timestamptz not null default now()
);

create table if not exists public.gc_music_state (
  room_id text primary key,
  current_track_id uuid references public.gc_music_tracks(id) on delete set null,
  status text not null default 'stopped' check (status in ('playing','paused','stopped')),
  position double precision not null default 0 check (position >= 0),
  started_at timestamptz,
  volume double precision not null default 0.8 check (volume >= 0 and volume <= 1),
  revision bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.gc_music_votes (
  room_id text not null default 'main',
  track_id uuid not null references public.gc_music_tracks(id) on delete cascade,
  action text not null check (action in ('pause','resume','skip')),
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(room_id,track_id,action,user_id)
);

create table if not exists public.gc_room_sessions (
  room_id text not null default 'main',
  user_id uuid not null references auth.users(id) on delete cascade,
  last_seen timestamptz not null default now(),
  primary key(room_id,user_id)
);

create index if not exists gc_music_tracks_room_status_idx on public.gc_music_tracks(room_id,status,expires_at);
create index if not exists gc_music_queue_room_idx on public.gc_music_queue(room_id,queue_position);
create unique index if not exists gc_music_queue_unique_track on public.gc_music_queue(room_id,track_id);

alter table public.gc_music_tracks enable row level security;
alter table public.gc_music_queue enable row level security;
alter table public.gc_music_state enable row level security;
alter table public.gc_music_votes enable row level security;
alter table public.gc_room_sessions enable row level security;

drop policy if exists "gc music tracks authenticated read" on public.gc_music_tracks;
create policy "gc music tracks authenticated read" on public.gc_music_tracks for select to authenticated
using (room_id='main' and status='ready' and expires_at > now());

drop policy if exists "gc music tracks authenticated own insert" on public.gc_music_tracks;
create policy "gc music tracks authenticated own insert" on public.gc_music_tracks for insert to authenticated
with check (room_id='main' and uploader_id=(select auth.uid()) and file_size <= 26214400);

drop policy if exists "gc music tracks authenticated own update" on public.gc_music_tracks;
create policy "gc music tracks authenticated own update" on public.gc_music_tracks for update to authenticated
using (uploader_id=(select auth.uid())) with check (uploader_id=(select auth.uid()));

drop policy if exists "gc music queue authenticated read" on public.gc_music_queue;
create policy "gc music queue authenticated read" on public.gc_music_queue for select to authenticated using (room_id='main');

drop policy if exists "gc music state authenticated read" on public.gc_music_state;
create policy "gc music state authenticated read" on public.gc_music_state for select to authenticated using (room_id='main');

drop policy if exists "gc music votes authenticated read" on public.gc_music_votes;
create policy "gc music votes authenticated read" on public.gc_music_votes for select to authenticated using (room_id='main');

drop policy if exists "gc room sessions authenticated own" on public.gc_room_sessions;
create policy "gc room sessions authenticated own" on public.gc_room_sessions for all to authenticated
using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()));

insert into public.gc_music_state(room_id) values ('main') on conflict do nothing;

update storage.buckets set
  public=false,
  file_size_limit=26214400,
  allowed_mime_types=array['audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav','audio/flac','audio/x-flac']
where id='gc-music';

drop policy if exists "gc music authenticated read" on storage.objects;
create policy "gc music authenticated read" on storage.objects for select to authenticated
using (bucket_id='gc-music');

drop policy if exists "gc music authenticated upload" on storage.objects;
create policy "gc music authenticated upload" on storage.objects for insert to authenticated
with check (bucket_id='gc-music' and (storage.foldername(name))[1]='main' and (storage.foldername(name))[2]=(select auth.uid())::text);

drop policy if exists "gc music authenticated delete own" on storage.objects;
create policy "gc music authenticated delete own" on storage.objects for delete to authenticated
using (bucket_id='gc-music' and (storage.foldername(name))[1]='main' and (storage.foldername(name))[2]=(select auth.uid())::text);

create or replace function public.gc_music_heartbeat(p_room_id text default 'main')
returns void language plpgsql security definer set search_path=public as $$
begin
  if auth.uid() is null or p_room_id <> 'main' then raise exception 'not authorized'; end if;
  insert into public.gc_room_sessions(room_id,user_id,last_seen) values('main',auth.uid(),now())
  on conflict(room_id,user_id) do update set last_seen=excluded.last_seen;
end $$;

create or replace function public.gc_music_begin_upload(p_title text,p_artist text,p_filename text,p_mime_type text,p_file_size bigint)
returns table(track_id uuid,storage_path text,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare v_id uuid:=gen_random_uuid(); v_path text; v_used bigint; v_count integer;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_file_size<=0 or p_file_size>26214400 then raise exception 'file exceeds 25 MB limit'; end if;
  if p_mime_type not in ('audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav','audio/flac','audio/x-flac') then raise exception 'unsupported audio type'; end if;
  select count(*),coalesce(sum(file_size),0) into v_count,v_used from public.gc_music_tracks where room_id='main' and status in ('uploading','ready') and expires_at>now();
  if v_count>=100 then raise exception 'room music library is full'; end if;
  if v_used+p_file_size>1073741824 then raise exception 'room music storage limit reached'; end if;
  v_path:='main/'||auth.uid()::text||'/'||v_id::text;
  insert into public.gc_music_tracks(id,room_id,uploader_id,title,artist,filename,mime_type,file_size,storage_path,expires_at,status)
  values(v_id,'main',auth.uid(),left(coalesce(nullif(trim(p_title),''),p_filename),100),left(coalesce(nullif(trim(p_artist),''),'Unknown artist'),100),left(p_filename,255),p_mime_type,p_file_size,v_path,now()+interval '72 hours','uploading');
  return query select v_id,v_path,now()+interval '72 hours';
end $$;

create or replace function public.gc_music_finalize_upload(p_track_id uuid,p_duration double precision default 0)
returns public.gc_music_tracks language plpgsql security definer set search_path=public as $$
declare v_track public.gc_music_tracks;
begin
  update public.gc_music_tracks set status='ready',duration=greatest(0,coalesce(p_duration,0))
  where id=p_track_id and uploader_id=auth.uid() and status='uploading' returning * into v_track;
  if v_track.id is null then raise exception 'track not found'; end if;
  return v_track;
end $$;

create or replace function public.gc_music_abort_upload(p_track_id uuid)
returns void language plpgsql security definer set search_path=public as $$
begin delete from public.gc_music_tracks where id=p_track_id and uploader_id=auth.uid() and status='uploading'; end $$;

create or replace function public.gc_music_queue_track(p_track_id uuid)
returns public.gc_music_state language plpgsql security definer set search_path=public as $$
declare v_state public.gc_music_state; v_track public.gc_music_tracks; v_next bigint; v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  select * into v_track from public.gc_music_tracks where id=p_track_id and room_id='main' and status='ready' and expires_at>v_now for share;
  if v_track.id is null then raise exception 'track unavailable'; end if;
  select * into v_state from public.gc_music_state where room_id='main' for update;
  if v_state.current_track_id=p_track_id or exists(select 1 from public.gc_music_queue where room_id='main' and track_id=p_track_id) then return v_state; end if;
  if v_state.current_track_id is null then
    update public.gc_music_state set current_track_id=p_track_id,status='playing',position=0,started_at=v_now,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
  else
    select coalesce(max(queue_position),0)+1 into v_next from public.gc_music_queue where room_id='main';
    insert into public.gc_music_queue(room_id,track_id,added_by,queue_position) values('main',p_track_id,auth.uid(),v_next);
    update public.gc_music_state set revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
  end if;
  return v_state;
end $$;

create or replace function public.gc_music_vote(p_action text)
returns public.gc_music_state language plpgsql security definer set search_path=public as $$
declare v_state public.gc_music_state; v_active integer; v_votes integer; v_required integer; v_position double precision; v_next uuid; v_old uuid; v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_action not in ('pause','resume','skip') then raise exception 'invalid vote'; end if;
  select * into v_state from public.gc_music_state where room_id='main' for update;
  if v_state.current_track_id is null then return v_state; end if;
  v_old:=v_state.current_track_id;
  delete from public.gc_music_votes where room_id='main' and track_id=v_old and user_id=auth.uid() and action<>p_action;
  insert into public.gc_music_votes(room_id,track_id,action,user_id) values('main',v_old,p_action,auth.uid()) on conflict do nothing;
  delete from public.gc_room_sessions where room_id='main' and last_seen<v_now-interval '20 seconds';
  insert into public.gc_room_sessions(room_id,user_id,last_seen) values('main',auth.uid(),v_now) on conflict(room_id,user_id) do update set last_seen=excluded.last_seen;
  select count(*)::integer into v_active from public.gc_room_sessions where room_id='main' and last_seen>=v_now-interval '20 seconds';
  v_active:=greatest(v_active,1); v_required:=ceil(v_active/2.0);
  select count(*)::integer into v_votes from public.gc_music_votes where room_id='main' and track_id=v_old and action=p_action;
  if v_votes<v_required then
    update public.gc_music_state set revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
    return v_state;
  end if;
  if p_action='skip' then
    select q.track_id into v_next from public.gc_music_queue q join public.gc_music_tracks t on t.id=q.track_id
    where q.room_id='main' and t.status='ready' and t.expires_at>v_now order by q.queue_position limit 1;
    if v_next is not null then
      delete from public.gc_music_queue where room_id='main' and track_id=v_next;
      update public.gc_music_state set current_track_id=v_next,status='playing',position=0,started_at=v_now,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
    else
      update public.gc_music_state set current_track_id=null,status='stopped',position=0,started_at=null,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
    end if;
  else
    v_position:=greatest(0,v_state.position+case when v_state.status='playing' and v_state.started_at is not null then extract(epoch from(v_now-v_state.started_at)) else 0 end);
    if p_action='pause' then
      update public.gc_music_state set status='paused',position=v_position,started_at=null,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
    else
      update public.gc_music_state set status='playing',position=v_position,started_at=v_now,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
    end if;
  end if;
  delete from public.gc_music_votes where room_id='main' and track_id=v_old;
  return v_state;
end $$;

create or replace function public.gc_music_set_volume(p_volume double precision)
returns public.gc_music_state language plpgsql security definer set search_path=public as $$
declare v_state public.gc_music_state;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  update public.gc_music_state set volume=greatest(0,least(1,coalesce(p_volume,0.8))),revision=revision+1,updated_at=now() where room_id='main' returning * into v_state;
  return v_state;
end $$;

create or replace function public.gc_music_advance_if_current(p_track_id uuid)
returns public.gc_music_state language plpgsql security definer set search_path=public as $$
declare v_state public.gc_music_state; v_next uuid; v_now timestamptz:=now();
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  select * into v_state from public.gc_music_state where room_id='main' for update;
  if v_state.current_track_id is distinct from p_track_id then return v_state; end if;
  select q.track_id into v_next from public.gc_music_queue q join public.gc_music_tracks t on t.id=q.track_id
  where q.room_id='main' and t.status='ready' and t.expires_at>v_now order by q.queue_position limit 1;
  if v_next is not null then
    delete from public.gc_music_queue where room_id='main' and track_id=v_next;
    update public.gc_music_state set current_track_id=v_next,status='playing',position=0,started_at=v_now,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
  else
    update public.gc_music_state set current_track_id=null,status='stopped',position=0,started_at=null,revision=revision+1,updated_at=v_now where room_id='main' returning * into v_state;
  end if;
  delete from public.gc_music_votes where room_id='main' and track_id=p_track_id;
  return v_state;
end $$;

revoke all on function public.gc_music_heartbeat(text) from public,anon;
revoke all on function public.gc_music_begin_upload(text,text,text,text,bigint) from public,anon;
revoke all on function public.gc_music_finalize_upload(uuid,double precision) from public,anon;
revoke all on function public.gc_music_abort_upload(uuid) from public,anon;
revoke all on function public.gc_music_queue_track(uuid) from public,anon;
revoke all on function public.gc_music_vote(text) from public,anon;
revoke all on function public.gc_music_set_volume(double precision) from public,anon;
revoke all on function public.gc_music_advance_if_current(uuid) from public,anon;

grant execute on function public.gc_music_heartbeat(text) to authenticated;
grant execute on function public.gc_music_begin_upload(text,text,text,text,bigint) to authenticated;
grant execute on function public.gc_music_finalize_upload(uuid,double precision) to authenticated;
grant execute on function public.gc_music_abort_upload(uuid) to authenticated;
grant execute on function public.gc_music_queue_track(uuid) to authenticated;
grant execute on function public.gc_music_vote(text) to authenticated;
grant execute on function public.gc_music_set_volume(double precision) to authenticated;
grant execute on function public.gc_music_advance_if_current(uuid) to authenticated;

alter table public.gc_music_state replica identity full;
alter table public.gc_music_queue replica identity full;
alter table public.gc_music_tracks replica identity full;

do $$
begin
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gc_music_state') then alter publication supabase_realtime add table public.gc_music_state; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gc_music_queue') then alter publication supabase_realtime add table public.gc_music_queue; end if;
  if not exists(select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='gc_music_tracks') then alter publication supabase_realtime add table public.gc_music_tracks; end if;
end $$;
