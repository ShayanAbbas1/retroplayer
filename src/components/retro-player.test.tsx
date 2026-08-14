import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no layout engine, so scrollIntoView doesn't exist — LibraryBrowser
// calls it on every selection change.
Element.prototype.scrollIntoView = vi.fn();

// vi.mock is hoisted above these imports, so shared fixtures/mocks are built
// via vi.hoisted rather than plain top-level consts.
const {
  playerState,
  ALBUM_TRACK,
  NO_ALBUM_TRACK,
  signInMock,
  getTokenMock,
  getAlbumTracksMock,
  getMyPlaylistsMock,
  getSavedAlbumsMock,
  getLikedTracksMock,
  getPlaylistTracksMock,
  searchMock,
  isTrackLikedMock,
  setTrackLikedMock,
  addToPlaylistMock,
} = vi.hoisted(() => {
  const EMPTY_PAGE: { items: unknown[]; total: number } = { items: [], total: 0 };
  const ALBUM_TRACK = {
    name: "Now Playing Song",
    artists: "Now Playing Artist",
    albumName: "Now Playing Album",
    albumUri: "spotify:album:nowplaying",
    albumArtUrl: "",
    uri: "spotify:track:nowplaying",
  };
  const NO_ALBUM_TRACK = {
    name: "Podcast Episode",
    artists: "Podcast Host",
    albumName: "",
    albumUri: "",
    albumArtUrl: "",
    uri: "spotify:track:podcast",
  };
  // a plain mutable object the mocked useSpotifyPlayer reads every render, so
  // a test can swap `.track` before rendering without re-mocking the module
  const playerState = {
    status: "ready" as const,
    deviceId: "device1",
    track: ALBUM_TRACK as typeof ALBUM_TRACK | typeof NO_ALBUM_TRACK,
    paused: true,
    positionMs: 0,
    durationMs: 200000,
    volume: 0.5,
    controls: {
      play: vi.fn(),
      pause: vi.fn(),
      resume: vi.fn(),
      next: vi.fn(),
      previous: vi.fn(),
      seek: vi.fn(),
      setVolume: vi.fn(),
    },
  };
  return {
    playerState,
    ALBUM_TRACK,
    NO_ALBUM_TRACK,
    signInMock: vi.fn(),
    getTokenMock: vi.fn(async () => "token"),
    getAlbumTracksMock: vi.fn(async () => EMPTY_PAGE),
    getMyPlaylistsMock: vi.fn(async () => EMPTY_PAGE),
    getSavedAlbumsMock: vi.fn(async () => EMPTY_PAGE),
    getLikedTracksMock: vi.fn(async () => EMPTY_PAGE),
    getPlaylistTracksMock: vi.fn(async () => EMPTY_PAGE),
    searchMock: vi.fn(async () => ({
      tracks: { items: [], total: 0 },
      albums: { items: [], total: 0 },
    })),
    isTrackLikedMock: vi.fn(async () => false),
    setTrackLikedMock: vi.fn(async () => true),
    addToPlaylistMock: vi.fn(async () => true),
  };
});

vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: { user: {} } }),
  signIn: signInMock,
}));

vi.mock("@/lib/use-spotify-player", () => ({
  useSpotifyPlayer: () => playerState,
}));

vi.mock("@/lib/spotify-client", () => ({
  getToken: getTokenMock,
  getAlbumTracks: getAlbumTracksMock,
  getMyPlaylists: getMyPlaylistsMock,
  getSavedAlbums: getSavedAlbumsMock,
  getLikedTracks: getLikedTracksMock,
  getPlaylistTracks: getPlaylistTracksMock,
  search: searchMock,
  isTrackLiked: isTrackLikedMock,
  setTrackLiked: setTrackLikedMock,
  addToPlaylist: addToPlaylistMock,
}));

// WinampSkin pulls in a CSS module; vitest's PostCSS pipeline chokes on this
// repo's postcss.config.mjs (pre-existing, unrelated to Go to Album), and the
// skin is pure chrome anyway — stub it out.
vi.mock("@/components/skins/winamp", () => ({
  default: () => null,
}));

import RetroPlayer from "./retro-player";

describe("RetroPlayer — Go to Album hand-off to LibraryBrowser", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    playerState.track = ALBUM_TRACK;
  });

  afterEach(cleanup);

  it("loads the playing track's album and shows its name as the track pane header", async () => {
    render(<RetroPlayer />);

    fireEvent.click(screen.getByRole("button", { name: "💿 Go to Album" }));

    await waitFor(() =>
      expect(getAlbumTracksMock).toHaveBeenCalledWith(
        ALBUM_TRACK.albumUri,
        "token",
        0,
        ALBUM_TRACK.albumName
      )
    );
    await screen.findByText(ALBUM_TRACK.albumName);
  });

  it("still reloads the album on a second click after navigating away", async () => {
    render(<RetroPlayer />);

    fireEvent.click(screen.getByRole("button", { name: "💿 Go to Album" }));
    await waitFor(() => expect(getAlbumTracksMock).toHaveBeenCalledTimes(1));

    // leave the album for another source, then come back to it
    fireEvent.click(screen.getByRole("button", { name: "♥ Liked Songs" }));
    await screen.findByText("Liked Songs");

    fireEvent.click(screen.getByRole("button", { name: "💿 Go to Album" }));
    await waitFor(() => expect(getAlbumTracksMock).toHaveBeenCalledTimes(2));
    expect(getAlbumTracksMock).toHaveBeenLastCalledWith(
      ALBUM_TRACK.albumUri,
      "token",
      0,
      ALBUM_TRACK.albumName
    );
  });

  it("disables Go to Album when the playing track has no album", () => {
    playerState.track = NO_ALBUM_TRACK;
    render(<RetroPlayer />);

    expect(
      screen.getByRole("button", { name: "💿 Go to Album" })
    ).toBeDisabled();
  });
});
