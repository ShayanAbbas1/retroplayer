import { describe, expect, it } from "vitest";
import { mapPlaylistItems, mapTrackItems, uriId } from "./spotify-client";

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
        },
      ])
    ).toEqual([
      { uri: "spotify:track:1", name: "Karma Police", artists: "Radiohead, Someone" },
    ]);
  });

  it("handles missing items and artists", () => {
    expect(mapTrackItems(undefined)).toEqual([]);
    expect(mapTrackItems([{ uri: "u", name: "n" }])).toEqual([
      { uri: "u", name: "n", artists: "" },
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
});
