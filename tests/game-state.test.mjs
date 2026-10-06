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


test("interaction anchors accept only supported shared interaction types", async () => {
  const { createInteractionAnchor, INTERACTION_TYPES } = await import("../lib/game-state.mjs");
  assert.ok(INTERACTION_TYPES.includes("SIT"));
  assert.deepEqual(createInteractionAnchor({ id: "sofa-1", type: "SIT", x: 2, z: 3, rot: 1.5 }), {
    id: "sofa-1", type: "SIT", x: 2, z: 3, rot: 1.5, radius: 1,
  });
  assert.equal(createInteractionAnchor({ id: "bad", type: "DANCE" }), null);
});

test("nearest interaction anchor is deterministic", async () => {
  const { findNearestInteractionAnchor } = await import("../lib/game-state.mjs");
  const anchor = findNearestInteractionAnchor(
    { x: 1.2, z: 1.1 },
    [
      { id: "far", type: "SIT", x: 3, z: 3, radius: 2 },
      { id: "near", type: "SIT", x: 1, z: 1, radius: 2 },
    ],
  );
  assert.equal(anchor.id, "near");
});
