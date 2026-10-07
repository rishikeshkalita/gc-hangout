export const SOCIAL_EVENTS = Object.freeze({
  CHAT: "chat",
  MUSIC: "music",
  EMOTE: "emote",
  VOICE: "voice",
  PLAYER: "player",
});

export const EMOTES = Object.freeze(["wave", "clap", "dance"]);

export function createClientId(prefix = "gc") {
  const random = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2);
  return `${prefix}-${random.slice(0, 12)}`;
}

export function sanitizeChatMessage(value, maxLength = 180) {
  return String(value ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "").trim().slice(0, maxLength);
}

export function normalizeEmote(value) {
  return EMOTES.includes(value) ? value : null;
}

export function normalizeMusicState(value) {
  if (!value || typeof value !== "object") return null;
  const track = value.track && typeof value.track === "object"
    ? {
        id: String(value.track.id || ""),
        title: String(value.track.title || "").slice(0, 100),
        artist: String(value.track.artist || "Unknown artist").slice(0, 100),
        album: String(value.track.album || "Jamendo").slice(0, 100),
        audio: String(value.track.audio || ""),
        duration: Math.max(0, Number(value.track.duration) || 0),
      }
    : null;
  if (track && (!track.id || !/^https:\/\//.test(track.audio))) return null;
  return {
    track,
    position: Math.max(0, Number(value.position) || 0),
    playing: Boolean(value.playing),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(value.volume)) ? Number(value.volume) : 0.8)),
    updatedAt: Number(value.updatedAt) || Date.now(),
    senderId: String(value.senderId || ""),
  };
}

export function formatChatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

export function normalizePlayerState(value) {
  if (!value || typeof value !== "object") return null;
  const x = Number(value.x), z = Number(value.z), rot = Number(value.rot);
  if (![x, z, rot].every(Number.isFinite)) return null;
  const interaction = value.interaction && typeof value.interaction === "object" ? value.interaction : null;
  return {
    id: String(value.id || ""),
    name: String(value.name || "Guest").slice(0, 18),
    avatarId: String(value.avatarId || "maya"),
    x: Math.max(-14.5, Math.min(14.5, x)),
    z: Math.max(-9.5, Math.min(9.5, z)),
    rot,
    moving: Boolean(value.moving),
    speed: Math.max(0, Math.min(12, Number(value.speed) || 0)),
    interaction: interaction ? { type: String(interaction.type || ""), phase: String(interaction.phase || "sync"), seatStyle: interaction.seatStyle || null, foodKind: interaction.foodKind || null, drinkKind: interaction.drinkKind || null } : null,
    emote: normalizeEmote(value.emote),
    timestamp: Number(value.timestamp) || Date.now(),
  };
}
