export function formatClock(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  const mm = String(Math.min(m, 99)).padStart(2, "0");
  const ss = String(s).padStart(2, "0");
  return `${mm}:${ss}`;
}

export function formatMarquee(
  trackNo: number,
  artists: string,
  title: string
): string {
  if (!title && !artists) return "WINAMP 2.9";
  const who = artists ? `${artists} - ` : "";
  return `${trackNo}. ${who}${title}`.toUpperCase();
}
