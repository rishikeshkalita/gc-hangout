export const SOCIAL_EVENTS = Object.freeze({
  CHAT: "chat",
  PLAYER: "player",
  MUSIC: "music",
  MUSIC_REQUEST: "music_request",
  MUSIC_VOLUME: "music_volume",
  MUSIC_SYNC: "music_sync",
  EMOTE: "emote",
  VOICE: "voice",
  ACTIVITY: "activity",
  PAIR_ACTION: "pair_action",
  BALL: "ball",
  BALL_TOUCH: "ball_touch",
  BALL_KICK: "ball_kick",
  FOOTBALL_SCORE: "football_score",
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

export const MUSIC_QUEUE_LIMIT = 100;
export const MUSIC_MAX_FILE_BYTES = 26214400;
export const MUSIC_MAX_ROOM_BYTES = 1073741824;
export const MUSIC_TTL_MS = 72 * 60 * 60 * 1000;

export function currentMusicPosition(state, now = Date.now()) {
  if (!state?.current) return 0;
  const base = Math.max(0, Number(state.position) || 0);
  if (!state.playing) return base;
  return base + Math.max(0, now - (Number(state.startedAt) || now)) / 1000;
}

export function normalizeMusicTrack(value) {
  if (!value || typeof value !== "object") return null;
  const id = String(value.id || "").trim();
  if (!id) return null;
  const title = String(value.title || value.filename || "Untitled track").slice(0, 100);
  const artist = String(value.artist || "Unknown artist").slice(0, 100);
  return {
    id,
    title,
    artist,
    album: String(value.album || "GC Hangout").slice(0, 100),
    duration: Math.max(0, Number(value.duration) || 0),
    storagePath: String(value.storage_path || value.storagePath || "").trim(),
    requesterId: String(value.requester_id || value.requesterId || value.added_by || value.addedBy || "").trim(),
    requesterName: String(value.requester_name || value.requesterName || "Room member").slice(0, 18),
    expiresAt: value.expires_at || value.expiresAt || null,
    thumbnail: String(value.thumbnail || "").trim(),
    filename: String(value.filename || "").slice(0, 255),
  };
}

export function normalizeMusicState(value) {
  const raw = value && typeof value === "object" ? value : {};
  const current = normalizeMusicTrack(raw.current || raw.track);
  const queue = Array.isArray(raw.queue)
    ? raw.queue.map(normalizeMusicTrack).filter(Boolean).slice(0, MUSIC_QUEUE_LIMIT)
    : [];
  const currentId = current?.id || null;
  const filteredQueue = queue.filter((item, index, items) =>
    item.id !== currentId && items.findIndex((other) => other.id === item.id) === index
  );
  return {
    revision: Math.max(0, Math.floor(Number(raw.revision) || 0)),
    current,
    track: current,
    queue: filteredQueue,
    pauseVotes: [...new Set(Array.isArray(raw.pauseVotes) ? raw.pauseVotes.map(String).filter(Boolean) : [])],
    resumeVotes: [...new Set(Array.isArray(raw.resumeVotes) ? raw.resumeVotes.map(String).filter(Boolean) : [])],
    skipVotes: [...new Set(Array.isArray(raw.skipVotes) ? raw.skipVotes.map(String).filter(Boolean) : [])],
    deleteVotes: [...new Set(Array.isArray(raw.deleteVotes) ? raw.deleteVotes.map(String).filter(Boolean) : [])],
    position: Math.max(0, Number(raw.position) || 0),
    startedAt: Number(raw.startedAt) || 0,
    playing: Boolean(raw.playing && current),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(raw.volume)) ? Number(raw.volume) : 0.8)),
    updatedAt: Number(raw.updatedAt) || Date.now(),
  };
}

export function createEmptyMusicState() {
  return normalizeMusicState({
    current: null,
    queue: [],
    pauseVotes: [],
    resumeVotes: [],
    skipVotes: [],
    playing: false,
    volume: 0.8,
  });
}

export function formatChatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
