# GC Hangout engineering notes

The multiplayer layer uses Supabase Presence for slow-changing online/voice metadata and Broadcast for movement and transient interaction events. Exclusive interaction points use atomic Postgres leases so concurrent seat/bed claims resolve server-side.

Voice uses browser WebRTC with Supabase Broadcast signaling. Music is integrated through a server-side Jamendo catalog proxy and synchronizes track metadata and playback position; production playback requires the project's own Jamendo client ID and applicable licensing.

These notes describe architecture, not a substitute for runtime QA.


## Quality hardening — 2026-10-06

- Player identity now uses Supabase anonymous authentication rather than a client-generated ID. Anonymous sign-ins must be enabled in Supabase Auth before joining production rooms.
- Interaction lease RPCs verify `auth.uid()` against the requested holder and are no longer executable by the unauthenticated `anon` role.
- The GC Hangout Realtime topic uses authenticated private-channel authorization for Broadcast and Presence.
- The 3D game is browser-only via a dynamic client import to prevent browser-only 3D dependencies from being evaluated during Next.js static generation.
- Music playback is synchronized through track metadata, start timestamp and playback position; actual catalog/playback requires the project's own Jamendo client ID and applicable licensing.
