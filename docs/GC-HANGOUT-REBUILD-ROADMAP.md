# GC Hangout — Full Rebuild Roadmap & Living Checklist

> **Status:** REBUILD PLANNING / BASELINE  
> **Repository:** `rishikeshkalita/gc-hangout`  
> **Default branch:** `main`  
> **Development deployment rule:** **0 Vercel deployments** until the final release candidate  
> **Final deployment allowance:** **maximum 1**  
> **Acceptance standard:** actual runtime behavior, not source-code existence

---

## 0. Purpose

This file is the **living source of truth for the GC Hangout rebuild**.

The existing game runtime is **not** to be patched incrementally. The game runtime will be rebuilt cleanly around a small number of independent systems.

This roadmap must be updated after every meaningful rebuild wave.

### Non-negotiable principles

- [ ] Rebuild the game runtime rather than continuing the accumulated broken architecture.
- [ ] Audit infrastructure before destructive changes.
- [ ] Preserve useful infrastructure: Supabase, database/data, authentication, environment configuration, Vercel project, GitHub repository, working provider/API credentials.
- [ ] Do not unnecessarily delete production data or infrastructure.
- [ ] Keep exactly one authoritative implementation of each core system.
- [ ] Do not create `V2`, `Fallback`, `Restored`, `Legacy`, or competing runtime implementations.
- [ ] A failed decorative asset must never destroy the player or core world.
- [ ] Local player initialization must be deterministic and independent of movement/network callbacks.
- [ ] Gameplay state must remain separate from UI state.
- [ ] Mobile input must have a deliberate pointer/touch architecture.
- [ ] Automated tests are necessary but do not constitute gameplay verification.
- [ ] Browser testing is required when browser automation is available.
- [ ] Actual iPhone acceptance is required for final verification.
- [ ] Never report “implemented” as “working.”
- [ ] Use only **PASS / FAIL / NOT VERIFIED / NOT AVAILABLE** for acceptance status.

---

# 1. Current Repository Baseline

## 1.1 Branch inventory

Current branches identified during initial audit:

- [ ] `main`
- [ ] `emergency/accidental-main-edit-2026-10-06`
- [ ] `fix/character-controller-20261006`
- [ ] `gc-mobile-ux-hardening`
- [ ] `gc-quality-hardening`
- [ ] `qa/strict-bug-fix-2026-10-06`
- [ ] `recovery-candidate-local-human-2026-10-06`
- [ ] `restore/main-last-known-good-2026-10-06`
- [ ] `runtime-recovery-2026-10-06`

**Branch cleanup is intentionally NOT performed yet.**

Before deletion:

- [ ] Identify branch head SHA.
- [ ] Identify whether branch contains unique useful infrastructure/configuration.
- [ ] Identify whether branch contains unique fixes worth preserving conceptually.
- [ ] Confirm `main` is the chosen rebuild base.
- [ ] Preserve Git history.
- [ ] Delete only branches confirmed unnecessary.
- [ ] Keep `main` as the canonical rebuild branch unless explicitly changed.

## 1.2 Infrastructure audit

Before changing the runtime:

- [ ] Supabase project identified.
- [ ] Supabase database schema inspected.
- [ ] Production data preservation requirements identified.
- [ ] Authentication configuration inspected.
- [ ] Realtime configuration inspected.
- [ ] Storage buckets/policies inspected.
- [ ] Existing environment variable names documented.
- [ ] Working API credentials identified without exposing secrets.
- [ ] Music provider configuration audited.
- [ ] Vercel project identified.
- [ ] Vercel environment configuration audited.
- [ ] Existing deployment/production state recorded.
- [ ] GitHub Actions/CI configuration inspected.
- [ ] Existing tests/build scripts inspected.
- [ ] Existing useful infrastructure marked KEEP / MODIFY / REMOVE.

### Infrastructure rule

**Do not delete Supabase tables, production data, auth configuration, Vercel project, environment variables, or working credentials merely because the game runtime is being rebuilt.**

---

# 2. Vercel Deployment Gate

## Development

- [ ] Local development only.
- [ ] Local static analysis.
- [ ] Local automated tests.
- [ ] Local production build.
- [ ] Local browser testing.
- [ ] Browser/runtime debugging without Vercel.
- [ ] No preview deployments.
- [ ] No debug deployments.
- [ ] No deployment for individual fixes.
- [ ] Development Vercel deployment count = **0**.

## Final release

Only after every required gate passes:

- [ ] Final release candidate identified.
- [ ] Final commit SHA recorded.
- [ ] Final local build passes.
- [ ] Automated tests pass.
- [ ] Browser acceptance passes.
- [ ] No fatal runtime errors.
- [ ] Core assets verified.
- [ ] Full feature checklist passes.
- [ ] One Vercel deployment created.
- [ ] Deployment ID recorded.
- [ ] Deployment URL recorded.
- [ ] Deployment environment recorded.
- [ ] Deployed commit SHA verified.
- [ ] iPhone acceptance performed.

If Vercel quota is unavailable:

- [ ] DO NOT create another deployment.
- [ ] Record deployment as unavailable.
- [ ] Diagnose without burning deployment quota.

---

# 3. Target Architecture

The rebuilt runtime should be organized around independent responsibilities:

```
GameShell
├── World
│   ├── Room
│   ├── Furniture
│   ├── Props
│   ├── TV
│   └── Environment
│
├── PlayerSystem
│   ├── LocalPlayer
│   ├── RemotePlayers
│   ├── Movement
│   ├── Animation
│   └── Interaction
│
├── CameraSystem
├── InteractionSystem
├── MultiplayerSystem
├── ChatSystem
├── VoiceSystem
├── MusicSystem
└── MobileHUD
```

## System uniqueness

- [ ] ONE player renderer.
- [ ] ONE movement controller.
- [ ] ONE camera controller.
- [ ] ONE interaction system.
- [ ] ONE multiplayer state authority.
- [ ] ONE music state authority.
- [ ] ONE chat transport.
- [ ] ONE voice transport.
- [ ] ONE mobile HUD.
- [ ] No duplicate competing implementations.

---

# 4. Wave 0 — Repository & Infrastructure Audit

**Goal:** understand what must survive before deleting or replacing runtime code.

- [ ] Audit repository tree.
- [ ] Audit branches.
- [ ] Audit recent commits.
- [ ] Audit package/dependency stack.
- [ ] Audit app entry points.
- [ ] Audit player/avatar code.
- [ ] Audit camera/input code.
- [ ] Audit world/furniture code.
- [ ] Audit interaction code.
- [ ] Audit multiplayer code.
- [ ] Audit chat.
- [ ] Audit voice.
- [ ] Audit music.
- [ ] Audit Supabase integration.
- [ ] Audit Vercel integration.
- [ ] Audit tests.
- [ ] Audit CI.
- [ ] Search for stale component names.
- [ ] Search for unresolved imports/references.
- [ ] Search for external critical GLB URLs.
- [ ] Search for duplicate system implementations.
- [ ] Search for swallowed asset-loading errors.
- [ ] Record infrastructure KEEP/MODIFY/REMOVE decisions.

### Wave 0 acceptance

- [ ] Infrastructure inventory complete.
- [ ] Runtime replacement boundaries documented.
- [ ] No destructive cleanup performed without evidence.
- [ ] Status: **PASS / FAIL / NOT VERIFIED**

---

# 5. Wave 1 — Clean Game Shell

Build the smallest possible working game.

```
Fullscreen
→ Three.js canvas
→ Large floor
→ Walls
→ Human player
→ Camera
→ Movement
```

- [ ] Full-screen canvas.
- [ ] Large playable floor.
- [ ] Room boundaries.
- [ ] Human avatar visible.
- [ ] Deterministic local-player initialization.
- [ ] Third-person camera.
- [ ] Desktop movement.
- [ ] Mobile movement architecture.
- [ ] Basic collision.
- [ ] No furniture yet unless needed for collision testing.
- [ ] No chat.
- [ ] No music.
- [ ] No voice.
- [ ] No multiplayer features yet.

### Hard stop

If the human, movement, camera, or room boundary is broken:

- [ ] STOP.
- [ ] Do not proceed to feature expansion.

### Acceptance

- [ ] Open game.
- [ ] Human appears immediately.
- [ ] Human remains visible.
- [ ] Human can walk.
- [ ] Camera follows.
- [ ] Camera rotates.
- [ ] Player stays inside room.
- [ ] No fatal console errors.
- [ ] Status: **PASS / FAIL / NOT VERIFIED**

---

# 6. Wave 2 — Human Avatar System

The avatar must not be a capsule.

## Avatar

- [ ] Reliable local/bundled avatar selected.
- [ ] Avatar loading isolated from environment loading.
- [ ] Head.
- [ ] Torso.
- [ ] Arms.
- [ ] Hands.
- [ ] Legs.
- [ ] Feet.
- [ ] Believable proportions.
- [ ] Skeleton/animation rig where appropriate.
- [ ] No fragile critical dependency on external CDN.
- [ ] No `RestoredHuman`.
- [ ] No `RealHuman` + `LocalHuman` + fallback competition.
- [ ] Exactly one player-renderer implementation.

## Animation

- [ ] Idle.
- [ ] Walk.
- [ ] Run if included.
- [ ] Turn.
- [ ] Sit.
- [ ] Sleep.
- [ ] Eat.
- [ ] Drink.
- [ ] Dance.
- [ ] Wave.
- [ ] Clap.

## Initialization

```
JOIN ROOM
→ CREATE PLAYER STATE
→ SPAWN PLAYER
→ RENDER HUMAN
→ INITIALIZE ANIMATION
→ ENABLE MOVEMENT
```

- [ ] Player renders without movement callback.
- [ ] Player does not depend on another player's presence.
- [ ] Player does not depend on decorative asset completion.
- [ ] Player does not disappear when optional assets fail.

---

# 7. Wave 3 — Movement Controller

- [ ] One movement controller.
- [ ] WASD.
- [ ] Mobile joystick.
- [ ] Smooth acceleration.
- [ ] Smooth deceleration.
- [ ] Natural walking speed.
- [ ] Optional run.
- [ ] Smooth turning.
- [ ] No automatic running.
- [ ] No snapping.
- [ ] No jitter.
- [ ] No vibration.
- [ ] No conflicting physics velocity.
- [ ] Movement state derived from actual velocity.
- [ ] Idle threshold.
- [ ] Walk threshold.
- [ ] Run threshold if applicable.
- [ ] Animation blending.
- [ ] Interaction state can lock movement cleanly.
- [ ] Releasing interaction restores movement cleanly.

### Acceptance

- [ ] Walk forward.
- [ ] Walk backward.
- [ ] Strafe/turn as designed.
- [ ] Stop.
- [ ] Change direction.
- [ ] Start/stop repeatedly.
- [ ] No vibration.
- [ ] No unintended movement.
- [ ] Status: **PASS / FAIL / NOT VERIFIED**

---

# 8. Wave 4 — Camera System

Exactly one camera controller.

## Desktop

- [ ] Mouse drag rotates.
- [ ] Wheel zooms.
- [ ] Smooth follow.

## Mobile

- [ ] Gameplay-area drag rotates.
- [ ] Pinch zoom optional.
- [ ] Touch architecture documented.
- [ ] DOM controls do not steal gameplay camera gestures.
- [ ] Pointer capture/propagation handled deliberately.
- [ ] `touch-action` configured deliberately.

## Camera behavior

- [ ] Stable third-person distance.
- [ ] Smooth rotation.
- [ ] Smooth follow.
- [ ] Player remains visible.
- [ ] Minimum zoom.
- [ ] Maximum zoom.
- [ ] Room-boundary awareness.
- [ ] Wall collision.
- [ ] Major-furniture collision.
- [ ] Obstacle distance adjustment.
- [ ] No clipping where practical.
- [ ] No outside-room view.
- [ ] No jitter.
- [ ] No snapping.
- [ ] No random zoom.
- [ ] No competing camera paths.

### Acceptance

- [ ] Rotate continuously.
- [ ] Walk while rotating.
- [ ] Approach walls.
- [ ] Approach furniture.
- [ ] Reach corners.
- [ ] Test mobile drag.
- [ ] Confirm UI does not break camera.
- [ ] Status: **PASS / FAIL / NOT VERIFIED**

---

# 9. Wave 5 — Large Hangout Hall

Build the actual social environment.

## Layout

- [ ] Large open central social floor.
- [ ] TV/entertainment zone.
- [ ] Sofa zone.
- [ ] Chair zone.
- [ ] Dining zone.
- [ ] Food/snack zone.
- [ ] Bed/rest zone.
- [ ] Plants/greenery zone.
- [ ] Decorations.
- [ ] Proper room boundaries.
- [ ] Comfortable walking distances.
- [ ] Camera rotation space.

## Furniture

- [ ] 2+ sofas.
- [ ] Several chairs.
- [ ] Dining table.
- [ ] Dining chairs.
- [ ] Coffee tables.
- [ ] Beds.
- [ ] TV stand.
- [ ] TV.
- [ ] Lamps.
- [ ] Shelves.
- [ ] Rugs.
- [ ] Optional trees/greenery.

## Asset strategy

- [ ] Critical assets local/bundled where possible.
- [ ] No critical dependence on `cdn.3dassets.dev`.
- [ ] Loading state.
- [ ] Success state.
- [ ] Failure state.
- [ ] Failure isolation.
- [ ] Decorative failure cannot remove room.
- [ ] Core-player failure cannot be caused by decoration.
- [ ] Staged loading.
- [ ] Core assets first.
- [ ] Decorations later.
- [ ] Mobile memory budget considered.

### Acceptance

- [ ] Hall visibly resembles a social game.
- [ ] Not an empty floor.
- [ ] Central area is genuinely open.
- [ ] Furniture is visible.
- [ ] Player can walk between functional zones.
- [ ] Camera works around the environment.
- [ ] Status: **PASS / FAIL / NOT VERIFIED**

---

# 10. Wave 6 — Interaction Anchor System

Create one generic interaction model.

## Anchor fields

- [ ] id
- [ ] type
- [ ] position
- [ ] rotation
- [ ] occupiedBy
- [ ] animation
- [ ] standPosition

## Types

- [ ] SIT
- [ ] SLEEP
- [ ] EAT
- [ ] DRINK
- [ ] WATCH_TV
- [ ] INTERACT

## Interaction lifecycle

```
APPROACH
→ VERIFY
→ RESERVE
→ STOP MOVEMENT
→ STOP VELOCITY
→ ALIGN
→ ROTATE
→ ANIMATE
→ SYNCHRONIZE
→ RELEASE
→ STAND POSITION
→ RESTORE MOVEMENT
```

- [ ] No hard-coded button-handler offsets.
- [ ] Seat reservation is authoritative.
- [ ] Interaction cannot cause automatic running.
- [ ] Interaction cannot permanently lock player.
- [ ] Interaction failure restores normal movement.

---

# 11. Wave 7 — Sitting

## Sofas

- [ ] Sofa anchors.
- [ ] Pelvis/seat alignment.
- [ ] Correct rotation.
- [ ] Natural posture.
- [ ] No floating.
- [ ] No sinking.
- [ ] No standing on sofa.
- [ ] No unexpected movement.
- [ ] Stand action.
- [ ] Seat release.

## Chairs

- [ ] Normal chair anchors.
- [ ] Dining chair anchors.
- [ ] Seat height alignment.
- [ ] Pelvis alignment.
- [ ] Feet approximately reach floor.
- [ ] Back alignment.
- [ ] Correct rotation.
- [ ] Stand action.

## Multiplayer

- [ ] Seat ownership.
- [ ] Reservation race handled authoritatively.
- [ ] Occupied seat unavailable.
- [ ] Seat released on stand.
- [ ] Seat released on disconnect.

---

# 12. Wave 8 — Sleeping

- [ ] Bed anchor.
- [ ] Proper lying posture.
- [ ] Correct body alignment.
- [ ] Correct rotation.
- [ ] Head on pillow.
- [ ] No floating.
- [ ] No sinking.
- [ ] No standing while sleeping.
- [ ] Multiplayer state synchronization.
- [ ] Exit restores movement.

---

# 13. Wave 9 — Food & Eating

## Objects

- [ ] Pizza.
- [ ] Chips.
- [ ] Sandwiches.
- [ ] Burgers.
- [ ] Popcorn.
- [ ] Cookies.
- [ ] Fruit.
- [ ] Additional snacks as useful.

## Interaction

- [ ] Food exists visibly in world.
- [ ] Food can be selected.
- [ ] Pick-up/eat interaction.
- [ ] Hold object.
- [ ] Raise toward mouth.
- [ ] Eating animation.
- [ ] Return to idle.
- [ ] State synchronized to remote players.
- [ ] Failure restores normal state.

---

# 14. Wave 10 — Drinks

- [ ] Water.
- [ ] Soda.
- [ ] Juice.
- [ ] Coffee.
- [ ] Visible 3D drink objects.
- [ ] Pick up.
- [ ] Raise.
- [ ] Drink.
- [ ] Lower.
- [ ] Return to idle.
- [ ] Synchronize interaction state.

---

# 15. Wave 11 — TV

- [ ] Large visible TV.
- [ ] TV is interactable where appropriate.
- [ ] TV displays current track.
- [ ] Title.
- [ ] Artist.
- [ ] Playback state.
- [ ] Progress where appropriate.
- [ ] TV updates from shared music state.
- [ ] TV remains functional if optional decoration fails.

---

# 16. Wave 12 — Music Provider & Playback

## Provider

- [ ] Existing legitimate provider audited.
- [ ] API route implemented cleanly.
- [ ] No fake URLs.
- [ ] No fake catalog.
- [ ] Search works.
- [ ] Fallback search strategy works.
- [ ] Zero-result search does not falsely mean provider unavailable.
- [ ] Environment configuration verified for the exact deployment.

## Track normalization

Track must contain:

- [ ] stable ID.
- [ ] title.
- [ ] artist.
- [ ] HTTPS audio URL.
- [ ] positive duration.
- [ ] license metadata.

## Player

- [ ] Search.
- [ ] Select.
- [ ] Play.
- [ ] Pause.
- [ ] Next.
- [ ] Current track.
- [ ] Playback position.
- [ ] Playback errors handled cleanly.

---

# 17. Wave 13 — Add Song

- [ ] Add Song UI exists.
- [ ] Opens actual file picker.
- [ ] MP3.
- [ ] WAV.
- [ ] M4A.
- [ ] AAC.
- [ ] OGG.
- [ ] WebM where supported.
- [ ] Correct audio MIME handling.
- [ ] Does not default to image/video-only selection.
- [ ] Upload works if upload is required.
- [ ] Track state created.
- [ ] Audio plays.
- [ ] Mobile behavior verified.
- [ ] iPhone-specific behavior verified during final acceptance.

---

# 18. Wave 14 — Synchronized Music

- [ ] One shared music authority.
- [ ] Shared track.
- [ ] Shared title.
- [ ] Shared artist.
- [ ] Shared play/pause state.
- [ ] Shared timestamp/reference time.
- [ ] Room state is authoritative.
- [ ] Local UI does not invent independent room state.
- [ ] TV follows shared state.
- [ ] Multiple clients tested.

---

# 19. Wave 15 — Chat

- [ ] Compact composer.
- [ ] Mobile-safe input font size.
- [ ] No Safari zoom.
- [ ] Send button.
- [ ] Blur input after send.
- [ ] Keyboard handling.
- [ ] Temporary message notifications.
- [ ] Player name.
- [ ] Message.
- [ ] Stacking.
- [ ] Automatic expiry.
- [ ] Does not cover gameplay.
- [ ] Does not block camera.
- [ ] Does not block joystick.
- [ ] Duplicate listeners prevented.
- [ ] Duplicate messages prevented.
- [ ] Receiving is independent of movement.

---

# 20. Wave 16 — Voice Chat

## States

- [ ] OFF.
- [ ] REQUESTING.
- [ ] LIVE / UNMUTED.
- [ ] MUTED.
- [ ] ERROR.
- [ ] DISCONNECTED.

## Transport

- [ ] Actual audio transport implemented.
- [ ] Signaling implemented where required.
- [ ] Client A → client B audio verified.
- [ ] Mute stops outgoing audio.
- [ ] Unmute restores audio.
- [ ] Disconnect cleanup.
- [ ] Permission error handling.
- [ ] No giant intrusive error UI.
- [ ] Developer diagnostics in console.
- [ ] Actual two-client voice test performed.

**Important:** microphone permission alone does NOT equal voice-chat verification.

---

# 21. Wave 17 — Emotes

Initial required emotes:

- [ ] Dance.
- [ ] Wave.
- [ ] Clap.

For each:

- [ ] Animation actually plays.
- [ ] Movement locks appropriately.
- [ ] State synchronizes.
- [ ] Animation finishes.
- [ ] Previous state restored.
- [ ] Animation failure cannot permanently lock player.

Later candidates:

- [ ] Laugh.
- [ ] Point.
- [ ] Cheer.
- [ ] Additional social emotes.

---

# 22. Wave 18 — Multiplayer

## Player state

- [ ] id.
- [ ] name.
- [ ] position.
- [ ] rotation.
- [ ] movement/velocity as needed.
- [ ] animation.
- [ ] interaction.
- [ ] seat.
- [ ] sleeping.
- [ ] emote.
- [ ] relevant synchronized state.

## Networking

- [ ] Supabase/shared room state selected.
- [ ] One multiplayer authority.
- [ ] Local player responsive.
- [ ] Remote players interpolated.
- [ ] No visible snapping.
- [ ] No duplicate remote players.
- [ ] No stale players.
- [ ] Join creates remote representation.
- [ ] Leave removes representation.
- [ ] Reconnect cleans stale state.
- [ ] Presence is real.
- [ ] Room occupancy is real.

## Remote behavior

- [ ] Walk visible.
- [ ] Sit visible.
- [ ] Sleep visible.
- [ ] Eat visible.
- [ ] Drink visible.
- [ ] Dance visible.
- [ ] Wave visible.
- [ ] Clap visible.
- [ ] Music state visible.
- [ ] Chat visible.

---

# 23. Wave 19 — Mobile HUD

3D world must dominate the screen.

## Persistent UI

### Top

- [ ] Room name.
- [ ] Actual online count.

### Left

- [ ] Compact joystick.

### Right

- [ ] Interaction.
- [ ] Emote.
- [ ] Microphone.

### Bottom

- [ ] Compact music controls.
- [ ] Compact chat controls.
- [ ] Add Song where appropriate.

## Mobile safety

- [ ] Safe areas.
- [ ] Notch.
- [ ] Dynamic Island.
- [ ] Safari browser controls.
- [ ] Small screens.
- [ ] Landscape layout.
- [ ] Pointer-event architecture.
- [ ] No giant panels.
- [ ] No gameplay-blocking errors.

---

# 24. Wave 20 — Error Handling

## Player-facing

- [ ] Small.
- [ ] Temporary.
- [ ] Clear.
- [ ] Non-blocking.

Examples:

- [ ] “Microphone permission unavailable.”
- [ ] “Music unavailable.”
- [ ] Asset failure remains invisible to player when non-critical.

## Developer diagnostics

- [ ] Detailed errors in console.
- [ ] Asset URL diagnostics.
- [ ] API diagnostics.
- [ ] Network diagnostics.
- [ ] Voice diagnostics.
- [ ] No swallowed critical failures.

---

# 25. Wave 21 — Performance

Target: mobile Safari.

- [ ] Core assets load first.
- [ ] Decorative assets load later.
- [ ] No dozens of large GLBs eagerly loaded.
- [ ] Reasonable polygon counts.
- [ ] Compressed textures where appropriate.
- [ ] Texture reuse.
- [ ] Limited dynamic lights.
- [ ] Optimized shadows.
- [ ] Reasonable draw calls.
- [ ] Optional decoration lazy-loaded.
- [ ] No unnecessary dependency additions.
- [ ] Memory pressure considered.
- [ ] Mobile load time measured/observed.

---

# 26. Wave 22 — State Separation & Architecture Cleanup

- [ ] Gameplay state independent of UI state.
- [ ] Opening chat does not reset player.
- [ ] Opening chat does not affect camera.
- [ ] Opening music menu does not affect movement.
- [ ] Opening emote menu does not reset player.
- [ ] UI visibility cannot destroy room state.
- [ ] No giant game component.
- [ ] Clear module boundaries.
- [ ] No dead recovery components.
- [ ] No stale experimental components.
- [ ] No temporary production hacks.
- [ ] No duplicate listeners.
- [ ] No duplicate state authorities.
- [ ] No unresolved imports.
- [ ] No stale references.
- [ ] No unused competing runtime paths.

---

# 27. Wave 23 — Automated Testing

Required automated coverage:

- [ ] Player initialization.
- [ ] Room initialization.
- [ ] Seat ownership.
- [ ] Seat release.
- [ ] Chat state/transport.
- [ ] Music normalization.
- [ ] Music state.
- [ ] Interaction state.
- [ ] Emote state.
- [ ] Microphone state.
- [ ] Multiplayer state.
- [ ] Disconnect/reconnect cleanup where practical.

Commands:

- [ ] `npm test`
- [ ] `npm run build`

### Rule

**TEST PASS ≠ GAME PASS.**

---

# 28. Wave 24 — Browser Verification

Use browser automation if available.

Required flow:

- [ ] LOAD → human visible.
- [ ] WALK → smooth.
- [ ] CAMERA → drag works.
- [ ] ROOM → furniture visible.
- [ ] SOFA → sit.
- [ ] CHAIR → sit.
- [ ] BED → sleep.
- [ ] FOOD → eat.
- [ ] DRINK → drink.
- [ ] TV → music visible.
- [ ] CHAT → send.
- [ ] MIC → toggle.
- [ ] EMOTE → dance/wave/clap.
- [ ] MULTIPLAYER → second player visible.
- [ ] No fatal console errors.

If browser automation is unavailable:

**BROWSER = NOT AVAILABLE**

Never claim browser verification without actually performing it.

---

# 29. Wave 25 — Visual Acceptance

The first screen must communicate:

> **People are hanging out together in a large shared room.**

Reject if it resembles:

- [ ] Empty Three.js scene.
- [ ] Debug scene.
- [ ] Capsule prototype.
- [ ] UI prototype.
- [ ] Floating furniture.
- [ ] Cramped room.
- [ ] Broken camera.
- [ ] Giant error panels.
- [ ] Empty fallback world.

Acceptance:

- [ ] Large furnished hall.
- [ ] Human clearly visible.
- [ ] Functional zones readable.
- [ ] Central social floor open.
- [ ] UI subordinate to world.
- [ ] Overall experience resembles a real social 3D game.

---

# 30. Wave 26 — Full Pre-Deployment Gate

Every required item must be **PASS** or deployment is prohibited.

## Code

- [ ] CODE = PASS

## Build/test

- [ ] BUILD = PASS
- [ ] AUTOMATED TESTS = PASS

## Core

- [ ] PLAYER INITIALIZATION = PASS
- [ ] HUMAN AVATAR = PASS
- [ ] WORLD = PASS
- [ ] FURNITURE = PASS
- [ ] CAMERA = PASS
- [ ] MOVEMENT = PASS

## Interactions

- [ ] SOFA = PASS
- [ ] CHAIR = PASS
- [ ] DINING = PASS
- [ ] BED = PASS
- [ ] EATING = PASS
- [ ] DRINKING = PASS
- [ ] TV = PASS

## Social systems

- [ ] MUSIC API = PASS
- [ ] MUSIC PLAYBACK = PASS
- [ ] ADD SONG = PASS
- [ ] CHAT = PASS
- [ ] VOICE = PASS
- [ ] MUTE/UNMUTE = PASS
- [ ] EMOTES = PASS
- [ ] MULTIPLAYER = PASS

## Mobile/reliability

- [ ] MOBILE UI = PASS
- [ ] NO FATAL RUNTIME ERRORS = PASS
- [ ] CORE ASSETS RELIABLE = PASS

## Browser

- [ ] BROWSER = PASS
- [ ] OR BROWSER = NOT AVAILABLE, explicitly recorded

### Deployment decision

- [ ] No FAIL.
- [ ] No unresolved NOT VERIFIED for required functionality.
- [ ] Final release candidate SHA recorded.
- [ ] Only now is Vercel deployment permitted.

---

# 31. Wave 27 — Single Vercel Release

Before deployment:

- [ ] Confirm development deployment count = 0.
- [ ] Confirm final candidate is frozen.
- [ ] Record commit SHA.
- [ ] Record branch.
- [ ] Record environment.
- [ ] Verify environment variables.
- [ ] Verify music provider configuration.
- [ ] Verify Supabase configuration.
- [ ] Verify build locally.
- [ ] Verify tests locally.
- [ ] Verify browser locally.

Then:

- [ ] Create ONE Vercel deployment.
- [ ] Record deployment ID.
- [ ] Record deployment URL.
- [ ] Record deployed SHA.
- [ ] Confirm deployed SHA matches candidate.
- [ ] Do not create another deployment for ordinary debugging.
- [ ] If quota is unavailable, record NOT VERIFIED and stop.

---

# 32. Wave 28 — Real iPhone Acceptance

Actual iPhone test:

1. [ ] Open game.
2. [ ] Human appears.
3. [ ] Large furnished hall appears.
4. [ ] Camera drag works.
5. [ ] Walk around.
6. [ ] Camera remains usable.
7. [ ] Sit on sofa.
8. [ ] Stand.
9. [ ] Sit on chair.
10. [ ] Sit at dining table.
11. [ ] Sleep on bed.
12. [ ] Eat.
13. [ ] Drink.
14. [ ] Open TV/music.
15. [ ] Play music.
16. [ ] Add a song.
17. [ ] Chat.
18. [ ] Microphone ON.
19. [ ] Microphone MUTED.
20. [ ] Microphone ON again.
21. [ ] Dance.
22. [ ] Wave.
23. [ ] Clap.
24. [ ] Second player joins.
25. [ ] Both players see each other.
26. [ ] Walk simultaneously.
27. [ ] Sit.
28. [ ] Emote.
29. [ ] Music synchronizes.
30. [ ] Chat synchronizes.
31. [ ] Voice works.

If anything required fails:

**GAME = NOT VERIFIED**

---

# 33. Final Acceptance Report

At completion, report exactly:

| System | Status |
|---|---|
| PLAYER | PASS / FAIL / NOT VERIFIED |
| WORLD | PASS / FAIL / NOT VERIFIED |
| CAMERA | PASS / FAIL / NOT VERIFIED |
| MOVEMENT | PASS / FAIL / NOT VERIFIED |
| FURNITURE | PASS / FAIL / NOT VERIFIED |
| SITTING | PASS / FAIL / NOT VERIFIED |
| SLEEPING | PASS / FAIL / NOT VERIFIED |
| EATING | PASS / FAIL / NOT VERIFIED |
| DRINKING | PASS / FAIL / NOT VERIFIED |
| TV | PASS / FAIL / NOT VERIFIED |
| MUSIC | PASS / FAIL / NOT VERIFIED |
| ADD SONG | PASS / FAIL / NOT VERIFIED |
| CHAT | PASS / FAIL / NOT VERIFIED |
| VOICE | PASS / FAIL / NOT VERIFIED |
| EMOTES | PASS / FAIL / NOT VERIFIED |
| MULTIPLAYER | PASS / FAIL / NOT VERIFIED |
| MOBILE UX | PASS / FAIL / NOT VERIFIED |
| BUILD | PASS / FAIL |
| TESTS | PASS / FAIL |
| BROWSER | PASS / FAIL / NOT AVAILABLE |
| CORE ASSETS | PASS / FAIL / NOT VERIFIED |
| VERCEL DEVELOPMENT DEPLOYMENTS | 0 |
| FINAL VERCEL DEPLOYMENTS | 0 / 1 |
| GAME | VERIFIED / NOT VERIFIED |

---

# 34. Known Previous Problems — Regression Checklist

The following problems must not return:

## World

- [ ] No empty fallback floor.
- [ ] No debug-looking minimal environment.
- [ ] No cramped two-room layout.
- [ ] No missing furniture caused by one failed asset.
- [ ] No critical dependence on `cdn.3dassets.dev`.
- [ ] No swallowed asset failure that silently produces an empty scene.
- [ ] No eager loading of the entire asset catalog.

## Player

- [ ] No capsule as the normal player.
- [ ] No `RestoredHuman` unresolved reference.
- [ ] No competing human components.
- [ ] No player visibility dependent on movement callback.
- [ ] No player visibility dependent on remote presence.
- [ ] No player destruction from decorative asset failure.

## Movement

- [ ] No shaking.
- [ ] No vibration.
- [ ] No slow/unnatural animation.
- [ ] No automatic running.
- [ ] No interaction-induced runaway movement.
- [ ] No snapping.

## Camera

- [ ] No outside-room camera.
- [ ] No unusable angle.
- [ ] No competing camera controllers.
- [ ] No UI stealing gameplay camera gestures.
- [ ] No random zoom.
- [ ] No snapping/jitter.

## Interactions

- [ ] Sit works reliably.
- [ ] Sofa pelvis alignment correct.
- [ ] Chair alignment correct.
- [ ] Bed posture correct.
- [ ] No floating.
- [ ] No sinking.
- [ ] No stuck interaction state.
- [ ] Seat ownership authoritative.

## Music

- [ ] No fake track URLs.
- [ ] No fake catalog.
- [ ] Zero search results do not incorrectly mean provider unavailable.
- [ ] Exact environment configuration verified.
- [ ] Preview/production mismatch explicitly checked.

## Add Song

- [ ] Audio picker, not image/video picker.
- [ ] Supported audio formats accepted.
- [ ] Selected audio actually processes/plays.

## Chat

- [ ] No Safari input zoom.
- [ ] No giant chat panel.
- [ ] No gameplay-blocking notifications.
- [ ] No duplicate listeners/messages.

## Voice

- [ ] Permission is not mistaken for voice transport.
- [ ] OFF/REQUESTING/LIVE/MUTED/ERROR/DISCONNECTED states exist.
- [ ] Two-client audio verified.
- [ ] Mute actually stops audio.

## Emotes

- [ ] Buttons are not merely decorative.
- [ ] Dance works.
- [ ] Wave works.
- [ ] Clap works.
- [ ] Movement restores after emote.

## Multiplayer

- [ ] Local player appears immediately.
- [ ] Remote players interpolate.
- [ ] No duplicate remote objects.
- [ ] No stale players after leave.
- [ ] Interaction state synchronizes.

## Deployment/QA

- [ ] No deployment used as a debugging loop.
- [ ] Deployed SHA verified before interpreting deployment behavior.
- [ ] Environment verified before interpreting deployment behavior.
- [ ] Source existence never treated as gameplay verification.

---

# 35. Rebuild Wave Log — KEEP UPDATED

Every rebuild wave must append an entry here.

## Wave 0 — Audit

**Date:** TBD  
**Commit:** TBD  
**Scope:** Repository/infrastructure audit  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 1 — Game Shell

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 2 — Human Avatar

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 3 — Movement

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 4 — Camera

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 5 — Hangout Hall

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 6 — Interaction Anchors

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 7 — Sitting

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 8 — Sleeping

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 9 — Food

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 10 — Drinks

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 11 — TV

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 12 — Music

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 13 — Add Song

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 14 — Synchronized Music

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 15 — Chat

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 16 — Voice

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 17 — Emotes

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 18 — Multiplayer

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 19 — Mobile HUD

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 20 — Error Handling

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 21 — Performance

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 22 — Architecture Cleanup

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 23 — Automated Testing

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 24 — Browser Verification

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 25 — Visual Acceptance

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 26 — Pre-Deployment Gate

**Date:** TBD  
**Commit:** TBD  
**Scope:** TBD  
**Changes:** TBD  
**Tests:** TBD  
**Browser:** TBD  
**Deployment:** 0  
**Status:** NOT STARTED

## Wave 27 — Vercel Release

**Date:** TBD  
**Commit:** TBD  
**Deployment ID:** TBD  
**Deployment URL:** TBD  
**Environment:** TBD  
**Deployment count:** 0 / 1  
**Status:** NOT STARTED

## Wave 28 — iPhone Acceptance

**Date:** TBD  
**Commit:** TBD  
**Deployment:** TBD  
**Tests:** TBD  
**iPhone:** TBD  
**Failures:** TBD  
**Status:** NOT STARTED

---

# 36. Final Definition of Done

The rebuild is complete only when:

- [ ] Human player appears immediately.
- [ ] Large furnished hangout hall appears.
- [ ] Camera is smooth and controllable.
- [ ] Movement is smooth and natural.
- [ ] Player can explore the room.
- [ ] Sofa sitting works.
- [ ] Chair sitting works.
- [ ] Dining interaction works.
- [ ] Bed sleeping works.
- [ ] Eating works.
- [ ] Drinking works.
- [ ] TV works.
- [ ] Music search/playback works.
- [ ] Add Song works.
- [ ] Music synchronizes.
- [ ] Chat works without mobile zoom.
- [ ] Voice transport works between real clients.
- [ ] Mute/unmute works.
- [ ] Dance works.
- [ ] Wave works.
- [ ] Clap works.
- [ ] Multiplayer presence works.
- [ ] Remote movement works.
- [ ] Remote interactions work.
- [ ] Mobile HUD is compact and usable.
- [ ] Core assets are reliable.
- [ ] Decorative failures are isolated.
- [ ] Automated tests pass.
- [ ] Production build passes.
- [ ] Browser acceptance passes or is explicitly unavailable.
- [ ] Final Vercel deployment count is no more than 1.
- [ ] Actual iPhone acceptance passes.
- [ ] Final report contains no unsupported “working” claims.

## Final product definition

> **A human player inside a large, beautiful hangout hall with smooth camera and movement, where people can actually hang out together.**
