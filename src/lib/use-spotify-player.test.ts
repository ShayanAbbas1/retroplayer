import { describe, it, expect } from "vitest";
import { interpolatePosition, buildPlayBody } from "./use-spotify-player";

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
