"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { EMOTES, MUSIC_PENDING_LIMIT, MUSIC_QUEUE_LIMIT, SOCIAL_EVENTS, createClientId, currentMusicPosition, formatChatTime, normalizeEmote, normalizeMusicState, normalizeMusicTrack, sanitizeChatMessage } from "../lib/social-state.mjs";

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
  const [musicState, setMusicState] = useState({ current: null, track: null, queue: [], skipVotes: [], revision: 0, position: 0, startedAt: 0, playing: false, volume: 0.8, updatedAt: Date.now(), leaderId: "" });
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicStatus, setMusicStatus] = useState("Shared YouTube playback");
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
  const roomAudioRef = useRef(null);
  const roomAudioTrackRef = useRef("");
  const musicStateRef = useRef(musicState);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const voiceEnabledRef = useRef(false);
  const sharedAudioUnlockedRef = useRef(Boolean(initialAudioUnlocked));
  const musicPresenceRef = useRef(new Map());
  const activePresenceIdsRef = useRef(new Set([clientIdRef.current]));
  const endedRevisionRef = useRef(-1);
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
      emote: payload.emote ? String(payload.emote) : null,
      pairAction: payload.pairAction && typeof payload.pairAction === "object" ? payload.pairAction : current.pairAction || null,
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
      config: { private: true, broadcast: { self: true, ack: true }, presence: { key: clientIdRef.current } },
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
      if (!next) return;
      const previous = musicStateRef.current;
      if (next.revision < previous.revision) return;
      if (next.revision === previous.revision && next.updatedAt <= previous.updatedAt && next.leaderId === previous.leaderId) return;
      if (next.playing && next.current) next.position = currentMusicPosition(next);
      setMusicState(next);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.MUSIC_REQUEST }, ({ payload }) => {
      const presenceIds = new Set(Object.keys(channel.presenceState()));
      presenceIds.add(clientIdRef.current);
      activePresenceIdsRef.current = presenceIds;
      const currentLeader = [...presenceIds].sort()[0] || clientIdRef.current;
      if (currentLeader !== clientIdRef.current) return;
      const action = String(payload?.action || "");
      const requesterId = String(payload?.senderId || "");
      if (!requesterId) return;
      const now = Date.now();
      const state = normalizeMusicState(musicStateRef.current);
      if (!state) return;
      let next = state;

      if (action === "add") {
        const track = normalizeMusicTrack(payload.track);
        if (!track) return;
        const pendingByRequester = state.queue.filter((item) => item.requesterId === requesterId).length;
        if (pendingByRequester >= MUSIC_PENDING_LIMIT || state.queue.length >= MUSIC_QUEUE_LIMIT) return;
        if (state.current?.videoId === track.videoId || state.queue.some((item) => item.videoId === track.videoId)) return;
        const queue = [...state.queue, { ...track, requesterId, requesterName: String(payload.requesterName || track.requesterName || "Guest").slice(0, 18), requestedAt: now }].slice(0, MUSIC_QUEUE_LIMIT);
        if (!state.current) {
          next = { ...state, revision: state.revision + 1, current: queue[0], track: queue[0], queue: queue.slice(1), position: 0, startedAt: now, playing: true, skipVotes: [], updatedAt: now };
        } else {
          next = { ...state, revision: state.revision + 1, queue, updatedAt: now };
        }
      } else if (action === "pause_vote") {
        if (!state.current) return;
        const desiredPlaying = Boolean(payload.desiredPlaying);
        if (desiredPlaying === state.playing) return;
        const votes = desiredPlaying === state.pauseTargetPlaying
          ? [...new Set([...state.pauseVotes, requesterId])]
          : [requesterId];
        const activeCount = Math.max(1, activePresenceIdsRef.current.size);
        if (votes.length > activeCount / 2) {
          const position = currentMusicPosition(state, now);
          next = {
            ...state,
            revision: state.revision + 1,
            position,
            startedAt: desiredPlaying ? now : 0,
            playing: desiredPlaying,
            updatedAt: now,
            skipVotes: [],
            pauseVotes: [],
            pauseTargetPlaying: desiredPlaying,
          };
        } else {
          next = {
            ...state,
            revision: state.revision + 1,
            pauseVotes: votes,
            pauseTargetPlaying: desiredPlaying,
            updatedAt: now,
          };
        }
      } else if (action === "volume") {
        next = { ...state, revision: state.revision + 1, volume: Math.max(0, Math.min(1, Number(payload.volume) || 0)), updatedAt: now };
      } else if (action === "skip") {
        if (!state.current) return;
        const votes = [...new Set([...state.skipVotes, requesterId])];
        const activeCount = Math.max(1, activePresenceIdsRef.current.size);
        if (votes.length > activeCount / 2) {
          const upcoming = state.queue[0] || null;
          next = { ...state, revision: state.revision + 1, current: upcoming, track: upcoming, queue: state.queue.slice(1), position: 0, startedAt: upcoming ? now : 0, playing: Boolean(upcoming), skipVotes: [], pauseVotes: [], pauseTargetPlaying: Boolean(upcoming) ? false : true, updatedAt: now };
        } else {
          next = { ...state, revision: state.revision + 1, skipVotes: votes, updatedAt: now };
        }
      } else if (action === "ended") {
        if (Number(payload.revision) !== state.revision || endedRevisionRef.current === state.revision) return;
        endedRevisionRef.current = state.revision;
        const upcoming = state.queue[0] || null;
        next = { ...state, revision: state.revision + 1, current: upcoming, track: upcoming, queue: state.queue.slice(1), position: 0, startedAt: upcoming?.audioUrl ? now : 0, playing: Boolean(upcoming?.audioUrl), skipVotes: [], pauseVotes: [], pauseTargetPlaying: Boolean(upcoming?.audioUrl) ? false : true, updatedAt: now };
      } else {
        return;
      }

      const normalized = normalizeMusicState({ ...next, leaderId: clientIdRef.current });
      setMusicState(normalized);
      void channel.send({ type: "broadcast", event: SOCIAL_EVENTS.MUSIC, payload: { ...normalized, senderId: clientIdRef.current } });
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

    const syncMusicPresence = (state) => {
      const ids = new Set(Object.keys(state || {}));
      ids.add(clientIdRef.current);
      activePresenceIdsRef.current = ids;
      const leaderId = [...ids].sort()[0] || clientIdRef.current;
      const candidates = Object.entries(state || {})
        .flatMap(([id, metas]) => (Array.isArray(metas) ? metas : [metas]).map((meta) => ({ id, music: normalizeMusicState(meta?.music) })))
        .map((entry) => entry.music)
        .filter(Boolean)
        .sort((a, b) => b.revision - a.revision || b.updatedAt - a.updatedAt);
      const candidate = candidates[0];
      if (candidate && candidate.revision >= musicStateRef.current.revision) {
        setMusicState({ ...candidate, leaderId });
      } else if (leaderId === clientIdRef.current && musicStateRef.current.leaderId !== leaderId) {
        const next = normalizeMusicState({ ...musicStateRef.current, leaderId, updatedAt: Date.now() });
        if (next) {
          setMusicState(next);
          void channel.send({ type: "broadcast", event: SOCIAL_EVENTS.MUSIC, payload: { ...next, senderId: clientIdRef.current } });
        }
      }
    };

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      syncMusicPresence(state);
      if (!voiceEnabledRef.current) return;
      Object.keys(state)
        .filter((id) => id !== clientIdRef.current && clientIdRef.current < id)
        .forEach((id) => void ensurePeer(id, true));
    });
    channel.on("presence", { event: "join" }, ({ key }) => {
      const state = channel.presenceState();
      syncMusicPresence(state);
      if (voiceEnabledRef.current && key !== clientIdRef.current && clientIdRef.current < key) void ensurePeer(key, true);
    });
    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      const state = channel.presenceState();
      syncMusicPresence(state);
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
      const music = musicStateRef.current;
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
          kind: "player",
          name: nameRef.current || "Guest",
          voice: voiceEnabledRef.current,
          music: musicStateRef.current,
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

  const sendMusicRequest = useCallback(async (action, payload = {}) => {
    const channel = channelRef.current;
    if (!channel || !socialReadyRef.current) return false;
    return channel.send({
      type: "broadcast",
      event: SOCIAL_EVENTS.MUSIC_REQUEST,
      payload: { action, ...payload, senderId: clientIdRef.current },
    });
  }, []);

  useEffect(() => {
    const channel = channelRef.current;
    if (!channel || !socialReadyRef.current) return;
    void channel.track({
      name: nameRef.current || "Guest",
      voice: voiceEnabledRef.current,
      music: musicState,
    });
  }, [musicState]);

  const enableVoice = useCallback(async () => {
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
    } catch (error) {
      setVoiceStatus(error?.name === "NotAllowedError" ? "Microphone permission denied" : "Microphone unavailable");
    }
  }, [ensurePeer, pushActivity, voiceOn]);

  const toggleMute = useCallback(() => {
    const next = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => { track.enabled = !next; });
    setMuted(next);
  }, [muted]);

  const loadMusic = useCallback(async (query = musicSearch) => {
    const cleanQuery = String(query || "").trim();
    if (cleanQuery.length < 2) {
      setTracks([]);
      setMusicStatus("Search for at least 2 characters.");
      return;
    }
    setMusicBusy(true);
    try {
      const response = await fetch(`/api/music?search=${encodeURIComponent(cleanQuery)}`);
      const data = await response.json();
      setTracks(Array.isArray(data.tracks) ? data.tracks : []);
      setMusicStatus(data.error || (data.tracks?.length ? "YouTube catalog ready. Tap Queue to start shared playback." : "No playable catalog results found."));
    } catch (error) {
      console.error("YouTube catalog load failed", error);
      setTracks([]);
      setMusicStatus("Music catalog search is temporarily unavailable.");
    } finally {
      setMusicBusy(false);
    }
  }, [musicSearch]);

  const openRoomMusic = useCallback(() => {
    const url = "/music?room=" + encodeURIComponent(ROOM_NAME);
    const opened = window.open(url, "gc-hangout-room-music");
    if (!opened) {
      setMusicStatus("Allow pop-ups to open the Room Music player.");
      return false;
    }
    setMusicStatus("Room player opened. It runs independently from this panel.");
    return true;
  }, []);

  const queueTrack = useCallback((track) => {
    const normalized = normalizeMusicTrack({ ...track, requesterId: clientIdRef.current, requesterName: nameRef.current || "Guest", requestedAt: Date.now() });
    if (!normalized) return;
    sharedAudioUnlockedRef.current = true;
    openRoomMusic();
    void sendMusicRequest("add", { track: normalized, requesterName: nameRef.current || "Guest" }).then((sent) => {
      if (!sent) setMusicStatus("Music connection is not ready. Try Queue again.");
    });
    setPanel("music");
  }, [openRoomMusic, sendMusicRequest]);

  const votePauseResume = useCallback(() => {
    sharedAudioUnlockedRef.current = true;
    if (!musicStateRef.current.current) {
      if (tracks[0]) queueTrack(tracks[0]);
      return;
    }
    const desiredPlaying = !musicStateRef.current.playing;
    void sendMusicRequest("pause_vote", { desiredPlaying });
  }, [queueTrack, sendMusicRequest, tracks]);

  const setMusicVolume = useCallback((value) => {
    const volume = Math.max(0, Math.min(1, Number(value)));
    void sendMusicRequest("volume", { volume });
  }, [sendMusicRequest]);

  const voteSkip = useCallback(() => {
    if (!musicStateRef.current.current) return;
    void sendMusicRequest("skip");
  }, [sendMusicRequest]);

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
          <div className="social-panel-head"><strong>Shared music</strong><span>{musicState.current ? `${musicState.current.title} · ${musicState.current.artist}` : "Nothing playing"}</span></div>
          <button className="music-player-launch" onClick={openRoomMusic}>
            <span>🎧</span>
            <span><strong>Open Room Music</strong><small>Separate YouTube player · closing this panel will not stop it</small></span>
            <b>↗</b>
          </button>
          <div className="music-now">
            <div className="music-main-row">
              <button className="music-main" onClick={votePauseResume}>{musicState.playing ? "Vote to pause" : "Vote to resume"}{musicState.current ? ` · ${musicState.current.title}` : ""}</button>
              <button className="music-next" onClick={voteSkip} disabled={!musicState.current}>Skip vote</button>
            </div>
            <span>{musicState.current ? `${Math.floor(currentMusicPosition(musicState))}s · ${musicState.playing ? `${musicState.pauseVotes.length} pause vote${musicState.pauseVotes.length === 1 ? "" : "s"}` : `${musicState.pauseVotes.length} resume vote${musicState.pauseVotes.length === 1 ? "" : "s"}`} · ${musicState.skipVotes.length} skip vote${musicState.skipVotes.length === 1 ? "" : "s"}` : "Queue a video to start the room"}</span>
          </div>
          <div className="speaker-volume-note">Room volume is shared. Walk to the floor speaker to change it.</div>
          <form className="music-search" onSubmit={(event) => { event.preventDefault(); void loadMusic(musicSearch); }}>
            <input value={musicSearch} onChange={(event) => setMusicSearch(event.target.value)} placeholder="Search YouTube music" inputMode="search" enterKeyHint="search" />
            <button type="submit" disabled={musicBusy}>{musicBusy ? "…" : "Search"}</button>
          </form>
          <div className="track-list">
            {tracks.map((track) => (
              <button key={track.id} className="track" onClick={() => queueTrack(track)}>
                <img src={track.thumbnail} alt="" />
                <span><b>{track.title}</b><small>{track.artist}</small></span><em>＋ Queue</em>
              </button>
            ))}
            {!tracks.length && <div className="social-empty">Search the catalog to add a track to the shared queue.</div>}
          </div>
          <div className="music-queue">
            <strong>Queue · {musicState.queue.length}/{MUSIC_QUEUE_LIMIT}</strong>
            {musicState.queue.slice(0, 8).map((track, index) => <div key={track.id}><span>{index + 1}. {track.title}</span><small>{track.requesterName}</small></div>)}
          </div>
          <small className="social-note">{musicStatus} · Anyone can queue. More than half of active players must vote to pause/resume or advance the room. The YouTube player is separate from this panel; closing the panel does not stop room music.</small>
          <small className="youtube-attribution">Catalog source · <a href="https://www.youtube.com/t/terms" target="_blank" rel="noreferrer">YouTube Terms</a> · <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">Google Privacy</a></small>
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
