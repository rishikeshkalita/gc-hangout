import test from "node:test";
import assert from "node:assert/strict";
import {
  AVATAR_IDS,
  clampRoomPosition,
  createLocalPlayer,
  isMoving,
  updatePlayer,
  INTERACTION_TYPES,
  createInteractionAnchor,
  findNearestInteractionAnchor,
  createInteractionState,
  advanceInteraction,
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

test("interaction anchors accept only supported shared interaction types", () => {
  assert.ok(INTERACTION_TYPES.includes("SIT"));
  assert.deepEqual(createInteractionAnchor({ id: "sofa-1", type: "SIT", x: 2, z: 3, rot: 1.5 }), {
    id: "sofa-1", type: "SIT", x: 2, z: 3, rot: 1.5, radius: 1,
  });
  assert.equal(createInteractionAnchor({ id: "bad", type: "DANCE" }), null);
});

test("interaction anchors preserve explicit target and exit positions", () => {
  const anchor = createInteractionAnchor({
    id: "eat",
    type: "EAT",
    x: 8,
    z: 5.8,
    targetX: 8,
    targetZ: 3.85,
    targetRot: Math.PI,
    exitX: 8,
    exitZ: 2.8,
    radius: 2.6,
  });
  assert.deepEqual(anchor, {
    id: "eat",
    type: "EAT",
    x: 8,
    z: 5.8,
    rot: 0,
    targetX: 8,
    targetZ: 3.85,
    targetRot: Math.PI,
    exitX: 8,
    exitZ: 2.8,
    radius: 2.6,
  });
});

test("nearest interaction anchor is deterministic", () => {
  const anchor = findNearestInteractionAnchor(
    { x: 1.2, z: 1.1 },
    [
      { id: "far", type: "SIT", x: 3, z: 3, radius: 2 },
      { id: "near", type: "SIT", x: 1, z: 1, radius: 2 },
    ],
  );
  assert.equal(anchor.id, "near");
});

test("interaction lifecycle locks movement until explicit release", () => {
  const anchor = createInteractionAnchor({ id: "seat", type: "SIT", x: 1, z: 2, rot: 0 });
  const reserved = createInteractionState(anchor, "player-1");
  assert.equal(reserved.phase, "reserve");
  assert.equal(reserved.movementLocked, true);
  assert.equal(advanceInteraction(reserved, "align").movementLocked, true);
  const released = advanceInteraction(reserved, "release");
  assert.equal(released.status, "released");
  assert.equal(released.movementLocked, false);
});

test("interaction anchors include DRINK and generic INTERACT types", () => {
  assert.ok(INTERACTION_TYPES.includes("DRINK"));
  assert.ok(INTERACTION_TYPES.includes("INTERACT"));
  assert.equal(createInteractionAnchor({ id: "drink", type: "DRINK", x: 1, z: 2, rot: 0 }).type, "DRINK");
  assert.equal(createInteractionAnchor({ id: "generic", type: "INTERACT", x: 2, z: 3, rot: 0 }).type, "INTERACT");
});
