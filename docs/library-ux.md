# Library UX rework — Explorer/Winamp two-pane browser

Status: spec, ready to implement. Owner ask (2026-08-14): "playlist and song selection
is very hard. i don't want it to be modern but i do want a better ux."

## What's wrong today

`src/components/retro-player.tsx` renders two small side-by-side windows ("My Music",
"Search"), each a `max-h-64` list of full-width `<button>` rows printing
`{name} — {artists}` as free-flowing text.

1. **Rows wrap.** A track like _"The Mountain (feat. Dennis Hopper, Ajay Prasanna,
   Anoushka Shankar, …)" — Gorillaz, Dennis Hopper, …_ is 5 lines tall. Four songs
   fill the entire box. This is the single biggest problem.
2. **No columns.** Title and artist are one prose blob; the eye has nothing to scan
   down.
3. **Drill-down destroys context.** Opening a playlist replaces the playlist list;
   getting to another playlist means Back → scroll → find it again.
4. **Half the width is dead.** The Search pane is an empty box until you type.
5. **No selection, no now-playing marker.** You can't tell which row is which, and
   there's no way to move through the list without the mouse.
6. **No duration, no track number** — no secondary cue for finding a known song.
7. **One click = play.** No way to inspect or act on a row you don't want to play.

## The design

One window, Win98 Explorer layout with Winamp Playlist Editor row styling. Width
825px to line up under the Winamp skin.

```
┌ My Music ─────────────────────────────────────────────────[_][□][X]┐
│ Search: [ blur                    ]                    [▶ Play all] │
├──────────────────┬─────────────────────────────────────────────────┤
│ ♥ Liked Songs    │  #  Title              Artist            Time   │  ← column headers
│ 🔍 Search Results├─────────────────────────────────────────────────┤
│ ──────────────── │  1  The Mountain       Gorillaz, Denni…   6:32  │
│ ♪ Chill     (48) │▶ 2  The Shadowy Light  Gorillaz, Asha …   5:24  │  ← now playing
│ ♪ Workout   (91) │  3  Dine N'Dash        The Strokes        2:58  │  ← selected (navy)
│ ♪ 2003     (120) │  4  Sailing            Christopher Cross  4:15  │
│ ♪ …              │                                                 │
├──────────────────┴─────────────────────────────────────────────────┤
│ 47 items                                        Total time 3:12:44 │  ← status bar
└────────────────────────────────────────────────────────────────────┘
```

### Left pane — sources (fixed 190px, own scrollbar, `win-inset`)

- `♥ Liked Songs` and `🔍 Search Results` pinned at top, then a 1px divider, then
  playlists with their track counts.
- `Search Results` only appears once a query has been run.
- Clicking a source loads it into the right pane. The active source gets
  `.win-selected`. **The left pane never gets replaced** — that kills the Back button.

### Right pane — track list

- **Column headers** as beveled Win98 buttons (non-sortable — see Non-goals).
  Grid: `grid-cols-[2.5rem_minmax(0,1fr)_minmax(0,15rem)_4rem]` → # / Title / Artist / Time.
- **One line per row, `truncate` on every cell.** Non-negotiable; this is the fix.
- Row height fixed (~20px), `text-[13px]`, alternating background is *not* period-correct
  for Win98 listviews — keep the plain white `win-inset` ground.
- `#` column shows `▶` instead of the number when that row is the currently playing
  track (compare `t.uri === track?.uri`), and the row goes bold.
- Fixed height ~380px, `overflow-y-auto`.
- Empty states inside the list: `(empty)`, `(no results)`, `Loading…`.

### Interaction

| Input | Behaviour |
|---|---|
| Single click on a row | select (navy bar), do **not** play |
| Double click / Enter | play from that row, rest of the list queued after |
| ↑ / ↓ | move selection, scroll into view |
| Home / End / PgUp / PgDn | move selection |
| Typing letters | type-ahead jump to first title starting with the buffer (Win98 listview behaviour; buffer resets after 800ms idle) |
| Right click on a row | context menu |
| `▶ Play all` | play the source from index 0 |

Single-click-selects is the deliberate change from today's click-to-play: it's what
makes keyboard nav and the context menu coherent, and it matches Explorer.

### Context menu (right click)

Win98 popup: 1px black border, `#d4d0c8` ground, `.win-selected` on hover, closes on
outside click / Escape / scroll. Items:

- `Play`
- `Add to Queue` — omit if the SDK path isn't trivial; don't invent a queue.
- separator
- `♥ Add to Liked Songs` / `Remove from Liked Songs`
- `Add to Playlist  ▸` — submenu of the user's playlists

This is what lets you act on a track you aren't currently playing, which today is
impossible. Once it exists the `Add to playlist…` dropdown in the Now Playing bar is
redundant — delete it, keep Now Playing as a single line of text plus the ♥ toggle.

### Status bar

Bottom strip inside the window, `win-inset`-ish, two fields: `N items` and
`Total time H:MM:SS`. Needs durations (below).

## Code changes

**`src/lib/spotify-client.ts`**
- Add `durationMs: number` to `TrackResult`; map from `duration_ms` in `mapTrackItems`.
  (`SpotifyTrackItem` gains `duration_ms?: number`.) Existing tests will need the field.

**`src/lib/track-list-nav.ts`** (new, pure, unit-tested)
- `formatDuration(ms): string` → `"5:24"`, `"1:02:03"` for hour-plus totals.
- `typeAheadIndex(names: string[], buffer: string, from: number): number` → next index
  whose name starts with `buffer` (case-insensitive), wrapping, `-1` if none.
- `moveSelection(key: string, current: number, length: number, pageSize: number): number`
  → new index for Arrow/Home/End/PageUp/PageDown, or `current` if the key isn't one.

**`src/lib/track-list-nav.test.ts`** (new) — cover wrap-around type-ahead, clamping at
both ends, hour-long durations, empty list.

**`src/components/library-browser.tsx`** (new) — the whole window above. Owns:
sources, selected source, loaded tracks, selected index, type-ahead buffer, context
menu state. Props: `playlists`, `onPlay(uris|contextUri, index)`, `nowPlayingUri`,
plus the like/add callbacks for the context menu.

**`src/components/retro-player.tsx`** — drops the two list windows and the search
input, renders `<LibraryBrowser>`, keeps the player + a slimmed Now Playing bar.
Search state and debounce move into the browser.

**`src/app/globals.css`** — only if a genuinely new primitive is needed
(`.win-menu`, `.win-statusbar`). Reuse `.win-window` / `.win-inset` / `.win-listrow` /
`.win-selected` first; do not add hardcoded colours outside the existing palette.

## Album art — agreed 2026-08-14, second pass

Yes to art, but **one image at a time, never one per row.** Per-row thumbnails push
row height back up and undo the density fix above, cost ~100 image requests, and read
as iTunes-2003 at best — Winamp's playlist editor had no thumbnails at all.

Two placements, both period-correct:

1. **Now Playing bar** — ~64px cover in a `win-inset` bevel, left of the track name.
   Straight WMP 9 / jewel case. Cheap: the Web Playback SDK state already carries
   `current_track.album.images`, so this needs a field added to `PlayerTrack` in
   `src/lib/use-spotify-player.ts`, not a new API call.
2. **Track-pane header** — selected playlist's cover at ~48px beside its name and
   track count. This is Win98 Explorer "Web View", which put a preview graphic in the
   folder panel. Needs `image` on `PlaylistResult` (Spotify's playlist object already
   returns `images[]`; just map it).

Rules: square, hard 2px inset bevel, no rounded corners, no drop shadow, no hover
zoom or transition. Missing art renders as a flat `#808080` box — never a spinner.

Not in the first pass; land the two-pane browser first.

## Non-goals

- **No sorting by column.** Briefly requested and shipped on 2026-08-14, then cut the
  same day and removed. The Spotify Web API has no sort parameter and caps `limit` at
  50–100, so an honest sort means force-loading the entire source (~49 requests for a
  2431-track liked list), and sorting only the paged-in rows looks correct while being
  meaningless. Don't re-propose it without a plan for one of those two costs.
  See `docs/library-ux-round2.md` item 6.
- No drag-and-drop reordering, no playlist editing beyond "add track".
- ~~No paging past the current 50-playlist / 100-track / 50-liked caps.~~
  **Superseded 2026-08-14 (owner feedback):** every list now pages on scroll; the only
  remaining ceiling is the 100-uri Liked Songs play window. See FEATURES.md / WORKLOG.md.
- No virtualization. 100 one-line rows is nothing.
- Nothing modern: no cards, no album art grid, no rounded corners, no animation.

## Done when

- `npm test` and `npm run build` pass.
- `track-list-nav.ts` has tests; the component does not need render tests.
- Driven manually at `http://127.0.0.1:3000`: pick a playlist, arrow down, hit Enter,
  the right song plays and the row shows `▶`; type "sa" and selection jumps to
  "Sailing"; right-click → Add to Playlist adds it.
- `WORKLOG.md` and `FEATURES.md` updated (this closes the "Winamp playlist editor
  window as the track list" roadmap line).
