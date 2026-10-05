"use client";
import {Canvas} from "@react-three/fiber";
import {OrbitControls,PerspectiveCamera,Text} from "@react-three/drei";
import {useMemo,useState} from "react";
import * as THREE from "three";

const avatars=[["🧑‍🎤","Neon"],["🐸","Frog"],["👽","Alien"],["🤖","Bot"],["🦊","Fox"],["🐱","Cat"],["👻","Ghost"],["🧙","Mage"]];

function Room({name,avatar}){
 const people=useMemo(()=>[
  {name,avatar,pos:[0,0.55,1.65],me:true},
  {name:"Sam",avatar:"🐸",pos:[-1.8,0.55,-1.1]},
  {name:"Alex",avatar:"👽",pos:[1.8,0.55,-1.1]},
  {name:"Jay",avatar:"🤖",pos:[0,0.55,-2.2]}
 ],[name,avatar]);
 return <div className="room">
  <Canvas shadows dpr={[1,1.5]}>
   <PerspectiveCamera makeDefault position={[0,5.8,8.5]} fov={45}/>
   <ambientLight intensity={1.1}/>
   <directionalLight position={[4,8,3]} intensity={2} castShadow/>
   <pointLight position={[-4,3,-2]} intensity={12} distance={10} color="#7c5cff"/>
   <RoomModel/>
   {people.map((p,i)=><Avatar key={i} {...p}/>)}
   <OrbitControls enablePan={false} minPolarAngle={0.65} maxPolarAngle={1.3} minDistance={6} maxDistance={11}/>
  </Canvas>
  <div className="topbar"><div><b>🌙 GC HANGOUT</b><span> • Lounge Room</span></div><div className="online">● 4 online</div></div>
  <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Sam</strong> bro this room is sick 💀</div><div className="msg"><strong>Alex</strong> when are we adding games?</div><div className="input">Type a message…</div></div>
  <div className="controls"><button>🎙️ Voice</button><button>🎵 Music</button><button>🎮 Games</button><button>💬 Chat</button></div>
 </div>
}

function RoomModel(){
 return <group>
  <mesh receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[12,10]}/><meshStandardMaterial color="#171521" roughness={.85}/></mesh>
  <mesh position={[0,2.4,-4.5]}><boxGeometry args={[12,4.8,.25]}/><meshStandardMaterial color="#171622"/></mesh>
  <mesh position={[-5.8,2.4,0]}><boxGeometry args={[.25,4.8,10]}/><meshStandardMaterial color="#111018"/></mesh>
  <mesh position={[5.8,2.4,0]}><boxGeometry args={[.25,4.8,10]}/><meshStandardMaterial color="#111018"/></mesh>
  <mesh position={[0,1.8,-4.25]}><boxGeometry args={[4.2,2.2,.18]}/><meshStandardMaterial emissive="#332a78" emissiveIntensity={1} color="#5d4ad7"/></mesh>
  <Text position={[0,2,-4.12]} fontSize={.38} color="white" anchorX="center">GC HANGOUT</Text>
  <Furniture position={[-2.1,.45,-.9]} rotation={[0,.35,0]}/><Furniture position={[2.1,.45,-.9]} rotation={[0,-.35,0]}/>
  <mesh position={[0,.45,-.8]}><boxGeometry args={[2.4,.3,1.2]}/><meshStandardMaterial color="#292536"/></mesh>
  <mesh position={[0,.72,-.8]}><boxGeometry args={[2,.18,1]}/><meshStandardMaterial color="#3d344b"/></mesh>
  <mesh position={[0,1.1,-3.8]}><boxGeometry args={[1.4,.25,.7]}/><meshStandardMaterial color="#282331"/></mesh>
  <mesh position={[0,1.35,-3.8]}><boxGeometry args={[1.1,.5,.12]}/><meshStandardMaterial emissive="#251d54" color="#14121d"/></mesh>
  <Text position={[0,1.4,-3.72]} fontSize={.16} color="#9f8cff" anchorX="center">🎵 CHILL</Text>
  <Text position={[0,3.3,-4.15]} fontSize={.2} color="#77728a" anchorX="center">your room • your people</Text>
 </group>
}
function Furniture({position,rotation}){return <group position={position} rotation={rotation}><mesh castShadow><boxGeometry args={[1.8,.5,.7]}/><meshStandardMaterial color="#5b3f35"/></mesh><mesh position={[0,.55,-.25]} castShadow><boxGeometry args={[1.8,1,.25]}/><meshStandardMaterial color="#69493d"/></mesh></group>}
function Avatar({name,avatar,pos,me}){return <group position={pos}><mesh castShadow position={[0,.05,0]}><cylinderGeometry args={[.34,.42,.16,24]}/><meshStandardMaterial color={me?"#7c5cff":"#343141"}/></mesh><Text position={[0,.7,0]} fontSize={.22} color="white" anchorX="center">{avatar}</Text><Text position={[0,.95,0]} fontSize={.16} color={me?"#b9aaff":"#c9c4d5"} anchorX="center">{name}{me?" • you":""}</Text></group>}

export default function Home(){
 const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatar,setAvatar]=useState("🧑‍🎤");
 if(joined)return <Room name={name||"You"} avatar={avatar}/>;
 return <main className="join"><div className="card"><div className="logo">🌙</div><h1>GC Hangout</h1><p>Your group's virtual room.</p><label>Your name<input value={name} onChange={e=>setName(e.target.value.slice(0,18))} placeholder="e.g. Rishi"/></label><div className="label">Choose your avatar</div><div className="avatars">{avatars.map(([a,n])=><button className={avatar===a?"selected":""} onClick={()=>setAvatar(a)} key={a}><span>{a}</span><small>{n}</small></button>)}</div><button className="enter" onClick={()=>setJoined(true)} disabled={!name.trim()}>Enter the room →</button><div className="note">Prototype • Multiplayer + voice coming next</div></div></main>
}