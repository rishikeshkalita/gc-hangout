export const SOCIAL_EVENTS = Object.freeze({
  CHAT: "chat",
  PLAYER: "player",
  MUSIC: "music",
  MUSIC_REQUEST: "music_request",
  EMOTE: "emote",
  VOICE: "voice",
  ACTIVITY: "activity",
  PAIR_ACTION: "pair_action",
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

export const MUSIC_QUEUE_LIMIT = 25;
export const MUSIC_PENDING_LIMIT = 3;

export function currentMusicPosition(state, now = Date.now()) {
  if (!state?.current) return 0;
  const base = Math.max(0, Number(state.position) || 0);
  if (!state.playing) return base;
  return base + Math.max(0, now - (Number(state.startedAt) || now)) / 1000;
}

export function normalizeMusicTrack(value) {
  if (!value || typeof value !== "object") return null;
  const videoId = String(value.videoId || value.id || "").trim();
  if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) return null;
  return {
    id: `yt-${videoId}`,
    videoId,
    title: String(value.title || "YouTube video").slice(0, 100),
    artist: String(value.artist || value.channelTitle || "YouTube").slice(0, 100),
    album: "YouTube",
    channelTitle: String(value.channelTitle || value.artist || "YouTube").slice(0, 100),
    duration: Math.max(0, Number(value.duration) || 0),
    thumbnail: String(value.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`),
    requesterId: String(value.requesterId || ""),
    requesterName: String(value.requesterName || "Guest").slice(0, 18),
    requestedAt: Number(value.requestedAt) || Date.now(),
  };
}

export function normalizeMusicState(value) {
  if (!value || typeof value !== "object") return null;
  const current = normalizeMusicTrack(value.current || value.track);
  const queue = Array.isArray(value.queue) ? value.queue.map(normalizeMusicTrack).filter(Boolean).slice(0, MUSIC_QUEUE_LIMIT) : [];
  const currentId = current?.videoId || null;
  const filteredQueue = queue.filter((item, index, items) => item.videoId !== currentId && items.findIndex((other) => other.videoId === item.videoId) === index);
  const skipVotes = [...new Set(Array.isArray(value.skipVotes) ? value.skipVotes.map(String).filter(Boolean) : [])];
  const revision = Math.max(0, Math.floor(Number(value.revision) || 0));
  const state = {
    revision,
    current,
    track: current,
    queue: filteredQueue,
    skipVotes,
    position: Math.max(0, Number(value.position) || 0),
    startedAt: Number(value.startedAt) || 0,
    playing: Boolean(value.playing && current),
    volume: Math.max(0, Math.min(1, Number.isFinite(Number(value.volume)) ? Number(value.volume) : 0.8)),
    updatedAt: Number(value.updatedAt) || Date.now(),
    leaderId: String(value.leaderId || ""),
  };
  return state;
}

export function createEmptyMusicState() {
  return normalizeMusicState({
    revision: 0,
    current: null,
    queue: [],
    skipVotes: [],
    position: 0,
    startedAt: 0,
    playing: false,
    volume: 0.8,
    updatedAt: Date.now(),
    leaderId: "",
  });
}

export function advanceMusicState(state, now = Date.now()) {
  const normalized = normalizeMusicState(state) || createEmptyMusicState();
  const next = normalized.queue[0] || null;
  return normalizeMusicState({
    ...normalized,
    revision: normalized.revision + 1,
    current: next,
    queue: normalized.queue.slice(1),
    skipVotes: [],
    position: 0,
    startedAt: next ? now : 0,
    playing: Boolean(next),
    updatedAt: now,
  });
}

export function parseYouTubeDuration(value) {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(String(value || ""));
  if (!match) return 0;
  return (Number(match[1] || 0) * 3600) + (Number(match[2] || 0) * 60) + Number(match[3] || 0);
}

export function formatChatTime(timestamp) {
  const date = new Date(Number(timestamp) || Date.now());
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}
