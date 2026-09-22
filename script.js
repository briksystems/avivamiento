(function () {
  'use strict';

  // medidas del svg original del logo
  const LOGO_W = 1569.12, LOGO_H = 837.21;
  const LOGO_CX = LOGO_W / 2, LOGO_CY = LOGO_H / 2;
  const MARK_CX = 786,  MARK_CY = 232;   // centro de la llama

  // las perillas del efecto
  const BASE_WIDTH   = () => Math.min(innerWidth * 0.62, 620); // logo al inicio
  const ZOOM_END     = 90;    // cuánto crece el logo al final
  const WHEEL_TO_END = 1150;  // cuánto scroll hace falta
  const TOUCH_TO_END = 330;   // px de dedo necesarios
  const RECENTER_AT  = 0.35;  // aquí el zoom ya apunta a la llama
  const REVEAL_START = 0.25;  // aquí el círculo empieza a abrirse
  const REVEAL_END   = 0.48;  // aquí ya es un hueco puro
  const TEXT_FADE_END = 0.18; // el texto ya se fue antes de esto
  const FADE_FROM    = 0.80;  // desde aquí el velo empieza a irse
  const SNAP_AT      = 0.88;  // si sueltas aquí, se completa solo
  const IDLE_MS      = 170;

  const veil   = document.getElementById('veil');
  const holeUse   = document.getElementById('hole-use');    // el hueco de la máscara
  const solidUse  = document.getElementById('solid-use');   // el círculo sólido
  const textUse   = document.getElementById('text-use');    // "Avivamiento"
  const textUse2  = document.getElementById('text-use-2');  // el eslogan
  const hint   = document.getElementById('hint');
  const replay = document.getElementById('replay');

  let progress = 0, finished = false, idleTimer = null, lastY = null;

  const clamp = (v, a, b) => Math.min(Math.max(v, a), b);
  const easeOut = t => 1 - Math.pow(1 - t, 3);

  // traduce el progreso a la transformación del hueco
  function applyProgress() {
    const vw = innerWidth, vh = innerHeight;

    // escala geométrica, para que se sienta a velocidad constante
    const base  = BASE_WIDTH() / LOGO_W;
    const scale = base * Math.pow(ZOOM_END, progress);

    // el punto fijo en el centro va migrando del logo a la llama
    const k  = easeOut(clamp(progress / RECENTER_AT, 0, 1));
    const ax = LOGO_CX + (MARK_CX - LOGO_CX) * k;
    const ay = LOGO_CY + (MARK_CY - LOGO_CY) * k;

    const t = `translate(${vw / 2 - ax * scale} ${vh / 2 - ay * scale}) scale(${scale})`;
    holeUse.setAttribute('transform', t);
    solidUse.setAttribute('transform', t);
    textUse.setAttribute('transform', t);
    textUse2.setAttribute('transform', t);

    // el texto solo se desvanece, nunca es ventana
    const textFade = clamp(progress / TEXT_FADE_END, 0, 1);
    const textOpacity = String(1 - textFade);
    textUse.style.opacity = textOpacity;
    textUse2.style.opacity = textOpacity;

    // el círculo sólido se desvanece mientras el hueco se abre
    const open = clamp((progress - REVEAL_START) / (REVEAL_END - REVEAL_START), 0, 1);
    const grey = Math.round(255 * (1 - open));      // 255 = sin hueco, 0 = hueco total
    holeUse.setAttribute('fill', `rgb(${grey},${grey},${grey})`);
    solidUse.style.opacity = String(1 - open);

    // al final el velo se disuelve, sin bordes raros
    const fade = clamp((progress - FADE_FROM) / (1 - FADE_FROM), 0, 1);
    veil.style.opacity = String(1 - fade);
    hint.style.opacity = progress > 0.04 ? '0' : '';
  }

  function finish() {
    if (finished) return;
    finished = true;
    veil.style.display = 'none';
    hint.style.display = 'none';
    document.body.style.overflow = 'auto';
    replay.classList.add('show');
  }

  function reset() {
    finished = false; progress = 0; lastY = null;
    veil.style.display = 'block';
    hint.style.display = '';
    document.body.style.overflow = 'hidden';
    replay.classList.remove('show');
    applyProgress();
  }

  function snapToEnd() {
    const from = progress, t0 = performance.now(), dur = 300;
    (function tick(now) {
      const t = Math.min((now - t0) / dur, 1);
      progress = from + (1 - from) * easeOut(t);
      applyProgress();
      if (t < 1) requestAnimationFrame(tick);
      else finish();
    })(performance.now());
  }

  function addDelta(fraction) {
    if (finished) return;
    progress = clamp(progress + fraction, 0, 1);
    applyProgress();
    if (progress >= 1) return finish();
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      if (progress >= SNAP_AT) snapToEnd();
    }, IDLE_MS);
  }

  veil.addEventListener('wheel', e => {
    e.preventDefault();
    addDelta(e.deltaY / WHEEL_TO_END);
  }, { passive: false });

  veil.addEventListener('touchstart', e => { lastY = e.touches[0].clientY; }, { passive: true });
  veil.addEventListener('touchmove', e => {
    if (finished || lastY === null) return;
    e.preventDefault();
    const y = e.touches[0].clientY;
    addDelta((lastY - y) / TOUCH_TO_END);
    lastY = y;
  }, { passive: false });
  veil.addEventListener('touchend', () => { lastY = null; });

  // teclado y usuarios que piden menos movimiento
  addEventListener('keydown', e => {
    if (finished) return;
    if (e.key === 'Escape') { progress = 1; applyProgress(); finish(); }
    if (e.key === 'ArrowDown' || e.key === ' ') { e.preventDefault(); addDelta(0.08); }
  });
  addEventListener('resize', applyProgress);
  replay.addEventListener('click', reset);

  if (matchMedia('(prefers-reduced-motion: reduce)').matches) {
    progress = 1; applyProgress(); finish();
  } else {
    applyProgress();
  }
})();