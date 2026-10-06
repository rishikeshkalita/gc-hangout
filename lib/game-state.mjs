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


export function normalizeMusicResponse(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((track) => {
      if (!track || track.id == null || !track.name || !track.audio) return false;
      const license = track.license_ccurl || track.license || "";
      const duration = Number(track.duration || 0);
      try {
        const audio = new URL(track.audio);
        return audio.protocol === "https:" && Boolean(license) && duration > 0;
      } catch {
        return false;
      }
    })
    .map((track) => ({
      id: String(track.id),
      title: String(track.name).trim(),
      artist: track.artist_name ? String(track.artist_name).trim() : "Unknown artist",
      album: track.album_name || "Jamendo",
      image: track.album_image || track.image || "",
      audio: track.audio,
      duration: Number(track.duration || 0),
      license: track.license_ccurl || track.license || "",
      source: "jamendo",
    }))
    .filter((track) => track.id && track.title && track.audio && track.license);
}
