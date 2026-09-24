// site.js: todo lo que no es la intro (header, menú, navegación
// entre vistas, y el hero con foto/video/versículo).
// script.js (la intro) es un archivo separado, no se toca.

// año del footer
(function initFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

// alto real del header, para que el mega menú sepa dónde empezar
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

// menú: se abre con hover (mouse) o con un toque (touch)
(function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const panel = document.getElementById('menu-panel');
  if (!toggle || !panel) return;

  // en touch, tocar el botón dispara un "hover" sintético que
  // termina solo, disparando un mouseleave justo después y
  // cerrando el panel de una. Por eso el hover solo se usa en
  // dispositivos que de verdad tienen mouse.
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

// cada una de las 5 secciones grandes del menú empieza cerrada,
// mostrando solo el título; tocarlo despliega todo lo suyo de una
// vez (sus links propios y, si tiene, sus sub-secciones doradas
// con los suyos). Ninguna de las dos está atada a la otra, así que
// se pueden tener varias abiertas al mismo tiempo.
// cada cruz abre o cierra su propio grupo. Al abrir uno se cierran
// sus hermanos del mismo nivel: las 5 secciones grandes se
// excluyen entre sí (aunque cada una viva en su propia columna), y
// las doradas se excluyen entre sí, pero solo con sus hermanas
// dentro de la misma grande (una dorada y su grande no se pisan,
// las dos pueden quedar abiertas juntas).
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
      // una de las 5 grandes: sus hermanas son las otras 4, aunque
      // cada una viva en su propia columna
      return Array.from(document.querySelectorAll('.menu-panel > .menu-col > .menu-group'));
    }
    // una dorada: sus hermanas son las demás doradas dentro de la
    // misma grande, no la grande en sí
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

// navegación: cada sección es un .view, solo se muestra la .active.
// Algunas vistas además tienen "paradas" adentro (ver
// initStopSections más abajo): si el link que se clickeó trae
// data-stop, saltamos directo a esa parada en vez de a la primera.
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

    // si esta vista tiene paradas y nos dijeron a cuál ir, saltamos
    // ahí directo (si no, se queda en la primera, que es donde ya
    // estaba por defecto)
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

// paradas: el mismo recorrido de foto→video→versículo del hero,
// pero genérico, para cualquier sección con varias "pantallas"
// seguidas (.stop) dentro de un .stops. Sirve para las 9 secciones
// nuevas del menú (Conócenos, Ministerios, Visítanos, etc.) — cada
// una arma su propio recorrido con este mismo motor, sin repetir
// el código. Misma idea que el hero: "target" es a dónde vamos,
// "shown" lo persigue suave, y hay una pausa breve (en los dos
// sentidos) en cada parada para que cada una tenga su momento
// quieto antes de seguir.
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

    // las dos flechas, chiquitas, para quien no se dé cuenta de que
    // se puede seguir bajando (o subiendo). Se crean por JS para no
    // repetir el mismo HTML en las 9 secciones.
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

// el hero: foto → video → versículo → horarios → eventos, todo con
// la misma rueda/dedo, nunca con el scroll normal de la página.
// Cuatro tramos seguidos, nunca al mismo tiempo:
//   1. fade:   se difumina la foto y aparece el video
//   2. reveal: sube el versículo
//   3. exit:   el versículo sale y suben los horarios
//   4. events: los horarios salen y sube el aviso de eventos
// "target" es a dónde vamos (lo mueve la rueda al instante).
// "shown" es lo que se pinta, y persigue a "target" cuadro a
// cuadro para que el movimiento sea fluido y no a saltos.
(function initHeroReveal() {
  const heroReveal = document.getElementById('hero-reveal');
  const video = document.querySelector('.hero-video video');
  if (!heroReveal) return;

  const PHASE = 2 / 3;             // cuánto dura cada tramo
  const MAX_PROGRESS = PHASE * 4;  // los cuatro tramos, uno detrás del otro
  const WHEEL_TO_END = 640;  // cuánto scroll hace falta
  const TOUCH_TO_END = 190;  // px de dedo necesarios
  const FOLLOW = 0.16;       // qué tanto se acerca "shown" a "target" cada frame
  const AT_END_THRESHOLD = MAX_PROGRESS - 0.02; // desde aquí ya es "el final"

  let target = 0;
  let shown = 0;
  let rafId = null;
  let lastTouchY = null;

  // una pausa breve en cada parada del camino (fin del versículo,
  // fin de los horarios), en los dos sentidos: cada sección tiene
  // su propio momento quieto antes de seguir, tanto al bajar como
  // al subir. Nunca se suelta el scroll hacia la página: acá ya no
  // hay nada más abajo, todo (foto, video, versículo, horarios y
  // eventos) vive dentro de este mismo recorrido.
  const MID_CHECKPOINTS = [PHASE * 2, PHASE * 3];
  let pausedAt = null;
  let pauseSince = null;
  const PAUSE_MS = 550;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // mismas flechitas que en las paradas genéricas, un tramo (PHASE)
  // a la vez.
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
    navUp.hidden = shown <= 0.02;
    navDown.hidden = shown >= MAX_PROGRESS - 0.02;
  }

  // "ya no hay nada más" solo cuenta en Inicio, si el usuario ya
  // cambió de vista no tiene sentido que el menú se quede grande
  function updateAtEnd() {
    const activeView = document.querySelector('.view.active');
    const isInicio = activeView && activeView.dataset.viewId === 'inicio';
    document.body.classList.toggle('hero-at-end', isInicio && shown >= AT_END_THRESHOLD);
  }

  document.addEventListener('site:viewchange', updateAtEnd);

  function render() {
    const diff = target - shown;
    if (Math.abs(diff) < 0.001) {
      shown = target;
    } else {
      shown += diff * FOLLOW;
    }

    const fade = clamp(shown / PHASE, 0, 1);
    const reveal = clamp((shown - PHASE) / PHASE, 0, 1);
    const exit = clamp((shown - PHASE * 2) / PHASE, 0, 1);
    const events = clamp((shown - PHASE * 3) / PHASE, 0, 1);
    heroReveal.style.setProperty('--reveal', String(reveal));
    heroReveal.style.setProperty('--exit', String(exit));
    heroReveal.style.setProperty('--fade', String(fade));
    heroReveal.style.setProperty('--events', String(events));
    updateAtEnd();
    updateNav();

    if (shown !== target) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = null;
    }
  }

  function addDelta(fraction) {
    const before = target;

    // seguimos sentados en una pausa? no importa para qué lado se
    // quiera mover, no avanza hasta que se cumpla el tiempo.
    if (pausedAt !== null && Math.abs(before - pausedAt) < 0.0005) {
      if (performance.now() - pauseSince < PAUSE_MS) return;
      pausedAt = null;
    }

    let next = clamp(before + fraction, 0, MAX_PROGRESS);

    if (fraction > 0) {
      const hit = MID_CHECKPOINTS.find((c) => before < c - 0.0005 && next >= c - 0.0005);
      if (hit !== undefined) {
        next = hit; // se clava justo ahí y arranca la pausa
        pausedAt = hit;
        pauseSince = performance.now();
      }
    } else if (fraction < 0) {
      const hit = MID_CHECKPOINTS.find((c) => before > c + 0.0005 && next <= c + 0.0005);
      if (hit !== undefined) {
        next = hit; // misma pausa, ahora subiendo
        pausedAt = hit;
        pauseSince = performance.now();
      }
    }

    target = next;
    if (target !== before && rafId === null) {
      rafId = requestAnimationFrame(render);
    }
  }

  navUp.addEventListener('click', () => addDelta(-PHASE));
  navDown.addEventListener('click', () => addDelta(PHASE));

  heroReveal.addEventListener('wheel', (e) => {
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
    if (lastTouchY === null) return;
    const y = e.touches[0].clientY;
    const delta = lastTouchY - y; // dedo sube = "baja" el contenido
    const goingDown = delta > 0;
    const shouldCapture = (goingDown && target < MAX_PROGRESS) || (!goingDown && target > 0);
    if (shouldCapture) {
      e.preventDefault();
      addDelta(delta / TOUCH_TO_END);
    }
    lastTouchY = y;
  }, { passive: false });

  heroReveal.addEventListener('touchend', () => { lastTouchY = null; });

  render(); // estado inicial, pase lo que pase con matchMedia

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // salta directo al versículo ya visible, sin animación de entrada
    target = PHASE * 2;
    shown = PHASE * 2;
    render();
  }

  // por si el navegador bloquea el autoplay del video, reintentamos
  // apenas el usuario mueve la rueda o el dedo por primera vez
  if (video) {
    const tryPlay = () => { video.play().catch(() => {}); };
    tryPlay();
    heroReveal.addEventListener('wheel', tryPlay, { once: true, passive: true });
    heroReveal.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  }
})();