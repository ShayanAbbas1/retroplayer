// Browser-side Spotify Web API calls used by the player (raw fetch — the
// node client in spotify.ts isn't meant for the client bundle).

export interface TrackResult {
  uri: string;
  name: string;
  artists: string;
}

export interface PlaylistResult {
  uri: string;
  name: string;
  trackCount: number;
}

interface SpotifyTrackItem {
  uri: string;
  name: string;
  artists?: { name: string }[];
}

interface SpotifyPlaylistItem {
  uri: string;
  name: string;
  tracks?: { total?: number };
}

export function mapTrackItems(items: SpotifyTrackItem[] | undefined): TrackResult[] {
  return (items ?? []).map((t) => ({
    uri: t.uri,
    name: t.name,
    artists: (t.artists ?? []).map((a) => a.name).join(", "),
  }));
}

export function mapPlaylistItems(
  items: (SpotifyPlaylistItem | null)[] | undefined
): PlaylistResult[] {
  return (items ?? [])
    .filter((p): p is SpotifyPlaylistItem => p != null)
    .map((p) => ({ uri: p.uri, name: p.name, trackCount: p.tracks?.total ?? 0 }));
}

// "spotify:playlist:xyz" → "xyz"
export function uriId(uri: string): string {
  return uri.split(":").pop() ?? "";
}

async function apiGet(path: string, accessToken: string): Promise<unknown> {
  const res = await fetch(`https://api.spotify.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) return null;
  return res.json();
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
): Promise<TrackResult[]> {
  const data = (await apiGet(
    `search?type=track&limit=20&q=${encodeURIComponent(query)}`,
    accessToken
  )) as { tracks?: { items?: SpotifyTrackItem[] } } | null;
  return mapTrackItems(data?.tracks?.items);
}

export async function getMyPlaylists(
  accessToken: string
): Promise<PlaylistResult[]> {
  const data = (await apiGet("me/playlists?limit=50", accessToken)) as {
    items?: SpotifyPlaylistItem[];
  } | null;
  return mapPlaylistItems(data?.items);
}

// ponytail: first 50 liked songs only — the /me/player/play uris body caps
// out anyway and "spotify:collection" isn't playable via the Web API.
export async function getLikedTracks(
  accessToken: string
): Promise<TrackResult[]> {
  const data = (await apiGet("me/tracks?limit=50", accessToken)) as {
    items?: { track: SpotifyTrackItem }[];
  } | null;
  return mapTrackItems((data?.items ?? []).map((i) => i.track));
}

// ponytail: first 100 tracks per playlist; add paging if anyone notices.
export async function getPlaylistTracks(
  playlistUri: string,
  accessToken: string
): Promise<TrackResult[]> {
  const data = (await apiGet(
    `playlists/${uriId(playlistUri)}/tracks?limit=100`,
    accessToken
  )) as { items?: ({ track: SpotifyTrackItem | null } | null)[] } | null;
  return mapTrackItems(
    (data?.items ?? [])
      .map((i) => i?.track)
      .filter((t): t is SpotifyTrackItem => t != null)
  );
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
