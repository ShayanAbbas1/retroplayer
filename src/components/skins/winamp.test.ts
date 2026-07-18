import { describe, it, expect } from "vitest";
import { formatClock, formatMarquee } from "./winamp-format";

describe("formatClock", () => {
  it("zero-pads minutes and seconds", () => {
    expect(formatClock(0)).toBe("00:00");
    expect(formatClock(83_000)).toBe("01:23");
  });

  it("floors partial seconds and clamps negatives", () => {
    expect(formatClock(1_999)).toBe("00:01");
    expect(formatClock(-500)).toBe("00:00");
  });

  it("caps minutes at 99", () => {
    expect(formatClock(100 * 60_000)).toBe("99:00");
  });
});

describe("formatMarquee", () => {
  it("formats as 'N. ARTIST - TITLE' in all caps", () => {
    expect(formatMarquee(3, "Radiohead", "Karma Police")).toBe(
      "3. RADIOHEAD - KARMA POLICE"
    );
  });

  it("drops the artist dash when artist is empty", () => {
    expect(formatMarquee(1, "", "Untitled")).toBe("1. UNTITLED");
  });

  it("falls back to a placeholder with no track", () => {
    expect(formatMarquee(1, "", "")).toBe("WINAMP 2.9");
  });
});
