/* =========================================================
   POCKI: AHORRANDO ANDO · metas de ahorro de Mensuales
   Creado by Flor Bagnis 💗

   Cómo calcula el tiempo:
   1) Sobrante mensual = promedio de (presupuesto − gastado) de los meses del Historial.
   2) Ese sobrante (en pesos) se reparte entre las metas sin cumplir que no tienen
      un ahorro por mes elegido a mano.
   3) Las metas en dólares se pasan con el dólar blue que ya muestra la app.
   Si la persona elige cuánto va a ahorrar por mes en una meta, se usa ese monto.

   Puente con app.js (window.PockiBridge), todo opcional:
     getMonthlySurplusARS()  -> sobrante mensual en pesos
     getDolar()              -> cotización del dólar
     getPdfTheme()           -> paleta de colores de los PDF de Mensuales
     addWithdrawal({...})    -> suma un retiro al presupuesto como "Ahorro"
========================================================= */
(() => {
  'use strict';

  const root = document.getElementById('pocki');
  if (!root) return;
  const $ = (s) => root.querySelector(s);

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 0 });
  const fmt = (n, cur) => (cur === 'USD' ? 'u$s ' : '$ ') + nf.format(Math.round(n));
  // Con "Ocultar montos" el CSS esconde el número y muestra los puntitos (con el color del modo activo)
  const money = (n, cur) => `<span class="pocki-amt"><span class="pocki-num">${fmt(n, cur)}</span><span class="pocki-dots" aria-hidden="true">••••••</span></span>`;

  // "1.500.000,50" -> 1500000.5 (misma convención que los campos de Mensuales)
  const parseAmount = (v) => {
    const s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  // Escribe "100000" y lo muestra como "100.000" (igual que en Mensuales)
  const formatAmountInput = (val) => {
    let clean = String(val ?? '').replace(/[^\d,]/g, '');
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');
    const [int, dec] = clean.split(',');
    const withDots = (int || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dec !== undefined ? `${withDots},${dec.slice(0, 2)}` : withDots;
  };
  // Lee el primer número de un texto como "$ 1.234,56"
  const readNum = (txt) => {
    const m = String(txt || '').match(/(\d[\d.]*(?:,\d+)?)/);
    if (!m) return null;
    const n = parseFloat(m[1].replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : null;
  };
  const monthLabel = (k) => {
    const d = new Date();
    d.setMonth(d.getMonth() + k);
    return d.toLocaleDateString('es-AR', { month: 'long', year: 'numeric' });
  };
  const timeText = (n) => {
    const y = Math.floor(n / 12), m = n % 12;
    return [y ? `${y} ${y === 1 ? 'año' : 'años'}` : '', m ? `${m} ${m === 1 ? 'mes' : 'meses'}` : ''].filter(Boolean).join(' y ');
  };
  // Para el PDF: sin etiquetas y sin emojis (el PDF solo admite letras latinas)
  const plain = (html) => String(html)
    .replace(/<\/strong>/g, '. ').replace(/<[^>]+>/g, '').replace(/&amp;/g, '&')
    .replace(/[^\x20-\xFF]/g, '').replace(/\s+/g, ' ').trim();

  /* ---------- guardado (por usuario, en este dispositivo) ----------
     Para sincronizar con Firebase, solo hay que cambiar load() y save(). */
  const userKey = () => 'pocki_metas_v1_' + ((document.getElementById('userEmail')?.textContent || '').trim().toLowerCase() || 'anon');
  let goals = [];
  function load() {
    try { goals = JSON.parse(localStorage.getItem(userKey()) || '[]'); } catch (e) { goals = []; }
    if (!Array.isArray(goals)) goals = [];
  }
  function save() {
    try { localStorage.setItem(userKey(), JSON.stringify(goals)); } catch (e) { /* sin guardado */ }
  }

  /* ---------- datos de Mensuales ---------- */
  function surplusARS() {
    const bridge = window.PockiBridge && window.PockiBridge.getMonthlySurplusARS;
    if (bridge) { const v = bridge(); if (typeof v === 'number' && Number.isFinite(v)) return v; }
    const vals = [];
    document.querySelectorAll('#historyTable tr').forEach((tr) => {
      const c = tr.cells;
      if (!c || c.length < 3) return;
      const presupuesto = readNum(c[1].textContent), gastado = readNum(c[2].textContent);
      if (presupuesto > 0 && gastado > 0) vals.push(presupuesto - gastado);
    });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  }
  function dolar() {
    const bridge = window.PockiBridge && window.PockiBridge.getDolar;
    if (bridge) { const v = bridge(); if (typeof v === 'number' && v > 0) return v; }
    const t = document.getElementById('dolarBadge')?.textContent || '';
    const m = t.match(/\$\s*(\d[\d.]*(?:,\d+)?)/);
    return m ? readNum(m[1]) : null;
  }
  function getCtx() {
    return {
      pool: surplusARS(),
      rate: dolar(),
      auto: goals.filter((g) => g.saved < g.target && !(g.monthly > 0)).length   // metas que se reparten el sobrante
    };
  }

  /* ---------- cálculo del tiempo ---------- */
  function calc(g, ctx) {
    const rem = Math.max(0, g.target - g.saved);
    if (rem === 0) return { kind: 'done', rem };
    const manual = g.monthly > 0;
    let perMonth;
    if (manual) perMonth = g.monthly;
    else {
      if (ctx.pool === null) return { kind: 'nodata', rem };
      if (ctx.pool <= 0) return { kind: 'neg', rem };
      const share = ctx.pool / Math.max(1, ctx.auto);
      if (g.cur === 'USD') {
        if (!ctx.rate) return { kind: 'norate', rem };
        perMonth = share / ctx.rate;
      } else perMonth = share;
    }
    const months = Math.ceil(rem / perMonth);
    return { kind: months > 600 ? 'far' : 'ok', rem, months, perMonth, manual };
  }

  function etaHTML(g, c, ctx) {
    switch (c.kind) {
      case 'done': return '<strong>Meta cumplida 🎉</strong>';
      case 'nodata': return 'Todavía no hay meses en tu Historial para calcular cuánto tardás. Si querés, elegí vos cuánto vas a ahorrar por mes.';
      case 'neg': return 'Tus gastos igualan o superan tu presupuesto, así que hoy no queda sobrante. Ajustá tu presupuesto o elegí cuánto vas a ahorrar por mes.';
      case 'norate': return 'Esperando la cotización del dólar blue para calcular esta meta.';
      case 'far': return '<strong>Con ese ahorro tardarías más de 50 años</strong>Probá bajar el monto de la meta o ahorrar más por mes.';
      default: {
        const quien = c.manual ? ' (el que elegiste)' : '';
        const dolarTxt = g.cur === 'USD' && !c.manual ? ` (al dólar blue de ${money(ctx.rate, 'ARS')})` : '';
        const reparto = !c.manual && ctx.auto > 1 ? ` Tu sobrante se reparte entre ${ctx.auto} metas.` : '';
        return `<strong>Llegás en ${timeText(c.months)}</strong>(${monthLabel(c.months)}), ahorrando ${money(c.perMonth, g.cur)} por mes${quien}${dolarTxt}.${reparto}`;
      }
    }
  }

  /* ---------- carteles ---------- */
  function alertFor(g) {
    const rem = Math.max(0, g.target - g.saved);
    if (g.target > 0 && rem === 0) return { kind: 'done', msg: '¡Llegaste a tu meta!' };
    if (g.alertAt > 0 && rem <= g.alertAt) return { msg: 'Te faltan solo', amount: rem };
    if (g.target > 0 && g.saved / g.target >= 0.9) return { msg: '¡Ya casi! Te faltan', amount: rem };
    return null;
  }
  let toastTimer;
  function toast(text) {
    const t = $('#pockiToast');
    if (!t) return;
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
  }

  /* ---------- dibujo ---------- */
  function goalHTML(g, ctx) {
    const c = calc(g, ctx);
    const pct = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
    const C = 2 * Math.PI * 52, shown = Math.floor(pct * 100);
    const a = alertFor(g);
    const banner = a ? `<div class="pocki-banner ${a.kind || ''}" role="status">${esc(a.msg)}${a.amount !== undefined ? ' ' + money(a.amount, g.cur) : ''}</div>` : '';
    const planValue = g.monthly > 0 ? formatAmountInput(String(g.monthly).replace('.', ',')) : '';
    return `
    <article class="pocki-goal" data-id="${g.id}">
      <div class="pocki-goal-head">
        <h3>${esc(g.name)}</h3>
        <button class="btn btn-outline pocki-del" type="button" data-act="del" aria-label="Eliminar meta ${esc(g.name)}">✕</button>
      </div>
      ${banner}
      <div class="pocki-ring">
        <svg viewBox="0 0 120 120" role="img" aria-label="${shown}% ahorrado de ${esc(g.name)}">
          <circle class="track" cx="60" cy="60" r="52"/>
          <circle class="prog" cx="60" cy="60" r="52" transform="rotate(-90 60 60)"
                  stroke-dasharray="${(C * pct).toFixed(2)} ${C.toFixed(2)}" style="${pct === 0 ? 'opacity:0' : ''}"/>
        </svg>
        <div class="center"><strong>${shown}%</strong><span>ahorrado</span></div>
      </div>
      <dl class="pocki-stats">
        <div><dt><i class="pocki-dot a"></i>Ahorrado</dt><dd>${money(g.saved, g.cur)}</dd></div>
        <div><dt><i class="pocki-dot t"></i>Falta</dt><dd>${money(c.rem, g.cur)}</dd></div>
      </dl>
      <p class="pocki-eta">${etaHTML(g, c, ctx)}</p>
      <div class="pocki-add">
        <input type="text" inputmode="decimal" placeholder="Monto" aria-label="Monto para ${esc(g.name)}">
        <button class="pastel-btn" type="button" data-act="add">Sumar</button>
        <button class="btn btn-outline" type="button" data-act="sub">Retirar</button>
      </div>
      <details class="pocki-plan">
        <summary>Ahorro por mes: ${g.monthly > 0 ? 'elegido por vos' : 'automático'}</summary>
        <div class="pocki-add">
          <input type="text" inputmode="decimal" placeholder="Cuánto vas a ahorrar" value="${planValue}" aria-label="Ahorro por mes para ${esc(g.name)}">
          <button class="pastel-btn" type="button" data-act="plan">Guardar</button>
          <button class="btn btn-outline" type="button" data-act="auto">Automático</button>
        </div>
      </details>
    </article>`;
  }

  function render() {
    const ctx = getCtx();

    const pills = [];
    if (ctx.pool === null) pills.push('Todavía no hay meses en tu Historial con presupuesto y gastos. Cuando los tengas, Pocki calcula cuánto podés ahorrar por mes.');
    else if (ctx.pool <= 0) pills.push('Tus gastos igualan o superan tu presupuesto: hoy no queda sobrante para ahorrar.');
    else pills.push(`🌸 Te sobran por mes ${money(ctx.pool, 'ARS')} (promedio de tu Historial)`);
    if (ctx.rate) pills.push(`💵 Dólar blue ${money(ctx.rate, 'ARS')}`);
    const committed = goals.filter((g) => g.saved < g.target && g.monthly > 0)
      .reduce((s, g) => s + (g.cur === 'USD' ? (ctx.rate ? g.monthly * ctx.rate : 0) : g.monthly), 0);
    if (ctx.pool > 0 && committed > ctx.pool) pills.push('⚠️ Entre tus metas apartás más de lo que te sobra por mes');
    $('#pockiInfo').innerHTML = pills.map((p) => `<span class="pocki-pill">${p}</span>`).join('');

    $('#pockiGoals').innerHTML = goals.length
      ? goals.map((g) => goalHTML(g, ctx)).join('')
      : '<div class="pocki-empty" style="grid-column: 1 / -1;"><div>🐷</div><strong>Todavía no tenés metas</strong><br><span>Tocá "Nueva meta" y Pocki te dice cuánto tardás.</span></div>';
  }

  /* ---------- exportar PDF (mismo diseño y colores que el PDF de Mensuales) ---------- */
  function exportPDF() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { toast('No se pudo cargar el generador de PDF. Revisá tu conexión.'); return; }
    if (!goals.length) { toast('Primero agregá una meta para exportar.'); return; }

    // Paleta de Mensuales (si el puente no está, usa la clara)
    let theme;
    try { theme = window.PockiBridge.getPdfTheme(); } catch (e) { theme = null; }
    if (!theme) theme = {
      pink: [234, 91, 142], dark: [82, 22, 42], light: [253, 232, 238], headerBg: [255, 174, 195],
      cardBorder: [246, 214, 223], lineDivider: [246, 214, 223], pageBg: null, footerColor: [125, 80, 98]
    };
    const isBlack = document.body.classList.contains('black-mode');

    const doc = new J({ unit: 'mm', format: 'a4' });
    const ctx = getCtx();
    const paintPage = () => { if (theme.pageBg) { doc.setFillColor(...theme.pageBg); doc.rect(0, 0, 210, 297, 'F'); } };
    const newPage = () => { doc.addPage(); paintPage(); return 20; };

    // Tiempo corto para la tabla
    const shortEta = (c) => {
      if (c.kind === 'done') return 'Cumplida';
      if (c.kind === 'far') return 'Mas de 50 anios';
      if (c.kind === 'ok') return timeText(c.months).replace(/ñ/g, 'n');
      return 'Sin datos';
    };

    paintPage();

    // Encabezado
    doc.setFillColor(...theme.headerBg);
    doc.roundedRect(15, 15, 180, 28, 4, 4, 'F');
    doc.setTextColor(...theme.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('POCKI: AHORRANDO ANDO', 21, 25);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Resumen de metas de ahorro - ' + new Date().toLocaleDateString('es-AR'), 21, 31);

    // Tarjetas
    const sum = (cur) => goals.filter((g) => g.cur === cur).reduce((s, g) => s + g.saved, 0);
    const cards = [
      ['SOBRANTE MENSUAL', ctx.pool === null ? '-' : ctx.pool <= 0 ? 'Sin sobrante' : fmt(ctx.pool, 'ARS')],
      ['DOLAR BLUE', ctx.rate ? fmt(ctx.rate, 'ARS') : '-'],
      ['AHORRADO (ARS)', fmt(sum('ARS'), 'ARS')],
      ['AHORRADO (USD)', fmt(sum('USD'), 'USD')]
    ];
    cards.forEach((card, i) => {
      const x = 15 + i * 45;
      doc.setDrawColor(...theme.cardBorder);
      doc.roundedRect(x, 49, 41, 25, 3, 3, 'S');
      doc.setTextColor(...theme.pink); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text(card[0], x + 3, 57);
      doc.setTextColor(...theme.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(card[1], x + 3, 65);
    });

    // Tabla de metas
    let y = 84;
    const tableHeader = () => {
      if (isBlack) doc.setFillColor(30, 30, 30); else doc.setFillColor(...theme.pink);
      doc.rect(15, y, 180, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('META', 18, y + 5);
      doc.text('AHORRADO', 62, y + 5);
      doc.text('FALTA', 92, y + 5);
      doc.text('OBJETIVO', 122, y + 5);
      doc.text('%', 150, y + 5);
      doc.text('LLEGAS EN', 160, y + 5);
      y += 8;
      doc.setFont('helvetica', 'normal');
    };
    tableHeader();

    goals.forEach((g) => {
      if (y > 230) { y = newPage(); tableHeader(); }
      const c = calc(g, ctx);
      const pct = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
      doc.setTextColor(...theme.dark); doc.setFontSize(7);
      doc.text(plain(g.name).slice(0, 26) || 'Meta', 18, y + 5);
      doc.text(fmt(g.saved, g.cur), 62, y + 5);
      doc.text(fmt(c.rem, g.cur), 92, y + 5);
      doc.text(fmt(g.target, g.cur), 122, y + 5);
      doc.text(Math.floor(pct * 100) + '%', 150, y + 5);
      doc.text(shortEta(c), 160, y + 5);
      doc.setDrawColor(...theme.lineDivider);
      doc.line(15, y + 8, 195, y + 8);
      y += 10;
    });

    // Estimación por meta
    y += 12;
    if (y > 220) y = newPage();
    doc.setTextColor(...theme.dark); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('ESTIMACION POR META', 15, y);
    y += 6;

    goals.forEach((g) => {
      const c = calc(g, ctx);
      const a = alertFor(g);
      const body = doc.splitTextToSize(plain(etaHTML(g, c, ctx)), 168);
      const h = 14 + body.length * 3.6 + (a ? 5 : 0);
      if (y + h > 275) y = newPage();

      doc.setFillColor(...theme.light); doc.setDrawColor(...theme.cardBorder);
      doc.roundedRect(15, y, 180, h, 3, 3, 'FD');
      doc.setTextColor(...theme.pink); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text(plain(g.name).toUpperCase().slice(0, 50), 21, y + 7);
      doc.setTextColor(...theme.dark); doc.setFontSize(7.5); doc.setFont('helvetica', 'normal');
      doc.text(body, 21, y + 14);
      if (a) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...theme.pink);
        doc.text(plain(a.msg + (a.amount !== undefined ? ' ' + fmt(a.amount, g.cur) : '')), 21, y + 14 + body.length * 3.6 + 1);
      }
      y += h + 5;
    });

    // Pie de cada página
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(...theme.footerColor);
      doc.text('POCKI - Creado por Flor Bagnis', 15, 287);
      doc.text(`${i} / ${n}`, 195, 287, { align: 'right' });
    }
    doc.save('Pocki-metas-' + new Date().toISOString().slice(0, 10) + '.pdf');
  }

  /* ---------- retiro -> suma al presupuesto de Mensuales como "Ahorro" ---------- */
  function sendWithdrawal(g, amount) {
    const b = window.PockiBridge && window.PockiBridge.addWithdrawal;
    if (!b) return;
    const hidden = document.body.classList.contains('amounts-hidden');
    Promise.resolve(b({ amount, currency: g.cur, description: 'Retiro de Pocki: ' + g.name }))
      .then((ok) => toast(ok
        ? `Se sumó a tu presupuesto como Ahorro${hidden ? '' : ': ' + fmt(amount, g.cur)}`
        : 'No se pudo sumar el retiro al presupuesto.'))
      .catch(() => toast('No se pudo sumar el retiro al presupuesto.'));
  }

  /* ---------- eventos ---------- */
  // Puntos de miles en vivo en todos los campos de monto de Pocki
  root.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.matches('#pockiTarget, #pockiSaved, #pockiMonthly, #pockiAlert, .pocki-add input')) return;
    const start = el.selectionStart;
    const prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
  });

  $('#pockiNewBtn').addEventListener('click', () => {
    const f = $('#pockiForm');
    f.hidden = !f.hidden;
    if (!f.hidden) $('#pockiName').focus();
  });
  $('#pockiCancelBtn').addEventListener('click', () => { $('#pockiForm').hidden = true; });
  $('#pockiPdfBtn').addEventListener('click', exportPDF);

  $('#pockiToggleBtn').addEventListener('click', (e) => {
    const body = $('#pockiBody');
    body.hidden = !body.hidden;
    e.currentTarget.textContent = body.hidden ? '▼ Mostrar Pocki' : '▲ Ocultar Pocki';
  });

  $('#pockiForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const g = {
      id: Date.now(),
      name: $('#pockiName').value.trim(),
      cur: $('#pockiCur').value === 'USD' ? 'USD' : 'ARS',
      target: parseAmount($('#pockiTarget').value),
      saved: Math.max(0, parseAmount($('#pockiSaved').value)),
      monthly: Math.max(0, parseAmount($('#pockiMonthly').value)),   // 0 = lo calcula la app
      alertAt: Math.max(0, parseAmount($('#pockiAlert').value))
    };
    if (!g.name || g.target <= 0) return;
    goals.unshift(g);
    save();
    e.target.reset();
    e.target.hidden = true;
    render();
  });

  $('#pockiGoals').addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const card = btn.closest('.pocki-goal');
    const g = goals.find((x) => x.id === Number(card.dataset.id));
    if (!g) return;
    const act = btn.dataset.act;

    if (act === 'del') {
      if (confirm(`¿Eliminar la meta "${g.name}"?`)) { goals = goals.filter((x) => x !== g); save(); render(); }
      return;
    }
    if (act === 'auto') { g.monthly = 0; save(); render(); return; }

    const amount = parseAmount(btn.closest('.pocki-add').querySelector('input').value);
    if (act === 'plan') {
      if (!(amount > 0)) return;
      g.monthly = amount; save(); render();
      return;
    }
    if (!(amount > 0)) return;
    const before = alertFor(g);
    const removed = act === 'sub' ? Math.min(amount, g.saved) : 0;   // lo que realmente se retira
    g.saved = act === 'add' ? g.saved + amount : Math.max(0, g.saved - amount);
    save();
    render();

    const now = alertFor(g);
    if (now && (!before || before.msg !== now.msg)) {
      const hidden = document.body.classList.contains('amounts-hidden');
      toast(`${g.name}: ${now.msg}${now.amount !== undefined && !hidden ? ' ' + fmt(now.amount, g.cur) : ''}`);
    }
    if (removed > 0) sendWithdrawal(g, removed);
  });

  /* ---------- se actualiza sola cuando cambian el Historial, el dólar o el usuario ---------- */
  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(render, 250); };
  const watch = (id, cb) => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(cb).observe(el, { childList: true, subtree: true, characterData: true });
  };
  watch('historyTable', refresh);
  watch('dolarBadge', refresh);
  watch('userEmail', () => { load(); render(); });

  load();
  render();
})();
