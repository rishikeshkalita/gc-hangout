"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { Billboard, Text, RoundedBox } from "@react-three/drei";
import * as THREE from "three";
import { GC_HANGOUT_PHOTO_DATA_URL } from "../lib/gc-hangout-photo.mjs";
import { INTERACTION_PHASE_MS, canReserveInteraction } from "../lib/game-state.mjs";
import SocialHud from "./social-hud";

const WORLD = { halfX: 15, halfZ: 10, playerRadius: 0.34 };
const AVATARS = [
  { id: "maya", label: "Maya", skin: "#b86f4b", shirt: "#6c63d9", pants: "#26354d", hair: "#241b18" },
  { id: "noah", label: "Noah", skin: "#8d5524", shirt: "#2e8b78", pants: "#24313c", hair: "#171513" },
  { id: "riya", label: "Riya", skin: "#d99a6c", shirt: "#d45d7d", pants: "#3d3150", hair: "#3a211c" },
  { id: "aarav", label: "Aarav", skin: "#c68642", shirt: "#d08a3e", pants: "#29394b", hair: "#201915" },
];

const clamp = (n, min, max) => Math.max(min, Math.min(max, n));


function useEmbeddedPhotoTexture(dataUrl) {
  const [texture, setTexture] = useState(null);

  useEffect(() => {
    let disposed = false;
    let objectUrl = null;
    let image = null;
    let nextTexture = null;

    try {
      const comma = dataUrl.indexOf(",");
      if (comma < 0) throw new Error("Invalid embedded photo data");

      const binary = atob(dataUrl.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) {
        bytes[index] = binary.charCodeAt(index);
      }

      objectUrl = URL.createObjectURL(new Blob([bytes], { type: "image/jpeg" }));
      image = new Image();
      image.decoding = "async";

      image.onload = () => {
        if (disposed) return;
        nextTexture = new THREE.Texture(image);
        nextTexture.colorSpace = THREE.SRGBColorSpace;
        nextTexture.needsUpdate = true;
        setTexture(nextTexture);
      };

      image.onerror = () => {
        if (!disposed) console.error("GC photo failed to decode");
      };

      image.src = objectUrl;
    } catch (error) {
      if (!disposed) console.error("GC photo failed to prepare", error);
    }

    return () => {
      disposed = true;
      if (image) image.src = "";
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      if (nextTexture) nextTexture.dispose();
    };
  }, [dataUrl]);

  return texture;
}


const INTERACTION_ANCHORS = Object.freeze([
  { id: "sofa-a-1", type: "SIT", seatStyle: "sofa", label: "Sit", x: -11.4, z: -7.25, rot: 0, targetX: -11.4, targetZ: -7.25, targetRot: 0, triggerX: -11.4, triggerZ: -5.75, exitX: -6.0, exitZ: -5.75, radius: 1.55 },
  { id: "sofa-a-2", type: "SIT", seatStyle: "sofa", label: "Sit", x: -9.8, z: -7.25, rot: 0, targetX: -9.8, targetZ: -7.25, targetRot: 0, triggerX: -9.8, triggerZ: -5.75, exitX: -6.0, exitZ: -5.75, radius: 1.55 },
  { id: "sofa-a-3", type: "SIT", seatStyle: "sofa", label: "Sit", x: -8.2, z: -7.25, rot: 0, targetX: -8.2, targetZ: -7.25, targetRot: 0, triggerX: -8.2, triggerZ: -5.75, exitX: -6.0, exitZ: -5.75, radius: 1.55 },
  { id: "sofa-b-1", type: "SIT", seatStyle: "sofa", label: "Sit", x: -11.4, z: 0.55, rot: Math.PI, targetX: -11.4, targetZ: 0.55, targetRot: Math.PI, triggerX: -11.4, triggerZ: -1.0, exitX: -6.0, exitZ: -1.0, radius: 1.55 },
  { id: "sofa-b-2", type: "SIT", seatStyle: "sofa", label: "Sit", x: -9.8, z: 0.55, rot: Math.PI, targetX: -9.8, targetZ: 0.55, targetRot: Math.PI, triggerX: -9.8, triggerZ: -1.0, exitX: -6.0, exitZ: -1.0, radius: 1.55 },
  { id: "sofa-b-3", type: "SIT", seatStyle: "sofa", label: "Sit", x: -8.2, z: 0.55, rot: Math.PI, targetX: -8.2, targetZ: 0.55, targetRot: Math.PI, triggerX: -8.2, triggerZ: -1.0, exitX: -6.0, exitZ: -1.0, radius: 1.55 },
  { id: "dining-1", type: "SIT", seatStyle: "chair", label: "Sit", x: 8.2, z: 3.95, rot: 0, targetX: 8.2, targetZ: 3.95, targetRot: 0, triggerX: 8.2, triggerZ: 2.95, exitX: 8.2, exitZ: 2.45, radius: 1.65 },
  { id: "dining-2", type: "SIT", seatStyle: "chair", label: "Sit", x: 9.7, z: 3.95, rot: 0, targetX: 9.7, targetZ: 3.95, targetRot: 0, triggerX: 9.7, triggerZ: 2.95, exitX: 9.7, exitZ: 2.45, radius: 1.65 },
  { id: "dining-3", type: "SIT", seatStyle: "chair", label: "Sit", x: 11.2, z: 3.95, rot: 0, targetX: 11.2, targetZ: 3.95, targetRot: 0, triggerX: 11.2, triggerZ: 2.95, exitX: 11.2, exitZ: 2.45, radius: 1.65 },
  { id: "dining-4", type: "SIT", seatStyle: "chair", label: "Sit", x: 8.2, z: 7.65, rot: Math.PI, targetX: 8.2, targetZ: 7.65, targetRot: Math.PI, triggerX: 8.2, triggerZ: 8.65, exitX: 8.2, exitZ: 9.15, radius: 1.65 },
  { id: "dining-5", type: "SIT", seatStyle: "chair", label: "Sit", x: 9.7, z: 7.65, rot: Math.PI, targetX: 9.7, targetZ: 7.65, targetRot: Math.PI, triggerX: 9.7, triggerZ: 8.65, exitX: 9.7, exitZ: 9.15, radius: 1.65 },
  { id: "dining-6", type: "SIT", seatStyle: "chair", label: "Sit", x: 11.2, z: 7.65, rot: Math.PI, targetX: 11.2, targetZ: 7.65, targetRot: Math.PI, triggerX: 11.2, triggerZ: 8.65, exitX: 11.2, exitZ: 9.15, radius: 1.65 },
  { id: "bed", type: "SLEEP", label: "Sleep", x: 8.7, z: -4.25, rot: 0, targetX: 8.7, targetZ: -6.0, targetRot: 0, triggerX: 8.7, triggerZ: -4.25, exitX: 5.8, exitZ: -4.15, radius: 1.5 },
  { id: "tv", type: "WATCH_TV", label: "Watch TV", x: 0, z: -6.9, rot: Math.PI, targetX: 0, targetZ: -6.9, targetRot: Math.PI, triggerX: 0, triggerZ: -6.9, exitX: 0, exitZ: -5.55, radius: 2.0 },
  { id: "dining-eat", type: "EAT", label: "Eat", requiresSitting: true, foodKind: "pizza", x: 10.7, z: 5.8, rot: 0, targetX: 10.7, targetZ: 5.8, targetRot: 0, triggerX: 10.7, triggerZ: 5.8, exitX: 9.7, exitZ: 5.8, radius: 3.4 },
  // Stocked bar: standing interactions are available from all four sides.
  { id: "bar-drink-south", type: "DRINK", label: "Drink", drinkKind: "soda", x: 4.0, z: -0.45, rot: 0, targetX: 4.0, targetZ: -0.45, targetRot: 0, triggerX: 4.0, triggerZ: -0.45, exitX: 4.0, exitZ: -1.35, radius: 1.2 },
  { id: "bar-drink-north", type: "DRINK", label: "Drink", drinkKind: "juice", x: 4.0, z: 3.15, rot: Math.PI, targetX: 4.0, targetZ: 3.15, targetRot: Math.PI, triggerX: 4.0, triggerZ: 3.15, exitX: 4.0, exitZ: 4.05, radius: 1.2 },
  { id: "bar-drink-west", type: "DRINK", label: "Drink", drinkKind: "coffee", x: 2.25, z: 1.35, rot: Math.PI / 2, targetX: 2.25, targetZ: 1.35, targetRot: Math.PI / 2, triggerX: 2.25, triggerZ: 1.35, exitX: 1.35, exitZ: 1.35, radius: 1.2 },
  { id: "bar-drink-east", type: "DRINK", label: "Drink", drinkKind: "water", x: 5.75, z: 1.35, rot: -Math.PI / 2, targetX: 5.75, targetZ: 1.35, targetRot: -Math.PI / 2, triggerX: 5.75, triggerZ: 1.35, exitX: 6.65, exitZ: 1.35, radius: 1.2 },
  { id: "bar-snack-south", type: "EAT", label: "Eat", foodKind: "chips", x: 4.0, z: -0.45, rot: 0, targetX: 4.0, targetZ: -0.45, targetRot: 0, triggerX: 4.0, triggerZ: -0.45, exitX: 4.0, exitZ: -1.35, radius: 1.2 },
  { id: "bar-snack-north", type: "EAT", label: "Eat", foodKind: "burger", x: 4.0, z: 3.15, rot: Math.PI, targetX: 4.0, targetZ: 3.15, targetRot: Math.PI, triggerX: 4.0, triggerZ: 3.15, exitX: 4.0, exitZ: 4.05, radius: 1.2 },
  { id: "bar-snack-west", type: "EAT", label: "Eat", foodKind: "fruit", x: 2.25, z: 1.35, rot: Math.PI / 2, targetX: 2.25, targetZ: 1.35, targetRot: Math.PI / 2, triggerX: 2.25, triggerZ: 1.35, exitX: 1.35, exitZ: 1.35, radius: 1.2 },
  { id: "bar-snack-east", type: "EAT", label: "Eat", foodKind: "sandwich", x: 5.75, z: 1.35, rot: -Math.PI / 2, targetX: 5.75, targetZ: 1.35, targetRot: -Math.PI / 2, triggerX: 5.75, triggerZ: 1.35, exitX: 6.65, exitZ: 1.35, radius: 1.2 },
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
  { x: -9.8, z: -7.25, rx: 2.8, rz: 0.7 },
  { x: -9.8, z: 0.55, rx: 2.8, rz: 0.7 },
  { x: -9.8, z: -3.35, rx: 0.9, rz: 0.6 },
  { x: 0, z: -8.55, rx: 5.2, rz: 0.65 },
  { x: 10.7, z: 5.8, rx: 2.4, rz: 1.35 },
  { x: 4.0, z: 1.35, rx: 1.15, rz: 1.0 },
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

function HumanAvatar({ avatar, name, moving, local, pose = "idle", seatStyle = null, foodKind = "pizza", drinkKind = "water", interactionPhase = "sync", pov = "tpp", emote = null }) {
  const group = useRef();
  const visual = useRef();
  const arms = useRef([]);
  const legs = useRef([]);
  const shoes = useRef([]);
  const heldProp = useRef();
  const { skin, shirt, pants, hair } = avatar;
  const displayName = (name || avatar.label || "You").trim().slice(0, 18).toUpperCase();

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const stride = moving ? Math.sin(t * 11) * 0.48 : Math.sin(t * 2.2) * 0.025;
    const seated = pose === "sit" || pose === "sit-sofa" || pose === "sit-chair" || ((pose === "eat" || pose === "drink") && Boolean(seatStyle));
    const sofaSeat = pose === "sit-sofa" || (seated && seatStyle === "sofa");
    const chairSeat = pose === "sit-chair" || (seated && seatStyle === "chair");
    const gesture = pose === "eat" || pose === "drink";
    const eating = pose === "eat";
    const drinking = pose === "drink";
    const gestureCycle = (Math.sin(t * 4.2) + 1) * 0.5;
    const propToMouth = gestureCycle > 0.58;
    const emoteWave = emote === "wave";
    const emoteClap = emote === "clap";
    const emoteDance = emote === "dance";
    const propVisible = gesture && (interactionPhase === "animate" || interactionPhase === "sync");

    group.current.position.y = 0;
    group.current.rotation.x = 0;
    group.current.rotation.z = emoteDance ? Math.sin(t * 7) * 0.055 : moving && !seated ? Math.sin(t * 11) * 0.012 : 0;
    if (visual.current) {
      if (pose === "sleep") {
        visual.current.position.set(0, 1.02, 0.15);
        visual.current.rotation.set(-Math.PI / 2, 0, 0);
      } else if (sofaSeat) {
        visual.current.position.set(0, 0.04, -0.10);
        visual.current.rotation.set(0, 0, 0);
      } else if (chairSeat) {
        visual.current.position.set(0, -0.02, -0.02);
        visual.current.rotation.set(0, 0, 0);
      } else {
        visual.current.position.set(0, 0, 0);
        visual.current.rotation.set(0, 0, 0);
      }
    }

    if (arms.current[0]) {
      arms.current[0].rotation.x = emoteClap ? -0.72 + Math.sin(t * 10) * 0.18 : emoteDance ? -0.38 + Math.sin(t * 7) * 0.55 : seated && !gesture ? (sofaSeat ? -0.18 : -0.24) : gesture ? (eating ? -0.28 : -0.18) : moving ? stride : 0.02 * Math.sin(t * 2.2);
      arms.current[0].rotation.z = gesture ? -0.18 : 0;
    }
    if (arms.current[1]) {
      arms.current[1].rotation.x = emoteWave ? -1.15 + Math.sin(t * 9) * 0.38 : emoteClap ? -0.72 - Math.sin(t * 10) * 0.18 : emoteDance ? -0.38 - Math.sin(t * 7) * 0.55 : gesture ? (drinking ? (propToMouth ? -1.22 : -0.88) : (propToMouth ? -1.20 : -0.70)) : seated ? (sofaSeat ? -0.22 : -0.28) : moving ? -stride : -0.02 * Math.sin(t * 2.2);
      arms.current[1].rotation.z = gesture ? 0.18 : 0;
      if (eating) arms.current[1].rotation.y = propToMouth ? -0.10 : 0.08;
      if (heldProp.current) {
        heldProp.current.visible = propVisible;
        if (eating) {
          heldProp.current.position.set(propToMouth ? 0.29 : 0.36, propToMouth ? 1.43 : 1.10, propToMouth ? 0.36 : 0.30);
        } else if (drinking) {
          heldProp.current.position.set(propToMouth ? 0.30 : 0.37, propToMouth ? 1.44 : 1.10, propToMouth ? 0.36 : 0.28);
        }
      }
    }
    if (legs.current[0]) {
      legs.current[0].rotation.x = seated ? (sofaSeat ? -0.82 : -1.05) : moving ? -stride : 0;
      legs.current[0].scale.y = seated ? 0.78 : 1;
      legs.current[0].position.y = seated ? (sofaSeat ? 0.61 : 0.54) : 0.45;
      legs.current[0].position.z = seated ? (sofaSeat ? 0.46 : 0.22) : 0;
      if (shoes.current[0]) {
        shoes.current[0].scale.setScalar(seated ? 0.86 : 1);
        shoes.current[0].position.y = seated ? (sofaSeat ? 0.22 : 0.31) : 0.12;
        shoes.current[0].position.z = seated ? (sofaSeat ? 0.72 : 0.50) : 0.10;
      }
    }
    if (legs.current[1]) {
      legs.current[1].rotation.x = seated ? (sofaSeat ? -0.82 : -1.05) : moving ? stride : 0;
      legs.current[1].scale.y = seated ? 0.78 : 1;
      legs.current[1].position.y = seated ? (sofaSeat ? 0.61 : 0.54) : 0.45;
      legs.current[1].position.z = seated ? (sofaSeat ? 0.46 : 0.22) : 0;
      if (shoes.current[1]) {
        shoes.current[1].scale.setScalar(seated ? 0.86 : 1);
        shoes.current[1].position.y = seated ? (sofaSeat ? 0.22 : 0.31) : 0.12;
        shoes.current[1].position.z = seated ? (sofaSeat ? 0.72 : 0.50) : 0.10;
      }
    }
  });

  return (
    <group ref={group}>
      <group ref={visual} visible={pov !== "fpp"}>
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
      <mesh ref={(node) => { shoes.current[0] = node; }} position={[-0.18, 0.12, 0.1]} castShadow><capsuleGeometry args={[0.11, 0.22, 6, 10]} /><meshStandardMaterial color="#171b24" roughness={0.72} /></mesh>
      <mesh ref={(node) => { shoes.current[1] = node; }} position={[0.18, 0.12, 0.1]} castShadow><capsuleGeometry args={[0.11, 0.22, 6, 10]} /><meshStandardMaterial color="#171b24" roughness={0.72} /></mesh>
      {pose === "eat" && (
        <group ref={heldProp} position={[0.34, 1.04, 0.3]} rotation={[0.2, 0.2, -0.25]} visible={false}>
          {foodKind === "pizza" && <group><mesh castShadow rotation={[0.1, 0.2, 0.15]}><coneGeometry args={[0.13, 0.22, 3]} /><meshStandardMaterial color="#d98b35" roughness={0.72} /></mesh><mesh position={[0, 0.055, 0.02]}><sphereGeometry args={[0.06, 10, 6]} /><meshStandardMaterial color="#e9c95d" roughness={0.65} /></mesh></group>}
          {foodKind === "chips" && <group><mesh castShadow><boxGeometry args={[0.14, 0.18, 0.1]} /><meshStandardMaterial color="#d85d43" roughness={0.72} /></mesh><mesh position={[0, 0.11, 0]}><boxGeometry args={[0.11, 0.08, 0.08]} /><meshStandardMaterial color="#e6c35c" roughness={0.65} /></mesh></group>}
          {foodKind === "burger" && <group><mesh position={[0, 0.09, 0]} castShadow><cylinderGeometry args={[0.12, 0.12, 0.07, 12]} /><meshStandardMaterial color="#c98243" roughness={0.72} /></mesh><mesh position={[0, 0.02, 0]}><cylinderGeometry args={[0.105, 0.105, 0.07, 12]} /><meshStandardMaterial color="#5d3423" roughness={0.8} /></mesh><mesh position={[0, -0.05, 0]}><cylinderGeometry args={[0.11, 0.11, 0.06, 12]} /><meshStandardMaterial color="#e2bd59" roughness={0.7} /></mesh></group>}
          {foodKind === "fruit" && <mesh castShadow><sphereGeometry args={[0.1, 12, 8]} /><meshStandardMaterial color="#d95a4f" roughness={0.65} /></mesh>}
          {foodKind === "sandwich" && <group><mesh castShadow><boxGeometry args={[0.2, 0.09, 0.14]} /><meshStandardMaterial color="#e5c889" roughness={0.72} /></mesh><mesh position={[0, -0.015, 0]}><boxGeometry args={[0.17, 0.05, 0.11]} /><meshStandardMaterial color="#6c9b54" roughness={0.78} /></mesh></group>}
        </group>
      )}
      {pose === "drink" && (
        <group ref={heldProp} position={[0.36, 1.05, 0.28]} visible={false}>
          <mesh castShadow><cylinderGeometry args={[0.07, 0.07, 0.2, 12]} /><meshStandardMaterial color={drinkKind === "coffee" ? "#6f4a35" : drinkKind === "soda" ? "#c85a4b" : drinkKind === "juice" ? "#e0a23b" : "#8ed7ef"} transparent opacity={drinkKind === "water" ? 0.78 : 0.96} roughness={0.3} /></mesh>
          <mesh position={[0, 0.13, 0]}><cylinderGeometry args={[0.05, 0.05, 0.025, 12]} /><meshStandardMaterial color="#e9edf0" transparent opacity={0.8} /></mesh>
        </group>
      )}
      </group>
      <Billboard position={[0, 2.18, 0]} follow visible={pov !== "fpp"}><Text fontSize={0.18} color={local ? "#d8ceff" : "#ffffff"} anchorX="center" outlineWidth={0.012} outlineColor="#10131b">{displayName}</Text></Billboard>
    </group>
  );
}

function LocalPlayer({ state, onMove, onNearby, interaction, joystickRef, motionResetKey, pov, emote }) {
  const keys = useRef(new Set());
  const yaw = useRef(0.2);
  const pitch = useRef(0.38);
  const cameraDistance = useRef(8.2);
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
      cameraDistance.current = clamp(cameraDistance.current + event.deltaY * 0.006, mobile ? 7.0 : 5.2, mobile ? 10.0 : 8.8);
    };
    element.addEventListener("wheel", wheel, { passive: false });
    return () => element.removeEventListener("wheel", wheel);
  }, [gl, mobile]);

  useEffect(() => {
    cameraDistance.current = mobile ? clamp(cameraDistance.current, 7.0, 10.0) : clamp(cameraDistance.current, 5.2, 8.8);
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

    if (!interaction && !emote) {
      if (magnitude > 0.08) {
        const speed = keys.current.has("shift") ? 7.0 : mobile ? 6.2 : 5.0;
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

    let nearby = findNearbyAnchors(current.x, current.z);
    if (interaction?.anchor?.type !== "SIT") {
      nearby = nearby.filter((item) => item.id !== "dining-eat");
    }
    if (interaction?.anchor?.type === "SIT") {
      const seatedEat = INTERACTION_ANCHORS.find((item) => item.id === "dining-eat");
      if (seatedEat && Math.hypot(current.x - seatedEat.triggerX, current.z - seatedEat.triggerZ) < seatedEat.radius) {
        nearby = [...nearby.filter((item) => item.type !== "EAT"), seatedEat];
      }
    }
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

    if (pov === "fpp") {
      const headY = 1.58;
      const lookDistance = 4.0;
      const lookX = current.x + Math.sin(yaw.current) * lookDistance;
      const lookZ = current.z + Math.cos(yaw.current) * lookDistance;
      const desired = cameraTarget.current.set(current.x + Math.sin(yaw.current) * 0.08, headY, current.z + Math.cos(yaw.current) * 0.08);
      cameraPosition.current.lerp(desired, 1 - Math.exp(-12 * safeDt));
      camera.position.copy(cameraPosition.current);
      camera.lookAt(lookX, headY + Math.sin(pitch.current - 0.53) * 2.2 - 0.08, lookZ);
    } else {
      const targetY = (mobile ? 0.95 : 1.05) + Math.sin(pitch.current) * cameraDistance.current;
      const horizontal = Math.cos(pitch.current) * cameraDistance.current;
      const desired = cameraTarget.current.set(current.x - Math.sin(yaw.current) * horizontal, targetY, current.z - Math.cos(yaw.current) * horizontal);
      cameraPosition.current.lerp(desired, 1 - Math.exp(-8 * safeDt));
      cameraPosition.current.x = clamp(cameraPosition.current.x, -WORLD.halfX + 1.0, WORLD.halfX - 1.0);
      cameraPosition.current.z = clamp(cameraPosition.current.z, -WORLD.halfZ + 1.0, WORLD.halfZ - 1.0);
      camera.position.copy(cameraPosition.current);
      camera.lookAt(current.x, mobile ? 0.9 : 1.0, current.z);
    }
  });

  const pose = interaction?.anchor?.type === "SLEEP" ? "sleep" : interaction?.anchor?.type === "SIT" ? (interaction.anchor.seatStyle === "sofa" ? "sit-sofa" : "sit-chair") : interaction?.anchor?.type === "EAT" ? "eat" : interaction?.anchor?.type === "DRINK" ? "drink" : interaction?.anchor?.type === "WATCH_TV" ? "watch" : "idle";

  return (
    <group ref={playerGroup}>
      <HumanAvatar avatar={state.avatar} name={state.name} moving={state.moving} local pose={pose} seatStyle={interaction?.anchor?.seatStyle} foodKind={interaction?.anchor?.foodKind} drinkKind={interaction?.anchor?.drinkKind} interactionPhase={interaction?.phase} pov={pov} emote={emote} />
    </group>
  );
}

function Sofa({ position = [0, 0, 0] }) {
  const FLOOR_OFFSET = -0.245;
  return (
    <group position={[position[0], position[1] + FLOOR_OFFSET, position[2]]}>
      <RoundedBox args={[5.4, 0.55, 1.05]} position={[0, 0.52, 0]} radius={0.14} smoothness={5} castShadow><meshStandardMaterial color="#3f4b61" roughness={0.85} /></RoundedBox>
      <RoundedBox args={[5.4, 1.0, 0.3]} position={[0, 1.0, -0.38]} radius={0.12} smoothness={5} castShadow><meshStandardMaterial color="#48556c" roughness={0.85} /></RoundedBox>
      {[-2.35, 2.35].map((x) => <RoundedBox key={x} args={[0.32, 0.85, 0.9]} position={[x, 0.9, 0]} radius={0.1} smoothness={4} castShadow><meshStandardMaterial color="#48556c" /></RoundedBox>)}
    </group>
  );
}

function Chair({ position = [0, 0, 0], rotation = 0 }) {
  const FLOOR_OFFSET = -0.30;
  return (
    <group position={[position[0], position[1] + FLOOR_OFFSET, position[2]]} rotation={[0, rotation, 0]}>
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


function WallPhotoFrame() {
  const photo = useEmbeddedPhotoTexture(GC_HANGOUT_PHOTO_DATA_URL);

  return (
    <group position={[14.72, 3.0, 2.0]} rotation={[0, -Math.PI / 2, 0]}>
      <RoundedBox args={[3.45, 2.65, 0.14]} radius={0.07} smoothness={4} castShadow>
        <meshStandardMaterial color="#5b3c2b" roughness={0.58} />
      </RoundedBox>
      <mesh position={[0, 0, 0.085]}>
        <planeGeometry args={[3.02, 2.22]} />
        <meshBasicMaterial map={photo} toneMapped={false} />
      </mesh>
      <RoundedBox args={[3.22, 0.09, 0.07]} position={[0, 1.19, 0.11]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#8a6044" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[3.22, 0.09, 0.07]} position={[0, -1.19, 0.11]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#8a6044" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.09, 2.48, 0.07]} position={[-1.61, 0, 0.11]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#8a6044" roughness={0.5} />
      </RoundedBox>
      <RoundedBox args={[0.09, 2.48, 0.07]} position={[1.61, 0, 0.11]} radius={0.02} smoothness={3} castShadow>
        <meshStandardMaterial color="#8a6044" roughness={0.5} />
      </RoundedBox>
    </group>
  );
}

function DiningBar() {
  const bottles = [
    { x: -0.85, color: "#7d2020", scale: 1.0 },
    { x: -0.35, color: "#c99b38", scale: 0.92 },
    { x: 0.18, color: "#254f36", scale: 1.05 },
    { x: 0.7, color: "#5a253c", scale: 0.88 },
  ];
  return (
    <group position={[4.0, 0, 1.35]}>
      <RoundedBox args={[2.1, 1.35, 1.8]} position={[0, 0.68, 0]} radius={0.12} smoothness={4} castShadow><meshStandardMaterial color="#343941" roughness={0.78} /></RoundedBox>
      <RoundedBox args={[2.35, 0.12, 2.0]} position={[0, 1.38, 0]} radius={0.05} smoothness={3} castShadow><meshStandardMaterial color="#72513f" roughness={0.72} /></RoundedBox>
      {bottles.map((bottle) => (
        <group key={bottle.x} position={[bottle.x, 1.62, -0.25]} scale={bottle.scale}>
          <mesh castShadow><cylinderGeometry args={[0.10, 0.12, 0.38, 12]} /><meshStandardMaterial color={bottle.color} roughness={0.35} metalness={0.05} /></mesh>
          <mesh position={[0, 0.27, 0]} castShadow><cylinderGeometry args={[0.035, 0.045, 0.18, 10]} /><meshStandardMaterial color={bottle.color} roughness={0.3} /></mesh>
        </group>
      ))}
      <group position={[-0.55, 1.57, 0.45]}><mesh><cylinderGeometry args={[0.07, 0.08, 0.16, 12]} /><meshStandardMaterial color="#bfe8f2" transparent opacity={0.78} /></mesh></group>
      <group position={[0.05, 1.57, 0.45]}><mesh><cylinderGeometry args={[0.07, 0.08, 0.16, 12]} /><meshStandardMaterial color="#dce9ef" transparent opacity={0.7} /></mesh></group>
      <group position={[0.62, 1.5, 0.4]}><RoundedBox args={[0.45, 0.06, 0.32]} radius={0.025} smoothness={2}><meshStandardMaterial color="#eee8dc" /></RoundedBox><mesh position={[0, 0.07, 0]}><sphereGeometry args={[0.075, 12, 8]} /><meshStandardMaterial color="#d28b4b" /></mesh></group>
      <group position={[-0.82, 1.5, 0.42]}><RoundedBox args={[0.38, 0.06, 0.3]} radius={0.025} smoothness={2}><meshStandardMaterial color="#eee8dc" /></RoundedBox><mesh position={[0, 0.07, 0]}><sphereGeometry args={[0.08, 12, 8]} /><meshStandardMaterial color="#c95d4e" /></mesh></group>
    </group>
  );
}

function TVScreen({ watching = false, track = null }) {
  const clampText = (value, length) => {
    const text = String(value || "").replace(/\s+/g, " ").trim();
    return text.length > length ? `${text.slice(0, length - 1)}…` : text;
  };
  const title = clampText(track?.title || "NO TRACK PLAYING", 30);
  const artist = clampText(track?.artist || "GC HANGOUT TV", 24);
  const status = watching ? "WATCHING" : "TV READY";
  const progress = track?.duration > 0 ? Math.min(1, Math.max(0, Number(track.position || 0) / Number(track.duration))) : 0;

  return (
    <group position={[0, 2.2, -8.92]}>
      <mesh><planeGeometry args={[8.05, 2.34]} /><meshBasicMaterial color="#111827" /></mesh>
      <Text position={[0, 0.72, 0.03]} fontSize={0.2} color="#aeb6d5" anchorX="center">{status}</Text>
      <Text position={[0, 0.25, 0.03]} fontSize={0.31} color="#ffffff" anchorX="center" textAlign="center">{title}</Text>
      <Text position={[0, -0.22, 0.03]} fontSize={0.18} color="#aeb6d5" anchorX="center" textAlign="center">{artist}</Text>
      <mesh position={[0, -0.67, 0.03]}>
        <planeGeometry args={[5.7, 0.055]} />
        <meshBasicMaterial color="#4b5563" />
      </mesh>
      <mesh position={[-2.85 + 2.85 * progress, -0.67, 0.04]}>
        <circleGeometry args={[0.075, 12]} />
        <meshBasicMaterial color="#d8ceff" />
      </mesh>
    </group>
  );
}

function MusicSpeaker({ playing = false, volume = 0.8 }) {
  const ring = useRef();
  useFrame(({ clock }) => {
    if (!ring.current) return;
    const pulse = playing ? 1 + Math.sin(clock.getElapsedTime() * 7) * 0.035 * Math.max(0.2, volume) : 1;
    ring.current.scale.setScalar(pulse);
    ring.current.material.opacity = 0.18 + volume * 0.42;
  });
  return (
    <group position={[5.25, 1.15, -8.35]}>
      <RoundedBox args={[1.2, 1.8, 0.65]} position={[0, 0.9, 0]} radius={0.12} smoothness={5} castShadow>
        <meshStandardMaterial color="#151923" roughness={0.48} metalness={0.18} />
      </RoundedBox>
      <mesh position={[0, 1.28, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.28, 0.28, 0.08, 32]} />
        <meshStandardMaterial color="#2e3442" />
      </mesh>
      <mesh position={[0, 0.58, 0.34]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.08, 32]} />
        <meshStandardMaterial color="#596173" />
      </mesh>
      <mesh ref={ring} position={[0, 1.28, 0.39]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.31, 0.36, 32]} />
        <meshBasicMaterial color="#b8aaff" transparent opacity={0.35} />
      </mesh>
      <Text position={[0, 0.05, 0.38]} fontSize={0.12} color="#b8aaff" anchorX="center">MUSIC</Text>
    </group>
  );
}

function Furniture() {
  return (
    <group>
      <group position={[-9.8, 0, -7.25]}>
        <Sofa />
      </group>
      <group position={[-9.8, 0, 0.55]} rotation={[0, Math.PI, 0]}>
        <Sofa />
      </group>
      <CoffeeTable position={[-9.8, 0, -3.35]} />
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
      <DiningBar />
      <Plant position={[-13.1, 0, 7.5]} />
      <Plant position={[13.0, 0, -7.7]} scale={1.15} />
      <Lamp position={[-5.7, 0, 6.8]} />
      <Lamp position={[5.8, 0, 6.8]} />
    </group>
  );
}

function Room({ player, onMove, onNearby, interaction, joystickRef, motionResetKey, pov, tvState, emote }) {
  return (
    <>
      <ambientLight intensity={1.82} />
      <hemisphereLight args={["#fff2dc", "#303847", 1.1]} />
      <directionalLight position={[5, 10, 4]} intensity={0.95} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <pointLight position={[0, 4.5, 0]} intensity={2.15} distance={18} color="#fff1d5" />
      <pointLight position={[-9, 3.6, -3]} intensity={1.25} distance={10} color="#e2e8ff" />
      <pointLight position={[9, 3.6, 4]} intensity={1.25} distance={10} color="#ffe5c2" />
      <color attach="background" args={["#141821"]} />
      <fog attach="fog" args={["#141821", 24, 46]} />

      <mesh receiveShadow position={[0, -0.12, 0]}><boxGeometry args={[30, 0.24, 20]} /><meshStandardMaterial color="#343b46" roughness={0.92} /></mesh>
      <mesh position={[0, 2.5, -10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[0, 2.5, 10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[-15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#252b35" roughness={0.96} /></mesh>
      <mesh position={[0, 4.85, 0]}><boxGeometry args={[28.5, 0.12, 18.5]} /><meshStandardMaterial color="#1d222c" roughness={1} /></mesh>

      <Furniture />
      <TVScreen watching={interaction?.anchor?.type === "WATCH_TV"} track={tvState?.track} />
      <MusicSpeaker playing={Boolean(tvState?.playing)} volume={Number(tvState?.volume ?? 0.8)} />
      <WallPhotoFrame />
      <GraffitiWall />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.018, 0]} receiveShadow><circleGeometry args={[4.7, 64]} /><meshStandardMaterial color="#303845" roughness={0.98} /></mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}><ringGeometry args={[4.7, 4.82, 64]} /><meshBasicMaterial color="#7a8190" transparent opacity={0.28} /></mesh>
      <Text position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#676d7b">OPEN SOCIAL FLOOR</Text>
      <LocalPlayer state={player} onMove={onMove} onNearby={onNearby} interaction={interaction} joystickRef={joystickRef} motionResetKey={motionResetKey} pov={pov} emote={emote} />
    </>
  );
}

function findSafeExit(anchor, fallback) {
  const preferred = anchor?.exitX != null && anchor?.exitZ != null
    ? { x: anchor.exitX, z: anchor.exitZ }
    : fallback;
  const candidates = [
    preferred,
    { x: preferred.x - 0.7, z: preferred.z },
    { x: preferred.x + 0.7, z: preferred.z },
    { x: preferred.x, z: preferred.z - 0.7 },
    { x: preferred.x, z: preferred.z + 0.7 },
    { x: preferred.x - 1.2, z: preferred.z },
    { x: preferred.x + 1.2, z: preferred.z },
    { x: preferred.x, z: preferred.z - 1.2 },
    { x: preferred.x, z: preferred.z + 1.2 },
    { x: preferred.x - 1.8, z: preferred.z },
    { x: preferred.x + 1.8, z: preferred.z },
    { x: preferred.x, z: preferred.z - 1.8 },
    { x: preferred.x, z: preferred.z + 1.8 },
  ].map((candidate) => ({
    x: clamp(candidate.x, -WORLD.halfX + 0.6, WORLD.halfX - 0.6),
    z: clamp(candidate.z, -WORLD.halfZ + 0.6, WORLD.halfZ - 0.6),
  }));
  return candidates.find((candidate) => !blocked(candidate.x, candidate.z)) || fallback;
}

export default function Game() {
  const [player, setPlayer] = useState(() => ({ id: "local", name: "You", avatar: AVATARS[0], x: 0, z: 1.5, rot: Math.PI, moving: false, speed: 0 }));
  const [name, setName] = useState("You");
  const [avatarId, setAvatarId] = useState("maya");
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [pov, setPov] = useState("tpp");
  const [nearby, setNearby] = useState([]);
  const [interaction, setInteraction] = useState(null);
  const [tvState, setTvState] = useState({ track: null });
  const [emote, setEmote] = useState(null);
  const [joystick, setJoystick] = useState({ x: 0, y: 0, active: false });
  const joystickRef = useRef({ x: 0, y: 0, active: false });
  const restoreMotion = useRef({ x: 0, z: 1.5, rot: Math.PI });
  const motionResetKey = useRef(0);

  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId) || AVATARS[0], [avatarId]);

  const handleMusicState = useCallback((state) => {
    setTvState({
      track: state.track ? { ...state.track, position: state.position } : null,
      playing: Boolean(state.playing),
      volume: Number(state.volume ?? 0.8),
    });
  }, []);

  const handleEmote = useCallback((next) => {
    setEmote(next);
    window.setTimeout(() => setEmote((current) => current === next ? null : current), 1800);
  }, []);

  const universalInteraction = nearby.find((anchor) => anchor.type === "SIT" || anchor.type === "SLEEP" || anchor.type === "EAT" || anchor.type === "DRINK" || anchor.type === "WATCH_TV");
  const universalActive = Boolean(interaction);

  const beginInteraction = (anchor) => {
    if (!anchor) return;
    if (interaction && interaction.anchor.type !== "SIT") return;
    if (!interaction && !canReserveInteraction(null, anchor.id, "local")) return;
    const seatedEat = Boolean(anchor.requiresSitting && interaction?.anchor?.type === "SIT");
    const nextAnchor = seatedEat
      ? { ...anchor, seatStyle: interaction.anchor.seatStyle, targetX: player.x, targetZ: player.z, targetRot: player.rot, exitX: player.x, exitZ: player.z }
      : anchor;
    if (!interaction) restoreMotion.current = { x: player.x, z: player.z, rot: player.rot };
    setInteraction({ status: "reserved", phase: "reserve", anchor: nextAnchor, startedAt: Date.now() });
  };

  const endInteraction = () => {
    const current = interaction;
    if (!current) return;
    const anchor = current.anchor;
    const exit = findSafeExit(anchor, restoreMotion.current);
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
    const phases = [["stop", INTERACTION_PHASE_MS.stop], ["align", INTERACTION_PHASE_MS.align], ["animate", INTERACTION_PHASE_MS.animate], ["sync", INTERACTION_PHASE_MS.sync]];
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

  useEffect(() => {
    setTvState((current) => ({
      ...current,
      watching: interaction?.anchor?.type === "WATCH_TV",
    }));
  }, [interaction?.anchor?.type]);

  return (
    <main className="game-shell">
      <Canvas shadows dpr={[1, 1.5]} camera={{ position: [0, 3.6, 7.8], fov: 60, near: 0.2, far: 55 }} gl={{ antialias: true, powerPreference: "high-performance" }}>
        <Room player={player} onMove={setPlayer} onNearby={setNearby} interaction={interaction} joystickRef={joystickRef} motionResetKey={motionResetKey.current} pov={pov} tvState={tvState} emote={emote} />
      </Canvas>

      <div className="hud"><div className="hud-title">GC HANGOUT</div><div className="hud-subtitle">Shared home</div><div className="hud-controls"><span>WASD / arrows</span><span>Drag / touch to look</span><span>Shift: run</span></div></div>
      <SocialHud
        name={name.trim().slice(0, 18) || "You"}
        onMusicState={handleMusicState}
        onEmote={handleEmote}
      />
      {interaction?.anchor?.type === "SIT" && nearby.some((anchor) => anchor.id === "dining-eat") && (
        <button className="interaction-hint secondary-action" onPointerDown={(event) => event.stopPropagation()} onClick={() => beginInteraction(nearby.find((anchor) => anchor.id === "dining-eat"))}><strong>Eat</strong><span>Eat while sitting</span></button>
      )}

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

      <button
        className={`interaction-button${universalActive ? " active" : ""}${universalInteraction ? " available" : ""}`}
        onPointerDown={(event) => event.stopPropagation()}
        onClick={() => {
          if (universalActive) {
            endInteraction();
            return;
          }
          if (universalInteraction) beginInteraction(universalInteraction);
        }}
        aria-label={universalActive ? "Exit interaction" : universalInteraction?.type === "SLEEP" ? "Sleep" : universalInteraction?.type === "EAT" ? "Eat" : universalInteraction?.type === "DRINK" ? "Drink" : universalInteraction?.type === "WATCH_TV" ? "Watch TV" : "Sit"}
        title={universalActive ? "Exit interaction" : universalInteraction?.type === "SLEEP" ? "Sleep" : universalInteraction?.type === "EAT" ? "Eat" : universalInteraction?.type === "DRINK" ? "Drink" : universalInteraction?.type === "WATCH_TV" ? "Watch TV" : "Sit"}
      >
        {universalActive ? "↗" : universalInteraction?.type === "EAT" ? "🍴" : universalInteraction?.type === "DRINK" ? "🥤" : universalInteraction?.type === "WATCH_TV" ? "📺" : "♙"}
      </button>

      <button className="pov-toggle" onPointerDown={(event) => event.stopPropagation()} onClick={() => setPov((value) => value === "tpp" ? "fpp" : "tpp")} aria-label={pov === "tpp" ? "Switch to first person view" : "Switch to third person view"}>{pov === "tpp" ? "FPP" : "TPP"}</button>
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
