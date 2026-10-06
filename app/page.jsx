"use client";
import { Canvas, useFrame } from "@react-three/fiber";
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
import { getSupabase } from "../lib/supabase";

const PRESETS = [
  {id:"maya",label:"Maya"}, {id:"noah",label:"Noah"}, {id:"riya",label:"Riya"},
  {id:"aarav",label:"Aarav"}, {id:"zoe",label:"Zoe"}, {id:"sam",label:"Sam"},
  {id:"kai",label:"Kai"}, {id:"rihan",label:"Rihan"}
];

const HUMAN_URL="https://cdn.3dassets.dev/assets/32901/v1/model.glb";
const HALL_HALF_X=15, HALL_HALF_Z=10, PLAYER_RADIUS=.34;
const TRACK={title:"GC After Hours",artist:"GC Radio",album:"Community Mix"};
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const makeId=()=>typeof crypto!=="undefined"&&crypto.randomUUID?crypto.randomUUID():Math.random().toString(36).slice(2)+Date.now();
const FURNITURE={
 sofa:"https://cdn.3dassets.dev/assets/38778/v1/model.glb",
 armchair:"https://cdn.3dassets.dev/assets/38780/v1/model.glb",
 diningChair:"https://cdn.3dassets.dev/assets/38785/v1/model.glb",
 coffee:"https://cdn.3dassets.dev/assets/38790/v1/model.glb",
 diningTable:"https://cdn.3dassets.dev/assets/38791/v1/model.glb",
 bed:"https://cdn.3dassets.dev/assets/38770/v1/model.glb",
 lamp:"https://cdn.3dassets.dev/assets/38797/v1/model.glb"
};

const SEATS=[
 {id:"sofa-a-left",label:"Sit on sofa",type:"seat",finalAction:"sit",position:[-10.75,0,-6.18],rotation:Math.PI},
 {id:"sofa-a-right",label:"Sit on sofa",type:"seat",finalAction:"sit",position:[-9.25,0,-6.18],rotation:Math.PI},
 {id:"sofa-b-left",label:"Sit on sofa",type:"seat",finalAction:"sit",position:[-10.75,0,-4.92],rotation:0},
 {id:"sofa-b-right",label:"Sit on sofa",type:"seat",finalAction:"sit",position:[-9.25,0,-4.92],rotation:0},
 ...[[-1.45,-1],[0,-1],[1.45,-1],[-1.45,1],[0,1],[1.45,1]].map(([x,side],i)=>({
   id:"dining-seat-"+i,label:"Sit at table",type:"seat",finalAction:"sit",
   position:[10+x,0,5.8+(side<0?-1.82:1.82)],rotation:side<0?0:Math.PI
 }))
];
const BEDS=[
 {id:"bed-a",label:"Sleep",type:"bed",finalAction:"sleep",position:[8.7,0,-6.2],rotation:Math.PI/2},
 {id:"bed-b",label:"Sleep",type:"bed",finalAction:"sleep",position:[12.2,0,-6.2],rotation:Math.PI/2}
];
const FOOD_ASSETS={
 burgerTray:"https://cdn.3dassets.dev/assets/34314/v1/model.glb",
 snackBasket:"https://cdn.3dassets.dev/assets/33873/v1/model.glb",
 sodaCan:"https://cdn.3dassets.dev/assets/24445/v1/model.glb",
 waterBottle:"https://cdn.3dassets.dev/assets/24444/v1/model.glb",
 chocolate:"https://cdn.3dassets.dev/assets/24429/v1/model.glb"
};
const SNACKS=[
 {id:"burger-tray",name:"Burger & chips",kind:"burgerTray",position:[9.35,.86,5.8],action:"eat",label:"Eat burger & chips"},
 {id:"snack-basket",name:"Fries",kind:"snackBasket",position:[10.65,.82,5.8],action:"eat",label:"Eat fries"},
 {id:"soda",name:"Soda",kind:"sodaCan",position:[9.0,.82,5.55],action:"drink",label:"Drink soda"},
 {id:"water",name:"Water",kind:"waterBottle",position:[11.0,.84,5.55],action:"drink",label:"Drink water"},
 {id:"chocolate",name:"Chocolate",kind:"chocolate",position:[-9.65,.72,-5.55],action:"eat",label:"Eat chocolate"},
 {id:"fries-2",name:"Fries",kind:"snackBasket",position:[-10.35,.82,-5.55],action:"eat",label:"Eat fries"},
 {id:"soda-2",name:"Soda",kind:"sodaCan",position:[-9.05,.82,-5.55],action:"drink",label:"Drink soda"},
 {id:"water-2",name:"Water",kind:"waterBottle",position:[-10.95,.84,-5.55],action:"drink",label:"Drink water"}
];

const INTERACTABLES=[
 ...SEATS,
 ...BEDS,
 {id:"tv",label:"Watch TV",type:"tv",position:[0,0,-7.25],rotation:0},
 {id:"music-system",label:"Use music system",type:"music",position:[4.7,0,-7.55],rotation:0}
];
function RealFurniture({url,position=[0,0,0],rotation=0,scale=1}){
 const gltf=useGLTF(url);
 const scene=useMemo(()=>{const s=SkeletonUtils.clone(gltf.scene);s.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});return s},[gltf.scene]);
 return <primitive object={scene} position={position} rotation={[0,rotation,0]} scale={scale}/>;
}


const OBSTACLES=[
  {x:-10,z:-7.05,rx:1.34,rz:.52,vault:false,name:"livingSofaA"},
  {x:-10,z:-4.05,rx:1.34,rz:.52,vault:false,name:"livingSofaB"},
  {x:-10,z:-5.55,rx:.72,rz:.42,vault:true,name:"livingTable"},
  {x:-13.0,z:-5.55,rx:.55,rz:.55,vault:true,name:"livingChairL"},
  {x:-7.0,z:-5.55,rx:.55,rz:.55,vault:true,name:"livingChairR"},
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

function Sofa({position=[0,0,0],rotation=0,width=3.4}){return <RealFurniture url={FURNITURE.sofa} position={position} rotation={rotation} scale={width/2.5}/>}

function Chair({position=[0,0,0],rotation=0}){return <RealFurniture url={FURNITURE.armchair} position={position} rotation={rotation} scale={1.18}/>}

function CoffeeTable({x,z}){return <RealFurniture url={FURNITURE.coffee} position={[x,0,z]} scale={1.67}/>}

function DiningTable(){return <group position={[10,0,5.8]}><RealFurniture url={FURNITURE.diningTable} scale={2.2}/>{[[-1.45,0,-1.9],[0,0,-1.9],[1.45,0,-1.9],[-1.45,0,1.9],[0,0,1.9],[1.45,0,1.9]].map((p,i)=><RealFurniture key={i} url={FURNITURE.diningChair} position={[p[0],0,p[2]]} rotation={p[2]<0?0:Math.PI} scale={1.7}/>)}</group>}

function Bed({x,z,rotation=0}){return <RealFurniture url={FURNITURE.bed} position={[x,0,z]} rotation={rotation} scale={1.65}/>}


function Snack({item,state,players}){
  const ref=useRef();
  const holder=state?.heldBy?players[state.heldBy]:null;
  const consumed=!!state?.consumed;
  const gltf=useGLTF(FOOD_ASSETS[item.kind]);
  const scene=useMemo(()=>{
    const s=SkeletonUtils.clone(gltf.scene);
    s.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
    return s;
  },[gltf.scene]);
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

function FloorLamp({x,z}){return <RealFurniture url={FURNITURE.lamp} position={[x,0,z]} scale={1}/>}

function Plant({x,z,s=1}) {
  return <group position={[x,0,z]} scale={s}>
    <mesh castShadow position={[0,.3,0]}><cylinderGeometry args={[.3,.38,.6,24]}/><meshStandardMaterial color="#554035" roughness={.9}/></mesh>
    {[[0,.92,0],[-.3,1.0,.08],[.3,1.05,-.05],[-.18,1.3,0],[.18,1.28,.05]].map((p,i)=>
      <mesh key={i} castShadow position={p} scale={[1,.75,1]}><sphereGeometry args={[.28,14,10]}/><meshStandardMaterial color={i%2?"#2d7654":"#3c9466"} roughness={1}/></mesh>
    )}
  </group>
}

function Rug({x,z,w,d}) {
  return <mesh receiveShadow position={[x,.025,z]} rotation={[-Math.PI/2,0,0]}>
    <planeGeometry args={[w,d]}/><meshStandardMaterial color="#252b38" roughness={1}/>
  </mesh>
}

function TV({playing}) {
  const bars=Array.from({length:18},(_,i)=>.15+.12*((i*7)%5));
  return <group position={[0,4.05,-9.2]}>
    <RoundedBox castShadow args={[9.2,4.6,.28]} radius={.22} smoothness={6}>
      <meshStandardMaterial color="#171a22" roughness={.28} metalness={.45}/>
    </RoundedBox>
    <mesh position={[0,0,.18]}><planeGeometry args={[8.65,4.05]}/><meshStandardMaterial color={playing?"#17162e":"#090c12"} emissive={playing?"#4a3b99":"#0b0e15"} emissiveIntensity={playing?1.3:.25}/></mesh>
    <Text position={[-3.65,1.45,.23]} fontSize={.26} color="#a99bff" anchorX="left">GC RADIO</Text>
    <Text position={[-3.65,.78,.23]} fontSize={.42} color="#ffffff" anchorX="left">{playing?TRACK.title:"HANGOUT DISPLAY"}</Text>
    <Text position={[-3.65,.30,.23]} fontSize={.2} color="#aaa5b9" anchorX="left">{playing?TRACK.artist:"Press Music to start the room mix"}</Text>
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
  return <group position={[0,.035,0]}>
    <mesh rotation={[-Math.PI/2,0,0]}><ringGeometry args={[4.9,5.02,64]}/><meshBasicMaterial color="#4f5364" transparent opacity={.42}/></mesh>
    <Text position={[0,.03,-.2]} rotation={[-Math.PI/2,0,0]} fontSize={.34} color="#5c6170">OPEN SOCIAL FLOOR</Text>
  </group>
}

function Hall({musicPlaying,players,snackStates}) {
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
    <Sofa position={[-10,0,-7.05]} rotation={Math.PI}/>
    <Sofa position={[-10,0,-4.05]} rotation={0}/>
    <CoffeeTable x={-10} z={-5.55}/>
    <Chair position={[-13.0,0,-5.55]} rotation={Math.PI/2}/>
    <Chair position={[-7.0,0,-5.55]} rotation={-Math.PI/2}/>
    <FloorLamp x={-13.8} z={-7.7}/>
    <Plant x={-13.9} z={-3.0} s={1.1}/>

    <TV playing={musicPlaying}/>
    <Speakers playing={musicPlaying}/>

    <Rug x={10} z={5.8} w={7.2} d={5.8}/>
    <DiningTable/>
    <Kitchen/>
    <FloorLamp x={13.9} z={7.9}/>

    <Rug x={10} z={-6.1} w={6.4} d={6.4}/>
    <Bed x={8.7} z={-6.2} rotation={Math.PI/2}/>
    <Bed x={12.2} z={-6.2} rotation={Math.PI/2}/>
    <Text position={[10.5,1.75,-8.45]} rotation={[0,0,0]} fontSize={.28} color="#b6afc6">REST / RESET</Text>

    <Plant x={-13.7} z={8.3} s={1.15}/>
    <Plant x={13.7} z={8.3} s={1.0}/>
    <Plant x={-3.0} z={9.0} s={.8}/>
    <WallArt x={-6.0} z={-9.78}/>
    <WallArt x={6.0} z={-9.78}/>
    <OpenFloorMark/>
    <Snacks players={players} snackStates={snackStates}/>
  </group>
}

function WallArt({x,z}) {
  return <group position={[x,4.0,z]}>
    <RoundedBox args={[2.6,1.5,.08]} radius={.04} smoothness={3}><meshStandardMaterial color="#181b22" roughness={.5}/></RoundedBox>
    <mesh position={[0,0,.06]}><planeGeometry args={[2.25,1.15]}/><meshStandardMaterial color="#596172" roughness={.8}/></mesh>
    <mesh position={[0,.05,.08]} rotation={[0,0,.3]}><boxGeometry args={[1.1,.08,.03]}/><meshStandardMaterial color="#c0a77f"/></mesh>
  </group>
}

function RealHuman({player,me}) {
  const {scene,animations}=useGLTF(HUMAN_URL);
  const root=useRef();
  const model=useMemo(()=>SkeletonUtils.clone(scene),[scene]);
  const {actions}=useAnimations(animations,root);
  const clipRef=useRef(null);
  const poseRef=useRef(0);
  const bones=useMemo(()=>{
    const b={thighL:null,thighR:null,shinL:null,shinR:null,footL:null,footR:null,spine:null,upperArmL:null,upperArmR:null,forearmL:null,forearmR:null};
    model.traverse(o=>{
      if(!o.isBone)return;
      const n=o.name.toLowerCase().replace(/[^a-z0-9]/g,"");
      const left=/(left|l)$/.test(n)||n.includes("left");
      const right=/(right|r)$/.test(n)||n.includes("right");
      if(!b.thighL&&left&&/(thigh|upperleg|upleg)/.test(n))b.thighL=o;
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

  useEffect(()=>{model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})},[model]);

  useEffect(()=>{
    if(!actions)return;
    const names=Object.keys(actions);
    const idle=names.find(n=>/idle/i.test(n))||names[0];
    const walk=names.find(n=>/walk/i.test(n))||idle;
    const run=names.find(n=>/run/i.test(n))||walk;
    const grasp=names.find(n=>/grasp/i.test(n))||idle;
    const locked=player.action==="sit"||player.action==="sleep";
    const desired=locked?null:(player.action==="eat"||player.action==="drink"?grasp:(player.speed||0)>3.15?run:(player.speed||0)>.08?walk:idle);
    if(desired===clipRef.current)return;
    const prev=clipRef.current?actions[clipRef.current]:null;
    if(prev)prev.fadeOut(.2);
    if(desired&&actions[desired]){
      actions[desired].reset().fadeIn(.2).play();
      clipRef.current=desired;
    }else clipRef.current=null;
  },[actions,player.action,player.speed]);

  useFrame((_,dt)=>{
    if(!root.current)return;
    const a=1-Math.exp(-18*dt);
    root.current.position.x+=(player.x-root.current.position.x)*a;
    root.current.position.z+=(player.z-root.current.position.z)*a;
    const seated=player.action==="sit";
    const sleeping=player.action==="sleep";
    const yTarget=seated?.10:sleeping?.03:0;
    root.current.position.y+=(yTarget-root.current.position.y)*a;
    const targetRot=player.poseRotation??player.rot??0;
    root.current.rotation.y+=Math.atan2(Math.sin(targetRot-root.current.rotation.y),Math.cos(targetRot-root.current.rotation.y))*a;
    root.current.rotation.x+=(0-root.current.rotation.x)*a;

    const targetPose=seated?1:sleeping?.65:0;
    poseRef.current+=(targetPose-poseRef.current)*(1-Math.exp(-10*dt));
    const p=poseRef.current;

    if(bones.thighL)bones.thighL.rotation.x=-1.05*p;
    if(bones.thighR)bones.thighR.rotation.x=-1.05*p;
    if(bones.shinL)bones.shinL.rotation.x=1.25*p;
    if(bones.shinR)bones.shinR.rotation.x=1.25*p;
    if(bones.footL)bones.footL.rotation.x=-.22*p;
    if(bones.footR)bones.footR.rotation.x=-.22*p;
    if(bones.spine)bones.spine.rotation.x=.12*p;
    if(bones.upperArmL)bones.upperArmL.rotation.x=-.08*p;
    if(bones.upperArmR)bones.upperArmR.rotation.x=-.08*p;

    const active=clipRef.current?actions[clipRef.current]:null;
    if(active){
      active.timeScale=/run/i.test(clipRef.current)?clamp((player.speed||3.9)/3.9,.82,1.16):/walk/i.test(clipRef.current)?clamp((player.speed||2.1)/2.1,.72,1.3):1;
    }
  });

  return <group ref={root} position={[player.x||0,0,player.z||0]} scale={[.98,.98,.98]}>
    <primitive object={model}/>
    <Text position={[0,2.05,0]} fontSize={.14} color={me?"#bbaeff":"#ffffff"} anchorX="center" outlineWidth={.012} outlineColor="#11131a">
      {player.name}{me?" • you":""}
    </Text>
    {player.attacking&&<Text position={[0,2.32,0]} fontSize={.18} color="#ffd36b" anchorX="center">POW!</Text>}
    {player.action&&player.action!=="moving"&&<Text position={[0,2.52,0]} fontSize={.11} color="#b8b1c4" anchorX="center">{player.action.toUpperCase()}</Text>}
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

function PlayerController({posRef,moveRef,onMove,viewRef,interactionRef,onInteractionArrive}) {
  const velocity=useRef({x:0,z:0}),lastSend=useRef(0),hopRef=useRef(0);
  useFrame(({camera},dt)=>{
    const d=Math.min(dt,.05),m=moveRef.current,v=viewRef.current;

    if(interactionRef.current){
      const target=interactionRef.current;
      const p=posRef.current;
      const dx=target.position[0]-p.x,dz=target.position[2]-p.z;
      const dist=Math.hypot(dx,dz);
      if(dist>.055){
        const speed=4.6,step=Math.min(dist,speed*d),nx=p.x+dx/dist*step,nz=p.z+dz/dist*step;
        const next={...p,x:nx,z:nz,rot:target.rotation,moving:true,speed:step/Math.max(d,.001),action:"moving",poseRotation:target.rotation};
        velocity.current.x=dx/dist*speed;velocity.current.z=dz/dist*speed;
        posRef.current=next;
        const now=performance.now();if(now-lastSend.current>33){lastSend.current=now;onMove(next)}
      }else{
        const next={...p,x:target.position[0],z:target.position[2],rot:target.rotation,moving:false,speed:0,action:target.finalAction,poseRotation:target.rotation,interactionId:target.id};
        velocity.current.x=0;velocity.current.z=0;posRef.current=next;interactionRef.current=null;
        onMove(next);onInteractionArrive?.(target);
      }
    } else {
      const d2=Math.min(dt,.05),m2=moveRef.current,v2=viewRef.current;
      const viewLerp=1-Math.exp(-18*d2);
      v2.yaw+=Math.atan2(Math.sin(v2.targetYaw-v2.yaw),Math.cos(v2.targetYaw-v2.yaw))*viewLerp;
      v2.pitch+=(v2.targetPitch-v2.pitch)*viewLerp;
      const forward={x:-Math.sin(v2.yaw),z:-Math.cos(v2.yaw)},right={x:Math.cos(v2.yaw),z:-Math.sin(v2.yaw)};
      const inputForward=-m2.z;
      const ix=m2.x*right.x+inputForward*forward.x,iz=m2.x*right.z+inputForward*forward.z,len=Math.hypot(ix,iz)||1;
      const lockedPose=posRef.current.action==="sit"||posRef.current.action==="sleep";
      const movingInput=!lockedPose&&Math.abs(m2.x)+Math.abs(m2.z)>.05,targetSpeed=3.9;
      const tx=lockedPose?0:ix/len*targetSpeed,tz=lockedPose?0:iz/len*targetSpeed;
      velocity.current.x+=(tx-velocity.current.x)*Math.min(1,(movingInput?14:18)*d2);
      velocity.current.z+=(tz-velocity.current.z)*Math.min(1,(movingInput?14:18)*d2);
      if(!movingInput){velocity.current.x*=Math.max(0,1-10*d2);velocity.current.z*=Math.max(0,1-10*d2)}
      const speed=Math.hypot(velocity.current.x,velocity.current.z);
      if(speed>.025){
        const before=posRef.current,step=tryMove(before.x,before.z,velocity.current.x*d2,velocity.current.z*d2);
        if(step.hop)hopRef.current=performance.now()+420;
        const next={...before,x:step.x,z:step.z,rot:Math.atan2(velocity.current.x,velocity.current.z),moving:speed>.06,speed,hopUntil:hopRef.current};
        const movementYaw=next.rot;
        const forwardInput=-m2.z;
        if(Math.abs(forwardInput)>.58 && performance.now()-v2.lastManualCamera>850){
          const desiredYaw=movementYaw-Math.PI;
          v2.targetYaw+=Math.atan2(Math.sin(desiredYaw-v2.targetYaw),Math.cos(desiredYaw-v2.targetYaw))*Math.min(1,1.35*d2);
        }
        posRef.current=next;
        const now=performance.now();if(now-lastSend.current>33){lastSend.current=now;onMove(next)}
      }else if(posRef.current.moving){
        const next={...posRef.current,moving:false,speed:0,hopUntil:0};posRef.current=next;onMove(next);
      }
    }

    const t=posRef.current,dist=v.distance;
    const horizontal=Math.cos(v.pitch)*dist;
    const rawX=t.x+Math.sin(v.yaw)*horizontal;
    const rawZ=t.z+Math.cos(v.yaw)*horizontal;
    const rawY=1.05+Math.sin(v.pitch)*dist;
    const camX=clamp(rawX,-HALL_HALF_X+1.65,HALL_HALF_X-1.65);
    const camZ=clamp(rawZ,-HALL_HALF_Z+1.65,HALL_HALF_Z-1.65);
    const camY=clamp(rawY,.75,6.8);
    const follow=Math.min(1,8.5*d);
    camera.position.x+=(camX-camera.position.x)*follow;
    camera.position.y+=(camY-camera.position.y)*follow;
    camera.position.z+=(camZ-camera.position.z)*follow;
    camera.lookAt(t.x,t.y+.9,t.z);
  });
  return null;
}
function Room({local,players,onMove,onAttack,musicPlaying,onToggleMusic,onInteract,onInteractionArrive,locks,snackStates}) {
  const [move,setMove]=useState({x:0,z:0});
  const [candidate,setCandidate]=useState(null);
  const moveRef=useRef(move);moveRef.current=move;
  const setMoveImmediate=v=>{moveRef.current=v;setMove(v)};
  const posRef=useRef({...local});
  const interactionRef=useRef(null);
  const viewRef=useRef({yaw:0,pitch:.28,distance:6.8,targetYaw:0,targetPitch:.28,lastManualCamera:0});
  const cameraDrag=useRef(null);

  const requestInteraction=(item)=>{
    if((item?.type==="seat"||item?.type==="bed")&&!interactionRef.current){
      interactionRef.current=item;
    }
    onInteract(item);
  };

  useEffect(()=>{
    const timer=setInterval(()=>{
      const p=posRef.current;
      if(p.action&&p.interactionId){setCandidate({id:p.interactionId,label:"Stand up",type:"stand",position:[p.x,0,p.z],rotation:p.poseRotation||p.rot});return}
      let best=null,dist=2.15;
      const list=[...INTERACTABLES,...SNACKS];
      for(const item of list){
        if(item.type==="bed"&&!item.position)continue;
        if(item.id in locks)continue;
        if(item.id in snackStates&&snackStates[item.id]?.consumed)continue;
        const d=Math.hypot(p.x-item.position[0],p.z-item.position[2]);
        if(d<dist&&lineClear(p.x,p.z,item.position[0],item.position[2])){dist=d;best=item}
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
      if((k==="w"||k==="a"||k==="s"||k==="d"||k.startsWith("arrow"))&&(posRef.current.action==="sit"||posRef.current.action==="sleep")){
        requestInteraction({id:posRef.current.interactionId,type:"stand",position:[posRef.current.x,0,posRef.current.z],rotation:posRef.current.poseRotation||posRef.current.rot,label:"Stand up"});
      }
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      e.preventDefault();
      const next={x:k==="a"||k==="arrowleft"? -1:k==="d"||k==="arrowright"?1:moveRef.current.x,z:k==="w"||k==="arrowup"?-1:k==="s"||k==="arrowdown"?1:moveRef.current.z};setMoveImmediate(next);
    };
    const up=e=>{
      const k=e.key.toLowerCase();
      if(!"wasd".includes(k)&&!["arrowup","arrowdown","arrowleft","arrowright"].includes(k))return;
      const next={x:(k==="a"||k==="arrowleft"||k==="d"||k==="arrowright")?0:moveRef.current.x,z:(k==="w"||k==="arrowup"||k==="s"||k==="arrowdown")?0:moveRef.current.z};setMoveImmediate(next);
    };
    window.addEventListener("keydown",down);window.addEventListener("keyup",up);
    return()=>{window.removeEventListener("keydown",down);window.removeEventListener("keyup",up)};
  },[onInteract,candidate]);

  const joystickAt=(el,x,y)=>{
    if(posRef.current.action==="sit"||posRef.current.action==="sleep"){
      const stand={id:posRef.current.interactionId,type:"stand",position:[posRef.current.x,0,posRef.current.z],rotation:posRef.current.poseRotation||posRef.current.rot,label:"Stand up"};
      requestInteraction(stand);
    }
    const r=el.getBoundingClientRect(),dx=x-r.left-r.width/2,dz=y-r.top-r.height/2;
    const len=Math.hypot(dx,dz),max=42,k=len>max?max/len:1;
    const px=dx*k,pz=dz*k;
    setMoveImmediate({x:clamp(px/42,-1,1),z:clamp(pz/42,-1,1)});
    el.style.setProperty("--jx",px+"px");el.style.setProperty("--jz",pz+"px");
  };
  const joystickPointer=e=>{e.preventDefault();joystickAt(e.currentTarget,e.clientX,e.clientY)};
  const stop=e=>{e.preventDefault();setMoveImmediate({x:0,z:0});e.currentTarget.style.setProperty("--jx","0px");e.currentTarget.style.setProperty("--jz","0px")};
  const beginCamera=e=>{
    if(e.pointerType!=="touch"&&e.pointerType!=="mouse")return;
    cameraDrag.current={x:e.clientX,y:e.clientY};
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const moveCamera=e=>{
    const s=cameraDrag.current;
    if(!s)return;
    const dx=e.clientX-s.x,dy=e.clientY-s.y;
    s.x=e.clientX;s.y=e.clientY;
    // PUBG-style direct swipe: horizontal orbit + vertical look, with smoothing in PlayerController.
    viewRef.current.lastManualCamera=performance.now();
    viewRef.current.targetYaw-=dx*.011;
    // Natural mobile-game convention: drag up -> look up, drag down -> look down.
    viewRef.current.targetPitch=clamp(viewRef.current.targetPitch+dy*.009,-.48,1.05);
  };
  const endCamera=()=>{cameraDrag.current=null};

  return <div className="room">
    <Canvas
      shadows dpr={[1,1.25]} performance={{min:.55}}
      camera={{position:[0,2.2,6.8],fov:58,near:.1,far:80}}
      onWheel={e=>{viewRef.current.distance=clamp(viewRef.current.distance+(e.deltaY>0?.4:-.4),4.2,8.6)}}
      onPointerDown={e=>{
        if(e.pointerType!=="mouse")return;
        cameraDrag.current={x:e.clientX,y:e.clientY};
        e.currentTarget.setPointerCapture?.(e.pointerId);
      }}
      onPointerMove={e=>{
        const s=cameraDrag.current;
        if(!s||e.pointerType!=="mouse")return;
        const dx=e.clientX-s.x,dy=e.clientY-s.y;s.x=e.clientX;s.y=e.clientY;
        viewRef.current.lastManualCamera=performance.now();
        viewRef.current.targetYaw-=dx*.0065;
        viewRef.current.targetPitch=clamp(viewRef.current.targetPitch+dy*.007,-.48,1.05);
      }}
      onPointerUp={()=>{cameraDrag.current=null}}
      onPointerCancel={()=>{cameraDrag.current=null}}
    >
      <PerspectiveCamera makeDefault position={[0,2.2,6.8]} fov={58}/>
      <PlayerController posRef={posRef} moveRef={moveRef} onMove={onMove} viewRef={viewRef} interactionRef={interactionRef} onInteractionArrive={onInteractionArrive}/>
      <color attach="background" args={["#0b0e14"]}/>
      <fog attach="fog" args={["#0b0e14",24,55]}/>
      <ambientLight intensity={.78}/>
      <directionalLight position={[2,10,5]} intensity={1.35} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <directionalLight position={[-8,5,-6]} intensity={.55} color="#9aa9ff"/>
      <Environment preset="warehouse" environmentIntensity={.35}/>
      <Hall musicPlaying={musicPlaying} players={players} snackStates={snackStates}/>
      <TV playing={musicPlaying}/>
      <Speakers playing={musicPlaying}/>
      <ContactShadows position={[0,0,0]} opacity={.18} scale={24} blur={3.2} far={11}/>
      {Object.values(players).map(p=>
        <Suspense key={p.id} fallback={<FallbackHuman player={p} me={p.id===local.id}/>}>
          <AssetBoundary fallback={<FallbackHuman player={p} me={p.id===local.id}/>}><RealHuman player={p} me={p.id===local.id}/></AssetBoundary>
        </Suspense>
      )}
    </Canvas>


    <div className="topbar"><b>🌙 GC HANGOUT HALL</b><span>● {Object.keys(players).length} online</span></div>
    <div className="zoneHint">Large open social floor • perimeter interaction zones</div>
    <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Room</strong> {Object.keys(players).length} people here</div><div className="input">Type a message…</div></div>
    {candidate&&<button className="interactionPrompt" onClick={()=>requestInteraction(candidate)}><span>↗</span>{candidate.label}</button>}
    <div className="controls">
      <button onClick={()=>candidate&&requestInteraction(candidate)}>✦ Interact</button>
      <button className={musicPlaying?"active":""} onClick={onToggleMusic}>🎵 Music</button>
      <button onClick={onAttack}>🥊 Fight</button>
      <button>💬 Chat</button>
    </div>
    <div className="cameraGesture" onPointerDown={e=>{e.preventDefault();beginCamera(e)}} onPointerMove={e=>{e.preventDefault();moveCamera(e)}} onPointerUp={endCamera} onPointerCancel={endCamera} aria-label="Swipe to rotate camera" />
    <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture?.(e.pointerId);joystickPointer(e)}} onPointerMove={joystickPointer} onPointerUp={stop} onPointerCancel={stop} onLostPointerCapture={stop}><div className="stick"/></div>
    <button className="mobileAction" onClick={()=>candidate&&requestInteraction(candidate)}>✦</button>
    <button className="fight" onClick={onAttack}>🥊</button>
  </div>
}

export default function Home(){
  const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya");
  const [id]=useState(makeId),[players,setPlayers]=useState({}),[musicPlaying,setMusicPlaying]=useState(false);
  const [locks,setLocks]=useState({}),[snackStates,setSnackStates]=useState({}),[action,setAction]=useState(null);
  const musicRef=useRef(false);
  musicRef.current=musicPlaying;
  const locksRef=useRef({}),snackStatesRef=useRef({});
  locksRef.current=locks;snackStatesRef.current=snackStates;
  const channelRef=useRef(null),localRef=useRef(null);

  const join=()=>{
    const p={id,name:name.trim()||"You",avatarId,x:0,y:0,z:0,rot:0,health:3,attacking:false,moving:false,speed:0,action:null,interactionId:null,poseRotation:0};
    localRef.current=p;setJoined(true);
  };

  useEffect(()=>{
    if(!joined)return;
    const supabase=getSupabase();
    if(!supabase){setPlayers(prev=>({...prev,[id]:localRef.current}));return}
    const channel=supabase.channel("gc-hangout-main",{config:{broadcast:{self:false},presence:{key:id}}});
    channelRef.current=channel;
    const send=p=>channel.send({type:"broadcast",event:"player_state",payload:p});
    channel.on("broadcast",{event:"player_state"},({payload})=>payload?.id&&setPlayers(prev=>({...prev,[payload.id]:payload})));
    channel.on("broadcast",{event:"request_state"},()=>localRef.current&&send(localRef.current));
    channel.on("broadcast",{event:"room_state"},({payload})=>{if(typeof payload?.musicPlaying==="boolean")setMusicPlaying(payload.musicPlaying)});
    channel.on("broadcast",{event:"request_room"},()=>channel.send({type:"broadcast",event:"room_state",payload:{musicPlaying:musicRef.current}}));
    channel.on("broadcast",{event:"attack"},({payload})=>{
      if(!payload?.id)return;
      setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:true}}:prev);
      setTimeout(()=>setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],attacking:false}}:prev),350);
      if(payload.targetId===id&&localRef.current){
        const nextHealth=Math.max(0,(localRef.current.health||3)-1),next={...localRef.current,health:nextHealth};
        localRef.current=next;setPlayers(prev=>({...prev,[id]:next}));send(next);
        if(nextHealth===0)setTimeout(()=>{
          const respawn={...localRef.current,x:0,z:0,health:3,attacking:false,action:null};
          localRef.current=respawn;setPlayers(prev=>({...prev,[id]:respawn}));send(respawn);
        },900);
      }
    });
    channel.on("broadcast",{event:"player_action"},({payload})=>{
      if(payload?.id)setPlayers(prev=>prev[payload.id]?{...prev,[payload.id]:{...prev[payload.id],...payload}}:prev)
    });
    channel.on("broadcast",{event:"interaction_lock"},({payload})=>{
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
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"&&localRef.current){
        setPlayers(prev=>({...prev,[id]:localRef.current}));
        await channel.track({id,name:localRef.current.name,avatarId});
        send(localRef.current);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_state",payload:{id}}),250);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_room",payload:{id}}),350);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_interaction_state",payload:{id}}),450);
      }
    });
    return()=>{channel.unsubscribe();channelRef.current=null};
  },[joined,id,avatarId]);

  const onMove=p=>{
    localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));
    channelRef.current?.send({type:"broadcast",event:"player_state",payload:p});
  };

  const toggleMusic=()=>{
    const next=!musicPlaying;setMusicPlaying(next);
    channelRef.current?.send({type:"broadcast",event:"room_state",payload:{musicPlaying:next}});
  };

  const onAttack=()=>{
    if(!localRef.current)return;
    const me=localRef.current,others=Object.values(players).filter(p=>p.id!==id);
    let target=null,best=99;
    for(const p of others){const d=Math.hypot(p.x-me.x,p.z-me.z);if(d<best){best=d;target=p}}
    const p={...me,attacking:true};localRef.current=p;setPlayers(prev=>({...prev,[id]:p}));
    channelRef.current?.send({type:"broadcast",event:"attack",payload:{id,targetId:target&&best<1.8?target.id:null}});
    setTimeout(()=>{if(localRef.current){localRef.current={...localRef.current,attacking:false};setPlayers(prev=>({...prev,[id]:localRef.current}))}},350);
  };

  const interact=(candidate)=>{
    if(!localRef.current||!candidate)return;
    const p=localRef.current;

    if(candidate.type==="stand"){
      const objectId=p.interactionId;
      const clear={...p,action:null,interactionId:null,poseRotation:p.rot,speed:0,moving:false};
      localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
      channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
      if(objectId){
        setLocks(prev=>{const next={...prev};delete next[objectId];return next});
        channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId,userId:id,locked:false}});
      }
      setAction(null);
      return;
    }

    if(locks[candidate.id]&&locks[candidate.id]!==id)return;

    if(candidate.type==="music"){
      toggleMusic();
      return;
    }

    if(candidate.type==="tv"){
      const payload={...p,action:"watch",interactionId:candidate.id,poseRotation:0,moving:false,speed:0};
      localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
      setLocks(prev=>({...prev,[candidate.id]:id}));
      channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:true}});
      channelRef.current?.send({type:"broadcast",event:"player_state",payload});
      setTimeout(()=>{
        if(localRef.current?.interactionId===candidate.id){
          const clear={...localRef.current,action:null,interactionId:null};
          localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
          channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
          setLocks(prev=>{const next={...prev};delete next[candidate.id];return next});
          channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:false}});
        }
      },5000);
      return;
    }

    if(candidate.type==="seat"||candidate.type==="bed"){
      const finalAction=candidate.type==="bed"?"sleep":"sit";
      interactionRef.current=candidate;
      const payload={...p,action:"moving",interactionId:null,poseRotation:candidate.rotation,moving:true,speed:3.2};
      localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
      setLocks(prev=>({...prev,[candidate.id]:id}));
      channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:true}});
      channelRef.current?.send({type:"broadcast",event:"player_state",payload});
      return;
    }

    const food=SNACKS.find(s=>s.id===candidate.id);
    if(food){
      const state=snackStates[food.id];
      if(state?.consumed||state?.heldBy)return;
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
        setLocks(prev=>{const next={...prev};delete next[food.id];return next});
        channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:food.id,userId:id,locked:false}});
      },1500);
    }
  };

  const interactionArrived=(candidate)=>{
    if(!localRef.current)return;
    const finalAction=candidate.finalAction||(candidate.type==="bed"?"sleep":"sit");
    const payload={...localRef.current,action:finalAction,interactionId:candidate.id,moving:false,speed:0,poseRotation:candidate.rotation};
    localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
    channelRef.current?.send({type:"broadcast",event:"player_state",payload});
    setAction(finalAction);
    setTimeout(()=>{
      if(localRef.current?.interactionId===candidate.id&&localRef.current?.action===finalAction){
        const clear={...localRef.current,action:null,interactionId:null,poseRotation:localRef.current.rot};
        localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
        channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
        setLocks(prev=>{const next={...prev};delete next[candidate.id];return next});
        channelRef.current?.send({type:"broadcast",event:"interaction_lock",payload:{objectId:candidate.id,userId:id,locked:false}});
      }
    },7000);
  };

  if(joined)return <Room local={localRef.current} players={players} locks={locks} snackStates={snackStates} onMove={onMove} onAttack={onAttack} musicPlaying={musicPlaying} onToggleMusic={toggleMusic} onInteract={interact} onInteractionArrive={interactionArrived}/>;

  return <main className="join">
    <div className="card">
      <div className="logo">🌙</div><h1>GC Hangout Hall</h1>
      <p>One large shared hall built around movement, camera space and multiplayer interaction.</p>
      <label>Your name<input value={name} onChange={e=>setName(e.target.value.slice(0,18))} placeholder="e.g. Rishi"/></label>
      <div className="label">Choose your human</div>
      <div className="avatars">{PRESETS.map((p,i)=>
        <button className={avatarId===p.id?"selected":""} onClick={()=>setAvatarId(p.id)} key={p.id}>
          <span>{i%3===0?"👩":i%3===1?"👨":"🧑"}</span><small>{p.label}</small>
        </button>
      )}</div>
      <button className="enter" onClick={join} disabled={!name.trim()}>Enter the hall →</button>
      <div className="note">Open-plan hall • smooth movement • shared music • multiplayer</div>
    </div>
  </main>;
}
