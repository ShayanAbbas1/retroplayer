# Features & Roadmap

## Shipped (2025 era)

- Spotify OAuth login (NextAuth, JWT sessions)
- Dashboard: top artists / tracks / albums with time-range filter, details popups
- Music taste analyzer
- Streaming insights: upload full Spotify data export (zip) → listening heatmap, trends graphs

## In progress: Retro Spotify Player

**Concept (pivoted 2026-07-19, replacing the "time machine" year-picker idea — owner wasn't vibing with it):** a full Spotify client that looks and feels like a 2000s desktop app. Win98/2000 chrome everywhere — teal desktop, silver beveled windows, navy title bars, Tahoma — with a pixel-faithful Winamp 2.x player at the center.

**Shipped so far:**
- Whole-app Win98 theme (globals.css token remap + `.win-*` chrome classes)
- Player tab on the dashboard (default tab): Winamp skin + Web Playback SDK
- Library: browse playlists, open one, play all / play from a track; Liked Songs (first 50)
- Search → click plays with the rest of the results queued after
- Now Playing actions: like/unlike, add current track to a playlist

**Constraints:** Premium-only (Web Playback SDK), simulated visualizers (DRM, no audio access), 25-user cap until Spotify grants quota extension.

### Later

- More retro chrome: XP-style tabs, Winamp playlist editor window as the track list
- WMP / iPod skins as alternative player faces
- Playlist paging past 100 tracks, liked songs past 50
- Spotify quota extension request once it feels good

## Icebox / rejected

- Era music sourcing (year → "Top Hits of YYYY" playlist + liked-songs-by-year) — built, then cut 2026-07-19: extra complexity for no reason; users search for what they want. (The code was deleted before ever being committed — a rebuild starts from the description above if ever revived.)
- Self-scrobbling pipeline (cron polling recently-played into a DB) — solves the "re-upload your export" friction of streaming insights, but personal-use only; parked in favor of the time machine.
- Anything requiring audio-features/recommendations endpoints — dead for new Spotify apps.
