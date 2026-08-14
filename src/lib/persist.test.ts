import { describe, expect, it } from "vitest";
import { parseSource, parseVolume, readStored, writeStored } from "./persist";

describe("parseSource", () => {
  it("reads a well-formed source back", () => {
    expect(parseSource('{"uri":"spotify:playlist:1","name":"Mix"}')).toEqual({
      uri: "spotify:playlist:1",
      name: "Mix",
    });
  });

  it("falls back to null for absent, malformed or stale values", () => {
    expect(parseSource(null)).toBeNull();
    expect(parseSource("")).toBeNull();
    expect(parseSource("not json")).toBeNull();
    expect(parseSource("null")).toBeNull();
    expect(parseSource("5")).toBeNull();
    expect(parseSource('"liked"')).toBeNull();
    expect(parseSource("[]")).toBeNull();
    expect(parseSource('{"uri":"liked"}')).toBeNull(); // older shape, no name
    expect(parseSource('{"uri":"","name":"Mix"}')).toBeNull();
    expect(parseSource('{"uri":1,"name":"Mix"}')).toBeNull();
  });
});

describe("parseVolume", () => {
  it("keeps a value inside 0..1", () => {
    expect(parseVolume("0.75", 0.5)).toBe(0.75);
    expect(parseVolume("0", 0.5)).toBe(0);
    expect(parseVolume("1", 0.5)).toBe(1);
  });

  it("falls back for absent, malformed or out-of-range values", () => {
    expect(parseVolume(null, 0.5)).toBe(0.5);
    expect(parseVolume("", 0.5)).toBe(0.5);
    expect(parseVolume("loud", 0.5)).toBe(0.5);
    expect(parseVolume("NaN", 0.5)).toBe(0.5);
    expect(parseVolume("Infinity", 0.5)).toBe(0.5);
    expect(parseVolume("-0.5", 0.5)).toBe(0.5);
    expect(parseVolume("70", 0.5)).toBe(0.5); // percent, from some other version
  });
});

describe("readStored / writeStored", () => {
  it("round-trips through localStorage", () => {
    writeStored("retro.test", "hello");
    expect(readStored("retro.test")).toBe("hello");
    expect(readStored("retro.missing")).toBeNull();
  });

  it("survives storage throwing", () => {
    const store = globalThis.localStorage;
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      get() {
        throw new Error("blocked");
      },
    });
    expect(readStored("retro.test")).toBeNull();
    expect(() => writeStored("retro.test", "x")).not.toThrow();
    Object.defineProperty(globalThis, "localStorage", {
      configurable: true,
      value: store,
    });
  });
});
