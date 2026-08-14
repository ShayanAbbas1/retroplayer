"use client";

import { signIn, useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useSpotifyPlayer } from "@/lib/use-spotify-player";
import { getToken, isTrackLiked, setTrackLiked } from "@/lib/spotify-client";
import { isTypingTarget, shortcutFor } from "@/lib/shortcuts";
import LibraryBrowser from "@/components/library-browser";
import WinampSkin from "@/components/skins/winamp";

export default function RetroPlayer() {
  const { data: session } = useSession();
  // keyed by track uri so switching tracks resets it without an effect
  const [likedFor, setLikedFor] = useState<{ uri: string; liked: boolean } | null>(null);
  // uri of the track whose album art failed to load, so a broken image
  // shows the flat placeholder instead of a broken-image icon
  const [artBrokenFor, setArtBrokenFor] = useState<string | null>(null);
  // the album the library browser has been asked to open; a new object each
  // click, which is what makes a repeat request land
  const [openAlbum, setOpenAlbum] = useState<{
    uri: string;
    name: string;
  } | null>(null);

  const { status, track, paused, positionMs, durationMs, volume, controls } =
    useSpotifyPlayer();

  useEffect(() => {
    if (session?.error === "RefreshTokenError") signIn("spotify");
  }, [session?.error]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const focused = document.activeElement;
      const action = shortcutFor(e, {
        typing: isTypingTarget(focused),
        inList: !!focused?.closest("[data-typeahead]"),
      });
      if (!action) return;
      // also stops the browser's own Ctrl+F, the page scrolling on space, and a
      // focused button re-firing on space
      e.preventDefault();
      switch (action) {
        case "focusSearch":
          // ponytail: found by id rather than threading a ref out of
          // LibraryBrowser — one search box, one id, no plumbing.
          document.querySelector<HTMLInputElement>("#library-search")?.select();
          break;
        case "previous":
          controls.previous();
          break;
        case "next":
          controls.next();
          break;
        case "play":
          controls.resume();
          break;
        case "stop":
          controls.pause();
          controls.seek(0);
          break;
        default: // C and Space both toggle, as Winamp's pause button does
          if (paused) controls.resume();
          else controls.pause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [controls, paused]);

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

  async function toggleLike() {
    if (!track?.uri) return;
    const uri = track.uri;
    const next = !liked;
    setLikedFor({ uri, liked: next });
    if (!(await setTrackLiked(uri, next, await getToken()))) {
      setLikedFor({ uri, liked: !next });
    }
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
        <div className="win-window w-[825px] max-w-full">
          <div className="win-titlebar">Now Playing</div>
          <div className="p-2 flex items-center gap-2">
            <div className="win-inset w-16 h-16 shrink-0">
              {track.albumArtUrl && artBrokenFor !== track.uri ? (
                // ponytail: plain <img>, not next/image — avoids a
                // remotePatterns entry for i.scdn.co in next.config.ts
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={track.albumArtUrl}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setArtBrokenFor(track.uri)}
                />
              ) : (
                <div className="w-full h-full bg-gray-600" />
              )}
            </div>
            <span className="flex-1 min-w-0 truncate">
              {track.name} — {track.artists}
            </span>
            <button
              onClick={() =>
                setOpenAlbum({ uri: track.albumUri, name: track.albumName })
              }
              disabled={!track.albumUri}
              className="px-3 py-1"
            >
              💿 Go to Album
            </button>
            <button onClick={toggleLike} className="px-3 py-1">
              {liked ? "♥ Liked" : "♡ Like"}
            </button>
          </div>
        </div>
      )}

      <LibraryBrowser
        onPlay={controls.play}
        nowPlayingUri={track?.uri}
        openAlbum={openAlbum}
      />
    </div>
  );
}
