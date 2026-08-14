# retroplayer — Agent Guide

Personal Spotify stats dashboard, now evolving into a **retro (Win98-styled) Spotify client** (see FEATURES.md). Owner: Shayan (hobby project, solo dev, AI-assisted). Originally handwritten + Cursor-assisted in 2025; from July 2026 onward development is agent-driven.

## Stack

- Next.js 15 (App Router, Turbopack) + React 19 + TypeScript
- Tailwind CSS 4
- NextAuth 4 with Spotify provider (JWT sessions) — `src/app/api/auth/[...nextauth]/authOptions.ts`
- `spotify-web-api-node` for API calls — wrapper in `src/lib/spotify.ts`
- Charts: recharts + @nivo/heatmap; `jszip` parses uploaded Spotify data exports

## Commands

```bash
npm run dev      # dev server (turbopack) — open http://127.0.0.1:3000, NOT localhost
npm run build    # production build
npm run lint
npm test         # vitest run — unit tests colocated as src/**/*.test.ts(x)
```

**Definition of done for any change:** `npm test` + `npm run build` pass, and non-trivial logic ships with a test. Test what can break (token refresh, year→playlist mapping, data parsing) — don't write render-snapshot filler. Browser-only surfaces (Web Playback SDK, OAuth redirects) are exempt from unit tests; verify those by driving the flow at 127.0.0.1.

## Environment

`.env.local` (not in git; a commented template with a generated `NEXTAUTH_SECRET` exists locally):

- `NEXT_PUBLIC_SPOTIFY_CLIENT_ID` / `NEXT_SPOTIFY_CLIENT_SECRET` — from the Spotify developer dashboard (also stored in the Vercel project: `vercel env pull`)
- `NEXTAUTH_SECRET`, `NEXTAUTH_URL`

**Local OAuth without ngrok:** Spotify bans `localhost` redirect URIs but allows loopback IPs over plain HTTP. So: `NEXTAUTH_URL=http://127.0.0.1:3000`, register `http://127.0.0.1:3000/api/auth/callback/spotify` as a redirect URI in the Spotify dashboard, and always open the app at `http://127.0.0.1:3000` — never `localhost:3000`, or the OAuth cookies won't match. `127.0.0.1` is a secure context in browsers, so the Web Playback SDK's DRM also works locally. No tunnels, no certs.

Spotify app is in **development mode**: max 25 allowlisted users, added manually in the dashboard. Quota extension will be requested once the product is worth sharing.

## Layout

- `src/app/` — routes: `/login`, `/dashboard` (player + top artists/tracks/albums + streaming insights tabs), `/streaming-insights` (upload Spotify data export → heatmaps/trends), `/winamp-preview` (dev-only skin preview, no auth)
- Theming: the whole app is Win98-styled via `globals.css` — stock Tailwind color tokens are remapped there (gray-800 = window chrome, gray-900 = desktop teal, text-white renders black, greens = navy) and `.win-window`/`.win-titlebar`/`.win-inset`/`.win-listrow`/`.win-selected` provide the chrome. Don't fight it with new hardcoded colors.
- `src/components/` — flat component dir, PascalCase for older components, kebab-case for newer ones (pick kebab-case for new files)
- `src/lib/spotify.ts` — Spotify API helper; add new API calls here, not inline in components
- `src/contexts/` — React contexts (popup, streaming data)
- `src/types/` — shared TS types

## Known gotchas (read before touching auth/playback)

1. **Token refresh works — don't re-implement it.** (Verified end to end 2026-08-14; this
   entry previously claimed the opposite and was wrong.) The JWT callback in
   `authOptions.ts` calls `isExpired` / `refreshSpotifyToken` from `src/lib/auth.ts`.
   `expires_at` is absolute **epoch seconds** and is handled in consistent units
   throughout. Every `GET /api/auth/session` re-runs the callback and re-sets the cookie,
   so each `getToken()` is a live refresh opportunity. On failure, `token.error` →
   `session.error` → `retro-player.tsx` re-triggers `signIn`.
2. **Playback scopes are already granted.** The `authorization` block in `authOptions.ts`
   overrides the provider default and includes `streaming`, `user-modify-playback-state`,
   `user-library-modify` and the playlist-modify scopes. (Spotify's auth-code flow always
   returns a `refresh_token`; `access_type=offline` is a Google-ism and is not needed.)
   Users must still re-consent whenever the scope string changes.
3. **The SDK re-fetches its token per call.** `getOAuthToken` in `use-spotify-player.ts`
   invokes `fetchAccessToken()` on every SDK request rather than capturing one at
   construction — this is why playback survives the 1-hour mark. Don't "optimize" it into
   a captured variable.
4. **Web Playback SDK = Premium only.** Free-tier users can't stream in-browser. Degrade gracefully.
5. **Spotify audio is DRM'd** — no Web Audio access to the stream, so visualizers must be simulated, not audio-reactive. The audio-features/audio-analysis endpoints are dead for new apps; don't design around them.
6. **List failures surface, single-value ones don't.** (Fixed 2026-08-14; this entry used to
   describe the gap.) Every read in `spotify-client.ts` goes through a private `request()`
   that returns `{ data, error }` — `error: "auth"` for a 401, `"failed"` otherwise — and
   `Page<T>` carries it up to the library browser's status bar, so a dead session no longer
   renders as an empty library. `isTrackLiked` and the `apiSend` write paths still collapse
   failure into a falsy answer on purpose (marked `ponytail:`); if you add a read that
   renders a list, propagate `error` like the others do. `SessionProvider` re-fetches every
   300s (`providers.tsx`), which is also what re-runs the token refresh on an idle tab.

## Working conventions

- Update `WORKLOG.md` at the end of every working session: date, what changed, what's next.
- FEATURES.md is the product roadmap; keep it current when scope changes.
- Never commit with AI attribution trailers (no `Co-Authored-By: Claude`).
- Owner's quality bar for UI: "looks like the real thing." For the retro skins this means pixel-faithful recreations, not vibes-based approximations.
