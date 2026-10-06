-- Applied to Supabase project ypfrlglzblxcsilzkomx on 2026-10-06.
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
