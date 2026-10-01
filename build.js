/* "Watch it get built" — pinned scroll animation at the top of the page.
   One sticky stage. Scroll progress drives a timeline of moves and holds; each hold is a stop with its own
   words. The canvas draws WebP frames (frames/desktop or frames/mobile), always the nearest one already
   loaded, so it is never blank. Frames start loading after the page has loaded, so the first screen
   (a still picture, the headline and both buttons) is never held up. */
(() => {
  const root = document.querySelector('[data-build]');
  if (!root) return;

  const COUNT = 198;                                   // frames per set (8 per second of video)
  const STOPS = [0, 26, 58, 86, 113, 165, 181, 197];   // frame index of each stop, matching the .beat blocks
  const HOLD = 0.9;                                    // scroll weight of a pause at each stop
  const MOVE = 1 / 9;                                  // scroll weight per frame of movement

  const canvas = root.querySelector('.build__canvas');
  const ctx = canvas.getContext('2d');
  const beats = [...root.querySelectorAll('.beat')];
  const bar = root.querySelector('.build__progress span');
  const hint = root.querySelector('.build__hint');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const saveData = navigator.connection && navigator.connection.saveData;

  if (reduce || saveData) {                            // still picture and the first words only
    root.classList.add('is-static');
    return;
  }

  /* ---------- timeline: hold, move, hold, move ... hold ---------- */
  const segs = [];
  STOPS.forEach((f, i) => {
    segs.push({ from: f, to: f, w: HOLD, stop: i });
    if (i < STOPS.length - 1) segs.push({ from: f, to: STOPS[i + 1], w: (STOPS[i + 1] - f) * MOVE });
  });
  const total = segs.reduce((s, x) => s + x.w, 0);
  let acc = 0;
  segs.forEach((s) => { s.start = acc / total; acc += s.w; s.end = acc / total; });
  const ease = (t) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);
  function locate(p) {
    const s = segs.find((x) => p <= x.end) || segs[segs.length - 1];
    const t = s.end > s.start ? (p - s.start) / (s.end - s.start) : 0;
    return { frame: s.from + (s.to - s.from) * ease(Math.min(1, Math.max(0, t))), seg: s };
  }
  // scroll position (0..1) of the middle of each stop's pause, for the preview buttons
  const stopAt = STOPS.map((_, i) => { const s = segs.find((x) => x.stop === i); return (s.start + s.end) / 2; });
  root.dataset.stops = stopAt.map((x) => x.toFixed(4)).join(',');   // read by the test script

  /* ---------- frames ---------- */
  const phone = matchMedia('(max-width: 680px)');
  let set = phone.matches ? 'mobile' : 'desktop';
  const frames = { desktop: [], mobile: [] };
  const src = (i) => `frames/${set}/f${String(i + 1).padStart(3, '0')}.webp`;
  function load(i, priority) {
    const list = frames[set];
    if (list[i]) return;
    const img = new Image();
    img.decoding = 'async';
    if ('fetchPriority' in img) img.fetchPriority = priority;
    img.onload = () => { img.ready = true; if (Math.abs(i - current) < 12) draw(true); };
    img.src = src(i);
    list[i] = img;
  }
  let restStarted = false;
  function loadFirst() {                                      // pass 1: every 8th frame and the stops, about 0.7 MB
    for (let i = 0; i < COUNT; i += 8) load(i, 'high');
    STOPS.forEach((i) => load(i, 'high'));
  }
  function loadAll() {
    loadFirst();
    if (restStarted) return;
    restStarted = true;
    let i = 0;
    const next = () => {                                      // pass 2: the rest, a few at a time
      for (let n = 0; n < 6 && i < COUNT; i++) { if (!frames[set][i]) { load(i, 'low'); n++; } }
      if (i < COUNT) setTimeout(next, 60);
    };
    next();
  }
  function nearestReady(f) {
    const list = frames[set];
    for (let d = 0; d < COUNT; d++) {
      const a = list[f - d], b = list[f + d];
      if (a && a.ready) return a;
      if (b && b.ready) return b;
    }
    return null;
  }

  /* ---------- drawing ---------- */
  let current = 0, drawn = -1, w = 0, h = 0, pageLoaded = false;
  function size() {
    const dpr = Math.min(devicePixelRatio || 1, 1.5);
    w = canvas.clientWidth; h = canvas.clientHeight;
    canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    drawn = -1; draw(true);
  }
  function draw(force) {
    const f = Math.round(current);
    if (!force && f === drawn) return;
    const img = nearestReady(f);
    if (!img) return;
    const s = Math.max(w / img.naturalWidth, h / img.naturalHeight);    // cover, centred
    const dw = img.naturalWidth * s, dh = img.naturalHeight * s;
    ctx.drawImage(img, (w - dw) / 2, (h - dh) / 2, dw, dh);
    drawn = f;
    root.classList.add('is-live');
  }

  /* ---------- scroll ---------- */
  let active = 0;
  function progress() {
    const r = root.getBoundingClientRect();
    const run = r.height - innerHeight;
    return run > 0 ? Math.min(1, Math.max(0, -r.top / run)) : 0;
  }
  function update() {
    ticking = false;
    const p = progress();
    const { frame } = locate(p);
    current = frame;
    draw(false);
    if (bar) bar.style.transform = `scaleX(${p})`;
    if (hint) hint.classList.toggle('is-gone', p > 0.01);
    // the words belong to the stop whose pause is nearest
    let best = 0;
    stopAt.forEach((sp, i) => { if (Math.abs(sp - p) < Math.abs(stopAt[best] - p)) best = i; });
    const near = Math.abs(stopAt[best] - p) < (HOLD / total) * 1.6;
    const want = near ? best : -1;
    if (want !== active) {
      beats.forEach((b, i) => {
        const on = i === want;
        b.classList.toggle('is-on', on);
        b.querySelectorAll('a, button').forEach((el) => { el.tabIndex = on ? 0 : -1; });
      });
      active = want;
    }
    if (scrub && document.activeElement !== scrub) scrub.value = Math.round(p * 1000);
  }
  let ticking = false;
  addEventListener('scroll', () => {
    if (!restStarted && pageLoaded) loadAll();              // pass 2 waits for the visitor to start scrolling
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  addEventListener('resize', () => { size(); update(); });
  phone.addEventListener('change', () => { set = phone.matches ? 'mobile' : 'desktop'; restStarted = false; if (pageLoaded) loadFirst(); drawn = -1; update(); });

  /* ---------- preview controls, only when the page is shown inside another page ---------- */
  let scrub = null;
  const framed = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();
  if (framed) {
    const box = root.querySelector('.build__scrub');
    box.hidden = false;
    scrub = box.querySelector('input');
    const top = () => root.getBoundingClientRect().top + scrollY;
    const run = () => root.offsetHeight - innerHeight;
    const go = (p) => scrollTo({ top: top() + p * run(), behavior: 'smooth' });
    scrub.addEventListener('input', () => scrollTo({ top: top() + (scrub.value / 1000) * run() }));
    box.querySelector('[data-next]').addEventListener('click', () => {
      const p = progress(); const n = stopAt.find((s) => s > p + 0.005); go(n === undefined ? 1 : n);
    });
    box.querySelector('[data-prev]').addEventListener('click', () => {
      const p = progress(); const n = [...stopAt].reverse().find((s) => s < p - 0.005); go(n === undefined ? 0 : n);
    });
  }

  size();
  update();
  const start = () => { pageLoaded = true; loadFirst(); if (progress() > 0) loadAll(); };
  if (document.readyState === 'complete') start();
  else addEventListener('load', () => setTimeout(start, 150), { once: true });
})();
