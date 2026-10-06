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
  { id: "food-table", type: "EAT", label: "Food", x: 8.0, z: 5.8, rot: Math.PI, radius: 2.6 },
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

function HumanAvatar({ avatar, moving, local }) {
  const group = useRef();
  const arms = useRef([]);
  const legs = useRef([]);
  const { skin, shirt, pants, hair } = avatar;

  useFrame(({ clock }) => {
    if (!group.current) return;
    const t = clock.getElapsedTime();
    const stride = moving ? Math.sin(t * 11) * 0.48 : Math.sin(t * 2.2) * 0.025;
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

function LocalPlayer({ state, onMove, onNearby }) {
  const keys = useRef(new Set());
  const yaw = useRef(0.2);
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
      drag.current.x = event.clientX;
      yaw.current -= dx * 0.006;
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
    const forward = Number(keys.current.has("w") || keys.current.has("arrowup")) - Number(keys.current.has("s") || keys.current.has("arrowdown"));
    const strafe = Number(keys.current.has("d") || keys.current.has("arrowright")) - Number(keys.current.has("a") || keys.current.has("arrowleft"));
    const magnitude = Math.hypot(strafe, forward);
    const safeDt = Math.min(dt, 0.05);

    let next = state;
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
    onNearby(findNearestAnchor(next.x, next.z));

    const cameraDistance = 5.8;
    const desired = cameraTarget.current.set(
      state.x - Math.sin(yaw.current) * cameraDistance,
      3.0,
      state.z - Math.cos(yaw.current) * cameraDistance
    );
    cameraPosition.current.lerp(desired, 1 - Math.exp(-8 * safeDt));
    camera.position.copy(cameraPosition.current);
    camera.lookAt(state.x, 1.15, state.z);
  });

  return (
    <group position={[state.x, 0, state.z]} rotation={[0, state.rot, 0]}>
      <HumanAvatar avatar={state.avatar} moving={state.moving} local />
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
      <group position={[0, 0, -8.55]}>
        <RoundedBox args={[10.2, 3.7, 0.35]} position={[0, 2.0, 0]} radius={0.16} smoothness={5}>
          <meshStandardMaterial color="#151923" roughness={0.35} />
        </RoundedBox>
        <mesh position={[0, 2.0, 0.2]}>
          <planeGeometry args={[9.7, 3.2]} />
          <meshStandardMaterial color="#0d111a" emissive="#211b42" emissiveIntensity={0.35} />
        </mesh>
        <Text position={[-4.2, 3.15, 0.25]} fontSize={0.3} color="#9e92e8" anchorX="left">GC TV / MUSIC</Text>
      </group>
      <group position={[9.7, 5.8, 0]}>
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

function Room({ player, onMove, onNearby }) {
  return (
    <>
      <ambientLight intensity={1.15} />
      <directionalLight position={[5, 9, 4]} intensity={2.0} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024} />
      <color attach="background" args={["#0e1118"]} />
      <fog attach="fog" args={["#0e1118", 24, 46]} />

      <mesh receiveShadow position={[0, -0.12, 0]}>
        <boxGeometry args={[30, 0.24, 20]} />
        <meshStandardMaterial color="#272d36" roughness={0.96} />
      </mesh>

      <mesh position={[0, 2.5, -10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[0, 2.5, 10]}><boxGeometry args={[30, 5, 0.3]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[-15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#1d222b" /></mesh>
      <mesh position={[15, 2.5, 0]}><boxGeometry args={[0.3, 5, 20]} /><meshStandardMaterial color="#1d222b" /></mesh>

      <Furniture />
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.015, 0]}>
        <ringGeometry args={[4.8, 4.9, 64]} />
        <meshBasicMaterial color="#5b6170" transparent opacity={0.45} />
      </mesh>
      <Text position={[0, 0.03, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.28} color="#676d7b">
        OPEN SOCIAL FLOOR
      </Text>

      <LocalPlayer state={player} onMove={onMove} onNearby={onNearby} />
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
  const avatar = useMemo(() => AVATARS.find((item) => item.id === avatarId) || AVATARS[0], [avatarId]);

  useEffect(() => {
    setPlayer((prev) => ({ ...prev, name: name.trim().slice(0, 18) || "You", avatar }));
  }, [name, avatar]);

  return (
    <main className="game-shell">
      <Canvas shadows dpr={[1, 1.75]} camera={{ position: [0, 3, 7], fov: 58, near: 0.1, far: 60 }}>
        <Room player={player} onMove={setPlayer} onNearby={setNearby} />
      </Canvas>
      <div className="hud">
        <div className="hud-title">GC HANGOUT</div>
        <div className="hud-subtitle">Shared home foundation</div>
        <div className="hud-controls"><span>WASD / arrows</span><span>Drag / touch to look</span><span>Shift: run</span></div>
      {nearby && <div className="interaction-hint"><strong>{nearby.label}</strong><span>{nearby.type === "SLEEP" ? "Bed area" : nearby.type === "WATCH_TV" ? "TV area" : "Interaction anchor"}</span></div>}
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
