# spotify-playground — Agent Guide

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

1. **No token refresh.** `authOptions.ts` stores the access token in the JWT but never refreshes it; Spotify tokens expire after 1 hour while the session lasts 30 days. Must be fixed before any long-lived playback feature ships.
2. **Playback needs extra scopes.** Current scopes are read-only. The Web Playback SDK requires `streaming` and `user-modify-playback-state` added to the scope string in `authOptions.ts`. Users must re-consent after a scope change.
3. **Web Playback SDK = Premium only.** Free-tier users can't stream in-browser. Degrade gracefully.
4. **Spotify audio is DRM'd** — no Web Audio access to the stream, so visualizers must be simulated, not audio-reactive. The audio-features/audio-analysis endpoints are dead for new apps; don't design around them.
5. `authOptions.ts` has `debug: true` and verbose `console.log` in every callback — Cursor-era leftovers, fine to strip.

## Working conventions

- Update `WORKLOG.md` at the end of every working session: date, what changed, what's next.
- FEATURES.md is the product roadmap; keep it current when scope changes.
- Never commit with AI attribution trailers (no `Co-Authored-By: Claude`).
- Owner's quality bar for UI: "looks like the real thing." For the retro skins this means pixel-faithful recreations, not vibes-based approximations.
