-- Fix gc_music_begin_upload: qualify expires_at/file_size table references.
-- The function returns a column named expires_at, which otherwise conflicts
-- with the gc_music_tracks.expires_at column under PL/pgSQL name resolution.

create or replace function public.gc_music_begin_upload(p_title text,p_artist text,p_filename text,p_mime_type text,p_file_size bigint)
returns table(track_id uuid,storage_path text,expires_at timestamptz)
language plpgsql security definer set search_path=public as $$
declare
  v_id uuid:=gen_random_uuid();
  v_path text;
  v_used bigint;
  v_count integer;
begin
  if auth.uid() is null then raise exception 'not authorized'; end if;
  if p_file_size<=0 or p_file_size>26214400 then raise exception 'file exceeds 25 MB limit'; end if;
  if p_mime_type not in ('audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/ogg','audio/webm','audio/wav','audio/x-wav','audio/flac','audio/x-flac') then raise exception 'unsupported audio type'; end if;

  select count(*),coalesce(sum(t.file_size),0)
    into v_count,v_used
  from public.gc_music_tracks as t
  where t.room_id='main'
    and t.status in ('uploading','ready')
    and t.expires_at>now();

  if v_count>=100 then raise exception 'room music library is full'; end if;
  if v_used+p_file_size>1073741824 then raise exception 'room music storage limit reached'; end if;

  v_path:='main/'||auth.uid()::text||'/'||v_id::text;

  insert into public.gc_music_tracks(
    id,room_id,uploader_id,title,artist,filename,mime_type,file_size,storage_path,expires_at,status
  )
  values(
    v_id,'main',auth.uid(),
    left(coalesce(nullif(trim(p_title),''),p_filename),100),
    left(coalesce(nullif(trim(p_artist),''),'Unknown artist'),100),
    left(p_filename,255),p_mime_type,p_file_size,v_path,now()+interval '72 hours','uploading'
  );

  return query select v_id,v_path,now()+interval '72 hours';
end $$;
