# GC Hangout — Full Rebuild Roadmap & Living Checklist

> **Status:** REBUILD PLANNING / BASELINE  
> **Repository:** `rishikeshkalita/gc-hangout`  
> **Canonical branch:** `main`  
> **Development Vercel deployments:** **0 by default**  
> **Deployment rule:** deploy only when a real remote/iPhone test is necessary; otherwise stay local.  
> **Acceptance rule:** runtime behavior, not source-code existence.

## Core rules

- [ ] Rebuild the broken game runtime instead of continuing the old architecture.
- [ ] Audit and preserve useful infrastructure: Supabase, database/data, auth, environment configuration, Vercel project, GitHub history, working credentials/provider configuration.
- [ ] Do not delete production data or infrastructure without a specific reason.
- [ ] One authoritative implementation per system: player, movement, camera, interaction, multiplayer, music, chat, voice, HUD.
- [ ] No `V2`, `Fallback`, `Restored`, `Legacy`, or competing runtime paths.
- [ ] Critical player/world assets must be reliable and independently loaded.
- [ ] Decorative asset failure must never destroy the game.
- [ ] Local player appears immediately and independently of movement/network callbacks.
- [ ] Gameplay state and UI state remain separate.
- [ ] Automated tests do not equal gameplay verification.
- [ ] Never claim a feature works without observing/testing the behavior.
- [ ] Required status vocabulary: **PASS / FAIL / NOT VERIFIED / NOT AVAILABLE**.

---

# Rebuild Waves

We use **7 larger waves**, not dozens of tiny tasks. Each wave bundles related systems, gets tested locally, and then becomes a stable checkpoint.

## WAVE 1 — AUDIT + CLEAN FOUNDATION

**Goal:** understand what survives and remove the broken runtime foundation.

### Checklist

- [ ] Audit repository, branches, recent commits, dependencies and entry points.
- [ ] Audit Supabase/database/auth/storage/realtime.
- [ ] Audit Vercel/environment configuration.
- [ ] Audit music-provider configuration.
- [ ] Identify infrastructure to KEEP / MODIFY / REMOVE.
- [ ] Confirm `main` as rebuild base.
- [ ] Identify unnecessary branches; preserve history, delete only after audit.
- [ ] Remove obsolete/competing game-runtime paths.
- [ ] Remove stale references such as `RestoredHuman`.
- [ ] Remove competing player/camera/movement implementations.
- [ ] Establish clean GameShell/module boundaries.
- [ ] Create the new Three.js/R3F scene.
- [ ] Create large room/floor/walls.
- [ ] Create deterministic local-player state.
- [ ] Add one reliable human avatar.
- [ ] Add basic movement and third-person camera.
- [ ] Add basic room collision/bounds.
- [ ] No chat/music/voice/multiplayer yet.

### Gate

- [ ] Human appears immediately.
- [ ] Human is not a capsule.
- [ ] Player walks.
- [ ] Camera follows/rotates.
- [ ] Player stays in room.
- [ ] No fatal runtime errors.
- [ ] `npm test` passes.
- [ ] `npm run build` passes.
- [ ] Browser test performed if available.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 2 — WORLD + PLAYER + CAMERA + INTERACTION FOUNDATION

**Goal:** turn the foundation into the actual playable hangout space.

### World

- [ ] Large open central hall.
- [ ] Functional zones: TV, sofas, chairs, dining, food, drinks, beds/rest, greenery/decor.
- [ ] 2+ sofas.
- [ ] Chairs/dining chairs.
- [ ] Dining table.
- [ ] Coffee tables.
- [ ] Beds.
- [ ] TV/stand.
- [ ] Lamps/shelves/rugs.
- [ ] Plants/greenery.
- [ ] Proper room boundaries.
- [ ] Open walking space.

### Assets/performance

- [ ] Critical assets local/bundled where practical.
- [ ] Remove critical dependency on `cdn.3dassets.dev`.
- [ ] Asset loading has loading/success/failure states.
- [ ] Decorative failures are isolated.
- [ ] Core assets load before decoration.
- [ ] Avoid eager loading of unnecessary GLBs.
- [ ] Mobile memory/draw-call budget considered.

### Player/camera

- [ ] Reliable human model.
- [ ] Idle/walk/turn.
- [ ] Smooth acceleration/deceleration.
- [ ] Natural walking speed.
- [ ] No jitter/vibration/snapping.
- [ ] One camera controller.
- [ ] Desktop camera controls.
- [ ] Mobile gameplay-area drag.
- [ ] Zoom limits.
- [ ] Wall/furniture obstacle handling.
- [ ] Room-boundary camera control.
- [ ] UI does not steal camera gestures.

### Interaction foundation

- [ ] Generic interaction-anchor model.
- [ ] SIT / SLEEP / EAT / DRINK / WATCH_TV / INTERACT.
- [ ] Reserve → stop → align → animate → sync → release lifecycle.
- [ ] No hard-coded button-handler offsets.
- [ ] Interaction failure restores movement.

### Gate

- [ ] World visibly resembles a real hangout game.
- [ ] Player can explore all zones.
- [ ] Camera works throughout the hall.
- [ ] Core assets survive optional asset failures.
- [ ] Automated tests/build pass.
- [ ] Browser test performed if available.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 3 — ALL CORE INTERACTIONS

**Goal:** make the room genuinely playable before adding social systems.

### Sitting

- [ ] Sofa anchors.
- [ ] Sofa pelvis/seat alignment.
- [ ] Correct rotation/posture.
- [ ] No floating/sinking.
- [ ] Chair anchors.
- [ ] Dining-chair anchors.
- [ ] Correct seat height/pelvis/feet/back alignment.
- [ ] Stand restores movement.
- [ ] Seat occupancy/reservation.

### Sleeping

- [ ] Bed anchor.
- [ ] Genuine lying posture.
- [ ] Correct rotation.
- [ ] Head/pillow alignment.
- [ ] No floating/sinking.
- [ ] Exit restores movement.

### Food

- [ ] Visible pizza/chips/sandwich/burger/popcorn/cookies/fruit or equivalent.
- [ ] Pick up/eat interaction.
- [ ] Food reaches mouth.
- [ ] Eating animation.
- [ ] Return to idle.

### Drinks

- [ ] Water/soda/juice/coffee or equivalent.
- [ ] Pick up.
- [ ] Raise.
- [ ] Drink.
- [ ] Lower.
- [ ] Return to idle.

### TV

- [ ] TV interaction anchor.
- [ ] TV can display shared music information.
- [ ] Title.
- [ ] Artist.
- [ ] Playback state.
- [ ] Progress where appropriate.

### Gate

- [ ] Sofa works repeatedly.
- [ ] Chair works repeatedly.
- [ ] Dining works.
- [ ] Bed works.
- [ ] Eating works.
- [ ] Drinking works.
- [ ] TV works.
- [ ] No interaction causes runaway movement/stuck state.
- [ ] Automated tests/build pass.
- [ ] Browser test performed if available.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 4 — MUSIC + CHAT + VOICE + EMOTES

**Goal:** build the complete local social feature set before multiplayer synchronization.

### Music

- [ ] Existing legitimate provider works.
- [ ] Search works.
- [ ] Verified fallback query works when needed.
- [ ] Zero-result search does not falsely report provider failure.
- [ ] Track normalization validates ID/title/artist/HTTPS audio/duration/license.
- [ ] Play.
- [ ] Pause.
- [ ] Next.
- [ ] Current track.
- [ ] Playback position.
- [ ] Invalid tracks rejected.
- [ ] No fake URLs/catalog.

### Add Song

- [ ] Real audio file picker.
- [ ] MP3.
- [ ] WAV.
- [ ] M4A.
- [ ] AAC.
- [ ] OGG.
- [ ] WebM where supported.
- [ ] Correct audio MIME handling.
- [ ] Selected audio uploads/processes/plays.

### Chat

- [ ] Compact composer.
- [ ] Mobile-safe input size.
- [ ] No Safari zoom.
- [ ] Send.
- [ ] Blur/keyboard handling.
- [ ] Temporary stacked notifications.
- [ ] Notifications do not block gameplay/camera/joystick.
- [ ] No duplicate listeners/messages.

### Voice

- [ ] OFF.
- [ ] REQUESTING.
- [ ] LIVE.
- [ ] MUTED.
- [ ] ERROR.
- [ ] DISCONNECTED.
- [ ] Actual audio transport.
- [ ] Permission handling.
- [ ] Mute/unmute logic.
- [ ] Clean disconnect.
- [ ] No giant permission/error overlay.

### Emotes

- [ ] Dance.
- [ ] Wave.
- [ ] Clap.
- [ ] Movement locking.
- [ ] Animation completion.
- [ ] Return to previous state.

### Gate

- [ ] Music actually plays.
- [ ] Add Song actually selects audio.
- [ ] Chat works without zoom.
- [ ] Voice transport is implemented; two-client verification reserved for Wave 6.
- [ ] Emotes actually animate.
- [ ] Automated tests/build pass.
- [ ] Browser test performed if available.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 5 — MULTIPLAYER + SHARED STATE

**Goal:** make the room genuinely shared.

### Multiplayer

- [ ] One multiplayer state authority.
- [ ] Supabase/shared room state integrated.
- [ ] Presence.
- [ ] Real online count.
- [ ] Join.
- [ ] Leave.
- [ ] Reconnect cleanup.
- [ ] No duplicate remote players.
- [ ] No stale remote players.
- [ ] Remote interpolation.
- [ ] No visible snapping.

### Synchronized player state

- [ ] ID/name.
- [ ] Position.
- [ ] Rotation.
- [ ] Animation.
- [ ] Interaction.
- [ ] Seat.
- [ ] Sleeping.
- [ ] Eating.
- [ ] Drinking.
- [ ] Emote.
- [ ] Relevant state required by the game.

### Shared social state

- [ ] Chat synchronized.
- [ ] Music track synchronized.
- [ ] Music play/pause synchronized.
- [ ] Music timestamp/reference synchronized.
- [ ] TV follows shared music state.
- [ ] Seat ownership authoritative.
- [ ] Interactions visible remotely.

### Gate

Two-client/local multi-instance testing:

- [ ] Player A sees Player B.
- [ ] B sees A.
- [ ] Both walk.
- [ ] Both see movement smoothly.
- [ ] Sit synchronizes.
- [ ] Sleep synchronizes.
- [ ] Eat/drink synchronize.
- [ ] Emotes synchronize.
- [ ] Chat synchronizes.
- [ ] Music synchronizes.
- [ ] Occupied seat cannot be double-claimed.
- [ ] Leave removes player.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 6 — MOBILE UX + PERFORMANCE + FULL QA

**Goal:** make the game reliable on the target device class before any release deployment.

### Mobile HUD

- [ ] World dominates screen.
- [ ] Compact top room/online display.
- [ ] Left joystick.
- [ ] Right interaction/emote/mic controls.
- [ ] Compact bottom music/chat.
- [ ] Add Song accessible.
- [ ] Safe areas.
- [ ] Notch/Dynamic Island.
- [ ] Safari controls.
- [ ] Small-screen layout.
- [ ] No giant panels.
- [ ] No gameplay-blocking errors.
- [ ] Touch/pointer architecture verified.

### Performance

- [ ] Core assets staged first.
- [ ] Decorations lazy-loaded.
- [ ] Reasonable polygon counts.
- [ ] Compressed/reused textures where appropriate.
- [ ] Limited dynamic lights.
- [ ] Optimized shadows.
- [ ] Reasonable draw calls.
- [ ] No unnecessary dependencies.
- [ ] Mobile memory pressure checked.

### Error handling

- [ ] Small temporary player-facing errors.
- [ ] Detailed diagnostics in console.
- [ ] Music failure is non-blocking.
- [ ] Voice failure is non-blocking.
- [ ] Decorative asset failure is non-blocking.
- [ ] No swallowed critical failures.

### QA

- [ ] Full automated tests.
- [ ] `npm test`.
- [ ] `npm run build`.
- [ ] Full browser flow.
- [ ] Console error review.
- [ ] Regression checklist.
- [ ] Visual acceptance.
- [ ] Two-client multiplayer.
- [ ] Two-client voice.
- [ ] Mobile input.
- [ ] Camera around boundaries/furniture.
- [ ] All interactions.

### Gate

- [ ] Every required feature = PASS.
- [ ] No required feature = FAIL.
- [ ] No required feature remains unverified.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 7 — RELEASE + REAL IPHONE ACCEPTANCE

**Goal:** use deployment only when a remote/iPhone test is genuinely required.

### Before deployment

- [ ] Freeze release candidate.
- [ ] Record commit SHA.
- [ ] Confirm local build passes.
- [ ] Confirm tests pass.
- [ ] Confirm browser QA passes.
- [ ] Confirm environment variables.
- [ ] Confirm Supabase configuration.
- [ ] Confirm music provider configuration.
- [ ] Confirm no fatal runtime errors.
- [ ] Confirm development deployment count.

### Deployment

- [ ] Deploy to Vercel only if remote/iPhone testing requires it.
- [ ] Record deployment ID.
- [ ] Record URL.
- [ ] Record environment.
- [ ] Verify deployed SHA.
- [ ] **Do not deploy merely to debug local problems.**
- [ ] **Do not create repeated preview deployments.**

### Real iPhone acceptance

- [ ] Open game.
- [ ] Human appears.
- [ ] Large hall appears.
- [ ] Camera drag works.
- [ ] Walk.
- [ ] Sofa.
- [ ] Chair.
- [ ] Dining.
- [ ] Bed.
- [ ] Eat.
- [ ] Drink.
- [ ] TV/music.
- [ ] Add Song.
- [ ] Chat without zoom.
- [ ] Mic ON.
- [ ] Mic MUTED.
- [ ] Mic ON again.
- [ ] Dance.
- [ ] Wave.
- [ ] Clap.
- [ ] Second player joins.
- [ ] Movement synchronizes.
- [ ] Interactions synchronize.
- [ ] Music synchronizes.
- [ ] Chat synchronizes.
- [ ] Voice works.

### Release gate

If anything required fails:

**GAME = NOT VERIFIED**

---

# Deployment Policy

This replaces the previous overly rigid “one deployment only” wording.

### Default

**No Vercel deployment during development.**

Use:

- local dev server
- local production build
- automated tests
- browser automation
- local multi-client testing
- console/runtime diagnostics

### Deployment is allowed only when it adds information we cannot obtain locally

Examples:

- [ ] Real iPhone/Safari testing requires HTTPS/deployed environment.
- [ ] Vercel-specific runtime/environment behavior must be verified.
- [ ] Production integration needs one final remote test.

### Deployment is NOT justified for

- [ ] Checking whether a button renders.
- [ ] Checking a local TypeScript error.
- [ ] Checking a local build.
- [ ] Checking a camera change.
- [ ] Checking a CSS change.
- [ ] Checking an interaction that can be browser-tested locally.
- [ ] Debugging ordinary runtime errors.

**Deployment count is tracked in every wave log.**

---

# Regression Checklist

## World
- [ ] No empty/debug floor.
- [ ] No cramped hall.
- [ ] No missing furniture from one asset failure.
- [ ] No critical external GLB dependency.
- [ ] No eager asset overload.

## Player
- [ ] No capsule fallback as normal avatar.
- [ ] No unresolved `RestoredHuman`.
- [ ] No duplicate avatar implementations.
- [ ] Immediate local-player render.
- [ ] Decorative assets cannot destroy player.

## Movement/camera
- [ ] No jitter/vibration.
- [ ] No automatic running.
- [ ] No snapping.
- [ ] No outside-room camera.
- [ ] No competing camera controllers.
- [ ] UI cannot steal gameplay gestures.

## Interactions
- [ ] Sitting reliable.
- [ ] Correct pelvis/seat alignment.
- [ ] Bed posture correct.
- [ ] No floating/sinking.
- [ ] No stuck interaction.
- [ ] Seat ownership authoritative.

## Music
- [ ] No fake tracks/URLs.
- [ ] Provider search/fallback verified.
- [ ] Exact environment checked.
- [ ] Playback actually tested.

## Add Song
- [ ] Audio picker, not image/video picker.
- [ ] Supported formats work.
- [ ] Selected audio actually plays.

## Chat
- [ ] No Safari zoom.
- [ ] No giant panel.
- [ ] Notifications don't block gameplay.
- [ ] No duplicate listeners/messages.

## Voice
- [ ] Permission != voice verification.
- [ ] All voice states represented.
- [ ] Two-client audio verified.
- [ ] Mute actually stops outgoing audio.

## Multiplayer
- [ ] Remote players interpolate.
- [ ] No duplicates/stale players.
- [ ] Interactions synchronize.
- [ ] Presence/online count is real.

## QA
- [ ] Source existence never counted as gameplay verification.
- [ ] Deployed SHA/environment verified before diagnosing deployment behavior.

---

# Living Wave Log

**Update this section after every completed wave. Keep only one entry per wave.**

| Wave | Scope | Commit | Tests | Browser | Deployment | Status |
|---|---|---|---|---|---:|---|
| 1 | Audit + clean foundation | TBD | TBD | TBD | 0 | NOT STARTED |
| 2 | World + player + camera + interaction foundation | TBD | TBD | TBD | 0 | NOT STARTED |
| 3 | Core interactions | TBD | TBD | TBD | 0 | NOT STARTED |
| 4 | Music + chat + voice + emotes | TBD | TBD | TBD | 0 | NOT STARTED |
| 5 | Multiplayer + shared state | TBD | TBD | TBD | 0 | NOT STARTED |
| 6 | Mobile UX + performance + full QA | TBD | TBD | TBD | 0 | NOT STARTED |
| 7 | Release + iPhone acceptance | TBD | TBD | TBD | 0 / 1 | NOT STARTED |

### Wave update format

For every wave, record:

- **Commit**
- **What changed**
- **Tests**
- **Browser result**
- **Deployment count**
- **Known failures**
- **What is actually verified**
- **Next wave**

---

# Final Definition of Done

- [ ] Human appears immediately.
- [ ] Large furnished hall appears.
- [ ] Smooth movement.
- [ ] Smooth camera.
- [ ] Sofa/chair/dining interactions.
- [ ] Bed/sleep.
- [ ] Food/eating.
- [ ] Drinks/drinking.
- [ ] TV.
- [ ] Music playback.
- [ ] Add Song.
- [ ] Synchronized music.
- [ ] Chat without mobile zoom.
- [ ] Actual voice transport.
- [ ] Mute/unmute.
- [ ] Dance/wave/clap.
- [ ] Multiplayer presence.
- [ ] Remote movement/interactions.
- [ ] Compact mobile HUD.
- [ ] Reliable core assets.
- [ ] Automated tests pass.
- [ ] Production build passes.
- [ ] Browser verification passes or is explicitly unavailable.
- [ ] iPhone acceptance passes.
- [ ] No unsupported “working” claims.

> **Finish line:** A human player inside a large, beautiful hangout hall with smooth camera and movement, where people can actually hang out together.
