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

const OBSTACLES=[
  {x:-10,z:-7.55,rx:3.7,rz:.9,vault:false,name:"living"},
  {x:-10,z:-4.95,rx:3.7,rz:.55,vault:false,name:"livingFront"},
  {x:0,z:-8.95,rx:5.2,rz:.72,vault:false,name:"tv"},
  {x:-5.8,z:-7.55,rx:1.65,rz:.9,vault:true,name:"tvSofa"},
  {x:9.5,z:-6.7,rx:2.6,rz:1.15,vault:true,name:"rest"},
  {x:10.3,z:5.9,rx:3.0,rz:2.0,vault:true,name:"dining"},
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
const tryMove=(x,z,dx,dz)=>{
  const nx=x+dx,nz=z+dz;
  if(!blocked(nx,nz))return{x:nx,z:nz,hop:false};
  if(!blocked(nx,z))return{x:nx,z,hop:false};
  if(!blocked(x,nz))return{x,z:nz,hop:false};
  const b=OBSTACLES.find(o=>{
    const qx=clamp(nx,o.x-o.rx,o.x+o.rx),qz=clamp(nz,o.z-o.rz,o.z+o.rz);
    return Math.hypot(nx-qx,nz-qz)<PLAYER_RADIUS&&o.vault;
  });
  if(b){
    const len=Math.hypot(dx,dz)||1,leap=.95;
    const vx=nx+dx/len*leap,vz=nz+dz/len*leap;
    if(!blocked(vx,vz))return{x:vx,z:vz,hop:true};
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

function Sofa({position=[0,0,0],rotation=0,width=3.4}) {
  return <group position={position} rotation={[0,rotation,0]}>
    <RoundedBox castShadow args={[width,.48,1.0]} radius={.16} smoothness={6} position={[0,.48,0]}>
      <meshStandardMaterial color="#3e4859" roughness={.82}/>
    </RoundedBox>
    <RoundedBox castShadow args={[width,1.05,.28]} radius={.12} smoothness={5} position={[0,1.02,-.36]}>
      <meshStandardMaterial color="#465366" roughness={.85}/>
    </RoundedBox>
    <RoundedBox castShadow args={[.28,.92,.92]} radius={.1} smoothness={5} position={[-width/2+.18,.88,0]}>
      <meshStandardMaterial color="#465366" roughness={.85}/>
    </RoundedBox>
    <RoundedBox castShadow args={[.28,.92,.92]} radius={.1} smoothness={5} position={[width/2-.18,.88,0]}>
      <meshStandardMaterial color="#465366" roughness={.85}/>
    </RoundedBox>
  </group>
}

function Chair({position=[0,0,0],rotation=0}) {
  return <group position={position} rotation={[0,rotation,0]}>
    <RoundedBox castShadow args={[.82,.38,.82]} radius={.12} smoothness={5} position={[0,.48,0]}>
      <meshStandardMaterial color="#4b5666" roughness={.84}/>
    </RoundedBox>
    <RoundedBox castShadow args={[.82,.85,.22]} radius={.1} smoothness={5} position={[0,.96,-.3]}>
      <meshStandardMaterial color="#566274" roughness={.84}/>
    </RoundedBox>
    {[[-.28,.23,-.28],[.28,.23,-.28],[-.28,.23,.28],[.28,.23,.28]].map((p,i)=>
      <mesh key={i} castShadow position={p}><cylinderGeometry args={[.045,.045,.45,10]}/><meshStandardMaterial color="#262b34" metalness={.55}/></mesh>
    )}
  </group>
}

function CoffeeTable({x,z}) {
  return <group position={[x,0,z]}>
    <RoundedBox castShadow args={[2.0,.16,1.0]} radius={.08} smoothness={5} position={[0,.52,0]}>
      <meshStandardMaterial color="#8a664e" roughness={.58}/>
    </RoundedBox>
    {[[-.75,.25,-.32],[.75,.25,-.32],[-.75,.25,.32],[.75,.25,.32]].map((p,i)=>
      <mesh key={i} castShadow position={p}><cylinderGeometry args={[.055,.07,.5,12]}/><meshStandardMaterial color="#302a28" metalness={.4}/></mesh>
    )}
  </group>
}

function DiningTable() {
  return <group position={[10.0,0,5.8]}>
    <RoundedBox castShadow args={[4.4,.22,2.2]} radius={.12} smoothness={5} position={[0,.82,0]}>
      <meshStandardMaterial color="#705443" roughness={.6}/>
    </RoundedBox>
    {[[-1.55,.4,-.75],[1.55,.4,-.75],[-1.55,.4,.75],[1.55,.4,.75],[0,.4,-.75],[0,.4,.75]].map((p,i)=>
      <mesh key={i} castShadow position={p}><cylinderGeometry args={[.08,.1,.75,14]}/><meshStandardMaterial color="#2b2a2e" metalness={.35}/></mesh>
    )}
    {[[-1.45,0,-1.9],[0,0,-1.9],[1.45,0,-1.9],[-1.45,0,1.9],[0,0,1.9],[1.45,0,1.9]].map((p,i)=>
      <Chair key={i} position={[p[0],0,p[2]]} rotation={p[2]<0?0:Math.PI}/>
    )}
    <Text position={[0,1.25,0]} rotation={[-Math.PI/2,0,0]} fontSize={.2} color="#d7c1a6">DINING</Text>
  </group>
}

function Bed({x,z,rotation=0}) {
  return <group position={[x,0,z]} rotation={[0,rotation,0]}>
    <RoundedBox castShadow args={[2.6,.35,4.2]} radius={.1} smoothness={5} position={[0,.42,0]}>
      <meshStandardMaterial color="#313847" roughness={.8}/>
    </RoundedBox>
    <RoundedBox castShadow args={[2.45,.28,2.6]} radius={.1} smoothness={5} position={[0,.72,.45]}>
      <meshStandardMaterial color="#d6d1c8" roughness={.95}/>
    </RoundedBox>
    <RoundedBox castShadow args={[2.3,.42,.55]} radius={.12} smoothness={5} position={[0,.86,-1.55]}>
      <meshStandardMaterial color="#ebe7df" roughness={.9}/>
    </RoundedBox>
    <RoundedBox castShadow args={[2.8,1.5,.16]} radius={.05} smoothness={4} position={[0,1.0,-2.0]}>
      <meshStandardMaterial color="#3a4250" roughness={.7}/>
    </RoundedBox>
  </group>
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

function FloorLamp({x,z}) {
  return <group position={[x,0,z]}>
    <mesh castShadow position={[0,1.65,0]}><cylinderGeometry args={[.035,.035,3.3,12]}/><meshStandardMaterial color="#252932" metalness={.65} roughness={.32}/></mesh>
    <mesh castShadow position={[0,3.25,0]}><coneGeometry args={[.42,.5,24]}/><meshStandardMaterial color="#e5d7bd" emissive="#fff1cf" emissiveIntensity={.22}/></mesh>
    <pointLight position={[0,3.0,0]} intensity={1.2} distance={5.5} color="#ffe7be"/>
  </group>
}

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

function Hall({musicPlaying}) {
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
    <Sofa position={[-10,0,-7.55]} rotation={0} width={6.8}/>
    <Sofa position={[-10,0,-4.55]} rotation={Math.PI} width={6.8}/>
    <CoffeeTable x={-10} z={-6.0}/>
    <FloorLamp x={-13.8} z={-7.7}/>
    <Plant x={-13.9} z={-3.0} s={1.1}/>

    <TV playing={musicPlaying}/>
    <Speakers playing={musicPlaying}/>
    <Sofa position={[-5.8,0,-7.55]} rotation={0} width={3.0}/>

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
  useEffect(()=>{
    if(!actions)return;
    const names=Object.keys(actions);
    const idle=names.find(n=>/idle/i.test(n))||names[0];
    const walk=names.find(n=>/walk/i.test(n))||idle;
    const grasp=names.find(n=>/grasp|eat|drink/i.test(n))||walk;
    const clip=player.action==="eat"||player.action==="drink"?grasp:player.moving?walk:idle;
    Object.values(actions).forEach(a=>a?.stop());
    actions[clip]?.reset().fadeIn(.18).play();
    return()=>actions[clip]?.fadeOut(.12);
  },[actions,player.moving,player.action]);

  useEffect(()=>{model.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}})},[model]);

  useFrame((_,dt)=>{
    if(!root.current)return;
    const a=Math.min(1,13*dt),target=player.rot||0;
    root.current.position.x+=(player.x-root.current.position.x)*a;
    root.current.position.z+=(player.z-root.current.position.z)*a;
    const hop=player.hopUntil&&player.hopUntil>Date.now()?Math.sin(((player.hopUntil-Date.now())/420)*Math.PI)*.52:0;
    const actionY=player.action==="sit"?.48:player.action==="sleep"?.12:0;
    root.current.position.y+=(hop+actionY-root.current.position.y)*a;
    const targetRot=player.action==="sleep"?0:target;
    root.current.rotation.y+=Math.atan2(Math.sin(targetRot-root.current.rotation.y),Math.cos(targetRot-root.current.rotation.y))*a;
    if(player.action==="sleep")root.current.rotation.x+=(Math.PI/2-root.current.rotation.x)*a;
    else root.current.rotation.x+=(0-root.current.rotation.x)*a;
  });

  return <group ref={root} position={[player.x||0,0,player.z||0]} scale={[.98,.98,.98]}>
    <primitive object={model}/>
    <Text position={[0,2.05,0]} fontSize={.14} color={me?"#bbaeff":"#ffffff"} anchorX="center" outlineWidth={.012} outlineColor="#11131a">
      {player.name}{me?" • you":""}
    </Text>
    {player.attacking&&<Text position={[0,2.32,0]} fontSize={.18} color="#ffd36b" anchorX="center">POW!</Text>}
    {player.action&&player.action!=="walk"&&<Text position={[0,2.52,0]} fontSize={.11} color="#b8b1c4" anchorX="center">{player.action.toUpperCase()}</Text>}
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

function PlayerController({posRef,moveRef,onMove,viewRef}) {
  const velocity=useRef({x:0,z:0}),lastSend=useRef(0),hopRef=useRef(0);
  useFrame(({camera},dt)=>{
    const d=Math.min(dt,.05),m=moveRef.current,v=viewRef.current;
    const viewLerp=1-Math.exp(-12*d);
    v.yaw+=Math.atan2(Math.sin(v.targetYaw-v.yaw),Math.cos(v.targetYaw-v.yaw))*viewLerp;
    v.pitch+=(v.targetPitch-v.pitch)*viewLerp;
    const forward={x:-Math.sin(v.yaw),z:-Math.cos(v.yaw)},right={x:Math.cos(v.yaw),z:-Math.sin(v.yaw)};
    const ix=m.x*right.x+m.z*forward.x,iz=m.x*right.z+m.z*forward.z,len=Math.hypot(ix,iz)||1;
    const moving=Math.abs(m.x)+Math.abs(m.z)>.05,targetSpeed=3.9;
    const tx=ix/len*targetSpeed,tz=iz/len*targetSpeed;
    velocity.current.x+=(tx-velocity.current.x)*Math.min(1,(moving?10:14)*d);
    velocity.current.z+=(tz-velocity.current.z)*Math.min(1,(moving?10:14)*d);
    if(!moving){velocity.current.x*=Math.max(0,1-10*d);velocity.current.z*=Math.max(0,1-10*d)}
    const speed=Math.hypot(velocity.current.x,velocity.current.z);
    if(speed>.025){
      const before=posRef.current,step=tryMove(before.x,before.z,velocity.current.x*d,velocity.current.z*d);
      if(step.hop)hopRef.current=performance.now()+420;
      const next={...before,x:step.x,z:step.z,rot:Math.atan2(velocity.current.x,velocity.current.z),moving:true,hopUntil:hopRef.current};
      posRef.current=next;
      const now=performance.now();if(now-lastSend.current>65){lastSend.current=now;onMove(next)}
    }else if(posRef.current.moving){
      const next={...posRef.current,moving:false,hopUntil:0};posRef.current=next;onMove(next);
    }

    const t=posRef.current,dist=v.distance;
    const rawX=t.x+Math.sin(v.yaw)*dist,rawZ=t.z+Math.cos(v.yaw)*dist;
    const camX=clamp(rawX,-HALL_HALF_X+1.1,HALL_HALF_X-1.1),camZ=clamp(rawZ,-HALL_HALF_Z+1.1,HALL_HALF_Z-1.1);
    const camY=2.05+Math.sin(v.pitch)*dist*.72;
    const follow=Math.min(1,6.5*d);
    camera.position.x+=(camX-camera.position.x)*follow;
    camera.position.y+=(camY-camera.position.y)*follow;
    camera.position.z+=(camZ-camera.position.z)*follow;
    camera.lookAt(t.x,t.y+.9,t.z);
  });
  return null;
}

function Room({local,players,onMove,onAttack,musicPlaying,onToggleMusic,onInteract}) {
  const [move,setMove]=useState({x:0,z:0});
  const moveRef=useRef(move);moveRef.current=move;
  const posRef=useRef({...local});
  const viewRef=useRef({yaw:0,pitch:.28,distance:6.8,targetYaw:0,targetPitch:.28});
  const cameraDrag=useRef(null);

  useEffect(()=>{
    const down=e=>{
      if(["INPUT","TEXTAREA"].includes(document.activeElement?.tagName))return;
      const k=e.key.toLowerCase();
      if(k===" "){e.preventDefault();onInteract();return}
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
  },[onInteract]);

  const joystick=e=>{
    const r=e.currentTarget.getBoundingClientRect(),x=e.clientX-r.left-r.width/2,z=e.clientY-r.top-r.height/2;
    setMove({x:clamp(x/55,-1,1),z:clamp(z/55,-1,1)});
    e.currentTarget.style.setProperty("--jx",clamp(x,-38,38)+"px");
    e.currentTarget.style.setProperty("--jz",clamp(z,-38,38)+"px");
  };
  const stop=e=>{setMove({x:0,z:0});e.currentTarget.style.setProperty("--jx","0px");e.currentTarget.style.setProperty("--jz","0px")};
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
    viewRef.current.targetYaw-=dx*.0042;
    viewRef.current.targetPitch=clamp(viewRef.current.targetPitch-dy*.006,-.55,1.12);
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
        viewRef.current.targetYaw-=dx*.0042;
        viewRef.current.targetPitch=clamp(viewRef.current.targetPitch-dy*.006,-.55,1.12);
      }}
      onPointerUp={()=>{cameraDrag.current=null}}
      onPointerCancel={()=>{cameraDrag.current=null}}
    >
      <PerspectiveCamera makeDefault position={[0,2.2,6.8]} fov={58}/>
      <PlayerController posRef={posRef} moveRef={moveRef} onMove={onMove} viewRef={viewRef}/>
      <color attach="background" args={["#0b0e14"]}/>
      <fog attach="fog" args={["#0b0e14",24,55]}/>
      <ambientLight intensity={.78}/>
      <directionalLight position={[2,10,5]} intensity={1.35} castShadow shadow-mapSize-width={1024} shadow-mapSize-height={1024}/>
      <directionalLight position={[-8,5,-6]} intensity={.55} color="#9aa9ff"/>
      <Environment preset="warehouse" environmentIntensity={.35}/>
      <Hall musicPlaying={musicPlaying}/>
      <TV playing={musicPlaying}/>
      <Speakers playing={musicPlaying}/>
      <ContactShadows position={[0,0,0]} opacity={.18} scale={24} blur={3.2} far={11}/>
      {Object.values(players).map(p=>
        <Suspense key={p.id} fallback={<FallbackHuman player={p} me={p.id===local.id}/>}>
          <AssetBoundary fallback={<FallbackHuman player={p} me={p.id===local.id}/>}><RealHuman player={p} me={p.id===local.id}/></AssetBoundary>
        </Suspense>
      )}
    </Canvas>

    <div className="cameraPad" onPointerDown={beginCamera} onPointerMove={moveCamera} onPointerUp={endCamera} onPointerCancel={endCamera} aria-label="Swipe to rotate camera" />

    <div className="topbar"><b>🌙 GC HANGOUT HALL</b><span>● {Object.keys(players).length} online</span></div>
    <div className="zoneHint">Large open social floor • perimeter interaction zones</div>
    <div className="chat"><b>💬 GC CHAT</b><div className="msg"><strong>Room</strong> {Object.keys(players).length} people here</div><div className="input">Type a message…</div></div>
    <div className="controls">
      <button onClick={onInteract}>🪑 Interact</button>
      <button className={musicPlaying?"active":""} onClick={onToggleMusic}>🎵 Music</button>
      <button onClick={onAttack}>🥊 Fight</button>
      <button>💬 Chat</button>
    </div>
    <div className="joystick" onPointerDown={e=>{e.currentTarget.setPointerCapture(e.pointerId);joystick(e)}} onPointerMove={e=>{if(e.currentTarget.hasPointerCapture(e.pointerId))joystick(e)}} onPointerUp={stop} onPointerCancel={stop}><div className="stick"/></div>
    <button className="mobileAction" onClick={onInteract}>✦</button>
    <button className="fight" onClick={onAttack}>🥊</button>
  </div>
}

export default function Home(){
  const [joined,setJoined]=useState(false),[name,setName]=useState(""),[avatarId,setAvatarId]=useState("maya");
  const [id]=useState(makeId),[players,setPlayers]=useState({}),[musicPlaying,setMusicPlaying]=useState(false);
  const [action,setAction]=useState(null);
  const musicRef=useRef(false);
  musicRef.current=musicPlaying;
  const channelRef=useRef(null),localRef=useRef(null);

  const join=()=>{
    const p={id,name:name.trim()||"You",avatarId,x:0,y:0,z:0,rot:0,health:3,attacking:false,moving:false,action:null};
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
      if(payload?.id)setPlayers(prev=>prev[payload.id]?{...prev[payload.id],action:payload.action}:prev)
    });
    channel.subscribe(async status=>{
      if(status==="SUBSCRIBED"&&localRef.current){
        setPlayers(prev=>({...prev,[id]:localRef.current}));
        await channel.track({id,name:localRef.current.name,avatarId});
        send(localRef.current);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_state",payload:{id}}),250);
        setTimeout(()=>channel.send({type:"broadcast",event:"request_room",payload:{id}}),350);
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

  const interact=()=>{
    if(!localRef.current)return;
    const p=localRef.current;
    const x=p.x,z=p.z;
    let next=null;
    if(Math.hypot(x+10,z+6)<3.7)next="sit";
    else if(Math.hypot(x-10,z-6)<3.7)next="eat";
    else if(Math.hypot(x-10,z+6)<3.7)next="sleep";
    else if(z<-7.0&&Math.abs(x)<7)next="watch";
    else if(Math.abs(x)>11&&z>2)next="drink";
    if(!next){setAction("Move closer to a zone");setTimeout(()=>setAction(null),1100);return}
    const payload={...p,action:next,moving:false};
    localRef.current=payload;setPlayers(prev=>({...prev,[id]:payload}));
    setAction(next);
    channelRef.current?.send({type:"broadcast",event:"player_action",payload:{id,action:next}});
    channelRef.current?.send({type:"broadcast",event:"player_state",payload});
    setTimeout(()=>{
      if(localRef.current?.action===next){
        const clear={...localRef.current,action:null};
        localRef.current=clear;setPlayers(prev=>({...prev,[id]:clear}));
        channelRef.current?.send({type:"broadcast",event:"player_state",payload:clear});
      }
    },3500);
  };

  if(joined)return <Room local={localRef.current} players={players} onMove={onMove} onAttack={onAttack} musicPlaying={musicPlaying} onToggleMusic={toggleMusic} onInteract={interact}/>;

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
