import test from "node:test";
import assert from "node:assert/strict";
import {
  EMOTES,
  createClientId,
  formatChatTime,
  normalizeEmote,
  normalizeMusicState,
  sanitizeChatMessage,
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

test("music state normalizes a playable https track", () => {
  const state = normalizeMusicState({
    track: {
      id: 42,
      title: "Late Lounge",
      artist: "Guest",
      album: "GC",
      audio: "https://cdn.example.test/track.mp3",
      duration: 180,
    },
    position: 12.5,
    playing: true,
    senderId: "gc-test",
  });
  assert.equal(state.track.id, "42");
  assert.equal(state.position, 12.5);
  assert.equal(state.playing, true);
  assert.equal(state.volume, 0.8);
});

test("invalid music state is rejected", () => {
  assert.equal(normalizeMusicState({ track: { id: "x", audio: "http://insecure.test/a.mp3", duration: 2 } }), null);
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
