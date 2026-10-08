"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMOTES, MUSIC_QUEUE_LIMIT, SOCIAL_EVENTS, createClientId, currentMusicPosition, formatChatTime, normalizeEmote, normalizeMusicState, normalizeMusicTrack, sanitizeChatMessage } from "../lib/social-state.mjs";
import { getSupabase, ensureAnonymousSession } from "../lib/supabase.js";

const ROOM_NAME = "main";

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
  const [musicSearch, setMusicSearch] = useState("");
  const [musicState, setMusicState] = useState(normalizeMusicState(null));
  const [musicBusy, setMusicBusy] = useState(false);
  const [musicStatus, setMusicStatus] = useState("Shared uploaded music");
  const [audioBlocked, setAudioBlocked] = useState(false);
  const [authUserId, setAuthUserId] = useState("");
  const musicFileInputRef = useRef(null);
  const musicVolume = Math.max(0, Math.min(1, Number(musicState.volume ?? 0.8)));
  const speakerControlActive = Boolean(musicState.current);
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
  const roomAudioContextRef = useRef(null);
  const roomAudioSourceRef = useRef(null);
  const roomAudioGainRef = useRef(null);
  const roomAudioTrackRef = useRef("");
  const musicStateRef = useRef(musicState);
  const musicRefreshRef = useRef(null);
  const localStreamRef = useRef(null);
  const peersRef = useRef(new Map());
  const pendingCandidatesRef = useRef(new Map());
  const remoteAudioRef = useRef(new Map());
  const remoteStreamsRef = useRef(new Map());
  const voiceEnabledRef = useRef(false);
  const sharedAudioUnlockedRef = useRef(Boolean(initialAudioUnlocked));
  const activePresenceIdsRef = useRef(new Set([clientIdRef.current]));
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

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const supabase = await getSupabase();
        if (!supabase) throw new Error("Supabase is not configured.");
        const session = await ensureAnonymousSession(supabase, { name: String(name || "Guest").slice(0, 18) });
        if (cancelled) return;
        clientIdRef.current = session.user.id;
        activePresenceIdsRef.current = new Set([session.user.id]);
        setAuthUserId(session.user.id);
      } catch (error) {
        if (!cancelled) setMusicStatus(error?.message || "Anonymous multiplayer sign-in failed.");
      }
    })();
    return () => { cancelled = true; };
  }, [name]);

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

  const setAudioSessionType = useCallback((type) => {
    try {
      if ("audioSession" in navigator && navigator.audioSession) {
        navigator.audioSession.type = type;
      }
    } catch (error) {
      console.warn("Audio session type change failed", error);
    }
  }, []);

  const resumeRoomMusic = useCallback(async () => {
    const audio = roomAudioRef.current;
    const current = musicStateRef.current.current;
    if (!audio || !current || !musicStateRef.current.playing) return;
    audio.volume = Math.max(0, Math.min(1, Number(musicStateRef.current.volume ?? 0.8)));
    try {
      await audio.play();
      setAudioBlocked(false);
    } catch (error) {
      console.warn("Room music resume after voice change failed", error);
    }
  }, []);

  const enableVoice = useCallback(async () => {
    if (voiceEnabledRef.current) {
      voiceEnabledRef.current = false;
      setVoiceOn(false);
      setVoiceStatus("Leaving voice…");
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      setAudioSessionType("playback");
      localStreamRef.current = null;
      for (const peerId of Array.from(peersRef.current.keys())) closePeer(peerId);
      if (socialReadyRef.current) {
        await channelRef.current?.track({
          kind: "player",
          name: nameRef.current || "Guest",
          voice: false,
        });
      }
      await resumeRoomMusic();
      setVoiceStatus("Tap mic to join voice");
      return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
      setVoiceStatus("Microphone is unavailable in this browser.");
      return;
    }

    try {
      setVoiceStatus("Requesting microphone permission…");
      setAudioSessionType("play-and-record");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
        video: false,
      });
      localStreamRef.current = stream;
      voiceEnabledRef.current = true;
      setVoiceOn(true);
      setMuted(false);
      stream.getAudioTracks().forEach((track) => { track.enabled = true; });
      setVoiceStatus("Voice connected");
      await resumeRoomMusic();

      if (socialReadyRef.current) {
        await channelRef.current?.track({
          kind: "player",
          name: nameRef.current || "Guest",
          voice: true,
        });
        const state = channelRef.current?.presenceState?.() || {};
        Object.keys(state)
          .filter((id) => id !== clientIdRef.current && clientIdRef.current < id)
          .forEach((id) => void ensurePeer(id, true));
      }
    } catch (error) {
      voiceEnabledRef.current = false;
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      localStreamRef.current = null;
      setVoiceOn(false);
      setAudioSessionType("playback");
      const errorName = error?.name || "UnknownError";
      if (errorName === "NotAllowedError") {
        setVoiceStatus("Microphone permission was denied. Allow mic access for this site and try again.");
      } else if (errorName === "NotFoundError") {
        setVoiceStatus("No microphone was found.");
      } else if (errorName === "NotReadableError") {
        setVoiceStatus("The microphone is busy or unavailable.");
      } else {
        setVoiceStatus(error?.message || "Could not start voice.");
      }
      console.error("Voice microphone start failed", error);
    }
  }, [closePeer, ensurePeer, resumeRoomMusic, setAudioSessionType]);

  const toggleMute = useCallback(() => {
    const nextMuted = !muted;
    localStreamRef.current?.getAudioTracks().forEach((track) => {
      track.enabled = !nextMuted;
    });
    setMuted(nextMuted);
    setVoiceStatus(nextMuted ? "Muted" : "Voice connected");
  }, [muted]);

  useEffect(() => {
    if (!authUserId) return undefined;
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
    const refreshMusicSnapshot = async () => {
      const client = supabaseRef.current;
      if (!client || !socialReadyRef.current) return;
      try {
        const { data: stateRow, error: stateError } = await client.from("gc_music_state").select("*").eq("room_id", ROOM_NAME).single();
        if (stateError) throw stateError;
        let current = null;
        if (stateRow.current_track_id) {
          const { data } = await client.from("gc_music_tracks").select("*").eq("id", stateRow.current_track_id).maybeSingle();
          current = normalizeMusicTrack(data);
        }
        const { data: queueRows } = await client.from("gc_music_queue").select("id,queue_position,track:gc_music_tracks(*)").eq("room_id", ROOM_NAME).order("queue_position", { ascending: true }).limit(MUSIC_QUEUE_LIMIT);
        const { data: votes } = stateRow.current_track_id
          ? await client.from("gc_music_votes").select("action,user_id").eq("room_id", ROOM_NAME).eq("track_id", stateRow.current_track_id)
          : { data: [] };
        const next = normalizeMusicState({
          current,
          queue: (queueRows || []).map((row) => normalizeMusicTrack(row.track)).filter(Boolean),
          revision: Number(stateRow.revision) || 0,
          position: Number(stateRow.position) || 0,
          startedAt: stateRow.started_at ? Date.parse(stateRow.started_at) : 0,
          playing: stateRow.status === "playing",
          volume: Number(stateRow.volume) || 0,
          updatedAt: stateRow.updated_at ? Date.parse(stateRow.updated_at) : Date.now(),
          pauseVotes: (votes || []).filter((v) => v.action === "pause").map((v) => v.user_id),
          resumeVotes: (votes || []).filter((v) => v.action === "resume").map((v) => v.user_id),
          skipVotes: (votes || []).filter((v) => v.action === "skip").map((v) => v.user_id),
          deleteVotes: (votes || []).filter((v) => v.action === "delete").map((v) => v.user_id)
        });
        if (next) setMusicState(next);
        if (musicRefreshRef.current) window.clearTimeout(musicRefreshRef.current);
        musicRefreshRef.current = window.setTimeout(refreshMusicSnapshot, 5000);
      } catch (error) {
        console.warn("GC Hangout music state refresh failed", error);
      }
    };

    channel
      .on("postgres_changes", { event: "*", schema: "public", table: "gc_music_state", filter: "room_id=eq.main" }, () => { void refreshMusicSnapshot(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "gc_music_queue", filter: "room_id=eq.main" }, () => { void refreshMusicSnapshot(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "gc_music_tracks", filter: "room_id=eq.main" }, () => { void refreshMusicSnapshot(); });
    void refreshMusicSnapshot();

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
        kind: "player",
        name: nameRef.current || "Guest",
        voice: voiceEnabledRef.current,
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
  }, [authUserId, closePeer, ensurePeer, pushChatToast, sendSignal]);

  const refreshMusicSnapshot = useCallback(async () => {
    const client = supabaseRef.current;
    if (!client || !authUserId) return;
    try {
      const { data: stateRow, error } = await client.from("gc_music_state").select("*").eq("room_id", ROOM_NAME).single();
      if (error) throw error;
      let current = null;
      if (stateRow.current_track_id) {
        const { data } = await client.from("gc_music_tracks").select("*").eq("id", stateRow.current_track_id).maybeSingle();
        current = normalizeMusicTrack(data);
      }
      const { data: queueRows } = await client.from("gc_music_queue").select("id,queue_position,track:gc_music_tracks(*)").eq("room_id", ROOM_NAME).order("queue_position", { ascending: true }).limit(MUSIC_QUEUE_LIMIT);
      const { data: votes } = stateRow.current_track_id
        ? await client.from("gc_music_votes").select("action,user_id").eq("room_id", ROOM_NAME).eq("track_id", stateRow.current_track_id)
        : { data: [] };
      const next = normalizeMusicState({
        current,
        queue: (queueRows || []).map((row) => normalizeMusicTrack(row.track)).filter(Boolean),
        revision: Number(stateRow.revision) || 0,
        position: Number(stateRow.position) || 0,
        startedAt: stateRow.started_at ? Date.parse(stateRow.started_at) : 0,
        playing: stateRow.status === "playing",
        volume: Number(stateRow.volume) || 0,
        updatedAt: stateRow.updated_at ? Date.parse(stateRow.updated_at) : Date.now(),
        pauseVotes: (votes || []).filter((v) => v.action === "pause").map((v) => v.user_id),
        resumeVotes: (votes || []).filter((v) => v.action === "resume").map((v) => v.user_id),
        skipVotes: (votes || []).filter((v) => v.action === "skip").map((v) => v.user_id)
      });
      if (next) {
        setMusicState(next);
        onMusicState?.(next);
      }
    } catch (error) {
      console.warn("Music refresh failed", error);
    }
  }, [authUserId, onMusicState]);

  const rpcMusic = useCallback(async (fn, args = {}) => {
    const client = supabaseRef.current;
    if (!client || !authUserId) {
      setMusicStatus("Connecting to room…");
      return null;
    }
    const { data, error } = await client.rpc(fn, args);
    if (error) {
      setMusicStatus(error.message || "Music action failed.");
      return null;
    }
    await refreshMusicSnapshot();
    return data;
  }, [authUserId, refreshMusicSnapshot]);

  const queueTrack = useCallback(async (track) => {
    const normalized = normalizeMusicTrack(track);
    if (!normalized) return;
    sharedAudioUnlockedRef.current = true;
    const result = await rpcMusic("gc_music_queue_track", { p_track_id: normalized.id });
    if (result) setMusicStatus("Added to the shared queue.");
    setPanel("music");
  }, [rpcMusic]);

  const votePauseResume = useCallback(async () => {
    if (!musicStateRef.current.current) {
      if (tracks[0]) await queueTrack(tracks[0]);
      return;
    }
    sharedAudioUnlockedRef.current = true;
    const action = musicStateRef.current.playing ? "pause" : "resume";
    const result = await rpcMusic("gc_music_vote", { p_action: action });
    if (result !== null) {
      pushActivity(
        action === "pause" ? "voted to pause the room music" : "voted to resume the room music",
        action === "pause" ? "⏸️" : "▶️"
      );
    }
  }, [queueTrack, rpcMusic, tracks, pushActivity]);

  const setMusicVolume = useCallback(async (value) => {
    const volume = Math.max(0, Math.min(1, Number(value)));
    setMusicState((current) => ({ ...current, volume }));
    if (roomAudioRef.current) roomAudioRef.current.volume = volume;
    await rpcMusic("gc_music_set_volume", { p_volume: volume });
  }, [rpcMusic]);

  const voteSkip = useCallback(async () => {
    if (!musicStateRef.current.current) return;
    const result = await rpcMusic("gc_music_vote", { p_action: "skip" });
    if (result !== null) pushActivity("voted to skip the current track", "⏭️");
  }, [rpcMusic, pushActivity]);

  const unlockAudio = useCallback(async () => {
    const audio = roomAudioRef.current;
    if (!audio) return;
    try {
      await audio.play();
      setAudioBlocked(false);
    } catch {
      setMusicStatus("Browser audio permission is still blocked.");
    }
  }, []);

  const loadMusic = useCallback(async (query = musicSearch) => {
    const client = supabaseRef.current;
    if (!client) return;
    const cleanQuery = String(query || "").trim().toLowerCase();
    setMusicBusy(true);
    try {
      const { data, error } = await client.from("gc_music_tracks")
        .select("*")
        .eq("room_id", ROOM_NAME)
        .eq("status", "ready")
        .gt("expires_at", new Date().toISOString())
        .order("uploaded_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const filtered = (data || []).filter((track) => {
        if (!cleanQuery) return true;
        return [track.title, track.artist, track.filename].some((value) => String(value || "").toLowerCase().includes(cleanQuery));
      });
      setTracks(filtered.map(normalizeMusicTrack).filter(Boolean));
      setMusicStatus(filtered.length ? "Room library ready." : "No matching uploaded tracks.");
    } catch (error) {
      setTracks([]);
      setMusicStatus(error?.message || "Music library unavailable.");
    } finally {
      setMusicBusy(false);
    }
  }, [musicSearch]);

  const uploadMusic = useCallback(async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const allowed = new Set(["audio/mpeg","audio/mp4","audio/x-m4a","audio/aac","audio/ogg","audio/webm","audio/wav","audio/x-wav","audio/flac","audio/x-flac"]);
    const extension = String(file.name || "").split(".").pop()?.toLowerCase() || "";
    const extensionMime = {
      mp3: "audio/mpeg",
      m4a: "audio/mp4",
      aac: "audio/aac",
      ogg: "audio/ogg",
      oga: "audio/ogg",
      webm: "audio/webm",
      wav: "audio/wav",
      flac: "audio/flac",
    }[extension] || "";
    const mimeType = file.type || extensionMime;
    if (file.size > 26214400) {
      setMusicStatus("That file is larger than the 25 MB limit.");
      return;
    }
    if (!mimeType || !allowed.has(mimeType)) {
      setMusicStatus("Unsupported audio type. Use MP3, WAV, M4A/AAC, OGG, FLAC, or WebM.");
      return;
    }
    setMusicBusy(true);
    let trackId = null;
    let objectUrl = null;
    try {
      const client = supabaseRef.current;
      if (!client) throw new Error("Room backend is not ready.");
      const baseName = file.name.replace(/\.[^.]+$/, "").slice(0, 100) || "Untitled track";
      objectUrl = URL.createObjectURL(file);
      let duration = 0;
      try {
        duration = await new Promise((resolve) => {
          const audio = new Audio();
          audio.preload = "metadata";
          const finish = (value) => resolve(Number.isFinite(value) && value > 0 ? value : 0);
          const timeout = window.setTimeout(() => finish(0), 5000);
          audio.onloadedmetadata = () => {
            window.clearTimeout(timeout);
            finish(audio.duration);
          };
          audio.onerror = () => {
            window.clearTimeout(timeout);
            finish(0);
          };
          audio.src = objectUrl;
        });
      } catch {
        duration = 0;
      }
      const { data: uploadInfo, error: beginError } = await client.rpc("gc_music_begin_upload", {
        p_title: baseName,
        p_artist: "Unknown artist",
        p_filename: file.name,
        p_mime_type: mimeType,
        p_file_size: file.size
      });
      if (beginError) throw beginError;
      const info = Array.isArray(uploadInfo) ? uploadInfo[0] : uploadInfo;
      trackId = info?.track_id;
      const storagePath = info?.storage_path;
      if (!trackId || !storagePath) throw new Error("Upload reservation failed.");
      setMusicStatus("Uploading to the shared room…");
      const { error: uploadError } = await client.storage.from("gc-music").upload(storagePath, file, { contentType: mimeType, upsert: false });
      if (uploadError) throw uploadError;
      const { error: finalizeError } = await client.rpc("gc_music_finalize_upload", { p_track_id: trackId, p_duration: duration });
      if (finalizeError) throw finalizeError;
      setMusicStatus("Uploaded to the shared room library.");
      pushActivity(`uploaded “${baseName}” to the shared music library`, "🎵");
      await loadMusic("");
    } catch (error) {
      if (trackId) await supabaseRef.current?.rpc("gc_music_abort_upload", { p_track_id: trackId });
      setMusicStatus(error?.message || "Upload failed.");
    } finally {
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setMusicBusy(false);
    }
  }, [loadMusic]);

  useEffect(() => {
    setAudioSessionType("playback");
    const audio = roomAudioRef.current || new Audio();
    roomAudioRef.current = audio;
    audio.preload = "auto";
    audio.playsInline = true;
    audio.volume = musicVolume;
    return () => {
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      roomAudioRef.current = null;
    };
  }, [setAudioSessionType]);

  useEffect(() => {
    const audio = roomAudioRef.current;
    const current = musicState.current;
    if (!audio) return;
    audio.volume = musicVolume;
    if (!current) {
      audio.pause();
      roomAudioTrackRef.current = "";
      return;
    }
    let cancelled = false;
    const target = Math.max(0, currentMusicPosition(musicState));
    (async () => {
      try {
        if (roomAudioTrackRef.current !== current.id) {
          const client = supabaseRef.current;
          if (!client) return;
          const { data, error } = await client.storage.from("gc-music").createSignedUrl(current.storagePath, 14400);
          if (error || !data?.signedUrl) throw error || new Error("Could not prepare room audio.");
          if (cancelled) return;
          roomAudioTrackRef.current = current.id;
          audio.src = data.signedUrl;
          audio.load();
        }
        if (Number.isFinite(target) && Math.abs(audio.currentTime - target) > 1.25) audio.currentTime = target;
        if (musicState.playing) {
          await audio.play();
          setAudioBlocked(false);
        } else {
          audio.pause();
        }
      } catch {
        if (!cancelled) {
          setAudioBlocked(true);
          setMusicStatus("Tap Enable Room Audio to allow playback.");
        }
      }
    })();
    return () => { cancelled = true; };
  }, [musicState, musicVolume]);

  useEffect(() => {
    const audio = roomAudioRef.current;
    if (!audio) return;
    const onEnded = async () => {
      const current = musicStateRef.current.current;
      if (!current || !supabaseRef.current) return;
      await supabaseRef.current.rpc("gc_music_advance_if_current", { p_track_id: current.id });
    };
    audio.addEventListener("ended", onEnded);
    return () => audio.removeEventListener("ended", onEnded);
  }, []);

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
          <div className="social-panel-head"><strong>Shared music</strong><span>{musicState.current ? musicState.current.title : "Room library"}</span></div>
          {musicState.current && (
            <div className="music-now">
              <div className="music-main-row">
                <button className="music-main" onClick={() => void votePauseResume()}>{musicState.playing ? "Vote to pause" : "Vote to resume"}</button>
                <button className="music-next" onClick={() => void voteSkip()}>Vote to skip</button>
              </div>
              <span>{Math.floor(currentMusicPosition(musicState))}s · {musicState.playing ? musicState.pauseVotes.length : musicState.resumeVotes.length} votes · {musicState.skipVotes.length} skip votes</span>
            </div>
          )}
          {audioBlocked && <button className="music-player-launch" onClick={() => void unlockAudio()}><span>🔊</span><span><strong>Enable Room Audio</strong><small>Browser permission is required on this device.</small></span><b>▶</b></button>}
          <button type="button" className="music-player-launch" onClick={() => musicFileInputRef.current?.click()} disabled={musicBusy}>
            <span>⬆️</span><span><strong>{musicBusy ? "Uploading…" : "Upload music"}</strong><small>25 MB maximum · deleted after 72 hours</small></span><b>＋</b>
          </button>
          <input
            ref={musicFileInputRef}
            type="file"
            accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/aac,audio/ogg,audio/webm,audio/wav,audio/x-wav,audio/flac,audio/x-flac"
            onChange={uploadMusic}
            disabled={musicBusy}
            hidden
          />
          <form className="music-search" onSubmit={(event) => { event.preventDefault(); void loadMusic(musicSearch); }}>
            <input value={musicSearch} onChange={(event) => setMusicSearch(event.target.value)} placeholder="Search room uploads" inputMode="search" enterKeyHint="search" />
            <button type="submit" disabled={musicBusy}>{musicBusy ? "…" : "Search"}</button>
          </form>
          <div className="track-list">
            {tracks.map((track) => (
              <button key={track.id} className="track" onClick={() => void queueTrack(track)}>
                <span>🎵</span><span><b>{track.title}</b><small>{track.artist} · expires {new Date(track.expiresAt).toLocaleDateString()}</small></span><em>＋ Queue</em>
              </button>
            ))}
            {!tracks.length && <div className="social-empty">Upload a track or search the shared room library.</div>}
          </div>
          <div className="music-queue">
            <strong>Queue · {musicState.queue.length}/{MUSIC_QUEUE_LIMIT}</strong>
            {musicState.queue.slice(0, 10).map((track, index) => <div key={track.id}><span>{index + 1}. {track.title}</span><small>{track.requesterName || "Room member"}</small></div>)}
          </div>
          <small className="social-note">{musicStatus} · 50% vote required for pause/resume/skip · shared application volume · room music is independent of Chat and Voice.</small>
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
