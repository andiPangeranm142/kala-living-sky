// KALA Living Observatory verification: living sky, real moon, tonight's
// constellations, sky panel, frame-step, keyboard-only use, ?time=/?date=.
// Serve dist/ first, e.g. `python3 -m http.server 4173` in dist/.
// Run: node tools/check-living.cjs [baseUrl] [outDir]
// Uses the video-recorder project's Playwright + the IPv6 egress-proxy
// forwarder recipe (Chromium cannot use the proxy directly).
const { chromium } = require('/home/hatch/workspace/codegeist/video-recorder/node_modules/playwright');
const fs = require('fs');
const net = require('net');
const dns = require('dns').promises;

const BASE = process.argv[2] || 'http://localhost:4173';
const OUT = process.argv[3] || '/tmp/kala-living-check';
fs.mkdirSync(OUT, { recursive: true });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const log = (s) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${s}`);

async function startForwarder(localPort = 3129) {
  const raw = process.env.https_proxy || process.env.HTTPS_PROXY || '';
  const u = new URL(raw);
  const target = await dns.lookup(u.hostname, { family: 6 });
  const server = net.createServer((client) => {
    const upstream = net.connect({ host: target.address, port: Number(u.port) || 3128 });
    client.pipe(upstream);
    upstream.pipe(client);
    const onErr = () => { client.destroy(); upstream.destroy(); };
    client.on('error', onErr);
    upstream.on('error', onErr);
  });
  await new Promise((resolve, reject) => {
    server.listen(localPort, '127.0.0.1', resolve);
    server.on('error', reject);
  });
  return server;
}

const results = [];
function check(name, ok, detail = '') {
  results.push({ name, ok, detail });
  log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
}

const NEW_MUX_ID = 'kcQpP01h01aVPjB7IA01kZHw5vvE5gMK1pX7fgF7C4rmBw';

const videoState = () => {
  const player = document.querySelector('video-player');
  const media = player?.querySelector('mux-video, video');
  const video = media?.tagName === 'VIDEO' ? media : media?.shadowRoot?.querySelector('video');
  return {
    hasPlayer: !!player,
    mediaTag: media?.tagName,
    muxSrc: media?.getAttribute('src') || '',
    readyState: video?.readyState,
    paused: video?.paused,
    currentTime: video?.currentTime,
    duration: video?.duration,
  };
};

(async () => {
  const forwarder = await startForwarder();
  const browser = await chromium.launch({
    proxy: { server: 'http://127.0.0.1:3129', bypass: 'localhost,127.0.0.1' },
    args: ['--autoplay-policy=no-user-gesture-required'],
  });

  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    ignoreHTTPSErrors: true,
    timezoneId: 'Asia/Jakarta',
    locale: 'en-US',
  });
  const page = await ctx.newPage();
  const consoleErrors = [];
  page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()); });
  page.on('pageerror', (e) => consoleErrors.push(`PAGEERROR: ${e.message}`));

  // ── 1. Player-only page: load + Mux stream + auto sky ──────────────────
  await page.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  await page.waitForFunction(() => {
    const player = document.querySelector('video-player');
    const media = player?.querySelector('mux-video, video');
    const video = media?.tagName === 'VIDEO' ? media : media?.shadowRoot?.querySelector('video');
    return (video?.readyState || 0) >= 2;
  }, { timeout: 30000 }).catch(() => {});
  await sleep(1500);

  let st = await page.evaluate(videoState);
  check('player mounts', st.hasPlayer);
  check('media is mux-video', st.mediaTag === 'MUX-VIDEO', st.mediaTag);
  check('Mux src is the NEW entry-2 asset', st.muxSrc.includes(NEW_MUX_ID), st.muxSrc);
  check('video data loaded (readyState>=2)', (st.readyState || 0) >= 2, `readyState=${st.readyState}`);
  check('duration is ~120s (daylight)', Math.abs((st.duration || 0) - 120) < 2, `duration=${st.duration}`);

  const skyInfo = await page.evaluate(() => {
    const container = document.querySelector('media-container');
    const now = new Date();
    const h = now.getHours() + now.getMinutes() / 60;
    const expected = h >= 5 && h < 7 ? 'dawn' : h >= 7 && h < 17 ? 'day' : h >= 17 && h < 19 ? 'dusk' : 'night';
    return { dataSky: container?.getAttribute('data-sky'), hour: now.getHours(), expected };
  });
  check('auto sky matches local time', skyInfo.dataSky === skyInfo.expected, `data-sky=${skyInfo.dataSky} hour=${skyInfo.hour} expected=${skyInfo.expected}`);

  // ── 2. Moon thumb ──────────────────────────────────────────────────────
  const thumb = await page.evaluate(() => {
    const t = document.querySelector('.media-time-slider-thumb');
    return {
      hasMoonClass: t?.classList.contains('kala-moon-thumb'),
      hasSvg: !!t?.querySelector('svg'),
      svgHtml: t?.querySelector('svg')?.outerHTML.slice(0, 120) || '',
    };
  });
  check('moon thumb has kala-moon-thumb class', !!thumb.hasMoonClass);
  check('moon thumb renders an SVG moon', !!thumb.hasSvg, thumb.svgHtml);

  // ── 3. Play, then chapter label (constellations) ───────────────────────
  await page.locator('.video-controls-center-play').click();
  await sleep(2500);
  st = await page.evaluate(videoState);
  check('video plays after click', !st.paused && (st.currentTime || 0) > 0, `paused=${st.paused} t=${st.currentTime}`);

  const chapterLabel = await page.evaluate(() => document.querySelector('.kala-chapter-label')?.textContent || '');
  const CONSTELLATIONS = ['Orion', 'Crux', 'Centaurus', 'Carina', 'Vela', 'Cetus', 'Aquarius', 'Pisces', 'Taurus', 'Gemini', 'Canis Major', 'Scorpius', 'Sagittarius', 'Aquila', 'Cygnus', 'Lyra', 'Pegasus', 'Andromeda', 'Leo', 'Virgo', 'Hydra', 'Corvus', 'Libra', 'Ursa Major'];
  check('chapter label names a real constellation', /^Ch 0\d · /.test(chapterLabel) && CONSTELLATIONS.some((c) => chapterLabel.includes(c)), chapterLabel);

  const chapters = await page.evaluate(() => {
    const media = document.querySelector('mux-video, video');
    const track = media?.querySelector('track[kind="chapters"]');
    const cues = [];
    try {
      const tracks = media.textTracks;
      for (const tr of Array.from(tracks || [])) {
        if (tr.kind === 'chapters' && tr.cues) {
          for (const c of Array.from(tr.cues)) cues.push(c.text);
        }
      }
    } catch { /* ignore */ }
    return { trackSrc: track?.getAttribute('src') || '', isBlob: (track?.getAttribute('src') || '').startsWith('blob:'), cues };
  });
  check('chapters track is the dynamic blob VTT', chapters.isBlob, chapters.trackSrc.slice(0, 40));
  check('4 constellation chapter cues', chapters.cues.length === 4 && chapters.cues.every((c) => CONSTELLATIONS.some((n) => c.includes(n))), JSON.stringify(chapters.cues));

  // Controls auto-hide while the mouse is idle during playback; wake them
  // before clicking anything in the bar (a real user does this by moving
  // the mouse — the test has to do it explicitly).
  const wakeControls = async () => {
    await page.mouse.move(640, 400);
    await sleep(400);
  };

  // ── 4. Tonight's sky panel ─────────────────────────────────────────────
  await wakeControls();
  await page.locator('.kala-sky-button').click();
  await sleep(500);
  const panel = await page.evaluate(() => {
    const p = document.querySelector('.kala-sky-panel');
    if (!p) return null;
    const style = getComputedStyle(p);
    return {
      visible: !p.hasAttribute('hidden') && style.display !== 'none',
      moonName: p.querySelector('[data-kala-moon-name]')?.textContent || '',
      moonMeta: p.querySelector('[data-kala-moon-meta]')?.textContent || '',
      moonrise: p.querySelector('[data-kala-moonrise]')?.textContent || '',
      moonset: p.querySelector('[data-kala-moonset]')?.textContent || '',
      liveSky: p.querySelector('[data-kala-live-sky]')?.textContent || '',
      stars: Array.from(p.querySelectorAll('[data-kala-stars] li')).map((li) => li.textContent),
      hasMoonArt: !!p.querySelector('[data-kala-moon-art] svg'),
      expanded: document.querySelector('.kala-sky-button')?.getAttribute('aria-expanded'),
    };
  });
  check('sky panel opens', !!panel?.visible, JSON.stringify(panel));
  check('panel shows First Quarter (17 Nov)', panel?.moonName === 'First Quarter', panel?.moonName);
  check('panel shows illumination 40-60% (first quarter)', /[4-5]\d% lit/.test(panel?.moonMeta || ''), panel?.moonMeta);
  check('panel shows moonrise/moonset estimates', /\(est\.\)/.test(panel?.moonrise || '') && /\(est\.\)/.test(panel?.moonset || ''), `${panel?.moonrise} / ${panel?.moonset}`);
  check('panel shows live sky + local time', /^(Dawn|Day|Dusk|Night) · \d\d:\d\d$/.test(panel?.liveSky || ''), panel?.liveSky);
  check('panel lists 4 constellations incl. Crux', (panel?.stars.length || 0) === 4 && panel.stars.some((s) => s.includes('Crux')), JSON.stringify(panel?.stars));
  check('panel has moon art', !!panel?.hasMoonArt);
  check('moon button aria-expanded=true', panel?.expanded === 'true');
  await page.screenshot({ path: `${OUT}/panel-open.png` });

  // Esc closes + focus returns to the trigger.
  await page.keyboard.press('Escape');
  await sleep(300);
  const afterEsc = await page.evaluate(() => ({
    hidden: document.querySelector('.kala-sky-panel')?.hasAttribute('hidden'),
    focusIsTrigger: document.activeElement?.classList.contains('kala-sky-button'),
    expanded: document.querySelector('.kala-sky-button')?.getAttribute('aria-expanded'),
  }));
  check('Esc closes panel, focus returns to trigger', !!afterEsc.hidden && !!afterEsc.focusIsTrigger && afterEsc.expanded === 'false', JSON.stringify(afterEsc));

  // ── 5. Frame step ──────────────────────────────────────────────────────
  await wakeControls();
  await page.locator('.kala-bar-play').click(); // pause
  await sleep(400);
  const t0 = (await page.evaluate(videoState)).currentTime;
  await page.keyboard.press('.');
  await sleep(400);
  const t1 = (await page.evaluate(videoState)).currentTime;
  await page.keyboard.press('.');
  await sleep(400);
  const t2 = (await page.evaluate(videoState)).currentTime;
  await page.keyboard.press(',');
  await sleep(400);
  const t3 = (await page.evaluate(videoState)).currentTime;
  const pausedAfter = (await page.evaluate(videoState)).paused;
  check('frame step forward ≈ +1/30s', Math.abs((t1 - t0) - 1 / 30) < 0.012, `${t0?.toFixed(3)} → ${t1?.toFixed(3)}`);
  check('frame step forward again ≈ +1/30s', Math.abs((t2 - t1) - 1 / 30) < 0.012, `${t1?.toFixed(3)} → ${t2?.toFixed(3)}`);
  check('frame step back ≈ −1/30s', Math.abs((t3 - t2) + 1 / 30) < 0.012, `${t2?.toFixed(3)} → ${t3?.toFixed(3)}`);
  check('video stays paused during frame step', pausedAfter === true);

  // Frame step from playing pauses first.
  await wakeControls();
  await page.locator('.kala-bar-play').click(); // play
  await sleep(600);
  await page.keyboard.press('.');
  await sleep(400);
  const pausedAfterPlaying = (await page.evaluate(videoState)).paused;
  check('frame step pauses a playing video', pausedAfterPlaying === true);

  // ── 6. Keyboard guide + PiP button ─────────────────────────────────────
  await page.keyboard.press('?');
  await sleep(400);
  const guide = await page.evaluate(() => {
    const d = document.querySelector('.kala-kbd-dialog');
    return {
      visible: d && !d.hasAttribute('hidden'),
      hasFrameStep: (d?.textContent || '').includes('Frame step'),
      hasPip: (d?.textContent || '').includes('Picture-in-picture'),
    };
  });
  check('? opens keyboard guide', !!guide.visible);
  check('guide documents frame step', !!guide.hasFrameStep);
  check('guide documents PiP', !!guide.hasPip);
  await page.keyboard.press('Escape');
  await sleep(300);

  const pip = await page.evaluate(() => {
    const btn = document.querySelector('.media-pip-button');
    return { exists: !!btn, label: btn?.getAttribute('aria-label') || '' };
  });
  check('PiP button exists', pip.exists, pip.label);

  // ── 7. Tab order (keyboard-only reachability) ──────────────────────────
  await page.evaluate(() => document.querySelector('media-container')?.focus?.());
  await page.keyboard.press('Tab');
  const order = [];
  for (let i = 0; i < 26; i++) {
    await page.keyboard.press('Tab');
    await sleep(100);
    const label = await page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return '(body)';
      return el.getAttribute('aria-label') || `${el.tagName}.${String(el.className).split(' ')[0]}`;
    });
    order.push(label);
  }
  log(`tab order: ${JSON.stringify(order)}`);
  const mustReach = ["Tonight's sky", 'Keyboard shortcuts', 'Settings', 'Play', 'Mute'];
  for (const m of mustReach) {
    check(`Tab reaches "${m}"`, order.some((o) => o.includes(m.replace('Play', 'Play')) || o === m || (m === 'Play' && /Play|Pause/.test(o))));
  }

  // ── 8. ?time= themes + ?date= moon ─────────────────────────────────────
  const themeCases = [
    ['06:30', 'dawn'],
    ['12:00', 'day'],
    ['18:00', 'dusk'],
    ['22:00', 'night'],
    ['04:59', 'night'],
    ['05:00', 'dawn'],
  ];
  for (const [time, expected] of themeCases) {
    await page.goto(`${BASE}/preview.html?time=${time}`, { waitUntil: 'domcontentloaded' });
    await page.waitForSelector('video-player', { timeout: 30000 });
    await sleep(800);
    const got = await page.evaluate(() => document.querySelector('media-container')?.getAttribute('data-sky'));
    check(`?time=${time} → ${expected}`, got === expected, `got ${got}`);
    await page.screenshot({ path: `${OUT}/theme-${expected}-${time.replace(':', '')}.png` });
  }

  // Full moon via ?date=2026-11-24.
  await page.goto(`${BASE}/preview.html?date=2026-11-24&time=21:00`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  await sleep(1200);
  await page.locator('.video-controls-center-play').click();
  await sleep(1500);
  await wakeControls();
  await page.locator('.kala-sky-button').click();
  await sleep(500);
  const fullMoon = await page.evaluate(() => ({
    name: document.querySelector('[data-kala-moon-name]')?.textContent,
    meta: document.querySelector('[data-kala-moon-meta]')?.textContent,
    sky: document.querySelector('media-container')?.getAttribute('data-sky'),
  }));
  check('?date=2026-11-24 shows Full Moon', fullMoon.name === 'Full Moon', `${fullMoon.name} / ${fullMoon.meta}`);
  check('?date=2026-11-24 illumination ~100%', /9[89]|100% lit/.test(fullMoon.meta || ''), fullMoon.meta);
  check('?time=21:00 → night', fullMoon.sky === 'night', fullMoon.sky);
  await page.screenshot({ path: `${OUT}/panel-full-moon.png` });

  // ── 9. Showcase page ───────────────────────────────────────────────────
  await page.goto(`${BASE}/`, { waitUntil: 'domcontentloaded' });
  await page.waitForSelector('video-player', { timeout: 30000 });
  await sleep(2000);
  const showcase = await page.evaluate(() => {
    const autoBtn = document.querySelector('#sky-switcher button[data-sky="auto"]');
    const muxBtn = document.querySelector('#footage-switcher button[data-footage="daylight-mux"]');
    const strip = document.querySelector('#tonight-strip');
    return {
      autoPressed: autoBtn?.getAttribute('aria-pressed'),
      muxPressed: muxBtn?.getAttribute('aria-pressed'),
      muxBtnVisible: muxBtn ? !muxBtn.hidden : false,
      stripMoon: strip?.querySelector('[data-kala-moon-name]')?.textContent || '',
      stripStars: Array.from(strip?.querySelectorAll('[data-kala-stars] li') || []).map((li) => li.textContent),
      stripMoonrise: strip?.querySelector('[data-kala-moonrise]')?.textContent || '',
      heroSky: document.querySelector('#hero-player media-container')?.getAttribute('data-sky'),
      bodySky: document.body.dataset.sky,
      hasStory: !!document.querySelector('#story'),
      hasAutoCard: !!document.querySelector('[data-sky-target="auto"]'),
    };
  });
  check('showcase: Auto pressed by default', showcase.autoPressed === 'true', showcase.autoPressed);
  check('showcase: Daylight·Mux button exists + pressed', showcase.muxBtnVisible && showcase.muxPressed === 'true', `visible=${showcase.muxBtnVisible} pressed=${showcase.muxPressed}`);
  check('showcase: tonight strip moon filled', showcase.stripMoon === 'First Quarter', showcase.stripMoon);
  check('showcase: tonight strip has 4 stars', showcase.stripStars.length === 4, JSON.stringify(showcase.stripStars));
  check('showcase: tonight strip moonrise filled', /\d\d:\d\d \(est\.\)/.test(showcase.stripMoonrise), showcase.stripMoonrise);
  check('showcase: hero sky = body sky (auto)', showcase.heroSky === showcase.bodySky, `hero=${showcase.heroSky} body=${showcase.bodySky}`);
  check('showcase: design-story section exists', showcase.hasStory);
  check('showcase: Auto sky card exists', showcase.hasAutoCard);
  await page.screenshot({ path: `${OUT}/showcase-hero.png`, fullPage: false });

  // Manual sky switch via card, then back to Auto.
  await page.locator('[data-sky-target="aurora"]').click();
  await sleep(600);
  const afterAurora = await page.evaluate(() => ({
    hero: document.querySelector('#hero-player media-container')?.getAttribute('data-sky'),
    pressed: document.querySelector('#sky-switcher button[data-sky="aurora"]')?.getAttribute('aria-pressed'),
  }));
  check('sky card switches to aurora', afterAurora.hero === 'aurora' && afterAurora.pressed === 'true', JSON.stringify(afterAurora));
  await page.locator('#sky-switcher button[data-sky="auto"]').click();
  await sleep(600);
  const afterAuto = await page.evaluate(() => document.querySelector('#hero-player media-container')?.getAttribute('data-sky'));
  check('Auto switch restores time-based sky', ['dawn', 'day', 'dusk', 'night'].includes(afterAuto || ''), afterAuto);

  // Footage switch keeps sky mode + chapters regenerate.
  await page.locator('#footage-switcher button[data-footage="cosmic-dawn"]').click();
  await sleep(2500);
  const afterFootage = await page.evaluate(() => {
    const player = document.querySelector('#hero-player video-player');
    const media = player?.querySelector('mux-video, video');
    const track = media?.querySelector('track[kind="chapters"]');
    return {
      title: player?.getAttribute('content-title'),
      trackIsBlob: (track?.getAttribute('src') || '').startsWith('blob:'),
      sky: player?.querySelector('media-container')?.getAttribute('data-sky'),
    };
  });
  check('footage switch to Cosmic Dawn keeps auto sky', ['dawn', 'day', 'dusk', 'night'].includes(afterFootage.sky || ''), JSON.stringify(afterFootage));
  check('footage switch regenerates blob chapters', afterFootage.trackIsBlob === true);

  // ── 10. Mobile viewport ────────────────────────────────────────────────
  const mob = await browser.newContext({
    viewport: { width: 390, height: 844 },
    ignoreHTTPSErrors: true,
    timezoneId: 'Asia/Jakarta',
    isMobile: true,
    hasTouch: true,
  });
  const mpage = await mob.newPage();
  await mpage.goto(`${BASE}/preview.html`, { waitUntil: 'domcontentloaded' });
  await mpage.waitForSelector('video-player', { timeout: 30000 });
  await sleep(2000);
  await mpage.locator('.video-controls-center-play').click();
  await sleep(2000);
  const mobState = await mpage.evaluate(videoState);
  check('mobile: video plays', !mobState.paused, `paused=${mobState.paused}`);
  await mpage.screenshot({ path: `${OUT}/mobile-player.png` });
  await mob.close();

  // ── Console errors ─────────────────────────────────────────────────────
  const realErrors = consoleErrors.filter((e) => !/favicon/i.test(e));
  check('no console/page errors', realErrors.length === 0, realErrors.slice(0, 3).join(' | '));

  const failed = results.filter((r) => !r.ok);
  log(`\n${results.length - failed.length}/${results.length} checks passed, ${failed.length} failed`);
  if (failed.length) {
    for (const f of failed) log(`  FAILED: ${f.name} — ${f.detail}`);
  }
  await browser.close();
  forwarder.close();
  process.exit(failed.length === 0 ? 0 : 1);
})().catch((e) => {
  console.error('FATAL', e);
  process.exit(2);
});
