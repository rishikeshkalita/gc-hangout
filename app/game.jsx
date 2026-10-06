"use client";
import { Canvas, useFrame } from "@react-three/fiber";
import { Physics, RigidBody, CuboidCollider, BallCollider } from "@react-three/rapier";
import { Ecctrl } from "ecctrl";
import React from "react";
import {
  PerspectiveCamera,
  Text,
  RoundedBox,
  Environment,
  ContactShadows,
  useGLTF,
  useAnimations,
} from "@react-three/drei";
import * as SkeletonUtils from "three/examples/jsm/utils/SkeletonUtils.js";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { ensureAnonymousSession, getSupabase } from "../lib/supabase";
import { VoiceMesh } from "../lib/voice";

const PRESETS = [
  {id:"maya",label:"Maya"}, {id:"noah",label:"Noah"}, {id:"riya",label:"Riya"},
  {id:"aarav",label:"Aarav"}, {id:"zoe",label:"Zoe"}, {id:"sam",label:"Sam"},
  {id:"kai",label:"Kai"}, {id:"rihan",label:"Rihan"}
];

const HUMAN_URL="https://cdn.3dassets.dev/assets/32901/v1/model.glb";
useGLTF.preload(HUMAN_URL);
const FOOTBALL_URL="https://cdn.3dassets.dev/assets/19091/v1/model.glb";
useGLTF.preload(FOOTBALL_URL);
const HALL_HALF_X=15, HALL_HALF_Z=10, PLAYER_RADIUS=.34;
const TRACK={title:"GC After Hours",artist:"GC Radio",album:"Community Mix"};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const makeId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
const PLANT_ASSETS={
  palm:"https://cdn.3dassets.dev/assets/38577/v1/model.glb",
  treeFern:"https://cdn.3dassets.dev/assets/38578/v1/model.glb",
  banana:"https://cdn.3dassets.dev/assets/38579/v1/model.glb",
  cycad:"https://cdn.3dassets.dev/assets/38581/v1/model.glb"
};
useGLTF.preload(PLANT_ASSETS.palm);
useGLTF.preload(PLANT_ASSETS.treeFern);
useGLTF.preload(PLANT_ASSETS.banana);
useGLTF.preload(PLANT_ASSETS.cycad);
const FURNITURE={
 sofa:"https://cdn.3dassets.dev/assets/26141/v1/model.glb",
 armchair:"https://cdn.3dassets.dev/assets/38780/v1/model.glb",
 diningChair:"https://cdn.3dassets.dev/assets/38785/v1/model.glb",
 coffee:"https://cdn.3dassets.dev/assets/38790/v1/model.glb",
 diningTable:"https://cdn.3dassets.dev/assets/38791/v1/model.glb",
 bed:"https://cdn.3dassets.dev/assets/38770/v1/model.glb",
 lamp:"https://cdn.3dassets.dev/assets/38797/v1/model.glb"
};

const SEATS=[
 ...[[-.62],[0],[.62]].map(([x],i)=>({
   id:"sofa-n-"+i,label:"Sit on sofa",type:"seat",finalAction:"sit",
   position:[-10+x,0,-6.88],standPosition:[-10+x,0,-6.40],approachPosition:[-10+x,0,-6.40],
   rotation:0,seatY:-.48,poseType:"sofa"
 })),
 ...[[-.62],[0],[.62]].map(([x],i)=>({
   id:"sofa-s-"+i,label:"Sit on sofa",type:"seat",finalAction:"sit",
   position:[-10+x,0,-4.02],standPosition:[-10+x,0,-4.92],approachPosition:[-10+x,0,-4.92],
   rotation:Math.PI,seatY:-.48,poseType:"sofa"
 })),
 ...[[-.62],[0],[.62]].map(([z],i)=>({
   id:"sofa-w-"+i,label:"Sit on sofa",type:"seat",finalAction:"sit",
   position:[-12.55,0,-5.45+z],standPosition:[-11.70,0,-5.45+z],approachPosition:[-11.70,0,-5.45+z],
   rotation:-Math.PI/2,seatY:-.48,poseType:"sofa"
 })),
 ...[[-.62],[0],[.62]].map(([z],i)=>({
   id:"sofa-e-"+i,label:"Sit on sofa",type:"seat",finalAction:"sit",
   position:[-7.45,0,-5.45+z],standPosition:[-8.30,0,-5.45+z],approachPosition:[-8.30,0,-5.45+z],
   rotation:Math.PI/2,seatY:-.48,poseType:"sofa"
 })),
 ...[[-1.45,-1],[0,-1],[1.45,-1],[-1.45,1],[0,1],[1.45,1]].map(([x,side],i)=>({
   id:"dining-seat-"+i,label:"Sit at table",type:"seat",finalAction:"sit",
   position:[10+x,0,5.8+(side<0?-1.82:1.82)],
   standPosition:[10+x,0,5.8+(side<0?-1.35:1.35)],
   approachPosition:[10+x,0,5.8+(side<0?-1.35:1.35)],
   rotation:side<0?0:Math.PI,seatY:-.08,poseType:"chair"
 }))
];
const BEDS=[
 {id:"bed-a",label:"Sleep",type:"bed",finalAction:"sleep",position:[8.7,0,-6.2],rotation:Math.PI/2,seatY:.02,poseType:"bed"},
 {id:"bed-b",label:"Sleep",type:"bed",finalAction:"sleep",position:[12.2,0,-6.2],rotation:Math.PI/2,seatY:.02,poseType:"bed"}
];
const FOOD_ASSETS={
 burgerTray:"https://cdn.3dassets.dev/assets/34314/v1/model.glb",
 snackBasket:"https://cdn.3dassets.dev/assets/33873/v1/model.glb",
 sodaCan:"https://cdn.3dassets.dev/assets/24445/v1/model.glb",
 waterBottle:"https://cdn.3dassets.dev/assets/24444/v1/model.glb",
 chocolate:"https://cdn.3dassets.dev/assets/24429/v1/model.glb"
};
const SNACKS=[
 {id:"burger-tray",name:"Burger & chips",kind:"burgerTray",position:[9.35,1.55,5.8],action:"eat",label:"Eat burger & chips"},
 {id:"snack-basket",name:"Fries",kind:"snackBasket",position:[10.65,1.52,5.8],action:"eat",label:"Eat fries"},
 {id:"soda",name:"Soda",kind:"sodaCan",position:[9.0,1.50,5.55],action:"drink",label:"Drink soda"},
 {id:"water",name:"Water",kind:"waterBottle",position:[11.0,1.52,5.55],action:"drink",label:"Drink water"},
 {id:"chocolate",name:"Chocolate",kind:"chocolate",position:[-9.65,.72,-5.55],action:"eat",label:"Eat chocolate"},
 {id:"fries-2",name:"Fries",kind:"snackBasket",position:[-10.35,.82,-5.55],action:"eat",label:"Eat fries"},
 {id:"soda-2",name:"Soda",kind:"sodaCan",position:[-9.05,.82,-5.55],action:"drink",label:"Drink soda"},
 {id:"water-2",name:"Water",kind:"waterBottle",position:[-10.95,.84,-5.55],action:"drink",label:"Drink water"}
];

const INTERACTABLES=[ ...SEATS, ...BEDS,
 {id:"tv",label:"Watch TV",type:"tv",position:[0,0,-7.25],rotation:0},
 {id:"music-system",label:"Use music system",type:"music",position:[4.7,0,-7.55],rotation:0}
];
function RealFurniture({url,position=[0,0,0],rotation=0,scale=1}){
 const gltf=useGLTF(url);
 const scene=useMemo(()=>{const s=SkeletonUtils.clone(gltf.scene);s.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return s},[gltf.scene]);
 return <primitive object={scene} position={position} rotation={[0,rotation,0]} scale={scale}/>;
}


const OBSTACLES=[
  {x:-10,z:-7.28,rx:1.14,rz:.62,vault:false,name:"livingSofaNorth"},
  {x:-10,z:-3.62,rx:1.14,rz:.62,vault:false,name:"livingSofaSouth"},
  {x:-12.58,z:-5.45,rx:.62,rz:1.14,vault:false,name:"livingSofaWest"},
  {x:-7.42,z:-5.45,rx:.62,rz:1.14,vault:false,name:"livingSofaEast"},
  {x:-10,z:-5.45,rx:.62,rz:.38,vault:true,name:"livingTable"},
  {x:0,z:-8.95,rx:5.2,rz:.72,vault:false,name:"tv"},
  {x:9.5,z:-6.7,rx:2.6,rz:1.15,vault:true,name:"rest"},
  {x:10.3,z:5.9,rx:1.25,rz:1.0,vault:true,name:"dining"},
  {x:13.15,z:1.0,rx:1.0,rz:3.0,vault:false,name:"kitchen"},
  {x:-12.8,z:4.9,rx:1.3,rz:1.5,vault:true,name:"social"},
  {x:0,z:7.9,rx:4.5,rz:.65,vault:false,name:"backDecor"}
];

const blocked=(x,z,r=PLAYER_RADIUS)=>{
  if(x<-HALL_HALF_X+r||x>HALL_HALF_X-r||z<-HALL_HALF_Z+r||z>HALL_HALF_Z-r)return true;
  return OBSTACLES.some(b=>{
    const qx=clamp(x,b.x-b.rx,b.x+b.rx),qz=clamp(z,b.z-b.rz,b.z+b.rz);
    return Math.hypot(x-qx,z-qz)<r;
  });
};
const lineClear=(ax,az,bx,bz)=>{
  const steps=10;
  for(let i=1;i<steps;i++){
    const t=i/steps,x=ax+(bx-ax)*t,z=az+(bz-az)*t;
    if(blocked(x,z,.12))return false;
  }
  return true;
};
const tryMove=(x,z,dx,dz)=>{
  const nx=x+dx,nz=z+dz;
  if(!blocked(nx,nz))return{x:nx,z:nz,hop:false};
  if(Math.abs(dx)>.0001&&!blocked(x+dx,z))return{x:x+dx,z,hop:false};
  if(Math.abs(dz)>.0001&&!blocked(x,z+dz))return{x,z:z+dz,hop:false};
  for(const side of [[-.12,0],[.12,0],[0,-.12],[0,.12]]){
    if(!blocked(x+side[0],z+side[1]))return{x:x+side[0],z:z+side[1],hop:false};
  }
  return{x,z,hop:false};
};

function AssetBoundary({children,fallback}) {
  return <ErrorBoundary fallback={fallback}>{children}</ErrorBoundary>;
}
class ErrorBoundary extends React.Component {
  constructor(p){super(p);this.state={failed:false}}
  static getDerivedStateFromError(){return{failed:true}}
  componentDidCatch(e){console.error("3D asset error",e)}
  render(){return this.state.failed?this.props.fallback:this.props.children}
}

function SafeFurniture(props){return <AssetBoundary fallback={null}><RealFurniture {...props}/></AssetBoundary>}
function Sofa({position=[0,0,0],rotation=0}){return <SafeFurniture url={FURNITURE.sofa} position={position} rotation={rotation} scale={1.0}/>} 
function Chair({position=[0,0,0],rotation=0}){return <SafeFurniture url={FURNITURE.armchair} position={position} rotation={rotation} scale={1.18}/>}
function CoffeeTable({x,z}){return <SafeFurniture url={FURNITURE.coffee} position={[x,0,z]} scale={1.67}/>}
function DiningTable(){return <group position={[10,0,5.8]}><SafeFurniture url={FURNITURE.diningTable} scale={2.2}/>{[[-1.45,0,-1.9],[0,0,-1.9],[1.45,0,-1.9],[-1.45,0,1.9],[0,0,1.9],[1.45,0,1.9]].map((p,i)=><SafeFurniture key={i} url={FURNITURE.diningChair} position={[p[0],0,p[2]]} rotation={p[2]<0?0:Math.PI} scale={1.7}/>)}</group>}
function Bed({x,z,rotation=0}){return <SafeFurniture url={FURNITURE.bed} position={[x,0,z]} rotation={rotation} scale={1.65}/>}

function SnackUnsafe({item,state,players}){
  const ref=useRef();
  const holder=state?.heldBy?players[state.heldBy]:null;
  const consumed=!!state?.consumed;
  const gltf=useGLTF(FOOD_ASSETS[item.kind]);
  const scene=useMemo(()=>{
    const s=SkeletonUtils.clone(gltf.scene);    s.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    return s;  },[gltf.scene]);
  useFrame((_,dt)=>{
    if(!ref.current)return;
    const target=holder?[holder.x,.98,holder.z]:item.position;
    const a=1-Math.exp(-16*dt);
    ref.current.position.x+=(target[0]-ref.current.position.x)*a;
    ref.current.position.y+=(target[1]-ref.current.position.y)*a;
    ref.current.position.z+=(target[2]-ref.current.position.z)*a;
    if(holder)ref.current.rotation.y+=dt*3.2;
  });
  if(consumed)return null;
  const scale=item.kind==="burgerTray"?.9:item.kind==="snackBasket"?.9:item.kind==="waterBottle"?1.5:item.kind==="sodaCan"?1.7:2.0;
  return <group ref={ref} position={item.position} scale={scale}><primitive object={scene}/></group>;
}

function Snack({item,state,players}){return <AssetBoundary fallback={null}><SnackUnsafe item={item} state={state} players={players}/></AssetBoundary>}
function Snacks({players,snackStates}){
  return <group>{SNACKS.map(item=><Snack key={item.id} item={item} state={snackStates[item.id]} players={players}/>)}</group>;
}

function Kitchen() {
  return <group position={[13.0,0,1.0]}>
    <RoundedBox castShadow args={[1.5,1.15,6.0]} radius={.12} smoothness={5} position={[0,.65,0]}>
      <meshStandardMaterial color="#343941" roughness={.7}/>
    </RoundedBox>
    <RoundedBox castShadow args={[1.62,.16,6.12]} radius={.06} smoothness={5} position={[0,1.26,0]}>
      <meshStandardMaterial color="#b2aaa0" roughness={.36} metalness={.18}/>
    </RoundedBox>
    <mesh position={[-.01,1.37,-1.35]} rotation={[0,0,0]}>
      <boxGeometry args={[.9,.035,1.2]}/><meshStandardMaterial color="#17191d" roughness={.25}/>
    </mesh>
    {[[-.48,1.42,-2.3],[.48,1.42,-2.3],[-.48,1.42,2.25],[.48,1.42,2.25]].map((p,i)=>
      <mesh key={i} position={p}><cylinderGeometry args={[.11,.11,.08,20]}/><meshStandardMaterial color={i%2?"#d0a55d":"#8fc5d8"} roughness={.4}/></mesh>
    )}
    <Text position={[-.78,1.72,0]} rotation={[0,Math.PI/2,0]} fontSize={.22} color="#c6c0b8">FOOD</Text>
  </group>
}

function FloorLamp({x,z}){return <SafeFurniture url={FURNITURE.lamp} position={[x,0,z]} scale={1}/>}

function Plant({x,z,s=1,variant="palm",rotation=0}) {
  const url=PLANT_ASSETS[variant]||PLANT_ASSETS.palm;
  return <SafeFurniture url={url} position={[x,0,z]} rotation={rotation} scale={s}/>;
}

function Rug({x,z,w,d}) {
  return <mesh receiveShadow position={[x,.025,z]} rotation={[-Math.PI/2,0,0]}>
    <planeGeometry args={[w,d]}/><meshStandardMaterial color="#252b38" roughness={1}/>
  </mesh>
}

function TV({playing,track}) {
  const bars=Array.from({length:18},(_,i)=>.15+.12*((i*7)%5));
  return <group position={[0,4.05,-9.2]}>
    <RoundedBox castShadow args={[9.2,4.6,.28]} radius={.22} smoothness={6}>
      <meshStandardMaterial color="#171a22" roughness={.28} metalness={.45}/>
    </RoundedBox>
    <mesh position={[0,0,.18]}><planeGeometry args={[8.65,4.05]}/><meshStandardMaterial color={playing?"#17162e":"#090c12"} emissive={playing?"#4a3b99":"#0b0e15"} emissiveIntensity={playing?1.3:.25}/></mesh>
    <Text position={[-3.65,1.45,.23]} fontSize={.26} color="#a99bff" anchorX="left">GC RADIO</Text>
    <Text position={[-3.65,.78,.23]} fontSize={.42} color="#ffffff" anchorX="left">{playing?(track?.title||"GC RADIO"):"HANGOUT DISPLAY"}</Text>
    <Text position={[-3.65,.30,.23]} fontSize={.2} color="#aaa5b9" anchorX="left">{playing?(track?.artist||"Jamendo"):"Select a track to start the room mix"}</Text>
    <group position={[-3.62,-1.15,.23]}>{bars.map((h,i)=><mesh key={i} position={[i*.34,0,0]}><boxGeometry args={[.18,playing?h:0.12,.02]}/><meshStandardMaterial color={playing?"#7e6bff":"#343341"} emissive={playing?"#4f40b0":"#000000"} emissiveIntensity={playing?1.4:0}/></mesh>)}</group>
    <mesh position={[2.55,.95,.24]}><circleGeometry args={[.72,32]}/><meshStandardMaterial color={playing?"#715bff":"#272b36"} emissive={playing?"#5b48c7":"#000000"} emissiveIntensity={playing?1.4:0}/></mesh>
    <Text position={[2.55,.95,.28]} fontSize={.32} color="#ffffff" anchorX="center" anchorY="middle">{playing?"▶":"Ⅱ"}</Text>
  </group>
}

function Speakers({playing}) {
  return <>
    {[-4.7,4.7].map((x,i)=><group key={i} position={[x,1.2,-8.65]}>
      <RoundedBox castShadow args={[.8,2.3,.55]} radius={.08} smoothness={4}><meshStandardMaterial color="#15171c" roughness={.72}/></RoundedBox>
      {[.35,-.45].map((y,j)=><mesh key={j} position={[0,y,.29]}><circleGeometry args={[.17-j*.035,24]}/><meshStandardMaterial color="#252934" emissive={playing?"#6655d0":"#11131a"} emissiveIntensity={playing?1.6:.15}/></mesh>)}
    </group>)}
  </>
}
function OpenFloorMark() {
  return <group position={[0,.035,0]}>    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[4.9,5.02,64]}/><meshBasicMaterial color="#4f5364" transparent opacity={.42}/></mesh>
    <Text position={[0,.03,-.2]} rotation={[-Math.PI/2,0,0]} fontSize={.34} color="#5c6170">OPEN SOCIAL FLOOR</Text>
  </group>
}

function Hall({musicPlaying,musicTrack,players,snackStates}) {
  return <group>
    <mesh receiveShadow position={[0,-.08,0]}><boxGeometry args={[30.4,.16,20.4]}/><meshStandardMaterial color="#252a32" roughness={.94}/></mesh>
    <mesh receiveShadow position={[0,7.5,0]}><boxGeometry args={[30.4,.2,20.4]}/><meshStandardMaterial color="#1c2028" roughness={.9}/></mesh>
    <mesh receiveShadow position={[0,3.75,-10]}><boxGeometry args={[30.4,7.5,.24]}/><meshStandardMaterial color="#303641" roughness={.82}/></mesh>
    <mesh receiveShadow position={[0,3.75,10]}><boxGeometry args={[30.4,7.5,.24]}/><meshStandardMaterial color="#303641" roughness={.82}/></mesh>
    <mesh receiveShadow position={[-15,3.75,0]}><boxGeometry args={[.24,7.5,20.4]}/><meshStandardMaterial color="#303641" roughness={.82}/></mesh>
    <mesh receiveShadow position={[15,3.75,0]}><boxGeometry args={[.24,7.5,20.4]}/><meshStandardMaterial color="#303641" roughness={.82}/></mesh>

    {[[-10,6.85],[0,6.85],[10,6.85]].map((p,i)=><mesh key={i} position={[p[0],6.85,0]}><boxGeometry args={[.22,.32,19.5]}/><meshStandardMaterial color="#4a515d" roughness={.6}/></mesh>)}
    {[[-15,5.9,0],[15,5.9,0],[0,5.9,-10],[0,5.9,10]].map((p,i)=><mesh key={i} position={p}><boxGeometry args={i<2?[.3,.5,19.8]:[29.8,.5,.3]}/><meshStandardMaterial color="#5b6370" metalness={.25}/></mesh>)}

    <Rug x={-10} z={-6.0} w={7.5} d={5.2}/>
    <Sofa position={[-10,0,-7.28]} rotation={0}/>
    <Sofa position={[-10,0,-3.62]} rotation={Math.PI}/>
    <Sofa position={[-12.58,0,-5.45]} rotation={-Math.PI/2}/>
    <Sofa position={[-7.42,0,-5.45]} rotation={Math.PI/2}/>
    <CoffeeTable x={-10} z={-5.45}/>
    <FloorLamp x={-13.8} z={-7.7}/>
    <Plant x={-13.9} z={-3.0} s={1.0} variant="treeFern" rotation={0.25}/>

    <TV playing={musicPlaying} track={musicTrack}/>
    <Speakers playing={musicPlaying}/>

    <Rug x={10} z={5.8} w={7.2} d={5.8}/>
    <DiningTable/>
    <Kitchen/>
    <FloorLamp x={13.9} z={7.9}/>

    <Rug x={10} z={-6.1} w={6.4} d={6.4}/>
    <Bed x={8.7} z={-6.2} rotation={Math.PI/2}/>
    <Bed x={12.2} z={-6.2} rotation={Math.PI/2}/>
    <Text position={[10.5,1.75,-8.45]} rotation={[0,0,0]} fontSize={.28} color="#b6afc6">REST / RESET</Text>

    <Plant x={-13.7} z={8.3} s={1.0} variant="banana" rotation={-0.2}/>
    <Plant x={13.7} z={8.3} s={0.9} variant="palm" rotation={0.35}/>
    <Plant x={-3.0} z={9.0} s={0.9} variant="cycad" rotation={-0.35}/>
    <Plant x={6.4} z={8.55} s={0.95} variant="palm" rotation={-0.2}/>
    <Plant x={-6.4} z={8.55} s={0.95} variant="treeFern" rotation={0.15}/>
    <Plant x={5.8} z={-8.15} s={0.9} variant="banana" rotation={0.35}/>
    <Plant x={-14.0} z={0.2} s={0.85} variant="cycad" rotation={-0.25}/>
    <DigitalSignage/>
    <OpenFloorMark/>
    <Snacks players={players} snackStates={snackStates}/>
  </group>
}

function DigitalSignage() {
  const [index,setIndex]=useState(0);
  const colors=["#5cf2ff","#8b7dff","#ff4fd8","#55ff9a","#ffd35c","#ff6b6b"];
  useEffect(()=>{
    const id=setInterval(()=>setIndex(i=>(i+1)%colors.length),850);
    return()=>clearInterval(id);
  },[]);
  const color=colors[index];
  return <group position={[0,6.78,-9.72]}>
    <RoundedBox castShadow args={[9.2,.82,.12]} radius={.16} smoothness={6}>
      <meshStandardMaterial color="#090c13" roughness={.22} metalness={.7} emissive={color} emissiveIntensity={.16}/>
    </RoundedBox>
    <RoundedBox args={[8.82,.58,.035]} radius={.09} smoothness={5} position={[0,0,.08]}>
      <meshStandardMaterial color="#020409" roughness={.16} metalness={.35}/>
    </RoundedBox>
    <Text position={[0,0,.12]} fontSize={.43} color={color} anchorX="center" anchorY="middle" letterSpacing={.055} outlineWidth={.018} outlineColor={color}>
      XOPADHORA GC
    </Text>
    <Text position={[0,0,.105]} fontSize={.50} color={color} fillOpacity={.10} anchorX="center" anchorY="middle">
      XOPADHORA GC
    </Text>
    <mesh position={[-4.28,0,.13]}>
      <circleGeometry args={[.035,20]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4}/>
    </mesh>
    <mesh position={[4.28,0,.13]}>
      <circleGeometry args={[.035,20]}/><meshStandardMaterial color={color} emissive={color} emissiveIntensity={2.4}/>
    </mesh>
  </group>
}

function RealHuman({player,me,liveRef}) {
  const {scene,animations}=useGLTF(HUMAN_URL);  const root=useRef();
  const model=useMemo(()=>SkeletonUtils.clone(scene),[scene]);
  const {actions}=useAnimations(animations,root);
  const clipRef=useRef(null);
  const wasSeated=useRef(false);
  const poseBlend=useRef(0);
  const seated=player.action==="sit";
  const sleeping=player.action==="sleep";
  const locked=seated||sleeping;
  const targetRot=player.poseRotation??player.rot??0;
  const poseType=player.poseType??(sleeping?"bed":"sofa");

  const bones=useMemo(()=>{
    const b={thighL:null,thighR:null,shinL:null,shinR:null,footL:null,footR:null,spine:null,upperArmL:null,upperArmR:null,forearmL:null,forearmR:null};
    model.traverse(o=>{
      if(!o.isBone)return;
      const n=o.name.toLowerCase().replace(/[^a-z0-9]/g,"");
      const left=/(left|l)$/.test(n)||n.includes("left");
      const right=/(right|r)$/.test(n)||n.includes("right");      if(!b.thighL&&left&&/(thigh|upperleg|upleg)/.test(n))b.thighL=o;
      if(!b.thighR&&right&&/(thigh|upperleg|upleg)/.test(n))b.thighR=o;
      if(!b.shinL&&left&&/(shin|lowerleg|leglower|calf)/.test(n))b.shinL=o;
      if(!b.shinR&&right&&/(shin|lowerleg|leglower|calf)/.test(n))b.shinR=o;
      if(!b.footL&&left&&/(foot|ankle)/.test(n))b.footL=o;
      if(!b.footR&&right&&/(foot|ankle)/.test(n))b.footR=o;
      if(!b.spine&&/(spine2|spine1|chest|spine)/.test(n))b.spine=o;
      if(!b.upperArmL&&left&&/(upperarm|arm)/.test(n))b.upperArmL=o;
      if(!b.upperArmR&&right&&/(upperarm|arm)/.test(n))b.upperArmR=o;
      if(!b.forearmL&&left&&/(forearm|lowerarm)/.test(n))b.forearmL=o;
      if(!b.forearmR&&right&&/(forearm|lowerarm)/.test(n))b.forearmR=o;
    });
    return b;
  },[model]);

  const restBones=useMemo(()=>{
    const rest={};
    for(const [name,b] of Object.entries(bones))rest[name]=b?{x:b.rotation.x,y:b.rotation.y,z:b.rotation.z}:null;
    return rest;
  },[bones]);

  useEffect(()=>{model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})},[model]);

  useEffect(()=>{
    if(!actions)return;
    const names=Object.keys(actions);
    const idle=names.find(n=>/idle/i.test(n))||names[0];
    const walk=names.find(n=>/walk/i.test(n)&&!/run/i.test(n))||names.find(n=>/walk/i.test(n))||idle;
    const run=names.find(n=>/run|jog|sprint/i.test(n))||walk;
    const grasp=names.find(n=>/grasp|eat|drink/i.test(n))||idle;
    const hit=names.find(n=>/hit|hurt|shove|pain|reaction/i.test(n))||null;
    const attack=names.find(n=>/punch|jab|kick|attack|fight|combo/i.test(n))||null;
    const emote=player.emote?names.find(n=>new RegExp(player.emote,"i").test(n)):null;
    const desired=locked?null:(player.hit&&hit?hit:(player.attacking&&attack?attack:(emote||((player.action==="eat"||player.action==="drink")?grasp:((player.speed||0)>3.0?run:((player.speed||0)>.08?walk:idle))))));
    if(desired===clipRef.current)return;
    const previous=clipRef.current?actions[clipRef.current]:null;
    if(previous)previous.fadeOut(.16);
    if(desired&&actions[desired]){actions[desired].reset().fadeIn(.16).play();clipRef.current=desired;}
    else clipRef.current=null;
  },[actions,locked,player.action,player.speed,player.hit,player.attacking,player.emote]);

  useFrame((_,dt)=>{
    if(!root.current)return;
    const live=liveRef?.current||player;
    const tx=live.x??player.x??0,tz=live.z??player.z??0,trot=live.rot??targetRot,tspeed=live.speed??player.speed??0;
    const a=1-Math.exp(-(me?28:18)*dt);
    root.current.position.x+=(tx-root.current.position.x)*a;
    root.current.position.z+=(tz-root.current.position.z)*a;
    const seatedY=seated?(player.seatY??-.34):(sleeping?0.02:0);
    root.current.position.y+=(seatedY-root.current.position.y)*a;
    root.current.rotation.y+=Math.atan2(Math.sin(trot-root.current.rotation.y),Math.cos(trot-root.current.rotation.y))*a;

    const targetPose=seated?1:(sleeping?0.68:0);
    poseBlend.current+=(targetPose-poseBlend.current)*(1-Math.exp(-12*dt));
    const p=poseBlend.current;

    if(locked){
      const set=(name,x=0,y=0,z=0)=>{
        const b=bones[name],r=restBones[name];
        if(!b||!r)return;
        b.rotation.x=r.x+x*p;b.rotation.y=r.y+y*p;b.rotation.z=r.z+z*p;
      };
      if(sleeping){
        // Bed: reclined posture rather than the upright chair/sofa pose.
        set("thighL",-0.18);set("thighR",-0.18);
        set("shinL",0.22);set("shinR",0.22);
        set("footL",-0.08);set("footR",-0.08);
        set("spine",-1.12);
        set("upperArmL",-0.22,0.02,-0.06);set("upperArmR",-0.22,-0.02,0.06);
        set("forearmL",-0.42);set("forearmR",-0.42);
      }else if(poseType==="chair"){
        // Dining chair: more upright hips/knees and arms relaxed beside the torso.
        set("thighL",-1.38);set("thighR",-1.38);
        set("shinL",1.60);set("shinR",1.60);
        set("footL",-0.18);set("footR",-0.18);
        set("spine",0.015);
        set("upperArmL",-0.07,0.02,-0.02);set("upperArmR",-0.07,-0.02,0.02);
        set("forearmL",-0.18);set("forearmR",-0.18);
      }else{
        // Sofa/armchair: deeper, relaxed sit with knees raised to the cushion.
        set("thighL",-1.58);set("thighR",-1.58);
        set("shinL",1.88);set("shinR",1.88);
        set("footL",-0.30);set("footR",-0.30);
        set("spine",0.035);
        set("upperArmL",-0.10,0.02,-0.03);set("upperArmR",-0.10,-0.02,0.03);
        set("forearmL",-0.28);set("forearmR",-0.28);
      }
      wasSeated.current=true;    }else if(wasSeated.current){
      for(const [name,r] of Object.entries(restBones)){
        const b=bones[name];
        if(b&&r){b.rotation.x=r.x;b.rotation.y=r.y;b.rotation.z=r.z}
      }
      wasSeated.current=false;poseBlend.current=0;
    }

    const active=clipRef.current?actions[clipRef.current]:null;
    if(active&&/walk/i.test(clipRef.current))active.timeScale=clamp((tspeed||2.1)/2.1,.82,1.18);
    else if(active)active.timeScale=1;
  });

  const seatedBackX=locked?-Math.sin(targetRot)*.08:0;
  const seatedBackZ=locked?-Math.cos(targetRot)*.08:0;
  return <group ref={root} position={[player.x||0,0,player.z||0]} scale={[.98,.98,.98]}>
    <group position={[seatedBackX,0,seatedBackZ]}>      <primitive object={model} dispose={null}/>
      <Text position={[0,2.05,0]} fontSize={.14} color={me?"#bbaeff":"#ffffff"} anchorX="center" outlineWidth={.012} outlineColor="#11131a">{player.name}{me?" • you":""}</Text>
      {player.attacking&&<Text position={[0,2.32,0]} fontSize={.18} color="#ffd36b" anchorX="center">POW!</Text>}{player.hit&&<Text position={[0,2.32,0]} fontSize={.18} color="#ff8797" anchorX="center">OUCH!</Text>}
      {player.action&&player.action!=="moving"&&<Text position={[0,2.52,0]} fontSize={.11} color="#b8b1c4" anchorX="center">{player.action.toUpperCase()}</Text>}
    </group>
  </group>
}
function FallbackHuman({player,me}) {
  const ref=useRef();
  useFrame((_,dt)=>{
    if(!ref.current)return;
    ref.current.position.x+=(player.x-ref.current.position.x)*Math.min(1,10*dt);
    ref.current.position.z+=(player.z-ref.current.position.z)*Math.min(1,10*dt);
  });
  return <group ref={ref} position={[player.x||0,0,player.z||0]}>
    <mesh castShadow position={[0,.72,0]}><capsuleGeometry args={[.24,.55,8,16]}/><meshStandardMaterial color="#5967b8"/></mesh>
    <mesh castShadow position={[0,1.34,0]}><sphereGeometry args={[.28,20,14]}/><meshStandardMaterial color="#c78e69"/></mesh>
    <Text position={[0,1.8,0]} fontSize={.13} color={me?"#bbaeff":"#fff"} anchorX="center">{player.name}{me?" • you":""}</Text>
  </group>
}

function Football({players,localId,ballState,onBallState}) {
  const body=useRef(null),lastHit=useRef({}),lastBroadcast=useRef(0);
  const gltf=useGLTF(FOOTBALL_URL);
  const scene=useMemo(()=>{
    const s=SkeletonUtils.clone(gltf.scene);
    s.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    return s;
  },[gltf.scene]);
  const owner=localId&&Object.keys(players).filter(Boolean).sort()[0]===localId;
  useFrame((_,dt)=>{
    const b=body.current;
    if(!b)return;
    if(!owner){
      const s=ballState||{x:2,y:.28,z:0,vx:0,vy:0,vz:0};
      b.setTranslation({x:s.x,y:s.y,z:s.z},true);
      b.setLinvel({x:s.vx||0,y:s.vy||0,z:s.vz||0},true);
      b.setAngvel({x:0,y:0,z:0},true);
      return;
    }
    const p=b.translation();
    const now=performance.now();
    for(const player of Object.values(players)){
      if(!player?.id)continue;
      const dx=p.x-player.x,dz=p.z-player.z;
      const d=Math.hypot(dx,dz);
      if(d<.72&&Math.abs(p.y-.45)<.75){
        const last=lastHit.current[player.id]||0;
        if(now-last>180){
          const speed=Math.max(1.4,Math.min(4.8,Number(player.speed)||1.8));
          const nx=d>.001?dx/d:Math.sin(player.rot||0);
          const nz=d>.001?dz/d:Math.cos(player.rot||0);
          b.applyImpulse({x:nx*speed,y:.22,z:nz*speed},true);
          b.applyTorqueImpulse({x:nz*speed*.45,y:0,z:-nx*speed*.45},true);
          lastHit.current[player.id]=now;
        }
      }
    }
    const v=b.linvel();
    if(p.x<-14.4||p.x>14.4){b.setTranslation({x:clamp(p.x,-14.4,14.4),y:Math.max(.23,p.y),z:p.z},true);b.setLinvel({x:-v.x*.65,y:v.y,z:v.z},true)}
    if(p.z<-9.4||p.z>9.4){b.setTranslation({x:p.x,y:Math.max(.23,p.y),z:clamp(p.z,-9.4,9.4)},true);b.setLinvel({x:v.x,y:v.y,z:-v.z*.65},true)}
    if(p.y<.2){b.setTranslation({x:p.x,y:.28,z:p.z},true);b.setLinvel({x:v.x*.92,y:Math.abs(v.y)*.55,z:v.z*.92},true)}
    if(now-lastBroadcast.current>50){
      lastBroadcast.current=now;
      const q=b.translation(),vel=b.linvel();
      onBallState?.({x:q.x,y:q.y,z:q.z,vx:vel.x,vy:vel.y,vz:vel.z,ts:Date.now()});
    }
  });
  const start=ballState||{x:2,y:.35,z:0};
  return <RigidBody ref={body} type="dynamic" colliders="ball" mass={.45} restitution={.68} friction={.55} linearDamping={.22} angularDamping={.12} position={[start.x,start.y,start.z]}>
    <BallCollider args={[.205]} />
    <primitive object={scene} scale={1.85}/>
  </RigidBody>;
}

function WorldColliders(){
  return <>
    <RigidBody type="fixed" colliders={false} userData={{ecctrl:{excludeCharacterRay:true}}}>
      <CuboidCollider args={[15,.1,10]} position={[0,-.1,0]}/>
    </RigidBody>
    {OBSTACLES.map((b,i)=><RigidBody key={b.name||i} type="fixed" colliders={false} userData={{ecctrl:{excludeCharacterRay:true}}}>
      <CuboidCollider args={[b.rx,.7,b.rz]} position={[b.x,.7,b.z]}/>
    </RigidBody>)}
  </>;
}
function EcctrlLocalController({posRef,moveRef,runRef,onMove,interactionRef,onInteractionArrive}){
  const ctrl=useRef(null),lastSend=useRef(0);
  useFrame(({camera},dt)=>{
    const d=Math.min(dt,.05),m=moveRef.current,c=ctrl.current;
    if(!c)return;
    const p=posRef.current;
    const locked=p.action==="sit"||p.action==="sleep"||p.action==="moving"||!!interactionRef.current;
    if(interactionRef.current){
      c.setMovement({forward:false,backward:false,leftward:false,rightward:false,joystick:{x:0,y:0}});
      const target=interactionRef.current,movePosition=target.movePosition||target.approachPosition||target.position;
      const dx=movePosition[0]-p.x,dz=movePosition[2]-p.z,dist=Math.hypot(dx,dz);
      if(dist>.055){
        const speed=4.6,step=Math.min(dist,speed*d),nx=p.x+dx/dist*step,nz=p.z+dz/dist*step;
        c.body.setTranslation({x:nx,y:1,z:nz},true);
        const next={...p,x:nx,z:nz,rot:target.rotation,moving:true,speed:step/Math.max(d,.001),action:"moving",poseRotation:target.rotation};
        posRef.current=next;
        const now=performance.now();if(now-lastSend.current>33){lastSend.current=now;onMove(next)}
      }else{
        const finalPosition=target.position;
        c.body.setTranslation({x:finalPosition[0],y:1,z:finalPosition[2]},true);
        const next={...p,x:finalPosition[0],z:finalPosition[2],rot:target.rotation,moving:false,speed:0,action:target.finalAction,poseRotation:target.rotation,interactionId:target.id,seatY:target.seatY??null,poseType:target.poseType??target.type??null};
        posRef.current=next;interactionRef.current=null;onMove(next);onInteractionArrive?.(target);
      }
    }else if(!locked){
      c.setMovement({forward:false,backward:false,leftward:false,rightward:false,joystick:{x:m.x,y:-m.z},run:!!runRef.current||Math.hypot(m.x,m.z)>.88,jump:false});
      if(Math.abs(m.x)<0.001&&Math.abs(m.z)<0.001){const lv=c.body.linvel();c.body.setLinvel({x:0,y:lv.y,z:0},true);}
      const q=c.currQuat,pos=c.currPos;
      const yaw=Math.atan2(2*(q.w*q.y+q.x*q.z),1-2*(q.y*q.y+q.z*q.z));
      const speed=c.moveSpeed||0;
      const next={...p,x:pos.x,z:pos.z,rot:yaw,moving:speed>.06,speed,poseRotation:yaw};
      posRef.current=next;
      const now=performance.now();if(now-lastSend.current>33){lastSend.current=now;onMove(next)}
    }else{
      c.setMovement({forward:false,backward:false,leftward:false,rightward:false,joystick:{x:0,y:0},jump:false});
      if(p.action==="sit"||p.action==="sleep")c.body.setTranslation({x:p.x,y:1,z:p.z},true);
    }
  });
  return <Ecctrl ref={ctrl} position={[posRef.current.x,1,posRef.current.z]} capsuleHalfHeight={.42} capsuleRadius={.30} floatHeight={.18} canJump={false} enableToggleRun={false} autoBalance={true} maxWalkVel={2.2} maxRunVel={4.2} accDeltaTime={.14} decDeltaTime={.10} maxVelLimit={4.2} mode="CameraBasedMovement" camInitDis={-6.8} camMinDis={-4.2} camMaxDis={-8.6} camUpLimit={1.12} camLowLimit={-0.60} camMoveSpeed={1.2} camZoomSpeed={1} camCollision={true} camListenerTarget="domElement" />;
}
function Room({local,players,ballState,onBallState,onMove,onAttack,onEmote,onInteract,onInteractionArrive,onTouchInteraction,musicPlaying,musicTrack,musicStartedAt,musicPosition,onToggleMusic,onSelectMusic,onNextMusic,musicTracks,locks,snackStates,chatMessages,onSendChat,voiceEnabled,onToggleVoice,voiceError,onMusicAutoplayBlocked}) {
  const [move,setMove]=useState({x:0,z:0});
  const audioRef=useRef(null);
  const runRef=useRef(false);
  const [candidate,setCandidate]=useState(null);
  const moveRef=useRef(move);moveRef.current=move;
  const setMoveImmediate=v=>{moveRef.current=v;setMove(v)};
  const posRef=useRef({...local});
  const lastPropStateRef=useRef({...local});
  const interactionRef=useRef(null);
  useEffect(()=>{
    const previous=lastPropStateRef.current;
    const distance=Math.hypot((local?.x??0)-(previous?.x??0),(local?.z??0)-(previous?.z??0));
    const stateChanged=local?.action!==previous?.action||local?.interactionId!==previous?.interactionId;
    if(distance>1.5||stateChanged)posRef.current={...local};
    lastPropStateRef.current={...local};
  },[local?.x,local?.z,local?.action,local?.interactionId,local?.rot,local?.seatY,local?.poseType]);
  useEffect(()=>{
    const audio=audioRef.current;
    if(!audio)return;
    if(!musicTrack?.audio){audio.pause();return;}
    if(audio.src!==musicTrack.audio){audio.src=musicTrack.audio;audio.load();}
    const sync=()=>{
      if(!musicPlaying){audio.pause();return;}
      const duration=Number(musicTrack.duration)||audio.duration||0;
      let desired=musicStartedAt?Math.max(0,(Date.now()-musicStartedAt)/1000):Number(musicPosition)||0;
      if(duration>0)desired=desired%duration;
      if(Number.isFinite(desired)&&Math.abs((audio.currentTime||0)-desired)>.75){
        try{audio.currentTime=desired}catch{}
      }
      audio.play().catch(error=>{
        if(musicPlaying)onMusicAutoplayBlocked?.(error);
      });
    };
    sync();
    const timer=setInterval(sync,1000);
    return()=>clearInterval(timer);
  },[musicTrack?.id,musicTrack?.audio,musicTrack?.duration,musicPlaying,musicStartedAt,musicPosition]);


  const requestInteraction=(item)=>{
    // Stand is handled by Room so its authoritative controller state is
    // cleared at the same time as the UI/local player state. This keeps the
    // on-screen Stand up prompt/button and joystick behavior in sync.
    if(item?.type==="stand"){
      standUp();
      return;
    }
    if((item?.type==="seat"||item?.type==="bed")&&!interactionRef.current){
      interactionRef.current={...item,movePosition:item.approachPosition||item.position};
    }
    Promise.resolve(onInteract(item)).then(ok=>{
      if(ok===false)interactionRef.current=null;
    });
  };

  useEffect(()=>{
    const timer=setInterval(()=>{
      const p=posRef.current;
      if(p.action&&p.interactionId){setCandidate({id:p.interactionId,label:"Stand up",type:"stand",position:[p.x,0,p.z],rotation:p.poseRotation||p.rot});return}
      let best=null,dist=2.35;
      const list=[...INTERACTABLES,...SNACKS];
      for(const item of list){
        if(item.type==="bed"&&!item.position)continue;
        if(item.id in locks)continue;
        if(item.id in snackStates&&snackStates[item.id]?.consumed)continue;
        const target=item.approachPosition||item.position;
        const d=Math.hypot(p.x-target[0],p.z-target[2]);
        if(d<dist&&lineClear(p.x,p.z,target[0],target[2])){dist=d;best=item}
      }
      setCandidate(best);
    },100);
    return()=>clearInterval(timer);
  },[locks,snackStates]);

  useEffect(()=>{
    const down=e=>{
      if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      const k=e.key.toLowerCase();
      if(k===" "){e.preventDefault();requestInteraction(candidate);return}
      if(k==="shift"){runRef.current=true;return}
      if((k==="w"||k==="a"||k==="s"||k==="d"||k.startsWith("arrow"))&&(posRef.current.action==="sit"||posRef.current.action==="sleep")){        requestInteraction({id:posRef.current.interactionId,type:"stand",position:[posRef.current.x,0,posRef.current.z],rotation:posRef.current.poseRotation||posRef.current.rot,label:"Stand up"});
      }
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      e.preventDefault();
      if(posRef.current.action==="sit"||posRef.current.action==="sleep")return;
      const next={x:k==="a"||k==="arrowleft"? -1:k==="d"||k==="arrowright"?1:moveRef.current.x,z:k==="w"||k==="arrowup"?-1:k==="s"||k==="arrowdown"?1:moveRef.current.z};setMoveImmediate(next);
    };
    const up=e=>{
      const k=e.key.toLowerCase();
      if(k==="shift"){runRef.current=false;return}
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      const next={x:(k==="a"||k==="arrowleft"||k==="d"||k==="arrowright")?0:moveRef.current.x,z:(k==="w"||k==="arrowup"||k==="s"||k==="arrowdown")?0:moveRef.current.z};setMoveImmediate(next);
    };
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[onInteract,candidate]);
  const standUp=()=>{
    const p=posRef.current;
    if(p.action!=="sit"&&p.action!=="sleep")return false;
    const objectId=p.interactionId;
    if(!objectId)return false;

    const item=INTERACTABLES.find(x=>x.id===objectId);
    const candidates=[];
    if(item?.standPosition)candidates.push(item.standPosition);
    const baseAngle=(p.poseRotation??p.rot??0)+Math.PI;
    for(let radius=.72;radius<=2.1;radius+=.24){
      for(let i=0;i<16;i++){
        const angle=baseAngle+(Math.PI*2*i/16);
        candidates.push([p.x+Math.sin(angle)*radius,0,p.z+Math.cos(angle)*radius]);
      }
    }
    const safe=candidates.find(q=>!blocked(q[0],q[2],.34))||[clamp(p.x,-HALL_HALF_X+.5,HALL_HALF_X-.5),0,clamp(p.z,-HALL_HALF_Z+.5,HALL_HALF_Z-.5)];
    const clear={...p,x:safe[0],z:safe[2],action:null,interactionId:null,poseRotation:p.rot,moving:false,speed:0,seatY:null,poseType:null};
    interactionRef.current=null;
    posRef.current=clear;
    setCandidate(null);
    setMoveImmediate({x:0,z:0});
    onMove(clear);
    onInteract({id:objectId,type:"stand",position:[clear.x,0,clear.z],rotation:p.poseRotation||p.rot,label:"Stand up"});
    return true;
  };

  const joystickAt=(el,x,y)=>{
    if(standUp()){
      el.style.setProperty("--jx","0px");
      el.style.setProperty("--jz","0px");
      return;
    }
    const r=el.getBoundingClientRect(),dx=x-r.left-r.width/2,dz=y-r.top-r.height/2;
    const len=Math.hypot(dx,dz),max=42,k=len>max?max/len:1;
    const px=dx*k,pz=dz*k;
    setMoveImmediate({x:clamp(px/42,-1,1),z:clamp(pz/42,-1,1)});
    el.style.setProperty("--jx",px+"px");el.style.setProperty("--jz",pz+"px");
  };
  const joystickPointer=e=>{e.preventDefault();joystickAt(e.currentTarget,e.clientX,e.clientY)};
  const stop=e=>{
    e?.preventDefault?.();
    setMoveImmediate({x:0,z:0});
    if(e?.currentTarget){e.currentTarget.style.setProperty("--jx","0px");e.currentTarget.style.setProperty("--jz","0px");}
  };
  useEffect(()=>{
    const release=()=>setMoveImmediate({x:0,z:0});
    window.addEventListener("pointerup",release);
    window.addEventListener("pointercancel",release);
    window.addEventListener("blur",release);
    return()=>{window.removeEventListener("pointerup",release);window.removeEventListener("pointercancel",release);window.removeEventListener("blur",release)};
  },[]);

  useEffect(()=>{
    if(!local?.interactionId)return;
    const timer=setInterval(()=>onTouchInteraction?.(local.interactionId),8000);
    return()=>clearInterval(timer);
  },[local?.interactionId,onTouchInteraction]);

  return <div className="room">
    <Canvas
      shadows dpr={[1,1.25]} performance={{min:.55}}
      camera={{position:[0,2.2,6.8],fov:58,near:.1,far:80}}
    >
      <Physics gravity={[0,-9.81,0]}>
        <WorldColliders/>
        <EcctrlLocalController posRef={posRef} moveRef={moveRef} runRef={runRef} onMove={onMove} interactionRef={interactionRef} onInteractionArrive={onInteractionArrive}/>
      <color attach="background" args={["#0b0e14"]}/>
      <fog attach="fog" args={["#0b0e14",24,55]}/>
      <ambientLight intensity={.78}/>
      <directionalLight position={[2,10,5]} intensity={1.35} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <directionalLight position={[-8,5,-6]} intensity={.55} color="#9aa9ff"/>
      <Environment preset="warehouse" environmentIntensity={.35}/>
      <Hall musicPlaying={musicPlaying} musicTrack={musicTrack} players={players} snackStates={snackStates}/>
      <ContactShadows position={[0,0,0]} opacity={.18} scale={24} blur={3.2} far={11}/>
        {Object.values(players).map(p=>
          <Suspense key={p.id} fallback={null}>
            <AssetBoundary fallback={null}><RealHuman player={p} me={p.id===local.id} liveRef={p.id===local.id?posRef:null}/></AssetBoundary>
          </Suspense>
        )}
      </Physics>
    </Canvas>


    <audio ref={audioRef} preload="auto" onEnded={()=>onNextMusic?.()} aria-hidden="true" />
    <div className="topbar"><b>🌙 GC HANGOUT HALL</b><span>♥ {Math.max(0,local?.health??3)}/3&nbsp;&nbsp; • &nbsp;&nbsp;● {Object.keys(players).length} online</span></div>
    <div className="zoneHint">Large open social floor • perimeter interaction zones</div>
    <div className="chat">
      <div className="chatHead"><b>💬 GC CHAT</b><span>{Object.keys(players).length} online</span></div>
      <div className="chatList">{chatMessages.slice(-6).map(m=><div className="msg" key={m.id}><strong>{m.name}</strong><span>{m.text}</span></div>)}</div>
      <form className="chatForm" onSubmit={e=>{e.preventDefault();const input=e.currentTarget.elements.namedItem("message");if(input?.value.trim()){onSendChat?.(input.value);input.value=""}}}>
        <input name="message" maxLength={240} placeholder="Message the room…"/>
      </form>
    </div>
    {candidate&&<button className="interactionPrompt" onClick={()=>requestInteraction(candidate)}><span>↗</span>{candidate.label}</button>}
    <div className="controls">
      <button onClick={()=>candidate&&requestInteraction(candidate)}>✦ Interact</button>
      <button className={musicPlaying?"active":""} onClick={onToggleMusic} disabled={!musicTracks.length}>🎵 Music</button>{musicTracks.length>0&&<select className="musicSelect" value={musicTrack?.id||""} onChange={e=>onSelectMusic?.(e.target.value)} aria-label="Choose room music">{musicTracks.map(t=><option key={t.id} value={t.id}>{t.title} — {t.artist}</option>)}</select>}{musicError&&<span className="musicError" role="status">{musicError}</span>}
      <button onClick={onAttack}>🥊 Fight</button>
      <button className={voiceEnabled?"active":""} onClick={onToggleVoice}>{voiceEnabled?"🎙️":"🎤"} Voice</button>
      <button onClick={()=>onEmote?.("dance")}>💃 Emote</button>
    </div>
    <div className="joystick" onPointerDown={e=>{e.preventDefault();e.currentTarget.setPointerCapture?.(e.pointerId);joystickPointer(e)}} onPointerMove={joystickPointer} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><div className="stick"/></div>
    <button className="mobileAction" onClick={()=>candidate&&requestInteraction(candidate)}>✦</button>
    {voiceError&&<div className="voiceError">{voiceError}</div>}
    <button className="fight" onClick={onAttack}>🥊</button>
  </div>
}

export default function Home(){
  const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya");
  const [ballState,setBallState]=useState({x:2,y:.35,z:0,vx:0,vy:0,vz:0,ts:Date.now()}),[musicTracks,setMusicTracks]=useState([]),[musicTrack,setMusicTrack]=useState(null),[musicStartedAt,setMusicStartedAt]=useState(null),[musicPosition,setMusicPosition]=useState(0);
  const [id,setId]=useState(null),[players,setPlayers]=useState({}),[musicPlaying,setMusicPlaying]=useState(false);
  const [locks,setLocks]=useState({}),[snackStates,setSnackStates]=useState({}),[action,setAction]=useState(null);
  const [chatMessages,setChatMessages]=useState([]),[voiceEnabled,setVoiceEnabled]=useState(false),[voiceError,setVoiceError]=useState("");
  const [musicError,setMusicError]=useState("");
  const [connectionError,setConnectionError]=useState(""),[joining,setJoining]=useState(false);
  const ballStateRef=useRef({x:2,y:.35,z:0,vx:0,vy:0,vz:0,ts:Date.now()}),musicRef=useRef(false),musicTrackRef=useRef(null),musicStartedAtRef=useRef(null),musicPositionRef=useRef(0);
  const attackCooldownRef=useRef(0);
  const chatMessagesRef=useRef([]);
  const playersRef=useRef({});
  ballStateRef.current=ballState;
  musicRef.current=musicPlaying;musicTrackRef.current=musicTrack;musicStartedAtRef.current=musicStartedAt;musicPositionRef.current=musicPosition;
  chatMessagesRef.current=chatMessages;
  playersRef.current=players;
  const locksRef=useRef({}),snackStatesRef=useRef({});
  const chatLastSentRef=useRef(0);
  locksRef.current=locks;snackStatesRef.current=snackStates;
  const channelRef=useRef(null),localRef=useRef(null),voiceRef=useRef(null);
  const uiStateAtRef=useRef(0);

  const join=async()=>{
    if(!name.trim()||joining)return;
    setJoining(true);setConnectionError("");
    try{
        const supabase=await getSupabase();
      if(!supabase)throw new Error("Supabase is not configured.");
      const session=await ensureAnonymousSession(supabase,{display_name:name.trim()});
      if(!session?.user?.id)throw new Error("Supabase did not return a player identity.");
      const playerId=session.user.id;
      const {error:resetError}=await supabase.rpc("gc_reset_combat_state");
      if(resetError)console.warn("Combat state reset unavailable",resetError);
      const p={id:playerId,name:name.trim()||"You",avatarId,x:0,y:0,z:0,rot:0,health:3,attacking:false,moving:false,speed:0,action:null,interactionId:null,poseRotation:0,seatY:null,poseType:null,voiceEnabled:false};
      localRef.current=p;
      const {error:positionError}=await supabase.rpc("gc_update_combat_position",{p_x:0,p_z:0,p_rot:0});
      if(positionError)console.warn("Initial combat position sync unavailable",positionError);
      setId(playerId);
      setJoined(true);
    }catch(e){
      console.error("Unable to join GC Hangout",e);
      setConnectionError(e?.message||"Unable to connect to the multiplayer service.");
    }finally{
      setJoining(false);
    }
  };

  useEffect(()=>{
    if(!joined||!id)return;
    let disposed=false;
    let cleanup=()=>{};
    (async()=>{
      try{
        const supabase=await getSupabase();
        if(disposed)return;
        if(!supabase){setConnectionError("Supabase is not configured.");return}
        const {data:{session}}=await supabase.auth.getSession();
        if(!session?.access_token){setConnectionError("Your multiplayer session is unavailable. Please reload and try again.");return}
        await supabase.realtime.setAuth(session.access_token);
      const channel=supabase.channel("gc-hangout-main",{config:{private:true,broadcast:{self:false,ack:true},presence:{key:id}}});
    channelRef.current=channel;
    const send=p=>channel.send({type:"broadcast",event:"player_state",payload:{...p,netTs:Date.now()}});\n    const sendBall=s=>channel.send({type:"broadcast",event:"ball_state",payload:s});
    const reconcilePresence=()=>{
      const state=channel.presenceState();
      const online=new Set(Object.keys(state));
      setPlayers(prev=>{
        const next={...prev};
        for(const key of Object.keys(next)){if(key!==id&&!online.has(key))delete next[key];}
        setLocks(prev=>{const cleaned={...prev};for(const [objectId,holder] of Object.entries(cleaned)){if(holder!==id&&!online.has(holder))delete cleaned[objectId];}return cleaned});
        for(const [key,entries] of Object.entries(state)){
          if(key===id)continue;
          const meta=entries?.[0]||{};
          next[key]={...(next[key]||{}),id:key,name:meta.name||next[key]?.name||"Guest",avatarId:meta.avatarId||next[key]?.avatarId||"maya",voiceEnabled:!!meta.voiceEnabled};
          }
        return next;
        });
      if(voiceRef.current?.enabled){
        for(const key of voiceRef.current.peers.keys()){
          if(key!==id&&!online.has(key))voiceRef.current.removePeer(key);
        }
        voiceRef.current.syncPeers(Object.keys(state).filter(key=>key!==id)).catch(()=>{});
      }
      for(const [key,entries] of Object.entries(state)){
        if(key!==id&&entries?.[0]?.voiceEnabled&&voiceRef.current&&voiceRef.current.enabled&&id<key)voiceRef.current.offerTo(key).catch(()=>{});
      }
    };
    channel.on("presence",{event:"sync"},reconcilePresence);
    channel.on("presence",{event:"join"},reconcilePresence);
    channel.on("presence",{event:"leave"},reconcilePresence);
    channel.on("broadcast",{event:"ball_state"},({payload})=>{if(payload?.ts)setBallState(payload);});\n    channel.on("broadcast",{event:"player_state"},({payload})=>{
      if(!payload?.id)return;
      setPlayers(prev=>{
        const current=prev[payload.id];
        if(current?.netTs&&payload.netTs&&payload.netTs<current.netTs)return prev;
        return {...prev,[payload.id]:payload};
      });
    });
    channel.on("broadcast",{event:"request_state"},()=>localRef.current&&send(localRef.current));
    channel.on("broadcast",{event:"room_state"},({payload})=>{if(typeof payload?.musicPlaying==="boolean")setMusicPlaying(payload.musicPlaying);if(payload?.musicTrack)setMusicTrack(payload.musicTrack);if(typeof payload?.musicStartedAt==="number")setMusicStartedAt(payload.musicStartedAt);if(typeof payload?.musicPosition==="number")setMusicPosition(payload.musicPosition)});
    channel.on("broadcast",{event:"chat_message"},({payload})=>{
      if(!payload?.id||!payload?.text)return;
      setChatMessages(prev=>prev.some(m=>m.id===payload.id)?prev:[...prev,payload].slice(-80));
    });
    channel.on("broadcast",{event:"request_room_state"},()=>{channel.send({type:"broadcast",event:"room_state",payload:{musicPlaying:musicRef.current,musicTrack:musicTrackRef.current,musicStartedAt:musicStartedAtRef.current,musicPosition:musicPositionRef.current}})});
    channel.on("broadcast",{event:"request_chat"},()=>{
      if(chatMessagesRef.current.length)channel.send({type:"broadcast",event:"chat_history",payload:{messages:chatMessagesRef.current}});
    });
    channel.on("broadcast",{event:"chat_history"},({payload})=>{
      if(Array.isArray(payload?.messages))setChatMessages(prev=>{
        const merged=[...prev,...payload.messages],map=new Map(merged.map(m=>[m.id,m]));
        return [...map.values()].sort((a,b)=>a.ts-b.ts).slice(-80);
      });
    });
    channel.on("broadcast",{event:"request_room"},()=>channel.send({type:"broadcast",event:"room_state",payload:{musicPlaying:musicRef.current}}));
    channel.on("broadcast",{event:"attack"},async({payload})=>{
      try{
        if(!payload?.id||payload.id===id)return;
        setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:true}}:prev);
        setTimeout(()=>setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:false}}:prev),350);
        if(payload.targetId!==id||!localRef.current)return;
      const supabase=await getSupabase();
        if(!supabase)return;
        const {data,error}=await supabase.rpc("gc_apply_attack",{
          p_target_id:id,
          p_attacker_x:Number(payload.attackerX),
          p_attacker_z:Number(payload.attackerZ),
          p_attacker_rot:Number(payload.attackerRot),
          p_target_x:Number(localRef.current.x),
          p_target_z:Number(localRef.current.z)
      });
        if(error){console.warn("combat validation failed",error);return}
        const result=Array.isArray(data)?data[0]:data;
        if(!result?.accepted)return;
        const nextHealth=Number(result.target_health);
        const next={...localRef.current,health:nextHealth,hit:true};
        localRef.current=next;setPlayers(prev=>({...prev,[id]:next}));
        setTimeout(()=>{
          if(localRef.current?.hit){
            localRef.current={...localRef.current,hit:false};
            setPlayers(prev=>({...prev,[id]:localRef.current}));
        }
        },350);
        if(result.defeated)setTimeout(()=>{
          const respawn={...localRef.current,x:0,z:0,health:3,attacking:false,action:null,interactionId:null,seatY:null,poseType:null};
          localRef.current=respawn;setPlayers(prev=>({...prev,[id]:respawn}));send(respawn);
          supabase.rpc("gc_reset_combat_state").catch(()=>{});
        },900);
      }catch(error){
        console.warn("combat event handling failed",error);
      }
    });
    channel.on("broadcast",{event:"player_action"},({payload})=>{
      if(payload?.id)setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],...payload}}:prev)
    });    channel.on("broadcast",{event:"interaction_lock"},({payload})=>{
      if(!payload?.objectId)return;
      if(payload.locked)setLocks(prev=>({...prev,[payload.objectId]:payload.userId}));
      else setLocks(prev=>{const next={...prev};delete next[payload.objectId];return next});
    });
    channel.on("broadcast",{event:"snack_state"},({payload})=>{
      if(payload?.id)setSnackStates(prev=>({...prev,[payload.id]:payload}));
    });
    channel.on("broadcast",{event:"request_interaction_state"},()=>{
      channel.send({type:"broadcast",event:"interaction_state",payload:{locks:locksRef.current,snackStates:snackStatesRef.current}});
    });
    channel.on("broadcast",{event:"interaction_state"},({payload})=>{
      if(payload?.locks)setLocks(payload.locks);
      if(payload?.snackStates)setSnackStates(payload.snackStates);
    });
    voiceRef.current=new VoiceMesh({channel,localId:id,onPeerState:enabled=>{setVoiceEnabled(enabled);setVoiceError("");}});
    let reconnectTimer=null;
    let reconnecting=false;
    const subscribe=()=>{
      channel.subscribe(async(status,err)=>{
        try{
        if(status==="SUBSCRIBED"&&localRef.current){
          reconnecting=false;
          if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null;}
          setConnectionError("");
          setPlayers(prev=>({...prev,[id]:localRef.current}));
          await channel.track({id,name:localRef.current.name,avatarId,voiceEnabled:voiceRef.current?.enabled||false});
          send(localRef.current);
          setTimeout(()=>channel.send({type:"broadcast",event:"request_state",payload:{id}}),250);\n          setTimeout(()=>channel.send({type:"broadcast",event:"ball_state",payload:ballStateRef.current}),300);
          setTimeout(()=>channel.send({type:"broadcast",event:"request_room",payload:{id}}),350);
          setTimeout(()=>channel.send({type:"broadcast",event:"request_interaction_state",payload:{id}}),450);
          setTimeout(()=>channel.send({type:"broadcast",event:"request_chat",payload:{id}}),550);
          return;
        }
        if(["CHANNEL_ERROR","TIMED_OUT","CLOSED"].includes(status)&&!reconnecting&&!disposed){
          reconnecting=true;
          setConnectionError(err?.message||"Realtime connection interrupted. Reconnecting…");
          reconnectTimer=setTimeout(async()=>{
            reconnectTimer=null;
            reconnecting=false;
            if(disposed)return;
            const {data:{session}}=await supabase.auth.getSession();
            if(session?.access_token)await supabase.realtime.setAuth(session.access_token);
            subscribe();
          },1500);
        }
        } catch(e) {
          if(!disposed){
            console.error("Realtime callback failed",e);
            setConnectionError(e?.message||"Realtime connection failed. Reconnecting…");
          }
        }
      });
    };
    subscribe();
    cleanup=()=>{
      const active=localRef.current?.interactionId;
      if(active)supabase.rpc("gc_release_interaction",{p_object_id:active,p_holder_id:id}).catch(()=>{});
      if(reconnectTimer)clearTimeout(reconnectTimer);
      voiceRef.current?.destroy();voiceRef.current=null;
      channel.unsubscribe();channelRef.current=null;
    };
      }catch(e){
        if(!disposed){
          console.error("Multiplayer bootstrap failed",e);
          setConnectionError(e?.message||"Multiplayer connection failed. Please reload and try again.");
        }
      }
    })();
    return()=>{disposed=true;cleanup()};
  },[joined,id,avatarId]);
  const combatPositionRef=useRef({ts:0});
  const onBallState=s=>{ballStateRef.current=s;setBallState(s);channelRef.current?.send({type:"broadcast",event:"ball_state",payload:s});};\n\n  const onMove=p=>{
    if(!id)return;
    const stamped={...p,netTs:Date.now()};
    const combatNow=performance.now();
    if(combatNow-combatPositionRef.current.ts>=120){
      combatPositionRef.current={ts:combatNow};
      getSupabase().then(supabase=>supabase?.rpc("gc_update_combat_position",{p_x:Number(p.x),p_z:Number(p.z),p_rot:Number(p.rot||0)})).catch(error=>console.warn("combat position sync failed",error));
    }
    localRef.current=p;
    const now=performance.now();
    setPlayers(prev=>{
      const current=prev[id];
      const stateChanged=current?.action!==p.action||current?.interactionId!==p.interactionId||current?.emote!==p.emote||current?.attacking!==p.attacking||current?.hit!==p.hit;
      if(!stateChanged&&now-uiStateAtRef.current<100)return prev;
      uiStateAtRef.current=now;
      return {...prev,[id]:{...p,uiTs:now}};
    });
    channelRef.current?.send({type:"broadcast",event:"player_state",payload:stamped});
  };

  const onSendChat=textValue=>{
    const now=Date.now();
    if(now-chatLastSentRef.current<700)return;
    const clean=String(textValue||"").replace(/[\u0000-\u001f\u007f]/g," ").replace(/\s+/g," ").trim().slice(0,240);
    if(!clean||!localRef.current)return;
    chatLastSentRef.current=now;
    const message={id:makeId(),name:localRef.current.name,text:clean,ts:now};
    setChatMessages(prev=>[...prev,message].slice(-80));
    channelRef.current?.send({type:"broadcast",event:"chat_message",payload:message});
  };

  const onToggleVoice=async()=>{
    if(!voiceRef.current)return;
    try{
      setVoiceError("");
      await voiceRef.current.setEnabled(!voiceRef.current.enabled);
      if(channelRef.current&&localRef.current){
        localRef.current={...localRef.current,voiceEnabled:voiceRef.current.enabled};
        setPlayers(prev=>({...prev,[id]:localRef.current}));
        await channelRef.current.track({id,name:localRef.current.name,avatarId,voiceEnabled:voiceRef.current.enabled});
        voiceRef.current.syncPeers(Object.keys(channelRef.current.presenceState()).filter(key=>key!==id)).catch(()=>{});
      }
    }catch(e){
      console.error("Voice chat failed",e);
      setVoiceError(e?.message||"Microphone access failed.");
      setVoiceEnabled(false);
    }
  };

  const claimInteraction=async(candidate,action)=>{
    const supabase=await getSupabase();
    if(!supabase)return true;
    const {data,error}=await supabase.rpc("gc_claim_interaction",{p_object_id:candidate.id,p_holder_id:id,p_action:action,p_lease_seconds:30});
    if(error){console.error("interaction claim failed",error);return false;}
    return data===true;
  };

  const releaseInteraction=async objectId=>{
    const supabase=await getSupabase();
    if(!supabase||!objectId)return;
    await supabase.rpc("gc_release_interaction",{p_object_id:objectId,p_holder_id:id}).catch(()=>{});
  };

  const touchInteraction=async objectId=>{
    const supabase=await getSupabase();
    if(supabase&&objectId)supabase.rpc("gc_touch_interaction",{p_object_id:objectId,p_holder_id:id,p_lease_seconds:30}).catch(()=>{});
  };

  const broadcastMusic=payload=>channelRef.current?.send({type:"broadcast",event:"room_state",payload});
  const toggleMusic=()=>{
    if(!musicTrack)return;
    const now=Date.now();
    const next=!musicPlaying;
    const pos=musicPlaying&&musicStartedAt?Math.max(0,(now-musicStartedAt)/1000):musicPosition;
    const started=next?now-pos*1000:null;
    setMusicPlaying(next);setMusicPosition(pos);setMusicStartedAt(started);
    broadcastMusic({musicPlaying:next,musicTrack,musicStartedAt:started,musicPosition:pos});
  };
  const onSelectMusic=trackId=>{
    const track=musicTracks.find(t=>t.id===trackId);if(!track)return;
    const started=Date.now();
    setMusicTrack(track);setMusicPlaying(true);setMusicStartedAt(started);setMusicPosition(0);
    broadcastMusic({musicPlaying:true,musicTrack:track,musicStartedAt:started,musicPosition:0});
  };
  const onNextMusic=()=>{
    if(!musicTracks.length)return;
    const index=Math.max(0,musicTracks.findIndex(t=>t.id===musicTrack?.id));
    onSelectMusic(musicTracks[(index+1)%musicTracks.length].id);
  };

  useEffect(()=>{if(!joined)return;setMusicError("");fetch("/api/music?search=instrumental%20lounge").then(async r=>{const data=await r.json().catch(()=>({}));if(!r.ok)throw new Error(data?.error||"Music catalog unavailable.");return data}).then(data=>{if(Array.isArray(data.tracks)&&data.tracks.length){setMusicTracks(data.tracks);setMusicTrack(prev=>prev||data.tracks[0])}else setMusicError("No licensed music tracks are available right now.")}).catch(e=>{console.warn("music catalog unavailable",e);setMusicError(e?.message||"Music catalog unavailable.")})},[joined]);

  const onAttack=()=>{
    if(!localRef.current)return;
    const now=performance.now();
    if(now<attackCooldownRef.current)return;
    attackCooldownRef.current=now+500;
    const me=localRef.current,others=Object.values(players).filter(p=>p.id!==id);
    let target=null,best=99;
    for(const p of others){
      const d=Math.hypot(p.x-me.x,p.z-me.z);
      const angle=Math.atan2(p.x-me.x,p.z-me.z);
      const facing=Math.abs(Math.atan2(Math.sin(angle-(me.rot||0)),Math.cos(angle-(me.rot||0))));
      if(d<1.65&&facing<1.05&&d<best){best=d;target=p}
    }
    const p={...me,attacking:true};localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));
    channelRef.current?.send({
      type:"broadcast",
      event:"attack",
      payload:{
        id,targetId:target?.id||null,at:Date.now(),
        attackerX:me.x,attackerZ:me.z,attackerRot:me.rot||0,
        targetX:target?.x??me.x,targetZ:target?.z??me.z
      }
    });
    setTimeout(()=>{if(localRef.current){localRef.current={...localRef.current,attacking:false};setPlayers(prev=>({...prev,[id]:localRef.current}))}},350);
  };

  const onEmote=emote=>{
    if(!localRef.current||localRef.current.action==="sit"||localRef.current.action==="sleep")return;
    const allowed={dance:"dance",wave:"wave",clap:"clap",laugh:"laugh"};
    const value=allowed[emote]||"dance";
    const p={...localRef.current,emote:value};
    localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));
    channelRef.current?.send({type:"broadcast",event:"player_state",payload:{...p,netTs:Date.now()}});
    setTimeout(()=>{
      if(localRef.current?.emote===value){
        const clear={...localRef.current,emote:null};
        localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
        channelRef.current?.send({type:"broadcast",event:"player_state",payload:{...clear,netTs:Date.now()}});
      }
    },2600);
  };

  const interact=async(candidate)=>{
    if(!localRef.current||!candidate)return;
    const p=localRef.current;

    if(candidate.type==="stand"){
      const objectId=candidate.id||p.interactionId;
      const clear={...p,action:null,interactionId:null,poseRotation:p.rot,moving:false,speed:0,seatY:null,poseType:null};
      localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
      channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
      if(objectId){
        releaseInteraction(objectId);
        setLocks(prev=>{const next={...prev};delete next[objectId];return next});
        channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId,userId:id,locked:false}});
      }
      setAction(null);
      return;
    }

    if(locks[candidate.id]&&locks[candidate.id]!==id)return false;
    if(candidate.type==="music"){
      toggleMusic();
      return true;
    }

    if(candidate.type==="tv"){
      const claimed=await claimInteraction(candidate,"watch");
      if(!claimed)return false;
      const payload={...p,action:"watch",interactionId:candidate.id,poseRotation:0,moving:false,speed:0};
      localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
      setLocks(prev=>({...prev,[candidate.id]:id}));
      channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:true}});
      channelRef.current?.send({type:"broadcast",event:"player_state",payload});
      setTimeout(()=>{        if(localRef.current?.interactionId===candidate.id){
          const clear={...localRef.current,action:null,interactionId:null};
          localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
          channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
          releaseInteraction(candidate.id);
          setLocks(prev=>{const next={...prev};delete next[candidate.id];return next});
          channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:false}});
        }
      },5000);
      return true;
    }

    if(candidate.type==="seat"||candidate.type==="bed"){
      const finalAction=candidate.type==="bed"?"sleep":"sit";
      const claimed=await claimInteraction(candidate,finalAction);
      if(!claimed)return false;
      const payload={...p,action:"moving",interactionId:null,poseRotation:candidate.rotation,moving:true,speed:3.2};
      localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
      setLocks(prev=>({...prev,[candidate.id]:id}));
      channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:true}});
      channelRef.current?.send({type:"broadcast",event:"player_state",payload});
      return true;
    }

    const food=SNACKS.find(s=>s.id===candidate.id);
    if(food){
      const state=snackStates[food.id];
      if(state?.consumed||state?.heldBy)return false;
      const claimed=await claimInteraction(food,food.action);
      if(!claimed)return false;
      const held={id:food.id,heldBy:id,consumed:false};
      setSnackStates(prev=>({...prev,[food.id]:held}));
      channelRef.current?.send({type:"broadcast",event:"snack_state",payload:held});
      setLocks(prev=>({...prev,[food.id]:id}));
      channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:food.id,userId:id,locked:true}});
      const payload={...p,action:food.action,interactionId:food.id,moving:false,speed:0};
      localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
      channelRef.current?.send({type:"broadcast",event:"player_state",payload});
      setTimeout(()=>{
        const consumed={id:food.id,heldBy:null,consumed:true};
        setSnackStates(prev=>({...prev,[food.id]:consumed}));
        channelRef.current?.send({type:"broadcast",event:"snack_state",payload:consumed});
        if(localRef.current?.interactionId===food.id){
          const clear={...localRef.current,action:null,interactionId:null};
          localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
          channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
        }
        releaseInteraction(food.id);
        setLocks(prev=>{const next={...prev};delete next[food.id];return next});
        channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:food.id,userId:id,locked:false}});
      },1500);
      return true;
    }
    return false;
  };

  const interactionArrived=(candidate)=>{
    if(!localRef.current)return;
    const finalAction=candidate.finalAction||(candidate.type==="bed"?"sleep":"sit");
    const payload={...localRef.current,action:finalAction,interactionId:candidate.id,moving:false,speed:0,poseRotation:candidate.rotation,seatY:candidate.seatY??null,poseType:candidate.poseType??candidate.type??null};
    localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
    channelRef.current?.send({type:"broadcast",event:"player_state",payload:{...payload,netTs:Date.now()}});
    setAction(finalAction);
    // Stay seated/asleep until the user explicitly presses Stand up or moves
    // the joystick/keyboard. The old 7s timer was making the interaction state
    // race with input and could leave the client looking locked.
  };

  if(joined&&id)return <Room local={localRef.current} players={players} ballState={ballState} onBallState={onBallState} onEmote={onEmote} musicTracks={musicTracks} musicTrack={musicTrack} musicPlaying={musicPlaying} musicStartedAt={musicStartedAt} musicPosition={musicPosition} onToggleMusic={toggleMusic} onSelectMusic={onSelectMusic} onNextMusic={onNextMusic} locks={locks} snackStates={snackStates} chatMessages={chatMessages} onSendChat={onSendChat} onMove={onMove} onAttack={onAttack} onInteract={interact} onInteractionArrive={interactionArrived} onTouchInteraction={touchInteraction} voiceEnabled={voiceEnabled} onToggleVoice={onToggleVoice} voiceError={voiceError} onMusicAutoplayBlocked={()=>setMusicError("Tap Music to start audio on this device.")}/>;

  return <main className="join">
    <div className="card">
      <div className="logo">🌙</div><h1>GC Hangout Hall</h1>
      <p>One large shared hall built around movement, camera space and multiplayer interaction.</p>
      <label>Your name<input value={name} onChange={e=>setName(e.target.value.slice(0,18))} placeholder="e.g. Rishi"/></label>
      <div className="label">Choose your human</div>      <div className="avatars">{PRESETS.map((p,i)=>
        <button className={avatarId===p.id?"selected":""} onClick={()=>setAvatarId(p.id)} key={p.id}>
          <span>{i%3===0?"👩":i%3===1?"👨":"🧑"}</span><small>{p.label}</small>
        </button>
      )}</div>
      <button className="enter" onClick={join} disabled={!name.trim()||joining}>{joining?"Connecting…":"Enter the hall →"}</button>
      {connectionError&&<div className="joinError" role="alert">{connectionError}</div>}
      <div className="note">Open-plan hall • smooth movement • shared music • multiplayer</div>
    </div>
  </main>;
}