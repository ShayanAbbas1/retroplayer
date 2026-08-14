// UI state that survives a reload. Every read is guarded: an absent, stale or
// malformed value falls back to the caller's default rather than throwing, and
// storage being unavailable at all (private mode, disabled, SSR) is not an error.

export const SOURCE_KEY = "retro.source";
export const VOLUME_KEY = "retro.volume";

export interface StoredSource {
  uri: string;
  name: string;
}

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // persistence is a nicety — a full or blocked store must never break a click
  }
}

export function parseSource(raw: string | null): StoredSource | null {
  if (!raw) return null;
  try {
    const v = JSON.parse(raw);
    return typeof v?.uri === "string" && v.uri && typeof v?.name === "string"
      ? { uri: v.uri, name: v.name }
      : null;
  } catch {
    return null;
  }
}

export function parseVolume(raw: string | null, fallback: number): number {
  if (raw === null || raw.trim() === "") return fallback;
  const v = Number(raw);
  return Number.isFinite(v) && v >= 0 && v <= 1 ? v : fallback;
}
