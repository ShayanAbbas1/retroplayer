import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// jsdom has no layout engine, so scrollIntoView doesn't exist — the component
// calls it on every selection change.
Element.prototype.scrollIntoView = vi.fn();

// vi.mock is hoisted above these imports, so shared fixtures/mocks are built
// via vi.hoisted rather than plain top-level consts.
const {
  ALBUM,
  TRACK,
  TRACK_NO_ALBUM,
  getTokenMock,
  searchMock,
  getAlbumTracksMock,
  getMyPlaylistsMock,
  getSavedAlbumsMock,
  getLikedTracksMock,
  getPlaylistTracksMock,
  isTrackLikedMock,
  setTrackLikedMock,
  addToPlaylistMock,
} = vi.hoisted(() => {
  // items typed loosely so a test can hand a page of fixtures to the same mock
  const EMPTY_PAGE: { items: unknown[]; total: number } = { items: [], total: 0 };
  const ALBUM = {
    uri: "spotify:album:abc",
    name: "Album Name",
    trackCount: 10,
    artists: "Album Artist",
  };
  const TRACK = {
    uri: "spotify:track:xyz",
    name: "Track Name",
    artists: "Track Artist",
    durationMs: 200000,
    album: "Some Other Album",
    albumUri: "spotify:album:other",
  };
  const TRACK_NO_ALBUM = {
    uri: "spotify:track:noalbum",
    name: "No Album Track",
    artists: "Solo Artist",
    durationMs: 150000,
    album: "",
    albumUri: "",
  };
  return {
    ALBUM,
    TRACK,
    TRACK_NO_ALBUM,
    getTokenMock: vi.fn(async () => "token"),
    searchMock: vi.fn(async () => ({
      tracks: { items: [TRACK, TRACK_NO_ALBUM], total: 2 },
      albums: { items: [ALBUM], total: 1 },
    })),
    getAlbumTracksMock: vi.fn(async () => EMPTY_PAGE),
    getMyPlaylistsMock: vi.fn(async () => EMPTY_PAGE),
    getSavedAlbumsMock: vi.fn(async () => EMPTY_PAGE),
    getLikedTracksMock: vi.fn(async () => EMPTY_PAGE),
    getPlaylistTracksMock: vi.fn(async () => EMPTY_PAGE),
    isTrackLikedMock: vi.fn(async () => false),
    setTrackLikedMock: vi.fn(async () => true),
    addToPlaylistMock: vi.fn(async () => true),
  };
});

vi.mock("@/lib/spotify-client", () => ({
  getToken: getTokenMock,
  search: searchMock,
  getMyPlaylists: getMyPlaylistsMock,
  getSavedAlbums: getSavedAlbumsMock,
  getLikedTracks: getLikedTracksMock,
  getPlaylistTracks: getPlaylistTracksMock,
  getAlbumTracks: getAlbumTracksMock,
  isTrackLiked: isTrackLikedMock,
  setTrackLiked: setTrackLikedMock,
  addToPlaylist: addToPlaylistMock,
}));

import LibraryBrowser from "./library-browser";

const PLAYLIST = { uri: "spotify:playlist:p1", name: "My Playlist", trackCount: 7 };
const SAVED_ALBUM = {
  uri: "spotify:album:saved",
  name: "Saved Album",
  trackCount: 12,
  artists: "Saved Artist",
};

// the column headers are the only buttons inside a grid row
const headers = () =>
  Array.from(document.querySelectorAll("div.grid > button"), (b) => b.textContent);

const cellsOf = (row: number) =>
  Array.from(
    document.querySelector(`[data-row="${row}"]`)!.querySelectorAll("span"),
    (c) => c.textContent
  );

async function searchFor(query: string) {
  render(<LibraryBrowser onPlay={vi.fn()} />);
  fireEvent.change(screen.getByLabelText("Search:"), {
    target: { value: query },
  });
  await waitFor(() => expect(searchMock).toHaveBeenCalled(), { timeout: 2000 });
  await screen.findByText(TRACK.name, undefined, { timeout: 2000 });
}

describe("LibraryBrowser search rows", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  afterEach(cleanup);

  it("renders album hits above track hits, sharing one row index, and shows each track's album", async () => {
    await searchFor("test");

    const rows = document.querySelectorAll("[data-row]");
    expect(rows).toHaveLength(3);
    expect(rows[0].textContent).toContain(ALBUM.name);
    expect(rows[1].textContent).toContain(TRACK.name);
    expect(rows[2].textContent).toContain(TRACK_NO_ALBUM.name);

    expect(cellsOf(1)[4]).toBe(TRACK.album);
  });

  it("double-clicking an album row selects it as the source and loads its tracks", async () => {
    await searchFor("test");

    const albumRow = document.querySelector('[data-row="0"]')!;
    fireEvent.doubleClick(albumRow);

    await waitFor(() =>
      expect(getAlbumTracksMock).toHaveBeenCalledWith(
        ALBUM.uri,
        "token",
        0,
        ALBUM.name
      )
    );
  });

  it("pressing Enter on a selected album row activates it the same way", async () => {
    await searchFor("test");

    const albumRow = document.querySelector('[data-row="0"]')!;
    fireEvent.click(albumRow);
    fireEvent.keyDown(albumRow, { key: "Enter" });

    await waitFor(() =>
      expect(getAlbumTracksMock).toHaveBeenCalledWith(
        ALBUM.uri,
        "token",
        0,
        ALBUM.name
      )
    );
  });

  it("Go to Album in the track context menu switches source to the track's album", async () => {
    await searchFor("test");

    const trackRow = document.querySelector('[data-row="1"]')!; // TRACK
    fireEvent.contextMenu(trackRow);
    const goToAlbum = await screen.findByText("💿 Go to Album");
    expect(goToAlbum).not.toBeDisabled();
    fireEvent.click(goToAlbum);

    await waitFor(() =>
      expect(getAlbumTracksMock).toHaveBeenCalledWith(
        TRACK.albumUri,
        "token",
        0,
        TRACK.album
      )
    );
  });

  it("disables Go to Album for a track with no album", async () => {
    await searchFor("test");

    const trackRow = document.querySelector('[data-row="2"]')!; // TRACK_NO_ALBUM
    fireEvent.contextMenu(trackRow);
    const goToAlbum = await screen.findByText("💿 Go to Album");
    expect(goToAlbum).toBeDisabled();
  });

  // the Type column is what separates the two kinds, and the last column is a
  // song duration — so an album among songs leaves it blank rather than putting
  // a track count under a "Time" header
  it("labels each row's type and leaves the time blank for an album among songs", async () => {
    await searchFor("test");

    expect(headers()).toEqual(["#", "Type", "Name", "Artist", "Album", "Time"]);
    expect(cellsOf(0)).toEqual(["💿", "Album", ALBUM.name, ALBUM.artists, "", ""]);
    expect(cellsOf(1)).toEqual([
      "1",
      "Song",
      TRACK.name,
      TRACK.artists,
      TRACK.album,
      "3:20",
    ]);
  });

  it("searches only what the type filter asks for", async () => {
    await searchFor("test");
    expect(searchMock).toHaveBeenLastCalledWith("test", "token", "all");

    searchMock.mockResolvedValueOnce({
      tracks: { items: [], total: 0 },
      albums: { items: [ALBUM], total: 1 },
    });
    fireEvent.change(screen.getByLabelText("for"), { target: { value: "album" } });
    await waitFor(() =>
      expect(searchMock).toHaveBeenLastCalledWith("test", "token", "album")
    );

    // albums alone: the last column counts tracks instead of timing them
    await waitFor(() => expect(document.querySelectorAll("[data-row]")).toHaveLength(1));
    expect(headers()[5]).toBe("Tracks");
    expect(cellsOf(0)[5]).toBe("10");
  });

  it("shows saved playlists and albums with their type in My Library", async () => {
    getMyPlaylistsMock.mockResolvedValueOnce({ items: [PLAYLIST], total: 1 });
    getSavedAlbumsMock.mockResolvedValueOnce({ items: [SAVED_ALBUM], total: 1 });
    render(<LibraryBrowser onPlay={vi.fn()} />);
    fireEvent.change(screen.getByLabelText("in"), { target: { value: "library" } });
    fireEvent.change(screen.getByLabelText("Search:"), { target: { value: "a" } });

    await screen.findByText(SAVED_ALBUM.name);
    expect(cellsOf(0)).toEqual(["♪", "Playlist", PLAYLIST.name, "", "", "7"]);
    expect(cellsOf(1)).toEqual([
      "💿",
      "Album",
      SAVED_ALBUM.name,
      SAVED_ALBUM.artists,
      "",
      "12",
    ]);
    // the type filter belongs to a Spotify search only
    expect(screen.queryByLabelText("for")).toBeNull();
  });
});
