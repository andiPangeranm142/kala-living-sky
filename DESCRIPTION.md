# KALA Living Observatory — Submission description (ENTRY 2)

## Post text for the Contra form (copy verbatim)

> KALA Living Observatory — a Video.js v10 skin synced to the real sky. Kala is Sanskrit and Indonesian for "time", so this player keeps time through the sky: its theme follows your local hour through dawn, day, dusk, and night; the moon on the seek bar shows tonight's actual phase, drawn from the computed lunar cycle; and the chapters are the constellations genuinely up tonight, including Crux, the Southern Cross. The moon button opens Tonight's sky: the moon's phase and illumination, estimated moonrise and moonset, and the four constellations climbing highest tonight. All of it is computed on your device, with no network calls and no location request. The Night Arc seek bar, the Eclipse play button, the floating glass console, and the full keyboard guide with frame-step keys complete an instrument built for slow cinema, space documentaries, and night-sky films. Live demo: https://andipangeranm142.github.io/kala-living-sky/
>
> #videojsskinschallenge

> PENTING: Contra TIDAK me-render markdown — teks di atas harus POLOS, tanpa `**`, `*`, atau backtick. (Entri 1 sempat bermasalah karena teks bermarkdown tampil mentah di postingan.)

## Design thinking (longer version, if the form allows more)

Most players are neutral chrome. Kala picks a niche — the night-sky film — and commits to it, so every detail has a reason to exist. The living version makes the name functional: an observatory is a place that measures the night, so this player measures it too. The timeline is a horizon line because an observatory measures the night by it; chapters are stars because they are the moments worth navigating by — and here they are tonight's real constellations, picked by altitude math from local sidereal time, so no two nights show the same player. Progress is an aurora because the videos this player is for end with one. The moon thumb shows tonight's actual phase (synodic month 29.530588853 days, anchored on the new moon of 6 January 2000), and the Tonight's sky panel reports phase, illumination, and estimated moonrise and moonset — labelled estimates, because they are approximations, and everything runs locally with no location request. The type system pairs Fraunces (a display serif for the title) with Inter and IBM Plex Mono (for time and chapter labels), and the custom 18x18 "kala" icon set keeps every glyph on the same grid. Nothing is decoration for its own sake: the hover card on the seek bar shows a live storyboard thumbnail, time, and chapter; the volume slider unfurls from the mute button; the settings menu carries real HLS quality levels, audio tracks, speed, and captions; and the keyboard guide documents 20+ shortcuts that all actually work, including frame step (, and .) for studying a shot. Accessibility was designed in, not bolted on: 44px touch targets, an amber focus ring with a dark halo that reads on any frame, ARIA labels and live announcements, dialogs that close with Esc and return focus, and full prefers-reduced-motion, high-contrast, and forced-colors support. The skin was tested against two videos — dark (Cosmic Dawn) and bright (Daylight, Earth from the ISS) — to prove the controls hold contrast over both.

## Submission facts

- **Live demo (Project URL + Live-site URL):** https://andipangeranm142.github.io/kala-living-sky/
- **Player-only view:** https://andipangeranm142.github.io/kala-living-sky/preview.html
- **Repository:** https://github.com/andiPangeranm142/kala-living-sky
- **Mux playback ID:** `kcQpP01h01aVPjB7IA01kZHw5vvE5gMK1pX7fgF7C4rmBw` (asset "daylight-earth-living", public, Ready — akun Mux Free ndiipangeran454@gmail.com, environment KALA; aset TERPISAH dari entri 1)
- **License:** Apache 2.0 (ownership stays with the participant)
- **Media:** `assets/submission/` — screenshots (1600x1200) + demo video
- **Debug (untuk demo/juri):** `?time=HH:MM` dan `?date=YYYY-MM-DD` mengubah jam/tanggal yang dipakai living sky — mis. `preview.html?time=06:30` menampilkan palet fajar, `?date=2026-11-24` menampilkan full moon. Default mati.
