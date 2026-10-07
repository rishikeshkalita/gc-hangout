"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { EMOTES, SOCIAL_EVENTS, createClientId, formatChatTime, normalizeEmote, normalizeMusicState, sanitizeChatMessage } from "../lib/social-state.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ROOM_NAME = "main";

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function getIceServers() {
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS || "stun:stun.l.google.com:19302").split(",").map((item) => item.trim()).filter(Boolean);
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  return [{ urls, ...(username && credential ? { username, credential } : {}) }];
}

function PanelButton({ active, children, onClick, label }) {
  return <button className={`social-tool ${active ? "active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClick} aria-label={label || children}>{children}</button>;
}

export default function SocialHud({ name, onMusicState, onEmote, speakerActive = false, playerState = null, onRemotePlayers }) {
  const [panel, setPanel] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatToasts, setChatToasts] = useState([]);
  const [draft, setDraft] = useState("");
  const [tracks, setTracks] = useState([]);
  const [musicSearch, setMusicSearch] = useState("lounge");
  const [musicState, setMusicState] = useState({ track: null, position: 0, playing: false, volume: 0.8, updatedAt: Date.now(), senderId: "" });
  const [musicBusy, setMusicBusy] = useState(false);
  const musicVolume = Math.max(0, Math.min(1, Number(musicState.volume ?? 0.8)));\n  const speakerControlActive = Boolean(speakerActive && playerState && Math.hypot(Number(playerState.x) - 5.5, Number(playerState.z) + 3.65) <= 2.25);
  const [voiceOn, setVoiceOn] = useState(false);
  const [muted, setMuted] = useState(false);
  const [voiceStatus, setVoiceStatus] = useState("Tap mic to join voice");
  const [voicePeers, setVoicePeers] = useState(0);
  const [emoteFlash, setEmoteFlash] = useState(null);
  const [remoteEmotes, setRemoteEmotes] = useState([]);
  const supabaseRef = useRef(null);
  const channelRef = useRef(null);
  const clientIdRef = useRef(createClientId());
  const audioRef = useRef(null);
  const musicStateRef = useRef(musicState);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const localAudioUrlRef = useRef(null);
  const voiceEnabledRef = useRef(false);
  const musicPlaybackSnapshotRef = useRef(null);
  const nameRef = useRef(name);
  const playerStateRef = useRef(playerState);
  const remotePlayersRef = useRef(new Map());

  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);
  useEffect(() => { musicStateRef.current = musicState; onMusicState?.(musicState); }, [musicState, onMusicState]);

  const pushChatToast = useCallback((entry) => {
    const toast = { ...entry, toastId: `${entry.id}-toast` };
    setChatToasts((items) => [...items, toast].slice(-3));
    window.setTimeout(() => setChatToasts((items) => items.filter((item) => item.toastId !== toast.toastId)), 3200);
  }, []);

  const send = useCallback(async (event, payload) => {
    const channel = channelRef.current;
    if (!channel) return;
    await channel.send({ type: "broadcast", event, payload: { ...payload, senderId: clientIdRef.current } });
  }, []);

  const closePeer = useCallback((peerId) => {
    const pc = peersRef.current.get(peerId);
    if (pc) pc.close();
    peersRef.current.delete(peerId);
    pendingCandidatesRef.current.delete(peerId);
    const audio = remoteAudioRef.current.get(peerId);
    if (audio) audio.remove();
    remoteAudioRef.current.delete(peerId);
    remoteStreamsRef.current.delete(peerId);
    setVoicePeers(peersRef.current.size);
  }, []);

  const addRemoteStream = useCallback((peerId, stream) => {
    remoteStreamsRef.current.set(peerId, stream);
    let audio = remoteAudioRef.current.get(peerId);
    if (!audio) {
      audio = document.createElement("audio");
      audio.autoplay = true;
      audio.playsInline = true;
      audio.setAttribute("aria-hidden", "true");
      audio.style.display = "none";
      document.body.appendChild(audio);
      remoteAudioRef.current.set(peerId, audio);
    }
    audio.srcObject = stream;
    void audio.play().catch(() => {});
  }, []);

  const sendSignal = useCallback((peerId, payload) => {
    return send(SOCIAL_EVENTS.VOICE, { kind: "signal", to: peerId, ...payload });
  }, [send]);

  const ensurePeer = useCallback(async (peerId, initiator) => {
    if (!peerId || peerId === clientIdRef.current) return null;
    let pc = peersRef.current.get(peerId);
    if (pc) return pc;

    pc = new RTCPeerConnection({ iceServers: getIceServers() });
    peersRef.current.set(peerId, pc);
    setVoicePeers(peersRef.current.size);

    const stream = localStreamRef.current;
    stream?.getTracks().forEach((track) => pc.addTrack(track, stream));

    pc.onicecandidate = (event) => {
      if (event.candidate) void sendSignal(peerId, { kind: "candidate", candidate: event.candidate });
    };
    pc.ontrack = (event) => {
      const stream = event.streams?.[0];
      if (stream) addRemoteStream(peerId, stream);
    };
    pc.onconnectionstatechange = () => {
      if (["failed", "closed", "disconnected"].includes(pc.connectionState)) closePeer(peerId);
    };

    if (initiator) {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      await sendSignal(peerId, { kind: "offer", description: pc.localDescription });
    }
    return pc;
  }, [addRemoteStream, closePeer, sendSignal]);

  useEffect(() => {
    const supabase = getSupabase();
    supabaseRef.current = supabase;
    if (!supabase) {
      setVoiceStatus("Social backend not configured");
      return undefined;
    }

    const channel = supabase.channel(`gc-hangout:${ROOM_NAME}`, {
      config: { broadcast: { self: false }, presence: { key: clientIdRef.current } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: SOCIAL_EVENTS.PLAYER }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const id = String(payload?.senderId || "");
      if (!id || !Number.isFinite(Number(payload?.x)) || !Number.isFinite(Number(payload?.z))) return;
      const current = remotePlayersRef.current.get(id) || {};
      const next = {
        id,
        name: String(payload.name || "Guest").slice(0, 18),
        avatarId: String(payload.avatarId || "maya"),
        x: Number(payload.x),
        z: Number(payload.z),
        rot: Number(payload.rot) || 0,
        moving: Boolean(payload.moving),
        speed: Number(payload.speed) || 0,
        lastSeen: Date.now(),
      };
      remotePlayersRef.current.set(id, { ...current, ...next });
      onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.CHAT }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const message = sanitizeChatMessage(payload?.message);
      if (!message) return;
      const entry = {
        id: `${payload.senderId || "remote"}-${payload.timestamp || Date.now()}`,
        name: String(payload.name || "Guest").slice(0, 18),
        message,
        timestamp: Number(payload.timestamp) || Date.now(),
        local: false,
      };
      setChat((items) => [...items, entry].slice(-40));
      pushChatToast(entry);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.EMOTE }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const emote = normalizeEmote(payload?.emote);
      if (!emote) return;
      setRemoteEmotes((items) => [...items, { id: `${Date.now()}-${Math.random()}`, name: payload.name || "Guest", emote }].slice(-5));
      window.setTimeout(() => setRemoteEmotes((items) => items.slice(1)), 2600);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.MUSIC }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const next = normalizeMusicState(payload);
      if (next) {
        if (next.playing) next.position += Math.max(0, (Date.now() - next.updatedAt) / 1000);
        setMusicState(next);
      }
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.VOICE }, async ({ payload }) => {
      if (payload?.senderId === clientIdRef.current || payload?.to !== clientIdRef.current) return;
      const peerId = String(payload.senderId || "");
      if (!peerId) return;
      try {
        if (payload.kind === "offer") {
          const pc = await ensurePeer(peerId, false);
          await pc.setRemoteDescription(payload.description);
          const pending = pendingCandidatesRef.current.get(peerId) || [];
          for (const candidate of pending) await pc.addIceCandidate(candidate);
          pendingCandidatesRef.current.delete(peerId);
          const answer = await pc.createAnswer();
          await pc.setLocalDescription(answer);
          await sendSignal(peerId, { kind: "answer", description: pc.localDescription });
        } else if (payload.kind === "answer") {
          const pc = peersRef.current.get(peerId);
          if (pc) await pc.setRemoteDescription(payload.description);
        } else if (payload.kind === "candidate") {
          const pc = await ensurePeer(peerId, false);
          if (pc.remoteDescription) await pc.addIceCandidate(payload.candidate);
          else {
            const pending = pendingCandidatesRef.current.get(peerId) || [];
            pending.push(payload.candidate);
            pendingCandidatesRef.current.set(peerId, pending);
          }
        }
      } catch (error) {
        console.error("Voice signaling failed", error);
      }
    });

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      const peers = Object.keys(state).filter((id) => id !== clientIdRef.current);
      if (voiceEnabledRef.current) {
        peers.filter((id) => clientIdRef.current < id).forEach((id) => void ensurePeer(id, true));
      }
    });
    channel.on("presence", { event: "join" }, ({ key }) => {
      if (voiceEnabledRef.current && key !== clientIdRef.current && clientIdRef.current < key) void ensurePeer(key, true);
    });
    channel.on("presence", { event: "leave" }, ({ key }) => closePeer(key));

    const publishPlayer = () => {
      const state = playerStateRef.current;
      if (!state) return;
      void channel.send({
        type: "broadcast",
        event: SOCIAL_EVENTS.PLAYER,
        payload: {
          senderId: clientIdRef.current,
          name: nameRef.current || "Guest",
          avatarId: state.avatar?.id || "maya",
          x: Number(state.x) || 0,
          z: Number(state.z) || 0,
          rot: Number(state.rot) || 0,
          moving: Boolean(state.moving),
          speed: Number(state.speed) || 0,
          timestamp: Date.now(),
        },
      });
    };
    const playerTimer = window.setInterval(publishPlayer, 100);
    const pruneTimer = window.setInterval(() => {
      const cutoff = Date.now() - 1800;
      let changed = false;
      for (const [id, player] of remotePlayersRef.current) {
        if (player.lastSeen < cutoff) {
          remotePlayersRef.current.delete(id);
          changed = true;
        }
      }
      if (changed) onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
    }, 700);
    const sendInitialPlayer = () => publishPlayer();

    void channel.subscribe(async (status) => {
      if (status === "SUBSCRIBED") {
        await channel.track({ name: nameRef.current, voice: voiceEnabledRef.current });
        sendInitialPlayer();
      }
    });

    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteAudioRef.current.forEach((audio) => audio.remove());
      remoteAudioRef.current.clear();
      window.clearInterval(playerTimer);
      window.clearInterval(pruneTimer);
      remotePlayersRef.current.clear();
      onRemotePlayers?.([]);
      void channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [closePeer, ensurePeer, pushChatToast, sendSignal]);

  const captureMusicPlayback = useCallback(() => {
    const audio = audioRef.current;
    const state = musicStateRef.current;
    if (!audio || !state.track) return null;
    return {
      trackId: state.track.id,
      playing: Boolean(state.playing),
      position: Number.isFinite(audio.currentTime) ? audio.currentTime : Number(state.position) || 0,
    };
  }, []);

  const resumeMusicAfterVoice = useCallback((snapshot = musicPlaybackSnapshotRef.current) => {
    const audio = audioRef.current;
    const state = musicStateRef.current;
    if (!audio || !state.track || !state.playing) return;
    if (snapshot?.trackId === state.track.id && Number.isFinite(snapshot.position)) {
      try { audio.currentTime = Math.max(0, snapshot.position); } catch {}
    }
    audio.volume = Math.max(0, Math.min(1, Number(state.volume ?? musicVolume)));
    void audio.play().catch(() => {});
    window.setTimeout(() => { void audio.play().catch(() => {}); }, 120);
    window.setTimeout(() => { void audio.play().catch(() => {}); }, 700);
  }, [musicVolume]);

  const enableVoice = useCallback(async () => {
    musicPlaybackSnapshotRef.current = captureMusicPlayback();
    if (voiceOn) {
      voiceEnabledRef.current = false;
      const channel = channelRef.current;
      if (channel) void channel.track({ name: nameRef.current, voice: false });
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      setVoicePeers(0);
      setVoiceOn(false);
      setMuted(false);
      setVoiceStatus("Tap mic to join voice");
      resumeMusicAfterVoice();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      localStreamRef.current = stream;
      voiceEnabledRef.current = true;
      setVoiceOn(true);
      setVoiceStatus("Voice connected");
      const channel = channelRef.current;
      if (channel) {
        await channel.track({ name: nameRef.current, voice: true });
        const state = channel.presenceState();
        for (const peerId of Object.keys(state).filter((id) => id !== clientIdRef.current && clientIdRef.current < id)) await ensurePeer(peerId, true);
      }
      // iOS Safari can pause the HTMLAudioElement while the microphone permission/session is activated.
      // Resume after the voice session is established, not before it.
      resumeMusicAfterVoice();
      window.setTimeout(resumeMusicAfterVoice, 250);
      window.setTimeout(resumeMusicAfterVoice, 900);
    } catch (error) {
      setVoiceStatus(error?.name === "NotAllowedError" ? "Microphone permission denied" : "Microphone unavailable");
    }
  }, [captureMusicPlayback, ensurePeer, resumeMusicAfterVoice, voiceOn]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const loadMusic = useCallback(async (query = musicSearch) => {
    setMusicBusy(true);
    try {
      const response = await fetch(`/api/music?search=${encodeURIComponent(query || "lounge")}`);
      const data = await response.json();
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
    } catch (error) {
      console.error("Music catalog load failed", error);
      setTracks([]);
    } finally {
      setMusicBusy(false);
    }
  }, [musicSearch]);

  useEffect(() => { void loadMusic("lounge"); }, [loadMusic]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || !musicState.track?.audio) return;
    audio.src = musicState.track.audio;
    audio.currentTime = Math.min(musicState.position || 0, Math.max(0, (musicState.track.duration || 1) - 0.2));
    audio.volume = musicVolume;
    if (musicState.playing) void audio.play().catch(() => {});
    else audio.pause();
  }, [musicState.track?.id, musicVolume]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.playsInline = true;
    audio.setAttribute("playsinline", "");
    audio.setAttribute("webkit-playsinline", "");
    const recoverAfterVoicePause = () => {
      if (!voiceEnabledRef.current || !musicStateRef.current.playing) return;
      window.setTimeout(() => resumeMusicAfterVoice(), 80);
    };
    audio.addEventListener("pause", recoverAfterVoicePause);
    return () => audio.removeEventListener("pause", recoverAfterVoicePause);
  }, [resumeMusicAfterVoice]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (musicState.playing) void audio.play().catch(() => {});
    else audio.pause();
    if (musicState.track && Math.abs(audio.currentTime - musicState.position) > 1.25) {
      try { audio.currentTime = Math.max(0, musicState.position); } catch {}
    }
  }, [musicState.playing, musicState.position, musicVolume]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const audio = audioRef.current;
      if (!audio || !musicStateRef.current.track || !musicStateRef.current.playing) return;
      const next = { ...musicStateRef.current, position: audio.currentTime, volume: musicVolume, updatedAt: Date.now(), senderId: clientIdRef.current };
      setMusicState(next);
      void send(SOCIAL_EVENTS.MUSIC, next);
    }, 2000);
    return () => window.clearInterval(timer);
  }, [musicVolume, send]);

  useEffect(() => () => {
    if (localAudioUrlRef.current) URL.revokeObjectURL(localAudioUrlRef.current);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const loaded = () => {
      if (!musicStateRef.current.track?.local) return;
      setMusicState((state) => state.track?.local ? { ...state, track: { ...state.track, duration: audio.duration || 0 } } : state);
    };
    audio.addEventListener("loadedmetadata", loaded);
    return () => audio.removeEventListener("loadedmetadata", loaded);
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    const ended = () => {
      setMusicState((state) => ({ ...state, playing: false, position: 0, updatedAt: Date.now(), senderId: clientIdRef.current }));
      void send(SOCIAL_EVENTS.MUSIC, { ...musicStateRef.current, playing: false, position: 0, updatedAt: Date.now() });
    };
    audio.addEventListener("ended", ended);
    return () => audio.removeEventListener("ended", ended);
  }, [send]);

  const addLocalAudio = useCallback((file) => {
    if (!file) return;
    const accepted = /^audio\/(mpeg|wav|x-wav|mp4|aac|ogg|webm)$/.test(file.type) || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name);
    if (!accepted) return;
    if (localAudioUrlRef.current) URL.revokeObjectURL(localAudioUrlRef.current);
    const url = URL.createObjectURL(file);
    localAudioUrlRef.current = url;
    setMusicState({
      track: {
        id: `local-${clientIdRef.current}-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
        artist: "Local file",
        album: "This device",
        audio: url,
        duration: 0,
        local: true,
      },
      position: 0,
      playing: true,
      updatedAt: Date.now(),
      senderId: clientIdRef.current,
    });
  }, []);

  const publishMusic = useCallback((next) => {
    const normalized = normalizeMusicState({ ...next, volume: next.volume ?? musicVolume, senderId: clientIdRef.current });
    if (!normalized) return;
    setMusicState(normalized);
    void send(SOCIAL_EVENTS.MUSIC, normalized);
  }, [musicVolume, send]);

  const selectTrack = useCallback((track) => {
    publishMusic({ track, position: 0, playing: true, updatedAt: Date.now() });
  }, [publishMusic]);

  const toggleMusic = useCallback(() => {
    if (musicState.track?.local) {
      setMusicState((state) => ({ ...state, playing: !state.playing, position: audioRef.current?.currentTime || state.position, updatedAt: Date.now(), senderId: clientIdRef.current }));
      return;
    }
    if (!musicState.track) {
      if (tracks[0]) selectTrack(tracks[0]);
      return;
    }
    publishMusic({ ...musicStateRef.current, playing: !musicStateRef.current.playing, position: audioRef.current?.currentTime || musicStateRef.current.position, updatedAt: Date.now() });
  }, [publishMusic, selectTrack, tracks]);

  const setMusicVolume = useCallback((value) => {
    const volume = Math.max(0, Math.min(1, Number(value)));
    if (musicStateRef.current.track?.local) {
      setMusicState((state) => ({ ...state, volume }));
      return;
    }
    publishMusic({
      ...musicStateRef.current,
      volume,
      position: audioRef.current?.currentTime || musicStateRef.current.position,
      updatedAt: Date.now(),
    });
  }, [publishMusic]);

  const nextTrack = useCallback(() => {
    if (!tracks.length) return;
    const index = tracks.findIndex((track) => track.id === musicStateRef.current.track?.id);
    selectTrack(tracks[(index + 1 + tracks.length) % tracks.length]);
  }, [selectTrack, tracks]);

  const sendChat = useCallback(() => {
    const message = sanitizeChatMessage(draft);
    if (!message) return;
    const entry = { id: `${clientIdRef.current}-${Date.now()}`, name: nameRef.current || "You", message, timestamp: Date.now(), local: true };
    setChat((items) => [...items, entry].slice(-40));
    pushChatToast(entry);
    setDraft("");
    void send(SOCIAL_EVENTS.CHAT, { name: nameRef.current || "You", message, timestamp: entry.timestamp });
  }, [draft, pushChatToast, send]);

  const triggerEmote = useCallback((emote) => {
    const normalized = normalizeEmote(emote);
    if (!normalized) return;
    setEmoteFlash(normalized);
    onEmote?.(normalized);
    void send(SOCIAL_EVENTS.EMOTE, { name: nameRef.current || "You", emote: normalized, timestamp: Date.now() });
    window.setTimeout(() => setEmoteFlash((current) => current === normalized ? null : current), 1800);
  }, [onEmote, send]);

  const chatRows = useMemo(() => chat.slice(-12), [chat]);

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="chat-toasts" aria-live="polite">
        {chatToasts.map((item) => <div className="chat-toast" key={item.toastId}><b>{item.name}</b><span>{item.message}</span></div>)}
      </div>
      {speakerControlActive && (
        <label className="speaker-volume" aria-label={`Speaker volume ${Math.round(musicVolume * 100)} percent`}>
          <span>🔊 Speaker</span>
          <input type="range" min="0" max="1" step="0.01" value={musicVolume} onChange={(event) => setMusicVolume(event.target.value)} />
          <b>{Math.round(musicVolume * 100)}%</b>
        </label>
      )}
      <div className="social-toolbar" aria-label="Social controls">
        <PanelButton active={panel === "chat"} onClick={() => setPanel(panel === "chat" ? null : "chat")} label="Open chat">💬</PanelButton>
        <PanelButton active={panel === "music"} onClick={() => setPanel(panel === "music" ? null : "music")} label="Open music">🎵</PanelButton>
        <PanelButton active={panel === "voice"} onClick={() => setPanel(panel === "voice" ? null : "voice")} label="Open voice">{voiceOn ? (muted ? "🔇" : "🎙️") : "🎤"}</PanelButton>
        <PanelButton active={panel === "emotes"} onClick={() => setPanel(panel === "emotes" ? null : "emotes")} label="Open emotes">✨</PanelButton>
      </div>

      {panel === "chat" && (
        <section className="social-panel chat-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="social-panel-head"><strong>Chat</strong><span>{chat.length ? `${chat.length} messages` : "Room chat"}</span></div>
          <div className="chat-list">
            {chatRows.length ? chatRows.map((item) => <div className="chat-row" key={item.id}><b>{item.name}</b><span>{item.message}</span><small>{formatChatTime(item.timestamp)}</small></div>) : <div className="social-empty">Say something to the room.</div>}
          </div>
          <form className="chat-compose" onSubmit={(event) => { event.preventDefault(); sendChat(); }}>
            <input value={draft} onChange={(event) => setDraft(event.target.value)} maxLength={180} placeholder="Message the room…" inputMode="text" enterKeyHint="send" />
            <button type="submit">Send</button>
          </form>
        </section>
      )}

      {panel === "music" && (
        <section className="social-panel music-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="social-panel-head"><strong>Shared music</strong><span>{musicState.track ? `${musicState.track.title} · ${musicState.track.artist}` : "No track selected"}</span></div>
          <div className="music-now">
            <div className="music-main-row"><button className="music-main" onClick={toggleMusic}>{musicState.playing ? "Pause" : "Play"}{musicState.track ? ` · ${musicState.track.title}` : ""}</button><button className="music-next" onClick={nextTrack} disabled={!tracks.length} aria-label="Next track">Next</button></div>
            <span>{Math.floor(musicState.position || 0)}s</span>
          </div>
          <div className="speaker-volume-note">Walk to the floor speaker and interact to change room volume.</div>
          <form className="music-search" onSubmit={(event) => { event.preventDefault(); void loadMusic(musicSearch); }}>
            <input value={musicSearch} onChange={(event) => setMusicSearch(event.target.value)} placeholder="Search music" inputMode="search" enterKeyHint="search" />
            <button type="submit" disabled={musicBusy}>{musicBusy ? "…" : "Search"}</button>
          </form>
          <label className="add-song">＋ Add Song<input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*" onChange={(event) => addLocalAudio(event.target.files?.[0])} /></label>
          <div className="track-list">
            {tracks.slice(0, 8).map((track) => (
              <button key={track.id} className={musicState.track?.id === track.id ? "track selected" : "track"} onClick={() => selectTrack(track)}>
                <span><b>{track.title}</b><small>{track.artist}</small></span><em>{Math.round(track.duration)}s</em>
              </button>
            ))}
            {!tracks.length && <div className="social-empty">No playable tracks found.</div>}
          </div>
          <small className="social-note">Catalog: Jamendo. Shared provider tracks sync through the room. Add Song plays a local MP3/WAV/M4A/AAC/OGG/WebM file on this device.</small>
        </section>
      )}

      {panel === "voice" && (
        <section className="social-panel voice-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="social-panel-head"><strong>Voice</strong><span>{voiceStatus}</span></div>
          <div className="voice-actions">
            <button className={voiceOn ? "voice-main active" : "voice-main"} onClick={() => void enableVoice()}>{voiceOn ? "Leave voice" : "Join voice"}</button>
            <button disabled={!voiceOn} onClick={toggleMute}>{muted ? "Unmute" : "Mute"}</button>
          </div>
          <div className="voice-meta">{voicePeers ? `${voicePeers} peer${voicePeers === 1 ? "" : "s"} connected` : "No voice peers yet."}</div>
          <small className="social-note">Voice uses browser WebRTC with the room channel for signaling.</small>
        </section>
      )}

      {panel === "emotes" && (
        <section className="social-panel emote-panel" onPointerDown={(event) => event.stopPropagation()}>
          <div className="social-panel-head"><strong>Emotes</strong><span>Visible to the room</span></div>
          <div className="emote-grid">
            {EMOTES.map((emote) => <button key={emote} onClick={() => triggerEmote(emote)}>{emote === "wave" ? "👋 Wave" : emote === "clap" ? "👏 Clap" : "💃 Dance"}</button>)}
          </div>
          {emoteFlash && <div className="emote-flash">{emoteFlash === "wave" ? "👋" : emoteFlash === "clap" ? "👏" : "💃"}</div>}
          {remoteEmotes.length > 0 && <div className="remote-emotes">{remoteEmotes.map((item) => <span key={item.id}>{item.name}: {item.emote}</span>)}</div>}
        </section>
      )}
    </>
  );
}
