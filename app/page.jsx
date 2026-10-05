"use client";
import {Canvas,useFrame} from "@react-three/fiber";
import {PerspectiveCamera,Text,RoundedBox,Environment} from "@react-three/drei";
import {useEffect,useMemo,useRef,useState} from "react";
import {supabase} from "../lib/supabase";

const PRESETS=[
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

function Hair({style,color}){
 if(style==="long")return <><mesh castShadow position={[0,1.36,-.02]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh><mesh castShadow position={[-.25,1.12,.02]} scale={[.7,1.25,.7]}><sphereGeometry args={[.2,18,14]}/><meshStandardMaterial color={color}/></mesh></>;
 if(style==="ponytail")return <><mesh castShadow position={[0,1.37,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[.28,1.28,-.08]} scale={[.65,1.15,.65]}><sphereGeometry args={[.18,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
 if(style==="bun")return <><mesh castShadow position={[0,1.38,0]}><sphereGeometry args={[.3,20,16]}/><meshStandardMaterial color={color}/></mesh><mesh castShadow position={[0,1.67,-.02]}><sphereGeometry args={[.16,16,12]}/><meshStandardMaterial color={color}/></mesh></>;
 return <mesh castShadow position={[0,1.38,0]} scale={[1,.72,1]}><sphereGeometry args={[.31,20,16]}/><meshStandardMaterial color={color} roughness={.9}/></mesh>;
}

function Human({player,me}){
 const ref=useRef(),p=PRESETS.find(x=>x.id===player.avatarId)||PRESETS[0];
 useFrame(({clock})=>{
  if(!ref.current)return;
  ref.current.rotation.y=player.rot||0;
  const bob=player.moving?Math.abs(Math.sin(clock.elapsedTime*9))*.035:0;
  ref.current.position.y=(player.y||0)+bob;
 });
 return <group ref={ref} position={[player.x||0,player.y||0,player.z||0]}>
  <mesh castShadow position={[0,.1,0]}><cylinderGeometry args={[.28,.33,.1,24]}/><meshStandardMaterial color={me?"#7c5cff":"#292633"}/></mesh>
  <RoundedBox castShadow args={[.48,.68,.32]} radius={.09} smoothness={5} position={[0,.62,0]}><meshStandardMaterial color={p.shirt} roughness={.82}/></RoundedBox>
  <mesh castShadow position={[-.16,.38,0]} rotation={[0,0,-.08]}><capsuleGeometry args={[.055,.42,8,12]}/><meshStandardMaterial color={p.shirt}/></mesh>
  <mesh castShadow position={[.16,.38,0]} rotation={[0,0,.08]}><capsuleGeometry args={[.055,.42,8,12]}/><meshStandardMaterial color={p.shirt}/></mesh>
  <mesh castShadow position={[-.13,.12,0]}><capsuleGeometry args={[.065,.3,8,12]}/><meshStandardMaterial color={p.pants}/></mesh>
  <mesh castShadow position={[.13,.12,0]}><capsuleGeometry args={[.065,.3,8,12]}/><meshStandardMaterial color={p.pants}/></mesh>
  <mesh castShadow position={[-.14,-.02,.04]} scale={[1.15,.45,1.35]}><sphereGeometry args={[.1,14,10]}/><meshStandardMaterial color="#17161a"/></mesh>
  <mesh castShadow position={[.14,-.02,.04]} scale={[1.15,.45,1.35]}><sphereGeometry args={[.1,14,10]}/><meshStandardMaterial color="#17161a"/></mesh>
  <mesh castShadow position={[0,1.16,0]}><sphereGeometry args={[.27,28,22]}/><meshStandardMaterial color={p.skin} roughness={.88}/></mesh>
  <Hair style={p.style} color={p.hair}/>
  <mesh position={[-.09,1.18,.24]}><sphereGeometry args={[.026,10,10]}/><meshStandardMaterial color="white"/></mesh>
  <mesh position={[.09,1.18,.24]}><sphereGeometry args={[.026,10,10]}/><meshStandardMaterial color="white"/></mesh>
  <mesh position={[-.09,1.18,.267]}><sphereGeometry args={[.01,8,8]}/><meshStandardMaterial color="#151515"/></mesh>
  <mesh position={[.09,1.18,.267]}><sphereGeometry args={[.01,8,8]}/><meshStandardMaterial color="#151515"/></mesh>
  <Text position={[0,1.82,0]} fontSize={.14} color={me?"#d4c9ff":"#f2edf5"} anchorX="center">{player.name}{me?" • you":""}</Text>
  {player.attacking&&<Text position={[0,2.02,0]} fontSize={.12} color="#ffd36b" anchorX="center">POW!</Text>}
 </group>
}

function Sofa({x,z,rot=0}){return <group position={[x,0,z]} rotation={[0,rot,0]}><RoundedBox castShadow args={[2.35,.5,.88]} radius={.13} smoothness={5} position={[0,.48,0]}><meshStandardMaterial color="#66535f" roughness={.9}/></RoundedBox><RoundedBox castShadow args={[2.35,1.05,.28]} radius={.1} smoothness={5} position={[0,1,-.34]}><meshStandardMaterial color="#735d69" roughness={.92}/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[-1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox><RoundedBox castShadow args={[.3,.98,.84]} radius={.09} smoothness={5} position={[1.02,.88,0]}><meshStandardMaterial color="#735d69"/></RoundedBox></group>}

function Plant({x,z,s=1}){return <group position={[x,0,z]} scale={s}><mesh castShadow position={[0,.25,0]}><cylinderGeometry args={[.24,.3,.5,22]}/><meshStandardMaterial color="#6b4734"/></mesh>{[[-.15,.72,0],[.15,.78,0],[-.24,.62,.08],[.24,.66,-.06],[0,.9,.03]].map((q,i)=><mesh key={i} castShadow position={q} scale={[1,.7,1]}><sphereGeometry args={[.2,14,10]}/><meshStandardMaterial color={i%2?0x347b57:0x4a9a68} roughness={1}/></mesh>)}</group>}

function Room({local,players,onMove,onAttack}){
 const [move,setMove]=useState({x:0,z:0}),moveRef=useRef(move),lastSend=useRef(0);
 moveRef.current=move;
 const posRef=useRef({...local});
 useEffect(()=>{const down=e=>{if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;const k=e.key.toLowerCase();if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;e.preventDefault();setMove(m=>({x:k==="a"||k==="arrowleft"?-1:k==="d"||k==="arrowright"?1:m.x,z:k==="w"||k==="arrowup"?-1:k==="s"||k==="arrowdown"?1:m.z}))};const up=e=>{const k=e.key.toLowerCase();if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;setMove(m=>({x:(k==="a"||k==="arrowleft"||k==="d"||k==="arrowright")?0:m.x,z:(k==="w"||k==="arrowup"||k==="s"||k==="arrowdown")?0:m.z}))};window.addEventListener("keydown",down);window.addEventListener("keyup",up);return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)}},[]);
 useFrame(({camera})=>{const m=moveRef.current,len=Math.hypot(m.x,m.z)||1;if(m.x||m.z){const speed=.09;posRef.current={...posRef.current,x:clamp(posRef.current.x+(m.x/len)*speed,-5.2,5.2),z:clamp(posRef.current.z+(m.z/len)*speed,-3.8,4.5),rot:Math.atan2(m.x,m.z),moving:true};const now=performance.now();if(now-lastSend.current>55){lastSend.current=now;onMove(posRef.current)}}else if(posRef.current.moving){posRef.current={...posRef.current,moving:false};onMove(posRef.current)}const t=posRef.current;camera.position.x+=(t.x-camera.position.x)*.12;camera.position.y+=(3.35-camera.position.y)*.12;camera.position.z+=((t.z+5.4)-camera.position.z)*.12;camera.lookAt(t.x,t.y+.9,t.z-1.15)});
 const joystick=e=>{const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2,n=Math.hypot(x,z)||1;setMove({x:clamp(x/55,-1,1),z:clamp(z/55,-1,1)});e.currentTarget.style.setProperty("--jx",clamp(x,-38,38)+"px");e.currentTarget.style.setProperty("--jz",clamp(z,-38,38)+"px")};
 const stop=e=>{setMove({x:0,z:0});e.currentTarget.style.setProperty("--jx","0px");e.currentTarget.style.setProperty("--jz","0px")};
 return <div className="room">
  <Canvas shadows dpr={[1,1.5]}><PerspectiveCamera makeDefault position={[0,3.35,7.8]} fov={58}/><color attach="background" args={["#0b0910"]}/><fog attach="fog" args={["#0b0910",11,22]}/><ambientLight intensity={1.45}/><directionalLight position={[3,8,4]} intensity={2.2} castShadow shadow-mapSize-width={2048} shadow-mapSize-height={2048}/><pointLight position={[0,4,-4]} intensity={8} distance={12} color="#7058ff"/><pointLight position={[-4,2,0]} intensity={4} distance={7} color="#ffab7d"/><pointLight position={[4,2,0]} intensity={4} distance={7} color="#6bd4ff"/><Environment preset="apartment"/><mesh receiveShadow rotation={[-Math.PI/2,0,0]}><planeGeometry args={[13,11]}/><meshStandardMaterial color="#211e29" roughness={.95}/></mesh><mesh position={[0,.02,-.2]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[3.2,64]}/><meshStandardMaterial color="#35303d" roughness={1}/></mesh><Sofa x={-2.5} z={-2.1} rot={.15}/><Sofa x={2.5} z={-2.1} rot={-.15}/><Sofa x={-4.65} z={1.3} rot={Math.PI/2}/><Sofa x={4.65} z={1.3} rot={-Math.PI/2}/><Plant x={-5.2} z={-3.9} s={1.15}/><Plant x={5.2} z={-3.9} s={1.15}/><Plant x={-5.35} z={3.5} s={.9}/><Plant x={5.35} z={3.5} s={.9}/><mesh castShadow position={[0,.45,.1]}><cylinderGeometry args={[1.35,1.35,.18,48]}/><meshStandardMaterial color="#6c5b50" roughness={.7}/></mesh><mesh castShadow position={[0,.05,.1]}><cylinderGeometry args={[.18,.28,.75,20]}/><meshStandardMaterial color="#302923"/></mesh><mesh position={[0,2.5,-4.9]}><boxGeometry args={[8.5,3.4,.12]}/><meshStandardMaterial emissive="#242052" emissiveIntensity={1.3} color="#39326f"/></mesh><Text position={[0,3.18,-4.82]} fontSize={.48} color="white" anchorX="center">GC HANGOUT</Text><Text position={[0,2.86,-4.82]} fontSize={.15} color="#d8d2e7" anchorX="center">OPEN LOUNGE</Text><mesh position={[0,1.45,-4.7]}><boxGeometry args={[4.7,1.9,.18]}/><meshStandardMaterial color="#09090d"/></mesh><mesh position={[0,1.48,-4.58]}><boxGeometry args={[4.2,1.58,.03]}/><meshStandardMaterial emissive="#121522" color="#101017"/></mesh>{Object.values(players).map(p=><Human key={p.id} player={p} me={p.id===local.id}/>)}</Canvas>
  <div className="topbar"><div><b>🌙 GC HANGOUT</b><span> • Open room</span></div><div className="online">● {Object.keys(players).length} online</div></div>
  <div className="hint">WASD / joystick • walk anywhere • FIGHT nearby</div>
  <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystick(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))joystick(e)}} onPointerUp={stop} onPointerCancel={stop}><div className="stick"/></div>
  <button className="fight" onClick={onAttack}>🥊 Fight</button>
  <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Room</strong> {Object.keys(players).length} people here</div><div className="input">Type a message…</div></div>
  <div className="controls"><button>🎙️ Voice</button><button>🎵 Music</button><button>🎮 Games</button><button>💬 Chat</button></div>
 </div>
}

export default function Home(){
 const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya"),[id]=useState(makeId),[players,setPlayers]=useState({});
 const channelRef=useRef(null),localRef=useRef(null);
 const join=()=>{const p={id,name:name.trim()||"You",avatarId,x:0,y:0,z:2.5,rot:0,health:3,attacking:false,moving:false};localRef.current=p;setJoined(true)};
 useEffect(()=>{if(!joined)return;const channel=supabase.channel("gc-hangout-main",{config:{broadcast:{self:false},presence:{key:id}}});channelRef.current=channel;
 const send=p=>channel.send({type:"broadcast",event:"player_state",payload:p});
 channel.on("broadcast",{event:"player_state"},({payload})=>setPlayers(prev=>({...prev,[payload.id]:payload})));
 channel.on("broadcast",{event:"request_state"},()=>{if(localRef.current)send(localRef.current)});
 channel.on("broadcast",{event:"attack"},({payload})=>{setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:true}}:prev);setTimeout(()=>setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:false}}:prev),350);if(payload.targetId===id&&localRef.current){const nextHealth=Math.max(0,(localRef.current.health||3)-1);const next={...localRef.current,health:nextHealth};localRef.current=next;setPlayers(prev=>({...prev,[id]:next}));channel.send({type:"broadcast",event:"player_state",payload:next});if(nextHealth===0){setTimeout(()=>{const respawn={...localRef.current,x:0,z:2.5,health:3,attacking:false};localRef.current=respawn;setPlayers(prev=>({...prev,[id]:respawn}));channel.send({type:"broadcast",event:"player_state",payload:respawn})},900)}}});
 channel.subscribe(async status=>{if(status==="SUBSCRIBED"){if(localRef.current){setPlayers(prev=>({...prev,[id]:localRef.current}));await channel.track({id,name:localRef.current.name,avatarId});send(localRef.current);setTimeout(()=>channel.send({type:"broadcast",event:"request_state",payload:{id}}),300)}}});
 return()=>{channel.unsubscribe();channelRef.current=null}},[joined,id]);
 const onMove=p=>{localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));if(channelRef.current)channelRef.current.send({type:"broadcast",event:"player_state",payload:p})};
 const onAttack=()=>{if(!localRef.current||!channelRef.current)return;const me=localRef.current,others=Object.values(players).filter(p=>p.id!==id);let target=null,best=99;for(const p of others){const d=Math.hypot(p.x-me.x,p.z-me.z);if(d<best){best=d;target=p}}const p={...me,attacking:true};localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));channelRef.current.send({type:"broadcast",event:"attack",payload:{id,targetId:target&&best<1.6?target.id:null}});setTimeout(()=>{if(localRef.current){localRef.current={...localRef.current,attacking:false};setPlayers(prev=>({...prev,[id]:localRef.current}))}},350)};
 if(joined)return <Room local={localRef.current} players={players} onMove={onMove} onAttack={onAttack}/>;
 return <main className="join"><div className="card"><div className="logo">🌙</div><h1>GC Hangout</h1><p>Choose a human and enter the shared room.</p><label>Your name<input value={name} onChange={e=>setName(e.target.value.slice(0,18))} placeholder="e.g. Rishi"/></label><div className="label">Choose your human</div><div className="avatars">{PRESETS.map((p,i)=><button className={avatarId===p.id?"selected":""} onClick={()=>setAvatarId(p.id)} key={p.id}><span>{i%3===0?"👩":i%3===1?"👨":"🧑"}</span><small>{p.label}</small></button>)}</div><button className="enter" onClick={join} disabled={!name.trim()}>Enter the room →</button><div className="note">Realtime multiplayer • free movement • fight</div></div></main>
}