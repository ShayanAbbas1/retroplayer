import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getLikedTracks,
  mapPlaylistItems,
  mapTrackItems,
  pagedPath,
  pickImage,
  searchTracks,
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
        },
      ])
    ).toEqual([
      {
        uri: "spotify:track:1",
        name: "Karma Police",
        artists: "Radiohead, Someone",
        durationMs: 261_000,
      },
    ]);
  });

  it("handles missing items, artists and duration", () => {
    expect(mapTrackItems(undefined)).toEqual([]);
    expect(mapTrackItems([{ uri: "u", name: "n" }])).toEqual([
      { uri: "u", name: "n", artists: "", durationMs: 0 },
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

describe("list failures", () => {
  const respond = (status: number, body: unknown) =>
    vi.stubGlobal("fetch", async () => ({
      ok: status < 400,
      status,
      json: async () => body,
    }));

  afterEach(() => vi.unstubAllGlobals());

  it("flags a dead token instead of returning an empty list", async () => {
    respond(401, {});
    expect(await getLikedTracks("stale")).toEqual({
      items: [],
      total: 0,
      error: "auth",
    });
    expect(await searchTracks("abba", "stale")).toEqual({
      items: [],
      total: 0,
      error: "auth",
    });
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
