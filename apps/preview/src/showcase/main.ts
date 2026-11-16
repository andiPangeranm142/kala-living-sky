/**
 * KALA Living Observatory showcase page: mounts the hero player (with live
 * sky + footage switching), the compact responsive player, the ambient glow,
 * the tonight's-sky strip, and the starfield behind the page.
 */
import '@videojs/html/i18n';

import { fillSkyData, resolveSky, setPlayerSkyMode } from '@/video/skin';
import { getSkyNow, SKY_LABELS, skyForTime, type SkyMode } from '@/video/sky';
import { createPlayer } from '../frame/player';
import {
  availableFootage,
  DEFAULT_FOOTAGE,
  FOOTAGE,
  type Footage,
} from '../media-config';
import './showcase.css';

const SKY_NOTES: Record<Exclude<SkyMode, 'auto'>, string> = {
  midnight: 'Midnight — teal to violet to lantern amber, the default night.',
  aurora: 'Aurora — green fire over ice blue, for the polar shows.',
  ember: 'Ember — sunset amber into rose, dusk at the observatory.',
};

const stage = document.querySelector<HTMLElement>('#stage');
const heroMount = document.querySelector<HTMLElement>('#hero-player');
const compactMount = document.querySelector<HTMLElement>('#compact-player');
const footageNote = document.querySelector<HTMLElement>('#footage-note');
const ambientVideo = document.querySelector<HTMLVideoElement>('#ambient-video');
const tonightStrip = document.querySelector<HTMLElement>('#tonight-strip');

let currentMode: SkyMode = 'auto';
let currentFootage: Footage = FOOTAGE[DEFAULT_FOOTAGE];

/** Re-tint every mounted player and the stage to the given mode. */
function applySky(mode: SkyMode): void {
  currentMode = mode;
  const resolved = resolveSky(mode);

  stage?.setAttribute('data-sky', resolved);
  document.body.dataset.sky = resolved;

  for (const player of document.querySelectorAll('video-player')) {
    setPlayerSkyMode(player as HTMLElement, mode);
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('#sky-switcher button'))
    button.setAttribute('aria-pressed', String(button.dataset.sky === mode));

  updateFootageNote();
}

/** Describe the current footage + sky under the stage. */
function updateFootageNote(): void {
  if (!footageNote) return;

  const skyNote =
    currentMode === 'auto'
      ? `Live sky — ${SKY_LABELS[skyForTime(getSkyNow())]}, following your local time.`
      : SKY_NOTES[currentMode];
  footageNote.textContent = `Now showing: ${currentFootage.title} — ${currentFootage.description} ${skyNote}`;
}

/** Fill the tonight's-sky strip under the stage with tonight's data. */
function renderTonightStrip(): void {
  if (!tonightStrip) return;
  fillSkyData(tonightStrip, getSkyNow());
}

/** Rebuild the hero player for a different footage, keeping the current sky mode. */
function setFootage(id: string): void {
  if (!heroMount) return;

  currentFootage = FOOTAGE[id];

  const i18n = heroMount.querySelector('media-i18n');
  const next = createPlayer(currentFootage);
  // The rebuilt player defaults to auto; re-apply the chosen mode.
  setPlayerSkyMode(next, currentMode);

  if (i18n) i18n.replaceChildren(next);
  else {
    const wrapper = document.createElement('media-i18n');
    wrapper.append(next);
    heroMount.replaceChildren(wrapper);
  }

  for (const button of document.querySelectorAll<HTMLButtonElement>('#footage-switcher button'))
    button.setAttribute('aria-pressed', String(button.dataset.footage === id));

  updateFootageNote();
}

/** Mount the hero + compact players once. */
function mount(): void {
  if (heroMount) {
    const i18n = document.createElement('media-i18n');
    i18n.append(createPlayer(currentFootage));
    heroMount.append(i18n);
  }

  if (compactMount) {
    const i18n = document.createElement('media-i18n');
    const compact = createPlayer(FOOTAGE.daylight);
    compact.setAttribute('data-player-size', 'compact');
    i18n.append(compact);
    compactMount.append(i18n);
  }

  updateFootageNote();
}

/** Wire the sky, footage, and ambient controls. */
function wireControls(): void {
  // Buttons only: the stage and the player containers also carry data-sky
  // (the resolved sky), and must not become sky switches.
  for (const button of document.querySelectorAll<HTMLButtonElement>('#sky-switcher button'))
    button.addEventListener('click', () => applySky(button.dataset.sky as SkyMode));

  for (const card of document.querySelectorAll<HTMLButtonElement>('[data-sky-target]'))
    card.addEventListener('click', () => {
      applySky(card.dataset.skyTarget as SkyMode);
      document.querySelector('#stage')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });

  // Hide footage entries that are not configured (e.g. the Mux upload, until
  // a playback ID is set in media-config.ts).
  const available = new Set(availableFootage().map((footage) => footage.id));

  for (const button of document.querySelectorAll<HTMLButtonElement>('#footage-switcher button')) {
    if (!available.has(button.dataset.footage ?? '')) button.hidden = true;
    button.addEventListener('click', () => setFootage(button.dataset.footage ?? ''));
  }

  const ambientToggle = document.querySelector<HTMLButtonElement>('#ambient-toggle');

  if (ambientToggle && ambientVideo) {
    const setAmbient = (on: boolean): void => {
      stage?.classList.toggle('ambient-off', !on);
      ambientToggle.setAttribute('aria-pressed', String(on));
      ambientToggle.querySelector('.toggle-text')!.textContent = on ? 'On' : 'Off';

      if (on) void ambientVideo.play().catch(() => undefined);
      else ambientVideo.pause();
    };

    ambientToggle.addEventListener('click', () =>
      setAmbient(ambientToggle.getAttribute('aria-pressed') !== 'true'),
    );

    // The ambient video is decorative; start it quietly once it can play.
    if (ambientVideo.readyState >= 2) void ambientVideo.play().catch(() => undefined);
    else
      ambientVideo.addEventListener(
        'canplay',
        () => void ambientVideo.play().catch(() => undefined),
        { once: true },
      );
  }
}

/** A slow twinkling starfield on a fixed canvas; still when motion is reduced. */
function starfield(): void {
  const canvas = document.querySelector<HTMLCanvasElement>('#starfield');

  if (!canvas) return;

  const context = canvas.getContext('2d');

  if (!context) return;

  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  type Star = { x: number; y: number; r: number; base: number; speed: number; phase: number };

  let stars: Star[] = [];
  let width = 0;
  let height = 0;

  const seed = (): void => {
    width = window.innerWidth;
    height = window.innerHeight;
    canvas.width = width * devicePixelRatio;
    canvas.height = height * devicePixelRatio;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);

    const count = Math.round((width * height) / 12000);

    stars = Array.from({ length: count }, () => ({
      x: Math.random() * width,
      y: Math.random() * height,
      r: 0.4 + Math.random() * 1.1,
      base: 0.25 + Math.random() * 0.55,
      speed: 0.3 + Math.random() * 0.9,
      phase: Math.random() * Math.PI * 2,
    }));
  };

  const draw = (time: number): void => {
    context.clearRect(0, 0, width, height);

    for (const star of stars) {
      const twinkle = reduced ? 0 : Math.sin(time / 1000 * star.speed + star.phase) * 0.25;

      context.globalAlpha = Math.max(0.05, star.base + twinkle);
      context.fillStyle = '#e2e8f0';
      context.beginPath();
      context.arc(star.x, star.y, star.r, 0, Math.PI * 2);
      context.fill();
    }

    context.globalAlpha = 1;
  };

  seed();

  if (reduced) {
    draw(0);
  } else {
    const frame = (time: number): void => {
      draw(time);
      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);
  }

  window.addEventListener('resize', () => {
    seed();
    draw(0);
  });
}

mount();
wireControls();
applySky('auto');
renderTonightStrip();
starfield();

// Keep the strip's clock and the auto sky fresh (the players re-check on
// their own 30s tick; the strip and the page tint follow here).
setInterval(() => {
  if (currentMode === 'auto') applySky('auto');
  renderTonightStrip();
}, 30_000);
