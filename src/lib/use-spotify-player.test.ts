import { describe, it, expect } from "vitest";
import {
  buildPlayBody,
  interpolatePosition,
  mapPlayerTrack,
} from "./use-spotify-player";

describe("mapPlayerTrack", () => {
  it("maps the SDK's track, album uri included", () => {
    expect(
      mapPlayerTrack({
        name: "Feel Good Inc.",
        uri: "spotify:track:1",
        artists: [{ name: "Gorillaz" }, { name: "De La Soul" }],
        album: {
          uri: "spotify:album:5",
          name: "Demon Days",
          images: [
            { url: "big", width: 640 },
            { url: "small", width: 64 },
          ],
        },
      })
    ).toEqual({
      name: "Feel Good Inc.",
      artists: "Gorillaz, De La Soul",
      albumName: "Demon Days",
      albumUri: "spotify:album:5",
      albumArtUrl: "small",
      uri: "spotify:track:1",
    });
  });

  // a podcast episode arrives without an album uri — the Now Playing bar keys
  // its "Go to Album" button off this being empty rather than crashing
  it("survives a track with no album uri or images", () => {
    expect(
      mapPlayerTrack({
        name: "Episode 12",
        uri: "spotify:episode:9",
        artists: [],
        album: { name: "", images: [] },
      })
    ).toEqual({
      name: "Episode 12",
      artists: "",
      albumName: "",
      albumUri: "",
      albumArtUrl: "",
      uri: "spotify:episode:9",
    });
  });
});

describe("interpolatePosition", () => {
  const base = { positionMs: 10_000, durationMs: 200_000, updatedAt: 1_000 };

  it("holds the last position while paused", () => {
    expect(
      interpolatePosition({ ...base, paused: true }, 1_000 + 5_000)
    ).toBe(10_000);
  });

  it("advances by elapsed time while playing", () => {
    expect(
      interpolatePosition({ ...base, paused: false }, 1_000 + 5_000)
    ).toBe(15_000);
  });

  it("clamps to duration so it never overruns", () => {
    expect(
      interpolatePosition(
        { ...base, positionMs: 199_000, paused: false },
        1_000 + 10_000
      )
    ).toBe(200_000);
  });
});

describe("buildPlayBody", () => {
  it("shapes a string as a context_uri", () => {
    expect(buildPlayBody("spotify:playlist:abc")).toEqual({
      context_uri: "spotify:playlist:abc",
    });
  });

  it("shapes an array as uris", () => {
    expect(buildPlayBody(["spotify:track:1", "spotify:track:2"])).toEqual({
      uris: ["spotify:track:1", "spotify:track:2"],
    });
  });

  it("adds an offset when given (start mid-list)", () => {
    expect(buildPlayBody(["a", "b", "c"], 1)).toEqual({
      uris: ["a", "b", "c"],
      offset: { position: 1 },
    });
    expect(buildPlayBody("spotify:playlist:abc", 2)).toEqual({
      context_uri: "spotify:playlist:abc",
      offset: { position: 2 },
    });
  });
});
