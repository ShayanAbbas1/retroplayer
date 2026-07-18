# Worklog

Newest first. One entry per working session: what changed, what's next.

## 2026-07-19 (late) — cleanup + playback/search fixes

- **Playback no longer stops when switching dashboard tabs**: RetroPlayer stays mounted (hidden via CSS) — unmounting disconnected the Web Playback SDK device. Note: navigating to a different *route* (e.g. standalone /streaming-insights) still kills audio; acceptable since all authed surfaces are dashboard tabs.
- **Search is live now**: debounced 300ms search-as-you-type, stale responses discarded; Search button removed.
- Log cleanup: all `console.log`s stripped (login, dashboard, streaming-data-service — the last also lost an always-empty `if` block); `console.error` at catch boundaries kept. Login's pointless manual OAuth `state` param removed (NextAuth handles state itself) — re-verify login.
- Dashboard refactor: nine parallel top-artists/tracks/albums states collapsed into one `Record<TimeRange, TopData>`.
- 24 tests + build green; lint = 1 pre-existing error (MusicTasteAnalyzer, parked feature) + 7 pre-existing `<img>` warnings.

## 2026-07-19 (evening) — PIVOT: time machine → retro Spotify client, Win98 theme, full player

Owner redirected mid-session, three times, in order:
1. "Remove the timemachine completely; player on the main screen after login."
2. "Whole app retro-themed like a 2000s app; green/black and rounded corners are not retro."
3. "Full Spotify experience: like songs, add to playlist, browse playlists."

**Done (24 tests + build green; lint = 1 pre-existing error only):**
- Deleted `/timemachine` route + `skin.ts`; player now lives on `/dashboard` as the default "Player" tab (`src/components/retro-player.tsx`).
- Win98/2000 theme across the whole app, done centrally in `globals.css`: stock Tailwind tokens remapped (teal desktop, silver chrome, navy selection, black text — `text-white` literally renders black), Tahoma stack, square corners, beveled `button`/`input` base styles, `.win-window/.win-titlebar/.win-inset/.win-listrow/.win-selected` helpers. Login = Win98 dialog; dashboard = window with titlebar (Sign Out lives there); streaming-insights wrapped in a window. Active tab/toggle states across components swapped to `.win-selected`. Winamp skin untouched (its CSS module wins over the base layer).
- Player features: playlists listbox (open → play all or play from a clicked track via context+offset), Liked Songs (first 50), search (click result plays it with the remaining results queued), Now Playing bar with like/unlike (checks `/me/tracks/contains`) and add-to-playlist (select + Add).
- `src/lib/spotify-client.ts` (replaces search-tracks.ts): searchTracks, getMyPlaylists, getLikedTracks, getPlaylistTracks, isTrackLiked, setTrackLiked, addToPlaylist, uriId. Pure mappers unit-tested. `buildPlayBody` now takes an offset (uris or context).
- **Scopes changed** in authOptions.ts (+`user-library-modify playlist-read-private playlist-modify-public playlist-modify-private`) — everyone must re-login/re-consent.
- Verified visually via headless Chrome: login dialog, streaming-insights window, winamp preview. Dashboard/player needs a real Premium login to verify — owner to do.

**Next:** owner end-to-end test (login → play/like/add), commit the tree, then FEATURES.md "Later" list (XP tabs, WMP/iPod skins, paging).

## 2026-07-19 (later still) — Winamp verified, era sourcing CUT, search added

- Picked up from handoff note below. Winamp skin was complete; verified visually via headless Chrome screenshot of `/winamp-preview` (dev server + `Google Chrome --headless=new --screenshot` — no chromium-cli/playwright on this machine). Renders correctly: titlebar, clock, simulated spectrum, marquee, sliders, transport.
- **Scope change (owner, mid-session): era music sourcing is cut.** "Just let users find a song and play in the player they like." Deleted `src/lib/era.ts` + `era.test.ts` + the `era-contract.ts` stub and the auto-queue effect in `/timemachine`. FEATURES.md updated (moved to Icebox).
- Replaced with minimal track search: `src/lib/search-tracks.ts` (`searchTracks` raw-fetch + pure `mapTrackItems`, unit-tested) and a search box + results list on `/timemachine`; clicking a result calls `controls.play([uri])`.
- Fixed the 2 new lint errors in `winamp.tsx` (ref write during render → effect re-runs on `paused`; setState-in-effect → blink gated in render). Remaining lint: 1 pre-existing error (MusicTasteAnalyzer) + 7 pre-existing warnings, documented in the 2026-07-19 entry.
- Verified: `npm test` 22 passing, `npm run build` clean.
- **Still open:** (1) end-to-end browser test with a real Premium login at http://127.0.0.1:3000/timemachine — search → click → hear audio; owner must do this. (2) NOTHING IS COMMITTED — owner wants to review/commit. (3) Skin fidelity: recognizable Winamp 2.x but not yet pixel-faithful to the classic base skin (titlebar segments, exact palette); raise with owner against the "looks like the real thing" bar. (4) Later: WMP/iPod skins, era-themed year picker.

## 2026-07-19 (later) — Time Machine v1 build, HANDOFF NOTE

Session ended near usage limit mid-build; next agent (possibly on a different account) picks up from here. State:

**Done and verified (tests + build green at time of completion):**
- Test harness: Vitest + RTL, `npm test`, tests colocated `src/**/*.test.ts(x)`. AGENTS.md defines the testing bar.
- Auth: token refresh implemented in `src/lib/auth.ts` (`isExpired`, `refreshSpotifyToken`) + `authOptions.ts` jwt/session callbacks; `session.accessToken` and `session.error` ("RefreshTokenError" → force re-login) exposed. IMPORTANT root-cause fix: `route.ts` previously did NOT use `authOptions.ts` (had its own inline duplicate config); it now imports the real one. Scopes now include `streaming user-modify-playback-state user-library-read`.
- Playback core: `src/lib/use-spotify-player.ts` — SDK loader, fresh-token `getOAuthToken` (fetches /api/auth/session per call), track state mapping, local position interpolation, `controls.{play,pause,resume,next,previous,seek,setVolume}`, status: loading/ready/premium_required/auth_error. Pure helpers `interpolatePosition` + `buildPlayBody` are unit-tested.
- `/timemachine` route: `src/app/timemachine/page.tsx` — session-gated, year picker 1970–present, bare functional player UI (meant to be replaced by skins).
- Era sourcing: `src/lib/era.ts` — `findEraPlaylist` (search API, pure ranking heuristic `pickBestPlaylist`), `getLikedTracksFromYear` (pages /me/tracks, caps 200 collected/1000 scanned), `getEraContext` (playlist → liked-tracks → empty fallback). Fully unit-tested.

**In flight at handoff — CHECK BEFORE CONTINUING:**
- A subagent was building `src/components/skins/winamp.tsx`: pixel-faithful Winamp 2.x main window (275×116 grid ×3 scale, hand-built CSS/SVG, no ripped bitmaps), wired to `useSpotifyPlayer`, mounted from page.tsx via a `skinForYear` mapping. If that file exists, it may be complete or partial — run `npm test` + `npm run build`, read it, and judge; if absent, that task restarts from the FEATURES.md description.

**Immediate next steps in order:**
1. Verify/complete the Winamp skin (visual bar: "looks like the real thing" — review in browser at http://127.0.0.1:3000/timemachine).
2. Wire the real era source: `src/app/timemachine/page.tsx` calls the STUB `getEraContext` from `src/lib/era-contract.ts` — make the stub delegate to (or replace imports with) the real `getEraContext` in `src/lib/era.ts`.
3. Full verify: `npm test`, `npm run build`, then login + play a year end-to-end in the browser (needs Spotify Premium + the 127.0.0.1 redirect URI registered — owner confirmed login works).
4. NOTHING IS COMMITTED YET — entire tree (docs, dep upgrades, all features) is uncommitted; owner wants to review/commit. Never add AI attribution to commits.
5. Later per FEATURES.md: WMP + iPod skins, era-themed year picker, quota extension request.

## 2026-07-19 — Project revival, AI-dev setup

- Cloned repo onto new machine (original dev was 2025, handwritten + Cursor).
- Decided direction: **Retro Music Time Machine** (see FEATURES.md) — year picker morphs UI into era player (Winamp/WMP/iPod) and queues era music via Web Playback SDK. Reuses existing NextAuth setup.
- Added AGENTS.md / CLAUDE.md / FEATURES.md / WORKLOG.md for agent-driven development.
- Dependency refresh: removed deprecated `@types/next-auth` stub (was pulling in typeorm with critical SQL-injection CVEs) and `@types/jszip`; upgraded to Next 16.2 / React 19.2 / Tailwind 4.3 / recharts 3 / nivo 0.99; eslint stays on 9.x (config-next 16 doesn't support eslint 10 yet); `next lint` removed in Next 16 → lint script now calls `eslint .` with native flat configs. Audit: 21 vulns → 4 moderate, all from next-auth v4's internal `uuid`; accepted until a next-auth v5 migration is warranted.
- Known pre-existing lint issues surfaced by stricter rules: 1 error (`react-hooks/set-state-in-effect` in MusicTasteAnalyzer.tsx:167) + 10 warnings (`<img>` vs next/image, unused import). Fix when touching those files.
- Next: token refresh in auth, playback scopes, `/timemachine` route skeleton.
- Env recovered from Vercel dashboard into `.env.local`; app boots at http://127.0.0.1:3000, login page verified. Full OAuth still needs the 127.0.0.1 redirect URI added in the Spotify dev dashboard.
- Removed `typescript.ignoreBuildErrors` + dead `eslint` key from next.config.ts. That flag was hiding 5 type errors, all in dead code: ArtistItem/TrackItem/AlbumItem (imported by nothing, called a nonexistent `openPopup`) and youtube-music.ts (imported an uninstalled package) — deleted all four. `npx tsc --noEmit` now clean; builds are strict again.
- Killed the ngrok workflow: Spotify allows plain-HTTP loopback redirect URIs (`http://127.0.0.1:3000/...`) — only `localhost` is banned. `.env.local` template created with fresh `NEXTAUTH_SECRET`; Spotify client id/secret still needed (pull from Vercel: CLI installed, needs `vercel login`) and the 127.0.0.1 redirect URI must be added in the Spotify dev dashboard.
