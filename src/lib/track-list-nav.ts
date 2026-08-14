// Pure helpers for the Win98 listview behaviour in library-browser.tsx.

export function formatDuration(ms: number): string {
  const total = Math.round(ms / 1000);
  const pad = (n: number) => String(n).padStart(2, "0");
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return hours
    ? `${hours}:${pad(minutes)}:${pad(seconds)}`
    : `${minutes}:${pad(seconds)}`;
}

// Search starts at `from` and wraps; -1 when nothing matches.
export function typeAheadIndex(
  names: string[],
  buffer: string,
  from: number
): number {
  const needle = buffer.toLowerCase();
  for (let step = 0; step < names.length; step++) {
    const i = (((from + step) % names.length) + names.length) % names.length;
    if (names[i].toLowerCase().startsWith(needle)) return i;
  }
  return -1;
}

// ponytail: /me/player/play accepts at most 100 uris, so a Liked Songs play
// starts the window at the clicked track and stops 100 tracks later. Upgrade
// path: none via the Web API — liked songs have no context uri to play instead.
export const PLAY_URI_LIMIT = 100;

export function playWindow(
  uris: string[],
  index: number,
  limit = PLAY_URI_LIMIT
): string[] {
  return uris.slice(Math.max(0, index), Math.max(0, index) + limit);
}

// Case-insensitive substring match over any of the given fields.
export function matchesFilter(query: string, ...fields: string[]): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  return fields.some((f) => f.toLowerCase().includes(needle));
}

export function itemsLabel(loaded: number, total: number): string {
  return loaded < total ? `${loaded} of ${total} items` : `${loaded} items`;
}

// ponytail: TrackResult.artists is already the joined display string, so the
// first comma-separated name is the best available guess at the lead artist —
// "Tyler, The Creator" splits wrong. Upgrade path: keep artists[] on
// TrackResult instead of joining at the mapping layer.
export function firstArtist(artists: string): string {
  return artists.split(",")[0].trim();
}

// A "This list" filter reorders what you see, but a context-uri play offset
// counts rows in the source's own order — so map the row back by uri.
export function sourcePosition(
  source: { uri: string }[],
  uri: string,
  fallback: number
): number {
  const i = source.findIndex((t) => t.uri === uri);
  return i >= 0 ? i : Math.max(0, fallback);
}

// Where playback sits inside the queue we started. Matched by uri so transport
// skips stay in sync; falls back to where we started when nothing matches.
export function queuePosition(
  tracks: { uri: string }[],
  nowPlayingUri: string | undefined,
  startIndex: number
): number {
  if (tracks.length === 0) return -1;
  const i = tracks.findIndex((t) => t.uri === nowPlayingUri);
  return i >= 0 ? i : Math.max(0, Math.min(startIndex, tracks.length - 1));
}

export function moveSelection(
  key: string,
  current: number,
  length: number,
  pageSize: number
): number {
  if (length === 0) return current;
  const target = {
    ArrowUp: current - 1,
    ArrowDown: current + 1,
    Home: 0,
    End: length - 1,
    PageUp: current - pageSize,
    PageDown: current + pageSize,
  }[key];
  if (target === undefined) return current;
  return Math.max(0, Math.min(length - 1, target));
}
