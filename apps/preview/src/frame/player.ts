import '@videojs/html/video/player';
import '@videojs/html/media/mux-video';
import '@/video/skin';
import { enhanceKalaPlayer } from '@/video/skin';
import { buildChaptersVtt, getSkyNow, tonightConstellations } from '@/video/sky';
import skinTemplate from '@/video/skin.html?raw';
import { DEFAULT_FOOTAGE, FOOTAGE, type Footage } from '../media-config';

const MEDIA_PLACEHOLDER = '<!-- Add a compatible media component here. -->';

/** Chapter boundaries (seconds) per footage — the same cuts as the static VTTs. */
const CHAPTER_BOUNDARIES: Record<string, number[]> = {
  'cosmic-dawn': [0, 20, 52, 73, 111.143],
  daylight: [0, 30, 60, 90, 120],
  'daylight-mux': [0, 30, 60, 90, 120],
};

/**
 * Tonight's chapters: a WebVTT track whose four cues are named after the
 * constellations actually up tonight (computed locally — see sky.ts), served
 * as a blob URL. Falls back to the footage's static VTT if anything fails,
 * so the seek bar never loses its chapter stars.
 */
function tonightChaptersUrl(footage: Footage): string | undefined {
  const boundaries = CHAPTER_BOUNDARIES[footage.id];
  if (!boundaries) return footage.chapters;
  try {
    const stars = tonightConstellations(getSkyNow());
    if (stars.length < 4) return footage.chapters;
    const vtt = buildChaptersVtt(stars, boundaries);
    return URL.createObjectURL(new Blob([vtt], { type: 'text/vtt' }));
  } catch {
    return footage.chapters;
  }
}

function mediaMarkup(footage: Footage, chaptersUrl?: string): string {
  const chapters = chaptersUrl
    ? `<track kind="chapters" label="English" srclang="en" src="${chaptersUrl}" default>`
    : '';
  if (footage.kind === 'mux') {
    return `<mux-video src="https://stream.mux.com/${footage.src}.m3u8" playsinline crossorigin>${chapters}</mux-video>`;
  }
  return `<video src="${footage.src}" playsinline crossorigin preload="metadata">${chapters}</video>`;
}

/** Build a Kala player for the given footage (defaults to the configured default). */
export function createPlayer(footage: Footage = FOOTAGE[DEFAULT_FOOTAGE]): HTMLElement {
  const player = document.createElement('video-player');
  player.setAttribute('poster', footage.poster);
  player.setAttribute('content-title', footage.title);

  const chaptersUrl = tonightChaptersUrl(footage);
  player.innerHTML = skinTemplate.replace(MEDIA_PLACEHOLDER, mediaMarkup(footage, chaptersUrl));
  enhanceKalaPlayer(player, chaptersUrl);
  return player;
}
