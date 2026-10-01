(() => {
  const root = document.documentElement;
  root.classList.add('js');
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  document.getElementById('year').textContent = new Date().getFullYear();

  // Scroll reveal, with a small stagger for siblings entering together
  const revealIO = new IntersectionObserver((entries) => {
    entries.filter((e) => e.isIntersecting).forEach((e, i) => {
      e.target.style.setProperty('--d', `${Math.min(i * 0.08, 0.32)}s`);
      e.target.classList.add('is-in');
      revealIO.unobserve(e.target);
    });
  }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
  document.querySelectorAll('.reveal').forEach((el) => revealIO.observe(el));

  // Count-up stats
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (!e.isIntersecting) return;
      const el = e.target;
      const target = Number(el.dataset.count);
      const suffix = el.dataset.suffix || '';
      countIO.unobserve(el);
      if (reduceMotion) { el.textContent = target + suffix; return; }
      const start = performance.now();
      const dur = 1600;
      const tick = (now) => {
        const t = Math.min((now - start) / dur, 1);
        const eased = 1 - Math.pow(1 - t, 4);
        el.textContent = Math.round(target * eased) + suffix;
        if (t < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });
  }, { threshold: 0.6 });
  document.querySelectorAll('[data-count]').forEach((el) => countIO.observe(el));

  // Hero video: load only on wider screens with motion allowed and no data-saver
  const video = document.querySelector('.hero__video');
  const saveData = navigator.connection && navigator.connection.saveData;
  if (video && !reduceMotion && !saveData && innerWidth > 680) {
    video.src = video.dataset.src;
    video.addEventListener('playing', () => video.classList.add('is-playing'), { once: true });
    video.play().catch(() => {});
  }

  // Before / after slider
  document.querySelectorAll('.ba').forEach((ba) => {
    const range = ba.querySelector('.ba__range');
    const set = (v) => ba.style.setProperty('--pos', `${v}%`);
    range.addEventListener('input', () => set(range.value));
    // One-time "hint" sweep when it first appears
    if (!reduceMotion) {
      const hintIO = new IntersectionObserver(([e]) => {
        if (!e.isIntersecting) return;
        hintIO.disconnect();
        const start = performance.now();
        const sweep = (now) => {
          if (range.dataset.touched) return;
          const t = Math.min((now - start) / 1800, 1);
          const v = 50 + Math.sin(t * Math.PI * 2) * 18 * (1 - t);
          set(v); range.value = v;
          if (t < 1) requestAnimationFrame(sweep);
        };
        setTimeout(() => requestAnimationFrame(sweep), 500);
      }, { threshold: 0.6 });
      hintIO.observe(ba);
      range.addEventListener('pointerdown', () => { range.dataset.touched = '1'; });
    }
  });

  // Process timeline progress
  const steps = document.querySelector('.steps');
  if (steps) {
    const items = [...steps.querySelectorAll('.step')];
    let ticking = false;
    const update = () => {
      ticking = false;
      const r = steps.getBoundingClientRect();
      const mid = innerHeight * 0.6;
      const p = Math.max(0, Math.min(1, (mid - r.top) / r.height));
      steps.style.setProperty('--progress', p.toFixed(3));
      items.forEach((it) => {
        const ir = it.getBoundingClientRect();
        it.classList.toggle('is-lit', ir.top + 28 < mid);
      });
    };
    addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    update();
  }

  // Demo form: until a real endpoint is set, show an inline message instead of posting
  const form = document.querySelector(".form");
  if (form && form.action.includes("REPLACE_ME")) {
    form.addEventListener("submit", (e) => {
      e.preventDefault();
      form.querySelector(".form__status").textContent =
        "Thanks! (Demo site — on the live site this request goes straight to the owner's inbox.)";
    });
  }
})();
