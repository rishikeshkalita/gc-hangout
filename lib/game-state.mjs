const PLAYER_DEFAULTS = {
  x: 0, y: 0, z: 0, rot: 0, health: 3,
  attacking: false, moving: false, speed: 0,
  action: null, interactionId: null, poseRotation: 0,
  seatY: null, poseType: null, voiceEnabled: false, emote: null,
};

export const VOICE_STATES = Object.freeze({
  OFF: "OFF",
  REQUESTING_PERMISSION: "REQUESTING_PERMISSION",
  LIVE: "LIVE",
  MUTED: "MUTED",
  ERROR: "ERROR",
  DISCONNECTED: "DISCONNECTED",
});

export function createLocalPlayer({ id, name, avatarId, spawn = {} }) {
  if (!id) throw new Error("Local player id is required.");
  return {
    id,
    name: String(name || "You").trim().slice(0, 18) || "You",
    avatarId: avatarId || "maya",
    ...PLAYER_DEFAULTS,
    ...spawn,
  };
}

export function upsertPlayer(players, player) {
  if (!player?.id) return players;
  return { ...(players || {}), [player.id]: player };
}

export function removePlayer(players, playerId) {
  if (!playerId || !players?.[playerId]) return players;
  const next = { ...players };
  delete next[playerId];
  return next;
}

export function applyPlayerState(players, payload) {
  if (!payload?.id) return players;
  const current = players?.[payload.id];
  if (current?.netTs && payload.netTs && payload.netTs < current.netTs) return players;
  return upsertPlayer(players, payload);
}

export function beginInteraction(player, candidate) {
  if (!player || !candidate) return null;
  if (player.action === "sit" || player.action === "sleep" || player.action === "watch" ||
      player.action === "emote" || player.action === "moving" || player.interactionId) return null;
  return {
    ...candidate,
    phase: "approach",
    movePosition: candidate.approachPosition || candidate.position,
  };
}

export function arriveInteraction(player, candidate) {
  if (!player || !candidate) return player;
  const finalAction = candidate.finalAction || (candidate.type === "bed" ? "sleep" : "sit");
  return {
    ...player,
    action: finalAction,
    interactionId: candidate.id,
    moving: false,
    speed: 0,
    poseRotation: candidate.rotation ?? player.rot ?? 0,
    seatY: candidate.seatY ?? null,
    poseType: candidate.poseType ?? candidate.type ?? null,
  };
}

export function releaseInteraction(player) {
  if (!player) return player;
  return {
    ...player,
    action: null,
    interactionId: null,
    poseRotation: player.rot ?? 0,
    moving: false,
    speed: 0,
    seatY: null,
    poseType: null,
    emote: null,
  };
}

export function canAttack(player) {
  return !!player && !["sit","sleep","watch","moving","emote"].includes(player.action);
}

export function startEmote(player, emote) {
  if (!player || player.action === "sit" || player.action === "sleep" || player.action === "emote") return null;
  return { ...player, action: "emote", emote: emote || "dance", moving: false, speed: 0 };
}

export function finishEmote(player) {
  if (!player || player.action !== "emote") return player;
  return { ...player, action: null, emote: null, moving: false, speed: 0 };
}

export function claimSeat(locks, objectId, holderId) {
  if (!objectId || !holderId) return { ok: false, locks: locks || {} };
  const current = locks?.[objectId];
  if (current && current !== holderId) return { ok: false, locks: locks || {} };
  return { ok: true, locks: { ...(locks || {}), [objectId]: holderId } };
}

export function releaseSeat(locks, objectId, holderId) {
  const next = { ...(locks || {}) };
  if (objectId && (!holderId || next[objectId] === holderId)) delete next[objectId];
  return next;
}

export function normalizeChatMessage(payload, now = Date.now()) {
  if (!payload || typeof payload !== "object") return null;
  const id = typeof payload.id === "string" ? payload.id.slice(0, 80) : "";
  const text = typeof payload.text === "string"
    ? payload.text.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 240)
    : "";
  if (!id || !text) return null;
  const name = typeof payload.name === "string"
    ? payload.name.replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 18)
    : "Guest";
  const ts = Number.isFinite(Number(payload.ts)) ? Number(payload.ts) : now;
  return { id, name: name || "Guest", text, ts };
}

export function mergeChatMessages(current, incoming, now = Date.now()) {
  const list = Array.isArray(incoming) ? incoming : [incoming];
  const map = new Map((current || []).map((m) => [m.id, m]));
  for (const raw of list) {
    const message = normalizeChatMessage(raw, now);
    if (message) map.set(message.id, message);
  }
  return [...map.values()].sort((a, b) => a.ts - b.ts).slice(-80);
}

export function normalizeMusicResponse(data) {
  const results = Array.isArray(data?.results) ? data.results : [];
  return results
    .filter((track) => track && track.audio)
    .map((track) => ({
      id: String(track.id),
      title: track.name || "Untitled",
      artist: track.artist_name || "Unknown artist",
      album: track.album_name || "Jamendo",
      image: track.album_image || track.image || "",
      audio: track.audio,
      duration: Number(track.duration || 0),
      license: track.license_ccurl || track.license || "",
    }))
    .filter((track) => track.id && track.audio);
}

export function classifyMusicResponse({ status, data }) {
  if (data?.configured === false) return "NOT_CONFIGURED";
  if (!Number.isFinite(Number(status)) || Number(status) < 200 || Number(status) >= 300) return "API_ERROR";
  return normalizeMusicResponse(data).length ? "AVAILABLE" : "NO_MUSIC";
}

export function voiceTransition(state, event) {
  const current = state || VOICE_STATES.OFF;
  switch (event) {
    case "REQUEST":
      return current === VOICE_STATES.OFF || current === VOICE_STATES.ERROR || current === VOICE_STATES.DISCONNECTED
        ? VOICE_STATES.REQUESTING_PERMISSION : current;
    case "PERMISSION_GRANTED":
      return VOICE_STATES.LIVE;
    case "MUTE":
      return current === VOICE_STATES.LIVE ? VOICE_STATES.MUTED : current;
    case "UNMUTE":
      return current === VOICE_STATES.MUTED ? VOICE_STATES.LIVE : current;
    case "ERROR":
      return VOICE_STATES.ERROR;
    case "DISCONNECT":
      return current === VOICE_STATES.OFF ? VOICE_STATES.OFF : VOICE_STATES.DISCONNECTED;
    case "OFF":
      return VOICE_STATES.OFF;
    default:
      return current;
  }
}
