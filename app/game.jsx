"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Text, RoundedBox } from "@react-three/drei";
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
  { id: "sofa-left-1", type: "SIT", label: "Sit", x: -12.0, z: -6.2, rot: Math.PI / 2, radius: 1.35 },
  { id: "sofa-left-2", type: "SIT", label: "Sit", x: -7.6, z: -6.2, rot: -Math.PI / 2, radius: 1.35 },
  { id: "sofa-lounge-1", type: "SIT", label: "Sit", x: -12.0, z: -3.5, rot: Math.PI / 2, radius: 1.35 },
  { id: "sofa-lounge-2", type: "SIT", label: "Sit", x: -7.6, z: -3.5, rot: -Math.PI / 2, radius: 1.35 },
  { id: "dining-1", type: "SIT", label: "Sit", x: 8.2, z: 5.8, rot: 0, radius: 1.15 },
  { id: "dining-2", type: "SIT", label: "Sit", x: 11.2, z: 5.8, rot: 0, radius: 1.15 },
  { id: "dining-3", type: "SIT", label: "Sit", x: 8.2, z: 5.8, rot: Math.PI, radius: 1.15 },
  { id: "dining-4", type: "SIT", label: "Sit", x: 11.2, z: 5.8, rot: Math.PI, radius: 1.15 },
  { id: "bed", type: "SLEEP", label: "Rest", x: 8.7, z: -6.0, rot: 0, radius: 1.65 },
  { id: "tv", type: "WATCH_TV", label: "Watch TV", x: 0, z: -6.9, rot: Math.PI, radius: 2.2 },
  { id: "food-table", type: "EAT", label: "Eat", x: 8.0, z: 5.8, rot: Math.PI, radius: 2.6 },
  { id: "drink-table", type: "DRINK", label: "Drink", x: 11.0, z: 5.8, rot: Math.PI, radius: 2.0 },
  { id: "room-interact", type: "INTERACT", label: "Interact", x: 0, z: 0, rot: 0, radius: 1.35 },
]);

function findNearestAnchor(x, z) {
  let nearest = null;
  let distance = Infinity;
  for (const anchor of INTERACTION_ANCHORS) {
    const next = Math.hypot(x - anchor.x, z - anchor.z);
    if (next < anchor.radius && next < distance) {
      nearest = anchor;
      distance = next;
    }
  }
  return nearest;
}

const OBSTACLES = [
  { x: -9.8, z: -6.2, rx: 2.8, rz: 1.0 },
  { x: -9.8, z: -3.5, rx: 2.8, rz: 1.0 },
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

function HumanAvatar({ avatar, moving, local, pose = "idle" }) {
  const group = useRef();
  const arms = useRef([]);
  const legs = useRef([]);
  const { skin, shirt, pants, hair } = avatar;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const stride = moving ? Math.sin(t * 11) * 0.48 : Math.sin(t * 2.2) * 0.025;
    if (pose === "sleep") group.current.rotation.x = -Math.PI / 2;
    else group.current.rotation.x = 0;
    group.current.position.y = moving ? Math.abs(Math.sin(t * 11)) * 0.018 : 0;
    group.current.rotation.z = moving ? Math.sin(t * 11) * 0.012 : 0;
    if (arms.current[0]) arms.current[0].rotation.x = moving ? stride : 0.02 * Math.sin(t * 2.2);
    if (arms.current[1]) arms.current[1].rotation.x = moving ? -stride : -0.02 * Math.sin(t * 2.2);
    if (legs.current[0]) legs.current[0].rotation.x = moving ? -stride : 0;
    if (legs.current[1]) legs.current[1].rotation.x = moving ? stride : 0;
  });

  return (
    <group ref={group}>
      <mesh position={[0, 1.62, 0]} castShadow>
        <sphereGeometry args={[0.31, 20, 16]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh position={[0, 1.82, 0]} castShadow scale={[1.05, 0.62, 1.05]}>
        <sphereGeometry args={[0.31, 20, 16]} />
        <meshStandardMaterial color={hair} roughness={0.9} />
      </mesh>
      <RoundedBox position={[0, 1.02, 0]} args={[0.66, 0.78, 0.38]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color={shirt} roughness={0.82} />
      </RoundedBox>
      <mesh position={[0, 1.38, 0.02]} castShadow>
        <sphereGeometry args={[0.16, 16, 12]} />
        <meshStandardMaterial color={skin} roughness={0.72} />
      </mesh>
      <mesh ref={(node) => { arms.current[0] = node; }} position={[-0.45, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.08, 0.48, 6, 10]} />
        <meshStandardMaterial color={skin} roughness={0.76} />
      </mesh>
      <mesh ref={(node) => { arms.current[1] = node; }} position={[0.45, 1.08, 0]} castShadow>
        <capsuleGeometry args={[0.08, 0.48, 6, 10]} />
        <meshStandardMaterial color={skin} roughness={0.76} />
      </mesh>
      <mesh ref={(node) => { legs.current[0] = node; }} position={[-0.18, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.095, 0.52, 6, 10]} />
        <meshStandardMaterial color={pants} roughness={0.84} />
      </mesh>
      <mesh ref={(node) => { legs.current[1] = node; }} position={[0.18, 0.45, 0]} castShadow>
        <capsuleGeometry args={[0.095, 0.52, 6, 10]} />
        <meshStandardMaterial color={pants} roughness={0.84} />
      </mesh>
      <Text position={[0, 2.2, 0]} fontSize={0.18} color={local ? "#d8ceff" : "#ffffff"} anchorX="center">
        {local ? "YOU" : avatar.label}
      </Text>
    </group>
  );
}

function LocalPlayer({ state, onMove, onNearby, onInteract, interaction, joystickVector }) {
  const keys = useRef(new Set());
  const yaw = useRef(0.2);
  const pitch = useRef(0.38);
  const cameraDistance = useRef(5.8);
  const drag = useRef(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraPosition = useRef(new THREE.Vector3(0, 3, 7));
  const { camera, gl } = useThree();

  useEffect(() => {
    const down = (event) => keys.current.add(event.key.toLowerCase());
    const up = (event) => keys.current.delete(event.key.toLowerCase());
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
    };
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
    const end = () => { drag.current = null; };
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

  useFrame((_, dt) => {
    const safeDt = Math.min(dt, 0.05);
    const forward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
    const strafe = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const magnitude = Math.hypot(strafe, forward);
    let next = state;

    if (!interaction) {
      if (magnitude) {
        const speed = keys.current.has("shift") ? 4.0 : 2.6;
        const f = forward / magnitude;
        const s = strafe / magnitude;
        const dirX = Math.sin(yaw.current) * f + Math.cos(yaw.current) * s;
        const dirZ = Math.cos(yaw.current) * f - Math.sin(yaw.current) * s;
        const distance = speed * safeDt;
        const moved = tryMove(state.x, state.z, dirX * distance, dirZ * distance);
        next = { ...state, ...moved, rot: Math.atan2(dirX, dirZ), moving: true, speed };
      } else if (state.moving || state.speed !== 0) {
        next = { ...state, moving: false, speed: 0 };
      }
      if (next !== state) onMove(next);
    }

    const nearby = findNearestAnchor(next.x, next.z);
    onNearby(nearby);

    const targetY = 1.15 + Math.sin(pitch.current) * cameraDistance.current;
    const horizontal = Math.cos(pitch.current) * cameraDistance.current;
    const desired = cameraTarget.current.set(
      next.x - Math.sin(yaw.current) * horizontal,
      targetY,
      next.z - Math.cos(yaw.current) * horizontal
    );
    cameraPosition.current.lerp(desired, 1 - Math.exp(-8 * safeDt));
    camera.position.copy(cameraPosition.current);
    camera.lookAt(next.x, 1.05, next.z);

    if (interaction && interaction.status === "active") {
      const dx = interaction.anchor.x - state.x;
      const dz = interaction.anchor.z - state.z;
      if (Math.hypot(dx, dz) > 0.02) {
        onMove({ ...state, x: interaction.anchor.x, z: interaction.anchor.z, rot: interaction.anchor.rot, moving: false, speed: 0 });
      }
    }
  });

  return (
    <group position={[state.x, 0, state.z]} rotation={[0, state.rot, 0]}>
      <HumanAvatar avatar={state.avatar} moving={state.moving} local pose={interaction?.anchor?.type === "SLEEP" ? "sleep" : "idle"} />
      {interaction?.status === "active" && <Text position={[0, 2.45, 0]} fontSize={0.16} color="#d8ceff" anchorX="center">{interaction.anchor.label.toUpperCase()}</Text>}
    </group>
  );
}
