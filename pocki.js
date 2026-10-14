/* =========================================================
   POCKI: AHORRANDO ANDO · metas de ahorro de Mensuales
   Creado by Flor Bagnis 💗

   Cómo calcula el tiempo:
   1) Sobrante mensual = promedio de (presupuesto − gastado) de los meses del Historial.
   2) Ese sobrante (en pesos) se reparte entre las metas sin cumplir que no tienen
      un ahorro por mes elegido a mano.
   3) Las metas en dólares se pasan con el dólar blue que ya muestra la app.
   Si la persona elige cuánto va a ahorrar por mes en una meta, se usa ese monto.

   Si algún día app.js quiere darle los datos directo, puede definir:
     window.PockiBridge = {
       getMonthlySurplusARS: () => 123456,   // sobrante mensual en pesos
       getDolar: () => 1450                  // cotización del dólar
     };
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
  const money = (n, cur) => `<span class="pocki-amt">${fmt(n, cur)}</span>`;

  // "1.500.000,50" -> 1500000.5 (misma convención que los campos de Mensuales)
  const parseAmount = (v) => {
    const s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
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
    const planValue = g.monthly > 0 ? String(g.monthly).replace('.', ',') : '';
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

 /* ---------- exportar PDF adaptado a los modos ---------- */
  function exportPDF() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { toast('No se pudo cargar el generador de PDF. Revisá tu conexión.'); return; }
    if (!goals.length) { toast('Primero agregá una meta para exportar.'); return; }

    const doc = new J({ unit: 'mm', format: 'a4' });
    const W = 210, M = 14, BOTTOM = 276;
    const ctx = getCtx();
    let y = 0;

    // Detectar el modo activo en el body
    const bodyClass = document.body.className;
    let theme = {
      pink: [251, 196, 212], ink: [90, 35, 55], accent: [232, 93, 158], track: [253, 226, 236], muted: [139, 125, 134], cardBg: [255, 248, 250]
    };

    if (bodyClass.includes('dark-mode')) {
      theme = { pink: [78, 43, 55], ink: [255, 214, 223], accent: [255, 142, 163], track: [78, 43, 55], muted: [196, 154, 166], cardBg: [31, 16, 21] };
    } else if (bodyClass.includes('dark-blue-mode')) {
      theme = { pink: [30, 53, 109], ink: [241, 245, 249], accent: [56, 189, 248], track: [30, 53, 109], muted: [148, 163, 184], cardBg: [7, 13, 30] };
    } else if (bodyClass.includes('black-mode')) {
      theme = { pink: [51, 51, 51], ink: [255, 255, 255], accent: [255, 255, 255], track: [51, 51, 51], muted: [163, 163, 163], cardBg: [26, 26, 26] };
    }

    const header = () => {
      doc.setFillColor(...theme.pink); doc.rect(0, 0, W, 26, 'F');
      doc.setTextColor(...theme.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(18);
      doc.text('Pocki: Ahorrando ando', M, 13);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      doc.text('Resumen de metas de ahorro · ' + new Date().toLocaleDateString('es-AR'), M, 20);
      y = 36;
    };

    header();

    // Datos del cálculo
    doc.setTextColor(...theme.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(11);
    doc.text('Cómo se calcula', M, y); y += 6;
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...theme.muted);
    const lines = [];
    if (ctx.pool === null) lines.push('Sin meses en el Historial para calcular tu sobrante mensual.');
    else if (ctx.pool <= 0) lines.push('Tus gastos igualan o superan tu presupuesto: no queda sobrante mensual.');
    else lines.push('Sobrante mensual (promedio de tu Historial): ' + fmt(ctx.pool, 'ARS'));
    if (ctx.rate) lines.push('Dólar blue: ' + fmt(ctx.rate, 'ARS'));
    lines.forEach((l) => { doc.text(l, M, y); y += 5; });
    y += 3;

    // Totales por moneda
    ['ARS', 'USD'].forEach((cur) => {
      const list = goals.filter((g) => g.cur === cur);
      if (!list.length) return;
      const saved = list.reduce((s, g) => s + g.saved, 0), target = list.reduce((s, g) => s + g.target, 0);
      doc.setTextColor(...theme.ink); doc.setFont('helvetica', 'bold');
      doc.text(`Total en ${cur === 'USD' ? 'dólares' : 'pesos'}: ${fmt(saved, cur)} ahorrados de ${fmt(target, cur)}`, M, y);
      y += 6;
    });
    y += 4;

    // Una tarjeta por meta
    goals.forEach((g) => {
      const c = calc(g, ctx);
      const pct = g.target > 0 ? Math.min(1, g.saved / g.target) : 0;
      const eta = doc.splitTextToSize(plain(etaHTML(g, c, ctx)), W - 2 * M - 8);
      const a = alertFor(g);
      const h = 34 + eta.length * 4.6 + (a ? 7 : 0);
      if (y + h > BOTTOM) { doc.addPage(); header(); }

      doc.setDrawColor(...theme.pink); doc.setFillColor(...theme.cardBg);
      doc.roundedRect(M, y, W - 2 * M, h, 3, 3, 'FD');
      let yy = y + 8;
      doc.setTextColor(...theme.ink); doc.setFont('helvetica', 'bold'); doc.setFontSize(13);
      doc.text(plain(g.name) || 'Meta', M + 4, yy);
      doc.setFontSize(12); doc.setTextColor(...theme.accent);
      doc.text(Math.floor(pct * 100) + '%', W - M - 4, yy, { align: 'right' });
      yy += 5;
      doc.setFillColor(...theme.track); doc.roundedRect(M + 4, yy, W - 2 * M - 8, 4, 2, 2, 'F');
      if (pct > 0) { doc.setFillColor(...theme.accent); doc.roundedRect(M + 4, yy, Math.max(3, (W - 2 * M - 8) * pct), 4, 2, 2, 'F'); }
      yy += 10;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor(...theme.ink);
      doc.text(`Ahorrado: ${fmt(g.saved, g.cur)}    ·    Falta: ${fmt(c.rem, g.cur)}    ·    Meta: ${fmt(g.target, g.cur)}`, M + 4, yy);
      yy += 5.5;
      doc.setTextColor(...theme.muted);
      doc.text(eta, M + 4, yy);
      yy += eta.length * 4.6;
      if (a) {
        doc.setFont('helvetica', 'bold'); doc.setTextColor(...theme.accent);
        doc.text(plain(a.msg + (a.amount !== undefined ? ' ' + fmt(a.amount, g.cur) : '')), M + 4, yy + 2);
      }
      y += h + 5;
    });

    // Pie de cada página
    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor(...theme.muted);
      const txt = 'Creado by Flor Bagnis 💗';
      const x = (W - doc.getTextWidth(txt)) / 2;
      doc.text(txt, x, 289);
      doc.text(`${i} / ${n}`, W - M, 289, { align: 'right' });
    }
    doc.save('Pocki-metas-' + new Date().toISOString().slice(0, 10) + '.pdf');
  }

  /* ---------- eventos ---------- */
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
    g.saved = act === 'add' ? g.saved + amount : Math.max(0, g.saved - amount);
    save();
    render();

    const now = alertFor(g);
    if (now && (!before || before.msg !== now.msg)) {
      const hidden = document.body.classList.contains('amounts-hidden');
      toast(`${g.name}: ${now.msg}${now.amount !== undefined && !hidden ? ' ' + fmt(now.amount, g.cur) : ''}`);
    }
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
