# Library UX round 2 — queue, keyboard, sorting, drag & drop

Status: spec, ready to implement once the pagination/albums/scoped-search work lands.
Owner approved all eight items 2026-08-14. Builds on `docs/library-ux.md`.

Owner's ruling on sorting: **sort order and play order are the same thing, and that's
fine** — if you sorted the list, playing from it should follow what you see. No
separate "play order" concept.

---

## 1. Queue / "Up Next" source

The biggest remaining gap: once you play from a list, there's no way to see what comes
next. Winamp's playlist editor *was* the queue.

- Pin a `▶ Now Playing` source at the very top of the left pane, above Liked Songs.
- It shows the queue currently in flight, with the playing row marked exactly like the
  track list marks it today (`▶` in the `#` column, bold).
- **Derive it locally, don't poll.** When a play starts we already know the full track
  list and the start index — remember `{ tracks, startIndex, sourceName }` and render
  from there. `GET me/player/queue` only returns ~20 items and would need polling.
- Track the current position by matching `track.uri` against the remembered list, so
  skips from the Winamp transport buttons stay in sync.
- `ponytail:` comment naming the ceiling: the queue is whatever *we* started. If the
  user plays from the Spotify mobile app, our view is stale — we don't own that state.

## 2. Winamp keyboard shortcuts

Authentic and tiny. Global `keydown` listener:

| Key | Action |
|---|---|
| `Z` | previous |
| `X` | play |
| `C` | pause (toggle) |
| `V` | stop |
| `B` | next |
| `Space` | play/pause toggle |
| `Ctrl`/`Cmd` + `F` | focus the search box |

**Must not fire while typing.** Bail if `document.activeElement` is an `input`/
`textarea`, or if a modifier other than the Ctrl+F case is held. The track list's
existing type-ahead takes precedence when the list has focus — letters typed there
still jump to a title; these transport keys are for when focus is elsewhere.

## 3. Persist state across reloads

`localStorage`, no library. Restore on mount:

- last selected source (uri), so a refresh doesn't dump you at nothing selected
- volume

Scroll position is explicitly out — it fights lazy paging and isn't worth the
bookkeeping. Guard all reads: a stale/absent/garbage key must fall back to defaults,
never throw.

## 4. Drag a track onto a playlist to add it

Native HTML5 drag and drop, no library.

- Track rows get `draggable`, carrying the track uri in `dataTransfer`.
- Playlist rows in the left source pane become drop targets (saved albums and the
  pinned sources are not — Liked Songs *is*, and drops there call `setTrackLiked`).
- Hover feedback: the existing `.win-selected` navy bar on the hovered target. No
  custom drag image, no animation.
- On drop: `addToPlaylist`, confirmation into the status bar exactly like the context
  menu path already does.

## 5. Resizable track list

`resize: vertical` + `overflow: auto` on the track list container, with a sensible
`min-height`. Essentially one line, and it replaces the fixed 380px I picked
arbitrarily. Native browser affordance — no drag handle to build.

## 6. Column sorting — SCRATCHED 2026-08-14, remove it

Shipped, then cut the same day. Rip it out entirely: sortable headers, `▲`/`▼`
indicators, and `nextSort` / `sortTracks` (+ their tests). Column headers go back to
static labels.

**Why:** sorting by title or artist can only happen client-side, because the Spotify
Web API offers no sort parameter on any of these endpoints and caps `limit` at 50
(`me/tracks`, `me/playlists`, `me/albums`) or 100 (playlist items). So an honest sort
of a 2431-track liked list means ~49 requests up front, and the cheap alternative —
sorting only the rows paged in so far — is worse than nothing, because the "top" of the
sorted list is really just the top of however far the user happened to scroll, while
looking perfectly correct. Owner's call: not worth either cost.

**Keep `sourcePosition`.** It remaps the context-uri offset by uri, and the *filtered*
case still needs it — only the sorted branch goes away. Removing it wholesale would
reintroduce the bug where searching within a playlist plays the wrong track.

Everything below is the original spec, kept for the record.

### Original spec (no longer to be implemented)

Click a column header to sort by it; click again to reverse; a third click returns to
the source's natural order. `▲`/`▼` indicator in the active header. Win98 listviews
worked exactly this way.

- Sorting reorders the play queue too — **this is intended**, per the owner.
- `#` column keeps showing sequential positions in the *current* order, not the
  original index.
- **Paging interaction — corrected by owner 2026-08-14 after first implementation:**
  sorting must apply to the **whole list, not just the loaded rows.** The first pass
  sorted only what had been paged in, which is actively misleading — the "top" of a
  sorted 2400-track list was really just the top of however far the user had scrolled,
  and it looked correct.

  So: when a sort is applied to a partially-loaded source, force-load the remaining
  pages, then sort the complete set. Yes, that is ~49 requests for a 2400-track liked
  list; the owner has accepted that cost. Requirements:
  - Fetch pages sequentially (or at very low concurrency) — do not fire 49 parallel
    requests at Spotify and eat a 429.
  - Report progress in the status bar (`Loading… 450 of 2431`) rather than freezing.
  - Keep sorting the rows already in hand while the rest stream in, so the list stays
    responsive and converges rather than blocking on a spinner.
  - Reuse the existing `seq` counter so switching source or clearing the sort abandons
    an in-flight full load instead of letting it land late.
  - Once a source is fully loaded, further sorts are instant — no refetch.
- Sort by Title / Artist / Time. `#` header resets to natural order.

## 7. Right-click a playlist in the source pane

Reuse the existing context menu component. Items: `Play`, `Refresh`. Nothing
destructive — no delete, no rename.

## 8. "Search for this artist"

Originally proposed as click-the-artist-name, but that collides with the established
single-click-selects / double-click-plays model on rows — a cell that does a third
thing is exactly the kind of inconsistency this round is meant to remove.

Instead: add `Search for this artist` to the existing **track row context menu**. It
sets the search scope to Spotify, fills the query with the artist name, and selects
the Search Results source. Same outcome, no interaction conflict.

---

## Also, not a feature

**Token refresh: audited 2026-08-14, it works.** Units are consistent (epoch seconds),
the refresh token is persisted, the JWT callback runs on every `/api/auth/session`, and
the SDK's `getOAuthToken` re-fetches per call rather than capturing at construction.
AGENTS.md gotchas 1/2/5 were stale and have been corrected.

One real gap came out of that audit, still to do:

**Surface 401s instead of swallowing them.** `apiGet`/`apiSend` in `spotify-client.ts`
return `null` on any `!res.ok`, and paging turns that into an empty list — so a failed
refresh (revoked grant, Spotify 5xx) renders as an empty library rather than "session
expired". Fix at that shared layer, not per caller: distinguish 401 from other failures
and let the UI say so in the status bar. Related: `SessionProvider` in `providers.tsx`
has no `refetchInterval`, so an already-open tab only notices on window focus.

Low priority, note only: at the 1-hour mark several concurrent `/api/auth/session` calls
can each run `refreshSpotifyToken` independently. Harmless while Spotify doesn't rotate
refresh tokens; if it starts, the last cookie write could persist a superseded one.

## Constraints (unchanged)

- Period-correct Win98/Winamp. No modern UI, no animation, no spinners as decoration.
- Reuse `.win-*` classes and the remapped Tailwind tokens; no hardcoded colours.
- Laziest diff that fully delivers. Deliberate shortcuts get `ponytail:` comments
  naming the ceiling and the upgrade path.
- Preserve what works: single-click selects, double-click plays, arrow nav, type-ahead,
  context menu, `▶` marker, album art, status bar, paging.

## Done when

- `npm test` + `npm run build` pass; `npm run lint` stays at 0 errors / 6 warnings.
- New pure logic (sort comparators, shortcut key mapping, queue position tracking)
  ships with vitest tests. No render-snapshot filler.
- WORKLOG.md and FEATURES.md updated.
