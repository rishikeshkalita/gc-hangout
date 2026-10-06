insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'gc-music',
  'gc-music',
  true,
  26214400,
  array[
    'audio/mpeg','audio/mp4','audio/x-m4a','audio/aac',
    'audio/ogg','audio/webm','audio/wav'
  ]
)
on conflict (id) do update
set public=true,
    file_size_limit=excluded.file_size_limit,
    allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists "gc music authenticated upload" on storage.objects;
create policy "gc music authenticated upload"
on storage.objects for insert to authenticated
with check (bucket_id='gc-music' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "gc music authenticated delete own" on storage.objects;
create policy "gc music authenticated delete own"
on storage.objects for delete to authenticated
using (bucket_id='gc-music' and (storage.foldername(name))[1]=auth.uid()::text);

drop policy if exists "gc music authenticated update own" on storage.objects;
create policy "gc music authenticated update own"
on storage.objects for update to authenticated
using (bucket_id='gc-music' and (storage.foldername(name))[1]=auth.uid()::text)
with check (bucket_id='gc-music' and (storage.foldername(name))[1]=auth.uid()::text);
