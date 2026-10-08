# GC Hangout engineering notes

The multiplayer layer uses Supabase Presence for slow-changing online/voice metadata and Broadcast for movement and transient interaction events. Exclusive interaction points use atomic Postgres leases so concurrent seat/bed claims resolve server-side.

Voice uses browser WebRTC with Supabase Broadcast signaling. Music uses native browser audio backed by a shared Supabase Storage library. Authenticated room members can upload supported audio up to 25 MB per file; tracks expire after 72 hours, room storage is capped at 1 GB and the library at 100 tracks. Postgres owns the shared queue/playback state and 50% pause/resume/skip votes; Realtime distributes state changes. Uploaded files are private and served to authenticated room members through signed URLs. A scheduled Supabase Edge Function removes expired files and advances playback when necessary.

These notes describe architecture, not a substitute for runtime QA. The music system is intentionally independent of the Music panel lifecycle; closing Music, Chat or Voice UI must not destroy the underlying audio or WebRTC engines.


## Quality hardening — 2026-10-06

- Player identity now uses Supabase anonymous authentication rather than a client-generated ID. Anonymous sign-ins must be enabled in Supabase Auth before joining production rooms.
- Interaction lease RPCs verify `auth.uid()` against the requested holder and are no longer executable by the unauthenticated `anon` role.
- The GC Hangout Realtime topic uses authenticated private-channel authorization for Broadcast and Presence.
- The 3D game is browser-only via a dynamic client import to prevent browser-only 3D dependencies from being evaluated during Next.js static generation.
- Music playback is synchronized through track metadata, server timestamps and playback position. Pause, resume and skip require at least 50% of active room sessions; automatic track completion advances the shared queue without a vote.
