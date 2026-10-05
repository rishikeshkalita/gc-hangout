"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import React from "react";
import { PerspectiveCamera, Text, RoundedBox, Environment, ContactShadows, useGLTF, useAnimations } from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../lib/supabase";

const PRESETS = [
  {id:"maya",label:"Maya",skin:0xd79a6f,hair:0x251b1b,shirt:0xc9577b,pants:0x252d4a,style:"long"},
  {id:"noah",label:"Noah",skin:0x9a5d32,hair:0x181515,shirt:0x3b72a5,pants:0x252525,style:"short"},
  {id:"riya",label:"Riya",skin:0x8c4f2f,hair:0x21181a,shirt:0x3e9b82,pants:0x31263d,style:"bun"},
  {id:"aarav",label:"Aarav",skin:0xe0ac69,hair:0x4b2c1c,shirt:0xc48735,pants:0x253e55,style:"curly"},
  {id:"zoe",label:"Zoe",skin:0xf1c27d,hair:0x3a2418,shirt:0x7a62c7,pants:0x232d3d,style:"ponytail"},
  {id:"sam",label:"Sam",skin:0x6b3e26,hair:0x161414,shirt:0xd35d65,pants:0x22252d,style:"fade"},
  {id:"kai",label:"Kai",skin:0xffdbac,hair:0x7a4a25,shirt:0x2f8d70,pants:0x3c304d,style:"wave"},
  {id:"rihan",label:"Rihan",skin:0xc68642,hair:0x241a17,shirt:0x6d63c8,pants:0x242c3a,style:"messy"}
];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const makeId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
const HALL_SCALE=1.55;
const HALL_HALF_X=8.0,HALL_HALF_Z=5.2;
const HALL_BOXES=[
 {x:4.0,z:-1.25,rx:2.05,rz:.82},
 {x:4.2,z:1.45,rx:1.8,rz:1.05},
 {x:-4.0,z:1.0,rx:2.0,rz:1.15},
 {x:0,z:-.45,rx:1.05,rz:.72}
];
const blocked=(x,z,r=.25)=>{
 if(x<-HALL_HALF_X+r||x>HALL_HALF_X-r||z<-HALL_HALF_Z+r||z>HALL_HALF_Z-r)return true;
 for(const b of HALL_BOXES){const qx=clamp(x,b.x-b.rx,b.x+b.rx),qz=clamp(z,b.z-b.rz,b.z+b.rz);if(Math.hypot(x-qx,z-qz)<r)return true}
 return false;
};
const tryMove=(x,z,dx,dz)=>{const nx=x+dx,nz=z+dz;if(!blocked(nx,nz))return{x:nx,z:nz};if(!blocked(nx,z))return{x:nx,z};if(!blocked(x,nz))return{x,z:nz};return{x,z}};

function Hair({style,color}){
  if(style==="long") return <><mesh castShadow position={[0,1.36,-.02]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh><mesh castShadow position={[-.25,1.12,.02]} scale={[.7,1.25,.7]}><sphereGeometry args={[.2,18,14]}/><meshStandardMaterial color={color}/></mesh></>;
  if(style==="ponytail") return <><mesh castShadow position={[0,1.37,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[.28,1.28,-.08]} scale={[.65,1.15,.65]}><sphereGeometry args={[.18,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
  if(style==="bun") return <><mesh castShadow position={[0,1.38,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[0,1.67,-.02]}><sphereGeometry args={[.16,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
  return <mesh castShadow position={[0,1.38,0]} scale={[1,.72,1]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;
}

const HUMAN_URL="https://cdn.3dassets.dev/assets/32901/v1/model.glb";
const ROOM_URL="https://cdn.3dassets.dev/assets/38818/v1/model.glb";

function RealHuman({player,me}){
 const {scene,animations}=useGLTF(HUMAN_URL);
 const root=useRef();
 const model=useMemo(()=>SkeletonUtils.clone(scene),[scene]);
 const {actions}=useAnimations(animations,root);
 useEffect(()=>{if(!actions)return;const names=Object.keys(actions);const idle=names.find(n=>/idle/i.test(n))||names[0];const walk=names.find(n=>/walk/i.test(n))||idle;Object.values(actions).forEach(a=>a?.stop());const a=actions[player.moving?walk:idle];a?.reset().fadeIn(.2).play();return()=>a?.fadeOut(.15)},[actions,player.moving]);
 useEffect(()=>{model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})},[model]);
 useFrame((_,dt)=>{
   if(!root.current)return;
   const target=player.rot||0;
   const hop=player.hopUntil&&player.hopUntil>Date.now()?Math.sin(((player.hopUntil-Date.now())/420)*Math.PI)*.38:0;
   root.current.position.x+=(player.x-root.current.position.x)*Math.min(1,12*dt);
   root.current.position.z+=(player.z-root.current.position.z)*Math.min(1,12*dt);
   root.current.position.y=hop;
   root.current.rotation.y+=Math.atan2(Math.sin(target-root.current.rotation.y),Math.cos(target-root.current.rotation.y))*Math.min(1,12*dt);
 });
 return <group ref={root} position={[player.x||0,0,player.z||0]} scale={[.98,.98,.98]}>
   <primitive object={model}/>
   <Text position={[0,2.05,0]} fontSize={.13} color={me?"#d9d0ff":"#ffffff"} anchorX="center" outlineWidth={.012} outlineColor="#15131a">{player.name}{me?" • you":""}</Text>
   {player.attacking&&<Text position={[0,2.28,0]} fontSize={.16} color="#ffd36b" anchorX="center">POW!</Text>}
 </group>;
}
function Sofa({x,z,rot=0}){return <group position={[x,0,z]} rotation={[0,rot,0]}><RoundedBox castShadow args={[2.35,.5,.88]} radius={.13} smoothness={5} position={[0,.48,0]}><meshStandardMaterial color="#66535f" roughness={.9}/></RoundedBox><RoundedBox castShadow args={[2.35,1.05,.28]} radius={.1} smoothness={5} position={[0,1,-.34]}><meshStandardMaterial color="#735d69" roughness={.92}/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[-1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox></group>}

function FloorLamp({x,z}){return <group position={[x,0,z]}><mesh castShadow position={[0,1.05,0]}><cylinderGeometry args={[.025,.025,2.1,12]}/><meshStandardMaterial color="#26232a" metalness={.6} roughness={.35}/></mesh><mesh castShadow position={[0,2.08,0]}><coneGeometry args={[.28,.25,24]}/><meshStandardMaterial color="#e7d9bd" emissive="#fff0cf" emissiveIntensity={.35}/></mesh><pointLight position={[0,1.9,0]} intensity={1.1} distance={3.5} color="#ffe6bd"/></group>}
function WallArt({x,z,rot=0}){return <group position={[x,2.25,z]} rotation={[0,rot,0]}><mesh><boxGeometry args={[1.15,.8,.06]}/><meshStandardMaterial color="#17151a" roughness={.5}/></mesh><mesh position={[0,0,.035]}><planeGeometry args={[.95,.6]}/><meshStandardMaterial color="#8c775f" roughness={.8}/></mesh><mesh position={[0,.05,.045]} rotation={[0,0,.35]}><boxGeometry args={[.55,.06,.02]}/><meshStandardMaterial color="#c4a77a"/></mesh></group>}
function Plant({x,z,s=1}){return <group position={[x,0,z]} scale={s}><mesh castShadow position={[0,.25,0]}><cylinderGeometry args={[.24,.3,.5,22]}/><meshStandardMaterial color="#6b4734"/></mesh>{[[-.15,.72,0],[.15,.78,0],[-.24,.62,.08],[.24,.66,-.06],[0,.9,.03]].map((q,i)=><mesh key={i} castShadow position={q} scale={[1,.7,1]}><sphereGeometry args={[.2,14,10]}/><meshStandardMaterial color={i%2?0x347b57:0x4a9a68} roughness={1}/></mesh>)}</group>}

class AssetBoundary extends React.Component{
 constructor(props){super(props);this.state={failed:false}}
 static getDerivedStateFromError(){return{failed:true}}
 componentDidCatch(error){console.error("3D asset failed to load",error)}
 render(){return this.state.failed?this.props.fallback:this.props.children}
}
function FallbackRoom(){
 return <group>
  <mesh receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[12,10]}/><meshStandardMaterial color="#5a5049" roughness={.82}/></mesh>
  <mesh position={[0,2.2,-5]}><boxGeometry args={[12,4.4,.18]}/><meshStandardMaterial color="#d8d0c7" roughness={.9}/></mesh>
  <mesh position={[-6,2.2,0]}><boxGeometry args={[.18,4.4,10]}/><meshStandardMaterial color="#c8c0b8" roughness={.9}/></mesh>
  <mesh position={[6,2.2,0]}><boxGeometry args={[.18,4.4,10]}/><meshStandardMaterial color="#c8c0b8" roughness={.9}/></mesh>
  <Sofa x={-3.6} z={-2.5} rot={.04}/><Sofa x={3.6} z={-2.5} rot={-.04}/>
  <mesh castShadow position={[0,.42,.2]}><cylinderGeometry args={[1.05,1.05,.18,48]}/><meshStandardMaterial color="#8d7768" roughness={.8}/></mesh>
  <mesh castShadow position={[0,.05,.2]}><cylinderGeometry args={[.18,.28,.75,20]}/><meshStandardMaterial color="#3a3029" roughness={.75}/></mesh>
  <FloorLamp x={-4.9} z={-3.5}/><FloorLamp x={4.9} z={-3.5}/>
  <Plant x={-5.4} z={3.7} s={.9}/><Plant x={5.4} z={3.7} s={.9}/>
 </group>
}
function FallbackHuman({player,me}){
 const ref=useRef();useFrame((_,dt)=>{if(!ref.current)return;const t=player.rot||0;ref.current.rotation.y+=Math.atan2(Math.sin(t-ref.current.rotation.y),Math.cos(t-ref.current.rotation.y))*Math.min(1,8*dt);ref.current.position.set(player.x||0,.0,player.z||0)});
 return <group ref={ref}><mesh castShadow position={[0,.75,0]}><capsuleGeometry args={[.24,.55,8,16]}/><meshStandardMaterial color="#5966b8" roughness={.75}/></mesh><mesh castShadow position={[0,1.35,0]}><sphereGeometry args={[.28,24,18]}/><meshStandardMaterial color="#c98f6b" roughness={.8}/></mesh><Text position={[0,1.8,0]} fontSize={.13} color={me?"#d9d0ff":"#fff"} anchorX="center">{player.name}{me?" • you":""}</Text></group>
}
function RealRoom(){const {scene}=useGLTF(ROOM_URL);const clone=useMemo(()=>scene.clone(true),[scene]);useEffect(()=>{clone.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})},[clone]);return <primitive object={clone} position={[0,0,0]} scale={[HALL_SCALE,1,HALL_SCALE]}/>}
function PlayerController({posRef,moveRef,onMove,viewRef}){
 const lastSend=useRef(0),velocity=useRef({x:0,z:0}),hopRef=useRef(0);
 useFrame(({camera},dt)=>{
   const d=Math.min(dt,.05),m=moveRef.current,v=viewRef.current;
   const forward={x:-Math.sin(v.yaw),z:-Math.cos(v.yaw)},right={x:Math.cos(v.yaw),z:-Math.sin(v.yaw)};
   const inputX=m.x*right.x+m.z*forward.x,inputZ=m.x*right.z+m.z*forward.z;
   const len=Math.hypot(inputX,inputZ)||1;
   const ix=inputX/len,iz=inputZ/len;
   const targetSpeed=(m.x||m.z)?3.25:0;
   const tx=ix*targetSpeed,tz=iz*targetSpeed;
   velocity.current.x+=(tx-velocity.current.x)*Math.min(1,(m.x||m.z?8:11)*d);
   velocity.current.z+=(tz-velocity.current.z)*Math.min(1,(m.x||m.z?8:11)*d);
   if(!m.x&&!m.z){velocity.current.x*=Math.max(0,1-8*d);velocity.current.z*=Math.max(0,1-8*d)}
   const speed=Math.hypot(velocity.current.x,velocity.current.z);
   if(speed>.025){
     const before=posRef.current,step=tryMove(before.x,before.z,velocity.current.x*d,velocity.current.z*d);
     const blockedMove=Math.abs(step.x-before.x)<.0001&&Math.abs(step.z-before.z)<.0001;
     if(blockedMove&&hopRef.current<performance.now())hopRef.current=performance.now()+420;
     posRef.current={...before,...step,rot:Math.atan2(velocity.current.x,velocity.current.z),moving:true,hopUntil:hopRef.current};
     const now=performance.now();if(now-lastSend.current>70){lastSend.current=now;onMove(posRef.current)}
   }else if(posRef.current.moving){posRef.current={...posRef.current,moving:false,hopUntil:0};onMove(posRef.current)}
   const t=posRef.current,dist=v.distance;
   const camX=t.x+Math.sin(v.yaw)*dist,camZ=t.z+Math.cos(v.yaw)*dist;
   const camY=1.65+Math.sin(v.pitch)*dist*.45;
   camera.position.x+=(camX-camera.position.x)*Math.min(1,5.5*d);
   camera.position.y+=(camY-camera.position.y)*Math.min(1,5.5*d);
   camera.position.z+=(camZ-camera.position.z)*Math.min(1,5.5*d);
   camera.lookAt(t.x,t.y+.88,t.z);
 });
 return null;
}
function Speaker({x,z,playing}){const ref=useRef();useFrame(({clock})=>{if(ref.current)ref.current.scale.setScalar(1+(playing?.04+.03*Math.sin(clock.elapsedTime*10):0))});return <group ref={ref} position={[x,.65,z]}><RoundedBox castShadow args={[.58,1.2,.4]} radius={.06} smoothness={4}><meshStandardMaterial color="#121117" roughness={.78}/></RoundedBox><mesh position={[0,.12,.21]}><circleGeometry args={[.16,24]}/><meshStandardMaterial color="#292631" emissive={playing?"#8064ff":"#15141a"} emissiveIntensity={playing?2:.2}/></mesh><mesh position={[0,-.25,.21]}><circleGeometry args={[.11,24]}/><meshStandardMaterial color="#292631"/></mesh></group>}
function MusicTV({playing}){const ref=useRef();useFrame(({clock})=>{if(ref.current)ref.current.material.emissiveIntensity=playing?1.15+.25*Math.sin(clock.elapsedTime*4):.35});return <mesh ref={ref} position={[0,1.48,-4.56]}><boxGeometry args={[4.18,1.58,.035]}/><meshStandardMaterial color={playing?"#17112d":"#0c0e14"} emissive={playing?"#4b3599":"#11131b"} emissiveIntensity={playing?1:.35}/></mesh>}
function PoolTable(){return <group position={[-2.8,.35,1.7]}><RoundedBox castShadow args={[3,.3,1.45]} radius={.08} smoothness={4}><meshStandardMaterial color="#2b201c"/></RoundedBox><RoundedBox castShadow args={[2.65,.08,1.1]} radius={.04} smoothness={3} position={[0,.2,0]}><meshStandardMaterial color="#174f3b"/></RoundedBox>{[[-1.25,.25,-.5],[1.25,.25,-.5],[-1.25,.25,.5],[1.25,.25,.5]].map((q,i)=><mesh key={i} position={q}><cylinderGeometry args={[.07,.07,.1,16]}/><meshStandardMaterial color="#08080a"/></mesh>)}{[[0,.28,0],[.42,.28,.12],[-.35,.28,-.18],[.28,.28,-.3]].map((q,i)=><mesh key={i} position={q}><sphereGeometry args={[.07,16,12]}/><meshStandardMaterial color={["#fff","#e6a33d","#d74e59","#4d83d8"][i]}/></mesh>)}</group>}
function Kitchen(){return <group position={[3.45,0,1.7]}><RoundedBox castShadow args={[1.9,.9,1.15]} radius={.08} smoothness={5} position={[0,.55,0]}><meshStandardMaterial color="#403a41" roughness={.65}/></RoundedBox><RoundedBox castShadow args={[2.02,.12,1.25]} radius={.04} smoothness={4} position={[0,1.03,0]}><meshStandardMaterial color="#9a9188" roughness={.4}/></RoundedBox><mesh position={[-.38,1.11,0]}><cylinderGeometry args={[.22,.22,.025,32]}/><meshStandardMaterial color="#151419"/></mesh><mesh position={[.38,1.11,0]}><cylinderGeometry args={[.22,.22,.025,32]}/><meshStandardMaterial color="#151419"/></mesh><mesh position={[.72,1.18,-.2]}><cylinderGeometry args={[.14,.1,.24,24]}/><meshStandardMaterial color="#d6d0c5"/></mesh></group>}
function Arcade(){return <group position={[-4.25,.8,-1.55]}><RoundedBox castShadow args={[.85,1.65,.6]} radius={.08} smoothness={5}><meshStandardMaterial color="#20202a"/></RoundedBox><mesh position={[0,.55,.32]} rotation={[-.15,0,0]}><boxGeometry args={[.62,.46,.035]}/><meshStandardMaterial color="#14111d" emissive="#6448cc" emissiveIntensity={1.5}/></mesh><mesh position={[0,.05,.33]}><cylinderGeometry args={[.12,.12,.04,20]}/><meshStandardMaterial color="#d8c44f"/></mesh><mesh position={[.23,.05,.33]}><cylinderGeometry args={[.07,.07,.04,20]}/><meshStandardMaterial color="#d85d66"/></mesh></group>}

function Room({local,players,onMove,onAttack,realtime,musicPlaying,onToggleMusic}){
  const [move,setMove]=useState({x:0,z:0});
  const moveRef=useRef(move); moveRef.current=move;
  const posRef=useRef({...local});
  const viewRef=useRef({yaw:0,pitch:.18,distance:6.4});
  useEffect(()=>{
    const down=e=>{
      if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      const k=e.key.toLowerCase();
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      e.preventDefault();
      setMove(m=>({x:k==="a"||k==="arrowleft"? -1:k==="d"||k==="arrowright"?1:m.x,z:k==="w"||k==="arrowup"?-1:k==="s"||k==="arrowdown"?1:m.z}));
    };
    const up=e=>{
      const k=e.key.toLowerCase();
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      setMove(m=>({x:(k==="a"||k==="arrowleft"||k==="d"||k==="arrowright")?0:m.x,z:(k==="w"||k==="arrowup"||k==="s"||k==="arrowdown")?0:m.z}));
    };
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[]);
  const joystick=e=>{
    const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2;
    setMove({x:clamp(x/55,-1,1),z:clamp(z/55,-1,1)});
    e.currentTarget.style.setProperty("--jx",clamp(x,-38,38)+"px");e.currentTarget.style.setProperty("--jz",clamp(z,-38,38)+"px");
  };
  const stop=e=>{setMove({x:0,z:0});e.currentTarget.style.setProperty("--jx","0px");e.currentTarget.style.setProperty("--jz","0px")};
  return <div className="room">
    <Canvas shadows dpr={[1,1.25]} performance={{min:.6}} onPointerDown={e=>{if(e.pointerType==="mouse"||e.pointerType==="touch"){e.target.setPointerCapture?.(e.pointerId);e.target.__gcDrag={x:e.clientX,y:e.clientY}}}} onPointerMove={e=>{const s=e.target.__gcDrag;if(!s)return;const dx=e.clientX-s.x,dy=e.clientY-s.y;s.x=e.clientX;s.y=e.clientY;viewRef.current.yaw-=dx*.006;viewRef.current.pitch=Math.max(-.12,Math.min(.58,viewRef.current.pitch-dy*.004))}} onPointerUp={e=>{delete e.target.__gcDrag}} onWheel={e=>{viewRef.current.distance=Math.max(3.2,Math.min(7,e.currentTarget.__gcDist=(viewRef.current.distance+(e.deltaY>0?.35:-.35))) )}}>
      <PerspectiveCamera makeDefault position={[0,2.2,6.2]} fov={56}/>
      <PlayerController posRef={posRef} moveRef={moveRef} onMove={onMove} viewRef={viewRef}/>
      <color attach="background" args={["#18151b"]}/>
      <ambientLight intensity={.72}/>
      <directionalLight position={[4,9,5]} intensity={1.2} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <pointLight position={[0,3,-2]} intensity={.55} distance={8} color="#e6d7ff"/>
      <Suspense fallback={<FallbackRoom/>}><AssetBoundary fallback={<FallbackRoom/>}><RealRoom/></AssetBoundary></Suspense>
      <ContactShadows position={[0,0,0]} opacity={.16} scale={12} blur={2.5} far={5}/>
      {Object.values(players).map(p=><Suspense key={p.id} fallback={<FallbackHuman player={p} me={p.id===local.id}/>}><AssetBoundary fallback={<FallbackHuman player={p} me={p.id===local.id}/>}><RealHuman player={p} me={p.id===local.id}/></AssetBoundary></Suspense>)}
    </Canvas>
    <div className="topbar"><div><b>🌙 GC HANGOUT</b></div><div className="online">● {Object.keys(players).length} online</div></div>
    
    <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystick(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))joystick(e)}} onPointerUp={stop} onPointerCancel={stop}><div className="stick"/></div>
    <button className="fight" onClick={onAttack}>🥊 Fight</button>
    <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Room</strong> {Object.keys(players).length} people here</div><div className="input">Type a message…</div></div>
    <div className="controls"><button>🎙️ Voice</button><button className={musicPlaying?"active":""} onClick={onToggleMusic}>🎵 Music</button><button>🎮 Games</button><button>💬 Chat</button></div>
  </div>;
}

export default function Home(){
  const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya"),[id]=useState(makeId),[players,setPlayers]=useState({}),[realtime,setRealtime]=useState(true),[musicPlaying,setMusicPlaying]=useState(false);
  const channelRef=useRef(null),localRef=useRef(null);
  const join=()=>{const p={id,name:name.trim()||"You",avatarId,x:0,y:0,z:1.4,rot:0,health:3,attacking:false,moving:false};localRef.current=p;setJoined(true)};
  useEffect(()=>{
    if(!joined)return;
    const supabase=getSupabase();
    if(!supabase){setRealtime(false);setPlayers(prev=>({...prev,[id]:localRef.current}));return;}
    const channel=supabase.channel("gc-hangout-main",{config:{broadcast:{self:false},presence:{key:id}}});
    channelRef.current=channel;
    const send=p=>channel.send({type:"broadcast",event:"player_state",payload:p});
    channel.on("broadcast",{event:"player_state"},({payload})=>payload?.id&&setPlayers(prev=>({...prev,[payload.id]:payload})));
    channel.on("broadcast",{event:"request_state"},()=>{if(localRef.current)send(localRef.current)});channel.on("broadcast",{event:"room_state"},({payload})=>{if(typeof payload?.musicPlaying==="boolean")setMusicPlaying(payload.musicPlaying)});channel.on("broadcast",{event:"request_room"},()=>channel.send({type:"broadcast",event:"room_state",payload:{musicPlaying}}));
    channel.on("broadcast",{event:"attack"},({payload})=>{
      if(!payload?.id)return;
      setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:true}}:prev);
      setTimeout(()=>setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:false}}:prev),350);
      if(payload.targetId===id&&localRef.current){
        const nextHealth=Math.max(0,(localRef.current.health||3)-1),next={...localRef.current,health:nextHealth};
        localRef.current=next;setPlayers(prev=>({...prev,[id]:next}));send(next);
        if(nextHealth===0)setTimeout(()=>{const respawn={...localRef.current,x:0,z:1.4,health:3,attacking:false};localRef.current=respawn;setPlayers(prev=>({...prev,[id]:respawn}));send(respawn)},900);
      }
    });
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"&&localRef.current){
        setPlayers(prev=>({...prev,[id]:localRef.current}));
        await channel.track({id,name:localRef.current.name,avatarId});
        send(localRef.current);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_state",payload:{id}}),250);setTimeout(()=>channel.send({type:"broadcast",event:"request_room",payload:{id}}),350);
      }
    });
    return()=>{channel.unsubscribe();channelRef.current=null};
  },[joined,id,avatarId]);
  const onMove=p=>{localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));if(channelRef.current)channelRef.current.send({type:"broadcast",event:"player_state",payload:p})};
  const toggleMusic=()=>{const next=!musicPlaying;setMusicPlaying(next);if(channelRef.current)channelRef.current.send({type:"broadcast",event:"room_state",payload:{musicPlaying:next}})};
 const onAttack=()=>{
    if(!localRef.current)return;
    const me=localRef.current,others=Object.values(players).filter(p=>p.id!==id);
    let target=null,best=99;
    for(const p of others){const d=Math.hypot(p.x-me.x,p.z-me.z);if(d<best){best=d;target=p}}
    const p={...me,attacking:true};localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));
    if(channelRef.current)channelRef.current.send({type:"broadcast",event:"attack",payload:{id,targetId:target&&best<1.6?target.id:null}});
    setTimeout(()=>{if(localRef.current){localRef.current={...localRef.current,attacking:false};setPlayers(prev=>({...prev,[id]:localRef.current}))}},350);
  };
  if(joined)return <Room local={localRef.current} players={players} onMove={onMove} onAttack={onAttack} realtime={realtime} musicPlaying={musicPlaying} onToggleMusic={toggleMusic}/>;
  return <main className="join"><div className="card"><div className="logo">🌙</div><h1>GC Hangout</h1><p>Choose a human and enter the shared room.</p><label>Your name<input value={name} onChange={e=>setName(e.target.value.slice(0,18))} placeholder="e.g. Rishi"/></label><div className="label">Choose your human</div><div className="avatars">{PRESETS.map((p,i)=><button className={avatarId===p.id?"selected":""} onClick={()=>setAvatarId(p.id)} key={p.id}><span>{i%3===0?"👩":i%3===1?"👨":"🧑"}</span><small>{p.label}</small></button>)}</div><button className="enter" onClick={join} disabled={!name.trim()}>Enter the room →</button><div className="note">Realtime multiplayer • free movement • fight</div></div></main>;
}
