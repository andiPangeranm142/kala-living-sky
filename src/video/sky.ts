/**
 * KALA Living Observatory — the sky, computed on the viewer's own device.
 *
 * Everything here is local arithmetic on the date, the local time, and a
 * default observing position (Jakarta, Indonesia). No network, no API, no
 * geolocation — the page never asks where the viewer is.
 *
 * - Moon phase: synodic month 29.530588853 days, anchored on the new moon of
 *   6 January 2000, 18:14 UTC. Good to roughly half a day — honest for a
 *   skin, and labelled an estimate wherever a time is shown.
 * - Moonrise / moonset: the Moon's meridian transit drifts ~50 minutes later
 *   each day from solar noon at new moon; rise and set sit ~6.1h either side
 *   of transit at equatorial latitudes. Estimates, labelled as such.
 * - Constellations: altitude from local sidereal time (low-precision GMST),
 *   sampled across tonight (18:00–06:00) to find what is actually up.
 *
 * Debug: `?time=HH:MM` and `?date=YYYY-MM-DD` override the clock used for the
 * sky, the moon, and tonight's stars. Off by default; for testing and for
 * recording the demo video.
 */

export type SkyId = 'dawn' | 'day' | 'dusk' | 'night';
export type SkyMode = 'auto' | 'midnight' | 'aurora' | 'ember';

/** Length of one lunar cycle, in days. */
export const SYNODIC_MONTH_DAYS = 29.530588853;

/** Reference new moon: 6 January 2000, 18:14 UTC. */
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14);

/** Default observing position: Jakarta, Indonesia. */
export const DEFAULT_LAT = -6.2;
export const DEFAULT_LON = 106.8;

export interface MoonPhase {
  /** Days since new moon, 0–29.53. */
  age: number;
  /** Fraction of the cycle, 0 (new) → 0.5 (full) → 1 (new). */
  phase: number;
  /** Fraction of the disc lit, 0–1. */
  illumination: number;
  /** One of the eight traditional phase names. */
  name: string;
  /** Index into the eight phases, 0 = New Moon. */
  index: number;
  /** True while the lit part is growing (new → full). */
  waxing: boolean;
}

const PHASE_NAMES = [
  'New Moon',
  'Waxing Crescent',
  'First Quarter',
  'Waxing Gibbous',
  'Full Moon',
  'Waning Gibbous',
  'Last Quarter',
  'Waning Crescent',
];

export function moonPhase(date: Date): MoonPhase {
  const days = (date.getTime() - REFERENCE_NEW_MOON_MS) / 86400000;
  const age =
    ((days % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) % SYNODIC_MONTH_DAYS;
  const phase = age / SYNODIC_MONTH_DAYS;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const index = Math.floor(((phase + 1 / 16) % 1) * 8) % 8;
  return { age, phase, illumination, name: PHASE_NAMES[index], index, waxing: phase < 0.5 };
}

/**
 * An SVG of the moon at the given phase (0 = new, 0.5 = full): a dark disc
 * with the lit part drawn as a circle-plus-terminator path. Flat fills only,
 * so any number of instances can share a page without gradient-ID clashes.
 */
export function moonSvg(phase: number, size = 24, lit = '#f6f1de', dark = '#262b45'): string {
  const cx = 12;
  const cy = 12;
  const r = 10;
  const illumination = (1 - Math.cos(2 * Math.PI * phase)) / 2;
  const waxing = phase < 0.5;
  const crescent = illumination < 0.5;
  const theta = 2 * Math.PI * phase;
  const rx = Math.max(0.05, Math.min(r, r * Math.abs(Math.cos(theta))));

  let litPart = '';
  if (illumination >= 0.98) {
    litPart = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${lit}"/>`;
  } else if (illumination > 0.02) {
    const outerSweep = waxing ? 1 : 0;
    const termSweep = crescent === waxing ? 0 : 1;
    litPart =
      `<path fill="${lit}" d="M ${cx} ${cy - r} ` +
      `A ${r} ${r} 0 0 ${outerSweep} ${cx} ${cy + r} ` +
      `A ${rx.toFixed(2)} ${r} 0 0 ${termSweep} ${cx} ${cy - r} Z"/>`;
  }

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" ` +
    `viewBox="0 0 24 24" aria-hidden="true" focusable="false">` +
    `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${dark}"/>${litPart}</svg>`
  );
}

/** Which of the four time-of-day skies the local clock falls in. */
export function skyForTime(date: Date): SkyId {
  const h = date.getHours() + date.getMinutes() / 60;
  if (h >= 5 && h < 7) return 'dawn';
  if (h >= 7 && h < 17) return 'day';
  if (h >= 17 && h < 19) return 'dusk';
  return 'night';
}

export const SKY_LABELS: Record<SkyId, string> = {
  dawn: 'Dawn',
  day: 'Day',
  dusk: 'Dusk',
  night: 'Night',
};

/**
 * The clock the living sky runs on: the real local time, unless the page was
 * opened with `?time=HH:MM` and/or `?date=YYYY-MM-DD` (debug overrides for
 * testing and demo recording). Invalid values are ignored.
 */
export function getSkyNow(): Date {
  const now = new Date();
  if (typeof window === 'undefined') return now;
  let params: URLSearchParams;
  try {
    params = new URLSearchParams(window.location.search);
  } catch {
    return now;
  }
  const dateParam = params.get('date');
  const timeParam = params.get('time');
  if (!dateParam && !timeParam) return now;

  let year = now.getFullYear();
  let month = now.getMonth();
  let day = now.getDate();
  let hours = now.getHours();
  let minutes = now.getMinutes();

  if (dateParam) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateParam);
    if (m) {
      year = Number(m[1]);
      month = Number(m[2]) - 1;
      day = Number(m[3]);
    }
  }
  if (timeParam) {
    const m = /^(\d{1,2}):(\d{2})$/.exec(timeParam);
    if (m && Number(m[1]) < 24 && Number(m[2]) < 60) {
      hours = Number(m[1]);
      minutes = Number(m[2]);
    }
  }

  const debug = new Date(year, month, day, hours, minutes, 0, 0);
  return Number.isNaN(debug.getTime()) ? now : debug;
}

/** Approximate moonrise / moonset for the local day (estimates — see header). */
export function moonTimes(date: Date): { rise: Date; set: Date } {
  const { age } = moonPhase(date);
  // Transit drifts ~50 minutes later each day from solar noon at new moon.
  const transitHours = (12 + age * 0.841) % 24;
  const base = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 0, 0, 0, 0);
  const transit = new Date(base.getTime() + transitHours * 3600000);
  return {
    rise: new Date(transit.getTime() - 6.1 * 3600000),
    set: new Date(transit.getTime() + 6.1 * 3600000),
  };
}

// ── Constellations ────────────────────────────────────────────────────────

export interface Constellation {
  name: string;
  epithet: string;
  /** Right ascension, hours. */
  ra: number;
  /** Declination, degrees. */
  dec: number;
}

export const CONSTELLATIONS: Constellation[] = [
  { name: 'Orion', epithet: 'The Hunter', ra: 5.58, dec: 7.4 },
  { name: 'Canis Major', epithet: 'The Great Dog', ra: 6.99, dec: -22.0 },
  { name: 'Taurus', epithet: 'The Bull', ra: 4.53, dec: 15.9 },
  { name: 'Gemini', epithet: 'The Twins', ra: 7.45, dec: 21.9 },
  { name: 'Crux', epithet: 'The Southern Cross', ra: 12.45, dec: -60.0 },
  { name: 'Centaurus', epithet: 'The Centaur', ra: 13.05, dec: -47.6 },
  { name: 'Carina', epithet: 'The Keel', ra: 9.13, dec: -62.0 },
  { name: 'Vela', epithet: 'The Sails', ra: 9.42, dec: -47.0 },
  { name: 'Scorpius', epithet: 'The Scorpion', ra: 16.89, dec: -30.4 },
  { name: 'Sagittarius', epithet: 'The Archer', ra: 19.02, dec: -29.4 },
  { name: 'Aquila', epithet: 'The Eagle', ra: 19.75, dec: 3.9 },
  { name: 'Cygnus', epithet: 'The Swan', ra: 20.62, dec: 42.3 },
  { name: 'Lyra', epithet: 'The Lyre', ra: 18.79, dec: 36.8 },
  { name: 'Pegasus', epithet: 'The Winged Horse', ra: 22.55, dec: 19.8 },
  { name: 'Andromeda', epithet: 'The Chained Maiden', ra: 0.68, dec: 38.5 },
  { name: 'Aquarius', epithet: 'The Water Bearer', ra: 22.52, dec: -10.6 },
  { name: 'Pisces', epithet: 'The Fish', ra: 0.43, dec: 10.9 },
  { name: 'Cetus', epithet: 'The Whale', ra: 1.77, dec: -9.8 },
  { name: 'Leo', epithet: 'The Lion', ra: 10.68, dec: 14.9 },
  { name: 'Virgo', epithet: 'The Maiden', ra: 13.42, dec: -2.9 },
  { name: 'Hydra', epithet: 'The Sea Serpent', ra: 10.27, dec: -20.0 },
  { name: 'Corvus', epithet: 'The Crow', ra: 12.44, dec: -17.7 },
  { name: 'Libra', epithet: 'The Scales', ra: 15.49, dec: -15.6 },
  { name: 'Ursa Major', epithet: 'The Great Bear', ra: 11.06, dec: 55.0 },
];

/** Greenwich mean sidereal time, degrees (low-precision formula). */
function gmstDegrees(date: Date): number {
  const jd = date.getTime() / 86400000 + 2440587.5;
  const d = jd - 2451545.0;
  return (((280.46061837 + 360.98564736629 * d) % 360) + 360) % 360;
}

/** Altitude of a point (RA hours, Dec degrees) above the horizon, degrees. */
export function altitudeDeg(
  raHours: number,
  decDeg: number,
  date: Date,
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
): number {
  const lst = (gmstDegrees(date) + lon + 360) % 360;
  const h = (((lst - raHours * 15 + 540) % 360) - 180) * (Math.PI / 180);
  const latR = (lat * Math.PI) / 180;
  const decR = (decDeg * Math.PI) / 180;
  const sinAlt =
    Math.sin(decR) * Math.sin(latR) + Math.cos(decR) * Math.cos(latR) * Math.cos(h);
  return (Math.asin(Math.min(1, Math.max(-1, sinAlt))) * 180) / Math.PI;
}

export interface TonightStar extends Constellation {
  /** Highest altitude reached tonight, degrees. */
  maxAlt: number;
  /** First time above the horizon tonight (null if already up at dusk). */
  rise: Date | null;
  /** First time below the horizon after rising (null if up all night). */
  set: Date | null;
  /** True when above the horizon right now. */
  upNow: boolean;
  /** One-line status for the panel, e.g. "Up now · sets 02:40". */
  status: string;
}

/**
 * Tonight's featured constellations: the four that climb highest between
 * 18:00 and 06:00 local time, with Crux (the Southern Cross) always included
 * when it clears the horizon tonight — it is the southern sky's signature,
 * and it is visible from Indonesia.
 */
export function tonightConstellations(
  now: Date,
  lat = DEFAULT_LAT,
  lon = DEFAULT_LON,
): TonightStar[] {
  const nightStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 18, 0, 0, 0);
  // After midnight but before dawn, "tonight" started yesterday evening.
  if (now.getHours() < 6) nightStart.setDate(nightStart.getDate() - 1);

  const samples: Date[] = [];
  for (let m = 0; m <= 12 * 60; m += 30) samples.push(new Date(nightStart.getTime() + m * 60000));

  const scored: TonightStar[] = CONSTELLATIONS.map((c) => {
    let maxAlt = -90;
    let rise: Date | null = null;
    let set: Date | null = null;
    let wasUp = false;
    for (const t of samples) {
      const alt = altitudeDeg(c.ra, c.dec, t, lat, lon);
      if (alt > maxAlt) maxAlt = alt;
      const up = alt > 0;
      if (up && !wasUp && !rise) rise = t;
      if (!up && wasUp && rise && !set) set = t;
      wasUp = up;
    }
    const upNow = altitudeDeg(c.ra, c.dec, now, lat, lon) > 0;
    let status: string;
    if (upNow) {
      if (set) status = `Up now · sets ${formatClock(set)}`;
      else if (rise && rise.getTime() > nightStart.getTime())
        status = `Up now · rose ${formatClock(rise)}`;
      else status = 'Up all night';
    } else if (rise && rise.getTime() > now.getTime()) {
      status = `Rises ${formatClock(rise)}`;
    } else if (set && set.getTime() <= now.getTime()) {
      status = `Set ${formatClock(set)}`;
    } else if (rise) {
      status = `Rose ${formatClock(rise)}`;
    } else {
      status = 'Below the horizon tonight';
    }
    return { ...c, maxAlt, rise, set, upNow, status };
  });

  const visible = scored
    .filter((s) => s.maxAlt > 5)
    .sort((a, b) => b.maxAlt - a.maxAlt);
  const picks = visible.slice(0, 4);
  const crux = visible.find((s) => s.name === 'Crux');
  if (crux && !picks.includes(crux)) picks[3] = crux;
  return picks.slice(0, 4);
}

/** "HH:MM", 24-hour local time. */
export function formatClock(date: Date): string {
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/** Build a WebVTT chapters track from chapter names + second boundaries. */
export function buildChaptersVtt(
  chapters: { name: string; epithet: string }[],
  boundaries: number[],
): string {
  const fmt = (s: number): string => {
    const m = Math.floor(s / 60);
    const sec = s - m * 60;
    return `00:${String(m).padStart(2, '0')}:${sec.toFixed(3).padStart(6, '0')}`;
  };
  const cues = chapters
    .map((c, i) => `${fmt(boundaries[i])} --> ${fmt(boundaries[i + 1])}\n${c.name} · ${c.epithet}`)
    .join('\n\n');
  return `WEBVTT\n\n${cues}\n`;
}
