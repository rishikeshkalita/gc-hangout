import test from "node:test";
import assert from "node:assert/strict";
import {
  advanceMusicState,
  createEmptyMusicState,
  currentMusicPosition,
  normalizeMusicState,
  normalizeMusicTrack,
  parseYouTubeDuration,
} from "../lib/social-state.mjs";

const track = normalizeMusicTrack({
  videoId: "dQw4w9WgXcQ",
  title: "Room Song",
  artist: "Artist",
  duration: 212,
  requesterId: "gc-a",
});

test("normalizes YouTube tracks and rejects invalid ids", () => {
  assert.equal(track.videoId, "dQw4w9WgXcQ");
  assert.equal(track.id, "yt-dQw4w9WgXcQ");
  assert.equal(normalizeMusicTrack({ videoId: "bad" }), null);
});

test("normalizes shared queue state and deduplicates videos", () => {
  const state = normalizeMusicState({
    revision: 4,
    current: track,
    queue: [track, { ...track, videoId: "9bZkp7q19f0", id: "yt-9bZkp7q19f0" }],
    playing: true,
    position: 10,
    startedAt: 1000,
    updatedAt: 1000,
    leaderId: "gc-a",
  });
  assert.equal(state.queue.length, 1);
  assert.equal(state.current.videoId, "dQw4w9WgXcQ");
  assert.equal(currentMusicPosition(state, 3000), 12);
});

test("advance is idempotent at the state layer and clears skip votes", () => {
  const first = normalizeMusicState({
    ...createEmptyMusicState(),
    revision: 8,
    current: track,
    queue: [{ ...track, videoId: "9bZkp7q19f0", id: "yt-9bZkp7q19f0", title: "Next" }],
    skipVotes: ["gc-a", "gc-b"],
    playing: true,
    startedAt: 1000,
  });
  const next = advanceMusicState(first, 5000);
  assert.equal(next.revision, 9);
  assert.equal(next.current.videoId, "9bZkp7q19f0");
  assert.deepEqual(next.skipVotes, []);
  assert.equal(next.position, 0);
  assert.equal(next.startedAt, 5000);
});

test("parses YouTube ISO durations", () => {
  assert.equal(parseYouTubeDuration("PT1H2M3S"), 3723);
  assert.equal(parseYouTubeDuration("PT4M12S"), 252);
});
