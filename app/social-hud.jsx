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

export default function SocialHud({ name, onMusicState, onEmote, emote = null, speakerActive = false, playerState = null, interaction = null, onRemotePlayers, onPairAction, remotePlayers = [], initialAudioUnlocked = false }) {
  const [panel, setPanel] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatToasts, setChatToasts] = useState([]);
  const [draft, setDraft] = useState("");
  const [tracks, setTracks] = useState([]);
  const [musicSearch, setMusicSearch] = useState("lounge");
  const [musicState, setMusicState] = useState({ track: null, position: 0, playing: false, volume: 0.8, updatedAt: Date.now(), senderId: "" });
  const [musicBusy, setMusicBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const musicVolume = Math.max(0, Math.min(1, Number(musicState.volume ?? 0.8)));
  const speakerControlActive = Boolean(
    speakerActive &&
    playerState &&
    Math.hypot(Number(playerState.x) - 5.5, Number(playerState.z) + 3.65) <= 2.25
  );
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
  const sharedAudioUnlockedRef = useRef(Boolean(initialAudioUnlocked));
  const nameRef = useRef(name);
  const playerStateRef = useRef(playerState);
  const interactionRef = useRef(interaction);
  const emoteRef = useRef(emote);
  const remotePlayersRef = useRef(new Map());
  const lastActivityInteractionRef = useRef("");
  const socialReadyRef = useRef(false);
  const gameReadyRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  const mergeRemotePlayer = useCallback((payload) => {
    if (!payload || payload.senderId === clientIdRef.current) return;
    const id = String(payload.senderId || "");
    if (!id || !Number.isFinite(Number(payload.x)) || !Number.isFinite(Number(payload.z))) return;
    const current = remotePlayersRef.current.get(id) || {};
    const next = {
      id,
      name: String(payload.name || "Guest").slice(0, 18),
      avatarId: String(payload.avatarId || "maya"),
      interactionType: String(payload.interactionType || ""),
      interactionPhase: String(payload.interactionPhase || "sync"),
      seatStyle: payload.seatStyle ? String(payload.seatStyle) : null,
      foodKind: payload.foodKind ? String(payload.foodKind) : "pizza",
      drinkKind: payload.drinkKind ? String(payload.drinkKind) : "water",
      emote: payload.emote ? String(payload.emote) : null,\n      pairAction: payload.pairAction && typeof payload.pairAction === "object" ? payload.pairAction : current.pairAction || null,
      x: Number(payload.x),
      z: Number(payload.z),
      rot: Number(payload.rot) || 0,
      moving: Boolean(payload.moving),
      speed: Number(payload.speed) || 0,
      lastSeen: Date.now(),
    };
    remotePlayersRef.current.set(id, { ...current, ...next });
    onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
  }, [onRemotePlayers]);

  useEffect(() => { nameRef.current = name; }, [name]);
  useEffect(() => { playerStateRef.current = playerState; }, [playerState]);
  useEffect(() => { interactionRef.current = interaction; }, [interaction]);
  useEffect(() => { emoteRef.current = emote; }, [emote]);
  useEffect(() => { musicStateRef.current = musicState; onMusicState?.(musicState); }, [musicState, onMusicState]);

  const pushChatToast = useCallback((entry) => {
    const toast = { ...entry, toastId: `${entry.id}-toast` };
    setChatToasts((items) => [...items, toast].slice(-3));
    window.setTimeout(() => setChatToasts((items) => items.filter((item) => item.toastId !== toast.toastId)), 3200);
  }, []);

  const send = useCallback(async (event, payload) => {
    const channel = channelRef.current;
    if (!channel || !socialReadyRef.current) return false;
    try {
      const result = await channel.send({ type: "broadcast", event, payload: { ...payload, senderId: clientIdRef.current } });
      return result === "ok" || result?.status === "ok" || result === undefined;
    } catch (error) {
      console.warn("GC Hangout social send failed", error);
      return false;
    }
  }, []);


  const pushActivity = useCallback((message, icon = "•") => {
    const text = String(message || "").trim().slice(0, 140);
    if (!text) return;
    const entry = {
      id: `activity-${clientIdRef.current}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: nameRef.current || "You",
      message: `${icon} ${text}`,
      timestamp: Date.now(),
      local: true,
      activity: true,
    };
    pushChatToast(entry);
    void send(SOCIAL_EVENTS.ACTIVITY, { name: entry.name, message: text, icon, timestamp: entry.timestamp });
  }, [pushChatToast, send]);

  const interactionActivity = useMemo(() => {
    if (!interaction?.anchor || interaction.status !== "active") return null;
    const labels = {
      SIT: ["is sitting down", "🪑"],
      EAT: ["is eating", "🥪"],
      DRINK: ["is having a drink", "🥤"],
      WATCH_TV: ["is watching TV", "📺"],
      MUSIC_SPEAKER: ["is using the speaker", "🔊"],
      SLEEP: ["is resting", "💤"],
      INTERACT: ["is interacting", "✨"],
    };
    return labels[interaction.anchor.type] || null;
  }, [interaction]);

  useEffect(() => {
    if (!interactionActivity) {
      lastActivityInteractionRef.current = "";
      return;
    }
    const key = interaction?.anchor?.id || interaction.anchor.type;
    if (lastActivityInteractionRef.current === key) return;
    lastActivityInteractionRef.current = key;
    pushActivity(interactionActivity[0], interactionActivity[1]);
  }, [interaction, interactionActivity, pushActivity]);

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
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: clientIdRef.current } },
    });
    const gameChannel = supabase.channel(`gc-hangout-game:${ROOM_NAME}`, {
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: clientIdRef.current } },
    });
    channelRef.current = channel;

    gameChannel.on("broadcast", { event: SOCIAL_EVENTS.PLAYER }, ({ payload }) => {
      mergeRemotePlayer(payload);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.ACTIVITY }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const message = String(payload?.message || "").trim().slice(0, 140);
      if (!message) return;
      pushChatToast({
        id: `activity-${payload.senderId || "remote"}-${payload.timestamp || Date.now()}`,
        name: String(payload.name || "Guest").slice(0, 18),
        message: `${String(payload.icon || "•")} ${message}`,
        timestamp: Number(payload.timestamp) || Date.now(),
        local: false,
        activity: true,
      });
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
    channel.on("broadcast", { event: SOCIAL_EVENTS.PAIR_ACTION }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const action = ["fight", "hug", "kiss"].includes(payload?.action) ? payload.action : null;
      const targetId = String(payload?.targetId || "");
      const senderId = String(payload?.senderId || "");
      if (!action || !targetId || !senderId) return;
      const timestamp = Number(payload.timestamp) || Date.now();
      if (targetId === clientIdRef.current) {
        onPairAction?.({ action, partnerId: senderId, until: timestamp + 1800 });
      }
      const partner = remotePlayersRef.current.get(senderId);
      if (partner) {
        mergeRemotePlayer({ ...partner, senderId, pairAction: { action, partnerId: targetId, until: timestamp + 1800 } });
      }
      pushChatToast({
        id: `pair-${senderId}-${timestamp}`,
        name: String(payload.name || "Guest").slice(0, 18),
        message: action === "hug" ? "🤗 hugged someone" : action === "kiss" ? "💋 shared a kiss" : "🥊 started a playful fight",
        timestamp,
        local: false,
        activity: true,
      });
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
        const previous = musicStateRef.current;
        if (next.track?.id !== previous.track?.id || next.playing !== previous.playing) {
          const title = next.track?.title ? ` “${next.track.title}”` : "";
          pushChatToast({
            id: `music-${payload.senderId || "remote"}-${payload.updatedAt || Date.now()}`,
            name: String(payload.senderName || payload.name || "Guest").slice(0, 18),
            message: next.playing ? `🎵 started music${title}` : "⏸️ paused the music",
            timestamp: Number(payload.updatedAt) || Date.now(),
            local: false,
            activity: true,
          });
        }
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

    const publishPlayer = () => {
      const state = playerStateRef.current;
      if (!state || !gameReadyRef.current) return;
      void gameChannel.send({
        type: "broadcast",
        event: SOCIAL_EVENTS.PLAYER,
        payload: {
          senderId: clientIdRef.current,
          name: nameRef.current || "Guest",
          avatarId: state.avatar?.id || "maya",
          interactionType: interactionRef.current?.anchor?.type || "",
          interactionPhase: interactionRef.current?.phase || "sync",
          seatStyle: interactionRef.current?.anchor?.seatStyle || null,
          foodKind: interactionRef.current?.anchor?.foodKind || "pizza",
          drinkKind: interactionRef.current?.anchor?.drinkKind || "water",
          emote: emoteRef.current || null,
          x: Number(state.x) || 0,
          z: Number(state.z) || 0,
          rot: Number(state.rot) || 0,
          moving: Boolean(state.moving),
          speed: Number(state.speed) || 0,
          timestamp: Date.now(),
        },
      });
    };

    const readPresencePlayers = (state) => {
      for (const [key, metas] of Object.entries(state || {})) {
        if (key === clientIdRef.current) continue;
        const meta = Array.isArray(metas) ? metas[0] : metas;
        if (meta?.kind === "player") {
          mergeRemotePlayer({ ...meta, senderId: key });
        }
        if (!musicStateRef.current.track && meta?.music) {
          const next = normalizeMusicState(meta.music);
          if (next?.track) {
            if (next.playing) next.position += Math.max(0, (Date.now() - next.updatedAt) / 1000);
            setMusicState(next);
          }
        }
      }
    };

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      for (const [key, metas] of Object.entries(state || {})) {
        if (key === clientIdRef.current) continue;
        const meta = Array.isArray(metas) ? metas[0] : metas;
        if (!musicStateRef.current.track && meta?.music) {
          const next = normalizeMusicState(meta.music);
          if (next?.track) {
            if (next.playing) next.position += Math.max(0, (Date.now() - next.updatedAt) / 1000);
            setMusicState(next);
          }
        }
      }
      if (!voiceEnabledRef.current) return;
      Object.keys(state)
        .filter((id) => id !== clientIdRef.current && clientIdRef.current < id)
        .forEach((id) => void ensurePeer(id, true));
    });
    channel.on("presence", { event: "join" }, ({ key }) => {
      if (voiceEnabledRef.current && key !== clientIdRef.current && clientIdRef.current < key) void ensurePeer(key, true);
    });
    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      closePeer(key);
      const meta = Array.isArray(leftPresences) ? leftPresences[0] : null;
      pushChatToast({ id: `leave-${key}-${Date.now()}`, name: String(meta?.name || "Guest").slice(0, 18), message: "👋 left the room", timestamp: Date.now(), local: false, activity: true });
    });
    gameChannel.on("presence", { event: "sync" }, () => {
      const state = gameChannel.presenceState();
      readPresencePlayers(state);
      const peers = Object.keys(state).filter((id) => id !== clientIdRef.current);
      // Force every existing client to publish a fresh transform to a newly joined client.
      peers.forEach(() => publishPlayer());
    });
    gameChannel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      if (key !== clientIdRef.current) {
        const meta = Array.isArray(newPresences) ? newPresences[0] : null;
        if (meta?.kind === "player") mergeRemotePlayer({ ...meta, senderId: key });
        if (!musicStateRef.current.track && meta?.music) {
          const next = normalizeMusicState(meta.music);
          if (next?.track) {
            if (next.playing) next.position += Math.max(0, (Date.now() - next.updatedAt) / 1000);
            setMusicState(next);
          }
        }
        publishPlayer();
      }
    });
    gameChannel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      if (remotePlayersRef.current.delete(key)) onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
      const meta = Array.isArray(leftPresences) ? leftPresences[0] : null;
      pushChatToast({ id: `leave-${key}-${Date.now()}`, name: String(meta?.name || "Guest").slice(0, 18), message: "👋 left the room", timestamp: Date.now(), local: false, activity: true });
    });
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
    const sendInitialPlayer = async () => {
      if (sessionStartedRef.current || !socialReadyRef.current || !gameReadyRef.current) return;
      sessionStartedRef.current = true;
      const state = playerStateRef.current;
      const music = musicStateRef.current.track ? {
        track: musicStateRef.current.track,
        position: musicStateRef.current.position,
        playing: musicStateRef.current.playing,
        volume: musicStateRef.current.volume,
        updatedAt: musicStateRef.current.updatedAt,
      } : null;
      await gameChannel.track({
        kind: "player",
        name: nameRef.current || "Guest",
        avatarId: state?.avatar?.id || "maya",
        interactionType: interactionRef.current?.anchor?.type || "",
        interactionPhase: interactionRef.current?.phase || "sync",
        seatStyle: interactionRef.current?.anchor?.seatStyle || null,
        foodKind: interactionRef.current?.anchor?.foodKind || "pizza",
        drinkKind: interactionRef.current?.anchor?.drinkKind || "water",
        emote: emoteRef.current || null,
        x: Number(state?.x) || 0,
        z: Number(state?.z) || 0,
        rot: Number(state?.rot) || 0,
        moving: Boolean(state?.moving),
        speed: Number(state?.speed) || 0,
      });
      await channel.track({
        name: nameRef.current || "Guest",
        voice: voiceEnabledRef.current,
        music,
      });
      publishPlayer();
      void send(SOCIAL_EVENTS.ACTIVITY, { name: nameRef.current || "Guest", message: "joined the room", icon: "👋", timestamp: Date.now() });
    };

    const scheduleReconnect = (targetChannel, kind) => {
      if (reconnectTimerRef.current) return;
      reconnectTimerRef.current = window.setTimeout(() => {
        reconnectTimerRef.current = null;
        if (kind === "social") {
          socialReadyRef.current = false;
          void targetChannel.subscribe(handleSocialStatus);
        } else {
          gameReadyRef.current = false;
          void targetChannel.subscribe(handleGameStatus);
        }
      }, 900);
    };

    const handleSocialStatus = (status) => {
      socialReadyRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED") {
        void channel.track({
          name: nameRef.current || "Guest",
          voice: voiceEnabledRef.current,
          music: musicStateRef.current.track ? {
            track: musicStateRef.current.track,
            position: musicStateRef.current.position,
            playing: musicStateRef.current.playing,
            volume: musicStateRef.current.volume,
            updatedAt: musicStateRef.current.updatedAt,
          } : null,
        });
        if (voiceEnabledRef.current) {
          const state = channel.presenceState();
          Object.keys(state)
            .filter((id) => id !== clientIdRef.current && clientIdRef.current < id)
            .forEach((id) => void ensurePeer(id, true));
        }
        void sendInitialPlayer();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        console.warn("GC Hangout social realtime status:", status);
        sessionStartedRef.current = false;
        scheduleReconnect(channel, "social");
      }
    };

    const handleGameStatus = async (status) => {
      gameReadyRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED") {
        await sendInitialPlayer();
      } else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) {
        console.warn("GC Hangout game realtime status:", status);
        sessionStartedRef.current = false;
        scheduleReconnect(gameChannel, "game");
      }
    };

    void channel.subscribe(handleSocialStatus);
    void gameChannel.subscribe(handleGameStatus);

    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteAudioRef.current.forEach((audio) => audio.remove());
      remoteAudioRef.current.clear();
      window.clearInterval(playerTimer);
      window.clearInterval(pruneTimer);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      socialReadyRef.current = false;
      gameReadyRef.current = false;
      sessionStartedRef.current = false;
      remotePlayersRef.current.clear();
      onRemotePlayers?.([]);
      void channel.unsubscribe();
      void gameChannel.unsubscribe();
      supabase.removeChannel(channel);
      supabase.removeChannel(gameChannel);
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
      pushActivity("left voice", "🎙️");
      resumeMusicAfterVoice();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true }, video: false });
      localStreamRef.current = stream;
      voiceEnabledRef.current = true;
      setVoiceOn(true);
      setVoiceStatus("Voice connected");
      pushActivity("joined voice", "🎙️");
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
  }, [captureMusicPlayback, ensurePeer, pushActivity, resumeMusicAfterVoice, voiceOn]);

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
    const sourceChanged = audio.src !== musicState.track.audio;
    if (sourceChanged) {
      audio.src = musicState.track.audio;
      audio.load();
    }
    const applyPosition = () => {
      const duration = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.duration : Number(musicState.track.duration) || 0;
      const position = Math.max(0, Number(musicState.position) || 0);
      try { audio.currentTime = duration ? Math.min(position, Math.max(0, duration - 0.2)) : position; } catch {}
    };
    if (audio.readyState >= 1) applyPosition();
    else audio.addEventListener("loadedmetadata", applyPosition, { once: true });
    audio.volume = musicVolume;
    if (musicState.playing) {
      if (sharedAudioUnlockedRef.current) {
        void audio.play().catch(() => {
          // Safari may reject a remote autoplay attempt; the next user gesture retries it.
        });
      }
    } else {
      audio.pause();
    }
    return () => audio.removeEventListener("loadedmetadata", applyPosition);
  }, [musicState.track?.id, musicState.track?.audio, musicState.playing, musicState.position, musicVolume]);

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
    const unlock = () => {
      // A user gesture unlocks audible media for this device. The shared track may
      // arrive before or after this gesture, so remember the unlock independently.
      sharedAudioUnlockedRef.current = true;
      const audio = audioRef.current;
      if (!audio || !musicStateRef.current.track || !musicStateRef.current.playing) return;
      audio.volume = Math.max(0, Math.min(1, Number(musicStateRef.current.volume ?? 0.8)));
      void audio.play().catch(() => {});
    };
    window.addEventListener("pointerdown", unlock, { passive: true });
    window.addEventListener("touchstart", unlock, { passive: true });
    window.addEventListener("keydown", unlock);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchstart", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (musicState.playing) {
      if (sharedAudioUnlockedRef.current) void audio.play().catch(() => {});
    } else audio.pause();
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
  }, [musicVolume, pushActivity, send]);

  useEffect(() => {
    const channel = channelRef.current;
    const track = musicState.track;
    if (!channel || !track || track.local) return;
    const state = playerStateRef.current;
    void channel.track({
      kind: "player",
      name: nameRef.current || "Guest",
      avatarId: state?.avatar?.id || "maya",
      x: Number(state?.x) || 0,
      z: Number(state?.z) || 0,
      rot: Number(state?.rot) || 0,
      moving: Boolean(state?.moving),
      speed: Number(state?.speed) || 0,
      voice: voiceEnabledRef.current,
      music: {
        track,
        position: Number(musicState.position) || 0,
        playing: Boolean(musicState.playing),
        volume: Number(musicState.volume ?? 0.8),
        updatedAt: Number(musicState.updatedAt) || Date.now(),
      },
    }).catch(() => {});
  }, [musicState.track?.id, musicState.playing, musicState.volume]);

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

  const addLocalAudio = useCallback(async (file) => {
    if (!file || uploadBusy) return;
    const accepted = /^audio\/(mpeg|wav|x-wav|mp4|aac|ogg|webm)$/.test(file.type) || /\.(mp3|wav|m4a|aac|ogg|webm)$/i.test(file.name);
    if (!accepted) return;
    if (file.size > 25 * 1024 * 1024) {
      pushChatToast({ id: `upload-size-${Date.now()}`, name: "Music", message: "File must be 25 MB or smaller.", timestamp: Date.now(), local: true, activity: true });
      return;
    }
    const supabase = supabaseRef.current;
    if (!supabase || !SUPABASE_URL || !SUPABASE_KEY) return;
    setUploadBusy(true);
    try {
      const extension = (file.name.match(/\.([^.]+)$/)?.[1] || "mp3").toLowerCase().replace("jpeg", "jpg");
      const safeBase = file.name.replace(/\.[^.]+$/, "").replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "song";
      const path = `${clientIdRef.current}/${Date.now()}-${safeBase}.${extension}`;
      const response = await fetch(`${SUPABASE_URL}/storage/v1/object/gc-hangout-music/${encodeURIComponent(path).replace(/%2F/g, "/")}`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          "Content-Type": file.type || "application/octet-stream",
          "x-upsert": "false",
        },
        body: file,
      });
      if (!response.ok) {
        const detail = await response.text().catch(() => "");
        throw new Error(detail || `Upload failed (${response.status})`);
      }
      const audio = `${SUPABASE_URL}/storage/v1/object/public/gc-hangout-music/${path.split("/").map(encodeURIComponent).join("/")}`;
      const track = {
        id: `shared-${clientIdRef.current}-${Date.now()}`,
        title: file.name.replace(/\.[^.]+$/, "").slice(0, 100),
        artist: nameRef.current || "Guest",
        album: "GC Hangout",
        audio,
        duration: 0,
        shared: true,
      };
      const normalized = normalizeMusicState({ track, position: 0, playing: true, volume: musicVolume, updatedAt: Date.now(), senderId: clientIdRef.current });
      if (!normalized) throw new Error("Invalid shared music track");
      sharedAudioUnlockedRef.current = true;
      setMusicState(normalized);
      pushActivity(`started music “${track.title}”`, "🎵");
      void send(SOCIAL_EVENTS.MUSIC, { ...normalized, senderName: nameRef.current || "You" });
    } catch (error) {
      console.error("GC Hangout music upload failed", error);
      pushChatToast({ id: `upload-error-${Date.now()}`, name: "Music", message: "Could not share that song. Try again.", timestamp: Date.now(), local: true, activity: true });
    } finally {
      setUploadBusy(false);
    }
  }, [musicVolume, pushActivity, pushChatToast, send, uploadBusy]);

  const publishMusic = useCallback((next) => {
    sharedAudioUnlockedRef.current = true;
    const normalized = normalizeMusicState({ ...next, volume: next.volume ?? musicVolume, senderId: clientIdRef.current });
    if (!normalized) return;
    setMusicState(normalized);
    const title = normalized.track?.title ? ` “${normalized.track.title}”` : "";
    pushActivity(normalized.playing ? `started music${title}` : "paused the music", normalized.playing ? "🎵" : "⏸️");
    void send(SOCIAL_EVENTS.MUSIC, { ...normalized, senderName: nameRef.current || "You" });
  }, [musicVolume, send]);

  const selectTrack = useCallback((track) => {
    publishMusic({ track, position: 0, playing: true, updatedAt: Date.now() });
  }, [publishMusic]);

  const toggleMusic = useCallback(() => {
    if (musicState.track?.local) {
      const nextPlaying = !musicState.playing;
      setMusicState((state) => ({ ...state, playing: nextPlaying, position: audioRef.current?.currentTime || state.position, updatedAt: Date.now(), senderId: clientIdRef.current }));
      pushActivity(nextPlaying ? "started music" : "paused the music", nextPlaying ? "🎵" : "⏸️");
      return;
    }
    if (!musicState.track) {
      if (tracks[0]) selectTrack(tracks[0]);
      return;
    }
    publishMusic({ ...musicStateRef.current, playing: !musicStateRef.current.playing, position: audioRef.current?.currentTime || musicStateRef.current.position, updatedAt: Date.now() });
  }, [musicState.playing, publishMusic, pushActivity, selectTrack, tracks]);

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

  const triggerPairAction = useCallback((action) => {
    const target = remotePlayers
      .filter((item) => Math.hypot(Number(item.x) - Number(playerState?.x), Number(item.z) - Number(playerState?.z)) <= 2.8)
      .sort((a, b) => Math.hypot(Number(a.x) - Number(playerState?.x), Number(a.z) - Number(playerState?.z)) - Math.hypot(Number(b.x) - Number(playerState?.x), Number(b.z) - Number(playerState?.z)))[0];
    if (!target || !["fight", "hug", "kiss"].includes(action)) return;
    const until = Date.now() + 1800;
    onPairAction?.({ action, partnerId: target.id, until });
    void send(SOCIAL_EVENTS.PAIR_ACTION, { action, targetId: target.id, name: nameRef.current || "Guest", timestamp: Date.now() });
  }, [onPairAction, playerState?.x, playerState?.z, remotePlayers, send]);

  const triggerEmote = useCallback((emote) => {
    const normalized = normalizeEmote(emote);
    if (!normalized) return;
    setEmoteFlash(normalized);
    onEmote?.(normalized);
    pushActivity(`is doing ${normalized}`, normalized === "dance" ? "💃" : normalized === "clap" ? "👏" : "👋");
    void send(SOCIAL_EVENTS.EMOTE, { name: nameRef.current || "You", emote: normalized, timestamp: Date.now() });
    window.setTimeout(() => setEmoteFlash((current) => current === normalized ? null : current), 1800);
  }, [onEmote, pushActivity, send]);

  const chatRows = useMemo(() => chat.slice(-12), [chat]);

  return (
    <>
      <audio ref={audioRef} preload="auto" />
      <div className="chat-toasts" aria-live="polite">
        {chatToasts.map((item) => <div className={`chat-toast ${item.activity ? "activity" : ""}`} key={item.toastId}><b>{item.name}</b><span>{item.message}</span></div>)}
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
          <label className="add-song">＋ {uploadBusy ? "Sharing…" : "Add Song"}<input type="file" accept=".mp3,.wav,.m4a,.aac,.ogg,.webm,audio/*" onChange={(event) => { void addLocalAudio(event.target.files?.[0]); event.target.value = ""; }} /></label>
          <div className="track-list">
            {tracks.slice(0, 8).map((track) => (
              <button key={track.id} className={musicState.track?.id === track.id ? "track selected" : "track"} onClick={() => selectTrack(track)}>
                <span><b>{track.title}</b><small>{track.artist}</small></span><em>{Math.round(track.duration)}s</em>
              </button>
            ))}
            {!tracks.length && <div className="social-empty">No playable tracks found.</div>}
          </div>
          <small className="social-note">Catalog: Jamendo. Shared provider tracks sync through the room. Custom songs upload to the shared room, so every player hears the same song.</small>
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
          {remotePlayers.some((item) => Math.hypot(Number(item.x) - Number(playerState?.x), Number(item.z) - Number(playerState?.z)) <= 2.8) && (
            <div className="pair-actions">
              <span>With nearby player</span>
              <div className="emote-grid">
                <button onClick={() => triggerPairAction("hug")}>🤗 Hug</button>
                <button onClick={() => triggerPairAction("kiss")}>💋 Kiss</button>
                <button onClick={() => triggerPairAction("fight")}>🥊 Play fight</button>
              </div>
            </div>
          )}
          {emoteFlash && <div className="emote-flash">{emoteFlash === "wave" ? "👋" : emoteFlash === "clap" ? "👏" : "💃"}</div>}
          {remoteEmotes.length > 0 && <div className="remote-emotes">{remoteEmotes.map((item) => <span key={item.id}>{item.name}: {item.emote}</span>)}</div>}
        </section>
      )}
    </>
  );
}
