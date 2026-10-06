export class VoiceMesh {
  constructor({channel, localId, onRemoteStream, onPeerState}){
    this.channel=channel;
    this.localId=localId;
    this.onRemoteStream=onRemoteStream;
    this.onPeerState=onPeerState;
    this.localStream=null;
    this.enabled=false;
    this.peers=new Map();
    this.remoteAudio=new Map();
    this.handleSignal=this.handleSignal.bind(this);
    this.handleIce=this.handleIce.bind(this);
    channel.on("broadcast",{event:"voice_signal"},this.handleSignal);
    channel.on("broadcast",{event:"voice_ice"},this.handleIce);
  }

  async setEnabled(enabled){
    if(enabled===this.enabled)return;
    if(enabled){
      if(!navigator.mediaDevices?.getUserMedia)throw new Error("Microphone is not supported in this browser.");
      this.localStream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:true,noiseSuppression:true,autoGainControl:true}});
      this.enabled=true;
      this.onPeerState?.(true);
      await this.renegotiateAll();
    }else{
      this.enabled=false;
      this.localStream?.getTracks().forEach(t=>t.stop());
      this.localStream=null;
      for(const id of [...this.peers.keys()])this.closePeer(id);
      this.onPeerState?.(false);
    }
  }

  async ensurePeer(remoteId){
    if(remoteId===this.localId)return null;
    let pc=this.peers.get(remoteId);
    if(pc)return pc;
    pc=new RTCPeerConnection({iceServers:[
      {urls:"stun:stun.l.google.com:19302"},
      {urls:"stun:stun1.l.google.com:19302"}
    ]});
    this.peers.set(remoteId,pc);
    pc.onicecandidate=e=>{
      if(e.candidate)this.channel.send({type:"broadcast",event:"voice_ice",payload:{from:this.localId,to:remoteId,candidate:e.candidate}});
    };
    pc.ontrack=e=>{
      const stream=e.streams[0];
      if(stream)this.attachRemoteAudio(remoteId,stream);
    };
    pc.onconnectionstatechange=()=>{
      const state=pc.connectionState;
      if(["failed","closed"].includes(state))this.closePeer(remoteId);
    };
    if(this.localStream){
      for(const track of this.localStream.getTracks())pc.addTrack(track,this.localStream);
    }
    return pc;
  }

  async offerTo(remoteId){
    if(!this.enabled || this.localId>remoteId)return;
    const pc=await this.ensurePeer(remoteId);
    if(!pc)return;
    if(this.localStream){
      const senders=pc.getSenders();
      for(const track of this.localStream.getTracks()){
        if(!senders.some(sender=>sender.track===track))pc.addTrack(track,this.localStream);
      }
    }
    if(pc.signalingState!=="stable")return;
    const offer=await pc.createOffer();
    await pc.setLocalDescription(offer);
    await this.channel.send({type:"broadcast",event:"voice_signal",payload:{
      from:this.localId,to:remoteId,kind:"offer",sdp:pc.localDescription
    }});
  }

  async renegotiateAll(){
    const ids=[...this.peers.keys()];
    for(const id of ids)await this.offerTo(id);
  }

  async handleSignal({payload}){
    if(!payload||payload.to!==this.localId)return;
    const {from,kind,sdp}=payload;
    if(!from)return;
    const pc=await this.ensurePeer(from);
    if(kind==="offer"){
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
      if(this.localStream&&!pc.getSenders().some(s=>s.track)){
        for(const track of this.localStream.getTracks())pc.addTrack(track,this.localStream);
      }
      const answer=await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await this.channel.send({type:"broadcast",event:"voice_signal",payload:{
        from:this.localId,to:from,kind:"answer",sdp:pc.localDescription
      }});
    }else if(kind==="answer"){
      await pc.setRemoteDescription(new RTCSessionDescription(sdp));
    }
  }

  async handleIce({payload}){
    if(!payload||payload.to!==this.localId||!payload.candidate)return;
    const pc=this.peers.get(payload.from)||await this.ensurePeer(payload.from);
    try{await pc.addIceCandidate(new RTCIceCandidate(payload.candidate));}catch(e){console.warn("voice ICE candidate rejected",e);}
  }

  attachRemoteAudio(remoteId,stream){
    let audio=this.remoteAudio.get(remoteId);
    if(!audio){
      audio=new Audio();
      audio.autoplay=true;
      audio.playsInline=true;
      audio.volume=.9;
      this.remoteAudio.set(remoteId,audio);
    }
    audio.srcObject=stream;
    audio.play().catch(()=>{});
    this.onRemoteStream?.(remoteId,stream);
  }

  closePeer(remoteId){
    const pc=this.peers.get(remoteId);
    if(pc){pc.onicecandidate=null;pc.ontrack=null;pc.close();}
    this.peers.delete(remoteId);
    const audio=this.remoteAudio.get(remoteId);
    if(audio){audio.srcObject=null;audio.remove();this.remoteAudio.delete(remoteId);}
  }

  removePeer(remoteId){this.closePeer(remoteId);}

  destroy(){
    for(const id of [...this.peers.keys()])this.closePeer(id);
    this.localStream?.getTracks().forEach(t=>t.stop());
    this.localStream=null;
    this.enabled=false;
  }
}
