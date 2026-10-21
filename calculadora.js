/* =========================================================
   CALCULADORA · Mensuales
   Se agrega sola: crea la solapa (panel) debajo de Changui y
   el botón "🧮 Calculadora" en el encabezado.
   Usa jsPDF, que ya cargás en el index.html.
========================================================= */
(function () {
  'use strict';
  if (window.__mensualesCalc) return;
  window.__mensualesCalc = true;

  var LS_KEY = 'mensuales_calc_history';
  var MAX_HIST = 200;
  var OPS = ['+', '−', '×', '÷'];

  /* ---------------------------------------------------------
     Estado
  --------------------------------------------------------- */
  var expr = '';          // expresión interna: usa "." decimal y − × ÷
  var justEval = false;   // se acaba de apretar "="
  var errorMsg = '';
  var lastExpr = '';
  var lastRes = null;
  var memory = 0;
  var hasMem = false;
  var isOn = true;
  var hist = [];

  try {
    var saved = JSON.parse(localStorage.getItem(LS_KEY) || '[]');
    if (Array.isArray(saved)) {
      hist = saved.filter(function (h) {
        return h && typeof h.expr === 'string' && typeof h.res === 'number' && h.t;
      });
    }
  } catch (e) { hist = []; }

  function saveHist() {
    try { localStorage.setItem(LS_KEY, JSON.stringify(hist)); } catch (e) {}
  }

  /* ---------------------------------------------------------
     Formato
  --------------------------------------------------------- */
  function fmt(n) {
    return n.toLocaleString('es-AR', { maximumFractionDigits: 10 });
  }
  function plain(n) {
    return n.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 }).replace('-', '−');
  }
  function show(s) { return s.replace(/\./g, ','); }
  function clean(v) { return parseFloat(v.toPrecision(12)); }

  /* ---------------------------------------------------------
     Motor de cálculo (sin eval)
     Soporta + − × ÷ ( ) y %.
     "200 + 10%" = 220 · "50%" = 0,5 · "200 × 10%" = 20
  --------------------------------------------------------- */
  function evaluate(src) {
    var tokens = src.match(/\d+\.?\d*|\.\d+|[+−×÷()%]/g) || [];
    var i = 0;
    var peek = function () { return tokens[i]; };

    function parseExpr() {
      var left = parseTerm();
      while (peek() === '+' || peek() === '−') {
        var op = tokens[i++];
        var r = parseTerm();
        var rv = r.v;
        if (r.pct && r.simple) rv = left.v * r.v; // 200 + 10% -> 200 + 20
        left = { v: op === '+' ? left.v + rv : left.v - rv, pct: false, simple: false };
      }
      return left;
    }

    function parseTerm() {
      var left = parseFactor();
      var simple = true;
      while (peek() === '×' || peek() === '÷') {
        var op = tokens[i++];
        var r = parseFactor();
        if (op === '÷' && r.v === 0) throw new Error('División por 0');
        left = { v: op === '×' ? left.v * r.v : left.v / r.v, pct: false };
        simple = false;
      }
      return { v: left.v, pct: left.pct, simple: simple && left.pct };
    }

    function parseFactor() {
      var t = peek();
      var v;
      var pct = false;
      if (t === '−') { i++; var f = parseFactor(); return { v: -f.v, pct: f.pct }; }
      if (t === '+') { i++; return parseFactor(); }
      if (t === '(') {
        i++;
        var e = parseExpr();
        if (peek() !== ')') throw new Error('Error');
        i++;
        v = e.v;
      } else if (t && /^[\d.]/.test(t)) {
        i++;
        v = parseFloat(t);
      } else {
        throw new Error('Error');
      }
      while (peek() === '%') { i++; v = v / 100; pct = true; }
      return { v: v, pct: pct };
    }

    var out = parseExpr();
    if (i < tokens.length) throw new Error('Error');
    if (!isFinite(out.v)) throw new Error('Error');
    return clean(out.v);
  }

  // Saca operadores sueltos al final y cierra paréntesis abiertos
  function cleanExpr(e) {
    var s = e.replace(/[+−×÷]+$/, '');
    if (s === '' || s === '−') return '';
    var open = (s.match(/\(/g) || []).length;
    var close = (s.match(/\)/g) || []).length;
    s = s.replace(/\($/, '');
    for (var k = 0; k < open - close; k++) s += ')';
    return s;
  }

  /* ---------------------------------------------------------
     Entrada
  --------------------------------------------------------- */
  function lastNum() { return (expr.match(/[\d.]*$/) || [''])[0]; }

  function inputNum(k) {
    if (justEval) { expr = ''; justEval = false; }
    if (/[)%]$/.test(expr)) return;
    var seg = lastNum();
    if (k === '.') {
      if (seg.indexOf('.') !== -1) return;
      expr += seg === '' ? '0.' : '.';
      return;
    }
    if (k === '00') {
      if (seg === '') expr += '0';
      else if (seg !== '0') expr += '00';
      return;
    }
    if (seg === '0') { expr = expr.slice(0, -1) + k; return; }
    expr += k;
  }

  function inputOp(op) {
    justEval = false;
    var last = expr.slice(-1);
    if (expr === '') { if (op === '−') expr = '−'; return; }
    if (expr === '−') return;
    if (last === '(') { if (op === '−') expr += '−'; return; }
    if (OPS.indexOf(last) !== -1) {
      if (op === '−' && (last === '×' || last === '÷')) { expr += '−'; return; }
      expr = expr.replace(/[+−×÷]+$/, '') + op;
      return;
    }
    expr += op;
  }

  function inputPct() {
    justEval = false;
    if (/[\d)%]$/.test(expr)) expr += '%';
  }

  function inputParen(k) {
    if (k === '(') {
      if (justEval) { expr = ''; justEval = false; }
      if (expr === '' || /[+−×÷(]$/.test(expr)) expr += '(';
    } else {
      var open = (expr.match(/\(/g) || []).length;
      var close = (expr.match(/\)/g) || []).length;
      if (open > close && /[\d)%]$/.test(expr)) expr += ')';
      justEval = false;
    }
  }

  // Reemplaza el número actual (o lo agrega si corresponde)
  function insertValue(n) {
    if (justEval) { expr = ''; justEval = false; }
    var seg = lastNum();
    if (seg !== '') expr = expr.slice(0, expr.length - seg.length) + plain(n);
    else if (!/[)%]$/.test(expr)) expr += plain(n);
  }

  function currentValue() {
    if (justEval) return lastRes;
    var src = cleanExpr(expr);
    if (!src) return null;
    try { return evaluate(src); } catch (e) { return null; }
  }

  function equals() {
    if (expr === '' || justEval) return;
    var src = cleanExpr(expr);
    if (!src) return;
    try {
      var r = evaluate(src);
      lastExpr = show(src);
      lastRes = r;
      if (/[+−×÷%()]/.test(src.replace(/^−/, ''))) pushHist(lastExpr, r);
      expr = plain(r);
      justEval = true;
    } catch (e) {
      errorMsg = e.message || 'Error';
      expr = '';
      justEval = false;
    }
  }

  function press(k) {
    if (!isOn && k !== 'ON') return;
    if (errorMsg && k !== 'ON') { errorMsg = ''; expr = ''; justEval = false; }

    if (/^\d$/.test(k) || k === '00' || k === '.') inputNum(k);
    else if (OPS.indexOf(k) !== -1) inputOp(k);
    else if (k === '%') inputPct();
    else if (k === '(' || k === ')') inputParen(k);
    else if (k === '=') equals();
    else if (k === 'CE') {
      if (justEval) { expr = ''; justEval = false; } else expr = expr.slice(0, -1);
    } else if (k === 'ON') {
      expr = ''; justEval = false; errorMsg = ''; lastExpr = ''; lastRes = null; isOn = true;
    } else if (k === 'OFF') {
      isOn = false;
    } else if (k === 'M+') {
      var v = currentValue();
      if (v !== null) { memory = clean(memory + v); hasMem = true; }
    } else if (k === 'MC') {
      memory = 0; hasMem = false;
    } else if (k === 'MR') {
      if (hasMem) insertValue(memory);
    }
    render();
  }

  /* ---------------------------------------------------------
     Historial
  --------------------------------------------------------- */
  function pushHist(e, r) {
    hist.push({ t: new Date().toISOString(), expr: e, res: r });
    if (hist.length > MAX_HIST) hist.shift();
    saveHist();
    renderHist();
  }

  /* ---------------------------------------------------------
     Exportar
  --------------------------------------------------------- */
  function download(blob, name) {
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function exportCSV() {
    if (!hist.length) { alert('Todavía no hay cuentas para exportar.'); return; }
    var q = function (s) { return '"' + String(s).replace(/"/g, '""') + '"'; };
    var rows = [['Fecha', 'Hora', 'Operación', 'Resultado']];
    hist.forEach(function (h) {
      var d = new Date(h.t);
      rows.push([
        d.toLocaleDateString('es-AR'),
        d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
        h.expr,
        h.res.toLocaleString('en-US', { useGrouping: false, maximumFractionDigits: 10 }).replace('.', ',')
      ]);
    });
    var csv = '\ufeff' + rows.map(function (r) { return r.map(q).join(';'); }).join('\r\n');
    download(new Blob([csv], { type: 'text/csv;charset=utf-8;' }), 're-calculando-mensuales.csv');
  }

  function exportPDF() {
    if (!hist.length) { alert('Todavía no hay cuentas para exportar.'); return; }
    var lib = window.jspdf && window.jspdf.jsPDF;
    if (!lib) { alert('No se pudo cargar el generador de PDF. Revisá tu conexión e intentá de nuevo.'); return; }

    var doc = new lib();
    var pageW = doc.internal.pageSize.getWidth();
    var pageH = doc.internal.pageSize.getHeight();
    var y = 20;

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(196, 56, 120);
    doc.text('Mensuales - Re calculando', 14, y);
    y += 7;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(120, 120, 120);
    doc.text('Generado el ' + new Date().toLocaleString('es-AR'), 14, y);
    y += 10;

    function head() {
      doc.setFillColor(251, 196, 212);
      doc.rect(14, y - 5, pageW - 28, 8, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(90, 35, 55);
      doc.text('Fecha', 16, y);
      doc.text('Operación', 56, y);
      doc.text('Resultado', pageW - 16, y, { align: 'right' });
      y += 8;
    }
    head();

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    hist.forEach(function (h, idx) {
      var d = new Date(h.t);
      var fecha = d.toLocaleDateString('es-AR') + ' ' + d.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });
      var lines = doc.splitTextToSize(h.expr.replace(/−/g, '-'), 90);
      var rowH = Math.max(7, lines.length * 5 + 2);
      if (y + rowH > pageH - 16) { doc.addPage(); y = 20; head(); }
      if (idx % 2 === 1) {
        doc.setFillColor(255, 244, 248);
        doc.rect(14, y - 4.5, pageW - 28, rowH, 'F');
      }
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 50, 60);
      doc.text(fecha, 16, y);
      doc.text(lines, 56, y);
      doc.setFont('helvetica', 'bold');
      doc.text(fmt(h.res).replace(/−/g, '-'), pageW - 16, y, { align: 'right' });
      y += rowH;
    });

    doc.save('re-calculando-mensuales.pdf');
  }

  /* ---------------------------------------------------------
     Armado de la solapa
  --------------------------------------------------------- */
  var KEYS_FN = ['ON', 'M+', 'MC', 'MR', 'OFF'];
  var KEYS_MAIN = [
    '7', '8', '9', '%', 'CE',
    '4', '5', '6', '×', '÷',
    '1', '2', '3', '+', '−',
    '0', '00', '.', '=' // el "+" ocupa 2 filas, por eso el "=" queda en la última columna
  ];

  function keyBtn(k, cls) {
    var label = k === '.' ? ',' : k;
    return '<button type="button" class="calc-key ' + (cls || '') + '" data-k="' + k + '" aria-label="' + label + '">' + label + '</button>';
  }

  function build() {
    var section = document.createElement('section');
    section.className = 'panel';
    section.id = 'calculadora';
    section.style.marginTop = '1.5rem';

    var solar = '<i></i><i></i><i></i><i></i><i></i><i></i><i></i>';
    var fn = KEYS_FN.map(function (k) { return keyBtn(k, 'calc-key-fn'); }).join('');
    var main = KEYS_MAIN.map(function (k) { return keyBtn(k, k === '+' ? 'calc-key-plus' : ''); }).join('');

    section.innerHTML =
      '<div class="section-heading" style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px;">' +
        '<div>' +
          '<h2>🧮 Re calculando</h2>' +
          '<p>Sumá, restá, multiplicá y dividí. Exportá tus cuentas a PDF o CSV.</p>' +
        '</div>' +
        '<button id="calcToggleBtn" class="btn btn-outline btn-sm custom-collapse-btn" type="button">▼ Mostrar Re calculando</button>' +
      '</div>' +
      '<div id="calcBody" hidden>' +
        '<div class="calc-layout">' +
          '<div>' +
            '<div class="calc-device" id="calcDevice">' +
              '<div class="calc-solar" aria-hidden="true">' + solar + '</div>' +
              '<div class="calc-screen" id="calcScreen" aria-live="polite">' +
                '<span class="calc-mem" id="calcMem"></span>' +
                '<div class="calc-l1" id="calcL1"></div>' +
                '<div class="calc-l2" id="calcL2">0</div>' +
              '</div>' +
              '<div class="calc-fn">' + fn + '</div>' +
              '<div class="calc-main">' + main + '</div>' +
            '</div>' +
            '<p class="calc-hint">⌨️ También podés usar el teclado: números, + − * / , Enter (=), Backspace (borrar) y Esc (borrar todo). El % funciona como en una calculadora de mano: 200 + 10% = 220.</p>' +
          '</div>' +
          '<div class="calc-side">' +
            '<div class="calc-side-head">' +
              '<h3>Historial de cuentas</h3>' +
              '<div class="calc-side-actions">' +
                '<button id="calcPdfBtn" class="btn btn-outline btn-sm" type="button">📄 PDF</button>' +
                '<button id="calcCsvBtn" class="btn btn-outline btn-sm" type="button">📊 CSV</button>' +
                '<button id="calcClearBtn" class="btn btn-danger btn-sm" type="button">Borrar historial</button>' +
              '</div>' +
            '</div>' +
            '<div id="calcHist" class="calc-hist"></div>' +
          '</div>' +
        '</div>' +
      '</div>';

    var anchor = document.getElementById('changui');
    if (anchor) anchor.after(section);
    else {
      var footer = document.querySelector('#appContent > footer');
      if (footer) footer.before(section);
      else (document.getElementById('appContent') || document.body).appendChild(section);
    }
    return section;
  }

  function $(id) { return document.getElementById(id); }

  function render() {
    var l1 = $('calcL1'), l2 = $('calcL2'), scr = $('calcScreen'), mem = $('calcMem');
    if (!l1) return;

    scr.classList.toggle('is-off', !isOn);
    mem.textContent = hasMem && isOn ? 'M' : '';

    var main;
    if (errorMsg) main = errorMsg;
    else if (justEval && lastRes !== null) main = fmt(lastRes);
    else main = expr === '' ? '0' : show(expr);
    l2.textContent = main;
    l2.className = 'calc-l2' + (main.length > 16 ? ' sm' : main.length > 10 ? ' md' : '');
    l2.scrollLeft = l2.scrollWidth;

    var top = '';
    if (!errorMsg) {
      if (justEval) top = lastExpr + ' =';
      else {
        var src = cleanExpr(expr);
        if (src && /[+−×÷%]/.test(src.replace(/^−/, ''))) {
          try { top = '= ' + fmt(evaluate(src)); } catch (e) { top = ''; }
        }
      }
    }
    l1.textContent = top;
    l1.scrollLeft = l1.scrollWidth;
  }

  function renderHist() {
    var box = $('calcHist');
    if (!box) return;
    box.textContent = '';
    if (!hist.length) {
      var p = document.createElement('p');
      p.className = 'calc-empty';
      p.textContent = 'Todavía no hiciste ninguna cuenta. Las operaciones que resuelvas con "=" se guardan acá.';
      box.appendChild(p);
      return;
    }
    hist.slice().reverse().forEach(function (h) {
      var row = document.createElement('button');
      row.type = 'button';
      row.className = 'calc-hrow';
      row.title = 'Usar este resultado en la calculadora';

      var a = document.createElement('span');
      a.className = 'h-expr';
      a.textContent = h.expr + ' =';
      var b = document.createElement('strong');
      b.className = 'h-res';
      b.textContent = fmt(h.res);
      var c = document.createElement('small');
      c.className = 'h-date';
      c.textContent = new Date(h.t).toLocaleString('es-AR', {
        day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit'
      });

      row.appendChild(a);
      row.appendChild(b);
      row.appendChild(c);
      row.addEventListener('click', function () {
        if (!isOn) return;
        if (errorMsg) { errorMsg = ''; expr = ''; justEval = false; }
        insertValue(h.res);
        render();
      });
      box.appendChild(row);
    });
  }

  /* ---------------------------------------------------------
     Teclado
  --------------------------------------------------------- */
  var KEYMAP = {
    '*': '×', 'x': '×', 'X': '×',
    '/': '÷',
    '-': '−',
    '+': '+',
    '.': '.', ',': '.',
    '%': '%',
    '(': '(', ')': ')',
    'Enter': '=', '=': '=',
    'Backspace': 'CE',
    'Escape': 'ON', 'Delete': 'ON'
  };

  function flash(k) {
    var btn = document.querySelector('#calcDevice [data-k="' + k + '"]');
    if (!btn) return;
    btn.classList.add('pressed');
    setTimeout(function () { btn.classList.remove('pressed'); }, 110);
  }

  function onKeydown(e) {
    var body = $('calcBody');
    if (!body || body.hidden) return;
    if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
    if (document.querySelector('dialog[open]')) return;

    var panel = $('calculadora');
    var t = e.target;
    var inCalc = panel && panel.contains(t);
    if (!inCalc && t !== document.body) return;
    if (t.closest && t.closest('input, textarea, select, [contenteditable="true"]')) return;

    var k = null;
    if (/^\d$/.test(e.key)) k = e.key;
    else if (Object.prototype.hasOwnProperty.call(KEYMAP, e.key)) k = KEYMAP[e.key];
    if (k === null) return;

    e.preventDefault();
    flash(k);
    press(k);
  }

  /* ---------------------------------------------------------
     Arranque
  --------------------------------------------------------- */
  function setOpen(open) {
    var body = $('calcBody'), btn = $('calcToggleBtn');
    if (!body || !btn) return;
    body.hidden = !open;
    btn.textContent = open ? '▲ Ocultar Re calculando' : '▼ Mostrar Re calculando';
  }

  function init() {
    if ($('calculadora')) return;
    build();

    $('calcDevice').addEventListener('click', function (e) {
      var btn = e.target.closest('[data-k]');
      if (btn) press(btn.getAttribute('data-k'));
    });
    $('calcToggleBtn').addEventListener('click', function () { setOpen($('calcBody').hidden); });
    $('calcPdfBtn').addEventListener('click', exportPDF);
    $('calcCsvBtn').addEventListener('click', exportCSV);
    $('calcClearBtn').addEventListener('click', function () {
      if (!hist.length) return;
      if (confirm('¿Borrar todo el historial de la calculadora?')) {
        hist = [];
        saveHist();
        renderHist();
      }
    });
    document.addEventListener('keydown', onKeydown);

    // Botón en el encabezado (después de Changui)
    var nav = document.querySelector('.header-actions a[href="#changui"]');
    if (nav && !document.querySelector('.header-actions a[href="#calculadora"]')) {
      var a = document.createElement('a');
      a.href = '#calculadora';
      a.className = 'pastel-btn';
      a.textContent = '🧮 Re calculando';
      a.addEventListener('click', function () { setOpen(true); });
      nav.after(a);
    }

    renderHist();
    render();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
