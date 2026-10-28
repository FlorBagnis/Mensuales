/* =========================================================
   VISOR DE PDF · extra para Mensuales
   Reemplaza la pestaña con el PDF "pelado" por un visor lindo:
   barra superior con título + "Descargar PDF" / "Abrir como PDF",
   y las hojas del informe centradas sobre un fondo del modo actual.
   Se adapta a: claro (rosa) · oscuro (bordó) · azul · black.
   No toca app.js ni changui.js. Funciona con TODOS los PDF de la app
   (mensual, anual, Changui, Pocki) porque se engancha en jsPDF.save.
   Si el visor no puede cargar (sin internet), cae al PDF directo.
========================================================= */
(() => {
  'use strict';

  const PDFJS = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
  const WORKER = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio',
    'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

  /* Paleta de cada modo (mismos colores que usa la app) */
  const THEMES = {
    light: {
      label: 'claro', scheme: 'light',
      bg: 'radial-gradient(900px 420px at 15% -5%, #ffd9e5 0%, transparent 60%), linear-gradient(180deg,#fff0f5,#fff7fa 45%,#ffeef3)',
      bar: 'rgba(255,255,255,.92)', line: '#f3c9d4', text: '#52162a', sub: '#8d737e',
      a1: '#ea5b8e', a2: '#c93b6e', onA: '#ffffff', glow: 'rgba(201,59,110,.35)',
      shadow: '0 18px 50px -18px rgba(201,59,110,.45), 0 2px 8px rgba(132,38,67,.08)',
      ghost: '#ffffff', ghostText: '#52162a', ghostLine: '#f0cbd7', ghostHover: '#fff3f7',
      frame: 'transparent', skel: '#fde3ea', skelHi: '#fff4f7', topline: 'linear-gradient(90deg,#ff9db4,#ea5b8e,#c93b6e)'
    },
    dark: {
      label: 'oscuro', scheme: 'dark',
      bg: 'radial-gradient(900px 420px at 15% -5%, #3a1822 0%, transparent 60%), linear-gradient(180deg,#150a0e,#1a0c11)',
      bar: 'rgba(30,15,23,.92)', line: '#3d1a24', text: '#f5e9ec', sub: '#b39299',
      a1: '#ff789f', a2: '#d94f7c', onA: '#2a0b16', glow: 'rgba(255,120,160,.28)',
      shadow: '0 20px 55px -18px rgba(0,0,0,.8), 0 0 0 1px #4a2138',
      ghost: '#241016', ghostText: '#f5e9ec', ghostLine: '#4a2138', ghostHover: '#2e1520',
      frame: '#241016', skel: '#2c141c', skelHi: '#3a1822', topline: 'linear-gradient(90deg,#8a2b4b,#ff789f,#d94f7c)'
    },
    blue: {
      label: 'azul', scheme: 'dark',
      bg: 'radial-gradient(900px 420px at 15% -5%, #0f2a5c 0%, transparent 60%), linear-gradient(180deg,#070d1e,#0a1530)',
      bar: 'rgba(11,22,48,.92)', line: '#1e356d', text: '#f1f5f9', sub: '#8fa5ca',
      a1: '#38bdf8', a2: '#0ea5e9', onA: '#04121f', glow: 'rgba(56,189,248,.32)',
      shadow: '0 20px 55px -18px rgba(0,0,0,.85), 0 0 0 1px #1e356d',
      ghost: '#0f1c3f', ghostText: '#f1f5f9', ghostLine: '#25427f', ghostHover: '#14264f',
      frame: '#0f1c3f', skel: '#10224a', skelHi: '#1a3166', topline: 'linear-gradient(90deg,#1d4ed8,#38bdf8,#0ea5e9)'
    },
    black: {
      label: 'black', scheme: 'dark',
      bg: 'radial-gradient(900px 420px at 15% -5%, #1c1c1c 0%, transparent 60%), #000000',
      bar: 'rgba(10,10,10,.94)', line: '#262626', text: '#ffffff', sub: '#a3a3a3',
      a1: '#ffffff', a2: '#d4d4d4', onA: '#000000', glow: 'rgba(255,255,255,.22)',
      shadow: '0 20px 55px -18px rgba(0,0,0,1), 0 0 0 1px #2e2e2e',
      ghost: '#0d0d0d', ghostText: '#ffffff', ghostLine: '#333333', ghostHover: '#1a1a1a',
      frame: '#0d0d0d', skel: '#141414', skelHi: '#232323', topline: 'linear-gradient(90deg,#404040,#ffffff,#a3a3a3)'
    }
  };

  /* "MENSUALES-2026-10.pdf" -> título + subtítulo lindos */
  function nombreLindo(name) {
    const base = String(name || 'documento.pdf').replace(/\.pdf$/i, '');
    const m = /^MENSUALES-(\d{4})-(\d{2})/i.exec(base);
    if (m) {
      const mes = MESES[Number(m[2]) - 1];
      return { title: 'Informe de gastos', detail: mes ? `${mes} ${m[1]}` : base };
    }
    const limpio = base.replace(/[-_]+/g, ' ').trim();
    return { title: limpio ? limpio.charAt(0).toUpperCase() + limpio.slice(1) : 'Documento', detail: '' };
  }

  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function pagina(cfg) {
    const T = THEMES[cfg.mode] || THEMES.light;
    const json = JSON.stringify({ url: cfg.url, name: cfg.name, pdfjs: PDFJS, worker: WORKER, dark: T.scheme === 'dark' })
      .replace(/</g, '\\u003c');
    const paginas = cfg.pages === 1 ? '1 página' : `${cfg.pages} páginas`;
    const sub = [cfg.detail, paginas, `modo ${T.label}`].filter(Boolean).join(' · ');

    const css = `
:root{color-scheme:${T.scheme};--text:${T.text};--sub:${T.sub};--line:${T.line};--a1:${T.a1};--a2:${T.a2};--onA:${T.onA};--glow:${T.glow}}
*{box-sizing:border-box}
html,body{margin:0;min-height:100%}
body{background:${T.bg};background-attachment:fixed;color:var(--text);font-family:system-ui,-apple-system,"Segoe UI",Roboto,Arial,sans-serif;-webkit-font-smoothing:antialiased}
.top{position:sticky;top:0;z-index:5;display:flex;align-items:center;justify-content:space-between;gap:12px;padding:12px max(16px,env(safe-area-inset-right)) 12px max(16px,env(safe-area-inset-left));padding-top:calc(12px + env(safe-area-inset-top,0px));background:${T.bar};backdrop-filter:blur(14px);-webkit-backdrop-filter:blur(14px);border-bottom:1px solid var(--line)}
.top::before{content:"";position:absolute;left:0;right:0;top:0;height:2px;background:${T.topline}}
.ttl{min-width:0}
.ttl h1{margin:0;font-size:1rem;font-weight:800;letter-spacing:.1px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.ttl p{margin:2px 0 0;font-size:.74rem;color:var(--sub);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.acts{display:flex;gap:10px;flex-shrink:0}
.btn{display:inline-flex;align-items:center;gap:8px;height:42px;padding:0 18px;border-radius:12px;font:inherit;font-size:.86rem;font-weight:800;cursor:pointer;text-decoration:none;border:1px solid transparent;transition:transform .15s ease,box-shadow .15s ease,background .15s ease,filter .15s ease}
.btn svg{width:17px;height:17px;flex-shrink:0;fill:none;stroke:currentColor;stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round}
.btn:active{transform:scale(.97)}
.btn:focus-visible{outline:2px solid var(--a1);outline-offset:2px}
.primary{color:var(--onA);background:linear-gradient(135deg,var(--a1),var(--a2));box-shadow:0 8px 20px -8px var(--glow)}
.primary:hover{filter:brightness(1.06);transform:translateY(-1px)}
.ghost{color:${T.ghostText};background:${T.ghost};border-color:${T.ghostLine}}
.ghost:hover{background:${T.ghostHover}}
.stage{display:flex;flex-direction:column;align-items:center;gap:22px;padding:28px 14px calc(48px + env(safe-area-inset-bottom,0px))}
.pg{position:relative;width:100%;max-width:720px;border-radius:18px;overflow:hidden;box-shadow:${T.shadow};background:${T.frame === 'transparent' ? '#fff' : T.frame};animation:in .45s ease both}
.pg canvas{display:block;width:100%;height:auto}
.pg .n{position:absolute;right:12px;bottom:10px;padding:3px 9px;border-radius:99px;font-size:.68rem;font-weight:700;color:var(--sub);background:${T.bar};border:1px solid var(--line);opacity:.9}
.skel{background:linear-gradient(100deg,${T.skel} 30%,${T.skelHi} 50%,${T.skel} 70%);background-size:220% 100%;animation:sh 1.3s linear infinite}
.msg{max-width:720px;width:100%;text-align:center;color:var(--sub);font-size:.92rem;padding:8px}
@keyframes sh{to{background-position:-120% 0}}
@keyframes in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (max-width:560px){.btn{padding:0 13px;height:40px}.btn .lg{display:none}.ttl h1{font-size:.95rem}.stage{padding-top:18px}.pg{border-radius:14px}}
@media (prefers-reduced-motion:reduce){.skel,.pg{animation:none}}`;

    const icoDown = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4v11M7.5 10.5L12 15l4.5-4.5M4.5 15v3.5a2 2 0 002 2h11a2 2 0 002-2V15"/></svg>';
    const icoOpen = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-9 9M18 14v4a2 2 0 01-2 2H6a2 2 0 01-2-2V8a2 2 0 012-2h4"/></svg>';

    const js = `
(function(){
  var C = JSON.parse(document.getElementById('cfg').textContent);
  var stage = document.getElementById('stage');
  var openBtn = document.getElementById('open');
  var pdf = null, resizeT = null, renderId = 0;
  openBtn.addEventListener('click', function(){ window.open(C.url, '_blank'); });
  function fail(){ try { location.replace(C.url); } catch(e){ stage.innerHTML = '<div class="msg">No pude armar la vista previa. Probá con "Abrir como PDF".</div>'; } }
  function skeletons(n, ratio){
    stage.innerHTML = '';
    for (var i = 0; i < n; i++){
      var d = document.createElement('div'); d.className = 'pg skel'; d.style.aspectRatio = ratio; stage.appendChild(d);
    }
  }
  async function draw(){
    var id = ++renderId;
    var first = await pdf.getPage(1), vp1 = first.getViewport({scale:1});
    skeletons(pdf.numPages, vp1.width + '/' + vp1.height);
    var cssW = Math.min(720, Math.max(240, window.innerWidth - 28));
    var dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    for (var p = 1; p <= pdf.numPages; p++){
      if (id !== renderId) return;
      var page = p === 1 ? first : await pdf.getPage(p);
      var base = page.getViewport({scale:1});
      var vp = page.getViewport({scale: (cssW / base.width) * dpr});
      var cv = document.createElement('canvas');
      cv.width = Math.floor(vp.width); cv.height = Math.floor(vp.height);
      await page.render({canvasContext: cv.getContext('2d'), viewport: vp}).promise;
      if (id !== renderId) return;
      var box = stage.children[p - 1];
      box.classList.remove('skel'); box.style.aspectRatio = '';
      box.innerHTML = ''; box.appendChild(cv);
      if (pdf.numPages > 1){ var n = document.createElement('span'); n.className = 'n'; n.textContent = p + ' / ' + pdf.numPages; box.appendChild(n); }
    }
  }
  var s = document.createElement('script');
  s.src = C.pdfjs;
  s.onerror = fail;
  s.onload = function(){
    try {
      pdfjsLib.GlobalWorkerOptions.workerSrc = C.worker;
      fetch(C.url).then(function(r){ return r.arrayBuffer(); }).then(function(buf){
        return pdfjsLib.getDocument({data: buf}).promise;
      }).then(function(doc){ pdf = doc; return draw(); }).catch(fail);
    } catch(e){ fail(); }
  };
  document.head.appendChild(s);
  window.addEventListener('resize', function(){
    clearTimeout(resizeT);
    resizeT = setTimeout(function(){ if (pdf) draw().catch(function(){}); }, 250);
  });
})();`;

    return '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">' +
      '<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">' +
      `<meta name="theme-color" content="${cfg.mode === 'light' ? '#ffffff' : '#000000'}">` +
      `<title>${esc(cfg.title)}${cfg.detail ? ' · ' + esc(cfg.detail) : ''}</title><style>${css}</style></head><body>` +
      '<header class="top"><div class="ttl">' +
      `<h1>${esc(cfg.title)}</h1><p>${esc(sub)}</p></div>` +
      '<div class="acts">' +
      `<a class="btn primary" id="dl" href="${esc(cfg.url)}" download="${esc(cfg.name)}">${icoDown}<span>Descargar<span class="lg"> PDF</span></span></a>` +
      `<button class="btn ghost" id="open" type="button">${icoOpen}<span>Abrir<span class="lg"> como PDF</span></span></button>` +
      '</div></header>' +
      '<main class="stage" id="stage"><div class="pg skel" style="aspect-ratio:210/297"></div></main>' +
      `<script type="application/json" id="cfg">${json}</scr` + 'ipt>' +
      `<scr` + `ipt>${js}</scr` + 'ipt></body></html>';
  }

  /* Lo llama el parche de jsPDF.save. Devuelve true si el visor quedó armado. */
  window.__abrirVisorPDF = function (w, opts) {
    try {
      if (!w || w.closed) return false;
      const n = nombreLindo(opts.name);
      const html = pagina({
        mode: opts.mode, url: opts.url, name: opts.name,
        pages: opts.pages || 1, title: n.title, detail: n.detail
      });
      w.document.open();
      w.document.write(html);
      w.document.close();
      return true;
    } catch (e) {
      console.warn('Visor PDF: no pude armarlo, uso el PDF directo', e);
      return false;
    }
  };

  window.__visorPDFTemas = THEMES; // por si querés ajustar colores desde la consola
})();
