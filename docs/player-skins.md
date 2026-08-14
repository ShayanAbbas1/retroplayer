# Player skins — swappable player faces

Status: idea, parked. Raised by owner 2026-08-14 ("a vinyl player… in future where we
support different kinds of players, just for fun").

## The seam already exists

No abstraction work is needed before adding a second skin. `useSpotifyPlayer()` in
`src/lib/use-spotify-player.ts` already hides the SDK entirely and returns
`{ status, track, paused, positionMs, durationMs, volume, controls }`, where
`controls` is `{ play, pause, resume, next, previous, seek, setVolume }`.
`src/components/skins/winamp.tsx` takes exactly those as props and knows nothing about
Spotify.

So a skin is just: a component with that prop shape, dropped in `src/components/skins/`.

**Adding one = a new component + a picker.** No plugin registry, no skin manifest, no
dynamic import machinery — a `Record<SkinName, ComponentType<SkinProps>>` map and a
`<select>` (Win98 dropdown) in the player window is the whole thing. Persist the choice
in `localStorage`. Extract the shared `SkinProps` type only when the second skin lands,
not before.

## Skin ideas

- **Vinyl turntable** — spinning record, tonearm that tracks progress across the
  grooves, sleeve art beside the platter. Drag the tonearm to seek. Speed-up/slow-down
  on play/pause. Skeuomorphic-2007 rather than Win98, but that's fine — it sits inside
  a Win98 window, and a skinnable player in 2003 shipped exactly this kind of range.
- **WMP 7/9** — blue-green gradients, oval buttons, the "Now Playing" visualizer pane.
- **iPod** — click wheel, monochrome LCD list. The click wheel would drive the library
  list, so this one couples to the library browser in a way the others don't.

## Constraints that apply to every skin

- **No audio-reactive visualizers.** Spotify's stream is DRM'd — no Web Audio access.
  Everything is simulated from `positionMs` / `paused`. Same as the Winamp skin does
  today. (See AGENTS.md gotcha 4.)
- Position comes from an interpolated anchor, not a real-time audio clock — a vinyl
  rotation angle derived from `positionMs` will be smooth but is not sample-accurate.
- Premium-only, like all playback here.

## Not doing

- A skin *format* (JSON/zip) or support for real Winamp `.wsz` files. Skins are React
  components; that's the whole contract.
- Per-skin settings, themes, or an editor.
