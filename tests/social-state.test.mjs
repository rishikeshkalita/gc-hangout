import test from "node:test";
import assert from "node:assert/strict";
import {
  EMOTES,
  createClientId,
  formatChatTime,
  normalizeEmote,
  normalizeMusicState,
  normalizeMusicTrack,
  sanitizeChatMessage,
  currentMusicPosition,
  chooseRoomAuthority,
} from "../lib/social-state.mjs";

test("social client ids are scoped and non-empty", () => {
  const id = createClientId();
  assert.match(id, /^gc-/);
});

test("chat messages are trimmed, bounded, and control characters removed", () => {
  assert.equal(sanitizeChatMessage("  hello\u0000 world  "), "hello world");
  assert.equal(sanitizeChatMessage("x".repeat(220)).length, 180);
  assert.equal(sanitizeChatMessage("   "), "");
});

test("emotes only accept supported values", () => {
  for (const emote of EMOTES) assert.equal(normalizeEmote(emote), emote);
  assert.equal(normalizeEmote("explode"), null);
});

test("music state normalizes a YouTube track", () => {
  const track = normalizeMusicTrack({
    videoId: "dQw4w9WgXcQ",
    title: "Late Lounge",
    artist: "Guest",
    duration: 180,
  });
  const state = normalizeMusicState({
    current: track,
    position: 12.5,
    playing: true,
    senderId: "gc-test",
  });
  assert.equal(state.current.videoId, "dQw4w9WgXcQ");
  assert.equal(state.position, 12.5);
  assert.equal(state.playing, true);
  assert.equal(state.volume, 0.8);
});

test("invalid YouTube music state is rejected", () => {
  assert.equal(normalizeMusicState({ current: { videoId: "bad" } }), null);
  assert.equal(normalizeMusicState(null), null);
});

test("chat time formatting returns a stable non-empty string", () => {
  assert.equal(typeof formatChatTime(Date.now()), "string");
});


test("music volume is clamped to the shared 0..1 range", () => {
  assert.equal(normalizeMusicState({ volume: 2 }).volume, 1);
  assert.equal(normalizeMusicState({ volume: -1 }).volume, 0);
  assert.equal(normalizeMusicState({ volume: 0.35 }).volume, 0.35);
});


test("music state tracks unique pause/resume votes and target intent", () => {
  const state = normalizeMusicState({
    current: { videoId: "dQw4w9WgXcQ", title: "Late Lounge", artist: "Guest" },
    playing: true,
    pauseVotes: ["a", "a", "b"],
    pauseTargetPlaying: false,
    position: 12,
    startedAt: 0,
  });
  assert.deepEqual(state.pauseVotes, ["a", "b"]);
  assert.equal(state.pauseTargetPlaying, false);
  assert.equal(currentMusicPosition({ ...state, playing: false }, 1000), 12);
});


test("football authority election is deterministic from shared presence", () => {
  const presence = {
    "gc-z": [{ kind: "player" }],
    "gc-a": [{ kind: "player" }],
    "gc-voice-only": [{ kind: "voice" }],
  };
  assert.equal(chooseRoomAuthority("gc-m", presence), "gc-a");
  assert.equal(chooseRoomAuthority("gc-a", presence), "gc-a");
});

test("football authority fallback ignores stale snapshots", () => {
  const now = 10000;
  const players = new Map([
    ["gc-stale", { lastSeen: 1000 }],
    ["gc-fresh", { lastSeen: 9500 }],
  ]);
  assert.equal(chooseRoomAuthority("gc-local", {}, players, now), "gc-fresh");
});
