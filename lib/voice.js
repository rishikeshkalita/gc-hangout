export class VoiceMesh {
  constructor({channel, localId, onRemoteStream, onPeerState}){
    this.channel=channel;
    this.localId=localId;
    this.onRemoteStream=onRemoteStream;
    this.onPeerState=onPeerState;
    this.localStream=null;
    this.enabled=false;
    this.muted=false;
    this.inputDeviceId="";
    this.remoteVolume=.9;
    this.peers=new Map();
    this.remoteAudio=new Map();
    this.iceQueues=new Map();
    this.retryTimers=new Map();
    this.knownPeers=new Set();
    this.handleSignal=this.handleSignal.bind(this);
    this.handleIce=this.handleIce.bind(this);
    channel.on("broadcast",{event:"voice_signal"},this.handleSignal);
    channel.on("broadcast",{event:"voice_ice"},this.handleIce);
  }

  async setEnabled(enabled){
    if(enabled===this.enabled)return;
    if(enabled){
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone is not supported in this browser.");
      this.localStream=await navigator.mediaDevices.getUserMedia({
        audio:{deviceId:this.inputDeviceId?{exact:this.inputDeviceId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}
      });
      this.localStream.getAudioTracks().forEach(track=>{track.enabled=!this.muted;});
      this.enabled=true;
      this.onPeerState?.(true);
      await this.renegotiateAll();
      await this.syncPeers();
    }else{
      this.enabled=false;
      this.localStream?.getTracks().forEach(t=>t.stop());
      this.localStream=null;
      for(const id of [...this.peers.keys()])this.closePeer(id);
      this.onPeerState?.(false);
    }
  }

  setMuted(muted){
    this.muted=!!muted;
    this.localStream?.getAudioTracks().forEach(track=>{track.enabled=!this.muted;});
    return this.muted;
  }

  async setInputDevice(deviceId){
    this.inputDeviceId=String(deviceId||"");
    if(!this.enabled)return;
    if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone is not supported in this browser.");
    const stream=await navigator.mediaDevices.getUserMedia({audio:{deviceId:this.inputDeviceId?{exact:this.inputDeviceId}:undefined,echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
    const track=stream.getAudioTracks()[0];
    if(!track)throw new Error("No microphone was available.");
    track.enabled=!this.muted;
    const oldTracks=this.localStream?.getAudioTracks()||[];
    for(const pc of this.peers.values()){
      const sender=pc.getSenders().find(s=>s.track?.kind==="audio");
      if(sender)await sender.replaceTrack(track);
    }
    oldTracks.forEach(t=>t.stop());
    this.localStream=stream;
    return track;
  }

  setRemoteVolume(volume){
    this.remoteVolume=Math.max(0,Math.min(1,Number(volume)||0));
    for(const audio of this.remoteAudio.values())audio.volume=this.remoteVolume;
    return this.remoteVolume;
  }

  createPeer(remoteId){
    const polite=this.localId>remoteId;
    const turnUrls=String(process.env.NEXT_PUBLIC_TURN_URLS||"").split(",").map(v=>v.trim()).filter(Boolean);
    const turnUsername=String(process.env.NEXT_PUBLIC_TURN_USERNAME||"").trim();
    const turnCredential=String(process.env.NEXT_PUBLIC_TURN_CREDENTIAL||"").trim();
    const iceServers=[
      {urls:["stun:stun.l.google.com:19302","stun:stun1.l.google.com:19302"]},
      ...(turnUrls.length&&turnUsername&&turnCredential?[{urls:turnUrls,username:turnUsername,credential:turnCredential}]:[])
    ];
    const pc=new RTCPeerConnection({iceServers});
    pc._gc={polite,makingOffer:false,ignoreOffer:false,isSettingRemoteAnswerPending:false,reconnectTimer:null};

    pc.onicecandidate=e=>{
      if(e.candidate)this.channel.send({
        type:"broadcast",
        event:"voice_ice",
        payload:{from:this.localId,to:remoteId,candidate:e.candidate}
      });
    };

    pc.onnegotiationneeded=async()=>{
      if(!this.enabled||pc.signalingState==="closed")return;
      try{
        pc._gc.makingOffer=true;
        await pc.setLocalDescription();
        await this.channel.send({
          type:"broadcast",
          event:"voice_signal",
          payload:{from:this.localId,to:remoteId,kind:"description",description:pc.localDescription}
        });
      }catch(error){
        console.warn("voice negotiation failed",error);
      }finally{
        pc._gc.makingOffer=false;
      }
    };

    pc.ontrack=e=>{
      const stream=e.streams[0];
      if(stream)this.attachRemoteAudio(remoteId,stream);
    };

    pc.onconnectionstatechange=()=>{
      const state=pc.connectionState;
      if(state==="connected"){
        this.clearRetry(remoteId);
        return;
      }
      if(!this.enabled||["closed"].includes(state))return;
      if(["failed","disconnected"].includes(state))this.scheduleReconnect(remoteId);
    };

    if(this.localStream){
      for(const track of this.localStream.getTracks()){
        if(!pc.getSenders().some(sender=>sender.track===track))pc.addTrack(track,this.localStream);
      }
    }
    return pc;
  }

  async ensurePeer(remoteId){
    if(remoteId===this.localId)return null;
    let pc=this.peers.get(remoteId);
    if(pc)return pc;
    pc=this.createPeer(remoteId);
    this.peers.set(remoteId,pc);
    return pc;
  }

  async offerTo(remoteId){
    if(!this.enabled||this.localId>remoteId)return;
    const pc=await this.ensurePeer(remoteId);
    if(!pc)return;
    if(pc.signalingState==="stable")pc.dispatchEvent(new Event("negotiationneeded"));
  }

  async renegotiateAll(){
    for(const id of this.peers.keys())await this.offerTo(id);
  }

  async syncPeers(peerIds=[]){
    for(const id of peerIds){
      if(id&&id!==this.localId)this.knownPeers.add(id);
    }
    if(!this.enabled)return;
    for(const id of this.knownPeers){
      if(id===this.localId)continue;
      try{
        await this.offerTo(id);
      }catch(error){
        console.warn("Voice peer sync failed",id,error);
      }
    }
  }

  async handleSignal({payload}){
    if(!payload||payload.to!==this.localId||!payload.from)return;
    const remoteId=payload.from;
    const pc=await this.ensurePeer(remoteId);
    if(!pc)return;

    const description=payload.description||payload.sdp;
    if(!description)return;

    try{
      const readyForOffer=!pc._gc.makingOffer&&(
        pc.signalingState==="stable"||pc._gc.isSettingRemoteAnswerPending
      );
      const offerCollision=description.type==="offer"&&!readyForOffer;
      pc._gc.ignoreOffer=!pc._gc.polite&&offerCollision;
      if(pc._gc.ignoreOffer)return;

      pc._gc.isSettingRemoteAnswerPending=description.type==="answer";
      if(description.type==="offer"&&offerCollision){
        await pc.setLocalDescription({type:"rollback"});
      }
      await pc.setRemoteDescription(description);
      pc._gc.isSettingRemoteAnswerPending=false;

      await this.flushIce(remoteId,pc);

      if(description.type==="offer"){
        await pc.setLocalDescription();
        await this.channel.send({
          type:"broadcast",
          event:"voice_signal",
          payload:{from:this.localId,to:remoteId,kind:"description",description:pc.localDescription}
        });
      }
    }catch(error){
      pc._gc.isSettingRemoteAnswerPending=false;
      console.warn("voice signaling failed",error);
      this.scheduleReconnect(remoteId);
    }
  }

  async handleIce({payload}){
    if(!payload||payload.to!==this.localId||!payload.from||!payload.candidate)return;
    const remoteId=payload.from;
    const pc=await this.ensurePeer(remoteId);
    if(!pc)return;
    if(!pc.remoteDescription){
      const queue=this.iceQueues.get(remoteId)||[];
      queue.push(payload.candidate);
      this.iceQueues.set(remoteId,queue);
      return;
    }
    try{
      await pc.addIceCandidate(payload.candidate);
    }catch(error){
      if(!pc._gc.ignoreOffer)console.warn("voice ICE candidate rejected",error);
    }
  }

  async flushIce(remoteId,pc){
    const queue=this.iceQueues.get(remoteId);
    if(!queue?.length)return;
    this.iceQueues.delete(remoteId);
    for(const candidate of queue){
      try{await pc.addIceCandidate(candidate)}catch(error){
        if(!pc._gc.ignoreOffer)console.warn("queued voice ICE candidate rejected",error);
      }
    }
  }

  scheduleReconnect(remoteId){
    if(!this.enabled||this.retryTimers.has(remoteId))return;
    const timer=setTimeout(async()=>{
      this.retryTimers.delete(remoteId);
      if(!this.enabled)return;
      const pc=this.peers.get(remoteId);
      if(!pc)return;
      try{
        if(pc.signalingState!=="stable")return;
        pc.restartIce();
      }catch(error){
        console.warn("voice reconnect failed",error);
      }
    },1200);
    this.retryTimers.set(remoteId,timer);
  }

  clearRetry(remoteId){
    const timer=this.retryTimers.get(remoteId);
    if(timer)clearTimeout(timer);
    this.retryTimers.delete(remoteId);
  }

  attachRemoteAudio(remoteId,stream){
    let audio=this.remoteAudio.get(remoteId);
    if(!audio){
      audio=new Audio();
      audio.autoplay=true;
      audio.playsInline=true;
      audio.volume=this.remoteVolume;
      this.remoteAudio.set(remoteId,audio);
    }
    audio.srcObject=stream;
    audio.play().catch(()=>{});
    this.onRemoteStream?.(remoteId,stream);
  }

  closePeer(remoteId){
    this.clearRetry(remoteId);
    this.iceQueues.delete(remoteId);
    const pc=this.peers.get(remoteId);
    if(pc){
      pc.onicecandidate=null;
      pc.ontrack=null;
      pc.onnegotiationneeded=null;
      pc.close();
    }
    this.peers.delete(remoteId);
    const audio=this.remoteAudio.get(remoteId);
    if(audio){audio.srcObject=null;audio.remove();this.remoteAudio.delete(remoteId);}
  }

  removePeer(remoteId){this.knownPeers.delete(remoteId);this.closePeer(remoteId);}

  destroy(){
    this.knownPeers.clear();
    for(const id of [...this.peers.keys()])this.closePeer(id);
    this.localStream?.getTracks().forEach(t=>t.stop());
    this.localStream=null;
    this.enabled=false;
    this.muted=false;
  }
}
