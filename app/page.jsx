"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { PerspectiveCamera, Text, RoundedBox, Environment, ContactShadows } from "@react-three/drei";
import { useEffect, useRef, useState } from "react";
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
const BOXES=[{x:-2.5,z:-2.1,rx:1.4,rz:.6},{x:2.5,z:-2.1,rx:1.4,rz:.6},{x:-4.65,z:1.3,rx:.65,rz:1.2},{x:4.65,z:1.3,rx:.65,rz:1.2},{x:-2.8,z:1.7,rx:1.5,rz:.72},{x:3.45,z:1.7,rx:.95,rz:.6},{x:-4.25,z:-1.55,rx:.5,rz:.55}];
const CIRCLES=[{x:0,z:-.1,r:.9}];
const blocked=(x,z,r=.28)=>{if(x<-6.0+r||x>6.0-r||z<-4.8+r||z>5.0-r)return true;for(const b of BOXES){const qx=clamp(x,b.x-b.rx,b.x+b.rx),qz=clamp(z,b.z-b.rz,b.z+b.rz);if(Math.hypot(x-qx,z-qz)<r)return true}for(const q of CIRCLES)if(Math.hypot(x-q.x,z-q.z)<q.r+r)return true;return false};
const tryMove=(x,z,dx,dz)=>{const nx=x+dx,nz=z+dz;if(!blocked(nx,nz))return{x:nx,z:nz};if(!blocked(nx,z))return{x:nx,z};if(!blocked(x,nz))return{x,z:nz};return{x,z}};

function Hair({style,color}){
  if(style==="long") return <><mesh castShadow position={[0,1.36,-.02]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh><mesh castShadow position={[-.25,1.12,.02]} scale={[.7,1.25,.7]}><sphereGeometry args={[.2,18,14]}/><meshStandardMaterial color={color}/></mesh></>;
  if(style==="ponytail") return <><mesh castShadow position={[0,1.37,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[.28,1.28,-.08]} scale={[.65,1.15,.65]}><sphereGeometry args={[.18,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
  if(style==="bun") return <><mesh castShadow position={[0,1.38,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[0,1.67,-.02]}><sphereGeometry args={[.16,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
  return <mesh castShadow position={[0,1.38,0]} scale={[1,.72,1]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;
}

function Human({player,me}){
 const ref=useRef(),la=useRef(),ra=useRef(),ll=useRef(),rl=useRef();
 const p=PRESETS.find(x=>x.id===player.avatarId)||PRESETS[0];
 useFrame(({clock})=>{
  if(!ref.current)return;
  const target=player.rot||0;
  ref.current.rotation.y+=Math.atan2(Math.sin(target-ref.current.rotation.y),Math.cos(target-ref.current.rotation.y))*.2;
  ref.current.position.x=player.x||0;ref.current.position.z=player.z||0;
  const walk=player.moving?Math.sin(clock.elapsedTime*10):0;
  ref.current.position.y=(player.y||0)+Math.abs(walk)*.025;
  if(la.current){la.current.rotation.z=-.08+walk*.16;ra.current.rotation.z=.08-walk*.16;ll.current.rotation.x=-walk*.15;rl.current.rotation.x=walk*.15}
 });
 return <group ref={ref} position={[player.x||0,player.y||0,player.z||0]}>
  <mesh castShadow position={[0,.11,0]}><cylinderGeometry args={[.29,.34,.08,28]}/><meshStandardMaterial color={me?"#7358ff":"#25232c"} roughness={.7}/></mesh>
  <mesh castShadow position={[0,.67,0]} scale={[.9,1,.72]}><capsuleGeometry args={[.23,.45,8,16]}/><meshStandardMaterial color={p.shirt} roughness={.82}/></mesh>
  <group ref={la} position={[-.28,.72,0]}><mesh castShadow position={[0,-.2,0]}><capsuleGeometry args={[.065,.34,8,12]}/><meshStandardMaterial color={p.shirt}/></mesh><mesh castShadow position={[0,-.43,0]}><sphereGeometry args={[.07,12,10]}/><meshStandardMaterial color={p.skin}/></mesh></group>
  <group ref={ra} position={[.28,.72,0]}><mesh castShadow position={[0,-.2,0]}><capsuleGeometry args={[.065,.34,8,12]}/><meshStandardMaterial color={p.shirt}/></mesh><mesh castShadow position={[0,-.43,0]}><sphereGeometry args={[.07,12,10]}/><meshStandardMaterial color={p.skin}/></mesh></group>
  <group ref={ll} position={[-.12,.28,0]}><mesh castShadow position={[0,-.16,0]}><capsuleGeometry args={[.075,.3,8,12]}/><meshStandardMaterial color={p.pants}/></mesh><mesh castShadow position={[0,-.34,.08]} scale={[1.1,.48,1.45]}><sphereGeometry args={[.1,14,10]}/><meshStandardMaterial color="#17171b"/></mesh></group>
  <group ref={rl} position={[.12,.28,0]}><mesh castShadow position={[0,-.16,0]}><capsuleGeometry args={[.075,.3,8,12]}/><meshStandardMaterial color={p.pants}/></mesh><mesh castShadow position={[0,-.34,.08]} scale={[1.1,.48,1.45]}><sphereGeometry args={[.1,14,10]}/><meshStandardMaterial color="#17171b"/></mesh></group>
  <mesh castShadow position={[0,1.18,0]}><sphereGeometry args={[.275,28,22]}/><meshStandardMaterial color={p.skin} roughness={.88}/></mesh>
  <mesh castShadow position={[0,1.08,.25]} scale={[.48,.2,.7]}><sphereGeometry args={[.16,16,12]}/><meshStandardMaterial color={p.skin}/></mesh>
  <mesh castShadow position={[-.285,1.18,0]}><sphereGeometry args={[.045,14,10]}/><meshStandardMaterial color={p.skin}/></mesh><mesh castShadow position={[.285,1.18,0]}><sphereGeometry args={[.045,14,10]}/><meshStandardMaterial color={p.skin}/></mesh>
  <Hair style={p.style} color={p.hair}/>
  <mesh position={[-.09,1.2,.255]}><sphereGeometry args={[.028,10,10]}/><meshStandardMaterial color="white"/></mesh><mesh position={[.09,1.2,.255]}><sphereGeometry args={[.028,10,10]}/><meshStandardMaterial color="white"/></mesh>
  <mesh position={[-.09,1.2,.28]}><sphereGeometry args={[.011,8,8]}/><meshStandardMaterial color="#151515"/></mesh><mesh position={[.09,1.2,.28]}><sphereGeometry args={[.011,8,8]}/><meshStandardMaterial color="#151515"/></mesh>
  <Text position={[0,1.86,0]} fontSize={.14} color={me?"#d7ccff":"#f4eef8"} anchorX="center">{player.name}{me?" • you":""}</Text>
  {player.attacking&&<Text position={[0,2.08,0]} fontSize={.13} color="#ffd36b" anchorX="center">POW!</Text>}
 </group>
}

function Sofa({x,z,rot=0}){return <group position={[x,0,z]} rotation={[0,rot,0]}><RoundedBox castShadow args={[2.35,.5,.88]} radius={.13} smoothness={5} position={[0,.48,0]}><meshStandardMaterial color="#66535f" roughness={.9}/></RoundedBox><RoundedBox castShadow args={[2.35,1.05,.28]} radius={.1} smoothness={5} position={[0,1,-.34]}><meshStandardMaterial color="#735d69" roughness={.92}/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[-1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox></group>}

function Plant({x,z,s=1}){return <group position={[x,0,z]} scale={s}><mesh castShadow position={[0,.25,0]}><cylinderGeometry args={[.24,.3,.5,22]}/><meshStandardMaterial color="#6b4734"/></mesh>{[[-.15,.72,0],[.15,.78,0],[-.24,.62,.08],[.24,.66,-.06],[0,.9,.03]].map((q,i)=><mesh key={i} castShadow position={q} scale={[1,.7,1]}><sphereGeometry args={[.2,14,10]}/><meshStandardMaterial color={i%2?0x347b57:0x4a9a68} roughness={1}/></mesh>)}</group>}

function PlayerController({posRef,moveRef,onMove,viewRef}){const lastSend=useRef(0),velocity=useRef({x:0,z:0});useFrame(({camera},dt)=>{const d=Math.min(dt,.05),m=moveRef.current;const tx=m.x*2.8,tz=m.z*2.8;velocity.current.x+=(tx-velocity.current.x)*Math.min(1,(m.x||m.z?10:16)*d);velocity.current.z+=(tz-velocity.current.z)*Math.min(1,(m.x||m.z?10:16)*d);if(!m.x&&!m.z){velocity.current.x*=Math.max(0,1-10*d);velocity.current.z*=Math.max(0,1-10*d)}const speed=Math.hypot(velocity.current.x,velocity.current.z);if(speed>.03){const step=tryMove(posRef.current.x,posRef.current.z,velocity.current.x*d,velocity.current.z*d);posRef.current={...posRef.current,...step,rot:Math.atan2(velocity.current.x,velocity.current.z),moving:speed>.18};const now=performance.now();if(now-lastSend.current>50){lastSend.current=now;onMove(posRef.current)}}else if(posRef.current.moving){posRef.current={...posRef.current,moving:false};onMove(posRef.current)}const t=posRef.current,v=viewRef.current,dist=v.distance;const camX=t.x+Math.sin(v.yaw)*dist,camZ=t.z+Math.cos(v.yaw)*dist,camY=2.15+Math.cos(v.pitch)*1.25+Math.sin(v.pitch)*2.2;camera.position.x+=(camX-camera.position.x)*Math.min(1,7*d);camera.position.y+=(camY-camera.position.y)*Math.min(1,7*d);camera.position.z+=(camZ-camera.position.z)*Math.min(1,7*d);camera.lookAt(t.x,t.y+.9,t.z)});return null}

function Speaker({x,z,playing}){const ref=useRef();useFrame(({clock})=>{if(ref.current)ref.current.scale.setScalar(1+(playing?.04+.03*Math.sin(clock.elapsedTime*10):0))});return <group ref={ref} position={[x,.65,z]}><RoundedBox castShadow args={[.58,1.2,.4]} radius={.06} smoothness={4}><meshStandardMaterial color="#121117" roughness={.78}/></RoundedBox><mesh position={[0,.12,.21]}><circleGeometry args={[.16,24]}/><meshStandardMaterial color="#292631" emissive={playing?"#8064ff":"#15141a"} emissiveIntensity={playing?2:.2}/></mesh><mesh position={[0,-.25,.21]}><circleGeometry args={[.11,24]}/><meshStandardMaterial color="#292631"/></mesh></group>}
function MusicTV({playing}){const ref=useRef();useFrame(({clock})=>{if(ref.current)ref.current.material.emissiveIntensity=playing?1.15+.25*Math.sin(clock.elapsedTime*4):.35});return <mesh ref={ref} position={[0,1.48,-4.56]}><boxGeometry args={[4.18,1.58,.035]}/><meshStandardMaterial color={playing?"#17112d":"#0c0e14"} emissive={playing?"#4b3599":"#11131b"} emissiveIntensity={playing?1:.35}/></mesh>}
function PoolTable(){return <group position={[-2.8,.35,1.7]}><RoundedBox castShadow args={[3,.3,1.45]} radius={.08} smoothness={4}><meshStandardMaterial color="#2b201c"/></RoundedBox><RoundedBox castShadow args={[2.65,.08,1.1]} radius={.04} smoothness={3} position={[0,.2,0]}><meshStandardMaterial color="#174f3b"/></RoundedBox>{[[-1.25,.25,-.5],[1.25,.25,-.5],[-1.25,.25,.5],[1.25,.25,.5]].map((q,i)=><mesh key={i} position={q}><cylinderGeometry args={[.07,.07,.1,16]}/><meshStandardMaterial color="#08080a"/></mesh>)}{[[0,.28,0],[.42,.28,.12],[-.35,.28,-.18],[.28,.28,-.3]].map((q,i)=><mesh key={i} position={q}><sphereGeometry args={[.07,16,12]}/><meshStandardMaterial color={["#fff","#e6a33d","#d74e59","#4d83d8"][i]}/></mesh>)}</group>}
function Kitchen(){return <group position={[3.45,0,1.7]}><RoundedBox castShadow args={[1.9,.9,1.15]} radius={.08} smoothness={5} position={[0,.55,0]}><meshStandardMaterial color="#403a41" roughness={.65}/></RoundedBox><RoundedBox castShadow args={[2.02,.12,1.25]} radius={.04} smoothness={4} position={[0,1.03,0]}><meshStandardMaterial color="#9a9188" roughness={.4}/></RoundedBox><mesh position={[-.38,1.11,0]}><cylinderGeometry args={[.22,.22,.025,32]}/><meshStandardMaterial color="#151419"/></mesh><mesh position={[.38,1.11,0]}><cylinderGeometry args={[.22,.22,.025,32]}/><meshStandardMaterial color="#151419"/></mesh><mesh position={[.72,1.18,-.2]}><cylinderGeometry args={[.14,.1,.24,24]}/><meshStandardMaterial color="#d6d0c5"/></mesh></group>}
function Arcade(){return <group position={[-4.25,.8,-1.55]}><RoundedBox castShadow args={[.85,1.65,.6]} radius={.08} smoothness={5}><meshStandardMaterial color="#20202a"/></RoundedBox><mesh position={[0,.55,.32]} rotation={[-.15,0,0]}><boxGeometry args={[.62,.46,.035]}/><meshStandardMaterial color="#14111d" emissive="#6448cc" emissiveIntensity={1.5}/></mesh><mesh position={[0,.05,.33]}><cylinderGeometry args={[.12,.12,.04,20]}/><meshStandardMaterial color="#d8c44f"/></mesh><mesh position={[.23,.05,.33]}><cylinderGeometry args={[.07,.07,.04,20]}/><meshStandardMaterial color="#d85d66"/></mesh></group>}

function Room({local,players,onMove,onAttack,realtime,musicPlaying,onToggleMusic}){
  const [move,setMove]=useState({x:0,z:0});
  const moveRef=useRef(move); moveRef.current=move;
  const posRef=useRef({...local});
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
    <Canvas shadows dpr={[1,1.5]}>
      <PerspectiveCamera makeDefault position={[0,3.35,7.8]} fov={58}/>
      <PlayerController posRef={posRef} moveRef={moveRef} onMove={onMove}/>
      <color attach="background" args={["#0b0910"]}/><fog attach="fog" args={["#0b0910",11,22]}/>
      <ambientLight intensity={1.05}/><directionalLight position={[3,8,4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}/>
      <pointLight position={[0,4,-4]} intensity={4.5} distance={12} color="#806cff"/><pointLight position={[-4,3,1]} intensity={2.5} distance={8} color="#ffd0a6"/><pointLight position={[4,3,1]} intensity={2.5} distance={8} color="#9bdcff"/>
      <Environment preset="apartment"/>
      <mesh receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,11]}/><meshStandardMaterial color="#211e29" roughness={.95}/></mesh>
      <mesh position={[0,.02,-.2]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[3.2,64]}/><meshStandardMaterial color="#35303d" roughness={1}/></mesh>
      <Sofa x={-3.45} z={-2.65} rot={.05}/><Sofa x={3.45} z={-2.65} rot={-.05}/><Sofa x={-5.25} z={1.55} rot={Math.PI/2}/><Sofa x={5.25} z={1.55} rot={-Math.PI/2}/>
      <Plant x={-5.65} z={-3.9} s={1.05}/><Plant x={5.65} z={-3.9} s={1.05}/><Plant x={-5.7} z={3.9} s={.85}/><Plant x={5.7} z={3.9} s={.85}/><PoolTable/><Kitchen/><Arcade/>
      <mesh castShadow position={[0,.45,.35]}><cylinderGeometry args={[1.05,1.05,.18,48]}/><meshStandardMaterial color="#6c5b50" roughness={.7}/></mesh>
      <mesh castShadow position={[0,.05,.35]}><cylinderGeometry args={[.18,.28,.75,20]}/><meshStandardMaterial color="#302923"/></mesh>
      <mesh position={[0,2.5,-4.9]}><boxGeometry args={[8.5,3.4,.12]}/><meshStandardMaterial emissive="#242052" emissiveIntensity={1.3} color="#39326f"/></mesh>
      <Text position={[0,3.18,-4.82]} fontSize={.48} color="white" anchorX="center">GC HANGOUT</Text>
      <Text position={[0,2.86,-4.82]} fontSize={.15} color="#d8d2e7" anchorX="center">OPEN LOUNGE</Text>
      <mesh position={[0,1.45,-4.7]}><boxGeometry args={[4.7,1.9,.18]}/><meshStandardMaterial color="#09090d"/></mesh>
      <MusicTV playing={musicPlaying}/><Text position={[0,2.16,-4.48]} fontSize={.15} color={musicPlaying?"#e9ddff":"#81798d"} anchorX="center">{musicPlaying?"♪ NOW PLAYING • GC MIX":"TV • idle"}</Text><Speaker x={-2.85} z={-4.25} playing={musicPlaying}/><Speaker x={2.85} z={-4.25} playing={musicPlaying}/>
      <ContactShadows position={[0,0,0]} opacity={.32} scale={13} blur={2.2} far={5}/>{Object.values(players).map(p=><Human key={p.id} player={p} me={p.id===local.id}/>)}
    </Canvas>
    <div className="topbar"><div><b>🌙 GC HANGOUT</b><span> • Open room</span></div><div className="online">● {Object.keys(players).length} online{!realtime?" • local mode":""}</div></div>
    <div className="hint">Drag to look • pinch/scroll to zoom • joystick to walk</div><div className="status">{musicPlaying?"🎵 GC MIX is playing on the TV + speakers":"TV is idle • tap Music to start the room"}</div>
    <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystick(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))joystick(e)}} onPointerUp={stop} onPointerCancel={stop}><div className="stick"/></div>
    <button className="fight" onClick={onAttack}>🥊 Fight</button>
    <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Room</strong> {Object.keys(players).length} people here</div><div className="input">Type a message…</div></div>
    <div className="controls"><button>🎙️ Voice</button><button className={musicPlaying?"active":""} onClick={onToggleMusic}>🎵 Music</button><button>🎮 Games</button><button>💬 Chat</button></div>
  </div>;
}

export default function Home(){
  const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya"),[id]=useState(makeId),[players,setPlayers]=useState({}),[realtime,setRealtime]=useState(true),[musicPlaying,setMusicPlaying]=useState(false);
  const channelRef=useRef(null),localRef=useRef(null);
  const join=()=>{const p={id,name:name.trim()||"You",avatarId,x:0,y:0,z:3.8,rot:0,health:3,attacking:false,moving:false};localRef.current=p;setJoined(true)};
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
        if(nextHealth===0)setTimeout(()=>{const respawn={...localRef.current,x:0,z:3.8,health:3,attacking:false};localRef.current=respawn;setPlayers(prev=>({...prev,[id]:respawn}));send(respawn)},900);
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
