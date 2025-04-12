export type TimeRange = "short_term" | "medium_term" | "long_term";

export interface SpotifyArtist {
  id: string;
  name: string;
  images: { url: string }[];
  genres: string[];
  popularity: number;
}

export interface SpotifyTrack {
  id: string;
  name: string;
  album: {
    id: string;
    name: string;
    images: { url: string }[];
    artists: { name: string }[];
    release_date: string;
    total_tracks: number;
  };
  artists: { name: string }[];
  popularity: number;
  duration_ms?: number;
}

export interface SpotifyAlbum {
  id: string;
  name: string;
  images: { url: string }[];
  artists: {
    name: string;
  }[];
  release_date: string;
  total_tracks: number;
  popularity?: number;
}
