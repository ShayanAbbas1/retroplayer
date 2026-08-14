"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { pickImage, type SpotifyImage } from "@/lib/spotify-client";
import { parseVolume, readStored, VOLUME_KEY, writeStored } from "@/lib/persist";

const DEFAULT_VOLUME = 0.5;
const storedVolume = () => parseVolume(readStored(VOLUME_KEY), DEFAULT_VOLUME);

export type PlayerStatus =
  | "loading"
  | "ready"
  | "premium_required"
  | "auth_error";

export interface PlayerTrack {
  name: string;
  artists: string;
  albumName: string;
  albumArtUrl: string;
  uri: string;
}

export interface PositionAnchor {
  positionMs: number;
  durationMs: number;
  paused: boolean;
  updatedAt: number;
}

export type PlayArg = string | string[];

export interface PlayerControls {
  play: (arg: PlayArg, offsetPosition?: number) => Promise<void>;
  pause: () => void;
  resume: () => void;
  next: () => void;
  previous: () => void;
  seek: (ms: number) => void;
  setVolume: (v: number) => void;
}

export interface SpotifyPlayerState {
  status: PlayerStatus;
  deviceId: string | null;
  track: PlayerTrack | null;
  paused: boolean;
  positionMs: number;
  durationMs: number;
  volume: number;
  controls: PlayerControls;
}

export function interpolatePosition(a: PositionAnchor, now: number): number {
  if (a.paused) return a.positionMs;
  return Math.min(a.positionMs + (now - a.updatedAt), a.durationMs);
}

export function buildPlayBody(
  arg: PlayArg,
  offsetPosition?: number
):
  | { context_uri: string; offset?: { position: number } }
  | { uris: string[]; offset?: { position: number } } {
  const base = typeof arg === "string" ? { context_uri: arg } : { uris: arg };
  return offsetPosition != null
    ? { ...base, offset: { position: offsetPosition } }
    : base;
}

async function fetchAccessToken(): Promise<string> {
  try {
    const res = await fetch("/api/auth/session");
    const session = await res.json();
    return session?.accessToken ?? "";
  } catch {
    return "";
  }
}

interface SpotifyPlayer {
  connect(): Promise<boolean>;
  disconnect(): void;
  addListener(event: string, cb: (arg: unknown) => void): boolean;
  pause(): Promise<void>;
  resume(): Promise<void>;
  nextTrack(): Promise<void>;
  previousTrack(): Promise<void>;
  seek(ms: number): Promise<void>;
  setVolume(v: number): Promise<void>;
}

interface SpotifyNamespace {
  Player: new (opts: {
    name: string;
    getOAuthToken: (cb: (token: string) => void) => void;
    volume?: number;
  }) => SpotifyPlayer;
}

interface WebPlaybackState {
  paused: boolean;
  position: number;
  duration: number;
  track_window: {
    current_track: {
      name: string;
      uri: string;
      artists: { name: string }[];
      album: { name: string; images: SpotifyImage[] };
    };
  };
}

declare global {
  interface Window {
    Spotify?: SpotifyNamespace;
    onSpotifyWebPlaybackSDKReady?: () => void;
  }
}

const SDK_SRC = "https://sdk.scdn.co/spotify-player.js";

export function useSpotifyPlayer(): SpotifyPlayerState {
  const [status, setStatus] = useState<PlayerStatus>("loading");
  const [deviceId, setDeviceId] = useState<string | null>(null);
  const [track, setTrack] = useState<PlayerTrack | null>(null);
  const [paused, setPaused] = useState(true);
  const [positionMs, setPositionMs] = useState(0);
  const [durationMs, setDurationMs] = useState(0);
  const [volume, setVolume] = useState(storedVolume);

  const playerRef = useRef<SpotifyPlayer | null>(null);
  const anchorRef = useRef<PositionAnchor | null>(null);

  useEffect(() => {
    const init = () => {
      if (playerRef.current || !window.Spotify) return;

      const player = new window.Spotify.Player({
        name: "Time Machine",
        getOAuthToken: (cb) => {
          fetchAccessToken().then(cb);
        },
        volume: storedVolume(),
      });
      playerRef.current = player;

      player.addListener("ready", (arg) => {
        setDeviceId((arg as { device_id: string }).device_id);
        setStatus("ready");
      });

      player.addListener("player_state_changed", (arg) => {
        const state = arg as WebPlaybackState | null;
        if (!state) return;
        const t = state.track_window.current_track;
        setTrack({
          name: t.name,
          artists: t.artists.map((a) => a.name).join(", "),
          albumName: t.album.name,
          albumArtUrl: pickImage(t.album.images, 64) ?? "",
          uri: t.uri,
        });
        setPaused(state.paused);
        setDurationMs(state.duration);
        setPositionMs(state.position);
        anchorRef.current = {
          positionMs: state.position,
          durationMs: state.duration,
          paused: state.paused,
          updatedAt: Date.now(),
        };
      });

      player.addListener("initialization_error", () => setStatus("auth_error"));
      player.addListener("authentication_error", () => setStatus("auth_error"));
      player.addListener("account_error", () =>
        setStatus("premium_required")
      );

      player.connect();
    };

    if (window.Spotify) {
      init();
    } else {
      window.onSpotifyWebPlaybackSDKReady = init;
      if (!document.querySelector(`script[src="${SDK_SRC}"]`)) {
        const script = document.createElement("script");
        script.src = SDK_SRC;
        document.body.appendChild(script);
      }
    }

    return () => {
      playerRef.current?.disconnect();
      playerRef.current = null;
    };
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      const a = anchorRef.current;
      if (!a || a.paused) return;
      setPositionMs(interpolatePosition(a, Date.now()));
    }, 500);
    return () => clearInterval(id);
  }, []);

  const play = useCallback(
    async (arg: PlayArg, offsetPosition?: number) => {
      if (!deviceId) return;
      const token = await fetchAccessToken();
      await fetch(
        `https://api.spotify.com/v1/me/player/play?device_id=${deviceId}`,
        {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(buildPlayBody(arg, offsetPosition)),
        }
      );
    },
    [deviceId]
  );

  const controls: PlayerControls = {
    play,
    pause: () => playerRef.current?.pause(),
    resume: () => playerRef.current?.resume(),
    next: () => playerRef.current?.nextTrack(),
    previous: () => playerRef.current?.previousTrack(),
    seek: (ms) => playerRef.current?.seek(ms),
    setVolume: (v) => {
      playerRef.current?.setVolume(v);
      setVolume(v);
      writeStored(VOLUME_KEY, String(v));
    },
  };

  return {
    status,
    deviceId,
    track,
    paused,
    positionMs,
    durationMs,
    volume,
    controls,
  };
}
