# Wave 6 multiplayer reliability repair

## Confirmed failure modes

- The Realtime room channel was created only after anonymous Supabase Auth returned a user ID. If anonymous sign-in failed or stalled, the same gate disabled player transforms, chat, football snapshots, emotes, and WebRTC signaling together.
- The persisted music state pointed at a track whose 72-hour expiry had passed. The current-track query is protected by RLS and therefore returned no visible track; the room stayed paused on a track clients could no longer play.
- The UI treated the room audio element as already unlocked. Browsers do not guarantee that programmatic playback after an asynchronous database request is allowed, even if a previous screen button was clicked.
- Voice negotiation attempted peers that had not joined voice, and a transient WebRTC `disconnected` state immediately destroyed the peer connection.
- Database player fallback reads/writes were running at sub-second intervals while Realtime was already handling live transforms.

## Repair

- Start the room Broadcast/Presence channel independently of anonymous Auth. The room's game state is public by design; authenticated database access remains required for uploaded music and database snapshots.
- Retry transient anonymous-auth failures with backoff so the shared music library can recover without a reload.
- Advance a stale/expired current music track through the guarded database RPC, rather than leaving the room stuck on a track hidden by RLS.
- Do not claim audio is unlocked by default. Provide an explicit unlock action that can run before a track is loaded, and show a useful error if browser playback remains blocked.
- Negotiate WebRTC only with members whose Presence says voice is enabled, tolerate brief disconnections, and report autoplay/connection failures.
- Reduce database snapshot fallback traffic; Realtime remains the low-latency path.

## Verification status

- Automated CI and quality checks are required before merge.
- Production database inspection confirmed the stale current track and repaired the room state to `stopped` with no current track.
- Real two-device microphone/audio and movement verification requires active browser clients; server-side checks cannot prove device permissions, autoplay policy, or a particular NAT path.
- Production has `NEXT_PUBLIC_TURN_URLS`, `NEXT_PUBLIC_TURN_USERNAME`, and `NEXT_PUBLIC_TURN_CREDENTIAL` configured for WebRTC relay fallback.
