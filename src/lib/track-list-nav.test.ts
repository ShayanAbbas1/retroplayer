import { describe, expect, it } from "vitest";
import {
  firstArtist,
  formatDuration,
  itemsLabel,
  matchesFilter,
  moveSelection,
  playWindow,
  queuePosition,
  sourcePosition,
  typeAheadIndex,
} from "./track-list-nav";

describe("playWindow", () => {
  const uris = Array.from({ length: 500 }, (_, i) => `u${i}`);

  it("sends 100 uris starting at the clicked track, not at the top", () => {
    const w = playWindow(uris, 250);
    expect(w).toHaveLength(100);
    expect(w[0]).toBe("u250");
    expect(w[99]).toBe("u349");
  });

  it("stops at the end of the list", () => {
    expect(playWindow(uris, 450)).toHaveLength(50);
    expect(playWindow(uris, 499)).toEqual(["u499"]);
    expect(playWindow(uris, 500)).toEqual([]);
  });

  it("clamps a negative index and handles an empty list", () => {
    expect(playWindow(uris, -3)[0]).toBe("u0");
    expect(playWindow([], 0)).toEqual([]);
  });
});

describe("matchesFilter", () => {
  it("matches any field, case-insensitively, anywhere in the string", () => {
    expect(matchesFilter("moun", "The Mountain", "Gorillaz")).toBe(true);
    expect(matchesFilter("GORILLAZ", "The Mountain", "Gorillaz")).toBe(true);
    expect(matchesFilter("strokes", "The Mountain", "Gorillaz")).toBe(false);
  });

  it("treats a blank query as no filter", () => {
    expect(matchesFilter("", "anything")).toBe(true);
    expect(matchesFilter("   ", "anything")).toBe(true);
  });
});

describe("itemsLabel", () => {
  it("shows progress while a list is partially loaded", () => {
    expect(itemsLabel(150, 2431)).toBe("150 of 2431 items");
  });

  it("drops the progress once everything is loaded", () => {
    expect(itemsLabel(2431, 2431)).toBe("2431 items");
    expect(itemsLabel(0, 0)).toBe("0 items");
  });
});

describe("formatDuration", () => {
  it("formats minutes and seconds with a padded seconds field", () => {
    expect(formatDuration(324_000)).toBe("5:24");
    expect(formatDuration(9_000)).toBe("0:09");
    expect(formatDuration(0)).toBe("0:00");
  });

  it("adds an hours field once past an hour", () => {
    expect(formatDuration(3_723_000)).toBe("1:02:03");
    expect(formatDuration(11_564_000)).toBe("3:12:44");
  });
});

describe("typeAheadIndex", () => {
  const names = ["Sailing", "The Mountain", "Sandstorm", "Dine N'Dash"];

  it("finds the first match at or after `from`, case-insensitively", () => {
    expect(typeAheadIndex(names, "sa", 0)).toBe(0);
    expect(typeAheadIndex(names, "SA", 1)).toBe(2);
  });

  it("wraps past the end of the list", () => {
    expect(typeAheadIndex(names, "s", 3)).toBe(0);
    expect(typeAheadIndex(names, "d", 2)).toBe(3);
  });

  it("returns -1 with no match and on an empty list", () => {
    expect(typeAheadIndex(names, "z", 0)).toBe(-1);
    expect(typeAheadIndex([], "a", 0)).toBe(-1);
  });
});

const track = (uri: string, name: string, artists: string, durationMs: number) => ({
  uri,
  name,
  artists,
  durationMs,
});

// a playlist page as loaded, in Spotify's own order
const source = [
  track("u0", "Sailing", "Christopher Cross", 255_000),
  track("u1", "The Mountain", "Gorillaz", 392_000),
  track("u2", "dine n'dash", "The Strokes", 178_000),
  track("u3", "Sandstorm", "Darude", 225_000),
];

describe("firstArtist", () => {
  it("takes the lead artist off the joined string", () => {
    expect(firstArtist("Gorillaz, Dennis Hopper")).toBe("Gorillaz");
    expect(firstArtist("Darude")).toBe("Darude");
    expect(firstArtist("")).toBe("");
  });
});

describe("sourcePosition", () => {
  it("maps a filtered row back to its index in the source order", () => {
    // "This list" filter on "s"
    const visible = source.filter((t) => t.name.toLowerCase().includes("s"));
    expect(visible.map((t) => t.uri)).toEqual(["u0", "u2", "u3"]);
    // clicking the second visible row must start u2, i.e. offset 2
    expect(sourcePosition(source, visible[1].uri, 1)).toBe(2);
    expect(sourcePosition(source, visible[2].uri, 2)).toBe(3);
  });

  it("falls back to the visible index when the uri is gone", () => {
    expect(sourcePosition(source, "missing", 2)).toBe(2);
    expect(sourcePosition([], "u0", -1)).toBe(0);
  });
});

describe("filtered playback of a uri list", () => {
  it("plays the clicked row first, in the order shown", () => {
    const visible = source.filter((t) => t.name.toLowerCase().includes("s"));
    const uris = playWindow(
      visible.map((t) => t.uri),
      1
    );
    expect(uris).toEqual(["u2", "u3"]);
  });
});

describe("queuePosition", () => {
  it("follows the playing track by uri, so transport skips stay in sync", () => {
    expect(queuePosition(source, "u2", 0)).toBe(2);
    expect(queuePosition(source, "u0", 3)).toBe(0);
  });

  it("falls back to where we started when nothing matches", () => {
    expect(queuePosition(source, "elsewhere", 2)).toBe(2);
    expect(queuePosition(source, undefined, 1)).toBe(1);
    expect(queuePosition(source, undefined, 99)).toBe(3);
    expect(queuePosition([], "u0", 0)).toBe(-1);
  });
});

describe("moveSelection", () => {
  it("steps and clamps at both ends", () => {
    expect(moveSelection("ArrowDown", 0, 4, 2)).toBe(1);
    expect(moveSelection("ArrowUp", 0, 4, 2)).toBe(0);
    expect(moveSelection("ArrowDown", 3, 4, 2)).toBe(3);
    expect(moveSelection("PageDown", 0, 4, 10)).toBe(3);
    expect(moveSelection("PageUp", 3, 4, 10)).toBe(0);
  });

  it("jumps to the ends", () => {
    expect(moveSelection("Home", 3, 4, 2)).toBe(0);
    expect(moveSelection("End", 0, 4, 2)).toBe(3);
  });

  it("selects the first row from an empty selection", () => {
    expect(moveSelection("ArrowDown", -1, 4, 2)).toBe(0);
  });

  it("ignores other keys and empty lists", () => {
    expect(moveSelection("a", 2, 4, 2)).toBe(2);
    expect(moveSelection("Enter", 2, 4, 2)).toBe(2);
    expect(moveSelection("ArrowDown", -1, 0, 2)).toBe(-1);
  });
});
