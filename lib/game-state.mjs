const PLAYER_DEFAULTS = Object.freeze({
  x: 0,
  y: 0,
  z: 0,
  rot: 0,
  moving: false,
  speed: 0,
});

export const AVATAR_IDS = Object.freeze(["maya", "noah", "riya", "aarav"]);

export function createLocalPlayer({ id = "local", name = "You", avatarId = "maya", spawn = {} } = {}) {
  return {
    id: String(id),
    name: String(name || "You").trim().slice(0, 18) || "You",
    avatarId: AVATAR_IDS.includes(avatarId) ? avatarId : "maya",
    ...PLAYER_DEFAULTS,
    ...spawn,
  };
}

export function updatePlayer(player, patch = {}) {
  if (!player) return null;
  return { ...player, ...patch };
}

export function isMoving(player) {
  return Boolean(player?.moving && Number(player?.speed) > 0);
}

export function clampRoomPosition({ x, z }, halfX = 15, halfZ = 10, radius = 0.34) {
  return {
    x: Math.max(-halfX + radius, Math.min(halfX - radius, Number(x) || 0)),
    z: Math.max(-halfZ + radius, Math.min(halfZ - radius, Number(z) || 0)),
  };
}

export const INTERACTION_TYPES = Object.freeze([
  "SIT",
  "SLEEP",
  "EAT",
  "DRINK",
  "WATCH_TV",
  "MUSIC_SPEAKER",
  "INTERACT",
]);

export const INTERACTION_LIFECYCLE = Object.freeze(["reserve", "stop", "align", "animate", "sync", "release"]);

export const INTERACTION_PHASE_MS = Object.freeze({
  reserve: 40,
  stop: 80,
  align: 160,
  animate: 420,
  sync: 700,
});

export const INTERACTION_POSES = Object.freeze({
  SIT: "sit",
  SLEEP: "sleep",
  EAT: "eat",
  DRINK: "drink",
  WATCH_TV: "watch",
  MUSIC_SPEAKER: "interact",
  INTERACT: "interact",
});

export function getInteractionPose(type) {
  return INTERACTION_POSES[type] || "idle";
}

export function canReserveInteraction(state, anchorId, ownerId = "local") {
  if (!anchorId) return false;
  if (!state) return true;
  return state.anchorId === anchorId && state.ownerId === ownerId
    ? true
    : state.status === "released";
}

export function createInteractionState(anchor, ownerId = "local", startedAt = 0) {
  if (!anchor || !INTERACTION_TYPES.includes(anchor.type)) return null;
  return {
    anchorId: anchor.id,
    ownerId,
    status: "reserved",
    phase: "reserve",
    movementLocked: true,
    startedAt: Number(startedAt) || 0,
    pose: getInteractionPose(anchor.type),
  };
}

export function advanceInteraction(state, phase) {
  if (!state || !INTERACTION_LIFECYCLE.includes(phase)) return state;
  const released = phase === "release";
  return {
    ...state,
    phase,
    status: released ? "released" : phase === "sync" ? "active" : "reserved",
    movementLocked: !released,
  };
}

export function createInteractionAnchor({
  id,
  type,
  x = 0,
  z = 0,
  rot = 0,
  targetX,
  targetZ,
  targetRot,
  exitX,
  exitZ,
  radius = 1,
  seatStyle,
  requiresSitting = false,
  foodKind,
  drinkKind,
} = {}) {
  if (!id || !INTERACTION_TYPES.includes(type)) return null;
  const anchor = {
    id: String(id),
    type,
    x: Number(x) || 0,
    z: Number(z) || 0,
    rot: Number(rot) || 0,
    radius: Math.max(0.1, Number(radius) || 1),
  };
  if (targetX != null) anchor.targetX = Number(targetX);
  if (targetZ != null) anchor.targetZ = Number(targetZ);
  if (targetRot != null) anchor.targetRot = Number(targetRot);
  if (exitX != null) anchor.exitX = Number(exitX);
  if (exitZ != null) anchor.exitZ = Number(exitZ);
  if (seatStyle) anchor.seatStyle = String(seatStyle);
  if (requiresSitting) anchor.requiresSitting = true;
  if (foodKind) anchor.foodKind = String(foodKind);
  if (drinkKind) anchor.drinkKind = String(drinkKind);
  return anchor;
}

export function findNearestInteractionAnchor(player, anchors = []) {
  if (!player) return null;
  let nearest = null;
  let distance = Infinity;
  for (const anchor of anchors) {
    const valid = createInteractionAnchor(anchor);
    if (!valid) continue;
    const next = Math.hypot(Number(player.x) - valid.x, Number(player.z) - valid.z);
    if (next <= valid.radius && next < distance) {
      nearest = valid;
      distance = next;
    }
  }
  return nearest;
}
