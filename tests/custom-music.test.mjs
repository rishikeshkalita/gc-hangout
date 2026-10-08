import test from "node:test";
import assert from "node:assert/strict";
import {
  MUSIC_MAX_FILE_BYTES,
  MUSIC_MAX_ROOM_BYTES,
  MUSIC_QUEUE_LIMIT,
  MUSIC_TTL_MS,
  currentMusicPosition,
  createEmptyMusicState,
  normalizeMusicState,
  normalizeMusicTrack,
} from "../lib/social-state.mjs";

const track = normalizeMusicTrack({
  id: "11111111-1111-4111-8111-111111111111",
  title: "Room Song",
  artist: "Artist",
  filename: "room-song.mp3",
  storage_path: "main/user/11111111-1111-4111-8111-111111111111",
  duration: 212,
  expires_at: "2026-10-11T00:00:00.000Z",
});

test("normalizes uploaded tracks without YouTube identifiers", () => {
  assert.equal(track.id, "11111111-1111-4111-8111-111111111111");
  assert.equal(track.storagePath, "main/user/11111111-1111-4111-8111-111111111111");
  assert.equal(normalizeMusicTrack({ title: "missing id" }), null);
});

test("normalizes shared room state and removes duplicate current/queue tracks", () => {
  const state = normalizeMusicState({
    current: track,
    queue: [track, { ...track, id: "22222222-2222-4222-8222-222222222222", title: "Next" }],
    playing: true,
    position: 10,
    startedAt: 1000,
    volume: 0.7,
  });
  assert.equal(state.queue.length, 1);
  assert.equal(state.current.id, track.id);
  assert.equal(currentMusicPosition(state, 3000), 12);
});

test("empty state is stopped and has the shared default volume", () => {
  const state = createEmptyMusicState();
  assert.equal(state.current, null);
  assert.equal(state.playing, false);
  assert.equal(state.volume, 0.8);
});

test("music resource limits are explicit", () => {
  assert.equal(MUSIC_MAX_FILE_BYTES, 25 * 1024 * 1024);
  assert.equal(MUSIC_MAX_ROOM_BYTES, 1024 * 1024 * 1024);
  assert.equal(MUSIC_QUEUE_LIMIT, 100);
  assert.equal(MUSIC_TTL_MS, 72 * 60 * 60 * 1000);
});
