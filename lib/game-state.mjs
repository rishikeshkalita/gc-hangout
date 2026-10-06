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
