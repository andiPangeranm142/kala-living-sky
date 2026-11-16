// Sanity checks for src/video/sky.ts — run: `node tools/test-sky.mjs`
// (Node's built-in type stripping imports the .ts source directly.)
//
// Known lunar events (UTC, U.S. Naval Observatory primary phase table):
//   2000-01-06 18:14 — new moon (the algorithm's reference itself)
//   2024-04-08 18:21 — new moon (total solar eclipse day)
//   2025-01-13 22:27 — full moon (Wolf Moon)
//   2026-11-09 07:02 — new moon (contest month)
//   2026-11-17 11:48 — first quarter (contest day)
//   2026-11-24 14:53 — full moon (Beaver Moon)
// The simple synodic algorithm is good to ~0.7 day; assert within 0.8 day of
// the expected age (0 for new, ~7.38 for first quarter, ~14.77 for full).
import {
  moonPhase,
  moonTimes,
  skyForTime,
  tonightConstellations,
  altitudeDeg,
  buildChaptersVtt,
  moonSvg,
  SYNODIC_MONTH_DAYS,
} from '../src/video/sky.ts';

let fails = 0;
const check = (name, ok, detail = '') => {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
  if (!ok) fails++;
};
const ageErr = (d, expected) => {
  const { age } = moonPhase(d);
  const err = Math.min(Math.abs(age - expected), SYNODIC_MONTH_DAYS - Math.abs(age - expected));
  return { age, err };
};

check('synodic month constant', SYNODIC_MONTH_DAYS === 29.530588853);

let r = ageErr(new Date(Date.UTC(2000, 0, 6, 18, 14)), 0);
check('2000-01-06 new moon (reference)', r.err < 0.01, `age=${r.age.toFixed(3)}d`);

r = ageErr(new Date(Date.UTC(2024, 3, 8, 18, 21)), 0);
check('2024-04-08 new moon (eclipse)', r.err < 0.8, `age=${r.age.toFixed(2)}d err=${r.err.toFixed(2)}d`);

r = ageErr(new Date(Date.UTC(2025, 0, 13, 22, 27)), SYNODIC_MONTH_DAYS / 2);
check('2025-01-13 full moon', r.err < 0.8, `age=${r.age.toFixed(2)}d err=${r.err.toFixed(2)}d`);

r = ageErr(new Date(Date.UTC(2026, 10, 9, 7, 2)), 0);
check('2026-11-09 new moon (USNO)', r.err < 0.8, `age=${r.age.toFixed(2)}d err=${r.err.toFixed(2)}d`);

r = ageErr(new Date(Date.UTC(2026, 10, 17, 11, 48)), SYNODIC_MONTH_DAYS / 4);
check('2026-11-17 first quarter (USNO)', r.err < 0.8, `age=${r.age.toFixed(2)}d err=${r.err.toFixed(2)}d`);

r = ageErr(new Date(Date.UTC(2026, 10, 24, 14, 53)), SYNODIC_MONTH_DAYS / 2);
check('2026-11-24 full moon (USNO)', r.err < 0.8, `age=${r.age.toFixed(2)}d err=${r.err.toFixed(2)}d`);

// Contest day, 17 Nov 2026 12:00 WIB (= 05:00 UTC): first quarter, ~half lit.
const contest = new Date('2026-11-17T05:00:00Z');
const mp = moonPhase(contest);
check(
  '2026-11-17 phase name',
  mp.name === 'First Quarter',
  `${mp.name}, age=${mp.age.toFixed(1)}d, illum=${(mp.illumination * 100).toFixed(0)}%`,
);
check(
  '2026-11-17 illumination sane',
  mp.illumination > 0.4 && mp.illumination < 0.65,
  `${(mp.illumination * 100).toFixed(1)}%`,
);

// Moon times sanity on contest day: first-quarter moon rises ~midday,
// sets ~midnight; rise < set, ~12.2h apart.
const mt = moonTimes(contest);
const spanH = (mt.set - mt.rise) / 3600000;
check(
  'moonrise < moonset, ~12.2h apart',
  mt.rise < mt.set && spanH > 11.5 && spanH < 13,
  `${mt.rise.toISOString().slice(11, 16)} → ${mt.set.toISOString().slice(11, 16)} UTC, span ${spanH.toFixed(1)}h`,
);

// Sky bands.
const skyAt = (h, m = 0) => skyForTime(new Date(2026, 10, 17, h, m));
check('sky 04:00 night', skyAt(4) === 'night');
check('sky 05:30 dawn', skyAt(5, 30) === 'dawn');
check('sky 06:59 dawn', skyAt(6, 59) === 'dawn');
check('sky 07:00 day', skyAt(7) === 'day');
check('sky 12:00 day', skyAt(12) === 'day');
check('sky 16:59 day', skyAt(16, 59) === 'day');
check('sky 17:00 dusk', skyAt(17) === 'dusk');
check('sky 18:30 dusk', skyAt(18, 30) === 'dusk');
check('sky 19:00 night', skyAt(19) === 'night');
check('sky 23:00 night', skyAt(23) === 'night');

// GMST check via the Sun (17 Nov: RA ~15.4h, Dec ~-19°): upper culmination
// ~77° at local noon, lower culmination ~-65° at local midnight.
const sunNoon = altitudeDeg(15.4, -19, new Date('2026-11-17T05:00:00Z'));
const sunMid = altitudeDeg(15.4, -19, new Date('2026-11-17T17:00:00Z'));
check('Sun culminates ~77° at noon', sunNoon > 72 && sunNoon < 82, `${sunNoon.toFixed(1)}°`);
check('Sun ~-65° at midnight', sunMid > -70 && sunMid < -60, `${sunMid.toFixed(1)}°`);

// Orion (RA 5.6h) high around midnight in January at lat -6.
const orionJan = altitudeDeg(5.58, 7.4, new Date('2026-01-15T17:00:00Z'));
check('Orion high at Jan midnight', orionJan > 45, `${orionJan.toFixed(1)}°`);

// Tonight's constellations on contest evening (17 Nov 2026 20:00 WIB).
const tonight = tonightConstellations(new Date('2026-11-17T13:00:00Z'));
console.log(
  'tonight 17 Nov:',
  tonight.map((s) => `${s.name} (maxAlt ${s.maxAlt.toFixed(0)}°, ${s.status})`).join(' | '),
);
check('4 featured constellations', tonight.length === 4, `got ${tonight.length}`);
check('Crux included tonight', tonight.some((s) => s.name === 'Crux'), tonight.map((s) => s.name).join(', '));
check('all maxAlt > 5°', tonight.every((s) => s.maxAlt > 5));

// Spot-check other dates across the year: always 4.
for (const iso of ['2026-01-15T13:00:00Z', '2026-04-15T13:00:00Z', '2026-07-15T13:00:00Z', '2026-09-15T13:00:00Z']) {
  const t = tonightConstellations(new Date(iso));
  check(`4 constellations on ${iso.slice(0, 10)}`, t.length === 4, t.map((s) => s.name).join(', '));
}

// VTT builder.
const vtt = buildChaptersVtt(
  [
    { name: 'Orion', epithet: 'The Hunter' },
    { name: 'Crux', epithet: 'The Southern Cross' },
  ],
  [0, 30, 60],
);
check(
  'VTT format',
  vtt.startsWith('WEBVTT') &&
    vtt.includes('00:00:00.000 --> 00:00:30.000') &&
    vtt.includes('Crux · The Southern Cross'),
  JSON.stringify(vtt),
);

// Moon SVG: waxing crescent (phase 0.125) has a lit path; new moon none;
// full moon a full lit circle.
const crescent = moonSvg(0.125);
const newMoon = moonSvg(0);
const full = moonSvg(0.5);
check('crescent SVG has lit path', crescent.includes('<path') && crescent.includes('A 7.07'));
check('new-moon SVG has no lit path', !newMoon.includes('<path') && (newMoon.match(/<circle/g) || []).length === 1);
check('full-moon SVG has lit circle', (full.match(/<circle/g) || []).length === 2);

console.log(fails === 0 ? '\nALL SKY TESTS PASSED' : `\n${fails} FAILURES`);
process.exit(fails === 0 ? 0 : 1);
