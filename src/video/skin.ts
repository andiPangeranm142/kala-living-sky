import '../styles/video/kala.css';
import './skin.css';
import './icons';
import '@videojs/html/i18n';
import '@videojs/html/ui/container';
import '@videojs/html/ui/poster';
import '@videojs/html/ui/error-dialog';
import '@videojs/html/ui/dialog-backdrop';
import '@videojs/html/ui/dialog-popup';
import '@videojs/html/ui/dialog-title';
import '@videojs/html/ui/dialog-description';
import '@videojs/html/ui/dialog-close';
import '@videojs/html/ui/controls';
import '@videojs/html/ui/controls-backdrop';
import '@videojs/html/ui/controls-group';
import '@videojs/html/ui/buffering-indicator';
import '@videojs/html/ui/controls-content';
import '@videojs/html/ui/tooltip-group';
import '@videojs/html/ui/title';
import '@videojs/html/ui/airplay-button';
import '@videojs/html/ui/tooltip';
import '@videojs/html/ui/tooltip-label';
import '@videojs/html/ui/tooltip-shortcut';
import '@videojs/html/ui/cast-button';
import '@videojs/html/ui/pip-button';
import '@videojs/html/ui/fullscreen-button';
import '@videojs/html/ui/seek-button';
import '@videojs/html/ui/play-button';
import '@videojs/html/ui/time-slider';
import '@videojs/html/ui/time-slider-chapters';
import '@videojs/html/ui/slider-track';
import '@videojs/html/ui/slider-buffer';
import '@videojs/html/ui/slider-fill';
import '@videojs/html/ui/slider-thumb';
import '@videojs/html/ui/slider-preview';
import '@videojs/html/ui/slider-thumbnail';
import '@videojs/html/ui/slider-value';
import '@videojs/html/ui/time-slider-chapter-title';
import '@videojs/html/ui/mute-button';
import '@videojs/html/ui/volume-slider';
import '@videojs/html/ui/time-group';
import '@videojs/html/ui/time';
import '@videojs/html/ui/time-separator';
import '@videojs/html/ui/captions-button';
import '@videojs/html/ui/menu';
import '@videojs/html/ui/menu-content';
import '@videojs/html/ui/menu-item';
import '@videojs/html/ui/menu-separator';
import '@videojs/html/ui/quality-radio-group';
import '@videojs/html/ui/menu-radio-item';
import '@videojs/html/ui/menu-item-indicator';
import '@videojs/html/ui/audio-track-radio-group';
import '@videojs/html/ui/playback-rate-radio-group';
import '@videojs/html/ui/captions-radio-group';
import '@videojs/html/ui/hotkey';
import '@videojs/html/ui/gesture';
import '@videojs/html/ui/status-announcer';
import '@videojs/html/ui/volume-indicator';
import '@videojs/html/ui/volume-indicator-fill';
import '@videojs/html/ui/volume-indicator-value';
import '@videojs/html/ui/status-indicator';
import '@videojs/html/ui/status-indicator-value';
import '@videojs/html/ui/seek-indicator';
import '@videojs/html/ui/seek-indicator-value';

import {
  formatClock,
  getSkyNow,
  moonPhase,
  moonSvg,
  moonTimes,
  SKY_LABELS,
  skyForTime,
  tonightConstellations,
  type SkyMode,
} from './sky';

/**
 * Kala-only behaviour, wired per player instance (call after the skin markup
 * is in the DOM): the keyboard-shortcuts dialog, the live chapter line under
 * the title, the living sky (auto theme + real moon thumb + tonight's-sky
 * panel), and frame-step keys. Everything else is declarative Video.js
 * components.
 */
export function enhanceKalaPlayer(player: HTMLElement, chaptersUrl?: string): void {
  const container = player.querySelector('media-container');
  if (!container) return;
  wireKeyboardDialog(container as HTMLElement);
  wireChapterLabel(container as HTMLElement, chaptersUrl);
  wireLivingSky(container as HTMLElement);
  wireMoonThumb(container as HTMLElement);
  wireSkyPanel(container as HTMLElement);
  wireFrameStep(container as HTMLElement);
}

/** The real <video> behind a media element (mux-video wraps one in shadow DOM). */
function underlyingVideo(media: Element | null): HTMLVideoElement | null {
  if (!media) return null;
  if (media.tagName === 'VIDEO') return media as HTMLVideoElement;
  return (media as HTMLElement).shadowRoot?.querySelector('video') ?? null;
}

let dialogUid = 0;

function wireKeyboardDialog(container: HTMLElement): void {
  const dialog = container.querySelector('.kala-kbd-dialog') as HTMLElement | null;
  const trigger = container.querySelector('.kala-keyboard-button') as HTMLElement | null;
  const closeBtn = container.querySelector('[data-kala-kbd-close]') as HTMLElement | null;
  if (!dialog || !trigger || !closeBtn) return;

  // Unique ids per player instance — a page can host several players, and
  // aria-labelledby / aria-controls resolve document-wide.
  const uid = ++dialogUid;
  dialog.id = `kala-kbd-dialog-${uid}`;
  const title = dialog.querySelector('.kala-kbd-title');
  if (title) {
    title.id = `kala-kbd-title-${uid}`;
    dialog.setAttribute('aria-labelledby', title.id);
  }
  trigger.setAttribute('aria-controls', dialog.id);

  const hotkeys = Array.from(container.querySelectorAll('media-hotkey'));
  let lastFocus: HTMLElement | null = null;

  const open = (): void => {
    lastFocus = document.activeElement as HTMLElement | null;
    // While the guide is open, player hotkeys stay out of the way.
    hotkeys.forEach((h) => h.setAttribute('disabled', ''));
    dialog.removeAttribute('hidden');
    closeBtn.focus();
  };

  const close = (): void => {
    dialog.setAttribute('hidden', '');
    hotkeys.forEach((h) => h.removeAttribute('disabled'));
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  };

  trigger.addEventListener('click', open);
  closeBtn.addEventListener('click', close);
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close();
  });
  container.addEventListener('keydown', (event) => {
    if (event.key === '?' && !event.metaKey && !event.ctrlKey && !event.altKey) {
      event.preventDefault();
      if (dialog.hasAttribute('hidden')) open();
      else close();
    } else if (event.key === 'Escape' && !dialog.hasAttribute('hidden')) {
      event.preventDefault();
      close();
    }
  });
}

/**
 * Frame step, YouTube-style: `,` / `.` pause the video and move exactly one
 * frame (1/30s). Implemented here — not as a <media-hotkey> seekStep — so the
 * video pauses first and the seek pill never shows a rounded "0s". The
 * status announcer still reports the pause and the seek, because it watches
 * the player store rather than hotkey events.
 */
function wireFrameStep(container: HTMLElement): void {
  const media = container.querySelector('mux-video, video');
  if (!media) return;
  container.addEventListener('keydown', (event) => {
    if (event.key !== ',' && event.key !== '.') return;
    if (event.metaKey || event.ctrlKey || event.altKey) return;
    const target = event.target as HTMLElement | null;
    if (
      target &&
      (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)
    )
      return;
    const video = underlyingVideo(media);
    if (!video) return;
    event.preventDefault();
    const step = 1 / 30;
    const duration = Number.isFinite(video.duration) ? video.duration : Number.POSITIVE_INFINITY;
    const next = Math.min(
      Math.max(video.currentTime + (event.key === '.' ? step : -step), 0),
      duration,
    );
    if (!video.paused) video.pause();
    video.currentTime = next;
  });
}

// ── The living sky ────────────────────────────────────────────────────────

interface LivingState {
  mode: SkyMode;
  timer: ReturnType<typeof setInterval> | null;
}

const livingStates = new WeakMap<HTMLElement, LivingState>();

/** Set the sky mode of one player ('auto' follows the viewer's local time). */
export function setPlayerSkyMode(player: HTMLElement, mode: SkyMode): void {
  const container = player.querySelector('media-container') as HTMLElement | null;
  if (!container) return;
  const state = livingStates.get(container);
  if (state) {
    state.mode = mode;
  } else {
    livingStates.set(container, { mode, timer: null });
  }
  applyLivingSky(container);
}

/** Resolve a mode to the concrete sky it shows right now. */
export function resolveSky(mode: SkyMode, now: Date = getSkyNow()): string {
  return mode === 'auto' ? skyForTime(now) : mode;
}

function applyLivingSky(container: HTMLElement): void {
  const state = livingStates.get(container);
  if (!state) return;
  const now = getSkyNow();
  container.setAttribute('data-sky', resolveSky(state.mode, now));
  // Cheap enough to re-render on every tick: keeps the moon and the panel
  // correct across midnight and across debug `?time=`/`?date=` changes.
  renderMoonThumb(container, now);
  renderSkyPanel(container, now);
}

function wireLivingSky(container: HTMLElement): void {
  if (!livingStates.has(container)) livingStates.set(container, { mode: 'auto', timer: null });
  const state = livingStates.get(container)!;
  applyLivingSky(container);
  if (state.timer === null) {
    state.timer = setInterval(() => {
      // The player is rebuilt on footage switches; stop ticking once the old
      // container leaves the document.
      if (!container.isConnected) {
        if (state.timer !== null) clearInterval(state.timer);
        state.timer = null;
        return;
      }
      applyLivingSky(container);
    }, 30_000);
  }
}

// ── The real moon on the seek bar ─────────────────────────────────────────

function renderMoonThumb(container: HTMLElement, now: Date): void {
  const thumb = container.querySelector('.media-time-slider-thumb');
  if (!thumb) return;
  const { phase } = moonPhase(now);
  thumb.classList.add('kala-moon-thumb');
  thumb.innerHTML = moonSvg(phase, 24);
}

function wireMoonThumb(container: HTMLElement): void {
  renderMoonThumb(container, getSkyNow());
}

// ── Tonight's sky panel ───────────────────────────────────────────────────

let skyPanelUid = 0;

/**
 * Fill any "tonight's sky" block (the in-player panel or the demo page strip)
 * with tonight's data. The block's markup uses the [data-kala-*] hooks; the
 * layout is up to the caller's CSS.
 */
export function fillSkyData(root: Element, now: Date): void {
  const moon = moonPhase(now);
  const times = moonTimes(now);
  const stars = tonightConstellations(now);
  const sky = skyForTime(now);

  const setText = (selector: string, text: string): void => {
    const el = root.querySelector(selector);
    if (el) el.textContent = text;
  };

  const art = root.querySelector('[data-kala-moon-art]');
  if (art) art.innerHTML = moonSvg(moon.phase, 44);
  setText('[data-kala-moon-name]', moon.name);
  setText(
    '[data-kala-moon-meta]',
    `${Math.round(moon.illumination * 100)}% lit · age ${moon.age.toFixed(1)} days`,
  );
  setText('[data-kala-moonrise]', `${formatClock(times.rise)} (est.)`);
  setText('[data-kala-moonset]', `${formatClock(times.set)} (est.)`);
  setText('[data-kala-live-sky]', `${SKY_LABELS[sky]} · ${formatClock(now)}`);

  const list = root.querySelector('[data-kala-stars]');
  if (list) {
    list.innerHTML = stars
      .map(
        (s) =>
          `<li><span class="kala-sky-star-name">${s.name}</span>` +
          `<span class="kala-sky-star-epithet">${s.epithet}</span>` +
          `<span class="kala-sky-star-status">${s.status}</span></li>`,
      )
      .join('');
  }
}

function renderSkyPanel(container: HTMLElement, now: Date): void {
  const panel = container.querySelector('.kala-sky-panel');
  if (!panel) return;
  fillSkyData(panel, now);
}

function wireSkyPanel(container: HTMLElement): void {
  const panel = container.querySelector('.kala-sky-panel') as HTMLElement | null;
  const trigger = container.querySelector('.kala-sky-button') as HTMLElement | null;
  const closeBtn = container.querySelector('[data-kala-sky-close]') as HTMLElement | null;
  if (!panel || !trigger || !closeBtn) return;

  const uid = ++skyPanelUid;
  panel.id = `kala-sky-panel-${uid}`;
  const title = panel.querySelector('.kala-sky-title');
  if (title) {
    title.id = `kala-sky-title-${uid}`;
    panel.setAttribute('aria-labelledby', title.id);
  }
  trigger.setAttribute('aria-controls', panel.id);

  let lastFocus: HTMLElement | null = null;

  const open = (): void => {
    lastFocus = document.activeElement as HTMLElement | null;
    renderSkyPanel(container, getSkyNow());
    panel.removeAttribute('hidden');
    trigger.setAttribute('aria-expanded', 'true');
    closeBtn.focus();
  };

  const close = (): void => {
    panel.setAttribute('hidden', '');
    trigger.setAttribute('aria-expanded', 'false');
    if (lastFocus && document.contains(lastFocus)) lastFocus.focus();
  };

  trigger.addEventListener('click', () => {
    if (panel.hasAttribute('hidden')) open();
    else close();
  });
  closeBtn.addEventListener('click', close);
  container.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !panel.hasAttribute('hidden')) {
      event.preventDefault();
      close();
    }
  });
}

interface ChapterCue {
  start: number;
  end: number;
  text: string;
}

function wireChapterLabel(container: HTMLElement, chaptersUrl?: string): void {
  const label = container.querySelector('.kala-chapter-label') as HTMLElement | null;
  const media = container.querySelector('mux-video, video') as unknown as HTMLVideoElement | null;
  if (!label || !media) return;

  let cues: ChapterCue[] | null = null;

  const render = (time: number): void => {
    if (!cues) return;
    const index = cues.findIndex((c) => time >= c.start && time < c.end);
    label.textContent =
      index >= 0 ? `Ch ${String(index + 1).padStart(2, '0')} · ${cues[index].text}` : '';
  };

  // Path 1: read the chapters track the media element already parsed.
  const readTrack = (): boolean => {
    try {
      const tracks = media.textTracks;
      if (!tracks) return false;
      for (const track of Array.from(tracks)) {
        if (track.kind === 'chapters' && track.cues && track.cues.length > 0) {
          cues = Array.from(track.cues).map((c) => ({
            start: c.startTime,
            end: c.endTime,
            text: (c as VTTCue).text,
          }));
          render(media.currentTime || 0);
          return true;
        }
      }
    } catch {
      /* fall through to the VTT fetch */
    }
    return false;
  };

  // Path 2: fetch and parse the chapters file directly (some media components
  // keep their text tracks out of reach from the light DOM).
  const fetchChapters = async (): Promise<void> => {
    if (!chaptersUrl || cues) return;
    try {
      const text = await (await fetch(chaptersUrl)).text();
      const parsed: ChapterCue[] = [];
      const blocks = text.split(/\n\s*\n/);
      for (const block of blocks) {
        const match = block.match(
          /(\d+:)?(\d+):(\d+\.\d+)\s+-->\s+(\d+:)?(\d+):(\d+\.\d+)\s*\n([\s\S]*)/,
        );
        if (!match) continue;
        const toSeconds = (h: string | undefined, m: string, s: string): number =>
          (h ? parseInt(h, 10) * 3600 : 0) + parseInt(m, 10) * 60 + parseFloat(s);
        parsed.push({
          start: toSeconds(match[1], match[2], match[3]),
          end: toSeconds(match[4], match[5], match[6]),
          text: match[7].trim().replace(/\s+/g, ' '),
        });
      }
      if (parsed.length > 0) {
        cues = parsed;
        render(media.currentTime || 0);
      }
    } catch {
      /* No chapter line — the slider still shows chapter titles on hover. */
    }
  };

  const onTime = (): void => render(media.currentTime || 0);
  media.addEventListener('timeupdate', onTime);
  media.addEventListener('loadedmetadata', () => {
    if (!readTrack()) void fetchChapters();
  });
  // The track may already be loaded by the time this runs.
  if (!readTrack()) void fetchChapters();
}
