# KALA Living Observatory — A Player Synced to the Real Sky

A Video.js v10 skin that behaves like an observatory: its theme follows the
viewer's local time of day, the moon on the seek bar shows tonight's actual
phase, and its chapters are the constellations genuinely up tonight — all
computed on the viewer's own device, with no network calls and no location
request. Built for the
[Contra Video.js Skins Design Challenge](https://contra.com/community/topic/videojsskinschallenge).

**Live demo:** https://andipangeranm142.github.io/kala-living-sky/
**Player-only view:** https://andipangeranm142.github.io/kala-living-sky/preview.html

## The concept

*Kala* is Sanskrit & Indonesian for "time". Most players are neutral chrome;
Kala picks a niche — the night-sky film — and commits to it, so every detail
has a reason to exist. The living version makes the name functional: the
player keeps time through the sky.

- **A living sky (Auto, the default)** — the theme follows the viewer's local
  hour through four palettes: dawn (05–07), day (07–17), dusk (17–19), night
  (19–05), with a soft crossfade of the accent and glow colors. The three
  manual skies (Midnight, Aurora, Ember) stay one click away.
- **Tonight's real moon** — the seek-bar thumb is drawn from the computed
  lunar phase (synodic month 29.530588853 days, anchored on the new moon of
  6 January 2000, 18:14 UTC). The panel reports the phase name, illumination
  %, and the moon's age in days.
- **Tonight's real constellations** — the four chapter cues are named after
  the constellations climbing highest tonight, picked by real altitude math
  (local sidereal time, default position Jakarta, Indonesia). Crux — the
  Southern Cross — is always included when it clears the horizon tonight.
- **Tonight's sky panel** — the moon button in the top bar opens the moon's
  phase, estimated moonrise/moonset, the live sky + local time, and the four
  featured constellations with rise/set status. Rise and set times are
  labelled estimates, because they are approximations.
- **The Night Arc** — the timeline is a horizon line: an aurora gradient
  fill, a buffered shimmer, and twinkling **chapter stars** at every chapter
  boundary. Hovering shows a live storyboard thumbnail, time, and chapter
  name.
- **The Eclipse** — the big play button is a glowing ring with a breathing
  halo while paused, flanked by ±10s seek buttons.
- **A floating glass console** — backdrop blur, Fraunces serif title block
  with a live chapter line, a custom 18×18 "kala" SVG icon set, and an inline
  volume slider that unfurls from the mute button.
- **Full settings menu** — Quality (live HLS renditions), audio tracks,
  playback speed, and captions, with keyboard-navigable submenus.
- **Keyboard field guide** — press `?` for the shortcut map; 20+ shortcuts
  (play, seek, **frame step** `,`/`.`, volume, fullscreen, PiP, captions,
  speed, jump-to-percentage).
- **Ambient glow** — the showcase page wraps the player in a blurred,
  light-reactive halo (toggleable).

## Accessibility

- Keyboard-operable everything, with a visible amber focus ring (dark halo so
  it reads on bright and dark frames alike).
- ARIA labels on every control, sliders exposing their values, and a live
  region announcing play, pause, seek, volume, and fullscreen changes.
- Dialogs that behave: the Tonight's sky panel and the keyboard guide open
  from labelled buttons, close with `Esc`, and return focus to their trigger.
- 44px touch targets, a tall seek hit-area, double-tap gestures.
- Tested against two videos — dark (*Cosmic Dawn*) and bright (*Daylight*,
  Earth from the ISS) — so the controls hold contrast over both.
- `prefers-reduced-motion`, high-contrast, and forced-colors support.

## Develop

```sh
npm run dev
```

Opens the showcase page. The workbench (the scaffold's preview shell) lives
at `/workbench.html`, and the player alone at `/preview.html`
(`#width=1360` sets the player width).

```sh
npm run typecheck   # tsc --noEmit
npm run build       # vite build -> dist/
node tools/test-sky.mjs   # astronomy sanity checks (moon phase vs USNO dates)
```

Debug overrides for testing and demo recording (off by default):
`?time=HH:MM` and `?date=YYYY-MM-DD` set the clock the living sky runs on —
e.g. `preview.html?time=06:30` shows the dawn palette, `?date=2026-11-24`
shows the full Beaver Moon.

`tools/` holds the Playwright verification scripts (they need the proxy
forwarder recipe — Chromium cannot use the sandbox egress proxy directly):

```sh
node tools/check.cjs http://localhost:4173 /tmp/kala-check            # player checks
node tools/check-showcase.cjs http://localhost:4173 /tmp/kala-showcase  # page checks
node tools/record-demo.cjs http://localhost:4173 /tmp/kala-media       # demo video + shots
```

## Where things live

- `src/` — the skin, and only the skin.
  - `src/video/skin.html` — the skin's markup (player structure + dialogs).
  - `src/video/skin.css` — all skin styling (~2,500 lines, layered).
  - `src/video/skin.ts` — skin setup + the Kala enhancements (keyboard
    dialog, live chapter label, living sky, moon thumb, sky panel,
    frame step).
  - `src/video/sky.ts` — **the living sky**: moon phase, moonrise/moonset,
    constellation altitudes, time-of-day themes, debug clock. Pure
    functions, no DOM — tested by `tools/test-sky.mjs`.
  - `src/video/icons.ts` — the custom "kala" SVG icon family.
  - `src/styles/` — theme tokens, the three manual skies, and the four
    living skies.
- `apps/preview/` — the demo site.
  - `index.html` + `src/showcase/` — the showcase page.
  - `preview.html` + `src/frame/` — the player-only page.
  - `workbench.html` + `src/shell/` — the scaffold workbench (dev tool).
  - `src/media-config.ts` — **every video source lives here** (one file).
  - `src/frame/player.ts` — builds tonight's chapters track (WebVTT blob)
    from the constellations up tonight.
  - `public/footage/` — the Daylight MP4, posters, and fallback chapters.
- `assets/submission/` — screenshots (1600×1200) + the demo video for the
  challenge form.
- `DESCRIPTION.md` — the design-thinking text for the submission form.

## Video sources

- **Daylight — Earth from Space, Expedition 65** (default, via Mux): NASA,
  public domain, cut from the Expedition 65 4K film. Streamed from our own
  Mux asset "daylight-earth-living" (playback ID
  `kcQpP01h01aVPjB7IA01kZHw5vvE5gMK1pX7fgF7C4rmBw`) — a separate upload from
  entry 1's asset, so each entry streams its own Mux video.
- **Cosmic Dawn — The Voyage to Webb**: NASA archival footage, streamed from
  Mux via the public playback ID the Video.js scaffold ships
  (`83EzHOvVzVN01AsrD01BCpiH02Pj3S8mfzBOu101w2nHC5s`). HLS renditions,
  auto captions.
- **Daylight (MP4)**: the same NASA clip as a progressive MP4 from
  `public/footage/`.

## License

Apache 2.0 — see [LICENSE](LICENSE). Video.js is a registered trademark of
Brightcove Inc.; this skin is an independent entry and is not affiliated with
or endorsed by Video.js, Contra, or Mux.
