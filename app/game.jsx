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

function HumanAvatar({ avatar, name, moving, local, pose = "idle" }) {
  const group = useRef();
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

    group.current.position.y = pose === "sleep" ? 0.42 : seated ? -0.18 : 0;
    group.current.rotation.x = pose === "sleep" ? -Math.PI / 2 : 0;
    group.current.rotation.z = moving && !seated ? Math.sin(t * 11) * 0.012 : 0;

    if (arms.current[0]) {
      arms.current[0].rotation.x = seated ? -0.2 : gesture ? -0.9 - Math.sin(t * 7) * 0.12 : moving ? stride : 0.02 * Math.sin(t * 2.2);
      arms.current[0].rotation.z = gesture ? -0.18 : 0;
    }
    if (arms.current[1]) {
      arms.current[1].rotation.x = seated ? -0.2 : pose === "drink" ? -1.05 : pose === "eat" ? -0.65 : moving ? -stride : -0.02 * Math.sin(t * 2.2);
      arms.current[1].rotation.z = gesture ? 0.18 : 0;
    }
    if (legs.current[0]) legs.current[0].rotation.x = seated ? -1.05 : moving ? -stride : 0;
    if (legs.current[1]) legs.current[1].rotation.x = seated ? -1.05 : moving ? stride : 0;
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
      <mesh position={[-0.11, 1.63, 0.285]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#f6f3ef" roughness={0.45} />
      </mesh>
      <mesh position={[0.11, 1.63, 0.285]} castShadow>
        <sphereGeometry args={[0.045, 10, 8]} />
        <meshStandardMaterial color="#f6f3ef" roughness={0.45} />
      </mesh>
      <mesh position={[-0.11, 1.63, 0.322]}>
        <sphereGeometry args={[0.019, 8, 6]} />
        <meshStandardMaterial color="#161922" />
      </mesh>
      <mesh position={[0.11, 1.63, 0.322]}>
        <sphereGeometry args={[0.019, 8, 6]} />
        <meshStandardMaterial color="#161922" />
      </mesh>
      <mesh position={[0, 1.54, 0.315]}>
        <sphereGeometry args={[0.035, 8, 6]} />
        <meshStandardMaterial color={skin} />
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
      <mesh position={[-0.18, 0.12, 0.1]} castShadow>
        <capsuleGeometry args={[0.11, 0.22, 6, 10]} />
        <meshStandardMaterial color="#171b24" roughness={0.72} />
      </mesh>
      <mesh position={[0.18, 0.12, 0.1]} castShadow>
        <capsuleGeometry args={[0.11, 0.22, 6, 10]} />
        <meshStandardMaterial color="#171b24" roughness={0.72} />
      </mesh>
      <Text position={[0, 2.18, 0]} fontSize={0.18} color={local ? "#d8ceff" : "#ffffff"} anchorX="center">
        {displayName}
      </Text>
    </group>
  );
}

function LocalPlayer({ state, onMove, onNearby, interaction, joystickVector }) {
  const keys = useRef(new Set());
  const yaw = useRef(0.2);
  const pitch = useRef(0.38);
  const cameraDistance = useRef(7.0);
  const drag = useRef(null);
  const cameraTarget = useRef(new THREE.Vector3());
  const cameraPosition = useRef(new THREE.Vector3(0, 3.6, 7.8));
  const nearbyRef = useRef(null);
  const { camera, gl, size } = useThree();
  const mobile = size.width <= 700;

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
    const end = (event) => { drag.current = null; if (event?.pointerId != null) element.releasePointerCapture?.(event.pointerId); };
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

  useFrame((_, dt) => {
    const safeDt = Math.min(dt, 0.05);
    const keyboardForward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
    const keyboardStrafe = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const forward = joystickVector?.y || keyboardForward;
    const strafe = joystickVector?.x || keyboardStrafe;
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
    const nearbyId = nearby?.id || null;
    if (nearbyRef.current !== nearbyId) {
      nearbyRef.current = nearbyId;
      onNearby(nearby);
    }

    const targetY = (mobile ? 0.95 : 1.05) + Math.sin(pitch.current) * cameraDistance.current;
    const horizontal = Math.cos(pitch.current) * cameraDistance.current;
    const desired = cameraTarget.current.set(
      next.x - Math.sin(yaw.current) * horizontal,
      targetY,
      next.z - Math.cos(yaw.current) * horizontal
    );
    cameraPosition.current.lerp(desired, 1 - Math.exp(-8 * safeDt));
    cameraPosition.current.x = clamp(cameraPosition.current.x, -WORLD.halfX + 1.0, WORLD.halfX - 1.0);
    cameraPosition.current.z = clamp(cameraPosition.current.z, -WORLD.halfZ + 1.0, WORLD.halfZ - 1.0);
    camera.position.copy(cameraPosition.current);
    camera.lookAt(next.x, mobile ? 0.9 : 1.0, next.z);

    if (interaction && (interaction.phase === "align" || interaction.phase === "animate" || interaction.phase === "sync")) {
      if (Math.hypot(interaction.anchor.x - state.x, interaction.anchor.z - state.z) > 0.02) {
        onMove({ ...state, x: interaction.anchor.x, z: interaction.anchor.z, rot: interaction.anchor.rot, moving: false, speed: 0 });
      }
    }
  });

  const pose = interaction?.anchor?.type === "SLEEP" ? "sleep"
    : interaction?.anchor?.type === "SIT" ? "sit"
    : interaction?.anchor?.type === "EAT" ? "eat"
    : interaction?.anchor?.type === "DRINK" ? "drink"
    : interaction?.anchor?.type === "WATCH_TV" ? "watch"
    : "idle";

  return (
    <group position={[state.x, 0, state.z]} rotation={[0, state.rot, 0]}>
      <HumanAvatar avatar={state.avatar} name={state.name} moving={state.moving} local pose={pose} />
      {interaction?.status === "active" && <Text position={[0, 2.45, 0]} fontSize={0.16} color="#d8ceff" anchorX="center">{interaction.anchor.label.toUpperCase()}</Text>}
    </group>
  );
}

function Sofa({ position = [0, 0, 0] }) {
  return (
    <group position={position}>
      <RoundedBox args={[5.4, 0.55, 1.05]} position={[0, 0.52, 0]} radius={0.14} smoothness={5} castShadow>
        <meshStandardMaterial color="#3f4b61" roughness={0.85} />
      </RoundedBox>
      <RoundedBox args={[5.4, 1.0, 0.3]} position={[0, 1.0, -0.38]} radius={0.12} smoothness={5} castShadow>
        <meshStandardMaterial color="#48556c" roughness={0.85} />
      </RoundedBox>
      {[-2.35, 2.35].map((x) => (
        <RoundedBox key={x} args={[0.32, 0.85, 0.9]} position={[x, 0.9, 0]} radius={0.1} smoothness={4} castShadow>
          <meshStandardMaterial color="#48556c" />
        </RoundedBox>
      ))}
    </group>
  );
}

function Chair({ position = [0, 0, 0], rotation = 0 }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <RoundedBox args={[0.8, 0.36, 0.8]} position={[0, 0.48, 0]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color="#556071" />
      </RoundedBox>
      <RoundedBox args={[0.8, 0.9, 0.22]} position={[0, 0.95, -0.3]} radius={0.08} smoothness={4} castShadow>
        <meshStandardMaterial color="#606c7f" />
      </RoundedBox>
    </group>
  );
}

function CoffeeTable({ position }) {
  return (
    <RoundedBox args={[2.0, 0.16, 1.0]} position={[position[0], 0.55, position[2]]} radius={0.08} smoothness={4} castShadow>
      <meshStandardMaterial color="#7a5946" />
    </RoundedBox>
  );
}

function Bed({ position }) {
  return (
    <group position={position}>
      <RoundedBox args={[3.0, 0.38, 4.2]} position={[0, 0.45, 0]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color="#303746" />
      </RoundedBox>
      <RoundedBox args={[2.8, 0.24, 3.3]} position={[0, 0.72, 0.2]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color="#d9d3c8" />
      </RoundedBox>
      <RoundedBox args={[2.8, 0.42, 0.35]} position={[0, 0.92, -1.65]} radius={0.1} smoothness={4} castShadow>
        <meshStandardMaterial color="#ece7dd" />
      </RoundedBox>
    </group>
  );
}

function Plant({ position, scale = 1 }) {
  return (
    <group position={position} scale={scale}>
      <mesh position={[0, 0.22, 0]} castShadow><cylinderGeometry args={[0.28, 0.34, 0.44, 14]} /><meshStandardMaterial color="#5a4334" /></mesh>
      {[0, 1.8, 3.6, 5.4].map((a) => (
        <mesh key={a} position={[Math.cos(a) * 0.42, 1.15, Math.sin(a) * 0.42]} rotation={[0.25, a, 0.45]} castShadow>
          <sphereGeometry args={[0.55, 10, 7]} />
          <meshStandardMaterial color="#4b8549" roughness={0.95} />
        </mesh>
      ))}
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

function Furniture() {
  return (
    <group>
      <group position={[-9.8, 0, -6.2]}>
        <Sofa />
        <Sofa position={[0, 0, 2.7]} />
        <CoffeeTable position={[0, 0, 1.35]} />
      </group>
      <group position={[0, 0, -9.15]}>
        <RoundedBox args={[9.0, 3.35, 0.38]} position={[0, 2.2, 0]} radius={0.18} smoothness={5} castShadow>
          <meshStandardMaterial color="#10141c" roughness={0.32} metalness={0.15} />
        </RoundedBox>
        <mesh position={[0, 2.2, 0.22]}>
          <planeGeometry args={[8.45, 2.72]} />
          <meshStandardMaterial color="#17182a" emissive="#433a78" emissiveIntensity={0.55} roughness={0.55} />
        </mesh>
        <Text position={[-3.75, 2.85, 0.25]} fontSize={0.28} color="#e2dcff" anchorX="left">GC HANGOUT</Text>
        <Text position={[-3.75, 2.45, 0.25]} fontSize={0.18} color="#aaa2d8" anchorX="left">TV / MUSIC</Text>
        <RoundedBox args={[5.4, 0.22, 0.9]} position={[0, 0.58, 0]} radius={0.08} smoothness={4} castShadow>
          <meshStandardMaterial color="#2a303c" roughness={0.78} />
        </RoundedBox>
        <mesh position={[0, 0.9, 0.02]}>
          <cylinderGeometry args={[0.11, 0.11, 0.22, 16]} />
          <meshStandardMaterial color="#1a1e27" />
        </mesh>
      </group>
      <group position={[9.7, 0, 5.8]}>
        <RoundedBox args={[4.8, 0.25, 2.4]} position={[0, 0.95, 0]} radius={0.12} smoothness={5} castShadow>
          <meshStandardMaterial color="#72513f" />
        </RoundedBox>
        {[-1.5, 0, 1.5].map((x) => <Chair key={x} position={[x, 0, -1.85]} />)}
        {[-1.5, 0, 1.5].map((x) => <Chair key={x} position={[x, 0, 1.85]} rotation={Math.PI} />)}
      </group>
      <group position={[8.7, 0, -6.5]}><Bed position={[0, 0, 0]} /></group>
      <group position={[13.25, 0, 0.7]}>
        <RoundedBox args={[1.4, 1.1, 6.2]} position={[0, 0.6, 0]} radius={0.12} smoothness={4}>
          <meshStandardMaterial color="#343941" />
        </RoundedBox>
      </group>
      <Plant position={[-13.1, 0, 7.5]} />
      <Plant position={[13.0, 0, -7.7]} scale={1.15} />
      <Lamp position={[-5.7, 0, 6.8]} />
      <Lamp position={[5.8, 0, 6.8]} />
    </group>
  );
}

function Room({ player, onMove, onNearby, interaction, joystickVector }) {
  return (
    <>
      <ambientLight intensity={1.35} />
      <hemisphereLight args={["#f5ead9", "#1d2531", 1.0]} />
      <directionalLight position={[5, 10, 4]} intensity={0.95} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <color attach="background" args={["#0e1118"]} />
      <fog attach="fog" args={["#0e1118", 24, 46]} />

      <mesh receiveShadow position={[0, -0.12, 0]}>
        <boxGeometry args={[30, 0.24, 20]} />
        <meshStandardMaterial color="#343b46" roughness={0.92} />
      </mesh>

      <mesh position={[0, 2.5, -10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[0, 2.5, 10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[-15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#1d222b" /></mesh>

      <Furniture />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow>
        <circleGeometry args={[4.7, 64]} />
        <meshStandardMaterial color="#303845" roughness={0.98} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <ringGeometry args={[4.7, 4.82, 64]} />
        <meshBasicMaterial color="#7a8190" transparent opacity={0.28} />
      </mesh>
      <Text position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#676d7b">
        OPEN SOCIAL FLOOR
      </Text>

      <LocalPlayer state={player} onMove={onMove} onNearby={onNearby} interaction={interaction} joystickVector={joystickVector} />
    </>
  );
}

export default function Game() {
  const [player, setPlayer] = useState(() => ({
    id: "local",
    name: "You",
    avatar: AVATARS[0],
    x: 0,
    z: 1.5,
    rot: Math.PI,
    moving: false,
    speed: 0,
  }));
  const [name, setName] = useState("You");
  const [avatarId, setAvatarId] = useState("maya");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [nearby, setNearby] = useState(null);
  const [interaction, setInteraction] = useState(null);
  const [joystick, setJoystick] = useState({ x: 0, y: 0, active: false });
  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId) || AVATARS[0], [avatarId]);
  const beginInteraction = () => {
    if (!nearby || interaction) return;
    setInteraction({ status: "reserved", phase: "reserve", anchor: nearby, startedAt: Date.now() });
  };
  const endInteraction = () => setInteraction(null);
  useEffect(() => {
    if (!interaction) return undefined;
    const phases = [["stop", 80], ["align", 160], ["animate", 320], ["sync", 700]];
    let timer;
    let index = 0;
    const advance = () => {
      if (index >= phases.length) return;
      const [phase, delay] = phases[index++];
      setInteraction((current) => current ? { ...current, phase, status: phase === "sync" ? "active" : "reserved" } : current);
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
      <Canvas shadows="soft" dpr={[1, 1.5]} camera={{ position: [0, 3.6, 7.8], fov: 60, near: 0.2, far: 55 }} renderer={{ antialias: true, powerPreference: "high-performance" }}>
        <Room player={player} onMove={setPlayer} onNearby={setNearby} interaction={interaction} joystickVector={joystick} />
      </Canvas>
      <div className="hud">
        <div className="hud-title">GC HANGOUT</div>
        <div className="hud-subtitle">Shared home</div>
        <div className="hud-controls"><span>WASD / arrows</span><span>Drag / touch to look</span><span>Shift: run</span></div>
      {nearby && !interaction && (
        <button className="interaction-hint" onClick={beginInteraction}>
          <strong>{nearby.label}</strong><span>Tap to interact</span>
        </button>
      )}
      {interaction && (
        <button className="interaction-hint active" onClick={endInteraction}>
          <strong>{interaction.anchor.label}</strong><span>Tap to stand / exit</span>
        </button>
      )}

      </div>
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
          setJoystick({ x: dx / max * scale, y: -dy / max * scale, active: true });
        }}
        onPointerMove={(event) => {
          event.preventDefault();
          event.stopPropagation();
          if (!joystick.active) return;
          const rect = event.currentTarget.getBoundingClientRect();
          const max = 38;
          const dx = event.clientX - (rect.left + rect.width / 2);
          const dy = event.clientY - (rect.top + rect.height / 2);
          const length = Math.max(1, Math.hypot(dx, dy));
          const scale = Math.min(1, max / length);
          setJoystick({ x: dx / max * scale, y: -dy / max * scale, active: true });
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          setJoystick({ x: 0, y: 0, active: false });
        }}
        onPointerCancel={() => setJoystick({ x: 0, y: 0, active: false })}
        onLostPointerCapture={() => setJoystick({ x: 0, y: 0, active: false })}
      >
        <div className="joystick"><span style={{ transform: `translate(${joystick.x * 30}px, ${-joystick.y * 30}px)` }} /></div>
      </div>
      <button className="settings" onClick={() => setSettingsOpen((value) => !value)} aria-label="Open settings">⚙️</button>
      {settingsOpen && (
        <div className="settings-panel">
          <label>Your name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={18} /></label>
          <div className="avatar-picker">
            {AVATARS.map((item) => (
              <button key={item.id} className={item.id === avatarId ? "selected" : ""} onClick={() => setAvatarId(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          <button onClick={() => setSettingsOpen(false)}>Done</button>
        </div>
      )}
    </main>
  );
}
