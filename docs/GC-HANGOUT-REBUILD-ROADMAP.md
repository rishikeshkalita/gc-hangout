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
| 2 | World + player + camera + interaction foundation | `fb09cb656baf4ed2ca3d0ffb17cd95bccf5e0795` | `npm test` PASS; `npm run build` PASS; dependency audit PASS (CI run 37516254203) | NOT VERIFIED — latest iPhone correction still needs fresh device build | 2 attempted / 1 successful | NOT VERIFIED |
| 3 | Core interactions | TBD | TBD | TBD | 0 | NOT STARTED |
| 4 | Music + chat + voice + emotes | TBD | TBD | TBD | 0 | NOT STARTED |
| 5 | Multiplayer + shared state | TBD | TBD | TBD | 0 | NOT STARTED |
| 6 | Mobile UX + performance + full QA | TBD | TBD | TBD | 0 | NOT STARTED |
| 7 | Release + iPhone acceptance | TBD | TBD | TBD | 0 / 1 | NOT STARTED |

### Latest Wave 2 iPhone regression correction — 2026-10-06

- **User evidence reviewed:** five fresh iPhone Safari screenshots showing repeatable furniture-interaction failure. Sofa seating itself renders, but after tapping stand/exit the avatar can remain at the furniture and movement can stay stuck. Eating visibly places the avatar inside/through the dining table. The same exit/stuck behavior was reported for the other furniture interactions.
- **Additional visual observations:** the human avatar is visibly seated/posed, the TV surface reads correctly, the dining table/chairs are on the floor, and the room remains world-first; the screenshots exposed that interaction exit must restore a clean locomotion state and that interaction target positions must be separated from furniture trigger centers.
- **Root causes found in source inspection:** interaction alignment used furniture trigger centers as player positions, and the movement loop retained its own ref state without an explicit reset handshake after React interaction state changed on exit.
- **Correction branch:** `fix/wave2-interactions-graffiti`.
- **Merged implementation commit:** `ebef788b95cd47ac18274b53c749505e40525f4b` (squashed PR #8 into `main`).
- **Changes:** explicit interaction target/exit coordinates, safe exits for bed/table interactions, explicit movement-ref reset synchronization after release, joystick reset on exit, and the requested graffiti wall words with varied size/rotation/style plus splash marks.
- **Graffiti words:** Maksudai, Boineksudai, Rendi, sutamareni, koti mara, buskarpu, suor, kukur, notisuda, boinerlalak, renda, johra, sudhirbhai.
- **Automated verification:** GitHub Actions run `37511952691` on correction head `0a56d3b199cd83731d87c98ca39ddc3d8bcef810` completed PASS.
- **Browser result:** **NOT VERIFIED** for the merged correction. The supplied iPhone screenshots are the evidence that drove this fix; no fresh device build has been exercised after the merge.
- **Deployment:** no new deployment attempted; Vercel deployment quota remains exhausted from the prior testing window.
- **Current gate:** Wave 2 remains **NOT VERIFIED** until a fresh iPhone/browser build confirms every furniture exit restores movement and the avatar is positioned outside the furniture after interaction.
- **Next action:** when a deployment slot is available, run the complete interaction regression matrix below before allowing Wave 2 to move to PASS or Wave 3.

### Furniture interaction regression matrix — required next device test

- [ ] Sofa: walk to each sofa seat, sit, verify pelvis/feet/back alignment, stand, immediately walk in all four directions, repeat at least 3 times.
- [ ] Lounge sofa: same sit/stand/re-walk test from both ends.
- [ ] Dining chair: sit, stand, walk away without residual movement lock; repeat each chair/anchor.
- [ ] Eat: approach table, trigger Eat, verify avatar is beside/at the table rather than inside the tabletop, exit, walk away immediately.
- [ ] Drink: same enter/exit/re-walk test.
- [ ] Sleep: lie on bed, exit, verify movement and camera return; repeat.
- [ ] TV: interact, exit, verify movement and camera; repeat.
- [ ] Generic interaction: enter/exit and verify movement state is restored.
- [ ] Joystick: while standing after every exit, push up/down/left/right and verify the avatar travels in the same direction as the thumbstick.
- [ ] Camera: rotate after every exit; camera drag must not remain captured by the joystick or interaction button.
- [ ] Re-entry: after exiting one interaction, immediately enter a different furniture interaction and then exit again.
- [ ] Boundary recovery: walk from each furniture zone back into the central floor; no invisible movement lock or snapping.

### Latest Wave 2 interaction-state correction — 2026-10-07

- **User evidence reviewed:** six fresh iPhone Safari screenshots from the correction deployment.
- **Findings:** avatar no longer rotated during touch movement; sofa exit could strand the player between the sofa and coffee table; Eat showed only a hand-held food prop; dining Sit/Eat discovery still collided; Sleep made the avatar visually disappear on the bed.
- **Correction PR:** #10 — fix/wave2-interaction-state-20261007.
- **Merged implementation commit:** `5729eb2298da1a515699a0db037937f4ddac3c4e`.
- **Changes:** movement-facing rotation restored while keeping joystick input camera-relative; sofa exits moved to clear floor; interaction discovery is now type-aware with separate actionable buttons for concurrent Sit/Eat/Drink/etc. candidates; dining Sit radii tightened and Eat zone expanded; Eat gesture/prop refined; Sleep avatar vertical placement corrected so the lying avatar remains visible; post-exit facing made deterministic.
- **Automated verification:** GitHub Actions run `37518009063` completed PASS for dependency audit, `npm test`, and `npm run build`.
- **Browser result:** **NOT VERIFIED** for this correction. Fresh iPhone testing is still required.
- **Deployment:** no new Vercel deployment attempted; quota remains exhausted.
- **Current gate:** Wave 2 remains **NOT VERIFIED** until the corrected deployment passes the sofa-exit, multi-action dining, Eat, Sleep, and joystick regression matrix.

### Latest Wave 2 iPhone screenshot regression — 2026-10-07

- **User evidence reviewed:** six fresh iPhone Safari screenshots covering sofa seating, dining seating/eating/drinking, bed, TV, graffiti, and mobile movement.
- **Screenshot findings:**
  - Sofa: the Sit prompt was not reachable from every usable seat/approach; the sitting pose looked too upright/occluded by the sofa, with the avatar facing sideways on the earlier anchor setup.
  - Dining: only four of six physical chairs had Sit anchors. Eat/Drink competed with the dining Sit anchors, so the UI often selected **Sit** and the avatar entered a sitting pose instead of an eating/drinking pose.
  - Food/drink: no visible food or drink props were present on the table or in the interaction pose.
  - Bed: no interaction prompt appeared because the previous bed trigger was inside the bed collision volume, making the approach position unreachable.
  - TV: the Watch TV prompt and active interaction were visible and therefore the TV path is currently observable.
  - Joystick: the user still observed intermittent left/right inversion. The prior camera-relative movement calculation was correct mathematically, but touch movement also rotated the avatar continuously, making the visual direction feel inverted during camera/avatar orientation changes.
  - Speed: normal movement at 2.6 units/sec was reported as too slow.
- **Correction PR:** #9 — fix/wave2-interactions-movement-20261007.
- **Correction head:** f0e643723c1f35aeab9b80817094a308d699762e.
- **Changes:** separated trigger positions from interaction targets; added three seat anchors per sofa; added all six dining-chair anchors; moved the bed trigger outside the bed collision; separated Eat and Drink trigger zones from Sit; added visible food/drink props; improved seated pose and seat-facing rotation; increased normal speed to 3.8 units/sec and Shift speed to 5.2; stopped touch movement from continuously rotating the avatar.
- **Automated verification:** GitHub Actions run `37516254203` on the implementation head `f0e643723c1f35aeab9b80817094a308d699762e` completed PASS for dependency audit, `npm test`, and `npm run build`. The final merge commit also contains the roadmap-only update.
- **Browser result:** **NOT VERIFIED** for the correction. These screenshots are the current device evidence that drove the fix.
- **Deployment:** no new Vercel deployment attempted; deployment quota remains exhausted.
- **Current gate:** Wave 2 remains **NOT VERIFIED**. Do not start Wave 3 until the corrected build passes the full furniture/joystick regression matrix.

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
### Latest Wave 2 iPhone recording regression — 2026-10-07

- **User evidence reviewed:** full 85-second iPhone Safari screen recording, plus frame-by-frame inspection.
- **Confirmed failures:** touch avatar rotation was absent; sofa Sit coverage was incomplete; sofa exits could trap the avatar; both sofas faced the same direction and were too close; movement through the lounge was obstructed; Eat/Drink presentation remained incomplete; Sleep still made the avatar disappear; walking speed remained too slow; joystick direction remained unreliable.
- **Source causes:** touch movement skipped current.rot; both sofa instances used the same rotation and old spacing; sofa anchors/colliders matched the old geometry; coffee-table collision was missing; Sleep rotated the entire player visual/root around the floor origin.
- **Correction branch:** fix/wave2-final-interaction-pass-v2-20261007.
- **Correction commit:** 95462d66185ce4f80c802c6ff89c116e04e1011c.
- **Changes:** opposing sofas with a wider central passage; explicit coffee-table collision; six remapped sofa seat anchors; open sofa exits; touch movement now updates avatar facing from the actual movement vector; mobile speed raised to 5.2; Sleep uses a separate visual pivot so the player root remains stable; Eat remains a dedicated table-edge interaction separate from chair Sit.
- **Automated verification:** no new GitHub Actions run is available yet for this branch.
- **Browser result:** **NOT VERIFIED**; no fresh iPhone build has been deployed.
- **Deployment:** 0 new attempts; Vercel daily deployment quota remains exhausted.
- **Current gate:** **NOT VERIFIED**. Do not merge to main or start Wave 3 until the fresh device build passes the full furniture/movement matrix.
### Wave 2 interaction corrections — 2026-10-07 seating/joystick pass

- **New iPhone evidence:** seated posture is visible but too upright with feet hanging below the chair; left/right joystick movement is reversed; dining chair 3 can exit into the right-side obstacle; Sit is not reliably offered around all chairs; seated eating needs a direct action.
- **Interaction model correction:** Sit remains a contextual persistent bottom action whenever a seat is within a generous interaction radius. Seat anchors are centered on the actual furniture rather than requiring a narrow approach coordinate.
- **Dining correction:** all six chair interaction radii widened; front/back trigger points moved onto the chair approach; chair 3 exit moved away from the right-side obstacle; seated Eat action added and exposed separately above the Stand/Exit control.
- **Movement correction:** mobile joystick horizontal input is inverted in the movement mapping so physical left produces leftward movement and physical right produces rightward movement.
- **Pose correction:** seated visual offset lowered and limb bend reduced so the avatar sits deeper in the chair.
- **Current source commits:** b0acbe83764fbfbfc015d059fc3eca4920613614, 210044b6d6f9ae95556f59354edf8bcc4cab5ffc, 61e3674a1273ca53429158aea49fcca90b3fb2c5.
- **Verification:** no new workflow run is currently reported for the latest commit; fresh iPhone verification remains required.
- **Gate:** Wave 2 remains **NOT VERIFIED**. Do not merge or start Wave 3 until joystick direction, every chair, sofa seating, seated Eat, exits, and Sleep are re-tested on device.
### Wave 2 posture correction — 2026-10-07

- **Posture review:** latest iPhone evidence confirms sofa and dining-chair seating need different transforms; a single generic seated offset was not sufficient.
- **Sofa seat:** dedicated `seatStyle: "sofa"` with a higher/deeper seat placement and forward leg bend relative to the sofa cushion.
- **Dining chair:** dedicated `seatStyle: "chair"` with independent seat height and leg placement appropriate to the chair cushion.
- **Pose routing:** interaction anchors now select `sit-sofa` vs `sit-chair`; no longer relying on one global seated pose.
- **Verification:** GitHub Actions run 37570725743 is currently in progress for commit 0d5d2dc70f51fc0fbb5ef1054aaae3d8bf1cfbf8.
- **Device gate:** still NOT VERIFIED until fresh iPhone testing confirms both seating postures, all seat entry/exit paths, joystick direction, seated Eat, and Sleep.

### Wave 2 universal interaction control + exit hardening — 2026-10-07

- **iPhone evidence reviewed:** drink interaction can leave the avatar against the right-side collision boundary; sofa and chair seating remain visually misaligned.
- **Exit hardening:** Drink now exits into the open corridor; all interaction exits also pass through a safe-position resolver so a bad configured exit cannot leave the avatar permanently blocked.
- **Universal interaction control:** Sit/Sleep are no longer rendered as contextual bottom popups. A persistent circular action control beside Settings performs the nearest Sit/Sleep action; with no eligible seat/bed it is inert. While sitting/sleeping, the same control exits.
- **Posture pass:** raised the seated root and leg placement to keep hips/legs visually inside the furniture rather than below the chair/sofa.
- **Verification:** source change requires a fresh iPhone pass before Wave 2 can be marked verified.


### Wave 2 iPhone evidence follow-up — 2026-10-07

- **New iPhone screenshots reviewed:** universal interaction control, dining Eat, sofa Sit, chair Sit, and interaction exit states.
- **Confirmed visual/UX issues:** seated sofa/chair posture still needs another device pass; Eat/Drink currently show a held prop but need a clearer bite/drink motion; the old bottom exit/context popup was still present and is now removed for the main interaction lifecycle.
- **Universal control correction:** moved the persistent Sit/Sleep/Exit control to the lower-right safe-area region so the future top HUD remains available for chat and other social controls.
- **Popup correction:** removed the old generic interaction/exit popup from the main lifecycle. Seated Eat remains a dedicated action because it is a secondary activity, not Sit/Sleep.
- **Movement correction:** fixed the mobile joystick horizontal mapping so physical left maps left and physical right maps right; increased movement speed again for mobile/desktop.
- **Animation correction:** seated offsets were refined separately for sofas/chairs; Eat/Drink now animate the held prop toward the mouth during the gesture cycle rather than leaving it static in the hand.
- **Current implementation commits:** f94723c131b04df01f6e3347957b3001009da5dc, 2cf256d68eb8baa824befa2f997b83e0c29db4d6, 663e5d1f1ff58a8e7d926f8cd42e56ae96872b82.
- **Deployment:** 0 new Vercel deployment attempts.
- **Verification:** automated verification pending for this latest source; fresh iPhone verification required.
- **Gate:** Wave 2 remains **NOT VERIFIED**. Do not start Wave 3 until joystick direction, universal Sit/Sleep/Exit, sofa/chair posture, dining Eat/Drink, all seat entry/exit paths, and Sleep are re-tested on device.

### Vercel deployment policy correction — 2026-10-07

- **User instruction:** no unnecessary Vercel deployments during development.
- **Observed:** the linked Vercel/GitHub integration automatically attempted a PR preview after source changes, independent of a manual deployment request; that attempt failed because the Vercel daily deployment quota was exhausted.
- **Action:** preview deployments were disabled on the gc-hangout Vercel project to prevent further automatic PR preview deployments.
- **Development policy:** GitHub source + CI/build/tests are the default verification path. A Vercel deployment should only be created when explicitly needed for remote-device testing or Vercel-specific behavior.
- **Production/device status:** no new production deployment is being claimed; Wave 2 remains **NOT VERIFIED**.

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
