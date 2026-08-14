"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  addToPlaylist,
  getAlbumTracks,
  getLikedTracks,
  getMyPlaylists,
  getPlaylistTracks,
  getSavedAlbums,
  getToken,
  isTrackLiked,
  search,
  setTrackLiked,
  type ApiError,
  type Page,
  type PlaylistResult,
  type SearchType,
  type TrackResult,
} from "@/lib/spotify-client";
import {
  parseSource,
  readStored,
  SOURCE_KEY,
  writeStored,
} from "@/lib/persist";
import {
  firstArtist,
  formatDuration,
  itemsLabel,
  matchesFilter,
  moveSelection,
  playWindow,
  queuePosition,
  sourcePosition,
  typeAheadIndex,
} from "@/lib/track-list-nav";
import type { PlayArg } from "@/lib/use-spotify-player";

const LIKED_URI = "liked"; // pseudo-source: liked songs have no context uri
const SEARCH_URI = "search";
const QUEUE_URI = "queue";
// static labels: sorting was cut — the Web API has no sort parameter, so an
// honest sort would mean force-loading every page of the source first
// One column order for every flavour of row, Explorer-style: the Type column is
// what tells a song from an album when a search returns both, and the last
// column is a duration only when there are songs in the list (see `sizeHeader`).
const HEADERS = ["#", "Type", "Name", "Artist", "Album", "Time"];
const COLS =
  "grid-cols-[2.5rem_3.5rem_minmax(0,1fr)_minmax(0,8rem)_minmax(0,8rem)_3.5rem]";
const PAGE_ROWS = 18; // list is 380px tall at 20px per row
const TYPE_AHEAD_RESET_MS = 800;
const SCROLL_SLACK = 60; // px from the bottom that pulls the next page

type Scope = "spotify" | "list" | "library";
type LibraryRow = PlaylistResult & { kind: "Playlist" | "Album" };
type Source = { uri: string; name: string };
// one popup, two flavours — the same close-on-outside-click state serves both
type Menu = { x: number; y: number } & (
  | { track: TrackResult; source?: never }
  | { source: Source; track?: never }
);

const isAlbumUri = (uri: string) => uri.startsWith("spotify:album:");

const EMPTY_PAGE: Page<TrackResult> = { items: [], total: 0 };
const EMPTY_RESULTS = {
  tracks: EMPTY_PAGE,
  albums: { items: [], total: 0 } as Page<PlaylistResult>,
};

// module-level so their identity is stable across renders
const fetchPlaylists = (offset: number, token: string) =>
  getMyPlaylists(token, offset);
const fetchAlbums = (offset: number, token: string) =>
  getSavedAlbums(token, offset);

/**
 * Offset paging for one Spotify list endpoint. Resets and refetches whenever
 * `key` changes; `loadMore` appends the next page and is a no-op once
 * `items.length === total`.
 */
export function usePagedList<T>(
  key: string,
  fetchPage: (offset: number, token: string) => Promise<Page<T>>
) {
  // the loaded key lives in the state, so switching sources needs no reset —
  // a stale key simply reads as "empty and still loading"
  const [page, setPage] = useState<{
    key: string;
    items: T[];
    total: number;
    error?: ApiError;
  }>({ key: "", items: [], total: 0 });
  // paging is driven by scroll handlers, which fire from whatever render is
  // committed — possibly one that predates the page already loaded. So the
  // next offset comes from here, never from the rendered items, and
  // `requested` is written before the fetch: a second scroll asking for the
  // same offset finds it taken instead of appending the page twice.
  const cursor = useRef({ key: "", loaded: 0, total: 0, requested: -1 });
  const seq = useRef(0);

  const load = useCallback(
    async (forKey: string, offset: number) => {
      cursor.current =
        offset === 0
          ? { key: forKey, loaded: 0, total: 0, requested: 0 }
          : { ...cursor.current, requested: offset };
      const mine = ++seq.current;
      let next: Page<T>;
      try {
        next = await fetchPage(offset, await getToken());
      } catch {
        // a rejected fetch (offline, or /api/auth/session returning non-JSON)
        // must release the offset: `requested === loaded` is what marks a page
        // as in flight, so leaving it set wedges loadMore forever. -1 is the
        // same "nothing requested" sentinel the cursor starts at.
        if (seq.current === mine)
          cursor.current = { ...cursor.current, requested: -1 };
        return;
      }
      if (seq.current !== mine) return; // a newer request owns the state now
      // a failed page reports total 0, which would make a half-loaded list
      // look complete — keep what the successful pages already told us
      const total = next.error && offset > 0 ? cursor.current.total : next.total;
      cursor.current = {
        ...cursor.current,
        loaded: cursor.current.loaded + next.items.length,
        total,
      };
      setPage((cur) => ({
        key: forKey,
        items: offset === 0 ? next.items : [...cur.items, ...next.items],
        total,
        error: next.error,
      }));
    },
    [fetchPage]
  );

  useEffect(() => {
    load(key, 0);
  }, [key, load]);

  const fresh = page.key === key;
  const items = fresh ? page.items : [];
  const total = fresh ? page.total : 0;

  return {
    items,
    total,
    error: fresh ? page.error : undefined,
    loading: !fresh,
    reload: () => load(key, 0),
    loadMore: () => {
      const c = cursor.current;
      if (
        c.key === key &&
        c.loaded > 0 &&
        c.loaded < c.total &&
        c.requested !== c.loaded // that page is already on its way
      )
        load(key, c.loaded);
    },
  };
}

interface Props {
  onPlay: (arg: PlayArg, offsetPosition?: number) => void;
  nowPlayingUri?: string;
}

export default function LibraryBrowser({ onPlay, nowPlayingUri }: Props) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<Scope>("spotify");
  const [searchType, setSearchType] = useState<SearchType>("all");
  const [results, setResults] = useState(EMPTY_RESULTS);
  const [searched, setSearched] = useState(false);
  // the last source picked, restored from localStorage; a uri that no longer
  // exists just fails to load like any other dead playlist would
  const [source, setSource] = useState(
    () => parseSource(readStored(SOURCE_KEY)) ?? { uri: LIKED_URI, name: "Liked Songs" }
  );
  const [selected, setSelected] = useState(-1);
  // uri of the source row a dragged track is currently hovering over
  const [dragOver, setDragOver] = useState<string | null>(null);
  // ponytail: the queue is whatever *we* started — a play from the Spotify
  // mobile app leaves this stale, we don't own that state. Upgrade path:
  // poll me/player/queue, which only returns ~20 items, so it isn't one.
  const [queue, setQueue] = useState<{
    tracks: TrackResult[];
    startIndex: number;
    name: string;
  } | null>(null);
  const [menu, setMenu] = useState<Menu | null>(null);
  const [menuLiked, setMenuLiked] = useState<boolean | null>(null);
  const [submenu, setSubmenu] = useState(false);
  const [notice, setNotice] = useState("");
  // uri of the source whose cover failed to load
  const [coverBrokenFor, setCoverBrokenFor] = useState<string | null>(null);

  const listRef = useRef<HTMLDivElement>(null);
  const typeAhead = useRef({ buffer: "", at: 0 });

  const playlists = usePagedList("playlists", fetchPlaylists);
  const albums = usePagedList("albums", fetchAlbums);

  const searching = source.uri === SEARCH_URI;
  const isQueue = source.uri === QUEUE_URI;
  const fetchTracks = useCallback(
    (offset: number, token: string) => {
      if (source.uri === SEARCH_URI || source.uri === QUEUE_URI)
        return Promise.resolve(EMPTY_PAGE);
      if (source.uri === LIKED_URI) return getLikedTracks(token, offset);
      if (isAlbumUri(source.uri))
        return getAlbumTracks(source.uri, token, offset, source.name);
      return getPlaylistTracks(source.uri, token, offset);
    },
    [source.uri, source.name]
  );
  const trackList = usePagedList(source.uri, fetchTracks);

  const filter = query.trim();
  const libraryMode = scope === "library" && filter !== "";
  const listFiltered = scope === "list" && filter !== "";

  const sourceTracks = searching
    ? results.tracks.items
    : isQueue
      ? (queue?.tracks ?? [])
      : trackList.items;
  const trackRows = libraryMode
    ? []
    : listFiltered
      ? sourceTracks.filter((t) => matchesFilter(filter, t.name, t.artists))
      : sourceTracks;
  // playlist/album rows sit above the track rows in one selection index space:
  // My Library shows only these, a Spotify search shows its album hits here and
  // its track hits below, every other source shows none.
  const browseRows: LibraryRow[] = libraryMode
    ? [
        ...playlists.items.map((p) => ({ ...p, kind: "Playlist" as const })),
        ...albums.items.map((a) => ({ ...a, kind: "Album" as const })),
      ].filter((r) => matchesFilter(filter, r.name))
    : searching
      ? results.albums.items.map((a) => ({ ...a, kind: "Album" as const }))
      : [];
  const rowNames = [
    ...browseRows.map((r) => r.name),
    ...trackRows.map((t) => t.name),
  ];
  // the last column is a song duration, so it only says "Time" when the list
  // holds songs; a list of albums alone counts tracks there instead, and an
  // album sitting among songs leaves it blank (Explorer does this for folders)
  const sizeHeader = trackRows.length > 0 ? "Time" : "Tracks";
  const loading = !libraryMode && !searching && !isQueue && trackList.loading;
  const queueIndex = queue
    ? queuePosition(queue.tracks, nowPlayingUri, queue.startIndex)
    : -1;

  useEffect(() => {
    if (scope !== "spotify") return;
    const q = query.trim();
    let cancelled = false;
    const id = setTimeout(async () => {
      const r = q ? await search(q, await getToken(), searchType) : EMPTY_RESULTS;
      if (cancelled) return;
      setResults(r);
      if (q) {
        setSearched(true);
        selectSource(SEARCH_URI, "Search Results");
      }
    }, 300);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [query, scope, searchType]);

  useEffect(() => {
    listRef.current
      ?.querySelector(`[data-row="${selected}"]`)
      ?.scrollIntoView({ block: "nearest" });
  }, [selected]);

  useEffect(() => {
    if (!menu) return;
    const close = () => setMenu(null);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
    };
  }, [menu]);

  function selectSource(uri: string, name: string) {
    setSource({ uri, name });
    setSelected(-1);
    setNotice("");
    // search results and the queue are gone after a reload, so restoring them
    // would land on an empty pane — only real sources are worth remembering
    if (uri !== SEARCH_URI && uri !== QUEUE_URI)
      writeStored(SOURCE_KEY, JSON.stringify({ uri, name }));
  }

  function play(index: number) {
    const row = trackRows[index];
    if (!row) return;
    // only playlists and albums are real Spotify contexts; Liked Songs, search
    // results and the queue itself play as a list of uris
    if (!source.uri.startsWith("spotify:")) {
      const uris = playWindow(trackRows.map((t) => t.uri), index);
      setQueue({
        tracks: trackRows.slice(index, index + uris.length),
        startIndex: 0,
        name: source.name,
      });
      onPlay(uris, 0);
      return;
    }
    // playlists and albums play by context uri, so the offset has to be the
    // row's position in the whole list, not in the filtered view
    const position = listFiltered
      ? sourcePosition(sourceTracks, row.uri, index)
      : index;
    // ponytail: Spotify plays the context in its own order from here, so the
    // queue mirrors the loaded pages of the source, not the filtered view.
    setQueue({ tracks: sourceTracks, startIndex: position, name: source.name });
    onPlay(source.uri, position);
  }

  // `index` counts rows as rendered: the browse rows first, tracks after
  function activate(index: number) {
    const row = browseRows[index];
    if (row) {
      selectSource(row.uri, row.name);
      return;
    }
    play(index - browseRows.length);
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === "Enter") {
      activate(selected);
      return;
    }
    // space belongs to the play/pause shortcut, not to type-ahead
    if (e.key.length === 1 && e.key !== " " && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const now = Date.now();
      const state = typeAhead.current;
      state.buffer =
        now - state.at > TYPE_AHEAD_RESET_MS ? e.key : state.buffer + e.key;
      state.at = now;
      // a fresh single letter steps to the *next* match, like Explorer does
      const from = state.buffer.length === 1 ? selected + 1 : Math.max(selected, 0);
      const hit = typeAheadIndex(rowNames, state.buffer, from);
      if (hit >= 0) setSelected(hit);
      return;
    }
    const next = moveSelection(e.key, selected, rowNames.length, PAGE_ROWS);
    if (next !== selected) {
      e.preventDefault();
      setSelected(next);
    }
  }

  function nearBottom(el: HTMLElement) {
    return el.scrollHeight - el.scrollTop - el.clientHeight < SCROLL_SLACK;
  }

  function onSourceScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!nearBottom(e.currentTarget)) return;
    // ponytail: one scrollbar over both lists, so both get pulled; whichever
    // is already complete no-ops.
    playlists.loadMore();
    albums.loadMore();
  }

  function onListScroll(e: React.UIEvent<HTMLDivElement>) {
    if (!nearBottom(e.currentTarget)) return;
    if (libraryMode) {
      playlists.loadMore();
      albums.loadMore();
    } else if (!searching) {
      trackList.loadMore();
    }
  }

  function openMenu(e: React.MouseEvent, index: number) {
    e.preventDefault();
    setSelected(browseRows.length + index);
    setSubmenu(false);
    setMenuLiked(null);
    const track = trackRows[index];
    setMenu({ x: e.clientX, y: e.clientY, track });
    getToken().then(async (t) => setMenuLiked(await isTrackLiked(track.uri, t)));
  }

  async function toggleMenuLike(track: TrackResult) {
    setMenu(null);
    const next = !menuLiked;
    const ok = await setTrackLiked(track.uri, next, await getToken());
    setNotice(
      ok
        ? next
          ? "Added to Liked Songs."
          : "Removed from Liked Songs."
        : "Could not update Liked Songs."
    );
  }

  async function addTo(playlistUri: string, track: TrackResult) {
    setMenu(null);
    const ok = await addToPlaylist(playlistUri, track.uri, await getToken());
    setNotice(ok ? `Added "${track.name}".` : "Could not add.");
  }

  function goToAlbum(track: TrackResult) {
    setMenu(null);
    if (!track.albumUri) return;
    selectSource(track.albumUri, track.album || "Album");
  }

  function searchArtist(track: TrackResult) {
    const q = firstArtist(track.artists);
    setMenu(null);
    setScope("spotify");
    setSelected(-1);
    // the debounced search effect picks the query up and selects Search
    // Results — unless nothing changed, in which case it never re-runs
    if (q && q === query && scope === "spotify")
      selectSource(SEARCH_URI, "Search Results");
    setQuery(q);
  }

  function playSource(target: Source) {
    setMenu(null);
    selectSource(target.uri, target.name);
    // ponytail: the rows aren't loaded yet at this point, so there is nothing
    // to hand the ▶ Now Playing view — it stays empty until you play from a
    // row. Upgrade path: none that avoids blocking on the first page.
    setQueue(null);
    onPlay(target.uri, 0);
  }

  function refreshSource(target: Source) {
    setMenu(null);
    // selecting a different source refetches it from scratch anyway
    if (source.uri === target.uri) trackList.reload();
    else selectSource(target.uri, target.name);
  }

  async function dropTrack(target: Source, trackUri: string) {
    if (!trackUri) return;
    const name = trackRows.find((t) => t.uri === trackUri)?.name ?? "Track";
    const token = await getToken();
    const ok =
      target.uri === LIKED_URI
        ? await setTrackLiked(trackUri, true, token)
        : await addToPlaylist(target.uri, trackUri, token);
    setNotice(ok ? `Added "${name}" to ${target.name}.` : "Could not add.");
  }

  // `droppable` marks the playlist rows and Liked Songs; saved albums and the
  // pinned queue/search sources can't take a track
  const sourceRow = (
    uri: string,
    name: string,
    label: string,
    count?: number,
    droppable = false
  ) => {
    // Liked Songs takes drops but has no context uri to play or refresh
    const isPlaylist = droppable && uri !== LIKED_URI;
    return (
      <button
        key={uri}
        onClick={() => selectSource(uri, name)}
        onContextMenu={(e) => {
          if (!isPlaylist) return;
          e.preventDefault();
          setMenu({ x: e.clientX, y: e.clientY, source: { uri, name } });
        }}
        onDragOver={(e) => {
          if (!droppable) return;
          e.preventDefault(); // without this the drop never fires
          setDragOver(uri);
        }}
        onDragLeave={() => setDragOver(null)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(null);
          dropTrack({ uri, name }, e.dataTransfer.getData("text/plain"));
        }}
        className={`win-listrow w-full text-left px-2 py-0.5 truncate ${
          source.uri === uri || dragOver === uri ? "win-selected" : ""
        }`}
      >
        {label}
        {count !== undefined && <span className="text-gray-500"> ({count})</span>}
      </button>
    );
  };

  const totalMs = trackRows.reduce((sum, t) => sum + t.durationMs, 0);
  // search album hits are in the pool too, so an album opened from a search
  // still shows its cover
  const sourceImage = [
    ...playlists.items,
    ...albums.items,
    ...results.albums.items,
  ].find((p) => p.uri === source.uri)?.image;
  const headerName = libraryMode ? "My Library" : source.name;
  // any list failing is the same story for the status bar: what you're looking
  // at is empty because Spotify refused, not because there's nothing there
  const failure =
    trackList.error ?? playlists.error ?? albums.error ?? results.tracks.error;
  const failureText =
    failure === "auth"
      ? "Session expired — sign in again to load your library."
      : failure
        ? "Could not load from Spotify — try again."
        : "";
  const countField = isQueue
    ? queue
      ? `Track ${queueIndex + 1} of ${queue.tracks.length} — ${queue.name}`
      : "Nothing playing"
    : libraryMode || listFiltered || searching
      ? `${rowNames.length} items`
      : itemsLabel(sourceTracks.length, trackList.total);

  return (
    <div className="win-window w-[825px] max-w-full">
      <div className="win-titlebar">My Music</div>

      <div className="p-2 flex items-center gap-2">
        <label htmlFor="library-search">Search:</label>
        <input
          id="library-search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setSelected(-1);
          }}
          className="w-64 px-2 py-0.5"
        />
        <label htmlFor="library-scope">in</label>
        <select
          id="library-scope"
          value={scope}
          onChange={(e) => {
            setScope(e.target.value as Scope);
            setSelected(-1);
          }}
          className="px-1 py-0.5"
        >
          <option value="spotify">Spotify</option>
          <option value="list">This list</option>
          <option value="library">My Library</option>
        </select>
        {scope === "spotify" && (
          <>
            <label htmlFor="library-search-type">for</label>
            <select
              id="library-search-type"
              value={searchType}
              onChange={(e) => {
                setSearchType(e.target.value as SearchType);
                setSelected(-1);
              }}
              className="px-1 py-0.5"
            >
              <option value="all">Songs &amp; Albums</option>
              <option value="track">Songs</option>
              <option value="album">Albums</option>
            </select>
          </>
        )}
        <button onClick={() => play(0)} className="ml-auto px-3 py-1">
          ▶ Play all
        </button>
      </div>

      <div className="px-2 flex gap-1">
        {/* the pane fills whatever height the track side ends up with (the list
            is resizable) — absolute so its own content can't set that height */}
        <div className="relative w-[190px] shrink-0">
          <div
            onScroll={onSourceScroll}
            className="win-inset absolute inset-0 overflow-y-auto py-0.5"
          >
          {sourceRow(QUEUE_URI, "Now Playing", "▶ Now Playing")}
          {sourceRow(LIKED_URI, "Liked Songs", "♥ Liked Songs", undefined, true)}
          {searched && sourceRow(SEARCH_URI, "Search Results", "🔍 Search Results")}
          <hr className="my-1 border-gray-600" />
          {playlists.items.map((p) =>
            sourceRow(p.uri, p.name, `♪ ${p.name}`, p.trackCount, true)
          )}
          <hr className="my-1 border-gray-600" />
          <div className="px-2 py-0.5 font-bold text-gray-500">Saved Albums</div>
          {albums.items.map((a) =>
            sourceRow(a.uri, a.name, `💿 ${a.name}`, a.trackCount)
          )}
          </div>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="win-inset w-12 h-12 shrink-0">
              {!libraryMode && sourceImage && coverBrokenFor !== source.uri ? (
                // ponytail: plain <img>, not next/image — avoids a
                // remotePatterns entry for i.scdn.co in next.config.ts
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={sourceImage}
                  alt=""
                  className="w-full h-full object-cover"
                  onError={() => setCoverBrokenFor(source.uri)}
                />
              ) : (
                <div className="w-full h-full bg-gray-600" />
              )}
            </div>
            <div className="min-w-0">
              <div className="truncate font-bold">{headerName}</div>
              <div className="text-gray-500">
                {rowNames.length} {browseRows.length ? "items" : "tracks"}
              </div>
            </div>
          </div>
          <div className={`grid ${COLS}`}>
            {[...HEADERS.slice(0, -1), sizeHeader].map((h) => (
              <button key={h} tabIndex={-1} className="px-2 py-0.5 text-left truncate">
                {h}
              </button>
            ))}
          </div>
          <div
            ref={listRef}
            tabIndex={0}
            // marks the region whose type-ahead outranks the transport keys
            data-typeahead
            onKeyDown={handleKey}
            onScroll={onListScroll}
            className="win-inset h-[380px] min-h-[100px] resize-y overflow-auto outline-none"
          >
            {loading ? (
              <div className="px-2 py-0.5">Loading…</div>
            ) : rowNames.length === 0 ? (
              <div className="px-2 py-0.5">
                {searching || filter ? "(no results)" : "(empty)"}
              </div>
            ) : (
              <>
                {browseRows.map((r, i) => (
                  <div
                    key={r.uri}
                    data-row={i}
                    onClick={() => setSelected(i)}
                    onDoubleClick={() => activate(i)}
                    className={`grid ${COLS} h-5 leading-5 ${
                      i === selected ? "win-selected" : ""
                    }`}
                  >
                    <span className="px-2">{r.kind === "Album" ? "💿" : "♪"}</span>
                    <span className="px-2 truncate">{r.kind}</span>
                    <span className="px-2 truncate">{r.name}</span>
                    <span className="px-2 truncate">{r.artists ?? ""}</span>
                    <span className="px-2 truncate" />
                    {/* a count here would sit under "Time" once songs share the
                        list, so it only shows when the list is albums alone */}
                    <span className="px-2 text-right">
                      {trackRows.length > 0 ? "" : r.trackCount}
                    </span>
                  </div>
                ))}
                {trackRows.map((t, i) => {
                  const isNowPlaying = t.uri === nowPlayingUri;
                  const row = browseRows.length + i;
                  return (
                    <div
                      key={`${t.uri}-${i}`}
                      data-row={row}
                      draggable
                      onDragStart={(e) => e.dataTransfer.setData("text/plain", t.uri)}
                      onDragEnd={() => setDragOver(null)}
                      onClick={() => setSelected(row)}
                      onDoubleClick={() => play(i)}
                      onContextMenu={(e) => openMenu(e, i)}
                      className={`grid ${COLS} h-5 leading-5 ${
                        row === selected ? "win-selected" : ""
                      } ${isNowPlaying ? "font-bold" : ""}`}
                    >
                      <span className="px-2">{isNowPlaying ? "▶" : i + 1}</span>
                      <span className="px-2 truncate">Song</span>
                      <span className="px-2 truncate">{t.name}</span>
                      <span className="px-2 truncate">{t.artists}</span>
                      <span className="px-2 truncate">{t.album}</span>
                      <span className="px-2 text-right">{formatDuration(t.durationMs)}</span>
                    </div>
                  );
                })}
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-2 flex gap-1">
        <div className="win-statusbar flex-1 px-2 py-0.5 truncate">
          {notice || failureText || countField}
        </div>
        <div className="win-statusbar w-48 px-2 py-0.5">
          Total time {formatDuration(totalMs)}
        </div>
      </div>

      {menu && (
        <div
          className="win-menu fixed z-50 py-0.5 w-52"
          style={{ left: menu.x, top: menu.y }}
          onMouseDown={(e) => e.stopPropagation()}
        >
          {menu.source ? (
            <>
              <button
                onClick={() => playSource(menu.source)}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                Play
              </button>
              <button
                onClick={() => refreshSource(menu.source)}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                Refresh
              </button>
            </>
          ) : (
            <>
              <button
                onClick={() => activate(selected)}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                Play
              </button>
              {/* ponytail: no "Add to Queue" — POST me/player/queue needs the
                  device_id, which only use-spotify-player holds. Add it by
                  surfacing deviceId here if anyone asks. */}
              <button
                onClick={() => goToAlbum(menu.track)}
                disabled={!menu.track.albumUri}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                💿 Go to Album
              </button>
              <button
                onClick={() => searchArtist(menu.track)}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                Search for this artist
              </button>
              <hr className="my-0.5 border-gray-600" />
              <button
                onClick={() => toggleMenuLike(menu.track)}
                disabled={menuLiked === null}
                className="win-listrow w-full text-left px-4 py-0.5"
              >
                {menuLiked ? "Remove from Liked Songs" : "♥ Add to Liked Songs"}
              </button>
              <div
                className="relative"
                onMouseEnter={() => setSubmenu(true)}
                onMouseLeave={() => setSubmenu(false)}
              >
                <button className="win-listrow w-full text-left px-4 py-0.5 flex">
                  Add to Playlist
                  <span className="ml-auto">▸</span>
                </button>
                {submenu && (
                  <div className="win-menu absolute left-full top-0 py-0.5 w-52 max-h-64 overflow-y-auto">
                    {playlists.items.map((p) => (
                      <button
                        key={p.uri}
                        onClick={() => addTo(p.uri, menu.track)}
                        className="win-listrow w-full text-left px-4 py-0.5 truncate"
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
