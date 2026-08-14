// Winamp's transport keys. The mapping is kept away from the DOM so the rules
// that stop it firing mid-typing are testable.

export type ShortcutAction =
  | "previous"
  | "play"
  | "pause"
  | "stop"
  | "next"
  | "playPause"
  | "focusSearch";

const KEY_ACTIONS: Record<string, ShortcutAction> = {
  z: "previous",
  x: "play",
  c: "pause",
  v: "stop",
  b: "next",
  " ": "playPause",
};

export interface ShortcutEvent {
  key: string;
  ctrlKey: boolean;
  metaKey: boolean;
  altKey: boolean;
}

export interface FocusContext {
  /** a text field owns the keystroke */
  typing: boolean;
  /** the track list owns letters — its Win98 type-ahead comes first */
  inList: boolean;
}

export function shortcutFor(
  e: ShortcutEvent,
  ctx: FocusContext
): ShortcutAction | null {
  const key = e.key.toLowerCase();
  // the one combo that works everywhere, typing included — it can't be mistaken
  // for text the way a bare letter can
  if ((e.ctrlKey || e.metaKey) && key === "f") return "focusSearch";
  if (e.ctrlKey || e.metaKey || e.altKey || ctx.typing) return null;
  const action = KEY_ACTIONS[key];
  if (!action) return null;
  return ctx.inList && action !== "playPause" ? null : action;
}

export function isTypingTarget(el: Element | null): boolean {
  if (!el) return false;
  if (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT")
    return true;
  const editable = el.getAttribute("contenteditable");
  return editable !== null && editable !== "false";
}
