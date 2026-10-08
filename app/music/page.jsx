"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createClient } from "@supabase/supabase-js";
import { currentMusicPosition, normalizeMusicState, SOCIAL_EVENTS } from "../../lib/social-state.mjs";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const ROOM_NAME = "main";

function createSupabase() {
  if (!SUPABASE_URL || !SUPABASE_KEY) return null;
  return createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

function choosePresenceState(channel) {
  const state = channel.presenceState();
  const candidates = [];
  for (const entries of Object.values(state || {})) {
    for (const entry of entries || []) {
      const music = normalizeMusicState(entry?.music);
      if (music) candidates.push(music);
    }
  }
  candidates.sort((a, b) => (b.revision - a.revision) || (b.updatedAt - a.updatedAt));
  return candidates[0] || null;
}

export default function RoomMusicPage() {
  const [musicState, setMusicState] = useState(null);
  const [status, setStatus] = useState("Connecting to room…");
  const [playerReady, setPlayerReady] = useState(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState(false);
  const channelRef = useRef(null);
  const playerRef = useRef(null);
  const playerHostRef = useRef(null);
  const currentVideoRef = useRef("");
  const syncingRef = useRef(false);
  const musicStateRef = useRef(null);

  useEffect(() => {
    musicStateRef.current = musicState;
  }, [musicState]);

  useEffect(() => {
    let cancelled = false;
    const supabase = createSupabase();
    if (!supabase) {
      setStatus("Room backend is not configured.");
      return undefined;
    }

    const channel = supabase.channel(`gc-hangout:${ROOM_NAME}`, {
      config: { private: true, broadcast: { self: false, ack: true }, presence: { key: `music-player-${Math.random().toString(36).slice(2)}` } },
    });
    channelRef.current = channel;

    const applyState = (payload) => {
      const next = normalizeMusicState(payload);
      if (!next) return;
      const previous = musicStateRef.current;
      if (previous && next.revision < previous.revision) return;
      if (previous && next.revision === previous.revision && next.updatedAt <= previous.updatedAt && next.leaderId === previous.leaderId) return;
      setMusicState(next);
      setStatus(next.current ? (next.playing ? "Room music playing" : "Room music paused") : "Waiting for a song…");
    };

    channel
      .on("broadcast", { event: SOCIAL_EVENTS.MUSIC }, ({ payload }) => applyState(payload))
      .on("presence", { event: "sync" }, () => {
        const next = choosePresenceState(channel);
        if (next) applyState(next);
      })
      .subscribe((subscriptionStatus) => {
        if (cancelled) return;
        if (subscriptionStatus === "SUBSCRIBED") {
          const next = choosePresenceState(channel);
          if (next) applyState(next);
          else setStatus("Connected — waiting for room music.");
        } else if (subscriptionStatus === "CHANNEL_ERROR" || subscriptionStatus === "TIMED_OUT") {
          setStatus("Room connection failed.");
        }
      });

    return () => {
      cancelled = true;
      channelRef.current = null;
      void supabase.removeChannel(channel);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadApi = () => new Promise((resolve, reject) => {
      if (window.YT?.Player) {
        resolve(window.YT);
        return;
      }
      const existing = document.querySelector('script[src="https://www.youtube.com/iframe_api"]');
      const previousReady = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = () => {
        previousReady?.();
        resolve(window.YT);
      };
      if (!existing) {
        const script = document.createElement("script");
        script.src = "https://www.youtube.com/iframe_api";
        script.async = true;
        script.onerror = () => reject(new Error("YouTube API failed to load"));
        document.head.appendChild(script);
      }
    });

    void loadApi().then((YT) => {
      if (cancelled || !playerHostRef.current || playerRef.current) return;
      playerRef.current = new YT.Player(playerHostRef.current, {
        width: "480",
        height: "270",
        playerVars: {
          playsinline: 1,
          controls: 1,
          rel: 0,
          origin: window.location.origin,
          autoplay: 0,
        },
        events: {
          onReady: (event) => {
            setPlayerReady(true);
            const state = musicStateRef.current;
            if (state?.current?.videoId) {
              event.target.cueVideoById({
                videoId: state.current.videoId,
                startSeconds: currentMusicPosition(state),
              });
              event.target.setVolume(Math.round(Number(state.volume ?? 0.8) * 100));
            }
          },
          onAutoplayBlocked: () => {
            setAutoplayBlocked(true);
            setStatus("Tap YouTube ▶ once on this device to enable room audio.");
          },
          onError: (event) => {
            setStatus(`YouTube playback error ${event.data}. This video may not allow embedding.`);
          },
          onStateChange: (event) => {
            const YTState = window.YT?.PlayerState;
            if (!YTState) return;
            const state = musicStateRef.current;
            if (!state?.current) return;

            if (event.data === YTState.ENDED) {
              const channel = channelRef.current;
              if (channel) {
                void channel.send({
                  type: "broadcast",
                  event: SOCIAL_EVENTS.MUSIC_REQUEST,
                  payload: {
                    action: "ended",
                    revision: state.revision,
                    senderId: `music-player-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
                  },
                });
              }
            } else if (event.data === YTState.PLAYING) {
              setAutoplayBlocked(false);
              setStatus("Room music playing");
            }
          },
        },
      });
    }).catch(() => {
      if (!cancelled) setStatus("YouTube player failed to load.");
    });

    return () => {
      cancelled = true;
      const player = playerRef.current;
      playerRef.current = null;
      try { player?.destroy(); } catch {}
    };
  }, []);

  useEffect(() => {
    const player = playerRef.current;
    const state = musicState;
    if (!player || !playerReady || !state?.current?.videoId) return;

    const videoId = state.current.videoId;
    const position = Math.max(0, currentMusicPosition(state));
    const previousVideo = currentVideoRef.current;

    try {
      player.setVolume(Math.round(Math.max(0, Math.min(1, Number(state.volume ?? 0.8))) * 100));
      if (previousVideo !== videoId) {
        currentVideoRef.current = videoId;
        player.cueVideoById({ videoId, startSeconds: position });
        setAutoplayBlocked(false);
        window.setTimeout(() => {
          const latest = musicStateRef.current;
          if (!latest?.current || latest.current.videoId !== videoId || !latest.playing) return;
          try {
            player.playVideo();
          } catch {}
        }, 250);
        return;
      }

      const playerState = player.getPlayerState?.();
      if (state.playing && playerState !== window.YT?.PlayerState.PLAYING && !syncingRef.current) {
        try { player.playVideo(); } catch {}
      } else if (!state.playing && playerState === window.YT?.PlayerState.PLAYING && !syncingRef.current) {
        try { player.pauseVideo(); } catch {}
      }
    } catch {}
  }, [musicState, playerReady]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const player = playerRef.current;
      const state = musicStateRef.current;
      if (!player || !state?.current?.videoId || !state.playing) return;
      try {
        const target = currentMusicPosition(state);
        const actual = Number(player.getCurrentTime?.() || 0);
        if (!Number.isFinite(actual) || !Number.isFinite(target)) return;
        if (Math.abs(actual - target) > 1.25) {
          syncingRef.current = true;
          player.seekTo(Math.max(0, target), true);
          window.setTimeout(() => { syncingRef.current = false; }, 350);
        }
      } catch {}
    }, 5000);
    return () => window.clearInterval(timer);
  }, []);

  const current = musicState?.current || null;
  const progress = useMemo(() => {
    if (!current || !musicState) return 0;
    return Math.max(0, Math.min(1, current.duration ? currentMusicPosition(musicState) / current.duration : 0));
  }, [current, musicState]);

  return (
    <main className="room-music-page">
      <section className="room-music-card">
        <div className="room-music-head">
          <div>
            <span className="room-music-kicker">GC HANGOUT · ROOM MUSIC</span>
            <h1>{current?.title || "No song playing"}</h1>
            <p>{current?.artist || "Choose a song from the game."}</p>
          </div>
          <a href="/" className="room-music-return">Back to game</a>
        </div>

        <div className="room-music-player">
          <div ref={playerHostRef} />
        </div>

        <div className="room-music-status">
          <span>{status}</span>
          {autoplayBlocked && <b>Tap ▶ in the YouTube player.</b>}
        </div>

        <div className="room-music-progress" aria-hidden="true">
          <span style={{ width: `${progress * 100}%` }} />
        </div>

        <p className="room-music-note">
          This player is independent from the game controls. Closing the Music panel in GC Hangout does not close or pause this player.
        </p>
      </section>
    </main>
  );
}
