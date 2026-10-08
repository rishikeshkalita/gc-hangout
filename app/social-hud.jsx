"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { EMOTES, MUSIC_QUEUE_LIMIT, SOCIAL_EVENTS, createClientId, currentMusicPosition, formatChatTime, normalizeEmote, normalizeMusicState, normalizeMusicTrack, sanitizeChatMessage } from "../lib/social-state.mjs";
import { getSupabase, ensureAnonymousSession } from "../lib/supabase.js";

const ROOM_NAME = "main";
const BALL_RADIUS = 0.28;
const BALL_FLOOR_Y = BALL_RADIUS;
const BALL_GRAVITY = 9.8;
const BALL_FLOOR_BOUNCE = 0.62;
const BALL_WALL_BOUNCE = 0.72;
const BALL_FRICTION = 0.986;
const BALL_PLAYER_TOUCH_RADIUS = 0.74;
const BALL_PLAYER_RELEASE_RADIUS = 0.96;
const FOOTBALL_COURT_CENTER_X = -5.8;
const FOOTBALL_GOAL_HALF_WIDTH = 1.5;
const FOOTBALL_GOAL_HEIGHT = 2;
const FOOTBALL_GOAL_LINE_Z = 7.95;
const BALL_OBSTACLES = Object.freeze([
  { x: -9.8, z: -7.25, rx: 3.15, rz: 0.95 },
  { x: -9.8, z: 0.55, rx: 3.15, rz: 0.95 },
  { x: -9.8, z: -3.35, rx: 1.25, rz: 0.95 },
  { x: 0, z: -9.15, rx: 4.8, rz: 0.78 },
  { x: 9.7, z: 5.8, rx: 2.75, rz: 1.65 },
  { x: 8.2, z: 3.95, rx: 0.72, rz: 0.72 },
  { x: 9.7, z: 3.95, rx: 0.72, rz: 0.72 },
  { x: 11.2, z: 3.95, rx: 0.72, rz: 0.72 },
  { x: 8.2, z: 7.65, rx: 0.72, rz: 0.72 },
  { x: 9.7, z: 7.65, rx: 0.72, rz: 0.72 },
  { x: 11.2, z: 7.65, rx: 0.72, rz: 0.72 },
  { x: 8.7, z: -6.5, rx: 2.05, rz: 1.85 },
  { x: 4.0, z: 1.35, rx: 1.38, rz: 1.25 },
  { x: 5.5, z: -4.55, rx: 0.95, rz: 0.72 },
  { x: -13.1, z: 7.5, rx: 0.78, rz: 0.78 },
  { x: 13.0, z: -7.7, rx: 0.92, rz: 0.92 },
  { x: -12.0, z: 5.8, rx: 0.58, rz: 0.58 },
  { x: 5.8, z: 6.8, rx: 0.58, rz: 0.58 },
]);

const clampBall = (value, min, max) => Math.max(min, Math.min(max, value));
const ballStateSnapshot = (value) => ({
  x: Number(value?.x) || 0,
  y: Math.max(BALL_FLOOR_Y, Number(value?.y) || BALL_FLOOR_Y),
  z: Number(value?.z) || 0,
  vx: Number(value?.vx) || 0,
  vy: Number(value?.vy) || 0,
  vz: Number(value?.vz) || 0,
  rotationX: Number(value?.rotationX) || 0,
  rotationZ: Number(value?.rotationZ) || 0,
  timestamp: Number(value?.timestamp) || Date.now(),
  lastTouchId: value?.lastTouchId ? String(value.lastTouchId) : null,
  lastTouchName: value?.lastTouchName ? String(value.lastTouchName).slice(0, 18) : null,
});

function getIceServers() {
  const urls = (process.env.NEXT_PUBLIC_TURN_URLS || "stun:stun.l.google.com:19302").split(",").map((item) => item.trim()).filter(Boolean);
  const username = process.env.NEXT_PUBLIC_TURN_USERNAME;
  const credential = process.env.NEXT_PUBLIC_TURN_CREDENTIAL;
  return [{ urls, ...(username && credential ? { username, credential } : {}) }];
}

function PanelButton({ active, children, onClick, label }) {
  return <button className={`social-tool ${active ? "active" : ""}`} onPointerDown={(event) => event.stopPropagation()} onClick={onClick} aria-label={label || children}>{children}</button>;
}

export default function SocialHud({ name, onMusicState, onEmote, emote = null, speakerActive = false, playerState = null, ballState = null, interaction = null, onRemotePlayers, onPairAction, onBallState, onFootballScores, remotePlayers = [], initialAudioUnlocked = false }) {
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
  const speakerControlActive = Boolean(speakerActive && musicState.current);
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
  const queuePendingRef = useRef(new Set());
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
  const ballRef = useRef({ x: -5.8, y: BALL_FLOOR_Y, z: 0, vx: 0, vy: 0, vz: 0, rotationX: 0, rotationZ: 0, timestamp: Date.now() });
  const ballTouchRef = useRef(new Map());
  const ballPlayerMotionRef = useRef(new Map());
  const ballPredictionUntilRef = useRef(0);
  const footballScoresRef = useRef([]);
  const footballGoalRef = useRef(null);
  const lastKickAtRef = useRef(0);
  const ballTouchCooldownRef = useRef(new Map());
  const lastActivityInteractionRef = useRef("");
  const socialReadyRef = useRef(false);
  const gameReadyRef = useRef(false);
  const sessionStartedRef = useRef(false);
  const reconnectTimerRef = useRef(null);

  const getBallAuthorityId = useCallback((state) => {
    const ids = new Set(Object.keys(state || {}));
    ids.add(clientIdRef.current);
    return [...ids].sort()[0] || clientIdRef.current;
  }, []);

  const publishBallState = useCallback(() => {
    const snapshot = ballStateSnapshot(ballRef.current);
    onBallState?.(snapshot);
    return snapshot;
  }, [onBallState]);

  const simulateBallStep = useCallback((dt) => {
    const ball = ballRef.current;
    const previousX = ball.x;
    const previousZ = ball.z;
    ball.vy -= BALL_GRAVITY * dt;
    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;
    ball.z += ball.vz * dt;

    if (ball.y < BALL_FLOOR_Y) {
      ball.y = BALL_FLOOR_Y;
      if (ball.vy < -0.35) ball.vy = -ball.vy * BALL_FLOOR_BOUNCE;
      else ball.vy = 0;
      ball.vx *= BALL_FRICTION;
      ball.vz *= BALL_FRICTION;
    }

    // Detect a goal before the ball reaches the back wall. The two goals
    // face inward, so the ball crosses +/- goal-line Z while inside the posts.
    const crossedPositiveGoal = previousZ < FOOTBALL_GOAL_LINE_Z && ball.z >= FOOTBALL_GOAL_LINE_Z;
    const crossedNegativeGoal = previousZ > -FOOTBALL_GOAL_LINE_Z && ball.z <= -FOOTBALL_GOAL_LINE_Z;
    const inGoalMouth = Math.abs(ball.x - FOOTBALL_COURT_CENTER_X) <= FOOTBALL_GOAL_HALF_WIDTH && ball.y <= FOOTBALL_GOAL_HEIGHT;
    if (inGoalMouth && (crossedPositiveGoal || crossedNegativeGoal)) {
      footballGoalRef.current = {
        scorerId: ball.lastTouchId || null,
        scorerName: ball.lastTouchName || "Guest",
        direction: crossedPositiveGoal ? "north" : "south",
        timestamp: Date.now(),
      };
      ball.vx = 0;
      ball.vy = 0;
      ball.vz = 0;
      ball.x = FOOTBALL_COURT_CENTER_X;
      ball.y = BALL_FLOOR_Y;
      ball.z = 0;
      return 0;
    }

    const wallX = 15 - BALL_RADIUS;
    const wallZ = 10 - BALL_RADIUS;
    if (ball.x < -wallX) { ball.x = -wallX; ball.vx = Math.abs(ball.vx) * BALL_WALL_BOUNCE; }
    if (ball.x > wallX) { ball.x = wallX; ball.vx = -Math.abs(ball.vx) * BALL_WALL_BOUNCE; }
    if (ball.z < -wallZ) { ball.z = -wallZ; ball.vz = Math.abs(ball.vz) * BALL_WALL_BOUNCE; }
    if (ball.z > wallZ) { ball.z = wallZ; ball.vz = -Math.abs(ball.vz) * BALL_WALL_BOUNCE; }

    for (const obstacle of BALL_OBSTACLES) {
      const minX = obstacle.x - obstacle.rx - BALL_RADIUS;
      const maxX = obstacle.x + obstacle.rx + BALL_RADIUS;
      const minZ = obstacle.z - obstacle.rz - BALL_RADIUS;
      const maxZ = obstacle.z + obstacle.rz + BALL_RADIUS;
      if (ball.x < minX || ball.x > maxX || ball.z < minZ || ball.z > maxZ) continue;

      const qx = clampBall(ball.x, obstacle.x - obstacle.rx, obstacle.x + obstacle.rx);
      const qz = clampBall(ball.z, obstacle.z - obstacle.rz, obstacle.z + obstacle.rz);
      let nx = ball.x - qx;
      let nz = ball.z - qz;
      const distance = Math.hypot(nx, nz);

      if (distance > 0 && distance < BALL_RADIUS) {
        nx /= distance;
        nz /= distance;
        const penetration = BALL_RADIUS - distance;
        ball.x += nx * penetration;
        ball.z += nz * penetration;
        const outward = ball.vx * nx + ball.vz * nz;
        if (outward < 0) {
          ball.vx -= (1 + BALL_WALL_BOUNCE) * outward * nx;
          ball.vz -= (1 + BALL_WALL_BOUNCE) * outward * nz;
        }
        continue;
      }

      if (distance === 0) {
        const dx = Math.min(Math.abs(ball.x - (obstacle.x - obstacle.rx)), Math.abs((obstacle.x + obstacle.rx) - ball.x));
        const dz = Math.min(Math.abs(ball.z - (obstacle.z - obstacle.rz)), Math.abs((obstacle.z + obstacle.rz) - ball.z));
        if (dx < dz) {
          const nx2 = ball.x < obstacle.x ? -1 : 1;
          ball.x = obstacle.x + nx2 * (obstacle.rx + BALL_RADIUS);
          if (ball.vx * nx2 < 0) ball.vx = -ball.vx * BALL_WALL_BOUNCE;
        } else {
          const nz2 = ball.z < obstacle.z ? -1 : 1;
          ball.z = obstacle.z + nz2 * (obstacle.rz + BALL_RADIUS);
          if (ball.vz * nz2 < 0) ball.vz = -ball.vz * BALL_WALL_BOUNCE;
        }
      }
    }

    ball.rotationX += ball.vz * dt / BALL_RADIUS;
    ball.rotationZ -= ball.vx * dt / BALL_RADIUS;
    ball.timestamp = Date.now();

    return Math.hypot(ball.vx, ball.vz);
  }, []);

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

  const applyFootballScores = useCallback((scores) => {
    const normalized = (Array.isArray(scores) ? scores : [])
      .map((entry) => ({
        id: String(entry?.id || "").slice(0, 80),
        name: String(entry?.name || "Player").slice(0, 18),
        goals: Math.max(0, Math.floor(Number(entry?.goals) || 0)),
      }))
      .filter((entry) => entry.id)
      .sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name))
      .slice(0, 20);
    footballScoresRef.current = normalized;
    onFootballScores?.(normalized);
  }, [onFootballScores]);

  const readPresencePlayers = useCallback((state) => {
    const seen = new Set();
    for (const [id, presences] of Object.entries(state || {})) {
      if (id === clientIdRef.current) continue;
      const meta = Array.isArray(presences) ? presences[0] : null;
      if (!meta || meta.kind !== "player") continue;
      const nextScores = footballScoresRef.current.slice();
      const existingScore = nextScores.find((entry) => entry.id === id);
      if (!existingScore) nextScores.push({ id, name: String(meta.name || "Player").slice(0, 18), goals: 0 });
      for (const incoming of Array.isArray(meta.footballScores) ? meta.footballScores : []) {
        const scoreId = String(incoming?.id || "");
        if (!scoreId) continue;
        const localScore = nextScores.find((entry) => entry.id === scoreId);
        const incomingGoals = Math.max(0, Math.floor(Number(incoming?.goals) || 0));
        if (!localScore) nextScores.push({ id: scoreId, name: String(incoming?.name || "Player").slice(0, 18), goals: incomingGoals });
        else if (incomingGoals > localScore.goals) Object.assign(localScore, { goals: incomingGoals, name: String(incoming?.name || localScore.name).slice(0, 18) });
      }
      applyFootballScores(nextScores);
      seen.add(id);
      mergeRemotePlayer({ ...meta, senderId: id });
    }
    let changed = false;
    for (const id of remotePlayersRef.current.keys()) {
      if (!seen.has(id)) {
        remotePlayersRef.current.delete(id);
        changed = true;
      }
    }
    if (changed) onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
  }, [applyFootballScores, mergeRemotePlayer, onRemotePlayers]);

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
    const volume = Math.max(0, Math.min(1, Number(musicStateRef.current.volume ?? 0.8)));
    audio.volume = volume;
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
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: clientIdRef.current } },
    });
    channelRef.current = channel;

    channel.on("broadcast", { event: SOCIAL_EVENTS.BALL }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const incoming = ballStateSnapshot(payload);
      if (incoming.timestamp < Number(ballRef.current.timestamp || 0)) return;
      ballRef.current = incoming;
      onBallState?.(incoming);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.BALL_KICK }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const state = channel.presenceState?.() || {};
      if (getBallAuthorityId(state) !== clientIdRef.current) return;
      applyNetworkBallKick(payload);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.BALL_TOUCH }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const state = channel.presenceState?.() || {};
      if (getBallAuthorityId(state) !== clientIdRef.current) return;
      applyNetworkBallTouch(payload);
    });
    channel.on("broadcast", { event: SOCIAL_EVENTS.FOOTBALL_SCORE }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      applyFootballScores(payload?.scores || []);
      if (payload?.ball) {
        const incoming = ballStateSnapshot(payload.ball);
        ballRef.current = incoming;
        onBallState?.(incoming);
      }
      const scorer = String(payload?.scorerName || "").trim();
      if (scorer) {
        pushChatToast({
          id: `football-goal-${payload?.timestamp || Date.now()}`,
          name: scorer,
          message: "⚽ scored a goal",
          timestamp: Number(payload?.timestamp) || Date.now(),
          local: false,
          activity: true,
        });
      }
    });
    // Multiplayer transforms also use the primary social channel.
    // This makes player visibility independent of the football/game channel.
    channel.on("broadcast", { event: SOCIAL_EVENTS.PLAYER }, ({ payload }) => {
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

    channel.on("broadcast", { event: SOCIAL_EVENTS.MUSIC_SYNC }, ({ payload }) => {
      if (!payload || payload.senderId === clientIdRef.current) return;
      const revision = Number(payload.revision) || 0;
      const current = musicStateRef.current;
      if (revision && revision < Number(current.revision || 0)) return;
      const incomingTrack = normalizeMusicTrack(payload.track);
      const queuedTrack = normalizeMusicTrack(payload.queueTrack);
      const action = String(payload.action || "");
      setMusicState((state) => {
        let next = { ...state, revision: Math.max(Number(state.revision) || 0, revision), updatedAt: Date.now() };
        if (Number.isFinite(Number(payload.volume))) next.volume = Math.max(0, Math.min(1, Number(payload.volume)));
        if (action === "queue" && queuedTrack) {
          if (payload.currentTrackId === queuedTrack.id) {
            next = { ...next, current: queuedTrack, track: queuedTrack, queue: state.queue.filter((item) => item.id !== queuedTrack.id), position: 0, startedAt: Number(payload.startedAt) || Date.now(), playing: true };
          } else {
            next = { ...next, queue: [...state.queue.filter((item) => item.id !== queuedTrack.id), queuedTrack] };
          }
        } else if (action === "skip") {
          next = { ...next, current: incomingTrack, track: incomingTrack, queue: incomingTrack ? state.queue.filter((item) => item.id !== incomingTrack.id) : state.queue, position: Number(payload.position) || 0, startedAt: Number(payload.startedAt) || 0, playing: Boolean(payload.playing && incomingTrack), pauseVotes: [], resumeVotes: [], skipVotes: [] };
        } else if (action === "pause" || action === "resume") {
          next = { ...next, position: Math.max(0, Number(payload.position) || 0), startedAt: Number(payload.startedAt) || 0, playing: Boolean(payload.playing && state.current) };
        } else if (action === "volume") {
          next.volume = Math.max(0, Math.min(1, Number(payload.volume)));
        }
        return normalizeMusicState(next);
      });
    });

    channel.on("broadcast", { event: SOCIAL_EVENTS.MUSIC_VOLUME }, ({ payload }) => {
      if (payload?.senderId === clientIdRef.current) return;
      const volume = Math.max(0, Math.min(1, Number(payload?.volume)));
      if (!Number.isFinite(volume)) return;
      setMusicState((current) => ({ ...current, volume }));
      if (roomAudioRef.current) roomAudioRef.current.volume = volume;
    });

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

    const applyNetworkBallKick = (payload) => {
      const ball = ballRef.current;
      const playerX = Number(payload?.x);
      const playerZ = Number(payload?.z);
      if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return false;

      const incomingX = Number(payload?.ballX);
      const incomingY = Number(payload?.ballY);
      const incomingZ = Number(payload?.ballZ);
      const dx = ball.x - playerX;
      const dz = ball.z - playerZ;
      const horizontal = Math.hypot(dx, dz);
      const incomingHorizontal = Number.isFinite(incomingX) && Number.isFinite(incomingZ)
        ? Math.hypot(incomingX - playerX, incomingZ - playerZ)
        : Infinity;
      if (horizontal > BALL_PLAYER_TOUCH_RADIUS && incomingHorizontal > BALL_PLAYER_TOUCH_RADIUS) return false;

      const id = String(payload?.senderId || "");
      const now = Date.now();
      if (!id || now - lastKickAtRef.current < 180) return false;
      lastKickAtRef.current = now;

      const rot = Number(payload?.rot) || 0;
      const facingX = Math.sin(rot);
      const facingZ = Math.cos(rot);
      const awayX = horizontal > 0.001 ? dx / horizontal : facingX;
      const awayZ = horizontal > 0.001 ? dz / horizontal : facingZ;
      const facingDot = awayX * facingX + awayZ * facingZ;
      const kickX = facingDot >= -0.35 ? facingX : awayX;
      const kickZ = facingDot >= -0.35 ? facingZ : awayZ;

      const separation = BALL_PLAYER_TOUCH_RADIUS + 0.12;
      ball.x = Number.isFinite(incomingX) ? incomingX : playerX + awayX * separation;
      ball.z = Number.isFinite(incomingZ) ? incomingZ : playerZ + awayZ * separation;
      ball.y = Number.isFinite(incomingY) ? Math.max(BALL_FLOOR_Y, incomingY) : Math.max(BALL_FLOOR_Y, Math.min(0.48, ball.y));
      ball.vx = Number.isFinite(Number(payload?.ballVx)) ? Number(payload.ballVx) : kickX * 9.5 + awayX * 0.8;
      ball.vz = Number.isFinite(Number(payload?.ballVz)) ? Number(payload.ballVz) : kickZ * 9.5 + awayZ * 0.8;
      ball.vy = Number.isFinite(Number(payload?.ballVy)) ? Number(payload.ballVy) : 1.15;
      ball.lastTouchId = id;
      ball.lastTouchName = String(payload?.name || remotePlayersRef.current.get(id)?.name || (id === clientIdRef.current ? nameRef.current : "Player")).slice(0, 18);
      ball.timestamp = now;
      publishBallState();
      return true;
    };

    const applyNetworkBallTouch = (payload) => {
      const ball = ballRef.current;
      const playerX = Number(payload?.x);
      const playerZ = Number(payload?.z);
      if (!Number.isFinite(playerX) || !Number.isFinite(playerZ)) return false;

      const dx = ball.x - playerX;
      const dz = ball.z - playerZ;
      const horizontal = Math.hypot(dx, dz);
      if (horizontal > BALL_PLAYER_TOUCH_RADIUS || Math.abs(ball.y - 0.92) > 0.82) {
        if (horizontal > BALL_PLAYER_RELEASE_RADIUS) {
          ballTouchRef.current.delete(String(payload?.senderId || ""));
        }
        return false;
      }

      const id = String(payload?.senderId || "");
      if (!id) return false;
      const now = Date.now();
      const lastTouch = Number(ballTouchCooldownRef.current.get(id) || 0);
      if (now - lastTouch < 180) return false;
      ballTouchCooldownRef.current.set(id, now);

      const rot = Number(payload?.rot) || 0;
      const facingX = Math.sin(rot);
      const facingZ = Math.cos(rot);
      const moveSpeed = Math.max(0, Number(payload?.speed) || 0);
      const moving = Boolean(payload?.moving) || moveSpeed > 0.25;
      const awayX = horizontal > 0.001 ? dx / horizontal : facingX;
      const awayZ = horizontal > 0.001 ? dz / horizontal : facingZ;
      const kickX = facingX || awayX;
      const kickZ = facingZ || awayZ;
      const kickSpeed = moving ? 1.8 + Math.min(moveSpeed, 8) * 0.14 : 1.2;

      const separation = BALL_PLAYER_TOUCH_RADIUS + 0.08;
      ball.x = playerX + awayX * separation;
      ball.z = playerZ + awayZ * separation;
      ball.y = Math.max(BALL_FLOOR_Y, Math.min(0.55, ball.y));
      ball.vx = kickX * kickSpeed + awayX * 0.5;
      ball.vz = kickZ * kickSpeed + awayZ * 0.5;
      ball.vy = moving ? 0.06 : 0.03;
      ball.lastTouchId = id;
      ball.lastTouchName = String(payload?.name || remotePlayersRef.current.get(id)?.name || (id === clientIdRef.current ? nameRef.current : "Player")).slice(0, 18);
      ball.timestamp = now;
      publishBallState();
      return true;
    };

    const recordFootballGoal = async (goal) => {
      if (!goal || !goal.scorerId || Date.now() < Number(goal.timestamp || 0) - 2000) return;
      const current = footballScoresRef.current.slice();
      const index = current.findIndex((entry) => entry.id === String(goal.scorerId));
      if (index >= 0) {
        current[index] = { ...current[index], goals: current[index].goals + 1, name: String(goal.scorerName || current[index].name).slice(0, 18) };
      } else {
        current.push({ id: String(goal.scorerId), name: String(goal.scorerName || "Guest").slice(0, 18), goals: 1 });
      }
      current.sort((a, b) => b.goals - a.goals || a.name.localeCompare(b.name));
      const scores = current.slice(0, 20);
      applyFootballScores(scores);
      const resetBall = ballStateSnapshot(ballRef.current);
      resetBall.x = FOOTBALL_COURT_CENTER_X;
      resetBall.y = BALL_FLOOR_Y;
      resetBall.z = 0;
      resetBall.vx = 0;
      resetBall.vy = 0;
      resetBall.vz = 0;
      resetBall.lastTouchId = null;
      resetBall.lastTouchName = null;
      resetBall.timestamp = Date.now();
      ballRef.current = resetBall;
      onBallState?.(resetBall);
      void channel.send({
        type: "broadcast",
        event: SOCIAL_EVENTS.FOOTBALL_SCORE,
        payload: {
          senderId: clientIdRef.current,
          scorerId: String(goal.scorerId),
          scorerName: String(goal.scorerName || "Guest").slice(0, 18),
          direction: goal.direction,
          scores,
          ball: resetBall,
          timestamp: Date.now(),
        },
      });
      pushChatToast({
        id: `football-goal-local-${Date.now()}`,
        name: nameRef.current || "Guest",
        message: String(goal.scorerId) === clientIdRef.current ? "⚽ you scored" : `⚽ ${String(goal.scorerName || "Guest").slice(0, 18)} scored`,
        timestamp: Date.now(),
        local: true,
        activity: true,
      });
    };

    applyFootballScores([
      ...footballScoresRef.current,
      { id: clientIdRef.current, name: String(nameRef.current || "Guest").slice(0, 18), goals: 0 },
    ]);

    const publishPlayer = () => {
      const state = playerStateRef.current;
      if (!state) return;
      const payload = {
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
      };
      if (socialReadyRef.current) {
        void channel.send({ type: "broadcast", event: SOCIAL_EVENTS.PLAYER, payload }).then((result) => {
          if (result === "error") console.warn("GC Hangout social player broadcast rejected");
        });
      }
    };

    const syncMusicPresence = (state) => {
      const ids = new Set(Object.keys(state || {}));
      ids.add(clientIdRef.current);
      activePresenceIdsRef.current = ids;
    };

    channel.on("presence", { event: "sync" }, () => {
      const state = channel.presenceState();
      syncMusicPresence(state);
      readPresencePlayers(state);
      if (!voiceEnabledRef.current) return;
      Object.keys(state)
        .filter((id) => id !== clientIdRef.current && clientIdRef.current < id)
        .forEach((id) => void ensurePeer(id, true));
    });
    channel.on("presence", { event: "join" }, ({ key, newPresences }) => {
      const state = channel.presenceState();
      syncMusicPresence(state);
      if (key !== clientIdRef.current) {
        const meta = Array.isArray(newPresences) ? newPresences[0] : null;
        if (meta?.kind === "player") mergeRemotePlayer({ ...meta, senderId: key });
      }
      if (voiceEnabledRef.current && key !== clientIdRef.current && clientIdRef.current < key) void ensurePeer(key, true);
    });
    channel.on("presence", { event: "leave" }, ({ key, leftPresences }) => {
      const state = channel.presenceState();
      syncMusicPresence(state);
      closePeer(key);
      if (remotePlayersRef.current.delete(key)) onRemotePlayers?.(Array.from(remotePlayersRef.current.values()));
      const meta = Array.isArray(leftPresences) ? leftPresences[0] : null;
      pushChatToast({ id: `leave-${key}-${Date.now()}`, name: String(meta?.name || "Guest").slice(0, 18), message: "👋 left the room", timestamp: Date.now(), local: false, activity: true });
    });

    const playerTimer = window.setInterval(publishPlayer, 150);
    const ballTimer = window.setInterval(() => {
      const state = channel.presenceState?.() || {};
      const authorityId = getBallAuthorityId(state);
      const now = Date.now();
      const local = playerStateRef.current;
      if (local && Number.isFinite(Number(local.x)) && Number.isFinite(Number(local.z))) {
        const playerX = Number(local.x);
        const playerZ = Number(local.z);
        const dx = ballRef.current.x - playerX;
        const dz = ballRef.current.z - playerZ;
        const horizontal = Math.hypot(dx, dz);
        const vertical = Math.abs(ballRef.current.y - 0.92);
        const touching = horizontal <= BALL_PLAYER_TOUCH_RADIUS && vertical <= 0.82;
        const moving = Boolean(local.moving) || Number(local.speed) > 0.25;
        if (touching && moving) {
          const touchPayload = {
            senderId: clientIdRef.current,
            x: playerX,
            z: playerZ,
            rot: Number(local.rot) || 0,
            speed: Number(local.speed) || 0,
            moving: true,
            name: nameRef.current || "Player",
          };
          if (authorityId === clientIdRef.current) {
            applyNetworkBallTouch(touchPayload);
          } else {
            const lastTouch = Number(ballTouchCooldownRef.current.get(clientIdRef.current) || 0);
            if (now - lastTouch >= 180) {
              ballTouchCooldownRef.current.set(clientIdRef.current, now);
              void channel.send({ type: "broadcast", event: SOCIAL_EVENTS.BALL_TOUCH, payload: touchPayload });
            }
          }
        }
      }

      if (authorityId === clientIdRef.current) {
        footballGoalRef.current = null;
        for (let step = 0; step < 4; step += 1) simulateBallStep(1 / 120);
        const goal = footballGoalRef.current;
        if (goal && now - footballGoalRef.current.timestamp < 1500) {
          footballGoalRef.current = null;
          void recordFootballGoal(goal);
        }
        const payload = { ...ballRef.current, senderId: clientIdRef.current };
        const snapshot = publishBallState();
        void channel.send({ type: "broadcast", event: SOCIAL_EVENTS.BALL, payload: { ...snapshot, senderId: clientIdRef.current } });
      } else if (now < ballPredictionUntilRef.current) {
        // Short client-side prediction keeps the kick visible before the next
        // authoritative snapshot arrives.
        for (let step = 0; step < 4; step += 1) simulateBallStep(1 / 120);
        publishBallState();
      }
    }, 33);
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
      if (sessionStartedRef.current || !socialReadyRef.current) return;
      sessionStartedRef.current = true;
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
              void targetChannel.subscribe(handleGameStatus);
        }
      }, 900);
    };

    const handleSocialStatus = (status) => {
      socialReadyRef.current = status === "SUBSCRIBED";
      if (status === "SUBSCRIBED") {
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
          footballScores: footballScoresRef.current,
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

    void channel.subscribe(handleSocialStatus);

    return () => {
      peersRef.current.forEach((pc) => pc.close());
      peersRef.current.clear();
      localStreamRef.current?.getTracks().forEach((track) => track.stop());
      remoteAudioRef.current.forEach((audio) => audio.remove());
      remoteAudioRef.current.clear();
      window.clearInterval(playerTimer);
      window.clearInterval(ballTimer);
      window.clearInterval(pruneTimer);
      if (reconnectTimerRef.current) window.clearTimeout(reconnectTimerRef.current);
      reconnectTimerRef.current = null;
      socialReadyRef.current = false;
      gameReadyRef.current = false;
      sessionStartedRef.current = false;
      ballPredictionUntilRef.current = 0;
      footballScoresRef.current = [];
      footballGoalRef.current = null;
      ballTouchCooldownRef.current.clear();
      queuePendingRef.current.clear();
      remotePlayersRef.current.clear();
      onRemotePlayers?.([]);
      void channel.unsubscribe();
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
  }, [applyFootballScores, authUserId, closePeer, ensurePeer, getBallAuthorityId, onBallState, publishBallState, pushChatToast, sendSignal, simulateBallStep]);

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
        skipVotes: (votes || []).filter((v) => v.action === "skip").map((v) => v.user_id),
        deleteVotes: (votes || []).filter((v) => v.action === "delete").map((v) => v.user_id)
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
    void refreshMusicSnapshot();
    return data;
  }, [authUserId, refreshMusicSnapshot]);

  const queueTrack = useCallback(async (track) => {
    const normalized = normalizeMusicTrack(track);
    if (!normalized || queuePendingRef.current.has(normalized.id)) return;
    queuePendingRef.current.add(normalized.id);
    sharedAudioUnlockedRef.current = true;
    if (roomAudioRef.current) roomAudioRef.current.autoplay = true;
    try {
      const result = await rpcMusic("gc_music_queue_track", { p_track_id: normalized.id });
      if (result) {
        const row = Array.isArray(result) ? result[0] : result;
        const currentId = row?.current_track_id ? String(row.current_track_id) : null;
        const startedAt = Date.parse(row?.started_at || "") || Date.now();
        setMusicState((state) => normalizeMusicState(currentId === normalized.id
          ? { ...state, current: normalized, track: normalized, queue: state.queue.filter((item) => item.id !== normalized.id), position: 0, startedAt, playing: row?.status === "playing", revision: Number(row?.revision) || state.revision }
          : { ...state, queue: [...state.queue.filter((item) => item.id !== normalized.id), normalized], revision: Number(row?.revision) || state.revision }));
        void send(SOCIAL_EVENTS.MUSIC_SYNC, { action: "queue", queueTrack: normalized, track: currentId === normalized.id ? normalized : null, currentTrackId: currentId, playing: row?.status === "playing", position: Number(row?.position) || 0, startedAt, revision: Number(row?.revision) || 0, senderId: clientIdRef.current });
        setMusicStatus("Added to the shared queue.");
      }
    } finally {
      queuePendingRef.current.delete(normalized.id);
    }
    setPanel("music");
  }, [rpcMusic, send]);

  const votePauseResume = useCallback(async () => {
    if (!musicStateRef.current.current) {
      if (tracks[0]) await queueTrack(tracks[0]);
      return;
    }
    sharedAudioUnlockedRef.current = true;
    const action = musicStateRef.current.playing ? "pause" : "resume";
    const result = await rpcMusic("gc_music_vote", { p_action: action });
    if (result !== null) {
      const row = Array.isArray(result) ? result[0] : result;
      const startedAt = Date.parse(row?.started_at || "") || 0;
      setMusicState((state) => normalizeMusicState({ ...state, position: Number(row?.position) || state.position, startedAt, playing: row?.status === "playing" && Boolean(state.current), revision: Number(row?.revision) || state.revision }));
      void send(SOCIAL_EVENTS.MUSIC_SYNC, { action, playing: row?.status === "playing", position: Number(row?.position) || 0, startedAt, revision: Number(row?.revision) || 0, senderId: clientIdRef.current });
      pushActivity(action === "pause" ? "voted to pause the room music" : "voted to resume the room music", action === "pause" ? "⏸️" : "▶️");
    }
  }, [queueTrack, rpcMusic, tracks, pushActivity]);

  const setMusicVolume = useCallback(async (value) => {
    const volume = Math.max(0, Math.min(1, Number(value)));
    setMusicState((current) => ({ ...current, volume }));
    if (roomAudioRef.current) roomAudioRef.current.volume = volume;
    const result = await rpcMusic("gc_music_set_volume", { p_volume: volume });
    if (result) {
      const row = Array.isArray(result) ? result[0] : result;
      const revision = Number(row?.revision) || 0;
      void send(SOCIAL_EVENTS.MUSIC_VOLUME, { volume, revision });
      void send(SOCIAL_EVENTS.MUSIC_SYNC, { action: "volume", volume, revision, senderId: clientIdRef.current });
    }
  }, [rpcMusic, send]);

  const voteSkip = useCallback(async () => {
    if (!musicStateRef.current.current) return;
    const result = await rpcMusic("gc_music_vote", { p_action: "skip" });
    if (result !== null) {
      const row = Array.isArray(result) ? result[0] : result;
      const nextId = row?.current_track_id ? String(row.current_track_id) : null;
      const nextTrack = nextId ? (musicStateRef.current.queue.find((item) => item.id === nextId) || tracks.find((item) => item.id === nextId) || null) : null;
      const startedAt = Date.parse(row?.started_at || "") || 0;
      setMusicState((state) => normalizeMusicState({ ...state, current: nextTrack, track: nextTrack, queue: nextId ? state.queue.filter((item) => item.id !== nextId) : state.queue, position: Number(row?.position) || 0, startedAt, playing: row?.status === "playing" && Boolean(nextTrack), revision: Number(row?.revision) || state.revision, pauseVotes: [], resumeVotes: [], skipVotes: [] }));
      void send(SOCIAL_EVENTS.MUSIC_SYNC, { action: "skip", track: nextTrack, currentTrackId: nextId, playing: row?.status === "playing", position: Number(row?.position) || 0, startedAt, revision: Number(row?.revision) || 0, senderId: clientIdRef.current });
      pushActivity("voted to skip the current track", "⏭️");
    }
  }, [rpcMusic, pushActivity]);

  const voteDelete = useCallback(async (track) => {
    const normalized = normalizeMusicTrack(track);
    if (!normalized) return;
    const result = await rpcMusic("gc_music_delete_vote", { p_track_id: normalized.id });
    if (result !== null) pushActivity(`voted to delete “${normalized.title}”`, "🗑️");
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
    audio.crossOrigin = "anonymous";
    audio.volume = Math.max(0, Math.min(1, Number(musicStateRef.current.volume ?? 0.8)));

    const handlePlaying = () => setAudioBlocked(false);
    const handleError = () => {
      setAudioBlocked(true);
      setMusicStatus("The shared audio stream could not be played on this device.");
    };
    audio.addEventListener("playing", handlePlaying);
    audio.addEventListener("error", handleError);

    return () => {
      audio.removeEventListener("playing", handlePlaying);
      audio.removeEventListener("error", handleError);
      audio.pause();
      audio.removeAttribute("src");
      audio.load();
      roomAudioRef.current = null;
      roomAudioSourceRef.current = null;
      roomAudioGainRef.current = null;
      const context = roomAudioContextRef.current;
      roomAudioContextRef.current = null;
      if (context) void context.close().catch(() => {});
    };
  }, [setAudioSessionType]);

  useEffect(() => {
    const audio = roomAudioRef.current;
    if (!audio) return;
    audio.volume = musicVolume;
  }, [musicVolume]);

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

  const kickAvailable = useMemo(() => {
    const px = Number(playerState?.x);
    const pz = Number(playerState?.z);
    const bx = Number(ballState?.x);
    const by = Number(ballState?.y);
    const bz = Number(ballState?.z);
    if (![px, pz, bx, by, bz].every(Number.isFinite)) return false;
    return Math.hypot(bx - px, bz - pz) <= 1.25 && Math.abs(by - 0.92) <= 1.35;
  }, [ballState?.x, ballState?.y, ballState?.z, playerState?.x, playerState?.z]);

  const kickBall = useCallback(() => {
    if (!kickAvailable) return;
    const now = Date.now();
    if (now - lastKickAtRef.current < 180) return;
    const state = playerStateRef.current;
    const ball = ballRef.current;
    const playerX = Number(state?.x);
    const playerZ = Number(state?.z);
    if (![playerX, playerZ, ball.x, ball.y, ball.z].every(Number.isFinite)) return;
    const horizontal = Math.hypot(ball.x - playerX, ball.z - playerZ);
    if (horizontal > 1.25 || Math.abs(ball.y - 0.92) > 1.35) return;

    const rot = Number(state?.rot) || 0;
    const facingX = Math.sin(rot);
    const facingZ = Math.cos(rot);
    const awayX = horizontal > 0.001 ? (ball.x - playerX) / horizontal : facingX;
    const awayZ = horizontal > 0.001 ? (ball.z - playerZ) / horizontal : facingZ;
    const facingDot = awayX * facingX + awayZ * facingZ;
    const kickX = facingDot >= -0.35 ? facingX : awayX;
    const kickZ = facingDot >= -0.35 ? facingZ : awayZ;

    lastKickAtRef.current = now;
    const separation = BALL_PLAYER_TOUCH_RADIUS + 0.12;
    ball.x = playerX + awayX * separation;
    ball.z = playerZ + awayZ * separation;
    ball.y = Math.max(BALL_FLOOR_Y, Math.min(0.48, ball.y));
    ball.vx = kickX * 9.5 + awayX * 0.8;
    ball.vz = kickZ * 9.5 + awayZ * 0.8;
    ball.vy = 1.15;
    ball.lastTouchId = clientIdRef.current;
    ball.lastTouchName = String(nameRef.current || "Player").slice(0, 18);
    ball.timestamp = now;
    ballPredictionUntilRef.current = now + 520;
    publishBallState();
    void send(SOCIAL_EVENTS.BALL_KICK, {
      x: playerX,
      z: playerZ,
      rot,
      name: nameRef.current || "Player",
      ballX: ball.x,
      ballY: ball.y,
      ballZ: ball.z,
      ballVx: ball.vx,
      ballVy: ball.vy,
      ballVz: ball.vz,
      timestamp: now,
    });
  }, [kickAvailable, publishBallState, send]);

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
      {kickAvailable && (
        <button
          type="button"
          className="football-kick-button"
          onPointerDown={(event) => event.stopPropagation()}
          onClick={kickBall}
          aria-label="Kick football"
        >
          <span>⚽</span>
          <b>KICK</b>
        </button>
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
              <div key={track.id} className="track">
                <button type="button" className="track-queue" onClick={() => void queueTrack(track)} disabled={musicBusy}>
                  <span>🎵</span><span><b>{track.title}</b><small>{track.artist} · expires {new Date(track.expiresAt).toLocaleDateString()}</small></span>
                </button>
                <button type="button" className="track-delete" onClick={() => void voteDelete(track)} disabled={musicBusy} title="Vote to delete this shared track">
                  🗑 {musicState.deleteVotes.includes(track.id) ? "Voted" : "Vote delete"}
                </button>
              </div>
            ))}
            {!tracks.length && <div className="social-empty">Upload a track or search the shared room library.</div>}
          </div>
          <div className="music-queue">
            <strong>Queue · {musicState.queue.length}/{MUSIC_QUEUE_LIMIT}</strong>
            {musicState.queue.slice(0, 10).map((track, index) => <div key={track.id}><span>{index + 1}. {track.title}</span><small>{track.requesterName || "Room member"}</small></div>)}
          </div>
          <small className="social-note">{musicStatus} · 50% vote required for pause/resume/skip/delete · shared room volume · room music is independent of Chat and Voice.</small>
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