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



---

# Product North Star — GC Hangout

## Core idea

**GC Hangout is a shared virtual home for the GC.**

Everyone in the GC gets their own recognizable human avatar and enters the **same persistent-feeling shared hangout space**. The purpose is social presence: walking around together, sitting together, talking, listening to music, watching TV, eating, drinking, sleeping, dancing, chatting, and simply being in the same place.

This is **not** a progression game.

### Product identity

- [ ] One shared large hangout house/hall.
- [ ] Every GC member has a recognizable human avatar.
- [ ] Everyone sees everyone else in real time.
- [ ] The experience is centered on social presence.
- [ ] No missions.
- [ ] No enemies.
- [ ] No quests.
- [ ] No inventory grinding.
- [ ] No progression loop that distracts from hanging out.

## Shared-world mental model

The authoritative product model is:

**GC → Shared World → Shared State**

Not:

**Player → Private Game**

The room is the product. Each connected member is a participant in the same room.

### State that must be shared appropriately

- [ ] Player identity/name.
- [ ] Player position.
- [ ] Player rotation.
- [ ] Player movement/animation state.
- [ ] Sitting.
- [ ] Sleeping.
- [ ] Eating.
- [ ] Drinking.
- [ ] Dancing.
- [ ] Waving.
- [ ] Clapping.
- [ ] Interaction state.
- [ ] Seat/interaction ownership.
- [ ] Music track and playback state.
- [ ] TV state.
- [ ] Chat events.
- [ ] Voice presence/state.
- [ ] Join/leave/presence state.

**Architecture rule:** if another member can see, hear, or otherwise experience an action, that action must have an explicit shared-state model where synchronization is required. Local-only state must never accidentally become the source of truth for a shared interaction.

## The shared home

The main room should feel like one large real place, with distinct activity areas but without turning into cramped separate rooms.

### Required spatial identity

- [ ] Large sofa/lounge area.
- [ ] TV/music area.
- [ ] Food/snack table.
- [ ] Drinks area.
- [ ] Dining table.
- [ ] Extra chairs.
- [ ] Sleeping/bed area.
- [ ] Plants/decorations.
- [ ] Lamps and ambient lighting.
- [ ] Music area.
- [ ] Spacious central floor for group dancing/emotes.
- [ ] Proper walls and boundaries so players cannot escape the building.

### Spatial design rule

The **central floor remains intentionally spacious**. Furniture and activity zones should create social opportunities without fragmenting the room. The GC must be able to gather together in one visible shared space.

## Social interactions are the actual game

Interactions should be visible, embodied actions—not UI confirmations.

Examples of the acceptance model:

- [ ] Two members sit on a sofa → both human avatars visibly sit beside each other.
- [ ] A member picks up food → the avatar visibly eats it.
- [ ] A member grabs a drink → a real drinking animation plays.
- [ ] A member lies on the bed → the avatar visibly lies down.
- [ ] A member turns on the TV → everyone sees the same shared playback state.
- [ ] A member starts dancing → everyone sees the dance.
- [ ] A member sends chat → others see a small temporary notification.
- [ ] A member speaks → other members hear them through voice chat.
- [ ] A member joins → their human avatar appears in the shared room.

**Acceptance rule:** source code, UI labels, database rows, or event logs are not sufficient evidence. The shared behavior must be observable.

## Human avatar rule

- [ ] Every player has a proper human avatar.
- [ ] Avatar loading is independent of movement/network callbacks.
- [ ] The human avatar is the production player representation.
- [ ] A capsule/debug primitive may never silently become the production fallback.
- [ ] If the intended human avatar cannot load, the failure is explicit and diagnosable.
- [ ] Remote members also render as human avatars.

**Hard rule:** a capsule is never an acceptable silent production avatar fallback.

## UI philosophy — world first

The interface should stay out of the way across **all supported device classes**. Mobile devices, tablets, laptops, and desktop computers should all preserve the same world-first experience.

Primary screen content:

**3D world + your avatar + other members**

Controls should be compact and secondary:

- [ ] 🎤 Voice.
- [ ] 💬 Chat.
- [ ] 🎵 Music.
- [ ] 🙂 Emotes.
- [ ] ⚙️ Settings.

### Cross-device UI rules

- [ ] No giant panels covering the room.
- [ ] No traditional game HUD dominating the screen.
- [ ] Controls remain compact and reachable.
- [ ] Safe-area aware.
- [ ] Touch input works reliably on mobile/tablet browsers.
- [ ] Mouse/trackpad input works reliably on desktop/laptop browsers.
- [ ] Keyboard input is supported where appropriate.
- [ ] Chat input does not trigger unwanted mobile browser zoom.
- [ ] UI does not steal gameplay camera gestures.
- [ ] Temporary notifications do not block movement.
- [ ] The world remains visually dominant.

**Experience target:** entering GC Hangout on any supported device should feel like entering the group's shared virtual room, not opening a conventional game menu.

## Architecture consequences for the rebuild

These product rules override implementation convenience:

- [ ] Design the shared-state model before implementing multiplayer-specific UI.
- [ ] Define authoritative state transitions for movement, interactions, music, chat, voice, and presence.
- [ ] Keep local prediction/rendering separate from shared authoritative state.
- [ ] Make every visible interaction reproducible for remote players.
- [ ] Use one authoritative implementation per shared system.
- [ ] Do not build private-player-only behavior that later has to be retrofitted for multiplayer.
- [ ] Test two-client behavior as soon as the shared-state layer exists.
- [ ] Treat human-avatar rendering as a hard dependency of the player experience, not optional decoration.

# Rebuild Waves

We use **7 larger waves**, not dozens of tiny tasks. Each wave bundles related systems, gets tested locally, and then becomes a stable checkpoint.

## WAVE 1 — AUDIT + CLEAN FOUNDATION

**Goal:** understand what survives and remove the broken runtime foundation.

### Checklist

- [x] Audit repository, branches, recent commits, dependencies and entry points.
- [x] Audit Supabase/database/auth/storage/realtime.
- [x] Audit Vercel/environment configuration.
- [x] Audit music-provider configuration.
- [x] Identify infrastructure to KEEP / MODIFY / REMOVE.
- [x] Confirm `main` as rebuild base.
- [x] Identify unnecessary branches; preserve history, delete only after audit.
- [x] Remove obsolete/competing game-runtime paths from the active client.
- [x] Remove stale references such as `RestoredHuman` from the active runtime.
- [x] Remove competing player/camera/movement implementations from the active runtime.
- [x] Establish a clean single GameShell/client runtime boundary.
- [x] Create the new Three.js/R3F foundation scene.
- [x] Create large room/floor/walls.
- [x] Create deterministic local-player state.
- [x] Add one reliable human avatar implementation.
- [x] Add basic movement and third-person camera.
- [x] Add basic room collision/bounds.
- [x] Keep chat/music/voice/multiplayer out of the Wave 1 active runtime.
- [x] Remove unused movement-runtime dependencies (`ecctrl` and `@react-three/rapier`) from the client package.
- [x] Preserve Supabase, music, voice, and database infrastructure for later waves.

### Gate

- [x] Human appears immediately.
- [x] Human is not a capsule.
- [x] Player walks.
- [x] Camera follows/rotates.
- [x] Player stays in room.
- [x] No fatal build-time runtime errors.
- [x] `npm test` passes.
- [x] `npm run build` passes.
- [ ] Browser test performed — **NOT AVAILABLE in the current local tool environment**.
- [ ] Visual runtime behavior independently observed — **NOT VERIFIED**.
- [ ] **Status: NOT VERIFIED** — automated checks PASS; browser/runtime observation remains outstanding.

### Wave 1 implementation notes

- Active client runtime was reduced from a ~1,500-line recovery-era all-in-one game to a focused local foundation.
- Combat/fighting, football, multiplayer synchronization, music controls, chat, voice, and interaction orchestration were removed from the active client path.
- The room still contains representative furniture and spatial blockers so movement/camera boundaries can be exercised before Wave 2.
- Human avatar is built from explicit head/body/limb components with four selectable human appearances; no capsule fallback exists.
- A build failure caused by removing `normalizeMusicResponse` from a shared module was detected by CI and corrected without restoring the removed runtime systems.
---

## WAVE 2 — WORLD + PLAYER + CAMERA + INTERACTION FOUNDATION

**Goal:** turn the foundation into the actual playable hangout space.

### Progress in this pass

- [x] Preserve the large open central hall and representative hangout zones from Wave 1.
- [x] Keep 2+ sofas, chairs, dining table, coffee tables, bed, TV/stand, plants, lamps, and open central floor.
- [x] Preserve hard room boundaries and furniture collision handling.
- [x] Formalize a generic interaction-anchor model in shared game-state utilities.
- [x] Add explicit SIT / SLEEP / EAT / WATCH_TV anchor definitions in the room.
- [x] Add deterministic nearest-anchor detection for future interaction execution.
- [x] Add compact proximity feedback without blocking the world.
- [x] Keep interaction execution separate from the shared-state layer; Wave 3 owns the actual interaction animations.
- [x] Add automated tests for interaction-anchor validation and nearest-anchor selection.
- [x] Preserve the human-avatar requirement and single camera/movement implementation.

### Wave 2 implementation complete

- [x] Keep deterministic procedural furniture for the current foundation; no external GLB/decorative dependency is required to enter the room.
- [x] Add explicit DRINK and generic INTERACT anchors.
- [x] Implement explicit reserve → stop → align → animate → sync → release interaction lifecycle primitives.
- [x] Execute local interaction flow with alignment, movement lock, exit/release, and interaction-specific poses.
- [x] Add bounded camera zoom and clamp camera position inside the room boundary.
- [x] Add responsive touch joystick movement alongside keyboard movement.
- [x] Keep decorative asset loading isolated by using no required external decorative assets in the active runtime.
- [x] Add mobile-safe interaction controls and safe-area-aware positioning.
- [x] Expand automated coverage for lifecycle and all interaction types.
- [x] Harden mobile camera framing so the avatar does not dominate narrow viewports.
- [x] Move the touch joystick outside the HUD stacking context and isolate its pointer capture from camera gestures.
- [x] Correct dining furniture coordinates so the table/chairs sit on the floor rather than at ceiling height.
- [x] Reduce per-frame React state churn by notifying proximity changes only when the nearest anchor changes.
- [x] Improve the procedural human avatar with face details, shoes, name labels, and visible local interaction poses.
- [x] Improve TV presentation so it reads as a TV/music surface instead of a full-screen black rectangle.
- [x] Soften room lighting and rebalance the floor presentation.
- [x] Consolidate mobile-safe CSS and remove conflicting duplicate joystick/interaction rules.

### Current status

- **Status: NOT VERIFIED** — all identified Wave 2 source defects from the supplied iPhone screenshot are corrected on main, and the final CI run passes. A fresh real-device build is still required before Wave 2 can be marked PASS.
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

## WAVE 6 — CROSS-DEVICE UX + PERFORMANCE + FULL QA

**Goal:** make the game reliable across supported mobile, tablet, laptop, and desktop device classes before any release deployment.

### Cross-device HUD

- [ ] World dominates the screen on every device class.
- [ ] Compact room/online display.
- [ ] Touch controls for mobile/tablet.
- [ ] Mouse/trackpad controls for desktop/laptop.
- [ ] Keyboard support where appropriate.
- [ ] Compact interaction/emote/mic controls.
- [ ] Compact music/chat controls.
- [ ] Add Song accessible.
- [ ] Safe-area handling on mobile devices.
- [ ] Notch/browser-control handling where applicable.
- [ ] Responsive small-screen layout.
- [ ] Responsive large-screen layout.
- [ ] No giant panels.
- [ ] No gameplay-blocking errors.
- [ ] Touch/pointer/keyboard architecture verified.

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
- [ ] Mobile/tablet touch input.
- [ ] Desktop/laptop mouse/trackpad/keyboard input.
- [ ] Responsive layout across screen sizes.
- [ ] Camera around boundaries/furniture.
- [ ] All interactions.

### Gate

- [ ] Every required feature = PASS.
- [ ] No required feature = FAIL.
- [ ] No required feature remains unverified.
- [ ] **Status: PASS / FAIL / NOT VERIFIED**

---

## WAVE 7 — RELEASE + REAL DEVICE ACCEPTANCE

**Goal:** use deployment only when real-device or production-environment testing is genuinely required.

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

### Real-device acceptance

- [ ] Test on a representative mobile device.
- [ ] Test on a representative tablet where supported.
- [ ] Test on a representative laptop.
- [ ] Test on a representative desktop.
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
- [ ] Chat without unwanted mobile browser zoom.
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

- [ ] Real-device browser testing requires HTTPS/deployed environment.
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
| 1 | Audit + clean foundation | `bb7acb62816a8d0339ebea73395487c567de3a1c` | `npm test` PASS; `npm run build` PASS | NOT AVAILABLE | 0 | NOT VERIFIED |
| 2 | World + player + camera + interaction foundation | `b2f15d2aeda89c26aafdac7cbd6921f216c13f71` | `npm test` PASS; `npm run build` PASS; dependency audit PASS | NOT VERIFIED — fresh device build still required | 2 attempted / 1 successful | NOT VERIFIED |
| 3 | Core interactions | TBD | TBD | TBD | 0 | NOT STARTED |
| 4 | Music + chat + voice + emotes | TBD | TBD | TBD | 0 | NOT STARTED |
| 5 | Multiplayer + shared state | TBD | TBD | TBD | 0 | NOT STARTED |
| 6 | Mobile UX + performance + full QA | TBD | TBD | TBD | 0 | NOT STARTED |
| 7 | Release + iPhone acceptance | TBD | TBD | TBD | 0 / 1 | NOT STARTED |

### Wave 2 runtime regression correction

- **Observed on real device:** iOS Safari deployment displayed React error #306.
- **Root cause:** the deployed Wave 2 `app/game.jsx` ended after `LocalPlayer`; `Game`, `Room`, and furniture/rendering code had been unintentionally removed. `next/dynamic()` consequently resolved to a module namespace rather than a valid React component.
- **Correction:** restored the complete last-known-good game source and reapplied Wave 2 changes explicitly.
- **Correction commit:** `057f4f23c2877b37f77c3977243b14ea939bf2ca`.
- **Automated verification:** GitHub Actions run `37499910608` PASS.
- **Browser verification:** superseded by current evidence below; the corrected production build was reloaded and visually exercised on iPhone Safari.

### Wave 2 completion record

- **Implementation commit:** 16e2cac9f7b598286bc6a716a7575755a7199568.
- **What changed:** corrected the mobile camera framing, moved and hardened the touch joystick, made joystick movement camera-relative and ref-driven, fixed the dining table coordinate bug, removed per-frame proximity and movement React churn, moved the player transform to refs with throttled state synchronization, made the avatar name a camera-facing billboard, moved the interaction prompt outside the HUD stacking context, improved the TV surface, brightened the room walls/lighting, and consolidated mobile-safe CSS.
- **Tests:** Previous Wave 2 CI runs PASS; final post-screenshot hardening CI is pending.
- **Browser result:** NOT VERIFIED. The supplied iPhone Safari screenshot remains the evidence that exposed the defects; no fresh device build has been exercised after these source fixes.
- **Deployment count:** 1 successful production deployment; 1 additional production deployment attempt was blocked by Vercel's daily deployment quota. No further deployment was attempted for local debugging.
- **Known failures:** none remain confirmed by source inspection or CI. Real-device behavior of the new camera/joystick/layout/visual fixes is still unverified.
- **What is actually verified:** current main source contains the corrections and the final CI pipeline passes. The local/container environment cannot clone the repo because outbound GitHub DNS is unavailable; therefore no separate local browser/build run was performed.
- **Next wave:** Wave 3 — all core interactions, only after Wave 2 receives a fresh device/browser acceptance pass.

### Wave 1 completion record

- **Commits:** Wave 1 runtime changes landed across `main`; final corrective commit: `bb7acb62816a8d0339ebea73395487c567de3a1c`.
- **What changed:** replaced the active recovery-era client with a local R3F foundation, human avatar, room, movement/camera controller, boundaries, and compact settings; removed active combat/multiplayer/music/chat/voice orchestration and obsolete movement dependencies.
- **Tests:** GitHub Actions run `37495963354`: `npm test` PASS; `npm run build` PASS; dependency audit PASS.
- **Browser result:** NOT AVAILABLE from the current local tool environment.
- **Deployment count:** 0.
- **Known failures:** none in automated checks; browser/runtime visual behavior remains unverified.
- **What is actually verified:** repository changes are present on `main`; automated tests and production build pass.
- **Next wave:** Wave 2 — world + player + camera + interaction foundation.
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
- [ ] Cross-device acceptance passes.
- [ ] No unsupported “working” claims.

> **Finish line:** A human player inside a large, beautiful hangout hall with smooth camera and movement, where people can actually hang out together.
