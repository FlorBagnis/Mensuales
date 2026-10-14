/* =========================================================
   CHANGUI: CALCULÁ TU COMPRA · módulo de Mensuales
   Creado by Flor Bagnis 💗
========================================================= */
(() => {
  'use strict';

  const root = document.getElementById('changui');
  if (!root) return;
  const $ = (s) => root.querySelector(s);

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const fmt = (n, cur) => (cur === 'USD' ? 'u$s ' : '$ ') + nf2.format(Number(n) || 0);
  const money = (n, cur) => `<span class="chg-amt"><span class="chg-num">${fmt(n, cur)}</span><span class="chg-dots" aria-hidden="true">••••••</span></span>`;
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const parseAmount = (v) => {
    const s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    const n = parseFloat(s.replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };

  const formatAmountInput = (val) => {
    let clean = String(val ?? '').replace(/[^\d,]/g, '');
    const parts = clean.split(',');
    if (parts.length > 2) clean = parts[0] + ',' + parts.slice(1).join('');
    const [int, dec] = clean.split(',');
    const withDots = (int || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return dec !== undefined ? `${withDots},${dec.slice(0, 2)}` : withDots;
  };

  const todayISO = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());
  const fmtDay = (iso) => { const [y, m, d] = String(iso || '').split('-'); return d ? `${d}/${m}/${y}` : '—'; };
  const monthName = (k) => {
    const [y, m] = String(k).split('-').map(Number);
    if (!y || !m) return '';
    return new Date(y, m - 1, 1).toLocaleDateString('es-AR', { month: 'long', year: 'numeric' }).replace(/^./, (c) => c.toUpperCase());
  };
  const plain = (s) => String(s).replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/[^\x20-\xFF]/g, '').replace(/\s+/g, ' ').trim();

  const bridge = () => window.ChanguiBridge || {};
  const dolar = () => {
    try { const v = bridge().getDolar && bridge().getDolar(); return typeof v === 'number' && v > 0 ? v : null; } catch (e) { return null; }
  };

  const ICONS = [
    { k: 'leche', e: '🥛', label: 'Lácteos', cat: 'Alimentos' },
    { k: 'agua', e: '💧', label: 'Agua', cat: 'Alimentos' },
    { k: 'bebidas', e: '🥤', label: 'Bebidas', cat: 'Alimentos' },
    { k: 'carne', e: '🥩', label: 'Carne', cat: 'Alimentos' },
    { k: 'pescado', e: '🐟', label: 'Pescado', cat: 'Alimentos' },
    { k: 'pollo', e: '🍗', label: 'Pollo', cat: 'Alimentos' },
    { k: 'queso', e: '🧀', label: 'Queso y fiambre', cat: 'Alimentos' },
    { k: 'pan', e: '🍞', label: 'Panadería', cat: 'Alimentos' },
    { k: 'verdura', e: '🥦', label: 'Verduras', cat: 'Alimentos' },
    { k: 'fruta', e: '🍎', label: 'Frutas', cat: 'Alimentos' },
    { k: 'huevos', e: '🥚', label: 'Huevos', cat: 'Alimentos' },
    { k: 'almacen', e: '🍝', label: 'Almacén', cat: 'Alimentos' },
    { k: 'snacks', e: '🍫', label: 'Snacks y dulces', cat: 'Alimentos' },
    { k: 'limpieza', e: '🧴', label: 'Limpieza', cat: 'Hogar' },
    { k: 'higiene', e: '🧻', label: 'Higiene', cat: 'Personal' },
    { k: 'mascotas', e: '🐶', label: 'Mascotas', cat: 'Mascotas' },
    { k: 'otros', e: '🛒', label: 'Otros', cat: 'Alimentos' }
  ];
  const iconOf = (k) => ICONS.find((i) => i.k === k) || ICONS[ICONS.length - 1];

  const userKey = () => 'changui_v1_' + ((document.getElementById('userEmail')?.textContent || '').trim().toLowerCase() || 'anon');
  let state = { items: [], general: 0, purchases: [] };
  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(userKey()) || 'null');
      state = Object.assign({ items: [], general: 0, purchases: [] }, s || {});
    } catch (e) { state = { items: [], general: 0, purchases: [] }; }
    if (!Array.isArray(state.items)) state.items = [];
    if (!Array.isArray(state.purchases)) state.purchases = [];
    state.general = Math.min(100, Math.max(0, Number(state.general) || 0));
  }
  function save() {
    try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ }
  }

  let selIcon = 'otros';
  let editingId = null;

  let toastTimer;
  function toast(text) {
    let t = $('#chgToast');
    if (!t) {
      root.insertAdjacentHTML('beforeend', '<div id="chgToast" class="chg-toast" role="status"></div>');
      t = $('#chgToast');
    }
    t.textContent = text;
    t.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove('show'), 4500);
  }

  const promoLabel = (p) => {
    if (!p || p.type === 'none') return '';
    if (p.type === 'pct') return `${p.value}% off`;
    if (p.type === '2x1') return '2x1';
    if (p.type === 'second') return `2da al ${p.value}%`;
    return '';
  };

  function itemCalc(it) {
    const base = it.price * it.qty;
    let paid = base;
    const p = it.promo || { type: 'none' };
    if (p.type === 'pct') paid = base * (1 - p.value / 100);
    else if (p.type === '2x1') paid = it.price * Math.ceil(it.qty / 2);
    else if (p.type === 'second') {
      const pairs = Math.floor(it.qty / 2);
      paid = it.price * (it.qty - pairs) + it.price * pairs * (1 - p.value / 100);
    }
    return { base, paid, saved: base - paid };
  }

  // Obtener costo de envío actual del formulario
  function getDeliveryCost() {
    const mode = $('#chgDeliveryMode')?.value || 'presencial';
    return mode === 'envio' ? parseAmount($('#chgDeliveryCost')?.value) : 0;
  }

  function totals() {
    const t = { ARS: { base: 0, promo: 0 }, USD: { base: 0, promo: 0 } };
    state.items.forEach((it) => {
      const c = itemCalc(it);
      t[it.cur].base += c.base;
      t[it.cur].promo += c.saved;
    });
    const g = state.general;
    ['ARS', 'USD'].forEach((cur) => {
      const afterPromo = t[cur].base - t[cur].promo;
      t[cur].general = afterPromo * g / 100;
      t[cur].total = afterPromo - t[cur].general;
      t[cur].saved = t[cur].promo + t[cur].general;
    });

    // Sumar el costo de envío a los totales en ARS
    const delivery = getDeliveryCost();
    t.ARS.total += delivery;

    const rate = dolar();
    const hasUSD = t.USD.base > 0;
    const eq = (a, b) => a + (rate ? b * rate : 0);
    return {
      t, rate, hasUSD,
      eqTotal: eq(t.ARS.total, t.USD.total),
      eqSaved: eq(t.ARS.saved, t.USD.saved),
      eqPromo: eq(t.ARS.promo, t.USD.promo),
      eqGeneral: eq(t.ARS.general, t.USD.general)
    };
  }

  function renderIcons() {
    $('#chgIcons').innerHTML = ICONS.map((i) =>
      `<button type="button" class="chg-chip${i.k === selIcon ? ' on' : ''}" data-icon="${i.k}" aria-pressed="${i.k === selIcon}" title="${esc(i.label)}"><span>${i.e}</span><small>${esc(i.label)}</small></button>`
    ).join('');
  }

  function itemHTML(it) {
    const c = itemCalc(it);
    const ic = iconOf(it.icon);
    const badge = promoLabel(it.promo) ? `<span class="chg-badge">${esc(promoLabel(it.promo))}</span>` : '';
    const old = c.saved > 0.005 ? `<s class="chg-old">${money(c.base, it.cur)}</s>` : '';
    return `
      <li class="chg-item" data-id="${it.id}">
        <span class="chg-ico">${ic.e}</span>
        <span class="chg-info">
          <strong>${esc(it.name)}</strong>
          <small>${it.qty} x ${money(it.price, it.cur)} ${badge}</small>
        </span>
        <span class="chg-sub">${old}<b>${money(c.paid, it.cur)}</b></span>
        <span class="chg-btns">
          <button class="pastel-btn" type="button" data-act="edit" title="Editar">✏️</button>
          <button class="btn btn-outline" type="button" data-act="del" title="Quitar">🗑️</button>
        </span>
      </li>`;
  }

  function renderCart() {
    const n = state.items.length;
    const delivery = getDeliveryCost();
    
    let itemsMarkup = '';
    if (n > 0) {
      itemsMarkup = state.items.map(itemHTML).join('');
    }

    // Si hay costo de envío activo, lo agregamos como un ítem visual al final de la lista del changuito
    if (delivery > 0) {
      itemsMarkup += `
        <li class="chg-item" style="border-style: dashed; border-color: var(--pink-700); background: var(--pink-bg, rgba(234,91,142,0.05));">
          <span class="chg-ico">📦</span>
          <span class="chg-info">
            <strong>Envío a domicilio</strong>
            <small>Costo de logística</small>
          </span>
          <span class="chg-sub"><b>${money(delivery, 'ARS')}</b></span>
          <span class="chg-btns"></span>
        </li>`;
    }

    $('#chgCount').textContent = (n > 0 || delivery > 0) ? `(${n + (delivery > 0 ? 1 : 0)})` : '';
    $('#chgList').innerHTML = itemsMarkup || '<li class="chg-empty"><div>🛒</div><strong>Tu changuito está vacío</strong><br><span>Elegí un ícono, cargá el precio y sumalo.</span></li>';
    
    const gi = $('#chgGeneral');
    if (gi && document.activeElement !== gi) gi.value = state.general ? String(state.general).replace('.', ',') : '';
    root.querySelectorAll('[data-gen]').forEach((b) => b.classList.toggle('on', Number(b.dataset.gen) === state.general));
  }

  function renderTotals() {
    const T = totals();
    const card = (title, value, sub, cls) =>
      `<div class="chg-card ${cls || ''}"><span>${title}</span><strong>${value}</strong>${sub ? `<small>${sub}</small>` : ''}</div>`;
    const out = [];
    out.push(card('TOTAL EN PESOS', money(T.t.ARS.total, 'ARS'), T.t.ARS.saved > 0.005 ? `Ahorrás ${money(T.t.ARS.saved, 'ARS')}` : ''));
    if (T.hasUSD) {
      out.push(card('TOTAL EN DÓLARES', money(T.t.USD.total, 'USD'), T.t.USD.saved > 0.005 ? `Ahorrás ${money(T.t.USD.saved, 'USD')}` : ''));
      out.push(card('TODO EN PESOS', T.rate ? money(T.eqTotal, 'ARS') : 'Esperando el dólar…', T.rate ? `Dólar blue ${money(T.rate, 'ARS')}` : ''));
    }
    out.push(card('TE AHORRASTE', money(T.eqSaved, 'ARS'),
      `Promos ${money(T.eqPromo, 'ARS')} · General ${money(T.eqGeneral, 'ARS')}`, 'save'));
    $('#chgTotals').innerHTML = out.join('');
  }

  function renderInsight() {
    const box = $('#chgInsight');
    if (!box) return;
    const b = bridge();
    if (!b.getMonthExpenses) { box.innerHTML = '<span class="chg-pill">Conectando con tus gastos de Mensuales…</span>'; return; }

    const month = (b.getCurrentMonth && b.getCurrentMonth()) || todayISO().slice(0, 7);
    const list = b.getMonthExpenses(month) || [];
    const rate = dolar();
    const toARS = (amount, cur) => (cur === 'USD' ? (rate ? amount * rate : 0) : amount);
    const pills = [];

    const food = list.filter((e) => e.category === 'Alimentos' || e.fromChangui);
    let foodARS = 0, foodUSD = 0;
    food.forEach((e) => { if (e.currency === 'USD') foodUSD += Number(e.amount || 0); else foodARS += Number(e.amount || 0); });
    if (food.length) {
      pills.push(`🛒 En ${esc(monthName(month))} venís gastando ${money(foodARS, 'ARS')}${foodUSD > 0 ? ' + ' + money(foodUSD, 'USD') : ''} en comida y súper.`);
    } else {
      pills.push(`🛒 En ${esc(monthName(month))} todavía no cargaste gastos de comida o súper.`);
    }

    const storesData = {};
    state.purchases.forEach((p) => {
      const storeName = p.store ? p.store.trim() : 'Sin especificar';
      if (!storesData[storeName]) storesData[storeName] = { total: 0, items: new Set() };
      let storeTotal = 0;
      (p.items || []).forEach((it) => {
        storeTotal += toARS(Number(it.paid || 0), it.cur);
        storesData[storeName].items.add(String(it.name).trim().toLowerCase());
      });
      if (p.deliveryCost) storeTotal += toARS(Number(p.deliveryCost), 'ARS');
      storesData[storeName].total += storeTotal;
    });

    const sortedStores = Object.entries(storesData).filter(s => s[0] !== 'Sin especificar').sort((a, c) => c[1].total - a[1].total);

    if (sortedStores.length > 0) {
      const topStore = sortedStores[0];
      const lowStore = sortedStores[sortedStores.length - 1];
      pills.push(`🏪 Donde más gastaste fue en <strong>${esc(topStore[0])}</strong> (${money(topStore[1].total, 'ARS')}).`);

      if (sortedStores.length > 1 && lowStore[0] !== topStore[0]) {
        const itemsOnlyInTop = [...topStore[1].items].filter(x => !lowStore[1].items.has(x));
        const comparisonText = itemsOnlyInTop.length > 0
          ? ` Aquí compraste <em>(${itemsOnlyInTop.slice(0, 3).join(', ')})</em> que no llevaste en ${lowStore[0]}.`
          : ` Concentraste tus compras grandes aquí en comparación con ${lowStore[0]}.`;
        pills.push(`📊 <strong>Comparativa:</strong> En ${esc(topStore[0])} gastaste más que en ${esc(lowStore[0])}.${comparisonText}`);
      }
    }

    const prods = {};
    state.purchases.filter((p) => String(p.date).slice(0, 7) === month).forEach((p) => {
      (p.items || []).forEach((it) => {
        const v = toARS(Number(it.paid || 0), it.cur);
        const key = String(it.name).trim().toLowerCase();
        if (!prods[key]) prods[key] = { name: it.name, icon: it.icon, amt: 0 };
        prods[key].amt += v;
      });
    });
    const topProd = Object.values(prods).sort((a, c) => c.amt - a.amt)[0];
    if (topProd && topProd.amt > 0) {
      pills.push(`${iconOf(topProd.icon).e} Producto que más pesó este mes: <strong>${esc(topProd.name)}</strong> (${money(topProd.amt, 'ARS')}).`);
    }

    box.innerHTML = pills.map((p) => `<span class="chg-pill">${p}</span>`).join('');
  }

  function render() {
    renderCart();
    renderTotals();
    renderInsight();
  }

  function promoFromForm() {
    const v = $('#chgPromo').value;
    if (v === 'none') return { type: 'none' };
    if (v === '2x1') return { type: '2x1' };
    if (v === '2nd50') return { type: 'second', value: 50 };
    if (v === '2nd70') return { type: 'second', value: 70 };
    if (v === 'custom') {
      const n = Math.min(99, Math.max(0, parseAmount($('#chgPromoCustom').value)));
      return n > 0 ? { type: 'pct', value: n } : { type: 'none' };
    }
    return { type: 'pct', value: Number(v) };
  }

  function promoToForm(p) {
    const sel = $('#chgPromo'), wrap = $('#chgPromoCustomWrap'), custom = $('#chgPromoCustom');
    wrap.hidden = true; custom.value = '';
    if (!p || p.type === 'none') { sel.value = 'none'; return; }
    if (p.type === '2x1') { sel.value = '2x1'; return; }
    if (p.type === 'second') { sel.value = p.value === 70 ? '2nd70' : '2nd50'; return; }
    const preset = [...sel.options].some((o) => o.value === String(p.value));
    if (preset) sel.value = String(p.value);
    else { sel.value = 'custom'; wrap.hidden = false; custom.value = String(p.value).replace('.', ','); }
  }

  function resetForm() {
    editingId = null;
    selIcon = 'otros';
    $('#chgName').value = '';
    $('#chgPrice').value = '';
    $('#chgQty').value = '1';
    promoToForm(null);
    $('#chgSubmit').textContent = '➕ Agregar al changuito';
    $('#chgCancelEdit').hidden = true;
    renderIcons();
  }

  function submitItem(e) {
    e.preventDefault();
    const price = parseAmount($('#chgPrice').value);
    if (!(price > 0)) { toast('Ingresá el precio del producto.'); $('#chgPrice').focus(); return; }
    const it = {
      id: editingId || uid(),
      icon: selIcon,
      name: $('#chgName').value.trim() || iconOf(selIcon).label,
      price,
      qty: Math.min(99, Math.max(1, parseInt($('#chgQty').value, 10) || 1)),
      cur: $('#chgCur').value === 'USD' ? 'USD' : 'ARS',
      promo: promoFromForm()
    };
    if (editingId) {
      const i = state.items.findIndex((x) => x.id === editingId);
      if (i >= 0) state.items[i] = it; else state.items.push(it);
    } else {
      state.items.push(it);
    }
    save();
    resetForm();
    render();
    $('#chgName').focus();
  }

  function startEdit(id) {
    const it = state.items.find((x) => x.id === id);
    if (!it) return;
    editingId = id;
    selIcon = it.icon;
    $('#chgName').value = it.name;
    $('#chgPrice').value = formatAmountInput(String(it.price).replace('.', ','));
    $('#chgQty').value = String(it.qty);
    $('#chgCur').value = it.cur;
    promoToForm(it.promo);
    $('#chgSubmit').textContent = '💾 Guardar cambios';
    $('#chgCancelEdit').hidden = false;
    renderIcons();
    $('#chgForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#chgName').focus();
  }

  async function registerPurchase() {
    if (!state.items.length) { toast('Primero agregá productos al changuito.'); return; }
    const b = bridge();
    if (!b.addExpenses) { toast('No se pudo conectar con Mensuales.'); return; }

    const mode = $('#chgCatMode').value;
    const store = plain($('#chgStore').value);
    const date = $('#chgDate').value || todayISO();
    const g = state.general;
    const deliveryMode = $('#chgDeliveryMode')?.value || 'presencial';
    const deliveryCost = deliveryMode === 'envio' ? parseAmount($('#chgDeliveryCost')?.value) : 0;

    const groups = {};
    state.items.forEach((it) => {
      const paid = itemCalc(it).paid * (1 - g / 100);
      const cat = mode === 'auto' ? iconOf(it.icon).cat : mode;
      const key = cat + '|' + it.cur;
      if (!groups[key]) groups[key] = { cat, cur: it.cur, amount: 0, items: [] };
      groups[key].amount += paid;
      groups[key].items.push(it);
    });

    const storeLabel = store ? ` en ${store}` : '';
    const expenses = Object.values(groups)
      .map((x) => ({
        description: `Changui${storeLabel} (${x.items.map(i => i.name).join(', ')})`,
        category: x.cat,
        amount: round2(x.amount),
        currency: x.cur,
        items: x.items
      }))
      .filter((x) => x.amount > 0);

    if (deliveryCost > 0) {
      expenses.push({
        description: `Envío a domicilio${storeLabel}`,
        category: 'Otros',
        amount: round2(deliveryCost),
        currency: 'ARS',
        isDelivery: true
      });
    }

    if (!expenses.length) { toast('El total de la compra es cero.'); return; }

    let res = false;
    try { res = await b.addExpenses({ date, expenses }); } catch (e) { res = false; }
    if (!res) { toast('No se pudo registrar la compra.'); return; }

    state.purchases.unshift({
      id: uid(), date, store, deliveryMode, deliveryCost,
      items: state.items.map((it) => ({
        name: it.name, icon: it.icon, cur: it.cur,
        paid: round2(itemCalc(it).paid * (1 - g / 100))
      }))
    });
    state.purchases = state.purchases.slice(0, 60);
    state.items = [];
    state.general = 0;
    save();
    $('#chgStore').value = '';
    if ($('#chgDeliveryCost')) $('#chgDeliveryCost').value = '';
    if ($('#chgDeliveryMode')) $('#chgDeliveryMode').value = 'presencial';
    if ($('#chgDeliveryCostWrap')) $('#chgDeliveryCostWrap').hidden = true;
    resetForm();
    render();
    toast(`Listo, la compra se sumó a tus gastos.`);
  }

  /* ---------- exportar PDF ---------- */
  function exportPDF() {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { toast('No se pudo cargar el generador de PDF.'); return; }
    if (!state.items.length) { toast('Primero agregá productos al changuito.'); return; }

    let theme;
    try { theme = bridge().getPdfTheme(); } catch (e) { theme = null; }
    if (!theme) theme = {
      pink: [234, 91, 142], dark: [82, 22, 42], light: [253, 232, 238], headerBg: [255, 174, 195],
      cardBorder: [246, 214, 223], lineDivider: [246, 214, 223], pageBg: null, footerColor: [125, 80, 98]
    };
    const isBlack = document.body.classList.contains('black-mode');

    const doc = new J({ unit: 'mm', format: 'a4' });
    const T = totals();
    const store = plain($('#chgStore').value);
    const paintPage = () => { if (theme.pageBg) { doc.setFillColor(...theme.pageBg); doc.rect(0, 0, 210, 297, 'F'); } };
    const newPage = () => { doc.addPage(); paintPage(); return 20; };
    const heart = (x, yy, s) => {
      const r = s / 4;
      doc.setFillColor(...theme.pink);
      doc.circle(x + r, yy + r, r, 'F'); doc.circle(x + 3 * r, yy + r, r, 'F');
      doc.triangle(x, yy + r * 1.3, x + 4 * r, yy + r * 1.3, x + 2 * r, yy + 4 * r, 'F');
    };

    paintPage();

    doc.setFillColor(...theme.headerBg);
    doc.roundedRect(15, 15, 180, 28, 4, 4, 'F');
    doc.setTextColor(...theme.dark); doc.setFont('helvetica', 'bold'); doc.setFontSize(17);
    doc.text('CHANGUI: CALCULA TU COMPRA', 21, 25);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8);
    doc.text('Detalle del changuito - ' + new Date().toLocaleDateString('es-AR') + (store ? ' - ' + store : ''), 21, 31);

    const cards = [
      ['TOTAL EN PESOS', fmt(T.t.ARS.total, 'ARS')],
      ['TOTAL EN DOLARES', fmt(T.t.USD.total, 'USD')],
      ['TODO EN PESOS', T.hasUSD ? (T.rate ? fmt(T.eqTotal, 'ARS') : 'Sin cotizacion') : fmt(T.t.ARS.total, 'ARS')],
      ['TE AHORRASTE', fmt(T.eqSaved, 'ARS')]
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

    let y = 84;
    const tableHeader = () => {
      if (isBlack) doc.setFillColor(30, 30, 30); else doc.setFillColor(...theme.pink);
      doc.rect(15, y, 180, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('PRODUCTO', 18, y + 5);
      doc.text('CANT.', 92, y + 5);
      doc.text('PRECIO UNIT.', 106, y + 5);
      doc.text('PROMO', 136, y + 5);
      doc.text('SUBTOTAL', 162, y + 5);
      y += 8;
      doc.setFont('helvetica', 'normal');
    };
    tableHeader();

    state.items.forEach((it) => {
      if (y > 255) { y = newPage(); tableHeader(); }
      const c = itemCalc(it);
      doc.setTextColor(...theme.dark); doc.setFontSize(7);
      doc.text((plain(it.name) || plain(iconOf(it.icon).label)).slice(0, 40), 18, y + 5);
      doc.text(String(it.qty), 92, y + 5);
      doc.text(fmt(it.price, it.cur), 106, y + 5);
      doc.text(promoLabel(it.promo).replace('%', ' %') || '-', 136, y + 5);
      doc.text(fmt(c.paid, it.cur), 162, y + 5);
      doc.setDrawColor(...theme.lineDivider);
      doc.line(15, y + 8, 195, y + 8);
      y += 9;
    });

    // Si hay costo de envío, agregarlo también en el PDF
    const delivery = getDeliveryCost();
    if (delivery > 0) {
      if (y > 255) { y = newPage(); tableHeader(); }
      doc.setTextColor(...theme.dark); doc.setFontSize(7);
      doc.text('Envío a domicilio', 18, y + 5);
      doc.text('1', 92, y + 5);
      doc.text(fmt(delivery, 'ARS'), 106, y + 5);
      doc.text('-', 136, y + 5);
      doc.text(fmt(delivery, 'ARS'), 162, y + 5);
      doc.setDrawColor(...theme.lineDivider);
      doc.line(15, y + 8, 195, y + 8);
      y += 9;
    }

    y += 10;
    if (y > 225) y = newPage();
    doc.setTextColor(...theme.dark); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN DE LA COMPRA', 15, y);
    y += 6;
    const both = (a, b) => [a > 0.005 ? fmt(a, 'ARS') : '', b > 0.005 ? fmt(b, 'USD') : ''].filter(Boolean).join(' + ') || fmt(0, 'ARS');
    const lines = [
      ['Ahorro por promociones', both(T.t.ARS.promo, T.t.USD.promo)],
      [`Descuento general (${String(state.general).replace('.', ',')} %)`, both(T.t.ARS.general, T.t.USD.general)],
      ['Total ahorrado', both(T.t.ARS.saved, T.t.USD.saved)],
      ['Total a pagar', both(T.t.ARS.total, T.t.USD.total)]
    ];
    if (T.hasUSD && T.rate) lines.push(['Dolar blue usado', fmt(T.rate, 'ARS')]);
    const boxH = 10 + lines.length * 6;
    doc.setFillColor(...theme.light); doc.setDrawColor(...theme.cardBorder);
    doc.roundedRect(15, y, 180, boxH, 3, 3, 'FD');
    lines.forEach((l, i) => {
      const yy = y + 8 + i * 6;
      const strong = i >= 2 && i <= 3;
      doc.setFont('helvetica', strong ? 'bold' : 'normal'); doc.setFontSize(7.5);
      doc.setTextColor(...(strong ? theme.pink : theme.dark));
      doc.text(l[0], 21, yy);
      doc.text(l[1], 189, yy, { align: 'right' });
    });

    const n = doc.getNumberOfPages();
    for (let i = 1; i <= n; i++) {
      doc.setPage(i);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...theme.footerColor);
      const txt = 'Creado by Flor Bagnis';
      const tw = doc.getTextWidth(txt);
      const x = (210 - tw - 6) / 2;
      doc.text(txt, x, 287);
      heart(x + tw + 1.5, 283.6, 4);
      doc.text(`${i} / ${n}`, 195, 287, { align: 'right' });
    }
    doc.save('Changui-' + todayISO() + '.pdf');
  }

  /* ---------- Historial de Changuitos ---------- */
  function renderHistoryModal() {
    const container = $('#chgHistoryListContainer');
    if (!container) return;

    if (!state.purchases || state.purchases.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">🛒 Todavía no guardaste ningún changuito.</div>`;
      return;
    }

    container.innerHTML = state.purchases.map(p => {
      const storeName = p.store ? `Supermercado: <strong>${esc(p.store)}</strong>` : 'Compra general';
      const isEnvio = p.deliveryMode === 'envio';
      const deliveryText = isEnvio ? `📦 Envío a domicilio (${money(p.deliveryCost || 0, 'ARS')})` : '🛍️ Presencial (Local)';
      
      const itemsHtml = (p.items || []).map((it, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line);">
          <span>${iconOf(it.icon).e} ${esc(it.name)} (${it.qty || 1}x)</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <b>${money(it.paid, it.cur)}</b>
            <button class="pastel-btn btn-sm" type="button" data-edit-item-purchase="${p.id}" data-item-idx="${idx}" style="padding: 1px 6px; font-size: 10px;" title="Editar producto">✏️</button>
          </div>
        </div>
      `).join('');

      const deliveryHtml = isEnvio && p.deliveryCost > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line); color: var(--pink-700);">
          <span>📦 Costo de envío</span>
          <b>${money(p.deliveryCost, 'ARS')}</b>
        </div>
      ` : '';

      return `
        <div class="chg-history-card" data-purchase-id="${p.id}" style="border: 1px solid var(--chg-line); border-radius: 16px; padding: 14px; background: var(--bg, transparent); margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.85rem;">
            <span>📅 ${fmtDay(p.date)} · ${storeName}</span>
            <div style="display: flex; gap: 4px;">
              <button class="pastel-btn btn-sm" type="button" data-edit-purchase="${p.id}" style="padding: 2px 8px; font-size: 11px;">✏️ Changuito</button>
              <button class="btn btn-danger btn-sm" type="button" data-del-purchase="${p.id}" style="padding: 2px 8px; font-size: 11px;">Eliminar</button>
            </div>
          </div>
          <div style="font-size: 0.78rem; color: var(--muted); margin-bottom: 6px;">
            📍 Modalidad: <strong>${deliveryText}</strong>
          </div>
          <div style="display: grid; gap: 4px; margin-top: 6px;">
            ${itemsHtml}
            ${deliveryHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  /* ---------- eventos ---------- */
  $('#chgForm').addEventListener('submit', submitItem);
  $('#chgCancelEdit').addEventListener('click', resetForm);
  $('#chgPdfBtn').addEventListener('click', exportPDF);
  $('#chgRegisterBtn').addEventListener('click', registerPurchase);
  $('#chgDate').value = todayISO();

  $('#chgToggleBtn').addEventListener('click', (e) => {
    const body = $('#chgBody');
    body.hidden = !body.hidden;
    e.currentTarget.textContent = body.hidden ? '▼ Mostrar Changui' : '▲ Ocultar Changui';
  });

  $('#chgClearBtn').addEventListener('click', () => {
    if (!state.items.length) return;
    if (!confirm('¿Vaciar todo el changuito?')) return;
    state.items = []; state.general = 0; save(); resetForm(); render();
  });

  $('#chgPromo').addEventListener('change', (e) => {
    const custom = e.target.value === 'custom';
    $('#chgPromoCustomWrap').hidden = !custom;
    if (custom) $('#chgPromoCustom').focus();
  });

  $('#chgPrice').addEventListener('input', (e) => {
    const el = e.target;
    const start = el.selectionStart, prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
  });

  // Eventos para el selector de envío y su input
  $('#chgDeliveryMode')?.addEventListener('change', (e) => {
    const isEnvio = e.target.value === 'envio';
    const wrap = $('#chgDeliveryCostWrap');
    if (wrap) wrap.hidden = !isEnvio;
    renderCart();
    renderTotals();
  });

  $('#chgDeliveryCost')?.addEventListener('input', (e) => {
    const el = e.target;
    const start = el.selectionStart, prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
    renderCart();
    renderTotals();
  });

  $('#chgGeneral').addEventListener('input', (e) => {
    const n = parseFloat(String(e.target.value).replace(',', '.'));
    state.general = Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
    save();
    renderTotals();
    root.querySelectorAll('[data-gen]').forEach((b) => b.classList.toggle('on', Number(b.dataset.gen) === state.general));
  });

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-icon]');
    if (chip) { selIcon = chip.dataset.icon; renderIcons(); return; }

    const gen = e.target.closest('[data-gen]');
    if (gen) {
      const v = Number(gen.dataset.gen);
      state.general = state.general === v ? 0 : v;
      save(); renderCart(); renderTotals();
      return;
    }

    if (e.target.closest('#chgHistoryModalBtn')) {
      renderHistoryModal();
      $('#chgHistoryDialog')?.showModal();
    }
    if (e.target.closest('#chgCloseHistoryBtn') || e.target.closest('#chgHistoryDialog')) {
      if (e.target.id === 'chgHistoryDialog') $('#chgHistoryDialog').close();
    }

    const delBtn = e.target.closest('[data-del-purchase]');
    if (delBtn) {
      const id = delBtn.dataset.delPurchase;
      if (confirm('¿Eliminar este registro del historial?')) {
        state.purchases = state.purchases.filter(p => p.id !== id);
        save();
        renderHistoryModal();
        renderInsight();
        toast('Changuito eliminado.');
      }
    }

    const editBtn = e.target.closest('[data-edit-purchase]');
    if (editBtn) {
      const id = editBtn.dataset.editPurchase;
      const purchase = state.purchases.find(p => p.id === id);
      if (!purchase) return;
      const card = editBtn.closest('.chg-history-card');
      if (!card) return;

      card.innerHTML = `
        <div style="display: grid; gap: 8px; font-size: 0.85rem;">
          <strong>✏️ Editando datos del changuito</strong>
          <label style="display: grid; gap: 2px; font-size: 0.75rem;">Supermercado / Local:
            <input type="text" id="editStore_${id}" value="${esc(purchase.store || '')}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
          </label>
          <label style="display: grid; gap: 2px; font-size: 0.75rem;">Fecha:
            <input type="date" id="editDate_${id}" value="${purchase.date || ''}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
          </label>
          <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
            <button class="btn btn-outline btn-sm" type="button" data-cancel-edit-purchase="${id}">Cancelar</button>
            <button class="pastel-btn btn-sm" type="button" data-save-purchase="${id}">Guardar</button>
          </div>
        </div>
      `;
    }

    const cancelBtn = e.target.closest('[data-cancel-edit-purchase]');
    if (cancelBtn) { renderHistoryModal(); }

    const saveBtn = e.target.closest('[data-save-purchase]');
    if (saveBtn) {
      const id = saveBtn.dataset.savePurchase;
      const purchase = state.purchases.find(p => p.id === id);
      if (purchase) {
        purchase.store = document.getElementById(`editStore_${id}`)?.value.trim() || '';
        purchase.date = document.getElementById(`editDate_${id}`)?.value || todayISO();
        save();
        renderHistoryModal();
        renderInsight();
        toast('Changuito actualizado.');
      }
    }

    const editItemBtn = e.target.closest('[data-edit-item-purchase]');
    if (editItemBtn) {
      const pId = editItemBtn.dataset.editItemPurchase;
      const itemIdx = Number(editItemBtn.dataset.itemIdx);
      const purchase = state.purchases.find(p => p.id === pId);
      if (!purchase || !purchase.items[itemIdx]) return;

      const item = purchase.items[itemIdx];
      const card = editItemBtn.closest('.chg-history-card');
      if (!card) return;

      card.innerHTML = `
        <div style="display: grid; gap: 8px; font-size: 0.85rem;">
          <strong>✏️ Editando producto: ${esc(item.name)}</strong>
          <label style="display: grid; gap: 2px; font-size: 0.75rem;">Nombre del producto:
            <input type="text" id="editItemName_${pId}_${itemIdx}" value="${esc(item.name || '')}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <label style="display: grid; gap: 2px; font-size: 0.75rem;">Cantidad:
              <input type="number" min="1" id="editItemQty_${pId}_${itemIdx}" value="${item.qty || 1}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
            </label>
            <label style="display: grid; gap: 2px; font-size: 0.75rem;">Precio total pagado:
              <input type="text" inputmode="decimal" id="editItemPaid_${pId}_${itemIdx}" value="${String(item.paid || 0).replace('.', ',')}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
            </label>
          </div>
          <div style="display: flex; justify-content: flex-end; gap: 6px; margin-top: 4px;">
            <button class="btn btn-outline btn-sm" type="button" data-cancel-edit-purchase="${pId}">Cancelar</button>
            <button class="pastel-btn btn-sm" type="button" data-save-item-purchase="${pId}" data-item-idx="${itemIdx}">Guardar producto</button>
          </div>
        </div>
      `;
    }

    const saveItemBtn = e.target.closest('[data-save-item-purchase]');
    if (saveItemBtn) {
      const pId = saveItemBtn.dataset.saveItemPurchase;
      const itemIdx = Number(saveItemBtn.dataset.itemIdx);
      const purchase = state.purchases.find(p => p.id === pId);
      if (purchase && purchase.items[itemIdx]) {
        const newName = document.getElementById(`editItemName_${pId}_${itemIdx}`)?.value.trim();
        const newQty = parseInt(document.getElementById(`editItemQty_${pId}_${itemIdx}`)?.value, 10) || 1;
        const newPaid = parseAmount(document.getElementById(`editItemPaid_${pId}_${itemIdx}`)?.value);

        if (newName) purchase.items[itemIdx].name = newName;
        purchase.items[itemIdx].qty = newQty;
        purchase.items[itemIdx].paid = round2(newPaid);

        save();
        renderHistoryModal();
        renderInsight();
        toast('Producto actualizado con éxito.');
      }
    }

    const btn = e.target.closest('.chg-item [data-act]');
    if (!btn) return;
    const id = btn.closest('.chg-item').dataset.id;
    if (btn.dataset.act === 'edit') startEdit(id);
    if (btn.dataset.act === 'del') {
      state.items = state.items.filter((x) => x.id !== id);
      if (editingId === id) resetForm();
      save(); render();
    }
  });

  let timer;
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { renderTotals(); renderInsight(); }, 250); };
  const watch = (id, cb) => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(cb).observe(el, { childList: true, subtree: true, characterData: true });
  };
  watch('expenseTable', refresh);
  watch('dolarBadge', refresh);
  watch('userEmail', () => { load(); render(); });
  document.getElementById('monthPicker')?.addEventListener('change', refresh);

  load();
  renderIcons();
  render();
})();
