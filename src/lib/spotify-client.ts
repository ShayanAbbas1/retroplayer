// Browser-side Spotify Web API calls used by the player (raw fetch — the
// node client in spotify.ts isn't meant for the client bundle).

export interface TrackResult {
  uri: string;
  name: string;
  artists: string;
  durationMs: number;
}

// Saved albums have the same shape (uri/name/track count/cover), so they reuse
// this type — the `spotify:album:` uri prefix is the only discriminator needed.
export interface PlaylistResult {
  uri: string;
  name: string;
  trackCount: number;
  image?: string;
}

// "auth" = the token in hand is dead and the refresh behind getToken() could not
// replace it; anything else Spotify refused is "failed". Carried on the result so
// a failure reads as a failure instead of an empty list.
export type ApiError = "auth" | "failed";

export interface Page<T> {
  items: T[];
  total: number;
  error?: ApiError;
}

export interface SpotifyImage {
  url: string;
  width?: number | null;
}

interface SpotifyTrackItem {
  uri: string;
  name: string;
  artists?: { name: string }[];
  duration_ms?: number;
}

interface SpotifyPlaylistItem {
  uri: string;
  name: string;
  tracks?: { total?: number };
  total_tracks?: number; // albums carry the count here instead
  images?: SpotifyImage[];
}

// Spotify returns images[] largest-first; pick the smallest one still >=
// minSize rather than downloading the 640px original for a thumbnail.
export function pickImage(
  images: SpotifyImage[] | undefined,
  minSize: number
): string | undefined {
  if (!images || images.length === 0) return undefined;
  for (let i = images.length - 1; i >= 0; i--) {
    const w = images[i].width;
    if (w == null || w >= minSize) return images[i].url;
  }
  return images[0].url;
}

export function mapTrackItems(items: SpotifyTrackItem[] | undefined): TrackResult[] {
  return (items ?? []).map((t) => ({
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(", "),
    durationMs: t.duration_ms ?? 0,
  }));
}

export function mapPlaylistItems(
  items: (SpotifyPlaylistItem | null)[] | undefined
): PlaylistResult[] {
  return (items ?? [])
    .filter((p): p is SpotifyPlaylistItem => p != null)
    .map((p) => ({
      uri: p.uri,
      name: p.name,
      trackCount: p.tracks?.total ?? p.total_tracks ?? 0,
      image: pickImage(p.images, 48),
    }));
}

export async function getToken(): Promise<string> {
  const res = await fetch("/api/auth/session");
  return (await res.json())?.accessToken ?? "";
}

// "spotify:playlist:xyz" → "xyz"
export function uriId(uri: string): string {
  return uri.split(":").pop() ?? "";
}

async function request(
  path: string,
  accessToken: string
): Promise<{ data: unknown; error?: ApiError }> {
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok)
    return { data: null, error: res.status === 401 ? "auth" : "failed" };
  return { data: await res.json() };
}

// ponytail: the yes/no lookups (isTrackLiked) still collapse a failure into a
// falsy answer — a wrong heart is not worth a second error channel. Everything
// that renders a list goes through request() and reports.
async function apiGet(path: string, accessToken: string): Promise<unknown> {
  return (await request(path, accessToken)).data;
}

async function apiSend(
  method: "PUT" | "POST" | "DELETE",
  path: string,
  accessToken: string,
  body?: unknown
): Promise<boolean> {
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return res.ok;
}

export async function searchTracks(
  query: string,
  accessToken: string
): Promise<Page<TrackResult>> {
  const { data, error } = await request(
    `search?type=track&limit=20&q=${encodeURIComponent(query)}`,
    accessToken
  );
  const items = mapTrackItems(
    (data as { tracks?: { items?: SpotifyTrackItem[] } } | null)?.tracks?.items
  );
  return { items, total: items.length, error };
}

export function pagedPath(path: string, offset: number, limit: number): string {
  return `${path}${path.includes("?") ? "&" : "?"}limit=${limit}&offset=${offset}`;
}

// Every list endpoint answers with { items, total, next }; `total` plus the
// caller's offset is enough, so `next` is ignored.
async function getPage<T>(
  path: string,
  offset: number,
  limit: number,
  accessToken: string
): Promise<Page<T>> {
  const { data, error } = await request(
    pagedPath(path, offset, limit),
    accessToken
  );
  const page = data as { items?: T[]; total?: number } | null;
  return { items: page?.items ?? [], total: page?.total ?? 0, error };
}

export async function getMyPlaylists(
  accessToken: string,
  offset = 0
): Promise<Page<PlaylistResult>> {
  const page = await getPage<SpotifyPlaylistItem | null>(
    "me/playlists",
    offset,
    50,
    accessToken
  );
  return {
    items: mapPlaylistItems(page.items),
    total: page.total,
    error: page.error,
  };
}

export async function getSavedAlbums(
  accessToken: string,
  offset = 0
): Promise<Page<PlaylistResult>> {
  const page = await getPage<{ album: SpotifyPlaylistItem | null }>(
    "me/albums",
    offset,
    50,
    accessToken
  );
  return {
    items: mapPlaylistItems(page.items.map((i) => i?.album ?? null)),
    total: page.total,
    error: page.error,
  };
}

export async function getLikedTracks(
  accessToken: string,
  offset = 0
): Promise<Page<TrackResult>> {
  const page = await getPage<{ track: SpotifyTrackItem | null } | null>(
    "me/tracks",
    offset,
    50,
    accessToken
  );
  return {
    items: mapTrackItems(unwrapTracks(page.items)),
    total: page.total,
    error: page.error,
  };
}

export async function getPlaylistTracks(
  playlistUri: string,
  accessToken: string,
  offset = 0
): Promise<Page<TrackResult>> {
  const page = await getPage<{ track: SpotifyTrackItem | null } | null>(
    `playlists/${uriId(playlistUri)}/tracks`,
    offset,
    100,
    accessToken
  );
  return {
    items: mapTrackItems(unwrapTracks(page.items)),
    total: page.total,
    error: page.error,
  };
}

// Album tracks come back "simplified" — no album object on each track — but the
// browser already knows the album it opened, so nothing needs carrying down.
export async function getAlbumTracks(
  albumUri: string,
  accessToken: string,
  offset = 0
): Promise<Page<TrackResult>> {
  const page = await getPage<SpotifyTrackItem | null>(
    `albums/${uriId(albumUri)}/tracks`,
    offset,
    50,
    accessToken
  );
  return {
    items: mapTrackItems(compact(page.items)),
    total: page.total,
    error: page.error,
  };
}

function compact(items: (SpotifyTrackItem | null)[]): SpotifyTrackItem[] {
  return items.filter((t): t is SpotifyTrackItem => t != null);
}

// Saved/playlist tracks are wrapped, and both the wrapper and the track can be
// null (local files, removed tracks).
function unwrapTracks(
  items: ({ track: SpotifyTrackItem | null } | null)[]
): SpotifyTrackItem[] {
  return compact(items.map((i) => i?.track ?? null));
}

export async function isTrackLiked(
  trackUri: string,
  accessToken: string
): Promise<boolean> {
  const data = (await apiGet(
    `me/tracks/contains?ids=${uriId(trackUri)}`,
    accessToken
  )) as boolean[] | null;
  return data?.[0] ?? false;
}

export async function setTrackLiked(
  trackUri: string,
  liked: boolean,
  accessToken: string
): Promise<boolean> {
  return apiSend(
    liked ? "PUT" : "DELETE",
    `me/tracks?ids=${uriId(trackUri)}`,
    accessToken
  );
}

export async function addToPlaylist(
  playlistUri: string,
  trackUri: string,
  accessToken: string
): Promise<boolean> {
  return apiSend("POST", `playlists/${uriId(playlistUri)}/tracks`, accessToken, {
    uris: [trackUri],
  });
}
