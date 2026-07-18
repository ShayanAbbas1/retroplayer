"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSpotifyPlayer } from "@/lib/use-spotify-player";
import {
  searchTracks,
  getMyPlaylists,
  getLikedTracks,
  getPlaylistTracks,
  isTrackLiked,
  setTrackLiked,
  addToPlaylist,
  type TrackResult,
  type PlaylistResult,
} from "@/lib/spotify-client";
import WinampSkin from "@/components/skins/winamp";

async function getToken(): Promise<string> {
  const res = await fetch("/api/auth/session");
  return (await res.json())?.accessToken ?? "";
}

const LIKED_URI = "liked"; // pseudo-playlist: liked songs have no context uri

interface OpenList {
  uri: string;
  name: string;
  tracks: TrackResult[];
}

export default function RetroPlayer() {
  const { data: session } = useSession();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<TrackResult[]>([]);
  const [playlists, setPlaylists] = useState<PlaylistResult[]>([]);
  const [open, setOpen] = useState<OpenList | null>(null);
  // keyed by track uri so switching tracks resets them without an effect
  const [likedFor, setLikedFor] = useState<{ uri: string; liked: boolean } | null>(null);
  const [noticeFor, setNoticeFor] = useState<{ uri: string; msg: string } | null>(null);
  const [addTarget, setAddTarget] = useState("");

  const { status, track, paused, positionMs, durationMs, volume, controls } =
    useSpotifyPlayer();

  useEffect(() => {
    if (session?.error === "RefreshTokenError") signIn("spotify");
  }, [session?.error]);

  useEffect(() => {
    getToken().then((t) => {
      if (t) getMyPlaylists(t).then(setPlaylists);
    });
  }, []);

  useEffect(() => {
    if (!track?.uri) return;
    const uri = track.uri;
    let stale = false;
    getToken().then(async (t) => {
      const isLiked = await isTrackLiked(uri, t);
      if (!stale) setLikedFor({ uri, liked: isLiked });
    });
    return () => {
      stale = true;
    };
  }, [track?.uri]);

  const liked = !!track && likedFor?.uri === track.uri && likedFor.liked;
  const notice = track && noticeFor?.uri === track.uri ? noticeFor.msg : "";

  // live search, debounced
  useEffect(() => {
    const q = query.trim();
    let cancelled = false;
    const id = setTimeout(async () => {
      const r = q ? await searchTracks(q, await getToken()) : [];
      if (!cancelled) setResults(r);
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query]);

  async function openList(uri: string, name: string) {
    const token = await getToken();
    const tracks =
      uri === LIKED_URI
        ? await getLikedTracks(token)
        : await getPlaylistTracks(uri, token);
    setOpen({ uri, name, tracks });
  }

  function playFromOpen(list: OpenList, index: number) {
    if (list.uri === LIKED_URI) {
      controls.play(
        list.tracks.map((t) => t.uri),
        index
      );
    } else {
      controls.play(list.uri, index);
    }
  }

  async function toggleLike() {
    if (!track?.uri) return;
    const uri = track.uri;
    const next = !liked;
    setLikedFor({ uri, liked: next });
    if (!(await setTrackLiked(uri, next, await getToken()))) {
      setLikedFor({ uri, liked: !next });
    }
  }

  async function addCurrentTo() {
    if (!track?.uri || !addTarget) return;
    const uri = track.uri;
    const ok = await addToPlaylist(addTarget, uri, await getToken());
    setNoticeFor({ uri, msg: ok ? "Added." : "Could not add." });
  }

  if (status === "premium_required") {
    return (
      <p className="text-yellow-400 font-bold">
        Spotify Premium is required for in-browser playback.
      </p>
    );
  }

  if (status === "auth_error") {
    return (
      <button onClick={() => signIn("spotify")} className="px-5 py-2">
        Session expired — log in again
      </button>
    );
  }

  const trackRow = (
    list: TrackResult[],
    onPick: (index: number) => void
  ) => (
    <ul className="win-inset max-h-64 overflow-y-auto">
      {list.map((t, i) => (
        <li key={`${t.uri}-${i}`}>
          <button
            onClick={() => onPick(i)}
            className="win-listrow w-full text-left px-2 py-1"
          >
            {t.name}
            <span className="text-gray-500"> — {t.artists}</span>
          </button>
        </li>
      ))}
    </ul>
  );

  return (
    <div className="flex flex-col items-center gap-6">
      <WinampSkin
        track={track}
        paused={paused}
        positionMs={positionMs}
        durationMs={durationMs}
        volume={volume}
        controls={controls}
      />

      {track && (
        <div className="win-window w-full max-w-3xl">
          <div className="win-titlebar">Now Playing</div>
          <div className="p-2 flex flex-wrap items-center gap-2">
            <span className="flex-1 min-w-40 truncate">
              {track.name} — {track.artists}
            </span>
            <button onClick={toggleLike} className="px-3 py-1">
              {liked ? "♥ Liked" : "♡ Like"}
            </button>
            <select
              value={addTarget}
              onChange={(e) => setAddTarget(e.target.value)}
              className="px-1 py-1 max-w-48"
            >
              <option value="">Add to playlist…</option>
              {playlists.map((p) => (
                <option key={p.uri} value={p.uri}>
                  {p.name}
                </option>
              ))}
            </select>
            <button onClick={addCurrentTo} className="px-3 py-1" disabled={!addTarget}>
              Add
            </button>
            {notice && <span className="text-gray-500">{notice}</span>}
          </div>
        </div>
      )}

      <div className="flex flex-col md:flex-row gap-4 w-full max-w-3xl items-start">
        {/* Library */}
        <div className="win-window flex-1 w-full">
          <div className="win-titlebar">My Music</div>
          <div className="p-2 space-y-2">
            {open ? (
              <>
                <div className="flex items-center gap-2">
                  <button onClick={() => setOpen(null)} className="px-3 py-1">
                    ◀ Back
                  </button>
                  <span className="font-bold truncate">{open.name}</span>
                  <button
                    onClick={() => playFromOpen(open, 0)}
                    className="px-3 py-1 ml-auto"
                  >
                    ▶ Play all
                  </button>
                </div>
                {trackRow(open.tracks, (i) => playFromOpen(open, i))}
              </>
            ) : (
              <ul className="win-inset max-h-64 overflow-y-auto">
                <li>
                  <button
                    onClick={() => openList(LIKED_URI, "Liked Songs")}
                    className="win-listrow w-full text-left px-2 py-1"
                  >
                    ♥ Liked Songs
                  </button>
                </li>
                {playlists.map((p) => (
                  <li key={p.uri}>
                    <button
                      onClick={() => openList(p.uri, p.name)}
                      className="win-listrow w-full text-left px-2 py-1"
                    >
                      {p.name}
                      <span className="text-gray-500"> ({p.trackCount})</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {/* Search */}
        <div className="win-window flex-1 w-full">
          <div className="win-titlebar">Search</div>
          <div className="p-2 space-y-2">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a song…"
              className="w-full px-2 py-1"
            />
            {results.length > 0 &&
              trackRow(results, (i) =>
                controls.play(
                  results.map((r) => r.uri),
                  i
                )
              )}
          </div>
        </div>
      </div>
    </div>
  );
}
