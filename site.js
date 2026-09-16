// ============================================================
// site.js — TODO lo que no es la intro: header, mega menú,
// navegación entre vistas, y el panel del versículo del hero.
// Un solo archivo aparte de script.js (la intro), que no se toca.
// ============================================================


// ---- Año del footer ----
(function initFooterYear() {
  const yearEl = document.getElementById('year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();
})();

// ---- Altura real del header, para que el mega menú sepa dónde
//      empezar (se guarda en --header-h) ----
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

// ---- Menú móvil (hamburguesa) ----
(function initMobileMenu() {
  const toggle = document.getElementById('menu-toggle');
  const panel = document.getElementById('menu-panel');
  if (!toggle || !panel) return;

  function closeMenu() {
    panel.classList.remove('open');
    toggle.setAttribute('aria-expanded', 'false');
  }
  function openMenu() {
    panel.classList.add('open');
    toggle.setAttribute('aria-expanded', 'true');
  }

  toggle.addEventListener('click', (e) => {
    e.stopPropagation();
    panel.classList.contains('open') ? closeMenu() : openMenu();
  });

  document.addEventListener('click', (e) => {
    if (!panel.contains(e.target) && !toggle.contains(e.target)) closeMenu();
  });

  panel.querySelectorAll('a').forEach((link) => {
    link.addEventListener('click', closeMenu);
  });

  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeMenu();
  });
})();

// ---- Mega menú: se abre al pasar el mouse sobre un item con
//      data-mega. Un pequeño retraso al salir evita que se cierre
//      por accidente al mover el mouse en diagonal hacia el panel. ----
(function initMegaMenu() {
  const items = document.querySelectorAll('.menu-panel li.has-mega');
  const panels = document.querySelectorAll('.mega-menu');
  const CLOSE_DELAY_MS = 150;
  let closeTimer = null;

  function openPanel(key) {
    clearTimeout(closeTimer);
    panels.forEach((panel) => {
      panel.classList.toggle('open', panel.dataset.megaPanel === key);
    });
  }

  function closeAllPanels() {
    panels.forEach((panel) => panel.classList.remove('open'));
  }

  function scheduleClose() {
    clearTimeout(closeTimer);
    closeTimer = setTimeout(closeAllPanels, CLOSE_DELAY_MS);
  }

  items.forEach((li) => {
    const key = li.dataset.mega;
    li.addEventListener('mouseenter', () => openPanel(key));
    li.addEventListener('mouseleave', scheduleClose);
    // Un usuario de teclado no dispara mouseenter: al tabular hasta el
    // link del ítem, abrimos el mismo panel que abriría el mouse.
    li.querySelectorAll('a').forEach((link) => {
      link.addEventListener('focus', () => openPanel(key));
      link.addEventListener('blur', scheduleClose);
    });
  });

  panels.forEach((panel) => {
    panel.addEventListener('mouseenter', () => clearTimeout(closeTimer));
    panel.addEventListener('mouseleave', scheduleClose);
    // Si el foco entra a un link DENTRO del panel (el usuario sigue
    // tabulando hacia adelante), lo mantenemos abierto.
    panel.addEventListener('focusin', () => clearTimeout(closeTimer));
    // Si el foco sale del panel y no entra a otro elemento con mega
    // menú, lo cerramos igual que con el mouse.
    panel.addEventListener('focusout', scheduleClose);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeAllPanels();
  });

  window.__closeMegaMenus = closeAllPanels;
})();

// ---- Navegación entre vistas: cada sección vive en un .view y solo
//      la que tiene .active se muestra. Clic en el menú = misma
//      pestaña, sin recargar nada. ----
(function initViewNav() {
  const views = document.querySelectorAll('.view');
  const backBtn = document.getElementById('back-home');
  if (!views.length || !backBtn) return;

  const validIds = Array.from(views).map((v) => v.dataset.viewId);

  function switchView(id) {
    if (!validIds.includes(id)) id = 'inicio';

    views.forEach((view) => {
      view.classList.toggle('active', view.dataset.viewId === id);
    });

    backBtn.classList.toggle('visible', id !== 'inicio');

    if (window.__closeMegaMenus) window.__closeMegaMenus();

    window.scrollTo({ top: 0, behavior: 'auto' });
    history.replaceState(null, '', '#' + id);

    document.dispatchEvent(new CustomEvent('site:viewchange', { detail: { id } }));
  }

  document.querySelectorAll('[data-view]').forEach((el) => {
    el.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(el.dataset.view);
    });
  });

  backBtn.addEventListener('click', () => switchView('inicio'));

  window.addEventListener('hashchange', () => {
    switchView((location.hash || '#inicio').slice(1));
  });

  switchView((location.hash || '#inicio').slice(1));
})();


// ============================================================
(function initHeroReveal() {
  const heroReveal = document.getElementById('hero-reveal');
  const video = document.querySelector('.hero-video video');
  if (!heroReveal) return;

  // Todo el recorrido tiene TRES tramos, uno detrás del otro (nunca
  // superpuestos):
  //   1. "fade":   la foto de los pastores se difumina y aparece el
  //      video de fondo. El versículo todavía no se ve.
  //   2. "reveal": recién ahí el panel del versículo sube desde
  //      abajo hasta su lugar (centro de pantalla).
  //   3. "exit":   el panel sigue subiendo, se desvanece, y solo
  //      queda el video de fondo (en loop para siempre, eso lo hace
  //      el atributo loop del <video>, no este script). Al llegar
  //      al final de este tramo se agranda el menú (más abajo).
  // "target" es a dónde queremos llegar (lo mueve la rueda/el dedo,
  // de forma instantánea). "shown" es lo que realmente se pinta en
  // pantalla, y persigue a "target" un poco cada frame en vez de
  // saltar directo a él — así el movimiento queda fluido incluso
  // cuando la rueda entrega el scroll en saltos grandes y poco
  // frecuentes (el "cortado" que se sentía antes).
  const MAX_PROGRESS = 2;
  const WHEEL_TO_END = 640;  // cuánto scroll hace falta (antes 900, se sentía lento)
  const TOUCH_TO_END = 190;  // px de dedo necesarios (antes 260)
  const FOLLOW = 0.16;       // qué tanto se acerca "shown" a "target" cada frame
  // Los tres tramos ya NO se superponen: primero termina el
  // difuminado de la foto (0 → PHASE), y solo después empieza a
  // aparecer el versículo (PHASE → 2·PHASE), y solo después empieza
  // la salida (2·PHASE → MAX_PROGRESS), donde también crece el menú
  // al llegar al final. Uno espera a que el anterior termine.
  const PHASE = MAX_PROGRESS / 3;
  // A partir de qué tan cerca del final (MAX_PROGRESS) se considera
  // "ya no hay nada más" y se agrega body.hero-at-end.
  const AT_END_THRESHOLD = MAX_PROGRESS - 0.02;

  let target = 0;
  let shown = 0;
  let rafId = null;
  let lastTouchY = null;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);

  // "Ya no hay nada más" = se llegó al final del recorrido Y la
  // vista activa es Inicio (si el usuario cambia de vista con el
  // menú, no tiene sentido que el menú se quede grande en Reuniones
  // o Contacto). site:viewchange (disparado por initViewNav) llama
  // esto también, para que el cambio de vista lo actualice al toque
  // aunque no haya scroll de por medio.
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
    heroReveal.style.setProperty('--reveal', String(reveal));
    heroReveal.style.setProperty('--exit', String(exit));
    heroReveal.style.setProperty('--fade', String(fade));
    updateAtEnd();

    if (shown !== target) {
      rafId = requestAnimationFrame(render);
    } else {
      rafId = null;
    }
  }

  function addDelta(fraction) {
    const before = target;
    target = clamp(target + fraction, 0, MAX_PROGRESS);
    if (target !== before && rafId === null) {
      rafId = requestAnimationFrame(render);
    }
  }

  // Mientras el recorrido no ha terminado (target < 2) y el usuario
  // baja el mouse, capturamos el scroll (no se mueve la página, sube
  // o sale el panel). Si ya terminó, soltamos el scroll. Si el
  // usuario sube el mouse antes del final, lo dejamos "regresar"
  // antes de scrollear la página hacia arriba. Se compara contra
  // "target" (a dónde vamos), no "shown" (lo que ya se ve), para que
  // no se corte la captura mientras el suavizado todavía va llegando.
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
    const delta = lastTouchY - y; // positivo = dedo sube = "baja" el contenido
    const goingDown = delta > 0;
    const shouldCapture = (goingDown && target < MAX_PROGRESS) || (!goingDown && target > 0);
    if (shouldCapture) {
      e.preventDefault();
      addDelta(delta / TOUCH_TO_END);
    }
    lastTouchY = y;
  }, { passive: false });

  heroReveal.addEventListener('touchend', () => { lastTouchY = null; });

  render(); // estado inicial siempre, pase lo que pase con matchMedia

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    // Igual que antes: salta directo al versículo ya visible (foto
    // ya difuminada), sin la animación de entrada. La salida
    // (target > 2·PHASE) sigue disponible si el usuario sigue bajando.
    target = PHASE * 2;
    shown = PHASE * 2;
    render();
  }

  // ---- Autoplay del video de fondo ----
  // El navegador debería reproducirlo solo (está muteado), pero por
  // si algún navegador lo bloquea antes de cualquier gesto, lo
  // reintentamos apenas el usuario mueve la rueda o el dedo por
  // primera vez. loop y muted ya están en el HTML, así que esto solo
  // arranca la reproducción, nunca la reinicia.
  if (video) {
    const tryPlay = () => { video.play().catch(() => {}); };
    tryPlay();
    heroReveal.addEventListener('wheel', tryPlay, { once: true, passive: true });
    heroReveal.addEventListener('touchstart', tryPlay, { once: true, passive: true });
  }
})();