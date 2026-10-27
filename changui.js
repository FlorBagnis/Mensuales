/* =========================================================
   CHANGUI: CALCULÁ TU COMPRA · módulo de Mensuales
   Creado by Flor Bagnis 💗
   + Compra por kilo (verduras, frutas, queso y fiambres, carne, pollo, pescado)
   + Solapa "¿Qué se compró?" en Gastos del mes
   + Historial corregido: botones Ver / PDF / CSV funcionan con todas las tarjetas
   + v3: resumen (🛒 🏪 🥚) leído directo de Gastos del mes, sin duplicados al guardar
   + v4: el resumen cuenta también envíos y gastos viejos de Changui;
         al guardar un chango abierto desde el Historial se REEMPLAZA siempre (aunque cambies la fecha)
   + v5: el ENVÍO va dentro del mismo gasto de la compra (ej. leche 1.600 + envío 4.000 = 5.600),
         el Historial muestra el TOTAL de cada chango y el resumen calcula en pesos y dólares
   + v6: el ENVÍO va ADENTRO del gasto de la compra, igual que en Changui (producto + envío en una fila,
         y en el Detalle se ven los productos y el envío). Con varios productos en pesos, van juntos en un gasto.
         Categoría: la que elijas; en "Automático", Alimentos si hay comida.
========================================================= */
(() => {
  'use strict';

  const root = document.getElementById('changui');
  if (!root) return;
  const $ = (s) => root.querySelector(s);

  /* ---------- utilidades ---------- */
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nf2 = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const nf3 = new Intl.NumberFormat('es-AR', { maximumFractionDigits: 3 });
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

  // Peso: acepta 0,5 · 0.5 · 1,25 · 1.500
  const parseWeight = (v) => {
    let s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  const kgLabel = (kg) => {
    kg = Number(kg) || 0;
    return kg < 1 ? `${Math.round(kg * 1000)} g` : `${nf3.format(kg)} kg`;
  };
  const qtyText = (it) => (it.byKg ? kgLabel(it.kg) : `${it.qty || 1}x`);

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

  // Íconos propios (sprite SVG que viene en index.html)
  const ICO = (n) => `<svg class="ic" aria-hidden="true"><use href="#ic-${n}"/></svg>`;

  const ICONS = [
    // Alimentos y bebidas
    { k: 'leche', e: ICO('milk'), label: 'Lácteos', cat: 'Alimentos' },
    { k: 'agua', e: ICO('water'), label: 'Agua', cat: 'Alimentos' },
    { k: 'bebidas', e: ICO('cup'), label: 'Bebidas', cat: 'Alimentos' },
    { k: 'carne', e: ICO('meat'), label: 'Carne', cat: 'Alimentos' },
    { k: 'pescado', e: ICO('fish'), label: 'Pescado', cat: 'Alimentos' },
    { k: 'pollo', e: ICO('chicken'), label: 'Pollo', cat: 'Alimentos' },
    { k: 'queso', e: ICO('cheese'), label: 'Queso y fiambre', cat: 'Alimentos' },
    { k: 'pan', e: ICO('bread'), label: 'Panadería', cat: 'Alimentos' },
    { k: 'verdura', e: ICO('broccoli'), label: 'Verduras', cat: 'Alimentos' },
    { k: 'fruta', e: ICO('apple'), label: 'Frutas', cat: 'Alimentos' },
    { k: 'huevos', e: ICO('egg'), label: 'Huevos', cat: 'Alimentos' },
    { k: 'almacen', e: ICO('pasta'), label: 'Almacén', cat: 'Alimentos' },
    { k: 'snacks', e: ICO('choco'), label: 'Snacks y dulces', cat: 'Alimentos' },

    // Hogar y cotidiano
    { k: 'limpieza', e: ICO('bottle'), label: 'Limpieza', cat: 'Hogar' },
    { k: 'higiene', e: ICO('tp'), label: 'Higiene', cat: 'Personal' },
    { k: 'mascotas', e: ICO('dog'), label: 'Mascotas', cat: 'Mascotas' },
    { k: 'bebes', e: ICO('baby'), label: 'Bebés y niños', cat: 'Hogar' },
    { k: 'electro', e: ICO('plug'), label: 'Electro', cat: 'Hogar' },
    { k: 'tecnologia', e: ICO('laptop'), label: 'Tecnología', cat: 'Hogar' },
    { k: 'ferreteria', e: ICO('hammer'), label: 'Ferretería y arreglos', cat: 'Hogar' },

    // Personal, extras y varios
    { k: 'zapatillas', e: ICO('sneaker'), label: 'Calzado e indumentaria', cat: 'Personal' },
    { k: 'farmacia', e: ICO('pill'), label: 'Farmacia y salud', cat: 'Salud' },
    { k: 'regalos', e: ICO('gift'), label: 'Regalos', cat: 'Varios' },
    { k: 'libreria', e: ICO('books'), label: 'Librería y oficina', cat: 'Varios' },
    { k: 'jardin', e: ICO('blossom'), label: 'Jardín y plantas', cat: 'Hogar' },
    { k: 'decoracion', e: ICO('sofa'), label: 'Decoración y hogar', cat: 'Hogar' },
    { k: 'vehiculo', e: ICO('car'), label: 'Vehículo / Auto', cat: 'Varios' },
    { k: 'otros', e: ICO('cart'), label: 'Otros', cat: 'Varios' }
  ];
  const iconOf = (k) => ICONS.find((i) => i.k === k) || ICONS[ICONS.length - 1];

  // El envío a domicilio viaja DENTRO del gasto de la compra, como un renglón más del detalle
  const isDeliv = (it) => !!(it && (it.isDelivery || /^env[ií]o a domicilio$/i.test(String(it.name || '').trim())));
  const emoji = (it) => (isDeliv(it) ? ICO('box') : iconOf(it && it.icon).e);
  // "$ 5.600,00" + "u$s 10,00" (muestra solo la moneda que tenga monto)
  const pairMoney = (v) => {
    const parts = [];
    if (v.ARS > 0 || v.USD <= 0) parts.push(money(v.ARS, 'ARS'));
    if (v.USD > 0) parts.push(money(v.USD, 'USD'));
    return parts.join(' + ');
  };

  // Rubros que se pueden comprar por kilo
  const KG_KEYS = ['verdura', 'fruta', 'queso', 'carne', 'pollo', 'pescado'];

  const userKey = () => 'changui_v1_' + ((document.getElementById('userEmail')?.textContent || '').trim().toLowerCase() || 'anon');
  let state = { items: [], general: 0, purchases: [] };

  // Si el changuito viene del Historial ("📂 Ver"), se recuerda de dónde, así al registrar no se duplica
  let loadedFrom = null;
  let registering = false;
  // El chango abierto también se guarda en el navegador, así no se pierde si la app se refresca
  const setLoaded = (v) => { loadedFrom = v || null; state.loadedFrom = v || null; };

  // "Firma" de un chango: misma fecha, local, modalidad y productos = es el mismo chango
  const purchaseSig = (p) => [
    p.date || '', String(p.store || '').toLowerCase().trim(), p.deliveryMode || 'presencial', round2(p.deliveryCost || 0),
    (p.items || []).map((i) => String(i.name || '').toLowerCase().trim() + '|' + (i.byKg ? Number(i.kg) : Number(i.qty || 1)) + '|' + round2(i.paid)).sort().join(';')
  ].join('#');

  // Saca de la lista local los changos repetidos (queda el que ya está enlazado a su gasto)
  function dedupeLocal() {
    const groups = new Map();
    (state.purchases || []).forEach((p) => {
      if (!p || !(p.items || []).length) return;
      const k = purchaseSig(p);
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(p);
    });
    const drop = new Set();
    groups.forEach((arr) => {
      if (arr.length < 2) return;
      const linked = arr.filter((p) => !p.draft && Array.isArray(p.expIds) && p.expIds.length);
      if (linked.length) arr.filter((p) => !linked.includes(p)).forEach((p) => drop.add(p));
    });
    if (!drop.size) return false;
    state.purchases = state.purchases.filter((p) => !drop.has(p));
    try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ }
    return true;
  }

  function load() {
    try {
      const s = JSON.parse(localStorage.getItem(userKey()) || 'null');
      state = Object.assign({ items: [], general: 0, purchases: [] }, s || {});
    } catch (e) { state = { items: [], general: 0, purchases: [] }; }
    if (!Array.isArray(state.items)) state.items = [];
    if (!Array.isArray(state.purchases)) state.purchases = [];
    state.general = Math.min(100, Math.max(0, Number(state.general) || 0));
    state.genName = String(state.genName || '');
    loadedFrom = state.loadedFrom && typeof state.loadedFrom === 'object' && Array.isArray(state.loadedFrom.expIds) ? state.loadedFrom : null;

    // Limpieza: copias duplicadas que creaba el sincronizador viejo (tienen "desc" y ids de gasto como texto).
    // El gasto real sigue en Gastos del mes y se ve igual en el Historial.
    const before = state.purchases.length;
    state.purchases = state.purchases.filter((p) => !(p && typeof p.desc === 'string' && Array.isArray(p.expenses) && p.expenses.every((x) => typeof x === 'string')));
    if (state.purchases.length !== before) {
      try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ }
    }
    dedupeLocal();
  }
  function save() {
    try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ }
    enhanceTable();
  }

  let selIcon = 'otros';
  let editingId = null;
  let kgMode = false;
  let priceTextNode = null;
  let tableObs = null;
  let insightOpen = false;   // solapa "Resumen del mes"
  const openKeys = new Set();

  // Historial: lista unificada que se muestra en el modal (local + gastos del mes)
  let historyCache = [];
  const findPurchase = (id) => historyCache.find((p) => p.id === id);
  const findLocalPurchase = (id) => state.purchases.find((p) => p.id === id);

  let toastTimer;
  function toast(text) {
    let t = $('#chgToast');
    if (!t) {
      root.insertAdjacentHTML('beforeend', '<div id="chgToast" class="chg-toast" role="status"></div>');
      t = $('#chgToast');
    }
    t.innerHTML = esc(text).replace(/\{\{(\w+)\}\}/g, (m, n) => ICO(n));
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
    const p = it.promo || { type: 'none' };
    // Por kilo: precio por kg x kilos comprados (solo admite % de descuento)
    if (it.byKg) {
      const base = (it.price || 0) * (Number(it.kg) || 0);
      const paid = p.type === 'pct' ? base * (1 - p.value / 100) : base;
      return { base, paid, saved: base - paid };
    }
    const base = (it.price || 0) * (it.qty || 1);
    let paid = base;
    if (p.type === 'pct') paid = base * (1 - p.value / 100);
    else if (p.type === '2x1') paid = (it.price || 0) * Math.ceil((it.qty || 1) / 2);
    else if (p.type === 'second') {
      const pairs = Math.floor((it.qty || 1) / 2);
      paid = (it.price || 0) * ((it.qty || 1) - pairs) + (it.price || 0) * pairs * (1 - p.value / 100);
    }
    return { base, paid, saved: base - paid };
  }

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

  /* ---------- compra por kilo: interfaz ---------- */
  function setupKgUI() {
    const icons = $('#chgIcons');
    const qtyLabel = $('#chgQty')?.closest('label');
    const priceLabel = $('#chgPrice')?.closest('label');
    if (!icons || !qtyLabel || !priceLabel) return;

    // Texto "Precio por unidad" -> editable
    priceTextNode = [...priceLabel.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());

    icons.insertAdjacentHTML('afterend',
      `<div id="chgKgMode" class="chg-gen-chips chg-kgmode" hidden>
         <button type="button" data-kgmode="unit">Por unidad</button>
         <button type="button" data-kgmode="kg">${ICO('scale')} Por kilo</button>
       </div>`);

    qtyLabel.id = 'chgQtyWrap';
    qtyLabel.insertAdjacentHTML('afterend',
      `<label class="chg-field" id="chgWeightWrap" hidden>Peso comprado
         <div class="chg-weight">
           <input id="chgWeight" type="text" inputmode="decimal" placeholder="Ej. 0,5">
           <select id="chgWeightUnit"><option value="kg" selected>kg</option><option value="g">g</option></select>
         </div>
       </label>`);

    qtyLabel.parentElement.insertAdjacentHTML('afterend',
      `<div id="chgWeightChips" class="chg-gen-chips chg-wchips" hidden>
         <button type="button" data-wv="100" data-wu="g">100 g</button>
         <button type="button" data-wv="250" data-wu="g">250 g</button>
         <button type="button" data-wv="500" data-wu="g">½ kg</button>
         <button type="button" data-wv="1" data-wu="kg">1 kg</button>
         <button type="button" data-wv="2" data-wu="kg">2 kg</button>
       </div>
       <div id="chgKgPreview" class="chg-kgprev" hidden></div>`);

    $('#chgWeight').addEventListener('input', updateKgPreview);
    $('#chgWeightUnit').addEventListener('change', updateKgPreview);
  }

  // Convierte el peso tipeado a kilos. En "g" divide por 1000.
  // En "kg", un número >= 100 se toma como gramos (ej. 310 o 500) y también se divide por 1000.
  // Los pesos reales (0,5 · 1,25 · 10 · 25 kg) quedan como están.
  const toKg = (w, unit) => (unit === 'g' || (unit === 'kg' && w >= 100) ? w / 1000 : w);

  function currentKg() {
    const w = parseWeight($('#chgWeight')?.value);
    return toKg(w, $('#chgWeightUnit')?.value);
  }

  function updateKgPreview() {
    const box = $('#chgKgPreview');
    if (!box) return;
    if (!kgMode) { box.textContent = ''; return; }
    const kg = currentKg();
    const price = parseAmount($('#chgPrice')?.value);
    const cur = $('#chgCur')?.value === 'USD' ? 'USD' : 'ARS';
    box.textContent = kg > 0 && price > 0 ? `${kgLabel(kg)} x ${fmt(price, cur)}/kg = ${fmt(price * kg, cur)}` : '';
  }

  function applyKgUI() {
    const eligible = KG_KEYS.includes(selIcon);
    if (!eligible) kgMode = false;
    const modeBox = $('#chgKgMode');
    if (!modeBox) return;
    modeBox.hidden = !eligible;
    modeBox.querySelectorAll('[data-kgmode]').forEach((b) => b.classList.toggle('on', (b.dataset.kgmode === 'kg') === kgMode));
    $('#chgQtyWrap').hidden = kgMode;
    $('#chgWeightWrap').hidden = !kgMode;
    $('#chgWeightChips').hidden = !kgMode;
    $('#chgKgPreview').hidden = !kgMode;
    if (priceTextNode) priceTextNode.nodeValue = kgMode ? 'Precio por kg ' : 'Precio por unidad ';

    // 2x1 y "2da unidad" no aplican al peso
    const promo = $('#chgPromo');
    [...promo.options].forEach((o) => { if (['2x1', '2nd50', '2nd70'].includes(o.value)) o.disabled = kgMode; });
    if (kgMode && ['2x1', '2nd50', '2nd70'].includes(promo.value)) promo.value = 'none';
    updateKgPreview();
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
    const line = it.byKg
      ? `${ICO('scale')} ${esc(kgLabel(it.kg))} x ${money(it.price, it.cur)}/kg`
      : `${it.qty} x ${money(it.price, it.cur)}`;
    return `
      <li class="chg-item" data-id="${it.id}">
        <span class="chg-ico">${ic.e}</span>
        <span class="chg-info">
          <strong>${esc(it.name)}</strong>
          <small>${line} ${badge}</small>
        </span>
        <span class="chg-sub">${old}<b>${money(c.paid, it.cur)}</b></span>
        <span class="chg-btns">
          <button class="pastel-btn" type="button" data-act="edit" title="Editar">${ICO('pencil')}</button>
          <button class="btn btn-outline" type="button" data-act="del" title="Quitar">${ICO('trash')}</button>
        </span>
      </li>`;
  }

  function renderCart() {
    const n = state.items.length;
    const delivery = getDeliveryCost();
    let itemsMarkup = n > 0 ? state.items.map(itemHTML).join('') : '';

    if (delivery > 0) {
      itemsMarkup += `
        <li class="chg-item" style="border-style: dashed; border-color: var(--pink-700); background: var(--pink-bg, rgba(234,91,142,0.05));">
          <span class="chg-ico">${ICO('box')}</span>
          <span class="chg-info">
            <strong>Envío a domicilio</strong>
            <small>Costo de logística</small>
          </span>
          <span class="chg-sub"><b>${money(delivery, 'ARS')}</b></span>
          <span class="chg-btns"></span>
        </li>`;
    }

    $('#chgCount').textContent = (n > 0 || delivery > 0) ? `(${n + (delivery > 0 ? 1 : 0)})` : '';
    $('#chgList').innerHTML = itemsMarkup || '<li class="chg-empty"><div>' + ICO('cart') + '</div><strong>Tu changuito está vacío</strong><br><span>Elegí un ícono, cargá el precio y sumalo.</span></li>';

    const gi = $('#chgGeneral');
    if (gi && document.activeElement !== gi) gi.value = state.general ? String(state.general).replace('.', ',') : '';
    root.querySelectorAll('[data-gen]').forEach((b) => b.classList.toggle('on', Number(b.dataset.gen) === state.general));
       syncGenSelect();
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

  /* ---------- Tendencias del mes: se calculan SIEMPRE desde Gastos del mes ---------- */
  // Un gasto cuenta como "de Changui" si: está marcado, tiene detalle de productos,
  // o la palabra "Changui" aparece en la descripción (también los pasados con "Pasar a Changui")
  const isChgExp = (e) => !!e && (
    e.fromChangui === true || e.changui === true || e.isChangui === true ||
    (Array.isArray(e.detalle) && e.detalle.length > 0) ||
    /\bchangui\b/i.test(String(e.description || ''))
  );
  // Envío a domicilio cargado como gasto aparte (compras viejas)
  const isDeliveryExp = (e) => !!e && (e.isDelivery === true || /^env[ií]o a domicilio\b/i.test(String(e.description || '').trim()));

  function renderInsight() {
    const box = $('#chgInsight');
    if (!box) return;
    const b = bridge();
    if (!b.getMonthExpenses) { box.innerHTML = '<span class="chg-pill">Conectando con tus gastos de Mensuales…</span>'; return; }

    const month = (b.getCurrentMonth && b.getCurrentMonth()) || todayISO().slice(0, 7);
    const list = b.getMonthExpenses(month) || [];
    const rate = dolar();
    const chg = list.filter((e) => isChgExp(e) || isDeliveryExp(e));
    // Para ordenar se pasa todo a pesos (si no hay dólar, 1 a 1); en pantalla se muestran pesos y dólares
    const score = (v) => v.ARS + v.USD * (rate || 1);
    const curKey = (c) => (c === 'USD' ? 'USD' : 'ARS');
    const pills = [];

    // 🛒 Comida y súper: la categoría Alimentos de Gastos del mes (el mismo número que el gráfico "Gastos por categoría")
    const food = list.filter((e) => e.category === 'Alimentos');
    const foodTot = { ARS: 0, USD: 0 };
    food.forEach((e) => { foodTot[curKey(e.currency)] += Number(e.amount || 0); });
    pills.push(food.length
      ? `${ICO('cart')} En ${esc(monthName(month))} venís gastando ${pairMoney(foodTot)} en comida y súper.`
      : `${ICO('cart')} En ${esc(monthName(month))} todavía no cargaste gastos de comida o súper.`);

    // Local y productos de un gasto. Formatos: "Changui en LOCAL (a, b)", "Envío a domicilio en LOCAL"
    // y los viejos "PRODUCTO (LOCAL)" (ej. "Huevos (Verdulería Roberto)")
    const splitNames = (t) => String(t || '').split(/[,;]/).map((x) => x.trim()).filter(Boolean);
    const parseExp = (e) => {
      const desc = String(e.description || '').trim();
      let m = desc.match(/\bchangui\s+en\s+([^(]*?)\s*(?:\(([^()]*)\))?\s*$/i);
      if (m) return { store: (m[1] || '').trim(), names: splitNames(m[2]) };
      m = desc.match(/^env[ií]o a domicilio en\s+(.+)$/i);
      if (m) return { store: m[1].trim(), names: [] };
      m = desc.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
      if (m) {
        const prefix = m[1].replace(/^changui\b[\s:\-–]*/i, '').trim();
        if (prefix) return { store: m[2].trim(), names: splitNames(prefix) };   // "Huevos (Verdulería Roberto)"
        const inner = splitNames(m[2]);
        if (inner.length > 1) return { store: '', names: inner };               // "Changui (leche, pan)"
      }
      return { store: '', names: [] };   // "Changui (Verdulería Roberto)": no se sabe qué producto es
    };
    // Si el producto viene solo del texto, se le busca un ícono por su nombre (huevos -> 🥚)
    const guessIcon = (name) => {
      const n = norm(name);
      const hit = ICONS.find((i) => i.k !== 'otros' && (n.includes(i.k) || n.includes(norm(i.label))));
      return hit ? hit.k : 'otros';
    };

    // 🏪 Dónde más gastaste (compras + envíos de Changui)
    const stores = {};
    chg.forEach((e) => {
      const name = parseExp(e).store;
      if (!name) return;
      if (!stores[name]) stores[name] = { ARS: 0, USD: 0 };
      stores[name][curKey(e.currency)] += Number(e.amount || 0);
    });
    const topStore = Object.entries(stores).sort((a, c) => score(c[1]) - score(a[1]))[0];
    if (topStore && score(topStore[1]) > 0) {
      pills.push(`${ICO('store')} Donde más gastaste fue en <strong>${esc(topStore[0])}</strong> (${pairMoney(topStore[1])}).`);
    }

    // 🥚 Producto que más pesó (y dónde lo compraste)
    const prods = {};
    chg.forEach((e) => {
      if (isDeliveryExp(e)) return;   // el envío no es un producto
      const cur = e.currency || 'ARS';
      const info = parseExp(e);
      let items = Array.isArray(e.detalle) && e.detalle.length ? e.detalle : null;
      if (!items) {
        const names = info.names;
        items = names.map((n) => ({ name: n, icon: guessIcon(n), cur, paid: Number(e.amount || 0) / names.length }));
      }
      items.map(viewFixed).forEach((it) => {
        if (isDeliv(it)) return;      // el envío que viaja dentro del gasto tampoco es un producto
        const key = String(it.name).trim().toLowerCase();
        if (!key) return;
        if (!prods[key]) prods[key] = { name: it.name, icon: it.icon, ARS: 0, USD: 0, stores: {} };
        const paid = Number(it.paid || 0);
        prods[key][curKey(it.cur || cur)] += paid;
        if (info.store) prods[key].stores[info.store] = (prods[key].stores[info.store] || 0) + paid;
      });
    });
    const topProd = Object.values(prods).sort((a, c) => score(c) - score(a))[0];
    if (topProd && score(topProd) > 0) {
      const topProdStore = Object.entries(topProd.stores).sort((a, c) => c[1] - a[1])[0];
      const where = topProdStore ? ` · ${esc(topProdStore[0])}` : '';
      pills.push(`${iconOf(topProd.icon).e} Producto que más pesó este mes: <strong>${esc(topProd.name)}</strong>${where} (${pairMoney(topProd)}).`);
    }

    box.innerHTML =
      `<button type="button" class="chg-ins-tog" aria-expanded="${insightOpen}">` +
        `<span>${ICO('chart')} Resumen de ${esc(monthName(month))}</span><span class="chg-ins-arrow">▸</span>` +
      `</button>` +
      `<div class="chg-ins-body"${insightOpen ? '' : ' hidden'}>` +
        pills.map((p) => `<span class="chg-pill">${p}</span>`).join('') +
      `</div>`;
  }

  function render() {
    renderCart();
    renderTotals();
    renderInsight();
  }

  function promoFromForm() {
    const v = $('#chgPromo').value;
    if (v === 'none') return { type: 'none' };
    if (kgMode && ['2x1', '2nd50', '2nd70'].includes(v)) return { type: 'none' };
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
    kgMode = false;
    $('#chgName').value = '';
    $('#chgPrice').value = '';
    $('#chgQty').value = '1';
    if ($('#chgWeight')) $('#chgWeight').value = '';
    if ($('#chgWeightUnit')) $('#chgWeightUnit').value = 'kg';
    promoToForm(null);
    $('#chgSubmit').innerHTML = ICO('plus') + ' Agregar al changuito';
    $('#chgCancelEdit').hidden = true;
    renderIcons();
    applyKgUI();
  }

  function submitItem(e) {
    e.preventDefault();
    const price = parseAmount($('#chgPrice').value);
    if (!(price > 0)) { toast(kgMode ? 'Ingresá el precio por kilo.' : 'Ingresá el precio del producto.'); $('#chgPrice').focus(); return; }

    const byKg = kgMode && KG_KEYS.includes(selIcon);
    let kg = 0;
    if (byKg) {
      kg = Math.round(currentKg() * 1000) / 1000;
      if (!(kg > 0)) { toast('Ingresá el peso comprado.'); $('#chgWeight').focus(); return; }
    }

    const it = {
      id: editingId || uid(),
      icon: selIcon,
      name: $('#chgName').value.trim() || iconOf(selIcon).label,
      price,
      qty: byKg ? 1 : Math.min(99, Math.max(1, parseInt($('#chgQty').value, 10) || 1)),
      byKg,
      kg: byKg ? kg : 0,
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
    kgMode = !!it.byKg;
    $('#chgName').value = it.name;
    $('#chgPrice').value = formatAmountInput(String(it.price).replace('.', ','));
    $('#chgQty').value = String(it.qty);
    $('#chgCur').value = it.cur;
    if (it.byKg) {
      const grams = Number(it.kg) < 1;
      $('#chgWeightUnit').value = grams ? 'g' : 'kg';
      $('#chgWeight').value = String(grams ? Math.round(it.kg * 1000) : it.kg).replace('.', ',');
    } else {
      $('#chgWeight').value = '';
    }
    promoToForm(it.promo);
    $('#chgSubmit').innerHTML = ICO('save') + ' Guardar cambios';
    $('#chgCancelEdit').hidden = false;
    renderIcons();
    applyKgUI();
    $('#chgForm').scrollIntoView({ behavior: 'smooth', block: 'center' });
    $('#chgName').focus();
  }

  /* ---------- registrar la compra en Gastos del mes (sin duplicar) ---------- */
  // Si addExpenses no devuelve los ids de los gastos nuevos, se los busca en el mes (misma fecha, descripción y monto)
  async function resolveNewIds(month, idsBefore, wanted) {
    const b = bridge();
    let got = [];
    for (let t = 0; t < 8; t++) {
      const list = b.getMonthExpenses ? b.getMonthExpenses(month) || [] : [];
      const used = new Set();
      got = [];
      wanted.forEach((x) => {
        const hit = list.find((e) => e.id && !idsBefore.has(e.id) && !used.has(e.id) && e.date === x.date
          && String(e.description || '').toLowerCase().replace(/\s+/g, ' ').trim() === String(x.description || '').toLowerCase().replace(/\s+/g, ' ').trim()
          && Math.abs(Number(e.amount) - Number(x.amount)) < 0.01);
        if (hit) { used.add(hit.id); got.push(hit.id); }
      });
      if (got.length >= wanted.length) break;
      await new Promise((r) => setTimeout(r, 250));
    }
    return got;
  }

  async function registerPurchase() {
    if (registering) return;                       // evita el doble toque
    if (!state.items.length) { toast('Primero agregá productos al changuito.'); return; }
    const b = bridge();
    if (!b.addExpenses) { toast('No se pudo conectar con Mensuales.'); return; }

    const mode = $('#chgCatMode').value;
    const store = plain($('#chgStore').value).replace(/[()]/g, '');
    const date = $('#chgDate').value || todayISO();
    const g = state.general;
    const deliveryMode = $('#chgDeliveryMode')?.value || 'presencial';
    const deliveryCost = deliveryMode === 'envio' ? parseAmount($('#chgDeliveryCost')?.value) : 0;

    // La categoría sigue a la que elijas: si pusiste "Alimentos" (o cualquier otra) va esa;
    // en "Automático" cada producto va a la categoría de su ícono.
    const groups = {};
    state.items.forEach((it) => {
      const paid = itemCalc(it).paid * (1 - g / 100);
      const cat = mode === 'auto' ? iconOf(it.icon).cat : mode;
      const key = cat + '|' + it.cur;
      if (!groups[key]) groups[key] = { cat, cur: it.cur, amount: 0, items: [] };
      groups[key].amount += paid;
      groups[key].items.push(it);
    });

    const snap = (it) => ({
      name: it.name, icon: it.icon, cur: it.cur, price: it.price, qty: it.qty,
      byKg: !!it.byKg, kg: it.kg || 0, promo: it.promo,
      paid: round2(itemCalc(it).paid * (1 - g / 100))
    });

    const storeLabel = store ? ` en ${store}` : '';
    let expenses = Object.values(groups)
      .map((x) => ({
        description: `Changui${storeLabel} (${x.items.map(i => i.name).join(', ')})`,
        category: x.cat,
        amount: round2(x.amount),
        currency: x.cur,
        detalle: x.items.map(snap)   // viaja dentro del gasto (Firestore) para la solapa
      }))
      .filter((x) => x.amount > 0);

    // v6: con ENVÍO, los productos en pesos van JUNTOS en UN solo gasto y el envío va ADENTRO,
    // igual que en Changui. Con un solo producto es lo mismo: producto + envío (ej. SANCOR 1.600 + envío 4.000 = 5.600).
    // En el Detalle se ven todos los productos y el envío como un renglón más.
    // Categoría: la que elegiste; en "Automático", Alimentos si hay comida, si no la del grupo más grande.
    let delItem = null;
    if (deliveryCost > 0) {
      delItem = {
        name: 'Envío a domicilio', icon: 'otros', cur: 'ARS',
        price: round2(deliveryCost), qty: 1, byKg: false, kg: 0,
        promo: { type: 'none' }, paid: round2(deliveryCost), isDelivery: true
      };
      const ars = expenses.filter((x) => x.currency === 'ARS');
      if (ars.length) {
        const main = ars.slice().sort((a, c) => c.amount - a.amount)[0];
        const todos = ars.flatMap((x) => x.detalle);
        const merged = {
          description: `Changui${storeLabel} (${todos.map((i) => i.name).join(', ')})`,
          category: mode !== 'auto' ? mode : (ars.some((x) => x.category === 'Alimentos') ? 'Alimentos' : main.category),
          amount: round2(ars.reduce((s, x) => s + x.amount, 0) + deliveryCost),
          currency: 'ARS',
          detalle: todos.concat([Object.assign({}, delItem)])
        };
        expenses = expenses.filter((x) => x.currency !== 'ARS').concat([merged]);
      } else {
        // Compra solo en dólares: el envío (en pesos) va en su propio gasto de Changui
        const biggest = expenses.slice().sort((a, c) => c.amount - a.amount)[0];
        expenses.push({
          description: `Changui${storeLabel} (Envío a domicilio)`,
          category: mode !== 'auto' ? mode : (biggest ? biggest.category : 'Otros'),
          amount: round2(deliveryCost),
          currency: 'ARS',
          detalle: [Object.assign({}, delItem)]
        });
      }
    }

    // Copia local del detalle (respaldo)
    const details = expenses.map((x) => ({
      description: x.description, amount: x.amount, currency: x.currency, items: x.detalle
    }));

    if (!expenses.length) { toast('El total de la compra es cero.'); return; }

    const lf = loadedFrom;
    const btn = $('#chgRegisterBtn');
    registering = true;
    if (btn) btn.disabled = true;
    try {
      const monthOfNew = date.slice(0, 7);
      const idsBefore = new Set((b.getMonthExpenses ? b.getMonthExpenses(monthOfNew) || [] : []).map((x) => x.id));
      let newIds = [];
      let replaced = false;

      // A) Chango abierto desde el Historial (mismo mes): se ACTUALIZAN sus gastos, no se crea ninguno repetido
      const canUpdateInPlace = !!(lf && !lf.draft && lf.expIds.length && b.updateExpense && b.getMonthExpenses && lf.month === monthOfNew);
      const oldExps = canUpdateInPlace ? lf.expIds.map((id) => findExp(lf.month, id)).filter(Boolean) : [];

      if (oldExps.length) {
        const unused = oldExps.slice();
        const take = (x) => {
          const isDel = isDeliveryExp(x);
          let i = unused.findIndex((o) => isDeliveryExp(o) === isDel && (o.currency || 'ARS') === x.currency && o.category === x.category);
          if (i < 0) i = unused.findIndex((o) => isDeliveryExp(o) === isDel && (o.currency || 'ARS') === x.currency);
          return i >= 0 ? unused.splice(i, 1)[0] : null;
        };
        const toAdd = [];
        for (const x of expenses) {
          const o = take(x);
          if (!o) { toAdd.push(x); continue; }
          const payload = { month: lf.month, id: o.id, amount: x.amount, category: x.category, description: x.description, date };
          if (x.detalle) payload.detalle = x.detalle;
          let ok = false;
          try { ok = !!(await b.updateExpense(payload)); } catch (e) { ok = false; }
          if (!ok) { toast('No se pudo actualizar la compra. No se guardó nada repetido: probá de nuevo.'); return; }
          o.amount = x.amount; o.category = x.category; o.description = x.description; o.date = date;
          if (x.detalle) o.detalle = x.detalle; else delete o.detalle;
          newIds.push(o.id);
        }
        // productos nuevos que no tenían gasto propio (ej. otra moneda o categoría)
        if (toAdd.length) {
          let r2 = false;
          try { r2 = await b.addExpenses({ date, expenses: toAdd }); } catch (e) { r2 = false; }
          if (!r2) { toast('Se actualizó la compra, pero no pude sumar los productos nuevos. Probá de nuevo.'); return; }
          let added = Array.isArray(r2) ? r2 : [];
          if (added.length < toAdd.length) added = await resolveNewIds(monthOfNew, idsBefore, toAdd.map((x) => Object.assign({}, x, { date })));
          newIds = newIds.concat(added);
        }

        // Compras viejas: el envío estaba como gasto aparte. Si ahora va adentro de la compra,
        // se busca ese gasto suelto (misma fecha, mismo local y mismo monto) para unirlo y no contarlo dos veces.
        const legacy = [];
        if (deliveryCost > 0) {
          const wantDesc = norm('Envío a domicilio' + storeLabel);
          const cands = (b.getMonthExpenses(lf.month) || []).filter((e) => isDeliveryExp(e)
            && !lf.expIds.includes(e.id) && !newIds.includes(e.id)
            && e.date === (lf.date || date)
            && norm(e.description) === wantDesc
            && Math.abs(Number(e.amount) - deliveryCost) < 0.01);
          if (cands.length === 1) legacy.push(cands[0]);
        }

        // gastos viejos que ya no corresponden (ej. el envío que ahora va adentro de la compra)
        const removeIds = unused.map((o) => o.id).concat(legacy.map((o) => o.id));
        if (removeIds.length && b.removeExpenses) {
          try { await b.removeExpenses({ month: lf.month, ids: removeIds }); } catch (e) { /* sigue */ }
        }
        replaced = true;
        state.purchases = state.purchases.filter((p) => p.id !== lf.id);
      } else {
        // B) Chango nuevo (o que no se pudo enlazar): se agrega, y si venía de otro se borra el viejo
        // Anti-duplicados: si un gasto IDÉNTICO ya está en el mes (misma fecha, descripción, monto,
        // moneda y categoría), se reutiliza en vez de crearlo de nuevo.
        // Solo si el chango viene del Historial (lf). Si lo agregás a mano, se crea siempre, aunque sea igual a otro.
        const existing = lf && b.getMonthExpenses ? b.getMonthExpenses(monthOfNew) || [] : [];
        const taken = new Set();
        const reuseIds = [];
        const fresh = [];
        expenses.forEach((x) => {
          const hit = existing.find((e) => e.id && !taken.has(e.id) && e.date === date
            && norm(e.description) === norm(x.description)
            && (e.currency || 'ARS') === x.currency
            && e.category === x.category
            && Math.abs(Number(e.amount) - Number(x.amount)) < 0.01);
          if (hit) { taken.add(hit.id); reuseIds.push(hit.id); } else fresh.push(x);
        });

        let added = [];
        if (fresh.length) {
          let res = false;
          try { res = await b.addExpenses({ date, expenses: fresh }); } catch (e) { res = false; }
          if (!res) { toast('No se pudo registrar la compra.'); return; }
          added = Array.isArray(res) ? res : [];
          if (added.length < fresh.length) added = await resolveNewIds(monthOfNew, idsBefore, fresh.map((x) => Object.assign({}, x, { date })));
        }
        newIds = reuseIds.concat(added);
        if (reuseIds.length) replaced = true;   // ya existía: no se duplicó

        if (lf) {
          const oldIds = (lf.expIds || []).filter((i) => !newIds.includes(i));
          if (!lf.draft && oldIds.length && b.removeExpenses) {
            try { replaced = !!(await b.removeExpenses({ month: lf.month, ids: oldIds })); } catch (e) { replaced = false; }
          } else if (!lf.draft && lf.expIds.length && !oldIds.length) {
            replaced = true;   // no había nada viejo para borrar
          }
          // También se saca la copia local si nunca estuvo enlazada a un gasto (no quedan dos tarjetas)
          if (lf.draft || replaced || !lf.expIds.length) state.purchases = state.purchases.filter((p) => p.id !== lf.id);
        }
      }

      const newP = {genName: g > 0 ? (state.genName || '') : '', genPct: g,
        id: uid(), date, store, deliveryMode, deliveryCost,
        expIds: newIds, expMonth: date.slice(0, 7),
        expenses: details,
        items: state.items.map((it) => ({
          name: it.name, icon: it.icon, cur: it.cur, price: it.price, qty: it.qty,
          byKg: !!it.byKg, kg: it.kg || 0, promo: it.promo,
          paid: round2(itemCalc(it).paid * (1 - g / 100))
        })).concat(delItem ? [Object.assign({}, delItem)] : [])
      };

      // Solo al guardar un chango abierto desde el Historial: se limpian copias locales idénticas
      // que quedaron sin enlazar. Nunca se borran gastos reales. Un chango manual nuevo se agrega siempre.
      if (lf) {
        const sigNew = purchaseSig(newP);
        state.purchases = state.purchases.filter((p) => !(purchaseSig(p) === sigNew && !(Array.isArray(p.expIds) && p.expIds.length)));
      }

      state.purchases.unshift(newP);
      state.purchases = state.purchases.slice(0, 60);
      state.items = [];
      state.general = 0;
      state.genName = '';
      setLoaded(null);
      save();
      $('#chgStore').value = '';
      if ($('#chgDeliveryCost')) $('#chgDeliveryCost').value = '';
      if ($('#chgDeliveryMode')) $('#chgDeliveryMode').value = 'presencial';
      if ($('#chgDeliveryCostWrap')) $('#chgDeliveryCostWrap').hidden = true;
      resetForm();
      render();
      if (replaced) toast('Listo, actualicé esa compra en tus gastos (no se duplicó).');
      else if (lf && !lf.draft && lf.expIds.length) toast('Se guardó, pero NO pude borrar la compra anterior: borrá la repetida con la {{x}} en Gastos del mes.');
      else toast('Listo, la compra se sumó a tus gastos.');
    } finally {
      registering = false;
      if (btn) btn.disabled = false;
    }
  }

  /* ---------- solapa "¿Qué se compró?" en Gastos del mes ---------- */
  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const isoFromCell = (t) => {
    const m = String(t || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };

  // Detalle armado desde texto o compras viejas (todavía no guardado en el gasto)
  const pendingItems = new Map();

  const findExp = (month, id) => {
    const b = bridge();
    return (b.getMonthExpenses ? b.getMonthExpenses(month) || [] : []).find((x) => x.id === id);
  };
  const canEditExpenses = () => typeof bridge().updateExpense === 'function';
  const currentList = (exp) => (exp && Array.isArray(exp.detalle) && exp.detalle.length ? exp.detalle : pendingItems.get(exp && exp.id));

  // Vista corregida de un producto cargado con el error de los mil (310 kg -> 310 g), sin tocar el original
  const viewFixed = (it) => (it && it.byKg && Number(it.kg) >= 100
    ? Object.assign({}, it, { kg: Math.round(Number(it.kg)) / 1000, paid: round2((Number(it.paid) || 0) / 1000) })
    : it);

  const normItem = (x, cur) => ((x = viewFixed(x)), {
    name: String(x.name || 'Producto'),
    icon: x.icon || 'otros',
    cur: x.cur || cur,
    price: Number(x.price) || 0,
    qty: Number(x.qty) || 1,
    byKg: !!x.byKg,
    kg: Number(x.kg) || 0,
    promo: x.promo || { type: 'none' },
    paid: round2(Number(x.paid) || 0),
    ...(x.isDelivery ? { isDelivery: true } : {})
  });

  // Productos de un gasto de Changui: del propio gasto, de compras guardadas o del texto
  function getDetail(desc, iso, exp) {
    if (exp && Array.isArray(exp.detalle) && exp.detalle.length) return { items: exp.detalle.map(viewFixed), stored: true };
    const d = norm(desc);
    const cur = (exp && exp.currency) || 'ARS';
    const P = state.purchases || [];
    for (const p of P) {
      if (iso && p.date !== iso) continue;
      for (const ex of (p.expenses || [])) {
        if (ex && !ex.isDelivery && norm(ex.description) === d && ex.items && ex.items.length) {
          return { items: ex.items.map((x) => normItem(x, cur)), stored: false };
        }
      }
    }
    for (const p of P) {
      if (iso && p.date !== iso) continue;
      const its = (p.items || []).filter((it) => it.name && d.includes(norm(it.name)));
      if (its.length) return { items: its.map((x) => normItem(x, cur)), stored: false };
    }
    const m = String(desc).match(/\(([^()]*)\)\s*$/);
    const names = m ? m[1].split(',').map((s) => s.trim()).filter(Boolean) : [];
    return { items: names.map((n) => normItem({ name: n }, cur)), stored: false };
  }

  function detailHTML(res, edit) {
    const items = res.items || [];
    let unpriced = 0;
    let body = '';
    if (items.length) {
      body = items.map((it, idx) => {
        const priced = Number(it.paid) > 0;
        if (!priced) unpriced++;
        const promoName = promoLabel(it.promo);
        const promo = promoName ? ` · ${ICO('tag')} ${esc(promoName)}` : '';
        const baseP = itemCalc(it).base;
        const hasPromo = !!promoName && baseP > Number(it.paid) + 0.005;
         const sub = priced
          ? (it.byKg ? `${ICO('scale')} ${esc(kgLabel(it.kg))} x ${money(it.price, it.cur)}/kg${promo}` : `${it.qty || 1} x ${money(it.price, it.cur)}${promo}`)
          : `Sin precio · tocá ${ICO('pencil')} para cargarlo`;
           const right = priced
          ? (hasPromo ? `<s class="chg-old">${money(baseP, it.cur)}</s> ` : '') + `<b>${money(it.paid, it.cur)}</b>`
          : '<span class="chg-d-sub">—</span>';
        const btns = edit
          ? `<button type="button" class="chg-d-edit" data-idx="${idx}" title="Editar producto">${ICO('pencil')}</button><button type="button" class="chg-d-del" data-idx="${idx}" title="Quitar producto">${ICO('x')}</button>`
          : '';
        return `<div class="chg-d-line"><span>${emoji(it)}</span><span class="chg-d-name">${esc(it.name)}<span class="chg-d-sub">${sub}</span></span><span class="chg-d-right">${right}${btns}</span></div>`;
      }).join('');
    } else {
      body = '<p class="chg-d-note">No hay detalle guardado para este gasto.</p>';
    }
    const note = unpriced
      ? `<p class="chg-d-note">Faltan precios en ${unpriced} ${unpriced === 1 ? 'producto' : 'productos'}. Cuando todos tengan precio, el total del gasto se calcula solo.</p>`
      : '';
    const attrs = edit ? ` data-exp="${esc(edit.id)}" data-month="${esc(edit.month)}"` : '';
    return `<div class="chg-detail"${attrs}><div class="chg-d-title">${ICO('cart')} ¿QUÉ SE COMPRÓ?</div>${body}${note}</div>`;
  }

  function enhanceTable(force) {
    const tb = document.getElementById('expenseTable');
    if (!tb) return;
    // Si hay un producto abierto para editar, no se rearma la tabla (si no, el editor se cierra solo)
    if (force !== true && tb.querySelector('.chg-d-form')) return;
    if (tableObs) tableObs.disconnect();
    try {
      tb.querySelectorAll('.chg-detail-row').forEach((r) => r.remove());
      tb.querySelectorAll('.chg-tog').forEach((b) => b.remove());
      pendingItems.clear();

      const b = bridge();
      const month = (b.getCurrentMonth && b.getCurrentMonth()) || '';
      const editable = canEditExpenses();

      [...tb.children].forEach((tr) => {
        if (tr.tagName !== 'TR' || tr.children.length < 3) return;
        const dateCell = tr.children[0];
        const descCell = tr.children[1];
        const desc = tr.dataset.chgDesc || descCell.textContent.trim();
        if (!/^changui\b/i.test(desc)) return;
        tr.dataset.chgDesc = desc;

        const iso = isoFromCell(dateCell.textContent);
        const key = iso + '|' + norm(desc);
        const isOpen = openKeys.has(key);

        const idEl = tr.querySelector('[data-id]');
        const exp = idEl && month ? findExp(month, idEl.dataset.id) : null;
        const res = getDetail(desc, iso, exp);
        if (exp && !res.stored) pendingItems.set(exp.id, res.items);
        const canEdit = editable && !!exp;

        const detail = document.createElement('tr');
        detail.className = 'chg-detail-row' + (isOpen ? ' open' : '');
        detail.dataset.key = key;
        if (tr.style.display === 'none' || tr.hidden) detail.setAttribute('data-ph', '');
        detail.innerHTML = `<td colspan="${tr.children.length}">${detailHTML(res, canEdit ? { id: exp.id, month } : null)}</td>`;
        tr.after(detail);

        // La lista de productos se ve solo en el detalle; la descripción queda corta (el envío no cuenta como producto)
        const shortDesc = res.items.filter((x) => !isDeliv(x)).length >= 2 ? (desc.replace(/\s*\([^()]*\)\s*$/, '').trim() || desc) : desc;
        descCell.innerHTML =
          `<span class="chg-dtext" title="${esc(desc)}">${esc(shortDesc)}</span>` +
          `<button type="button" class="chg-tog" data-key="${esc(key)}" aria-expanded="${isOpen}" title="Ver qué se compró"><span class="chg-arrow">▸</span> Detalle</button>`;
      });
    } finally {
      observeTable();
    }
  }

  function observeTable() {
    const tb = document.getElementById('expenseTable');
    if (!tb) return;
    if (!tableObs) {
      let t;
      tableObs = new MutationObserver(() => { clearTimeout(t); t = setTimeout(enhanceTable, 40); });
    }
    tableObs.observe(tb, { childList: true, subtree: true, attributes: true, attributeFilter: ['style', 'hidden'] });
  }

  function pauseObs(fn) {
    if (tableObs) tableObs.disconnect();
    try { fn(); } finally { observeTable(); }
  }

  /* ---------- editar / quitar productos desde la solapa ---------- */
  function openItemEditor(btn) {
    const box = btn.closest('.chg-detail');
    const exp = box && findExp(box.dataset.month, box.dataset.exp);
    const list = exp && currentList(exp);
    const idx = Number(btn.dataset.idx);
    const it = list && list[idx];
    if (!it) return;

    const grams = it.byKg && Number(it.kg) < 1;
    const wt = it.byKg ? String(grams ? Math.round(it.kg * 1000) : it.kg).replace('.', ',') : '';
    const price = Number(it.price) > 0 ? formatAmountInput(String(it.price).replace('.', ',')) : '';
    const line = btn.closest('.chg-d-line');

    pauseObs(() => {
      line.insertAdjacentHTML('afterend',
        `<div class="chg-d-form" data-idx="${idx}">
           <strong>${emoji(it)} Editar producto</strong>
           <div class="chg-d-fields">
             <label class="chg-d-full">Nombre<input class="chg-d-name-in" type="text" maxlength="40" value="${esc(it.name)}"></label>
             <label class="chg-d-full">Tipo de producto<select class="chg-d-icon">${ICONS.map((i) => `<option value="${i.k}"${i.k === it.icon ? ' selected' : ''}>${esc(i.label)}</option>`).join('')}</select></label>
             <label>Se compra<select class="chg-d-mode"><option value="unit"${it.byKg ? '' : ' selected'}>Por unidad</option><option value="kg"${it.byKg ? ' selected' : ''}${KG_KEYS.includes(it.icon) ? '' : ' disabled'}>Por kilo</option></select></label>
             <label class="chg-d-qtywrap"${it.byKg ? ' hidden' : ''}>Cantidad<input class="chg-d-qty" type="number" min="1" max="99" value="${it.qty || 1}"></label>
             <label class="chg-d-wtwrap"${it.byKg ? '' : ' hidden'}>Peso comprado<div class="chg-weight"><input class="chg-d-wt" type="text" inputmode="decimal" value="${wt}" placeholder="Ej. 0,5"><select class="chg-d-unit"><option value="kg"${grams ? '' : ' selected'}>kg</option><option value="g"${grams ? ' selected' : ''}>g</option></select></div></label>
             <label class="chg-d-price-label">${it.byKg ? 'Precio por kg' : 'Precio por unidad'}<input class="chg-d-price" type="text" inputmode="decimal" value="${price}" placeholder="0,00"></label>
           </div>
           <div class="chg-d-btns"><button type="button" class="chg-d-cancel">Cancelar</button><button type="button" class="chg-d-save">Guardar</button></div>
         </div>`);
      line.remove();
    });
  }

  // Refleja en el historial de Changui (copia local) los cambios hechos desde Gastos del mes
  function syncPurchaseFromExpense(oldDesc, newDesc, date, detalle, amount) {
    const od = norm(oldDesc);
    const apply = (ignoreDate) => {
      let found = false;
      (state.purchases || []).forEach((p) => {
        if (!ignoreDate && date && p.date !== date) return;
        let hit = false;
        (p.expenses || []).forEach((x) => {
          if (!x || x.isDelivery || norm(x.description) !== od) return;
          x.description = newDesc;
          x.items = detalle.map((d) => Object.assign({}, d));
          x.amount = Number(amount);
          hit = true;
        });
        if (hit) {
          // la lista de productos de la compra se rearma con los productos actualizados
          p.items = (p.expenses || []).filter((x) => !x.isDelivery).flatMap((x) => x.items || []);
          found = true;
        }
      });
      return found;
    };
    if (apply(false) || apply(true)) save();
  }

  // Guarda el detalle en el gasto. El total se recalcula solo si todos los productos tienen precio.
  async function applyDetalle(box, exp, detalle, oldList, okMsg) {
    const b = bridge();
    if (!b.updateExpense) { toast('Falta actualizar app.js para poder editar.'); return false; }
    const month = box.dataset.month;

    const allPriced = detalle.every((x) => Number(x.paid) > 0);
    const amount = allPriced ? round2(detalle.reduce((s, x) => s + Number(x.paid || 0), 0)) : Number(exp.amount);

    // Si la descripción tenía la lista de productos, se actualiza con los nuevos nombres (el envío no figura en la descripción)
    const oldDesc = String(exp.description || '');
    let newDesc = oldDesc;
    const m = oldDesc.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const oldNames = oldList.filter((x) => !isDeliv(x)).map((x) => x.name);
    const newNames = detalle.filter((x) => !isDeliv(x)).map((x) => x.name);
    // Solo si el detalle ya estaba guardado: si venía del texto, el paréntesis puede ser el local (ej: Verdulería Roberto)
    if (m && newNames.length && Array.isArray(exp.detalle) && exp.detalle.length && norm(m[2]) === norm(oldNames.join(', '))) {
      newDesc = `${m[1].trim()} (${newNames.join(', ')})`;
    }

    const row = box.closest('tr');
    const oldKey = row ? row.dataset.key : '';
    const iso = oldKey.split('|')[0];
    const newKey = iso + '|' + norm(newDesc);
    const wasOpen = openKeys.has(oldKey);
    openKeys.delete(oldKey);
    if (wasOpen) openKeys.add(newKey);

    exp.description = newDesc;   // se guarda junto con el gasto
    let ok = false;
    try { ok = await b.updateExpense({ month, id: exp.id, amount, detalle }); } catch (err) { ok = false; }
    if (!ok) {
      exp.description = oldDesc;
      openKeys.delete(newKey);
      if (wasOpen) openKeys.add(oldKey);
      toast('No se pudo guardar el cambio.');
      return false;
    }
    syncPurchaseFromExpense(oldDesc, newDesc, exp.date, detalle, amount);
    toast(okMsg);
    return true;
  }

  async function saveItemEdit(btn) {
    const form = btn.closest('.chg-d-form');
    const box = btn.closest('.chg-detail');
    if (!form || !box) return;
    const exp = findExp(box.dataset.month, box.dataset.exp);
    const list = exp && currentList(exp);
    const idx = Number(form.dataset.idx);
    const old = list && list[idx];
    if (!old) return;

    const q = (s) => form.querySelector(s);
    const name = q('.chg-d-name-in').value.trim() || old.name;
    const iconSel = q('.chg-d-icon');
    const icon = iconSel ? iconSel.value : old.icon;
    const byKg = q('.chg-d-mode').value === 'kg' && KG_KEYS.includes(icon);
    const price = parseAmount(q('.chg-d-price').value);

    const nu = Object.assign({}, old, { name, icon, price, byKg });
    if (byKg) {
      const w = parseWeight(q('.chg-d-wt').value);
      const kg = toKg(w, q('.chg-d-unit').value);
      if (!(kg > 0)) { toast('Ingresá el peso comprado.'); return; }
      nu.kg = Math.round(kg * 1000) / 1000;
      nu.qty = 1;
      if (!nu.promo || nu.promo.type !== 'pct') nu.promo = { type: 'none' };
    } else {
      nu.qty = Math.min(99, Math.max(1, parseInt(q('.chg-d-qty').value, 10) || 1));
      nu.kg = 0;
    }

    // conserva el descuento general que tenía la compra
    const oldCalc = itemCalc(old).paid;
    const factor = oldCalc > 0 && Number(old.paid) > 0 ? Number(old.paid) / oldCalc : 1;
    nu.paid = round2(itemCalc(nu).paid * factor);

    const saved = await applyDetalle(box, exp, list.map((x, i) => (i === idx ? nu : x)), list, 'Listo, actualicé el producto.');
    if (saved) enhanceTable(true);   // se cierra el editor y se redibuja el detalle
  }

  async function deleteItem(btn) {
    const box = btn.closest('.chg-detail');
    const exp = box && findExp(box.dataset.month, box.dataset.exp);
    const list = exp && currentList(exp);
    const idx = Number(btn.dataset.idx);
    if (!list || !list[idx]) return;
    if (list.length <= 1) { toast('Es el único producto. Para borrar el gasto completo usá la {{x}} de la fila.'); return; }
    if (!confirm(`¿Quitar "${list[idx].name}" de este gasto?`)) return;
    const removed = await applyDetalle(box, exp, list.filter((_, i) => i !== idx), list, 'Producto quitado.');
    if (removed) enhanceTable(true);
  }

  document.addEventListener('click', (e) => {
    const tog = e.target.closest('#expenseTable .chg-tog');
    if (tog) {
      const tr = tog.closest('tr');
      const detail = tr && tr.nextElementSibling;
      if (!detail || !detail.classList.contains('chg-detail-row')) return;
      const open = detail.classList.toggle('open');
      tog.setAttribute('aria-expanded', String(open));
      if (open) openKeys.add(detail.dataset.key); else openKeys.delete(detail.dataset.key);
      return;
    }
    const ed = e.target.closest('#expenseTable .chg-d-edit');
    if (ed) { openItemEditor(ed); return; }
    const del = e.target.closest('#expenseTable .chg-d-del');
    if (del) { deleteItem(del); return; }
    if (e.target.closest('#expenseTable .chg-d-cancel')) { enhanceTable(true); return; }
    const sv = e.target.closest('#expenseTable .chg-d-save');
    if (sv) saveItemEdit(sv);
  });

  // Al cambiar el tipo de producto: "por kilo" solo para verduras, frutas, carne, etc.
  document.addEventListener('change', (e) => {
    const iconSel = e.target.closest && e.target.closest('#expenseTable .chg-d-icon');
    if (!iconSel) return;
    const form = iconSel.closest('.chg-d-form');
    const modeSel = form && form.querySelector('.chg-d-mode');
    if (!modeSel) return;
    const eligible = KG_KEYS.includes(iconSel.value);
    const kgOpt = modeSel.querySelector('option[value="kg"]');
    if (kgOpt) kgOpt.disabled = !eligible;
    const target = eligible ? 'kg' : 'unit';
    if (modeSel.value !== target) {
      modeSel.value = target;
      modeSel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  });

  document.addEventListener('change', (e) => {
    const sel = e.target.closest && e.target.closest('#expenseTable .chg-d-mode');
    if (!sel) return;
    const form = sel.closest('.chg-d-form');
    const kg = sel.value === 'kg';
    pauseObs(() => {
      form.querySelector('.chg-d-qtywrap').hidden = kg;
      form.querySelector('.chg-d-wtwrap').hidden = !kg;
      const lab = form.querySelector('.chg-d-price-label');
      const tn = [...lab.childNodes].find((n) => n.nodeType === 3);
      if (tn) tn.nodeValue = kg ? 'Precio por kg' : 'Precio por unidad';
    });
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.classList || !el.classList.contains('chg-d-price')) return;
    const start = el.selectionStart, prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
  });

  /* ---------- exportar PDF ---------- */
  function exportPDF(customPurchase = null) {
    const J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { toast('No se pudo cargar el generador de PDF.'); return; }

    const itemsToPrint = customPurchase ? customPurchase.items : state.items;
    if (!itemsToPrint || itemsToPrint.length === 0) { toast('No hay productos para exportar.'); return; }

    let theme;
    try { theme = bridge().getPdfTheme(); } catch (e) { theme = null; }
    if (!theme) theme = {
      pink: [234, 91, 142], dark: [82, 22, 42], light: [253, 232, 238], headerBg: [255, 174, 195],
      cardBorder: [246, 214, 223], lineDivider: [246, 214, 223], pageBg: null, footerColor: [125, 80, 98]
    };
    const isBlack = document.body.classList.contains('black-mode');

    const doc = new J({ unit: 'mm', format: 'a4' });

    // El descuento general se aplica al changuito activo
    // (en las compras guardadas, "paid" ya lo trae incluido)
    const genFactor = customPurchase ? 1 : (1 - state.general / 100);
    const paidOf = (it) => (customPurchase ? Number(it.paid || 0) : itemCalc(it).paid * genFactor);
    const unitsOf = (it) => (it.byKg ? (Number(it.kg) || 1) : (it.qty || 1));

    let totalARS = 0;
    let totalUSD = 0;
    itemsToPrint.forEach((it) => {
      const paid = paidOf(it);
      if ((it.cur || 'ARS') === 'USD') totalUSD += paid; else totalARS += paid;
    });

    // En las compras guardadas el envío ya puede venir como un renglón más: no se cuenta dos veces
    const delivery = customPurchase
      ? ((customPurchase.items || []).some(isDeliv) ? 0 : (customPurchase.deliveryMode === 'envio' ? Number(customPurchase.deliveryCost || 0) : 0))
      : getDeliveryCost();
    totalARS += delivery;

    const storeName = plain(customPurchase ? (customPurchase.store || '') : $('#chgStore')?.value || '');
    const dateStr = customPurchase ? fmtDay(customPurchase.date) : new Date().toLocaleDateString('es-AR');

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
    doc.text('Detalle del changuito - ' + dateStr + (storeName ? ' - ' + storeName : ''), 21, 31);

    const hasDelivItem = !!customPurchase && (customPurchase.items || []).some(isDeliv);
    const totalCardText = fmt(totalARS, 'ARS') + (totalUSD > 0 ? ' + ' + fmt(totalUSD, 'USD') : '');
    const cards = [
      ['TOTAL GASTADO', totalCardText],
      ['MODALIDAD', customPurchase ? ((customPurchase.deliveryMode === 'envio' || hasDelivItem) ? 'Envío a domicilio' : 'Presencial') : ($('#chgDeliveryMode')?.value === 'envio' ? 'Envío' : 'Presencial')],
      ['CANT. ÍTEMS', String(itemsToPrint.length + (delivery > 0 ? 1 : 0))]
    ];
    cards.forEach((card, i) => {
      const x = 15 + i * 60;
      doc.setDrawColor(...theme.cardBorder);
      doc.roundedRect(x, 49, 56, 25, 3, 3, 'S');
      doc.setTextColor(...theme.pink); doc.setFontSize(6.5); doc.setFont('helvetica', 'bold');
      doc.text(card[0], x + 4, 57);
      doc.setTextColor(...theme.dark); doc.setFontSize(8); doc.setFont('helvetica', 'normal');
      doc.text(card[1], x + 4, 65);
    });

    let y = 84;
    const tableHeader = () => {
      if (isBlack) doc.setFillColor(30, 30, 30); else doc.setFillColor(...theme.pink);
      doc.rect(15, y, 180, 8, 'F');
      doc.setTextColor(255, 255, 255); doc.setFontSize(7); doc.setFont('helvetica', 'bold');
      doc.text('PRODUCTO', 18, y + 5);
      doc.text('CANT.', 92, y + 5);
      doc.text('PRECIO / VALOR', 106, y + 5);
      doc.text('SUBTOTAL', 162, y + 5);
      y += 8;
      doc.setFont('helvetica', 'normal');
    };
    tableHeader();

    itemsToPrint.forEach((it) => {
      if (y > 255) { y = newPage(); tableHeader(); }
      const paid = paidOf(it);
      const cur = it.cur || 'ARS';
      doc.setTextColor(...theme.dark); doc.setFontSize(7);
      doc.text((plain(it.name) || 'Producto').slice(0, 40), 18, y + 5);

      const qtyDisplay = it.byKg ? kgLabel(it.kg) : String(it.qty || 1);
      doc.text(qtyDisplay, 92, y + 5);

      doc.text(fmt(paid / unitsOf(it), cur) + (it.byKg ? ' /kg' : ''), 106, y + 5);
      doc.text(fmt(paid, cur), 162, y + 5);
      doc.setDrawColor(...theme.lineDivider);
      doc.line(15, y + 8, 195, y + 8);
      y += 9;
    });

    if (delivery > 0) {
      if (y > 255) { y = newPage(); tableHeader(); }
      doc.setTextColor(...theme.dark); doc.setFontSize(7);
      doc.text('Envío a domicilio', 18, y + 5);
      doc.text('1', 92, y + 5);
      doc.text(fmt(delivery, 'ARS'), 106, y + 5);
      doc.text(fmt(delivery, 'ARS'), 162, y + 5);
      doc.setDrawColor(...theme.lineDivider);
      doc.line(15, y + 8, 195, y + 8);
      y += 9;
    }

    y += 10;
    if (y > 225) y = newPage();
    doc.setTextColor(...theme.dark); doc.setFontSize(10); doc.setFont('helvetica', 'bold');
    doc.text('RESUMEN GENERAL', 15, y);
    y += 6;

    const lines = [
      ['Total en pesos a pagar', fmt(totalARS, 'ARS')]
    ];
    if (totalUSD > 0) lines.push(['Total en dólares a pagar', fmt(totalUSD, 'USD')]);
    if (!customPurchase && state.general > 0) lines.push(['Descuento general aplicado', state.general + '%']);

    const boxH = 10 + lines.length * 6;
    doc.setFillColor(...theme.light); doc.setDrawColor(...theme.cardBorder);
    doc.roundedRect(15, y, 180, boxH, 3, 3, 'FD');
    lines.forEach((l, i) => {
      const yy = y + 8 + i * 6;
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8);
      doc.setTextColor(...theme.pink);
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
    doc.save('Changui-' + (customPurchase ? customPurchase.date : todayISO()) + '.pdf');
  }

  /* ---------- exportar CSV ---------- */
  function exportCSV(customPurchase = null) {
    const itemsToPrint = customPurchase ? customPurchase.items : state.items;
    if (!itemsToPrint || itemsToPrint.length === 0) { toast('No hay productos para exportar.'); return; }

    const storeName = customPurchase ? (customPurchase.store || 'General') : ($('#chgStore')?.value || 'General');
    const dateStr = customPurchase ? customPurchase.date : todayISO();

    let csv = 'Producto,Cantidad,Unidad,Moneda,Precio Subtotal\n';
    itemsToPrint.forEach(it => {
      const paid = customPurchase ? Number(it.paid || 0) : itemCalc(it).paid * (1 - state.general / 100);
      const name = `"${String(it.name || '').replace(/"/g, '""')}"`;
      const qty = it.byKg ? Number(it.kg || 0) : (it.qty || 1);
      const unit = it.byKg ? 'kg' : 'u';
      const cur = it.cur || 'ARS';
      csv += `${name},${qty},${unit},${cur},${paid.toFixed(2)}\n`;
    });

    const delivery = customPurchase
      ? ((customPurchase.items || []).some(isDeliv) ? 0 : (customPurchase.deliveryMode === 'envio' ? Number(customPurchase.deliveryCost || 0) : 0))
      : getDeliveryCost();
    if (delivery > 0) {
      csv += `"Envío a domicilio",1,u,ARS,${delivery.toFixed(2)}\n`;
    }

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Changui-${dateStr}-${String(storeName).replace(/[\\/:*?"<>|]/g, '')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast('Archivo CSV descargado con éxito.');
  }

  /* ---------- corrección de pesos cargados en gramos como kg (310 kg -> 310 g) ---------- */
  // Compras ya guardadas con el error de los mil (ej. "310 kg" que eran 310 g): se corrigen solas,
  // en el historial local y en el gasto de Gastos del mes (detalle + total). Es idempotente.
  const fixedKgIds = new Set();
  const badKg = (it) => !!it && !!it.byKg && Number(it.kg) >= 100;
  function fixKgItem(it) {
    const oldPaid = Number(it.paid) || 0;
    it.kg = Math.round((Number(it.kg) / 1000) * 1000) / 1000;
    it.paid = round2(oldPaid / 1000);
    return oldPaid - it.paid;   // cuánto se restó del total
  }
  function fixThousands() {
    let localChanged = false;
    (state.purchases || []).forEach((p) => {
      (p.items || []).forEach((it) => { if (badKg(it)) { fixKgItem(it); localChanged = true; } });
      (p.expenses || []).forEach((x) => {
        let d = 0;
        (x.items || []).forEach((it) => { if (badKg(it)) d += fixKgItem(it); });
        if (d) { x.amount = round2(Number(x.amount || 0) - d); localChanged = true; }
      });
    });

    const b = bridge();
    if (b.getMonthExpenses && b.updateExpense) {
      const months = new Set();
      if (b.getCurrentMonth) months.add(b.getCurrentMonth());
      (state.purchases || []).forEach((p) => { const m = p.expMonth || String(p.date || '').slice(0, 7); if (m) months.add(m); });
      months.forEach((month) => {
        if (!month) return;
        (b.getMonthExpenses(month) || []).forEach((exp) => {
          if (!exp || !Array.isArray(exp.detalle) || fixedKgIds.has(exp.id)) return;
          if (!exp.detalle.some(badKg)) return;
          let delta = 0;
          exp.detalle.forEach((it) => { if (badKg(it)) delta += fixKgItem(it); });
          exp.amount = round2(Number(exp.amount || 0) - delta);
          fixedKgIds.add(exp.id);
          Promise.resolve(b.updateExpense({ month, id: exp.id, amount: exp.amount, detalle: exp.detalle })).catch(() => { /* se reintenta en la próxima sesión */ });
        });
      });
    }
    if (localChanged) save();
  }

  /* ---------- unir el ENVÍO viejo (gasto aparte) con su compra ---------- */
  // Compras guardadas antes: "Changui (SANCOR)" 1.600 + "Envío a domicilio" 4.000 en dos filas.
  // Se unen solas en UN gasto (producto + envío = 5.600), con el envío como renglón del Detalle,
  // igual que las compras nuevas. Se une solo si hay una única compra de Changui en pesos
  // con la misma fecha y el mismo local; si hay dudas, no se toca nada.
  const failedDelivIds = new Set();
  let mergingDeliv = false;
  const storeOf = (desc) => {
    const d = String(desc || '').trim();
    let m = d.match(/^env[ií]o a domicilio\s+en\s+(.+)$/i);
    if (m) return norm(m[1]);
    m = d.match(/^changui\s+en\s+([^(]*?)\s*(?:\(|$)/i);
    return m ? norm(m[1]) : '';
  };

  async function mergeLegacyDelivery() {
    const b = bridge();
    if (mergingDeliv || registering) return;
    if (!b.getMonthExpenses || !b.updateExpense || !b.removeExpenses) return;
    mergingDeliv = true;
    let merged = false;
    try {
      const months = new Set();
      if (b.getCurrentMonth) months.add(b.getCurrentMonth());
      (state.purchases || []).forEach((p) => { const m = p.expMonth || String(p.date || '').slice(0, 7); if (m) months.add(m); });

      for (const month of months) {
        if (!month) continue;
        const list = b.getMonthExpenses(month) || [];
        const dels = list.filter((e) => e && e.id && isDeliveryExp(e) && !failedDelivIds.has(e.id)
          && (e.currency || 'ARS') === 'ARS' && Number(e.amount) > 0);

        for (const d of dels) {
          const cands = list.filter((e) => e && e.id && e.id !== d.id && !isDeliveryExp(e)
            && /^changui\b/i.test(String(e.description || '').trim())
            && (e.currency || 'ARS') === 'ARS'
            && e.date === d.date
            && storeOf(e.description) === storeOf(d.description)
            && Array.isArray(e.detalle) && e.detalle.length && !e.detalle.some(isDeliv));
          if (cands.length !== 1) continue;

          const main = cands[0];
          const oldAmount = Number(main.amount);
          const oldDetalle = main.detalle;
          const amt = round2(Number(d.amount));
          const delItem = {
            name: 'Envío a domicilio', icon: 'otros', cur: 'ARS',
            price: amt, qty: 1, byKg: false, kg: 0,
            promo: { type: 'none' }, paid: amt, isDelivery: true
          };
          const newDetalle = oldDetalle.concat([delItem]);
          const newAmount = round2(oldAmount + amt);

          let ok = false;
          try { ok = !!(await b.updateExpense({ month, id: main.id, amount: newAmount, detalle: newDetalle })); } catch (e) { ok = false; }
          if (!ok) { failedDelivIds.add(d.id); continue; }

          let removed = false;
          try { removed = !!(await b.removeExpenses({ month, ids: [d.id] })); } catch (e) { removed = false; }
          if (!removed) {
            // no se pudo sacar el envío suelto: se deja todo como estaba para no contarlo dos veces
            try { await b.updateExpense({ month, id: main.id, amount: oldAmount, detalle: oldDetalle }); } catch (e) { /* sigue */ }
            main.amount = oldAmount; main.detalle = oldDetalle;
            failedDelivIds.add(d.id);
            continue;
          }
          main.amount = newAmount;
          main.detalle = newDetalle;

          // la copia local del historial apunta ahora al gasto unido
          let changed = false;
          (state.purchases || []).forEach((p) => {
            if (!Array.isArray(p.expIds) || !p.expIds.includes(d.id)) return;
            p.expIds = p.expIds.filter((i) => i !== d.id);
            if (!p.expIds.includes(main.id)) p.expIds.push(main.id);
            changed = true;
          });
          if (loadedFrom && Array.isArray(loadedFrom.expIds) && loadedFrom.expIds.includes(d.id)) {
            loadedFrom.expIds = loadedFrom.expIds.filter((i) => i !== d.id);
            if (!loadedFrom.expIds.includes(main.id)) loadedFrom.expIds.push(main.id);
            changed = true;
          }
          if (changed) { try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ } }
          merged = true;
        }
      }
    } finally {
      mergingDeliv = false;
    }
    if (merged) {
      renderInsight();
      enhanceTable();
      toast('Uní el envío con su compra: ahora van juntos en una sola fila.');
    }
  }

  /* ---------- Historial de Changuitos ---------- */
  // Cambia el local en la descripción de un gasto de Changui o de su envío
  const retitle = (desc, store) => {
    const d = String(desc || '');
    const s = store ? ' en ' + store : '';
    const m = d.match(/^changui(?:\s+en\s+[^(]*?)?\s*(\([^()]*\))?\s*$/i);
    if (m) return `Changui${s}${m[1] ? ' ' + m[1] : ''}`;
    if (/^env[ií]o a domicilio/i.test(d)) return `Envío a domicilio${s}`;
    return d;
  };

  function renderHistoryModal() {
    const container = $('#chgHistoryListContainer');
    if (!container) return;
    fixThousands();
    mergeLegacyDelivery();
    dedupeLocal();

    const b = bridge();
    const currentMonth = (b.getCurrentMonth && b.getCurrentMonth()) || todayISO().slice(0, 7);
    const expsOf = (m) => (b.getMonthExpenses ? b.getMonthExpenses(m) || [] : []);
    const dkey = (d, date) => norm(d) + '|' + (date || '');
    const sumExps = (arr) => arr.reduce((t, e) => { t[e.currency === 'USD' ? 'USD' : 'ARS'] += Number(e.amount || 0); return t; }, { ARS: 0, USD: 0 });

    const unified = [];
    const claimed = new Set();   // ids de gastos que ya tienen su tarjeta
    const covered = new Set();   // respaldo para compras viejas: descripción + fecha
    let relinked = false;

    // 1. Compras guardadas en este dispositivo (se enlazan con su gasto real y se refrescan desde él)
    (state.purchases || []).forEach((p) => {
      if (!p.id) return;
      const month = p.expMonth || String(p.date || '').slice(0, 7);
      let ids = Array.isArray(p.expIds) ? p.expIds.slice() : [];

      // Compras viejas: se busca su gasto en el mes y se enlaza una sola vez
      if (!ids.length && !p.draft) {
        (p.expenses || []).forEach((x) => {
          const hit = expsOf(month).find((e) => !claimed.has(e.id) && !ids.includes(e.id) && e.date === p.date && norm(e.description) === norm(x.description));
          if (hit) ids.push(hit.id);
        });
        if (ids.length) { p.expIds = ids; p.expMonth = month; relinked = true; }
      }
      ids.forEach((i) => claimed.add(i));
      (p.expenses || []).forEach((x) => covered.add(dkey(x.description, p.date)));

      const copy = Object.assign({}, p, { source: 'local', liveIds: [], expMonth: month });
      if (ids.length) {
        const live = ids.map((id) => expsOf(month).find((e) => e.id === id)).filter(Boolean);
        if (!live.length) return;   // ya se borró en Gastos del mes: no se muestra
        copy.liveIds = live.map((e) => e.id);
        copy.liveTotal = sumExps(live);   // el TOTAL sale de los gastos reales
        const prods = live.filter((e) => Array.isArray(e.detalle) && e.detalle.length);
        if (prods.length) copy.items = prods.flatMap((e) => e.detalle.map((x) => normItem(x, e.currency || 'ARS')));
      }
      unified.push(copy);
    });
    if (relinked) { try { localStorage.setItem(userKey(), JSON.stringify(state)); } catch (e) { /* sin guardado */ } }

    // 2. Gastos de Changui del mes que no tengan ya su tarjeta
    expsOf(currentMonth).forEach((exp) => {
      if (!/^changui\b/i.test(String(exp.description || '').trim())) return;
      if (claimed.has(exp.id) || covered.has(dkey(exp.description, exp.date))) return;
      const cur = exp.currency || 'ARS';
      unified.push({
        id: exp.id || ('exp_' + exp.date + '_' + exp.amount),
        source: 'expense',
        date: exp.date || todayISO(),
        store: (String(exp.description).match(/^changui\s+en\s+(.*?)\s*(\(|$)/i) || [])[1] || '',
        deliveryMode: 'presencial',
        deliveryCost: 0,
        liveIds: exp.id ? [exp.id] : [],
        liveTotal: sumExps([exp]),
        expMonth: currentMonth,
        items: getDetail(exp.description, exp.date, exp).items.map((x) => normItem(x, cur))
      });
    });

    // Más nuevas primero
    unified.sort((a, c) => String(c.date).localeCompare(String(a.date)));

    // Esta es la lista que usan Ver / PDF / CSV
    historyCache = unified;

    if (unified.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">${ICO('cart')} Todavía no guardaste ningún changuito.</div>`;
      return;
    }

    const hint = '<p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 10px;">Para editar un producto, abrí el Detalle del gasto en Gastos del mes: el cambio se refleja acá.</p>';
    container.innerHTML = hint + unified.map((p) => {
      const isLocal = p.source === 'local';
      const storeName = p.store ? `Supermercado: <strong>${esc(p.store)}</strong>` : 'Compra general';
      const draftTag = p.draft ? ' <em style="font-size:0.72rem;color:var(--muted);">(sin registrar)</em>' : '';

      // Envío: puede venir como renglón dentro de la compra (nuevo) o como gasto aparte (compras viejas)
      const delItem = (p.items || []).find(isDeliv);
      const isEnvio = p.deliveryMode === 'envio' || !!delItem;
      const delCost = delItem ? Number(delItem.paid || 0) : Number(p.deliveryCost || 0);
      const deliveryText = isEnvio ? `${ICO('box')} Envío a domicilio (${money(delCost, 'ARS')})` : `${ICO('shopbag')} Presencial (Local)`;

      // TOTAL de este chango (productos + envío)
      let tot = p.liveTotal;
      if (!tot) {
        tot = { ARS: 0, USD: 0 };
        (p.items || []).forEach((it) => { tot[it.cur === 'USD' ? 'USD' : 'ARS'] += Number(it.paid || 0); });
        if (isEnvio && !delItem) tot.ARS += delCost;
      }
      const totalHtml = `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.92rem; padding: 10px 0 0; font-weight: 800; color: var(--pink-700);">
          <span>${ICO('receipt')} TOTAL</span>
          <b>${pairMoney(tot)}</b>
        </div>`;

     const promoExplain = (pr) => {
        if (!pr || pr.type === 'none') return '';
        if (pr.type === 'pct') return `${pr.value}% de descuento`;
        if (pr.type === '2x1') return '2x1 · pagás 1 de cada 2';
        if (pr.type === 'second') return `2da unidad al ${pr.value}% de descuento`;
        return '';
      };

      // Ahorros del chango: promos de cada producto y descuento general
      const savePromo = { ARS: 0, USD: 0 };
      const saveGen = { ARS: 0, USD: 0 };
      let genPct = 0;

      const itemsHtml = (p.items || []).map((it) => {
        const cur = it.cur === 'USD' ? 'USD' : 'ARS';
        const c = itemCalc(it);
        const paidN = Number(it.paid) || 0;
        const explain = promoExplain(it.promo);
        const hasPromo = !!explain && c.base > 0 && c.saved > 0.005;

        // Si pagó menos que el precio con promo, la diferencia es el descuento general
        const gSaved = !isDeliv(it) && paidN > 0 && c.paid > 0 ? c.paid - paidN : 0;
        if (gSaved > 0.01) {
          saveGen[cur] += gSaved;
          if (!genPct) genPct = Math.round((1 - paidN / c.paid) * 1000) / 10;
        }
        if (hasPromo) savePromo[cur] += c.saved;

        const promoLine = hasPromo
          ? `<div style="font-size:0.7rem;color:var(--pink-700);font-weight:700;margin-top:1px;">${ICO('tag')} ${esc(explain)} · ahorraste ${money(c.saved, cur)}</div>`
          : '';
        const old = (hasPromo || gSaved > 0.01) && c.base > paidN + 0.005
          ? `<s style="font-size:0.72rem;opacity:.6;font-weight:600;">${money(c.base, cur)}</s>`
          : '';
        return `
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 8px; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line);">
          <span>${emoji(it)} ${esc(it.name)} (${esc(qtyText(it))})${promoLine}</span>
          <div style="display: flex; align-items: center; gap: 6px; flex-shrink: 0;">
            ${old}
            <b>${paidN > 0 ? money(it.paid, it.cur) : '—'}</b>
          </div>
        </div>`;
      }).join('');

      const hasGen = saveGen.ARS > 0.01 || saveGen.USD > 0.01;
      const hasPromoAny = savePromo.ARS > 0.005 || savePromo.USD > 0.005;
      const sumLine = (txt, v) => `<div style="font-size:0.76rem;color:var(--pink-700);font-weight:700;display:flex;justify-content:space-between;gap:8px;"><span>${txt}</span><span>${pairMoney(v)}</span></div>`;
      const savingsHtml = (hasGen || hasPromoAny) ? `
        <div style="margin-top:8px;padding:8px 10px;border-radius:12px;border:1px dashed var(--chg-line);display:grid;gap:3px;">
          ${hasPromoAny ? sumLine(`${ICO('tag')} Ahorro por promos`, savePromo) : ''}
          ${hasGen ? sumLine(`${ICO('ticket')} ${p.genName ? esc(p.genName) + ' · ' : 'Descuento general '}${String(genPct).replace('.', ',')}%`, saveGen) : ''}
        </div>` : '';

      const deliveryHtml = isEnvio && !delItem && delCost > 0 ? `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line); color: var(--pink-700);">
          <span>${ICO('box')} Costo de envío</span>
          <b>${money(delCost, 'ARS')}</b>
        </div>
      ` : '';

      return `
        <div class="chg-history-card" data-purchase-id="${esc(p.id)}" style="border: 1px solid var(--chg-line); border-radius: 16px; padding: 14px; background: var(--bg, transparent); margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.85rem;">
            <span>${ICO('calendar')} ${fmtDay(p.date)} · ${storeName}${draftTag}</span>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="pastel-btn btn-sm" type="button" data-load-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="Cargar este changuito en la pantalla">${ICO('folder')} Ver</button>
              <button class="pastel-btn btn-sm" type="button" data-pdf-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="PDF">${ICO('pdf')} PDF</button>
              <button class="pastel-btn btn-sm" type="button" data-csv-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="CSV">${ICO('chart')} CSV</button>
              ${isLocal ? `<button class="chg-ico-btn" type="button" data-edit-purchase="${esc(p.id)}" title="Editar">${ICO('pencil')}</button>
              <button class="chg-ico-btn" type="button" data-del-purchase="${esc(p.id)}" title="Eliminar">${ICO('trash')}</button>` : ''}
            </div>
          </div>
          <div style="font-size: 0.78rem; color: var(--muted); margin-bottom: 6px;">
            ${ICO('pin')} Modalidad: <strong>${deliveryText}</strong>
          </div>
          <div style="display: grid; gap: 4px; margin-top: 6px;">
            ${itemsHtml || '<span style="font-size:0.8rem;color:var(--muted);">Sin detalle de productos.</span>'}
            ${deliveryHtml}
          </div>
          ${savingsHtml}
          ${totalHtml}    
        </div>
      `;
    }).join('');
  }

  // Guarda local y fecha de un changuito del historial, también en sus gastos reales
  async function savePurchaseMeta(purchase, store, date) {
    const b = bridge();
    const hp = findPurchase(purchase.id);
    const ids = hp && hp.liveIds ? hp.liveIds : [];
    const month = hp ? hp.expMonth : '';
    if (ids.length && month && b.updateExpense && b.getMonthExpenses) {
      const list = b.getMonthExpenses(month) || [];
      for (const id of ids) {
        const exp = list.find((x) => x.id === id);
        if (!exp) continue;
        exp.date = date;
        exp.description = retitle(exp.description, store);
        try { await b.updateExpense({ month, id, amount: exp.amount, detalle: exp.detalle }); } catch (err) { /* sigue */ }
      }
    }
    purchase.store = store;
    purchase.date = date;
    (purchase.expenses || []).forEach((x) => { x.description = retitle(x.description, store); });
    save();
    renderHistoryModal();
    renderInsight();
    toast('Changuito actualizado.');
  }

  // Convierte una compra del historial en items del changuito activo
  function loadPurchaseIntoCart(purchaseIn) {
    // El envío que viaja como renglón dentro de la compra vuelve al campo "Envío a domicilio" del formulario
    const delIt = (purchaseIn.items || []).find(isDeliv);
    const purchase = Object.assign({}, purchaseIn, {
      items: (purchaseIn.items || []).filter((x) => !isDeliv(x)),
      deliveryMode: delIt ? 'envio' : purchaseIn.deliveryMode,
      deliveryCost: delIt ? Number(delIt.paid || 0) : purchaseIn.deliveryCost
    });

    const items = (purchase.items || []).map((it) => ({
      id: uid(),
      icon: it.icon || 'otros',
      name: it.name || 'Producto',
      price: Number(it.price || it.paid || 0),
      qty: Number(it.qty || 1),
      byKg: !!it.byKg,
      kg: Number(it.kg || 0),
      cur: it.cur === 'USD' ? 'USD' : 'ARS',
      promo: it.promo || { type: 'none' }
    }));

    // "paid" ya traía el descuento general incluido: lo recuperamos para no inflar el total
    let general = 0;
    let sumPaid = 0, sumCalc = 0, allPriced = true;
    items.forEach((it, i) => {
      const paid = Number((purchase.items[i] || {}).paid || 0);
      const calc = itemCalc(it).paid;
      if (!(paid > 0) || !(calc > 0)) { allPriced = false; return; }
      sumPaid += paid; sumCalc += calc;
    });
    if (allPriced && sumCalc > 0 && sumPaid < sumCalc - 0.01) {
      general = Math.min(100, Math.max(0, round2((1 - sumPaid / sumCalc) * 100)));
    }

    editingId = null;
    resetForm();
    state.items = items;
    state.general = general;
    state.genName = purchase.genName || '';

    if ($('#chgStore')) $('#chgStore').value = purchase.store || '';
    if ($('#chgDeliveryMode')) $('#chgDeliveryMode').value = purchase.deliveryMode || 'presencial';
    if ($('#chgDeliveryCostWrap')) $('#chgDeliveryCostWrap').hidden = purchase.deliveryMode !== 'envio';
    if ($('#chgDeliveryCost')) $('#chgDeliveryCost').value = purchase.deliveryCost ? formatAmountInput(String(purchase.deliveryCost).replace('.', ',')) : '';
    if ($('#chgDate')) $('#chgDate').value = purchase.date || todayISO();

    const month = purchase.expMonth || String(purchase.date || '').slice(0, 7);
    let expIds = Array.isArray(purchase.liveIds) ? purchase.liveIds.slice() : [];

    // Si la compra no quedó enlazada a su gasto, se lo busca en el mes (misma fecha y descripción)
    // para poder reemplazarlo al guardar en vez de duplicarlo
    if (!expIds.length && !purchase.draft && Array.isArray(purchase.expenses) && bridge().getMonthExpenses) {
      const monthList = bridge().getMonthExpenses(month) || [];
      purchase.expenses.forEach((x) => {
        const hit = monthList.find((e) => !expIds.includes(e.id) && e.date === purchase.date && norm(e.description) === norm(x.description));
        if (hit) expIds.push(hit.id);
      });
      // Si no coincide la descripción, se prueba por fecha + mismos productos (por si se editó el gasto)
      if (!expIds.length) {
        const names = (purchase.items || []).map((i) => norm(i.name)).sort().join('|');
        const hit = monthList.find((e) => e.date === purchase.date && Array.isArray(e.detalle) && e.detalle.length
          && e.detalle.filter((i) => !isDeliv(i)).map((i) => norm(i.name)).sort().join('|') === names);
        if (hit) expIds.push(hit.id);
      }
    }

    // Se recuerda de dónde vino para actualizar esa compra en vez de duplicarla
    setLoaded({
      id: purchase.id,
      draft: !!purchase.draft,
      expIds,
      month,
      date: purchase.date || todayISO()
    });

    save();
    render();
  }


  /* ---------- vista previa del precio con descuento (antes de agregar) ---------- */
  function setupPricePreview() {
    const btn = $('#chgSubmit');
    if (!btn || $('#chgPricePreview')) return;
    btn.insertAdjacentHTML('beforebegin', '<div id="chgPricePreview" class="chg-kgprev" hidden></div>');
  }

  function updatePricePreview() {
    const box = $('#chgPricePreview');
    if (!box) return;
    const hide = () => { box.hidden = true; box.innerHTML = ''; };

    const price = parseAmount($('#chgPrice').value);
    if (!(price > 0)) { hide(); return; }

    const byKg = kgMode && KG_KEYS.includes(selIcon);
    const kg = byKg ? currentKg() : 0;
    if (byKg && !(kg > 0)) { hide(); return; }

    const it = {
      price,
      qty: byKg ? 1 : Math.min(99, Math.max(1, parseInt($('#chgQty').value, 10) || 1)),
      byKg, kg,
      cur: $('#chgCur').value === 'USD' ? 'USD' : 'ARS',
      promo: promoFromForm()
    };
    const c = itemCalc(it);

    if (c.saved > 0.005) {
      box.innerHTML = `${ICO('tag')} <s class="chg-old">${money(c.base, it.cur)}</s> → <b>${money(c.paid, it.cur)}</b> · ahorrás ${money(c.saved, it.cur)}`;
    } else if (!byKg && it.qty > 1) {
      box.innerHTML = `Total: <b>${money(c.paid, it.cur)}</b>`;
    } else { hide(); return; }
    box.hidden = false;
  }

  /* ---------- descuentos generales con nombre (bancos y billeteras) ---------- */
  const GEN_DISCOUNTS = [
    // Cuenta DNI
    { name: 'Cuenta DNI 10%', pct: 10 },
    { name: 'Cuenta DNI 20%', pct: 20 },
    { name: 'Cuenta DNI 30%', pct: 30 },
    { name: 'Cuenta DNI 40%', pct: 40 },
    { name: 'Cuenta DNI 50%', pct: 50 },

    // Billeteras virtuales
    { name: 'Mercado Pago 10%', pct: 10 },
    { name: 'Mercado Pago 15%', pct: 15 },
    { name: 'Mercado Pago 20%', pct: 20 },
    { name: 'Mercado Pago 30%', pct: 30 },
    { name: 'Ualá 10%', pct: 10 },
    { name: 'Ualá 15%', pct: 15 },
    { name: 'Ualá 20%', pct: 20 },
    { name: 'Ualá 30%', pct: 30 },
    { name: 'Brubank 10%', pct: 10 },
    { name: 'Brubank 15%', pct: 15 },
    { name: 'Brubank 20%', pct: 20 },
    { name: 'Brubank 30%', pct: 30 },
    { name: 'Personal Pay 15%', pct: 15 },
    { name: 'Personal Pay 20%', pct: 20 },
    { name: 'Personal Pay 25%', pct: 25 },
    { name: 'Personal Pay 30%', pct: 30 },
    { name: 'Naranja X 15%', pct: 15 },
    { name: 'Naranja X 20%', pct: 20 },
    { name: 'Naranja X 30%', pct: 30 },
    { name: 'MODO 10%', pct: 10 },
    { name: 'MODO 20%', pct: 20 },
    { name: 'MODO 30%', pct: 30 },
    { name: 'MODO 40%', pct: 40 },
    { name: 'MODO 50%', pct: 50 },

    // Banco Nación
    { name: 'Banco Nación 10%', pct: 10 },
    { name: 'Banco Nación 20%', pct: 20 },
    { name: 'Banco Nación 30%', pct: 30 },
    { name: 'Banco Nación 40%', pct: 40 },
    { name: 'Banco Nación 50%', pct: 50 },

    // Banco Provincia
    { name: 'Banco Provincia 10%', pct: 10 },
    { name: 'Banco Provincia 20%', pct: 20 },
    { name: 'Banco Provincia 30%', pct: 30 },
    { name: 'Banco Provincia 40%', pct: 40 },
    { name: 'Banco Provincia 50%', pct: 50 },

    // Banco Ciudad
    { name: 'Banco Ciudad 10%', pct: 10 },
    { name: 'Banco Ciudad 20%', pct: 20 },
    { name: 'Banco Ciudad 30%', pct: 30 },
    { name: 'Banco Ciudad 40%', pct: 40 },
    { name: 'Banco Ciudad 50%', pct: 50 },

    // Banco Galicia
    { name: 'Banco Galicia 10%', pct: 10 },
    { name: 'Banco Galicia 20%', pct: 20 },
    { name: 'Banco Galicia 30%', pct: 30 },
    { name: 'Banco Galicia 40%', pct: 40 },
    { name: 'Banco Galicia 50%', pct: 50 },

    // Santander
    { name: 'Santander 10%', pct: 10 },
    { name: 'Santander 20%', pct: 20 },
    { name: 'Santander 30%', pct: 30 },
    { name: 'Santander 40%', pct: 40 },
    { name: 'Santander 50%', pct: 50 },

    // BBVA
    { name: 'BBVA 10%', pct: 10 },
    { name: 'BBVA 20%', pct: 20 },
    { name: 'BBVA 30%', pct: 30 },
    { name: 'BBVA 40%', pct: 40 },
    { name: 'BBVA 50%', pct: 50 },

    // Macro
    { name: 'Macro 10%', pct: 10 },
    { name: 'Macro 20%', pct: 20 },
    { name: 'Macro 30%', pct: 30 },
    { name: 'Macro 40%', pct: 40 },
    { name: 'Macro 50%', pct: 50 },

    // ICBC
    { name: 'ICBC 10%', pct: 10 },
    { name: 'ICBC 20%', pct: 20 },
    { name: 'ICBC 30%', pct: 30 },
    { name: 'ICBC 40%', pct: 40 },
    { name: 'ICBC 50%', pct: 50 },

    // Supervielle
    { name: 'Supervielle 10%', pct: 10 },
    { name: 'Supervielle 20%', pct: 20 },
    { name: 'Supervielle 30%', pct: 30 },
    { name: 'Supervielle 40%', pct: 40 },
    { name: 'Supervielle 50%', pct: 50 },

    // Supermercados y Clubes
    { name: 'Tarjeta de supermercado 10%', pct: 10 },
    { name: 'Tarjeta de supermercado 15%', pct: 15 },
    { name: 'Tarjeta de supermercado 20%', pct: 20 },
    { name: 'Club La Nación 20%', pct: 20 },
    { name: 'Clarín 365 20%', pct: 20 }
  ];

  function setupGenName() {
    const chip = root.querySelector('[data-gen]');
    if (!chip || $('#chgGenName')) return;
    chip.parentElement.insertAdjacentHTML('afterend',
      `<label class="chg-field" id="chgGenNameWrap">Con qué descuento (opcional)
         <select id="chgGenName">
           <option value="">Sin nombre</option>
           ${GEN_DISCOUNTS.map((d, i) => `<option value="${i}">${esc(d.name)} · ${d.pct}%</option>`).join('')}
           <option value="custom">Otro (escribir nombre)</option>
         </select>
       </label>`);

    $('#chgGenName').addEventListener('change', (e) => {
      const v = e.target.value;
      if (v === 'custom') {
        const n = prompt('¿Con qué descuento? (ej. Tarjeta Carrefour)', state.genName || '');
        if (n === null) { syncGenSelect(); return; }
        state.genName = n.trim().replace(/[()]/g, '').slice(0, 30);
      } else if (v === '') {
        state.genName = '';
      } else {
        const d = GEN_DISCOUNTS[Number(v)];
        state.genName = d.name;
        if (!state.general) state.general = d.pct;   // solo carga el % si todavía no pusiste uno
      }
      save(); renderCart(); renderTotals();
    });
  }

  function syncGenSelect() {
    const s = $('#chgGenName');
    if (!s) return;
    const i = GEN_DISCOUNTS.findIndex((d) => d.name === state.genName);
    if (!state.genName) { s.value = ''; return; }
    if (i >= 0) { s.value = String(i); return; }
    const opt = s.querySelector('option[value="custom"]');
    if (opt) opt.textContent = state.genName;
    s.value = 'custom';
  }
   
  /* ---------- eventos ---------- */
  $('#chgForm').addEventListener('submit', submitItem);
  $('#chgCancelEdit').addEventListener('click', resetForm);
  $('#chgPdfBtn').addEventListener('click', () => exportPDF(null));

  $('#chgCsvBtn')?.addEventListener('click', () => exportCSV(null));
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
    state.items = []; state.general = 0; state.genName = ''; setLoaded(null); save(); resetForm(); render();
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
    updateKgPreview();
  });
   
  $('#chgCur').addEventListener('change', updateKgPreview);
['input', 'change', 'click', 'submit'].forEach((ev) =>
$('#chgForm').addEventListener(ev, () => setTimeout(updatePricePreview, 0))
  );
   
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
    const insTog = e.target.closest('.chg-ins-tog');
    if (insTog) {
      insightOpen = !insightOpen;
      insTog.setAttribute('aria-expanded', String(insightOpen));
      const body = insTog.nextElementSibling;
      if (body) body.hidden = !insightOpen;
      return;
    }

    const chip = e.target.closest('[data-icon]');
    if (chip) {
      const changed = selIcon !== chip.dataset.icon;
      selIcon = chip.dataset.icon;
      if (changed) kgMode = KG_KEYS.includes(selIcon);   // verduras, frutas, etc. arrancan por kilo
      renderIcons();
      applyKgUI();
      return;
    }

    const modeBtn = e.target.closest('[data-kgmode]');
    if (modeBtn) {
      kgMode = modeBtn.dataset.kgmode === 'kg';
      applyKgUI();
      return;
    }

    const wchip = e.target.closest('[data-wv]');
    if (wchip) {
      $('#chgWeight').value = wchip.dataset.wv;
      $('#chgWeightUnit').value = wchip.dataset.wu;
      updateKgPreview();
      return;
    }

    const gen = e.target.closest('[data-gen]');
    if (gen) {
      const v = Number(gen.dataset.gen);
      state.general = state.general === v ? 0 : v;
      save(); renderCart(); renderTotals();
      return;
    }

    /* ----- Historial: abrir / cerrar ----- */
    if (e.target.closest('#chgHistoryModalBtn')) {
      renderHistoryModal();
      $('#chgHistoryDialog')?.showModal();
      return;
    }
    if (e.target.closest('#chgCloseHistoryBtn')) {
      $('#chgHistoryDialog')?.close();
      return;
    }
    // Click en el fondo del dialog (fuera de la tarjeta) lo cierra
    if (e.target.id === 'chgHistoryDialog') {
      $('#chgHistoryDialog').close();
      return;
    }

    /* ----- Historial: Ver (cargar en pantalla) ----- */
    const loadBtn = e.target.closest('[data-load-purchase]');
    if (loadBtn) {
      const purchase = findPurchase(loadBtn.dataset.loadPurchase);
      if (!purchase) { toast('No se encontró ese changuito.'); return; }
      if (!purchase.items || !purchase.items.length) { toast('Ese changuito no tiene productos guardados.'); return; }
      if (state.items.length && !confirm('Ya tenés productos en el changuito actual. ¿Reemplazarlos por este?')) return;
      loadPurchaseIntoCart(purchase);
      $('#chgHistoryDialog')?.close();
      const body = $('#chgBody');
      if (body && body.hidden) {
        body.hidden = false;
        const tbtn = $('#chgToggleBtn');
        if (tbtn) tbtn.textContent = '▲ Ocultar Changui';
      }
      $('#chgList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Changuito cargado en pantalla con éxito. {{cart}}');
      return;
    }

    /* ----- Historial: PDF ----- */
    const pdfBtn = e.target.closest('[data-pdf-purchase]');
    if (pdfBtn) {
      const purchase = findPurchase(pdfBtn.dataset.pdfPurchase);
      if (purchase) exportPDF(purchase); else toast('No se encontró ese changuito.');
      return;
    }

    /* ----- Historial: CSV ----- */
    const csvBtn = e.target.closest('[data-csv-purchase]');
    if (csvBtn) {
      const purchase = findPurchase(csvBtn.dataset.csvPurchase);
      if (purchase) exportCSV(purchase); else toast('No se encontró ese changuito.');
      return;
    }

    /* ----- Historial: eliminar ----- */
    const delBtn = e.target.closest('[data-del-purchase]');
    if (delBtn) {
      const id = delBtn.dataset.delPurchase;
      const hp = findPurchase(id);
      const linked = hp && hp.liveIds && hp.liveIds.length && bridge().removeExpenses ? hp : null;
      const msg = linked
        ? '¿Eliminar este changuito? También se borra de Gastos del mes.'
        : '¿Eliminar este registro del historial? El gasto ya cargado en Mensuales no se borra.';
      if (confirm(msg)) {
        (async () => {
          if (linked) { try { await bridge().removeExpenses({ month: linked.expMonth, ids: linked.liveIds }); } catch (err) { /* sigue */ } }
          state.purchases = state.purchases.filter((p) => p.id !== id);
          save();
          renderHistoryModal();
          renderInsight();
          toast(linked ? 'Changuito eliminado del historial y de tus gastos.' : 'Eliminado del historial. El gasto en Mensuales sigue ahí.');
        })();
      }
      return;
    }

    /* ----- Historial: editar tienda / fecha ----- */
    const editBtn = e.target.closest('[data-edit-purchase]');
    if (editBtn) {
      const id = editBtn.dataset.editPurchase;
      const purchase = findLocalPurchase(id);
      if (!purchase) return;
      const card = editBtn.closest('.chg-history-card');
      if (!card) return;

      card.innerHTML = `
        <div style="display: grid; gap: 8px; font-size: 0.85rem;">
          <strong>${ICO('pencil')} Editando datos del changuito</strong>
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
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-edit-purchase]');
    if (cancelBtn) { renderHistoryModal(); return; }

    const saveBtn = e.target.closest('[data-save-purchase]');
    if (saveBtn) {
      const id = saveBtn.dataset.savePurchase;
      const purchase = findLocalPurchase(id);
      if (purchase) {
        const newStore = (document.getElementById(`editStore_${id}`)?.value || '').trim().replace(/[()]/g, '').slice(0, 30);
        const newDate = document.getElementById(`editDate_${id}`)?.value || todayISO();
        savePurchaseMeta(purchase, newStore, newDate);
      }
      return;
    }

    /* ----- Historial: editar un producto (solo compras locales) ----- */
    const editItemBtn = e.target.closest('[data-edit-item-purchase]');
    if (editItemBtn) {
      const pId = editItemBtn.dataset.editItemPurchase;
      const itemIdx = Number(editItemBtn.dataset.itemIdx);
      const purchase = findLocalPurchase(pId);
      if (!purchase || !purchase.items[itemIdx]) return;

      const item = purchase.items[itemIdx];
      const card = editItemBtn.closest('.chg-history-card');
      if (!card) return;

      const qtyField = item.byKg
        ? `<label style="display: grid; gap: 2px; font-size: 0.75rem;">Peso (kg):
              <input type="text" inputmode="decimal" id="editItemQty_${pId}_${itemIdx}" value="${String(item.kg || 0).replace('.', ',')}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
            </label>`
        : `<label style="display: grid; gap: 2px; font-size: 0.75rem;">Cantidad:
              <input type="number" min="1" id="editItemQty_${pId}_${itemIdx}" value="${item.qty || 1}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
            </label>`;

      card.innerHTML = `
        <div style="display: grid; gap: 8px; font-size: 0.85rem;">
          <strong>${ICO('pencil')} Editando producto: ${esc(item.name)}</strong>
          <label style="display: grid; gap: 2px; font-size: 0.75rem;">Nombre del producto:
            <input type="text" id="editItemName_${pId}_${itemIdx}" value="${esc(item.name || '')}" style="padding: 6px; border-radius: 8px; border: 1px solid var(--chg-line); background: transparent; color: inherit;">
          </label>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            ${qtyField}
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
      return;
    }

    const saveItemBtn = e.target.closest('[data-save-item-purchase]');
    if (saveItemBtn) {
      const pId = saveItemBtn.dataset.saveItemPurchase;
      const itemIdx = Number(saveItemBtn.dataset.itemIdx);
      const purchase = findLocalPurchase(pId);
      if (purchase && purchase.items[itemIdx]) {
        const item = purchase.items[itemIdx];
        const newName = document.getElementById(`editItemName_${pId}_${itemIdx}`)?.value.trim();
        const qtyRaw = document.getElementById(`editItemQty_${pId}_${itemIdx}`)?.value;
        const newPaid = parseAmount(document.getElementById(`editItemPaid_${pId}_${itemIdx}`)?.value);

        if (newName) item.name = newName;
        if (item.byKg) {
          const kg = parseWeight(qtyRaw);
          if (kg > 0) item.kg = Math.round(kg * 1000) / 1000;
        } else {
          item.qty = parseInt(qtyRaw, 10) || 1;
        }
        item.paid = round2(newPaid);

        save();
        renderHistoryModal();
        renderInsight();
        toast('Producto actualizado en el historial.');
      }
      return;
    }

    /* ----- Items del changuito activo ----- */
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
  const refresh = () => { clearTimeout(timer); timer = setTimeout(() => { fixThousands(); mergeLegacyDelivery(); renderTotals(); renderInsight(); }, 250); };
  const watch = (id, cb) => {
    const el = document.getElementById(id);
    if (el) new MutationObserver(cb).observe(el, { childList: true, subtree: true, characterData: true });
  };
  watch('expenseTable', refresh);
  watch('dolarBadge', refresh);
  watch('userEmail', () => { load(); render(); enhanceTable(); });
  document.getElementById('monthPicker')?.addEventListener('change', refresh);
  window.addEventListener('changui:refresh', refresh);

  // Efecto hover de los botones de la solapa "¿Qué se compró?": luz abajo + zoom chiquito
  (function injectDetailFx() {
    if (document.getElementById('chgDetailFx')) return;
    const st = document.createElement('style');
    st.id = 'chgDetailFx';
    st.textContent = `
      /* Color de la luz según el tema: claro (rosa), oscuro (rosa suave), azul (celeste), black (blanco) */
      body{--chg-fx:234,91,142;--chg-fa:.35}
      body.dark-mode{--chg-fx:255,120,160;--chg-fa:.40}
      body.dark-blue-mode{--chg-fx:56,189,248;--chg-fa:.40}
      body.black-mode{--chg-fx:255,255,255;--chg-fa:.28}
      .chg-tog,.chg-d-edit,.chg-d-del,.chg-d-save,.chg-d-cancel{cursor:pointer;transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease}
      .chg-tog:hover,.chg-d-save:hover,.chg-d-cancel:hover{transform:translateY(-1px) scale(1.05);border-color:rgba(var(--chg-fx),.85);box-shadow:0 6px 14px rgba(var(--chg-fx),var(--chg-fa))}
      .chg-d-edit:hover,.chg-d-del:hover{transform:scale(1.18);box-shadow:0 4px 10px rgba(var(--chg-fx),var(--chg-fa))}
      .chg-tog:active,.chg-d-edit:active,.chg-d-del:active,.chg-d-save:active,.chg-d-cancel:active{transform:scale(.96);box-shadow:none}

      /* Solapa "Resumen del mes" */
      #chgInsight{display:block}
      .chg-ins-tog{display:flex;align-items:center;justify-content:space-between;gap:10px;width:100%;box-sizing:border-box;padding:10px 14px;border-radius:14px;border:1px solid var(--chg-line,rgba(234,91,142,.3));background:transparent;color:var(--pink-700,inherit);font:inherit;font-weight:800;font-size:.9rem;cursor:pointer;text-align:left;transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease}
      .chg-ins-tog:hover{border-color:rgba(var(--chg-fx),.85);box-shadow:0 6px 14px rgba(var(--chg-fx),var(--chg-fa))}
      .chg-ins-arrow{display:inline-block;transition:transform .2s ease}
      .chg-ins-tog[aria-expanded="true"] .chg-ins-arrow{transform:rotate(90deg)}
      .chg-ins-body{display:grid;gap:8px;margin-top:8px}
      .chg-ins-body[hidden]{display:none}
      .chg-ins-body .chg-pill{display:block;box-sizing:border-box;max-width:100%;border-radius:14px;line-height:1.4;overflow-wrap:anywhere}
      .chg-ins-tog span:first-child{min-width:0;overflow-wrap:anywhere}
      @media (max-width:480px){.chg-ins-tog{padding:9px 12px;font-size:.85rem}.chg-ins-body .chg-pill{font-size:.85rem}}
    `;
    document.head.appendChild(st);
  })();

  /* ---------- ganchos para pasar-a-changui.js ---------- */
  window.__changuiEnhance = enhanceTable;
  window.__changuiRefresh = () => { renderInsight(); enhanceTable(); };
  // Cuando un gasto deja de ser de Changui (o se borra), se saca de las compras guardadas
  window.__changuiForget = (expId, desc, date) => {
    let changed = false;
    state.purchases = (state.purchases || []).filter((p) => {
      if (expId && Array.isArray(p.expIds) && p.expIds.includes(expId)) {
        p.expIds = p.expIds.filter((i) => i !== expId);
        changed = true;
        return p.expIds.length > 0;
      }
      if (!(Array.isArray(p.expIds) && p.expIds.length) && desc && (!date || p.date === date)
          && (p.expenses || []).some((x) => x && norm(x.description) === norm(desc))) {
        changed = true;
        return false;
      }
      return true;
    });
    if (changed) save();
  };

  setupKgUI();
  setupPricePreview();
  setupGenName();
  load();
  renderIcons();
  applyKgUI();
  render();
  enhanceTable();

  // Los gastos del mes llegan un instante después de abrir la app: se reintenta hasta que estén
  let tries = 0;
  const poll = setInterval(() => {
    tries++;
    if (bridge().getMonthExpenses || tries > 40) { clearInterval(poll); fixThousands(); mergeLegacyDelivery(); renderInsight(); enhanceTable(); }
  }, 500);
})();
