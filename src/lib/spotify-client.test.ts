import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getAlbumTracks,
  getLikedTracks,
  mapPlaylistItems,
  mapTrackItems,
  pagedPath,
  pickImage,
  search,
  uriId,
} from "./spotify-client";

describe("pagedPath", () => {
  it("appends limit and offset", () => {
    expect(pagedPath("me/tracks", 0, 50)).toBe("me/tracks?limit=50&offset=0");
    expect(pagedPath("me/tracks", 150, 50)).toBe("me/tracks?limit=50&offset=150");
  });

  it("keeps an existing query string", () => {
    expect(pagedPath("search?type=track", 20, 20)).toBe(
      "search?type=track&limit=20&offset=20"
    );
  });
});

describe("uriId", () => {
  it("extracts the id from a spotify uri", () => {
    expect(uriId("spotify:playlist:37i9dQ")).toBe("37i9dQ");
    expect(uriId("spotify:track:abc123")).toBe("abc123");
  });
});

describe("mapTrackItems", () => {
  it("maps spotify track items to results", () => {
    expect(
      mapTrackItems([
        {
          uri: "spotify:track:1",
          name: "Karma Police",
          artists: [{ name: "Radiohead" }, { name: "Someone" }],
          duration_ms: 261_000,
          album: { uri: "spotify:album:9", name: "OK Computer" },
        },
      ])
    ).toEqual([
      {
        uri: "spotify:track:1",
        name: "Karma Police",
        artists: "Radiohead, Someone",
        durationMs: 261_000,
        album: "OK Computer",
        albumUri: "spotify:album:9",
      },
    ]);
  });

  it("handles missing items, artists, duration and album", () => {
    expect(mapTrackItems(undefined)).toEqual([]);
    expect(mapTrackItems([{ uri: "u", name: "n" }])).toEqual([
      { uri: "u", name: "n", artists: "", durationMs: 0, album: "", albumUri: "" },
    ]);
  });
});

describe("mapPlaylistItems", () => {
  it("maps playlists and skips null entries (spotify returns them)", () => {
    expect(
      mapPlaylistItems([
        { uri: "spotify:playlist:1", name: "Mix", tracks: { total: 12 } },
        null,
        { uri: "spotify:playlist:2", name: "Empty" },
      ])
    ).toEqual([
      { uri: "spotify:playlist:1", name: "Mix", trackCount: 12 },
      { uri: "spotify:playlist:2", name: "Empty", trackCount: 0 },
    ]);
  });

  it("handles undefined", () => {
    expect(mapPlaylistItems(undefined)).toEqual([]);
  });

  it("reads an album's track count from total_tracks", () => {
    expect(
      mapPlaylistItems([
        { uri: "spotify:album:1", name: "Demon Days", total_tracks: 15 },
      ])
    ).toEqual([{ uri: "spotify:album:1", name: "Demon Days", trackCount: 15 }]);
  });

  it("keeps an album's artists (playlists have none)", () => {
    expect(
      mapPlaylistItems([
        {
          uri: "spotify:album:1",
          name: "Demon Days",
          total_tracks: 15,
          artists: [{ name: "Gorillaz" }, { name: "De La Soul" }],
        },
      ])
    ).toEqual([
      {
        uri: "spotify:album:1",
        name: "Demon Days",
        trackCount: 15,
        artists: "Gorillaz, De La Soul",
      },
    ]);
  });

  it("maps the smallest cover image that still fits", () => {
    expect(
      mapPlaylistItems([
        {
          uri: "spotify:playlist:1",
          name: "Mix",
          images: [
            { url: "big", width: 640 },
            { url: "small", width: 60 },
          ],
        },
      ])
    ).toEqual([
      { uri: "spotify:playlist:1", name: "Mix", trackCount: 0, image: "small" },
    ]);
  });
});

describe("pickImage", () => {
  const images = [
    { url: "big", width: 640 },
    { url: "medium", width: 300 },
    { url: "small", width: 64 },
  ];

  it("picks the smallest image still >= the requested size", () => {
    expect(pickImage(images, 48)).toBe("small");
    expect(pickImage(images, 100)).toBe("medium");
  });

  it("falls back to the largest image when none is big enough", () => {
    expect(pickImage(images, 1000)).toBe("big");
  });

  it("treats an image with unknown width as always acceptable", () => {
    expect(pickImage([{ url: "unknown", width: null }], 640)).toBe("unknown");
  });

  it("handles missing or empty images", () => {
    expect(pickImage(undefined, 48)).toBeUndefined();
    expect(pickImage([], 48)).toBeUndefined();
  });
});

const respond = (status: number, body: unknown) => {
  const urls: string[] = [];
  vi.stubGlobal("fetch", async (url: string) => {
    urls.push(url);
    return { ok: status < 400, status, json: async () => body };
  });
  return urls;
};

describe("search", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("asks for albums as well as tracks in one request", async () => {
    const urls = respond(200, {});
    await search("demon days", "t");
    expect(urls).toHaveLength(1);
    expect(urls[0]).toContain("type=track,album");
    expect(urls[0]).toContain("q=demon%20days");
  });

  it("narrows the request to the type asked for", async () => {
    const urls = respond(200, {});
    await search("x", "t", "album");
    await search("x", "t", "track");
    expect(urls[0]).toContain("type=album");
    expect(urls[1]).toContain("type=track&");
  });

  it("returns album hits alongside track hits", async () => {
    respond(200, {
      tracks: {
        items: [
          {
            uri: "spotify:track:1",
            name: "Feel Good Inc.",
            artists: [{ name: "Gorillaz" }],
            duration_ms: 222_000,
            album: { uri: "spotify:album:5", name: "Demon Days" },
          },
        ],
      },
      albums: {
        items: [
          {
            uri: "spotify:album:5",
            name: "Demon Days",
            total_tracks: 15,
            artists: [{ name: "Gorillaz" }],
          },
        ],
      },
    });
    const { tracks, albums } = await search("demon days", "t");
    expect(tracks.items).toEqual([
      {
        uri: "spotify:track:1",
        name: "Feel Good Inc.",
        artists: "Gorillaz",
        durationMs: 222_000,
        album: "Demon Days",
        albumUri: "spotify:album:5",
      },
    ]);
    expect(albums.items).toEqual([
      {
        uri: "spotify:album:5",
        name: "Demon Days",
        trackCount: 15,
        artists: "Gorillaz",
      },
    ]);
    expect(tracks.total).toBe(1);
    expect(albums.total).toBe(1);
  });

  it("survives a response with only one of the two blocks", async () => {
    respond(200, { tracks: { items: [{ uri: "u", name: "n" }] } });
    const { tracks, albums } = await search("x", "t");
    expect(tracks.items).toHaveLength(1);
    expect(albums.items).toEqual([]);
  });
});

describe("getAlbumTracks", () => {
  afterEach(() => vi.unstubAllGlobals());

  // album tracks come back simplified — without this, the Album column would be
  // blank and "Go to Album" dead for exactly the rows already inside an album
  it("stamps the album the caller opened onto every track", async () => {
    respond(200, {
      items: [{ uri: "spotify:track:1", name: "Intro", duration_ms: 30_000 }],
      total: 1,
    });
    const page = await getAlbumTracks("spotify:album:5", "t", 0, "Demon Days");
    expect(page.items).toEqual([
      {
        uri: "spotify:track:1",
        name: "Intro",
        artists: "",
        durationMs: 30_000,
        album: "Demon Days",
        albumUri: "spotify:album:5",
      },
    ]);
  });
});

describe("list failures", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("flags a dead token instead of returning an empty list", async () => {
    respond(401, {});
    expect(await getLikedTracks("stale")).toEqual({
      items: [],
      total: 0,
      error: "auth",
    });
    const dead = await search("abba", "stale");
    expect(dead.tracks).toEqual({ items: [], total: 0, error: "auth" });
    expect(dead.albums).toEqual({ items: [], total: 0, error: "auth" });
  });

  it("separates other Spotify failures from an auth failure", async () => {
    respond(503, {});
    expect((await getLikedTracks("t")).error).toBe("failed");
  });

  it("carries no error when the page loads", async () => {
    respond(200, { items: [{ track: { uri: "u1", name: "One" } }], total: 1 });
    const page = await getLikedTracks("t");
    expect(page.error).toBeUndefined();
    expect(page.items).toHaveLength(1);
    expect(page.total).toBe(1);
  });
});
