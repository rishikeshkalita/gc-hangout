import test from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_IDS,
  clampRoomPosition,
  createLocalPlayer,
  isMoving,
  updatePlayer,
} from "../lib/game-state.mjs";

test("local player is created immediately as a human-avatar identity", () => {
  const player = createLocalPlayer({ id: "p1", name: " Rishi ", avatarId: "maya" });
  assert.equal(player.id, "p1");
  assert.equal(player.name, "Rishi");
  assert.equal(player.avatarId, "maya");
  assert.equal(player.x, 0);
  assert.equal(player.z, 0);
  assert.equal(player.moving, false);
});

test("invalid avatar ids fall back to a known human avatar", () => {
  const player = createLocalPlayer({ id: "p1", avatarId: "capsule" });
  assert.ok(AVATAR_IDS.includes(player.avatarId));
  assert.notEqual(player.avatarId, "capsule");
});

test("player state updates do not mutate the original player", () => {
  const player = createLocalPlayer({ id: "p1" });
  const next = updatePlayer(player, { x: 3, z: -2, moving: true, speed: 2.6 });
  assert.equal(player.x, 0);
  assert.equal(next.x, 3);
  assert.equal(next.z, -2);
  assert.equal(isMoving(next), true);
  assert.equal(isMoving(player), false);
});

test("room position clamps to the playable boundary", () => {
  assert.deepEqual(clampRoomPosition({ x: 99, z: -99 }), { x: 14.66, z: -9.66 });
  assert.deepEqual(clampRoomPosition({ x: 2, z: 3 }), { x: 2, z: 3 });
});
