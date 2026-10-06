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

The interface should stay out of the way, especially on iPhone.

Primary screen content:

**3D world + your avatar + other members**

Controls should be compact and secondary:

- [ ] 🎤 Voice.
- [ ] 💬 Chat.
- [ ] 🎵 Music.
- [ ] 🙂 Emotes.
- [ ] ⚙️ Settings.

### Mobile UI rules

- [ ] No giant panels covering the room.
- [ ] No traditional game HUD dominating the screen.
- [ ] Controls remain compact and reachable.
- [ ] Safe-area aware.
- [ ] Chat input does not trigger Safari zoom.
- [ ] UI does not steal gameplay camera gestures.
- [ ] Temporary notifications do not block movement.
- [ ] The world remains visually dominant.

**Experience target:** entering GC Hangout should feel like entering the group's shared virtual room, not opening a conventional game menu.

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
