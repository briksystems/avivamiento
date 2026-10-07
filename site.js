// site.js: todo menos la intro (header, menú, vistas, hero).
// script.js es la intro, aparte.

// año del footer
(function initFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

// alto real del header para el menú
(function initHeaderHeight() {
  const header = document.querySelector('.topbar');
  if (!header) return;

  function setHeaderVar() {
    document.documentElement.style.setProperty('--header-h', header.offsetHeight + 'px');
  }

  setHeaderVar();
  window.addEventListener('resize', setHeaderVar);
  window.addEventListener('load', setHeaderVar);
})();

// menú: hover en mouse, click en touch
(function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const panel = document.getElementById('menu-panel');
  if (!toggle || !panel) return;

  // en touch el hover queda pegado, por eso solo con mouse real
  const canHover = matchMedia('(hover: hover)').matches;

  let closeTimer = null;

  function closeMenu() {
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function openMenu() {
    clearTimeout(closeTimer);
    panel.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  }
  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeMenu, 150);
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('open') ? closeMenu() : openMenu();
  });

  if (canHover) {
    toggle.addEventListener('mouseenter', openMenu);
    toggle.addEventListener('mouseleave', scheduleClose);
    panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    panel.addEventListener('mouseleave', scheduleClose);
  }

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });

  window.__closeMegaMenus = closeMenu;
})();

// cruces del menú: exclusivas por nivel (grandes entre sí, doradas entre sí)
(function initMenuGroups() {
  function closeGroup(group) {
    group.dataset.open = 'false';
    const btn = group.querySelector(':scope > .menu-group-head > .menu-group-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'false');
  }
  function openGroup(group) {
    group.dataset.open = 'true';
    const btn = group.querySelector(':scope > .menu-group-head > .menu-group-toggle');
    if (btn) btn.setAttribute('aria-expanded', 'true');
  }
  function siblingsOf(group) {
    const parentGroup = group.parentElement.closest('.menu-group');
    if (!parentGroup) {
      // una grande: hermanas son las otras 4
      return Array.from(document.querySelectorAll('.menu-panel > .menu-col > .menu-group'));
    }
    // una dorada: hermanas son las demás doradas de su misma grande
    return Array.from(group.parentElement.querySelectorAll(':scope > .menu-group'));
  }

  document.querySelectorAll('.menu-group-toggle').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const group = btn.closest('.menu-group');
      const wasOpen = group.dataset.open === 'true';

      siblingsOf(group).forEach((sib) => {
        if (sib !== group) closeGroup(sib);
      });

      wasOpen ? closeGroup(group) : openGroup(group);
    });
  });
})();

// cambia de .view; si el link trae data-stop, salta directo a esa parada
(function initViewNav() {
  const views = document.querySelectorAll('.view');
  const backBtn = document.getElementById('back-home');
  if (!views.length || !backBtn) return;

  const validIds = Array.from(views).map((v) => v.dataset.viewId);

  function switchView(id, stopIndex) {
    if (!validIds.includes(id)) id = 'inicio';

    views.forEach((view) => {
      view.classList.toggle('active', view.dataset.viewId === id);
    });

    backBtn.classList.toggle('visible', id !== 'inicio');

    if (window.__closeMegaMenus) window.__closeMegaMenus();

    window.scrollTo({ top: 0, behavior: 'auto' });
    history.replaceState(null, '', '#' + id);

    const controller = window.__stopSections && window.__stopSections[id];
    if (controller && typeof stopIndex === 'number') controller.goTo(stopIndex);

    document.dispatchEvent(new CustomEvent('site:viewchange', { detail: { id } }));
  }

  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      const stopIndex = el.dataset.stop !== undefined ? Number(el.dataset.stop) : undefined;
      switchView(el.dataset.view, stopIndex);
    });
  });

  backBtn.addEventListener('click', () => switchView('inicio'));

  window.addEventListener('hashchange', () => {
    switchView((location.hash || '#inicio').slice(1));
  });

  switchView((location.hash || '#inicio').slice(1));
})();

// paradas genéricas: rueda/dedo mueve .stop uno a uno, con pausa en cada una
(function initStopSections() {
  const sections = document.querySelectorAll('.stops');
  if (!sections.length) return;

  window.__stopSections = window.__stopSections || {};

  const WHEEL_TO_STEP = 640;
  const TOUCH_TO_STEP = 190;
  const FOLLOW = 0.16;
  const PAUSE_MS = 550;
  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  sections.forEach((container) => {
    const stops = Array.from(container.querySelectorAll(':scope > .stop'));
    const view = container.closest('.view');
    if (!stops.length || !view) return;
    const viewId = view.dataset.viewId;

    let target = 0;
    let shown = 0;
    let rafId = null;
    let lastTouchY = null;
    let pausedAt = null;
    let pauseSince = null;
    const MAX = stops.length - 1;

    // flechas de más arriba/abajo, generadas por JS para no repetirlas en el HTML
    const navUp = document.createElement('button');
    navUp.type = 'button';
    navUp.className = 'stop-nav stop-nav--up';
    navUp.setAttribute('aria-label', 'Anterior');
    navUp.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5l-7 7h4v7h6v-7h4z" fill="currentColor"/></svg>';
    const navDown = document.createElement('button');
    navDown.type = 'button';
    navDown.className = 'stop-nav stop-nav--down';
    navDown.setAttribute('aria-label', 'Siguiente');
    navDown.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 19l7-7h-4V5h-6v7H5z" fill="currentColor"/></svg>';
    container.appendChild(navUp);
    container.appendChild(navDown);

    function updateNav() {
      const i = Math.round(shown);
      navUp.hidden = i <= 0;
      navDown.hidden = i >= MAX;
    }

    function paint() {
      const diff = target - shown;
      shown = Math.abs(diff) < 0.001 ? target : shown + diff * FOLLOW;
      stops.forEach((el, i) => {
        el.style.transform = `translateY(${(i - shown) * 100}%)`;
      });
      updateNav();
      if (shown !== target) {
        rafId = requestAnimationFrame(paint);
      } else {
        rafId = null;
      }
    }

    function addDelta(fraction) {
      const before = target;

      if (pausedAt !== null && Math.abs(before - pausedAt) < 0.0005) {
        if (performance.now() - pauseSince < PAUSE_MS) return;
        pausedAt = null;
      }

      let next = clamp(before + fraction, 0, MAX);
      if (fraction > 0) {
        const hit = Math.ceil(before + 0.0005);
        if (hit <= next && hit > before) {
          next = hit;
          pausedAt = hit;
          pauseSince = performance.now();
        }
      } else if (fraction < 0) {
        const hit = Math.floor(before - 0.0005);
        if (hit >= next && hit < before) {
          next = hit;
          pausedAt = hit;
          pauseSince = performance.now();
        }
      }

      target = next;
      if (target !== before && rafId === null) {
        rafId = requestAnimationFrame(paint);
      }
    }

    navUp.addEventListener('click', () => addDelta(-1));
    navDown.addEventListener('click', () => addDelta(1));

    container.addEventListener('wheel', (e) => {
      const goingDown = e.deltaY > 0;
      const shouldCapture = (goingDown && target < MAX) || (!goingDown && target > 0);
      if (shouldCapture) {
        e.preventDefault();
        addDelta(e.deltaY / WHEEL_TO_STEP);
      }
    }, { passive: false });

    container.addEventListener('touchstart', (e) => {
      lastTouchY = e.touches[0].clientY;
    }, { passive: true });

    container.addEventListener('touchmove', (e) => {
      if (lastTouchY === null) return;
      const y = e.touches[0].clientY;
      const delta = lastTouchY - y;
      const goingDown = delta > 0;
      const shouldCapture = (goingDown && target < MAX) || (!goingDown && target > 0);
      if (shouldCapture) {
        e.preventDefault();
        addDelta(delta / TOUCH_TO_STEP);
      }
      lastTouchY = y;
    }, { passive: false });

    container.addEventListener('touchend', () => { lastTouchY = null; });

    paint();

    window.__stopSections[viewId] = {
      goTo(index) {
        target = clamp(index, 0, MAX);
        shown = target;
        pausedAt = null;
        paint();
      }
    };
  });
})();

// el hero de Inicio: foto -> video actual -> versículo -> predica.mp4 ->
// horarios (con botón "Ver prédica"), todo automático y sin rueda ni dedo.
// Al llegar a horarios, si el usuario se queda ahí, aparece la flecha para
// bajar manualmente a eventos.
(function initHeroReveal() {
  const heroReveal = document.getElementById('hero-reveal');
  const videoActual = heroReveal && heroReveal.querySelector('.hero-video:not(.hero-video--predica) video');
  const videoPredica = heroReveal && heroReveal.querySelector('.hero-video--predica video');
  if (!heroReveal) return;

  const PHASE = 2 / 3;             // dura cada tramo
  // foto→video, video→versículo, versículo→predica, predica→horarios, horarios→eventos
  const MAX_PROGRESS = PHASE * 5;
  const WHEEL_TO_END = 640;
  const TOUCH_TO_END = 190;
  const FOLLOW_MANUAL = 0.16; // velocidad con rueda/dedo, ya manual
  const AT_END_THRESHOLD = MAX_PROGRESS - 0.02;

  let target = 0;
  let shown = 0;
  let follow = FOLLOW_MANUAL;
  let rafId = null;
  let lastTouchY = null;
  let autoPlaying = true; // true mientras dura el recorrido automático

  const MID_CHECKPOINTS = [PHASE, PHASE * 2, PHASE * 3, PHASE * 4];
  let pausedAt = null;
  let pauseSince = null;
  const PAUSE_MS = 550;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  // flechitas, un tramo (PHASE) a la vez
  const navUp = document.createElement('button');
  navUp.type = 'button';
  navUp.className = 'stop-nav stop-nav--up';
  navUp.setAttribute('aria-label', 'Anterior');
  navUp.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5l-7 7h4v7h6v-7h4z" fill="currentColor"/></svg>';
  const navDown = document.createElement('button');
  navDown.type = 'button';
  navDown.className = 'stop-nav stop-nav--down';
  navDown.setAttribute('aria-label', 'Siguiente');
  navDown.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 19l7-7h-4V5h-6v7H5z" fill="currentColor"/></svg>';
  heroReveal.appendChild(navUp);
  heroReveal.appendChild(navDown);

  function updateNav() {
    // mientras es automático no hay nada que clickear todavía
    navUp.hidden = autoPlaying || shown <= 0.02;
    navDown.hidden = autoPlaying || shown >= MAX_PROGRESS - 0.02;
  }

  // "ya no hay más" solo importa en Inicio
  function updateAtEnd() {
    const activeView = document.querySelector('.view.active');
    const isInicio = activeView && activeView.dataset.viewId === 'inicio';
    document.body.classList.toggle('hero-at-end', isInicio && shown >= AT_END_THRESHOLD);
  }

  document.addEventListener('site:viewchange', updateAtEnd);

  // aplica las variables CSS según "shown", sin tocar el reloj de nadie
  function applyVisual() {
    const fade = clamp(shown / PHASE, 0, 1);                       // tramo 1: foto -> video actual
    const reveal = clamp((shown - PHASE) / PHASE, 0, 1);           // tramo 2: sube el versículo
    const predica = clamp((shown - PHASE * 2) / PHASE, 0, 1);      // tramo 3: cambia a predica.mp4
    const exit = clamp((shown - PHASE * 3) / PHASE, 0, 1);         // tramo 4: versículo sale, suben horarios
    const events = clamp((shown - PHASE * 4) / PHASE, 0, 1);       // tramo 5: horarios salen, suben eventos

    heroReveal.style.setProperty('--fade', String(fade));
    heroReveal.style.setProperty('--reveal', String(reveal));
    heroReveal.style.setProperty('--predica', String(predica));
    heroReveal.style.setProperty('--exit', String(exit));
    heroReveal.style.setProperty('--schedule', String(exit));
    heroReveal.style.setProperty('--events', String(events));
    updateAtEnd();
    updateNav();
  }

  // bucle normal, para cuando ya es manual (rueda/dedo)
  function render() {
    const diff = target - shown;
    shown = Math.abs(diff) < 0.001 ? target : shown + diff * follow;
    applyVisual();
    rafId = shown !== target ? requestAnimationFrame(render) : null;
  }

  function kick() {
    if (rafId === null) rafId = requestAnimationFrame(render);
  }

  // avance con duración fija y entrada/salida suave, para el recorrido automático
  function tweenTo(value, duration) {
    return new Promise((resolve) => {
      const from = shown;
      const t0 = performance.now();
      (function step(now) {
        const t = Math.min((now - t0) / duration, 1);
        shown = from + (value - from) * easeInOutCubic(t);
        target = shown;
        applyVisual();
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      })(performance.now());
    });
  }
  const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

  async function autoPlayIntro() {
    await wait(900);
    await tweenTo(PHASE, 3400);           // foto -> video actual, lento: que se note que hay foto
    await wait(300);
    await tweenTo(PHASE * 2, 1200);        // sube el versículo, rápido
    await wait(350);
    await tweenTo(PHASE * 3, 1300);        // cambia a predica.mp4, rápido
    await wait(300);
    await tweenTo(PHASE * 4, 1300);        // versículo sale, suben horarios + botón, rápido
    autoPlaying = false;
    follow = FOLLOW_MANUAL;
    updateNav(); // acá aparece la flecha hacia eventos
  }

  function addDelta(fraction) {
    if (autoPlaying) return; // sin rueda ni dedo durante el recorrido automático
    const before = target;

    if (pausedAt !== null && Math.abs(before - pausedAt) < 0.0005) {
      if (performance.now() - pauseSince < PAUSE_MS) return;
      pausedAt = null;
    }

    let next = clamp(before + fraction, 0, MAX_PROGRESS);

    if (fraction > 0) {
      const hit = MID_CHECKPOINTS.find((c) => before < c - 0.0005 && next >= c - 0.0005);
      if (hit !== undefined) {
        next = hit;
        pausedAt = hit;
        pauseSince = performance.now();
      }
    } else if (fraction < 0) {
      const hit = MID_CHECKPOINTS.find((c) => before > c + 0.0005 && next <= c + 0.0005);
      if (hit !== undefined) {
        next = hit;
        pausedAt = hit;
        pauseSince = performance.now();
      }
    }

    target = next;
    if (target !== before) kick();
  }

  navUp.addEventListener('click', () => addDelta(-PHASE));
  navDown.addEventListener('click', () => addDelta(PHASE));

  heroReveal.addEventListener('wheel', (e) => {
    if (autoPlaying) { e.preventDefault(); return; }
    const goingDown = e.deltaY > 0;
    const shouldCapture = (goingDown && target < MAX_PROGRESS) || (!goingDown && target > 0);
    if (shouldCapture) {
      e.preventDefault();
      addDelta(e.deltaY / WHEEL_TO_END);
    }
  }, { passive: false });

  heroReveal.addEventListener('touchstart', (e) => {
    lastTouchY = e.touches[0].clientY;
  }, { passive: true });

  heroReveal.addEventListener('touchmove', (e) => {
    if (autoPlaying) { e.preventDefault(); return; }
    if (lastTouchY === null) return;
    const y = e.touches[0].clientY;
    const delta = lastTouchY - y;
    const goingDown = delta > 0;
    const shouldCapture = (goingDown && target < MAX_PROGRESS) || (!goingDown && target > 0);
    if (shouldCapture) {
      e.preventDefault();
      addDelta(delta / TOUCH_TO_END);
    }
    lastTouchY = y;
  }, { passive: false });

  heroReveal.addEventListener('touchend', () => { lastTouchY = null; });

  applyVisual(); // estado inicial

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // directo a horarios, sin recorrido automático
    autoPlaying = false;
    target = PHASE * 4;
    shown = PHASE * 4;
    applyVisual();
  } else {
    autoPlaying = true;
    autoPlayIntro();
  }

  // por si el navegador bloquea el autoplay de los videos
  [videoActual, videoPredica].forEach((v) => {
    if (!v) return;
    const tryPlay = () => { v.play().catch(() => {}); };
    tryPlay();
    heroReveal.addEventListener('wheel', tryPlay, { once: true, passive: true });
    heroReveal.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  });
})();

// Canal ABN en vivo: hls.js para los navegadores que no leen m3u8 solos
(function initAbnLive() {
  const video = document.getElementById('abn-live-video');
  if (!video) return;

  const src = 'https://s3.abntelevision.com:443/avivamientoabr/stream/playlist.m3u8?avcb=1790890452563';

  function start() {
    if (video.canPlayType('application/vnd.apple.mpegurl')) {
      video.src = src; // Safari, nativo
      return;
    }
    if (window.Hls && window.Hls.isSupported()) {
      const hls = new window.Hls();
      hls.loadSource(src);
      hls.attachMedia(video);
    }
  }

  if (window.Hls) {
    start();
  } else {
    // hls.js llega por CDN desde index.html; si tarda, reintenta una vez cargado
    const check = setInterval(() => {
      if (window.Hls) { clearInterval(check); start(); }
    }, 200);
  }
})();

// whatsapp: aparece cuando termina la intro
(function initWhatsapp() {
  const wa = document.querySelector('.wa-float');
  const veil = document.getElementById('veil');
  if (!wa) return;
  const done = () => !veil || veil.style.display === 'none';
  if (done()) { wa.classList.add('show'); return; }
  const obs = new MutationObserver(() => {
    if (done()) { wa.classList.add('show'); obs.disconnect(); }
  });
  obs.observe(veil, { attributes: true, attributeFilter: ['style'] });
})();