# GC Hangout engineering notes

The multiplayer layer uses Supabase Presence for slow-changing online/voice metadata and Broadcast for movement and transient interaction events. Exclusive interaction points use atomic Postgres leases so concurrent seat/bed claims resolve server-side.

Voice uses browser WebRTC with Supabase Broadcast signaling. Music is integrated through a server-side Jamendo catalog proxy and synchronizes track metadata and playback position; production playback requires the project's own Jamendo client ID and applicable licensing.

These notes describe architecture, not a substitute for runtime QA.
