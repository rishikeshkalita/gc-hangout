-- GC Hangout Realtime uses private channels because this project does not expose public Realtime channels.
-- The browser uses the publishable key (anon role), so scope access to the two fixed room topics.

create policy "gc_hangout_realtime_anon_read"
on realtime.messages
for select
to anon
using (
  (select realtime.topic()) in ('gc-hangout:main', 'gc-hangout-game:main')
  and extension in ('broadcast', 'presence')
);

create policy "gc_hangout_realtime_anon_write"
on realtime.messages
for insert
to anon
with check (
  (select realtime.topic()) in ('gc-hangout:main', 'gc-hangout-game:main')
  and extension in ('broadcast', 'presence')
);
