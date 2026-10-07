"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";

const WORLD = { halfX: 15, halfZ: 10, playerRadius: 0.34 };
const AVATARS = [
  { id: "maya", label: "Maya", skin: "#b86f4b", shirt: "#6c63d9", pants: "#26354d", hair: "#241b18" },
  { id: "noah", label: "Noah", skin: "#8d5524", shirt: "#2e8b78", pants: "#24313c", hair: "#171513" },
  { id: "riya", label: "Riya", skin: "#d99a6c", shirt: "#d45d7d", pants: "#3d3150", hair: "#3a211c" },
  { id: "aarav", label: "Aarav", skin: "#c68642", shirt: "#d08a3e", pants: "#29394b", hair: "#201915" },
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));

const INTERACTION_ANCHORS = Object.freeze([
  { id: "sofa-a-1", type: "SIT", label: "Sit", x: -11.4, z: -6.8, rot: 0, targetX: -11.4, targetZ: -6.8, targetRot: 0, triggerX: -11.4, triggerZ: -5.35, exitX: -7.0, exitZ: -5.35, radius: 1.45 },
  { id: "sofa-a-2", type: "SIT", label: "Sit", x: -9.8, z: -6.8, rot: 0, targetX: -9.8, targetZ: -6.8, targetRot: 0, triggerX: -9.8, triggerZ: -5.35, exitX: -7.0, exitZ: -5.35, radius: 1.45 },
  { id: "sofa-a-3", type: "SIT", label: "Sit", x: -8.2, z: -6.8, rot: 0, targetX: -8.2, targetZ: -6.8, targetRot: 0, triggerX: -8.2, triggerZ: -5.35, exitX: -7.0, exitZ: -5.35, radius: 1.45 },
  { id: "sofa-b-1", type: "SIT", label: "Sit", x: -11.4, z: -0.8, rot: Math.PI, targetX: -11.4, targetZ: -0.8, targetRot: Math.PI, triggerX: -11.4, triggerZ: -2.25, exitX: -7.0, exitZ: -2.25, radius: 1.45 },
  { id: "sofa-b-2", type: "SIT", label: "Sit", x: -9.8, z: -0.8, rot: Math.PI, targetX: -9.8, targetZ: -0.8, targetRot: Math.PI, triggerX: -9.8, triggerZ: -2.25, exitX: -7.0, exitZ: -2.25, radius: 1.45 },
  { id: "sofa-b-3", type: "SIT", label: "Sit", x: -8.2, z: -0.8, rot: Math.PI, targetX: -8.2, targetZ: -0.8, targetRot: Math.PI, triggerX: -8.2, triggerZ: -2.25, exitX: -7.0, exitZ: -2.25, radius: 1.45 },
  { id: "dining-1", type: "SIT", label: "Sit", x: 8.2, z: 3.95, rot: 0, targetX: 8.2, targetZ: 3.95, targetRot: 0, triggerX: 8.2, triggerZ: 3.05, exitX: 7.0, exitZ: 2.45, radius: 1.45 },
  { id: "dining-2", type: "SIT", label: "Sit", x: 9.7, z: 3.95, rot: 0, targetX: 9.7, targetZ: 3.95, targetRot: 0, triggerX: 9.7, triggerZ: 3.05, exitX: 9.7, exitZ: 2.45, radius: 1.45 },
  { id: "dining-3", type: "SIT", label: "Sit", x: 11.2, z: 3.95, rot: 0, targetX: 11.2, targetZ: 3.95, targetRot: 0, triggerX: 11.2, triggerZ: 3.05, exitX: 11.2, exitZ: 2.45, radius: 1.45 },
  { id: "dining-4", type: "SIT", label: "Sit", x: 8.2, z: 7.65, rot: Math.PI, targetX: 8.2, targetZ: 7.65, targetRot: Math.PI, triggerX: 8.2, triggerZ: 8.55, exitX: 7.0, exitZ: 9.0, radius: 1.45 },
  { id: "dining-5", type: "SIT", label: "Sit", x: 9.7, z: 7.65, rot: Math.PI, targetX: 9.7, targetZ: 7.65, targetRot: Math.PI, triggerX: 9.7, triggerZ: 8.55, exitX: 9.7, exitZ: 9.0, radius: 1.45 },
  { id: "dining-6", type: "SIT", label: "Sit", x: 11.2, z: 7.65, rot: Math.PI, targetX: 11.2, targetZ: 7.65, targetRot: Math.PI, triggerX: 11.2, triggerZ: 8.55, exitX: 11.2, exitZ: 9.0, radius: 1.45 },
  { id: "bed", type: "SLEEP", label: "Sleep", x: 8.7, z: -4.25, rot: 0, targetX: 8.7, targetZ: -6.0, targetRot: 0, triggerX: 8.7, triggerZ: -4.25, exitX: 5.8, exitZ: -4.15, radius: 1.5 },
  { id: "tv", type: "WATCH_TV", label: "Watch TV", x: 0, z: -6.9, rot: Math.PI, targetX: 0, targetZ: -6.9, targetRot: Math.PI, triggerX: 0, triggerZ: -6.9, exitX: 0, exitZ: -5.55, radius: 2.0 },
  { id: "food-table", type: "EAT", label: "Eat", x: 9.7, z: 4.55, rot: 0, targetX: 9.7, targetZ: 4.55, targetRot: 0, triggerX: 9.7, triggerZ: 4.55, exitX: 7.6, exitZ: 4.55, radius: 0.9 },
  { id: "dining-eat", type: "EAT", label: "Eat", requiresSitting: true, x: 9.7, z: 5.8, rot: 0, targetX: 9.7, targetZ: 5.8, targetRot: 0, triggerX: 9.7, triggerZ: 5.8, exitX: 9.7, exitZ: 5.8, radius: 3.0 },
  { id: "drink-table", type: "DRINK", label: "Drink", x: 12.75, z: 4.15, rot: -Math.PI / 2, targetX: 12.15, targetZ: 4.15, targetRot: -Math.PI / 2, triggerX: 12.75, triggerZ: 4.15, exitX: 12.75, exitZ: 3.9, radius: 1.0 },
  { id: "room-interact", type: "INTERACT", label: "Interact", x: 0, z: 0, rot: 0, targetX: 0, targetZ: 0, exitX: 0, exitZ: 1.5, radius: 1.35 },
]);

function findNearbyAnchors(x, z) {
  const bestByType = new Map();
  for (const anchor of INTERACTION_ANCHORS) {
    const triggerX = anchor.triggerX ?? anchor.x;
    const triggerZ = anchor.triggerZ ?? anchor.z;
    const distance = Math.hypot(x - triggerX, z - triggerZ);
    if (distance >= anchor.radius) continue;
    const previous = bestByType.get(anchor.type);
    if (!previous || distance < previous.distance) {
      bestByType.set(anchor.type, { anchor, distance });
    }
  }
  return [...bestByType.values()]
    .sort((a, b) => a.distance - b.distance)
    .map(({ anchor }) => anchor);
}

const OBSTACLES = [
  { x: -9.8, z: -6.8, rx: 2.8, rz: 0.7 },
  { x: -9.8, z: -0.8, rx: 2.8, rz: 0.7 },
  { x: -9.8, z: -3.8, rx: 1.1, rz: 0.7 },
  { x: 0, z: -8.55, rx: 5.2, rz: 0.65 },
  { x: 9.7, z: 5.8, rx: 2.4, rz: 1.35 },
  { x: 13.25, z: 0.7, rx: 0.8, rz: 3.2 },
  { x: 8.7, z: -6.5, rx: 1.8, rz: 1.8 },
];

function blocked(x, z) {
  const r = WORLD.playerRadius;
  if (x < -WORLD.halfX + r || x > WORLD.halfX - r || z < -WORLD.halfZ + r || z > WORLD.halfZ - r) return true;
  return OBSTACLES.some((b) => {
    const qx = clamp(x, b.x - b.rx, b.x + b.rx);
    const qz = clamp(z, b.z - b.rz, b.z + b.rz);
    return Math.hypot(x - qx, z - qz) < r;
  });
}

function tryMove(x, z, dx, dz) {
  const nx = x + dx;
  const nz = z + dz;
  if (!blocked(nx, nz)) return { x: nx, z: nz };
  if (!blocked(x + dx, z)) return { x: x + dx, z };
  if (!blocked(x, z + dz)) return { x, z: z + dz };
  return { x, z };
}

function HumanAvatar({ avatar, name, moving, local, pose = "idle" }) {
  const group = useRef();
  const visual = useRef();
  const arms = useRef([]);
  const legs = useRef([]);
  const { skin, shirt, pants, hair } = avatar;
  const displayName = (name || avatar.label || "You").trim().slice(0, 18).toUpperCase();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const stride = moving ? Math.sin(t * 11) * 0.48 : Math.sin(t * 2.2) * 0.025;
    const seated = pose === "sit";
    const gesture = pose === "eat" || pose === "drink";
    const eating = pose === "eat";

    group.current.position.y = pose === "sleep" ? 1.0 : seated ? -0.2 : 0;
    group.current.rotation.x = pose === "sleep" ? -Math.PI / 2 : 0;
    group.current.rotation.z = moving && !seated ? Math.sin(t * 11) * 0.012 : 0;

    if (arms.current[0]) {
      arms.current[0].rotation.x = seated ? -0.44 : gesture ? -0.9 - Math.sin(t * 7) * 0.12 : moving ? stride : 0.02 * Math.sin(t * 2.2);
      arms.current[0].rotation.z = gesture ? -0.18 : 0;
    }
    if (arms.current[1]) {
      arms.current[1].rotation.x = seated ? -0.44 : pose === "drink" ? -1.05 : pose === "eat" ? -0.65 : moving ? -stride : -0.02 * Math.sin(t * 2.2);
      arms.current[1].rotation.z = gesture ? 0.18 : 0;
      if (eating) arms.current[1].rotation.y = Math.sin(t * 7) * 0.08;
    }
    if (legs.current[0]) legs.current[0].rotation.x = seated ? -1.02 : moving ? -stride : 0;
    if (legs.current[1]) legs.current[1].rotation.x = seated ? -1.02 : moving ? stride : 0;
  });

  return (
    <group ref={group}>
      <group ref={visual}>
      <mesh position={[0, 1.62, 0]} castShadow><sphereGeometry args={[0.31, 20, 16]} /><meshStandardMaterial color={skin} roughness={0.72} /></mesh>
      <mesh position={[0, 1.82, 0]} castShadow scale={[1.05, 0.62, 1.05]}><sphereGeometry args={[0.31, 20, 16]} /><meshStandardMaterial color={hair} roughness={0.9} /></mesh>
      <mesh position={[-0.11, 1.63, 0.285]} castShadow><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#f6f3ef" roughness={0.45} /></mesh>
      <mesh position={[0.11, 1.63, 0.285]} castShadow><sphereGeometry args={[0.045, 10, 8]} /><meshStandardMaterial color="#f6f3ef" roughness={0.45} /></mesh>
      <mesh position={[-0.11, 1.63, 0.322]}><sphereGeometry args={[0.019, 8, 6]} /><meshStandardMaterial color="#161922" /></mesh>
      <mesh position={[0.11, 1.63, 0.322]}><sphereGeometry args={[0.019, 8, 6]} /><meshStandardMaterial color="#161922" /></mesh>
      <mesh position={[0, 1.54, 0.315]}><sphereGeometry args={[0.035, 8, 6]} /><meshStandardMaterial color={skin} /></mesh>
      <RoundedBox position={[0, 1.02, 0]} args={[0.66, 0.78, 0.38]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color={shirt} roughness={0.82} /></RoundedBox>
      <mesh position={[0, 1.38, 0.02]} castShadow><sphereGeometry args={[0.16, 16, 12]} /><meshStandardMaterial color={skin} roughness={0.72} /></mesh>
      <mesh ref={(node) => { arms.current[0] = node; }} position={[-0.45, 1.08, 0]} castShadow><capsuleGeometry args={[0.08, 0.48, 6, 10]} /><meshStandardMaterial color={skin} roughness={0.76} /></mesh>
      <mesh ref={(node) => { arms.current[1] = node; }} position={[0.45, 1.08, 0]} castShadow><capsuleGeometry args={[0.08, 0.48, 6, 10]} /><meshStandardMaterial color={skin} roughness={0.76} /></mesh>
      <mesh ref={(node) => { legs.current[0] = node; }} position={[-0.18, 0.45, 0]} castShadow><capsuleGeometry args={[0.095, 0.52, 6, 10]} /><meshStandardMaterial color={pants} roughness={0.84} /></mesh>
      <mesh ref={(node) => { legs.current[1] = node; }} position={[0.18, 0.45, 0]} castShadow><capsuleGeometry args={[0.095, 0.52, 6, 10]} /><meshStandardMaterial color={pants} roughness={0.84} /></mesh>
      <mesh position={[-0.18, 0.12, 0.1]} castShadow><capsuleGeometry args={[0.11, 0.22, 6, 10]} /><meshStandardMaterial color="#171b24" roughness={0.72} /></mesh>
      <mesh position={[0.18, 0.12, 0.1]} castShadow><capsuleGeometry args={[0.11, 0.22, 6, 10]} /><meshStandardMaterial color="#171b24" roughness={0.72} /></mesh>
      {pose === "eat" && <mesh position={[0.34, 1.04, 0.3]} rotation={[0.2, 0.2, -0.25]} castShadow><boxGeometry args={[0.16, 0.06, 0.22]} /><meshStandardMaterial color="#d59a43" roughness={0.7} /></mesh>}
      {pose === "drink" && <mesh position={[0.36, 1.05, 0.28]} castShadow><cylinderGeometry args={[0.07, 0.07, 0.2, 12]} /><meshStandardMaterial color="#8ed7ef" transparent opacity={0.85} roughness={0.3} /></mesh>}
      </group>
      <Billboard position={[0, 2.18, 0]} follow><Text fontSize={0.18} color={local ? "#d8ceff" : "#ffffff"} anchorX="center" outlineWidth={0.012} outlineColor="#10131b">{displayName}</Text></Billboard>
    </group>
  );
}

function LocalPlayer({ state, onMove, onNearby, interaction, joystickRef, motionResetKey }) {
  const keys = useRef(new Set());
  const yaw = useRef(0.2);
  const pitch = useRef(0.38);
  const cameraDistance = useRef(7.0);
  const drag = useRef(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraPosition = useRef(new THREE.Vector3(0, 3.6, 7.8));
  const playerGroup = useRef();
  const motion = useRef({ x: state.x, z: state.z, rot: state.rot, moving: state.moving, speed: state.speed });
  const lastResetKey = useRef(motionResetKey);
  const dirty = useRef(false);
  const nearbyRef = useRef("");
  const { camera, gl, size } = useThree();
  const mobile = size.width <= 700;

  useEffect(() => {
    const down = (event) => keys.current.add(event.key.toLowerCase());
    const up = (event) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  useEffect(() => {
    const element = gl.domElement;
    const begin = (event) => {
      if (event.pointerType === "mouse" && event.button !== 0) return;
      drag.current = { x: event.clientX, y: event.clientY };
      element.setPointerCapture?.(event.pointerId);
    };
    const move = (event) => {
      if (!drag.current) return;
      const dx = event.clientX - drag.current.x;
      const dy = event.clientY - drag.current.y;
      drag.current.x = event.clientX;
      drag.current.y = event.clientY;
      yaw.current -= dx * 0.006;
      pitch.current = clamp(pitch.current + dy * 0.004, 0.18, 0.72);
    };
    const end = (event) => {
      drag.current = null;
      if (event?.pointerId != null) element.releasePointerCapture?.(event.pointerId);
    };
    element.addEventListener("pointerdown", begin);
    element.addEventListener("pointermove", move);
    element.addEventListener("pointerup", end);
    element.addEventListener("pointercancel", end);
    return () => {
      element.removeEventListener("pointerdown", begin);
      element.removeEventListener("pointermove", move);
      element.removeEventListener("pointerup", end);
      element.removeEventListener("pointercancel", end);
    };
  }, [gl]);

  useEffect(() => {
    const element = gl.domElement;
    const wheel = (event) => {
      event.preventDefault();
      cameraDistance.current = clamp(cameraDistance.current + event.deltaY * 0.006, mobile ? 6.2 : 5.2, 8.8);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [gl, mobile]);

  useEffect(() => {
    cameraDistance.current = mobile ? clamp(cameraDistance.current, 6.2, 8.8) : clamp(cameraDistance.current, 5.2, 8.8);
  }, [mobile]);

  useEffect(() => {
    motion.current = { x: state.x, z: state.z, rot: state.rot, moving: false, speed: 0 };
    dirty.current = false;
  }, [motionResetKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (!dirty.current) return;
      dirty.current = false;
      const snapshot = motion.current;
      onMove((current) => ({ ...current, x: snapshot.x, z: snapshot.z, rot: snapshot.rot, moving: snapshot.moving, speed: snapshot.speed }));
    }, 50);
    return () => window.clearInterval(timer);
  }, [onMove]);

  useFrame((_, dt) => {
    const safeDt = Math.min(dt, 0.05);
    const current = motion.current;
    if (lastResetKey.current !== motionResetKey) {
      lastResetKey.current = motionResetKey;
      current.x = state.x;
      current.z = state.z;
      current.rot = state.rot;
      current.moving = false;
      current.speed = 0;
      dirty.current = false;
    }
    const keyboardForward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
    const keyboardStrafe = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const touch = joystickRef.current;
    const forward = touch.active ? touch.y : keyboardForward;
    const strafe = touch.active ? -touch.x : keyboardStrafe;
    const magnitude = Math.min(1, Math.hypot(strafe, forward));

    if (!interaction || interaction.phase === "release") {
      if (magnitude > 0.08) {
        const speed = keys.current.has("shift") || mobile ? 5.2 : 3.8;
        const inputLength = Math.hypot(strafe, forward);
        const f = forward / inputLength;
        const s = strafe / inputLength;
        const forwardX = Math.sin(yaw.current);
        const forwardZ = Math.cos(yaw.current);
        const rightX = Math.cos(yaw.current);
        const rightZ = -Math.sin(yaw.current);
        const dirX = forwardX * f + rightX * s;
        const dirZ = forwardZ * f + rightZ * s;
        const distance = speed * safeDt;
        const moved = tryMove(current.x, current.z, dirX * distance, dirZ * distance);
        current.x = moved.x;
        current.z = moved.z;
        current.rot = Math.atan2(dirX, dirZ);
        current.moving = true;
        current.speed = speed;
        dirty.current = true;
      } else if (current.moving || current.speed !== 0) {
        current.moving = false;
        current.speed = 0;
        dirty.current = true;
      }
    } else {
      current.moving = false;
      current.speed = 0;
      dirty.current = true;
    }

    const nearby = findNearbyAnchors(current.x, current.z);
    const nearbyId = nearby.map((item) => item.id).join("|");
    if (nearbyRef.current !== nearbyId) {
      nearbyRef.current = nearbyId;
      onNearby(nearby);
    }

    if (interaction && (interaction.phase === "align" || interaction.phase === "animate" || interaction.phase === "sync")) {
      const targetX = interaction.anchor.targetX ?? interaction.anchor.x;
      const targetZ = interaction.anchor.targetZ ?? interaction.anchor.z;
      const targetRot = interaction.anchor.targetRot ?? interaction.anchor.rot;
      if (Math.hypot(targetX - current.x, targetZ - current.z) > 0.02) {
        current.x = targetX;
        current.z = targetZ;
        current.rot = targetRot;
        dirty.current = true;
      }
    }

    if (playerGroup.current) {
      playerGroup.current.position.set(current.x, 0, current.z);
      playerGroup.current.rotation.y = current.rot;
    }

    const targetY = (mobile ? 0.95 : 1.05) + Math.sin(pitch.current) * cameraDistance.current;
    const horizontal = Math.cos(pitch.current) * cameraDistance.current;
    const desired = cameraTarget.current.set(current.x - Math.sin(yaw.current) * horizontal, targetY, current.z - Math.cos(yaw.current) * horizontal);
    cameraPosition.current.lerp(desired, 1 - Math.exp(-8 * safeDt));
    cameraPosition.current.x = clamp(cameraPosition.current.x, -WORLD.halfX + 1.0, WORLD.halfX - 1.0);
    cameraPosition.current.z = clamp(cameraPosition.current.z, -WORLD.halfZ + 1.0, WORLD.halfZ - 1.0);
    camera.position.copy(cameraPosition.current);
    camera.lookAt(current.x, mobile ? 0.9 : 1.0, current.z);
  });

  const pose = interaction?.anchor?.type === "SLEEP" ? "sleep" : interaction?.anchor?.type === "SIT" ? "sit" : interaction?.anchor?.type === "EAT" ? "eat" : interaction?.anchor?.type === "DRINK" ? "drink" : interaction?.anchor?.type === "WATCH_TV" ? "watch" : "idle";

  return (
    <group ref={playerGroup}>
      <HumanAvatar avatar={state.avatar} name={state.name} moving={state.moving} local pose={pose} />
      {interaction?.status === "active" && <Text position={[0, 2.45, 0]} fontSize={0.16} color="#d8ceff" anchorX="center">{interaction.anchor.label.toUpperCase()}</Text>}
    </group>
  );
}

function Sofa({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <RoundedBox args={[5.4, 0.55, 1.05]} position={[0, 0.52, 0]} radius={0.14} smoothness={5} castShadow><meshStandardMaterial color="#3f4b61" roughness={0.85} /></RoundedBox>
      <RoundedBox args={[5.4, 1.0, 0.3]} position={[0, 1.0, -0.38]} radius={0.12} smoothness={5} castShadow><meshStandardMaterial color="#48556c" roughness={0.85} /></RoundedBox>
      {[-2.35, 2.35].map((x) => <RoundedBox key={x} args={[0.32, 0.85, 0.9]} position={[x, 0.9, 0]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#48556c" /></RoundedBox>)}
    </group>
  );
}

function Chair({ position = [0, 0, 0], rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.8, 0.36, 0.8]} position={[0, 0.48, 0]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#556071" /></RoundedBox>
      <RoundedBox args={[0.8, 0.9, 0.22]} position={[0, 0.95, -0.3]} radius={0.08} smoothness={4} castShadow><meshStandardMaterial color="#606c7f" /></RoundedBox>
    </group>
  );
}

function CoffeeTable({ position }) {
  return <RoundedBox args={[2.0, 0.16, 1.0]} position={[position[0], 0.55, position[2]]} radius={0.08} smoothness={4} castShadow><meshStandardMaterial color="#7a5946" /></RoundedBox>;
}

function Bed({ position }) {
  return (
    <group position={position}>
      <RoundedBox args={[3.0, 0.38, 4.2]} position={[0, 0.45, 0]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#303746" /></RoundedBox>
      <RoundedBox args={[2.8, 0.24, 3.3]} position={[0, 0.72, 0.2]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#d9d3c8" /></RoundedBox>
      <RoundedBox args={[2.8, 0.42, 0.35]} position={[0, 0.92, -1.65]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#ece7dd" /></RoundedBox>
    </group>
  );
}

function Plant({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.28, 0.34, 0.44, 14]} /><meshStandardMaterial color="#5a4334" /></mesh>
      {[0, 1.8, 3.6, 5.4].map((a) => <mesh key={a} position={[Math.cos(a) * 0.42, 1.15, Math.sin(a) * 0.42]} rotation={[0.25, a, 0.45]} castShadow><sphereGeometry args={[0.55, 10, 7]} /><meshStandardMaterial color="#4b8549" roughness={0.95} /></mesh>)}
      <mesh position={[0, 1.0, 0]} castShadow><cylinderGeometry args={[0.06, 0.09, 1.6, 10]} /><meshStandardMaterial color="#315e39" /></mesh>
    </group>
  );
}

function Lamp({ position }) {
  return (
    <group position={position}>
      <mesh position={[0, 1.5, 0]}><cylinderGeometry args={[0.04, 0.04, 3, 10]} /><meshStandardMaterial color="#242832" /></mesh>
      <mesh position={[0, 3.05, 0]}><coneGeometry args={[0.42, 0.48, 20]} /><meshStandardMaterial color="#e5d7bd" emissive="#fff0c9" emissiveIntensity={0.25} /></mesh>
      <pointLight position={[0, 2.9, 0]} intensity={1.0} distance={5.5} color="#ffe8bd" />
    </group>
  );
}

function GraffitiWall() {
  const words = [
    ["Maksudai", -11.8, 3.7, -9.76, -0.08, 0.54],
    ["Boineksudai", -7.0, 3.05, -9.76, 0.05, 0.46],
    ["Rendi", -3.3, 3.65, -9.76, -0.12, 0.62],
    ["sutamareni", 1.3, 3.05, -9.76, 0.08, 0.5],
    ["koti mara", 5.4, 3.7, -9.76, -0.08, 0.52],
    ["buskarpu", 9.2, 3.15, -9.76, 0.1, 0.48],
    ["suor", -12.3, 2.55, -9.76, 0.12, 0.62],
    ["kukur", -8.6, 2.2, -9.76, -0.05, 0.58],
    ["notisuda", -4.6, 2.55, -9.76, 0.1, 0.46],
    ["boinerlalak", 0.1, 2.35, -9.76, -0.1, 0.44],
    ["renda", 4.2, 2.5, -9.76, 0.08, 0.55],
    ["johra", 7.3, 2.35, -9.76, -0.1, 0.6],
    ["sudhirbhai", 10.2, 2.45, -9.76, 0.06, 0.46],
  ];
  const splashes = [
    [-11.7, 4.05, 0.08, 0.32], [-7.0, 3.45, -0.1, 0.28], [-3.2, 4.0, 0.06, 0.25],
    [1.0, 3.45, -0.06, 0.3], [5.2, 4.02, 0.08, 0.27], [9.1, 3.55, -0.04, 0.26],
    [-9.5, 2.0, 0.12, 0.22], [0.0, 2.0, -0.08, 0.24], [6.7, 2.0, 0.1, 0.2],
  ];
  return (
    <group>
      <mesh position={[0, 3.0, -9.79]}>
        <planeGeometry args={[27.5, 3.8]} />
        <meshBasicMaterial color="#17111d" transparent opacity={0.82} />
      </mesh>
      {splashes.map(([x, y, r, s], index) => (
        <mesh key={index} position={[x, y, -9.745]} rotation={[0, 0, r]} scale={[s, s * 0.55, 1]}>
          <circleGeometry args={[0.9, 12]} />
          <meshBasicMaterial color="#8f46cf" transparent opacity={0.5} depthWrite={false} />
        </mesh>
      ))}
      {words.map(([word, x, y, z, rotation, fontSize], index) => (
        <Text
          key={word}
          position={[x, y, z]}
          rotation={[0, 0, rotation]}
          fontSize={fontSize}
          maxWidth={4.2}
          color={index % 3 === 0 ? "#ff62d5" : index % 3 === 1 ? "#b56cff" : "#7be7ff"}
          outlineWidth={0.025}
          outlineColor="#241129"
          anchorX="center"
          anchorY="middle"
        >
          {word}
        </Text>
      ))}
    </group>
  );
}

function Furniture() {
  return (
    <group>
      <group position={[-9.8, 0, -6.8]}>
        <Sofa />
      </group>
      <group position={[-9.8, 0, -0.8]} rotation={[0, Math.PI, 0]}>
        <Sofa />
      </group>
      <CoffeeTable position={[-9.8, 0, -3.8]} />
      <group position={[0, 0, -9.15]}>
        <RoundedBox args={[9.0, 3.35, 0.38]} position={[0, 2.2, 0]} radius={0.18} smoothness={5} castShadow><meshStandardMaterial color="#10141c" roughness={0.32} metalness={0.15} /></RoundedBox>
        <mesh position={[0, 2.2, 0.22]}><planeGeometry args={[8.45, 2.72]} /><meshStandardMaterial color="#17182a" emissive="#433a78" emissiveIntensity={0.55} roughness={0.55} /></mesh>
        <Text position={[-3.75, 2.85, 0.25]} fontSize={0.28} color="#e2dcff" anchorX="left">GC HANGOUT</Text>
        <Text position={[-3.75, 2.45, 0.25]} fontSize={0.18} color="#aaa2d8" anchorX="left">TV / MUSIC</Text>
        <RoundedBox args={[5.4, 0.22, 0.9]} position={[0, 0.58, 0]} radius={0.08} smoothness={4} castShadow><meshStandardMaterial color="#2a303c" roughness={0.78} /></RoundedBox>
        <mesh position={[0, 0.9, 0.02]}><cylinderGeometry args={[0.11, 0.11, 0.22, 16]} /><meshStandardMaterial color="#1a1e27" /></mesh>
      </group>
      <group position={[9.7, 0, 5.8]}>
        <RoundedBox args={[4.8, 0.25, 2.4]} position={[0, 0.95, 0]} radius={0.12} smoothness={5} castShadow><meshStandardMaterial color="#72513f" /></RoundedBox>
        {[-1.5, 0, 1.5].map((x) => <Chair key={x} position={[x, 0, -1.85]} />)}
        {[-1.5, 0, 1.5].map((x) => <Chair key={x} position={[x, 0, 1.85]} rotation={Math.PI} />)}
        <group position={[-1.35, 1.13, -0.25]}>
          <RoundedBox args={[0.52, 0.08, 0.34]} radius={0.04} smoothness={3}><meshStandardMaterial color="#ece7dd" /></RoundedBox>
          <mesh position={[0, 0.08, 0]}><cylinderGeometry args={[0.12, 0.1, 0.05, 12]} /><meshStandardMaterial color="#d59a43" roughness={0.72} /></mesh>
        </group>
        <group position={[0.2, 1.13, 0.2]}>
          <RoundedBox args={[0.52, 0.08, 0.34]} radius={0.04} smoothness={3}><meshStandardMaterial color="#ece7dd" /></RoundedBox>
          <mesh position={[0, 0.1, 0]}><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#d56b52" roughness={0.75} /></mesh>
        </group>
        <group position={[1.45, 1.13, -0.15]}>
          <mesh><cylinderGeometry args={[0.08, 0.07, 0.2, 12]} /><meshStandardMaterial color="#8ed7ef" transparent opacity={0.86} roughness={0.3} /></mesh>
        </group>
      </group>
      <group position={[8.7, 0, -6.5]}><Bed position={[0, 0, 0]} /></group>
      <group position={[13.25, 0, 0.7]}><RoundedBox args={[1.4, 1.1, 6.2]} position={[0, 0.6, 0]} radius={0.12} smoothness={4}><meshStandardMaterial color="#343941" /></RoundedBox></group>
      <Plant position={[-13.1, 0, 7.5]} />
      <Plant position={[13.0, 0, -7.7]} scale={1.15} />
      <Lamp position={[-5.7, 0, 6.8]} />
      <Lamp position={[5.8, 0, 6.8]} />
    </group>
  );
}

function Room({ player, onMove, onNearby, interaction, joystickRef, motionResetKey }) {
  return (
    <>
      <ambientLight intensity={1.55} />
      <hemisphereLight args={["#fff2dc", "#303847", 1.1]} />
      <directionalLight position={[5, 10, 4]} intensity={0.72} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 4.5, 0]} intensity={1.8} distance={18} color="#fff1d5" />
      <pointLight position={[-9, 3.6, -3]} intensity={1.0} distance={10} color="#e2e8ff" />
      <pointLight position={[9, 3.6, 4]} intensity={1.0} distance={10} color="#ffe5c2" />
      <color attach="background" args={["#141821"]} />
      <fog attach="fog" args={["#141821", 24, 46]} />

      <mesh receiveShadow position={[0, -0.12, 0]}><boxGeometry args={[30, 0.24, 20]} /><meshStandardMaterial color="#343b46" roughness={0.92} /></mesh>
      <mesh position={[0, 2.5, -10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[0, 2.5, 10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[-15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[0, 4.85, 0]}><boxGeometry args={[28.5, 0.12, 18.5]} /><meshStandardMaterial color="#1d222c" roughness={1} /></mesh>

      <Furniture />
      <GraffitiWall />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow><circleGeometry args={[4.7, 64]} /><meshStandardMaterial color="#303845" roughness={0.98} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}><ringGeometry args={[4.7, 4.82, 64]} /><meshBasicMaterial color="#7a8190" transparent opacity={0.28} /></mesh>
      <Text position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#676d7b">OPEN SOCIAL FLOOR</Text>
      <LocalPlayer state={player} onMove={onMove} onNearby={onNearby} interaction={interaction} joystickRef={joystickRef} motionResetKey={motionResetKey} />
    </>
  );
}

export default function Game() {
  const [player, setPlayer] = useState(() => ({ id: "local", name: "You", avatar: AVATARS[0], x: 0, z: 1.5, rot: Math.PI, moving: false, speed: 0 }));
  const [name, setName] = useState("You");
  const [avatarId, setAvatarId] = useState("maya");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nearby, setNearby] = useState([]);
  const [interaction, setInteraction] = useState(null);
  const [joystick, setJoystick] = useState({ x: 0, y: 0, active: false });
  const joystickRef = useRef({ x: 0, y: 0, active: false });
  const restoreMotion = useRef({ x: 0, z: 1.5, rot: Math.PI });
  const motionResetKey = useRef(0);

  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId) || AVATARS[0], [avatarId]);

  const beginInteraction = (anchor) => {
    if (!anchor) return;
    if (interaction && interaction.anchor.type !== "SIT") return;
    const seatedEat = Boolean(anchor.requiresSitting && interaction?.anchor?.type === "SIT");
    const nextAnchor = seatedEat
      ? { ...anchor, targetX: player.x, targetZ: player.z, targetRot: player.rot, exitX: player.x, exitZ: player.z }
      : anchor;
    if (!interaction) restoreMotion.current = { x: player.x, z: player.z, rot: player.rot };
    setInteraction({ status: "reserved", phase: "reserve", anchor: nextAnchor, startedAt: Date.now() });
  };

  const endInteraction = () => {
    const current = interaction;
    if (!current) return;
    const anchor = current.anchor;
    const exit = anchor.exitX != null && anchor.exitZ != null
      ? { x: anchor.exitX, z: anchor.exitZ }
      : restoreMotion.current;
    setInteraction({ ...current, status: "released", phase: "release" });
    const exitRot = Math.atan2(player.z - exit.z, player.x - exit.x);
    setPlayer((state) => ({ ...state, x: exit.x, z: exit.z, rot: exitRot, moving: false, speed: 0 }));
    joystickRef.current = { x: 0, y: 0, active: false };
    setJoystick(joystickRef.current);
    motionResetKey.current += 1;
    const key = motionResetKey.current;
    window.setTimeout(() => {
      setInteraction((state) => state?.startedAt === current.startedAt ? null : state);
    }, 0);
    void key;
  };

  useEffect(() => {
    if (!interaction || interaction.phase === "release") return undefined;
    const phases = [["stop", 80], ["align", 160], ["animate", 320], ["sync", 700]];
    let timer;
    let index = 0;
    const advance = () => {
      if (index >= phases.length) return;
      const [phase, delay] = phases[index++];
      setInteraction((state) => state ? { ...state, phase, status: phase === "sync" ? "active" : "reserved" } : state);
      timer = window.setTimeout(advance, delay);
    };
    timer = window.setTimeout(advance, 40);
    return () => window.clearTimeout(timer);
  }, [interaction?.startedAt]);

  useEffect(() => {
    setPlayer((prev) => ({ ...prev, name: name.trim().slice(0, 18) || "You", avatar }));
  }, [name, avatar]);

  return (
    <main className="game-shell">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.6, 7.8], fov: 60, near: 0.2, far: 55 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Room player={player} onMove={setPlayer} onNearby={setNearby} interaction={interaction} joystickRef={joystickRef} motionResetKey={motionResetKey.current} />
      </Canvas>

      <div className="hud"><div className="hud-title">GC HANGOUT</div><div className="hud-subtitle">Shared home</div><div className="hud-controls"><span>WASD / arrows</span><span>Drag / touch to look</span><span>Shift: run</span></div></div>
      {!interaction && nearby.filter((anchor) => !anchor.requiresSitting).length > 0 && (
        <div className="interaction-actions" onPointerDown={(event) => event.stopPropagation()}>
          {nearby.filter((anchor) => !anchor.requiresSitting).slice(0, 2).map((anchor) => (
            <button key={anchor.id} className="interaction-hint" onClick={() => beginInteraction(anchor)}>
              <strong>{anchor.label}</strong><span>{anchor.type === "SIT" ? "Sit here" : "Tap to interact"}</span>
            </button>
          ))}
        </div>
      )}
      {interaction?.anchor?.type === "SIT" && nearby.some((anchor) => anchor.id === "dining-eat") && (
        <button className="interaction-hint secondary-action" onPointerDown={(event) => event.stopPropagation()} onClick={() => beginInteraction(nearby.find((anchor) => anchor.id === "dining-eat"))}><strong>Eat</strong><span>Eat while sitting</span></button>
      )}
      {interaction && <button className="interaction-hint active" onPointerDown={(event) => event.stopPropagation()} onClick={endInteraction}><strong>{interaction.anchor.label}</strong><span>{interaction.anchor.type === "EAT" ? "Tap to stand / exit" : "Tap to stand / exit"}</span></button>}

      <div
        className="touch-controls"
        aria-label="Touch movement controls"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
          event.currentTarget.setPointerCapture?.(event.pointerId);
          const rect = event.currentTarget.getBoundingClientRect();
          const max = 38;
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          const length = Math.max(1, Math.hypot(dx, dy));
          const scale = Math.min(1, max / length);
          const next = { x: dx / max * scale, y: -dy / max * scale, active: true };
          joystickRef.current = next;
          setJoystick(next);
        }}
        onPointerMove={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!joystickRef.current.active) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const max = 38;
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          const length = Math.max(1, Math.hypot(dx, dy));
          const scale = Math.min(1, max / length);
          const next = { x: dx / max * scale, y: -dy / max * scale, active: true };
          joystickRef.current = next;
          setJoystick(next);
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
          joystickRef.current = { x: 0, y: 0, active: false };
          setJoystick(joystickRef.current);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onPointerCancel={(event) => {
          joystickRef.current = { x: 0, y: 0, active: false };
          setJoystick(joystickRef.current);
          event.currentTarget.releasePointerCapture?.(event.pointerId);
        }}
        onLostPointerCapture={() => {
          joystickRef.current = { x: 0, y: 0, active: false };
          setJoystick(joystickRef.current);
        }}
      >
        <div className="joystick"><span style={{ transform: `translate(${joystick.x * 30}px, ${-joystick.y * 30}px)` }} /></div>
      </div>

      <button className="settings" onClick={() => setSettingsOpen((value) => !value)} aria-label="Open settings">⚙️</button>
      {settingsOpen && (
        <div className="settings-panel">
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} /></label>
          <div className="avatar-picker">
            {AVATARS.map((item) => <button key={item.id} className={item.id === avatarId ? "selected" : ""} onClick={() => setAvatarId(item.id)}>{item.label}</button>)}
          </div>
          <button onClick={() => setSettingsOpen(false)}>Done</button>
        </div>
      )}
    </main>
  );
}
