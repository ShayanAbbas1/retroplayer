import { describe, expect, it } from "vitest";
import { isTypingTarget, shortcutFor, type ShortcutEvent } from "./shortcuts";

const key = (k: string, mods: Partial<ShortcutEvent> = {}): ShortcutEvent => ({
  key: k,
  ctrlKey: false,
  metaKey: false,
  altKey: false,
  ...mods,
});

const loose = { typing: false, inList: false };
const inList = { typing: false, inList: true };
const typing = { typing: true, inList: false };

describe("shortcutFor", () => {
  it("maps the Winamp transport keys", () => {
    expect(shortcutFor(key("z"), loose)).toBe("previous");
    expect(shortcutFor(key("x"), loose)).toBe("play");
    expect(shortcutFor(key("c"), loose)).toBe("pause");
    expect(shortcutFor(key("v"), loose)).toBe("stop");
    expect(shortcutFor(key("b"), loose)).toBe("next");
    expect(shortcutFor(key(" "), loose)).toBe("playPause");
  });

  it("accepts shifted (uppercase) letters", () => {
    expect(shortcutFor(key("Z"), loose)).toBe("previous");
  });

  it("ignores keys with no shortcut", () => {
    expect(shortcutFor(key("q"), loose)).toBeNull();
    expect(shortcutFor(key("ArrowDown"), loose)).toBeNull();
    expect(shortcutFor(key("Enter"), loose)).toBeNull();
  });

  it("never fires while a text field has focus", () => {
    for (const k of ["z", "x", "c", "v", "b", " "]) {
      expect(shortcutFor(key(k), typing)).toBeNull();
    }
  });

  it("leaves letters to the track list's type-ahead, but keeps the spacebar", () => {
    for (const k of ["z", "x", "c", "v", "b"]) {
      expect(shortcutFor(key(k), inList)).toBeNull();
    }
    expect(shortcutFor(key(" "), inList)).toBe("playPause");
  });

  it("focuses the search box on Ctrl/Cmd+F from anywhere", () => {
    expect(shortcutFor(key("f", { ctrlKey: true }), loose)).toBe("focusSearch");
    expect(shortcutFor(key("f", { metaKey: true }), typing)).toBe("focusSearch");
    expect(shortcutFor(key("F", { metaKey: true }), inList)).toBe("focusSearch");
  });

  it("ignores transport keys held with a modifier", () => {
    expect(shortcutFor(key("x", { ctrlKey: true }), loose)).toBeNull();
    expect(shortcutFor(key("x", { metaKey: true }), loose)).toBeNull();
    expect(shortcutFor(key("x", { altKey: true }), loose)).toBeNull();
    expect(shortcutFor(key("f"), loose)).toBeNull();
  });
});

describe("isTypingTarget", () => {
  const el = (html: string) => {
    const div = document.createElement("div");
    div.innerHTML = html;
    return div.firstElementChild;
  };

  it("is true for form fields", () => {
    expect(isTypingTarget(el("<input>"))).toBe(true);
    expect(isTypingTarget(el("<textarea></textarea>"))).toBe(true);
    expect(isTypingTarget(el("<select></select>"))).toBe(true);
  });

  it("is true for contenteditable elements", () => {
    expect(isTypingTarget(el('<div contenteditable="true"></div>'))).toBe(true);
    expect(isTypingTarget(el("<div contenteditable></div>"))).toBe(true);
    expect(isTypingTarget(el('<div contenteditable="false"></div>'))).toBe(false);
  });

  it("is false for everything else", () => {
    expect(isTypingTarget(null)).toBe(false);
    expect(isTypingTarget(el("<div></div>"))).toBe(false);
    expect(isTypingTarget(el("<button></button>"))).toBe(false);
  });
});
