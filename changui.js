/* =========================================================
   CHANGUI: CALCULÁ TU COMPRA · módulo de Mensuales
   Creado by Flor Bagnis 💗
   + Compra por kilo (verduras, frutas, queso y fiambres, carne, pollo, pescado)
   + Solapa "¿Qué se compró?" en Gastos del mes
   + Historial corregido: botones Ver / PDF / CSV funcionan con todas las tarjetas
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

  /* ---------- ÍCONOS RESTAURADOS Y COMPLETOS ---------- */
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
    { k: 'bebes', e: '🍼', label: 'Bebés y niños', cat: 'Hogar' },
    { k: 'electro', e: '🔌', label: 'Electro', cat: 'Hogar' },
    { k: 'tecnologia', e: '💻', label: 'Tecnología', cat: 'Hogar' },
    { k: 'ferreteria', e: '🔨', label: 'Ferretería y arreglos', cat: 'Hogar' },
    { k: 'zapatillas', e: '👟', label: 'Calzado e indumentaria', cat: 'Personal' },
    { k: 'farmacia', e: '💊', label: 'Farmacia y salud', cat: 'Salud' },
    { k: 'regalos', e: '🎁', label: 'Regalos', cat: 'Varios' },
    { k: 'libreria', e: '📚', label: 'Librería y oficina', cat: 'Varios' },
    { k: 'jardin', e: '🌸', label: 'Jardín y plantas', cat: 'Hogar' },
    { k: 'decoracion', e: '🛋️', label: 'Decoración y hogar', cat: 'Hogar' },
    { k: 'vehiculo', e: '🚗', label: 'Vehículo / Auto', cat: 'Varios' },
    { k: 'otros', e: '🛒', label: 'Otros', cat: 'Varios' }
  ];
  const iconOf = (k) => ICONS.find((i) => i.k === k) || ICONS[ICONS.length - 1];

  const KG_KEYS = ['verdura', 'fruta', 'queso', 'carne', 'pollo', 'pescado'];

  const userKey = () => 'changui_v1_' + ((document.getElementById('userEmail')?.textContent || '').trim().toLowerCase() || 'anon');
  let state = { items: [], general: 0, purchases: [] };
  let editingPurchaseId = null;

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
    enhanceTable();
  }

  let selIcon = 'otros';
  let editingId = null;
  let kgMode = false;
  let priceTextNode = null;
  let tableObs = null;
  const openKeys = new Set();

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
    const p = it.promo || { type: 'none' };
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

  function setupKgUI() {
    const icons = $('#chgIcons');
    const qtyLabel = $('#chgQty')?.closest('label');
    const priceLabel = $('#chgPrice')?.closest('label');
    if (!icons || !qtyLabel || !priceLabel) return;

    priceTextNode = [...priceLabel.childNodes].find((n) => n.nodeType === 3 && n.nodeValue.trim());

    icons.insertAdjacentHTML('afterend',
      `<div id="chgKgMode" class="chg-gen-chips chg-kgmode" hidden>
         <button type="button" data-kgmode="unit">Por unidad</button>
         <button type="button" data-kgmode="kg">⚖️ Por kilo</button>
       </div>`);

    qtyLabel.id = 'chgQtyWrap';
    qtyLabel.insertAdjacentHTML('afterend',
      `<label class="chg-field" id="chgWeightWrap" hidden>Peso comprado
         <div class="chg-weight">
           <input id="chgWeight" type="text" inputmode="decimal" placeholder="Ej. 0,5 o 500">
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

  const currentKg = () => {
    const w = parseWeight($('#chgWeight')?.value);
    const unit = $('#chgWeightUnit')?.value;
    if (unit === 'kg' && w >= 10) return w / 1000;
    return unit === 'g' ? w / 1000 : w;
  };

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

    const promo = $('#chgPromo');
    [...promo.options].forEach((o) => { if (['2x1', '2nd50', '2nd70'].includes(o.value)) o.disabled = kgMode; });
    if (kgMode && ['2x1', '2nd50', '2nd70'].includes(promo.value)) promo.value = 'none';
    updateKgPreview();
  }

  function renderIcons() {
    const container = $('#chgIcons');
    if (!container) return;
    container.innerHTML = ICONS.map((i) =>
      `<button type="button" class="chg-chip${i.k === selIcon ? ' on' : ''}" data-icon="${i.k}" aria-pressed="${i.k === selIcon}" title="${esc(i.label)}"><span>${i.e}</span><small>${esc(i.label)}</small></button>`
    ).join('');
  }

  function itemHTML(it) {
    const c = itemCalc(it);
    const ic = iconOf(it.icon);
    const badge = promoLabel(it.promo) ? `<span class="chg-badge">${esc(promoLabel(it.promo))}</span>` : '';
    const old = c.saved > 0.005 ? `<s class="chg-old">${money(c.base, it.cur)}</s>` : '';
    const line = it.byKg
      ? `⚖️ ${esc(kgLabel(it.kg))} x ${money(it.price, it.cur)}/kg`
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
          <button class="pastel-btn" type="button" data-act="edit" title="Editar">✏️</button>
          <button class="btn btn-outline" type="button" data-act="del" title="Quitar">🗑️</button>
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

    const food = list.filter((e) => e.category === 'Alimentos' || e.fromChangui || /^changui\b/i.test(e.description || ''));
    let foodARS = 0, foodUSD = 0;
    food.forEach((e) => { if (e.currency === 'USD') foodUSD += Number(e.amount || 0); else foodARS += Number(e.amount || 0); });
    pills.push(food.length
      ? `🛒 En ${esc(monthName(month))} venís gastando ${money(foodARS, 'ARS')}${foodUSD > 0 ? ' + ' + money(foodUSD, 'USD') : ''} en comida y súper.`
      : `🛒 En ${esc(monthName(month))} todavía no cargaste gastos de comida o súper.`);

    const chgExps = list.filter((e) => e.fromChangui || /^changui\b/i.test(e.description || ''));

    const stores = {};
    list.forEach((e) => {
      const desc = String(e.description || '');
      const m = desc.match(/^changui\s+en\s+([^(]*?)\s*(\(|$)/i) || desc.match(/^env[ií]o a domicilio en\s+(.+)$/i);
      const name = m && m[1] ? m[1].trim() : '';
      if (!name) return;
      stores[name] = (stores[name] || 0) + toARS(Number(e.amount || 0), e.currency || 'ARS');
    });
    const topStore = Object.entries(stores).sort((a, c) => c[1] - a[1])[0];
    if (topStore) {
      pills.push(`🏪 Donde más gastaste fue en <strong>${esc(topStore[0])}</strong> (${money(topStore[1], 'ARS')}).`);
    }

    const prods = {};
    chgExps.forEach((e) => {
      const cur = e.currency || 'ARS';
      let items = Array.isArray(e.detalle) && e.detalle.length ? e.detalle : null;
      if (!items) {
        const m = String(e.description || '').match(/\(([^()]*)\)\s*$/);
        const names = m ? m[1].split(/[,;]/).map((s) => s.trim()).filter(Boolean) : [];
        items = names.map((n) => ({ name: n, icon: 'otros', cur, paid: Number(e.amount || 0) / names.length }));
      }
      items.forEach((it) => {
        const v = toARS(Number(it.paid || 0), it.cur || cur);
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
    $('#chgSubmit').textContent = '➕ Agregar al changuito';
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
    $('#chgSubmit').textContent = '💾 Guardar cambios';
    $('#chgCancelEdit').hidden = false;
    renderIcons();
    applyKgUI();
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

    const snap = (it) => ({
      name: it.name, icon: it.icon, cur: it.cur, price: it.price, qty: it.qty,
      byKg: !!it.byKg, kg: it.kg || 0, promo: it.promo,
      paid: round2(itemCalc(it).paid * (1 - g / 100))
    });

    const storeLabel = store ? ` en ${store}` : '';
    const expenses = Object.values(groups)
      .map((x) => ({
        description: `Changui${storeLabel} (${x.items.map(i => i.name).join(', ')})`,
        category: x.cat,
        amount: round2(x.amount),
        currency: x.cur,
        detalle: x.items.map(snap)
      }))
      .filter((x) => x.amount > 0);

    const details = expenses.map((x) => ({
      description: x.description, amount: x.amount, currency: x.currency, items: x.detalle
    }));

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

    if (editingPurchaseId) {
      state.purchases = state.purchases.filter((p) => p.id !== editingPurchaseId);
      editingPurchaseId = null;
    }

    state.purchases.unshift({
      id: uid(), date, store, deliveryMode, deliveryCost,
      expenses: details,
      items: state.items.map((it) => ({
        name: it.name, icon: it.icon, cur: it.cur, price: it.price, qty: it.qty,
        byKg: !!it.byKg, kg: it.kg || 0, promo: it.promo,
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

  const norm = (s) => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
  const isoFromCell = (t) => {
    const m = String(t || '').trim().match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
    return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : '';
  };

  const pendingItems = new Map();

  const findExp = (month, id) => {
    const b = bridge();
    return (b.getMonthExpenses ? b.getMonthExpenses(month) || [] : []).find((x) => x.id === id);
  };
  const canEditExpenses = () => typeof bridge().updateExpense === 'function';
  const currentList = (exp) => (exp && Array.isArray(exp.detalle) && exp.detalle.length ? exp.detalle : pendingItems.get(exp && exp.id));

  const normItem = (x, cur) => ({
    name: String(x.name || 'Producto'),
    icon: x.icon || 'otros',
    cur: x.cur || cur,
    price: Number(x.price) || 0,
    qty: Number(x.qty) || 1,
    byKg: !!x.byKg,
    kg: Number(x.kg) || 0,
    promo: x.promo || { type: 'none' },
    paid: round2(Number(x.paid) || 0)
  });

  function getDetail(desc, iso, exp) {
    if (exp && Array.isArray(exp.detalle) && exp.detalle.length) return { items: exp.detalle, stored: true };
    const d = norm(desc);
    const cur = (exp && exp.currency) || 'ARS';
    const P = state.purchases || [];
    for (const p of P) {
      if (iso && p.date !== iso) continue;
      for (const ex of (p.expenses || [])) {
        if (!ex.isDelivery && norm(ex.description) === d && ex.items && ex.items.length) {
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
        const promo = promoLabel(it.promo) ? ` · ${esc(promoLabel(it.promo))}` : '';
        const sub = priced
          ? (it.byKg ? `⚖️ ${esc(kgLabel(it.kg))} x ${money(it.price, it.cur)}/kg${promo}` : `${it.qty || 1} x ${money(it.price, it.cur)}${promo}`)
          : 'Sin precio · tocá ✏️ para cargarlo';
        const right = priced ? `<b>${money(it.paid, it.cur)}</b>` : '<span class="chg-d-sub">—</span>';
        const btns = edit
          ? `<button type="button" class="chg-d-edit" data-idx="${idx}" title="Editar producto">✏️</button><button type="button" class="chg-d-del" data-idx="${idx}" title="Quitar producto">✖</button>`
          : '';
        return `<div class="chg-d-line"><span>${iconOf(it.icon).e}</span><span class="chg-d-name">${esc(it.name)}<span class="chg-d-sub">${sub}</span></span><span class="chg-d-right">${right}${btns}</span></div>`;
      }).join('');
    } else {
      body = '<p class="chg-d-note">No hay detalle guardado para este gasto.</p>';
    }
    const note = unpriced
      ? `<p class="chg-d-note">Faltan precios en ${unpriced} ${unpriced === 1 ? 'producto' : 'productos'}. Cuando todos tengan precio, el total del gasto se calcula solo.</p>`
      : '';
    const attrs = edit ? ` data-exp="${esc(edit.id)}" data-month="${esc(edit.month)}"` : '';
    return `<div class="chg-detail"${attrs}><div class="chg-d-title">🛒 ¿QUÉ SE COMPRÓ?</div>${body}${note}</div>`;
  }

  function enhanceTable() {
    const tb = document.getElementById('expenseTable');
    if (!tb) return;
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

        const shortDesc = res.items.length >= 2 ? (desc.replace(/\s*\([^()]*\)\s*$/, '').trim() || desc) : desc;
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
           <strong>${iconOf(it.icon).e} Editar producto</strong>
           <div class="chg-d-fields">
             <label class="chg-d-full">Nombre<input class="chg-d-name-in" type="text" maxlength="40" value="${esc(it.name)}"></label>
             <label class="chg-d-full">Tipo de producto<select class="chg-d-icon">${ICONS.map((i) => `<option value="${i.k}"${i.k === it.icon ? ' selected' : ''}>${i.e} ${esc(i.label)}</option>`).join('')}</select></label>
             <label>Se compra<select class="chg-d-mode"><option value="unit"${it.byKg ? '' : ' selected'}>Por unidad</option><option value="kg"${it.byKg ? ' selected' : ''}${KG_KEYS.includes(it.icon) ? '' : ' disabled'}>Por kilo</option></select></label>
             <label class="chg-d-qtywrap"${it.byKg ? ' hidden' : ''}>Cantidad<input class="chg-d-qty" type="number" min="1" max="99" value="${it.qty || 1}"></label>
             <label class="chg-d-wtwrap"${it.byKg ? '' : ' hidden'}>Peso comprado<div class="chg-weight"><input class="chg-d-wt" type="text" inputmode="decimal" value="${wt}" placeholder="Ej. 0,5 o 500"><select class="chg-d-unit"><option value="kg"${grams ? '' : ' selected'}>kg</option><option value="g"${grams ? ' selected' : ''}>g</option></select></div></label>
             <label class="chg-d-price-label">${it.byKg ? 'Precio por kg' : 'Precio por unidad'}<input class="chg-d-price" type="text" inputmode="decimal" value="${price}" placeholder="0,00"></label>
           </div>
           <div class="chg-d-btns"><button type="button" class="chg-d-cancel">Cancelar</button><button type="button" class="chg-d-save">Guardar</button></div>
         </div>`);
      line.remove();
    });
  }

  function syncPurchaseFromExpense(oldDesc, newDesc, date, detalle, amount) {
    const od = norm(oldDesc);
    const apply = (ignoreDate) => {
      let found = false;
      (state.purchases || []).forEach((p) => {
        if (!ignoreDate && date && p.date !== date) return;
        let hit = false;
        (p.expenses || []).forEach((x) => {
          if (x.isDelivery || norm(x.description) !== od) return;
          x.description = newDesc;
          x.items = detalle.map((d) => Object.assign({}, d));
          x.amount = Number(amount);
          hit = true;
        });
        if (hit) {
          p.items = (p.expenses || []).filter((x) => !x.isDelivery).flatMap((x) => x.items || []);
          found = true;
        }
      });
      return found;
    };
    if (apply(false) || apply(true)) save();
  }

  async function applyDetalle(box, exp, detalle, oldList, okMsg) {
    const b = bridge();
    if (!b.updateExpense) { toast('Falta actualizar app.js para poder editar.'); return; }
    const month = box.dataset.month;

    const allPriced = detalle.every((x) => Number(x.paid) > 0);
    const amount = allPriced ? round2(detalle.reduce((s, x) => s + Number(x.paid || 0), 0)) : Number(exp.amount);

    const oldDesc = String(exp.description || '');
    let newDesc = oldDesc;
    const m = oldDesc.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    if (m && Array.isArray(exp.detalle) && exp.detalle.length && norm(m[2]) === norm(oldList.map((x) => x.name).join(', '))) {
      newDesc = `${m[1].trim()} (${detalle.map((x) => x.name).join(', ')})`;
    }

    const row = box.closest('tr');
    const oldKey = row ? row.dataset.key : '';
    const iso = oldKey.split('|')[0];
    const newKey = iso + '|' + norm(newDesc);
    const wasOpen = openKeys.has(oldKey);
    openKeys.delete(oldKey);
    if (wasOpen) openKeys.add(newKey);

    exp.description = newDesc;
    let ok = false;
    try { ok = await b.updateExpense({ month, id: exp.id, amount, detalle }); } catch (err) { ok = false; }
    if (!ok) {
      exp.description = oldDesc;
      openKeys.delete(newKey);
      if (wasOpen) openKeys.add(oldKey);
      toast('No se pudo guardar el cambio.');
      return;
    }
    syncPurchaseFromExpense(oldDesc, newDesc, exp.date, detalle, amount);
    toast(okMsg);
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
      const unit = q('.chg-d-unit').value;
      const kg = (unit === 'kg' && w >= 10) ? w / 1000 : (unit === 'g' ? w / 1000 : w);
      if (!(kg > 0)) { toast('Ingresá el peso comprado.'); return; }
      nu.kg = Math.round(kg * 1000) / 1000;
      nu.qty = 1;
      if (!nu.promo || nu.promo.type !== 'pct') nu.promo = { type: 'none' };
    } else {
      nu.qty = Math.min(99, Math.max(1, parseInt(q('.chg-d-qty').value, 10) || 1));
      nu.kg = 0;
    }

    const oldCalc = itemCalc(old).paid;
    const factor = oldCalc > 0 && Number(old.paid) > 0 ? Number(old.paid) / oldCalc : 1;
    nu.paid = round2(itemCalc(nu).paid * factor);

    await applyDetalle(box, exp, list.map((x, i) => (i === idx ? nu : x)), list, 'Listo, actualicé el producto.');
  }

  async function deleteItem(btn) {
    const box = btn.closest('.chg-detail');
    const exp = box && findExp(box.dataset.month, box.dataset.exp);
    const list = exp && currentList(exp);
    const idx = Number(btn.dataset.idx);
    if (!list || !list[idx]) return;
    if (list.length <= 1) { toast('Es el único producto. Para borrar el gasto completo usá la ✖ de la fila.'); return; }
    if (!confirm(`¿Quitar "${list[idx].name}" de este gasto?`)) return;
    await applyDetalle(box, exp, list.filter((_, i) => i !== idx), list, 'Producto quitado.');
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
    if (e.target.closest('#expenseTable .chg-d-cancel')) { enhanceTable(); return; }
    const sv = e.target.closest('#expenseTable .chg-d-save');
    if (sv) saveItemEdit(sv);
  });

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
    const genFactor = customPurchase ? 1 : (1 - state.general / 100);
    const paidOf = (it) => (customPurchase ? Number(it.paid || 0) : itemCalc(it).paid * genFactor);
    const unitsOf = (it) => (it.byKg ? (Number(it.kg) || 1) : (it.qty || 1));

    let totalARS = 0;
    let totalUSD = 0;
    itemsToPrint.forEach((it) => {
      const paid = paidOf(it);
      if ((it.cur || 'ARS') === 'USD') totalUSD += paid; else totalARS += paid;
    });

    const delivery = customPurchase ? (customPurchase.deliveryMode === 'envio' ? Number(customPurchase.deliveryCost || 0) : 0) : getDeliveryCost();
    totalARS += delivery;

    const storeName = plain(customPurchase ? (customPurchase.store || '') : \$('#chgStore')?.value || '');
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

    const totalCardText = fmt(totalARS, 'ARS') + (totalUSD > 0 ? ' + ' + fmt(totalUSD, 'USD') : '');
    const cards = [
      ['TOTAL GASTADO', totalCardText],
      ['MODALIDAD', customPurchase ? (customPurchase.deliveryMode === 'envio' ? 'Envío a domicilio' : 'Presencial') : (\$('#chgDeliveryMode')?.value === 'envio' ? 'Envío' : 'Presencial')],
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

  function exportCSV(customPurchase = null) {
    const itemsToPrint = customPurchase ? customPurchase.items : state.items;
    if (!itemsToPrint || itemsToPrint.length === 0) { toast('No hay productos para exportar.'); return; }

    const storeName = customPurchase ? (customPurchase.store || 'General') : (\$('#chgStore')?.value || 'General');
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

    const delivery = customPurchase ? (customPurchase.deliveryMode === 'envio' ? Number(customPurchase.deliveryCost || 0) : 0) : getDeliveryCost();
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

  function renderHistoryModal() {
    const container = \$('#chgHistoryListContainer');
    if (!container) return;

    const b = bridge();
    const currentMonth = (b.getCurrentMonth && b.getCurrentMonth()) || todayISO().slice(0, 7);
    const monthExpenses = (b.getMonthExpenses ? b.getMonthExpenses(currentMonth) || [] : []);

    const unifiedPurchases = [];
    const seenIds = new Set();
    const covered = new Set();

    (state.purchases || []).forEach((p) => {
      if (!p.id || seenIds.has(p.id)) return;
      seenIds.add(p.id);
      unifiedPurchases.push({ ...p, source: 'local' });
      (p.expenses || []).forEach((x) => covered.add(norm(x.description)));
    });

    monthExpenses.forEach((exp) => {
      if (!/^changui\b/i.test(exp.description || '')) return;
      if (covered.has(norm(exp.description))) return;
      const pId = exp.id || ('exp_' + exp.date + '_' + exp.amount);
      if (seenIds.has(pId)) return;
      seenIds.add(pId);
      const cur = exp.currency || 'ARS';
      unifiedPurchases.push({
        id: pId,
        source: 'expense',
        date: exp.date || todayISO(),
        store: (String(exp.description).match(/^changui\s+en\s+(.*?)\s*(\(|\$)/i) || [])[1] || '',
        deliveryMode: 'presencial',
        deliveryCost: 0,
        items: (exp.detalle || exp.items || []).map((x) => normItem(x, cur))
      });
    });

    unifiedPurchases.sort((a, c) => String(c.date).localeCompare(String(a.date)));
    historyCache = unifiedPurchases;

    if (unifiedPurchases.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">🛒 Todavía no guardaste ningún changuito.</div>`;
      return;
    }

    const hint = '<p style="font-size: 0.75rem; color: var(--muted); margin: 0 0 10px;">Para editar un producto, abrí el Detalle del gasto en Gastos del mes: el cambio se refleja acá.</p>';
    container.innerHTML = hint + unifiedPurchases.map((p) => {
      const isLocal = p.source === 'local';
      const storeName = p.store ? `Supermercado: <strong>${esc(p.store)}</strong>` : 'Compra general';
      const isEnvio = p.deliveryMode === 'envio';
      const deliveryText = isEnvio ? `📦 Envío a domicilio (${money(p.deliveryCost || 0, 'ARS')})` : '🛍️ Presencial (Local)';

      const itemsHtml = (p.items || []).map((it, idx) => `
        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line);">
          <span>${iconOf(it.icon).e} ${esc(it.name)} (${esc(qtyText(it))})</span>
          <div style="display: flex; align-items: center; gap: 6px;">
            <b>${Number(it.paid) > 0 ? money(it.paid, it.cur) : '—'}</b>
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
        <div class="chg-history-card" data-purchase-id="${esc(p.id)}" style="border: 1px solid var(--chg-line); border-radius: 16px; padding: 14px; background: var(--bg, transparent); margin-bottom: 10px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px; font-size: 0.85rem;">
            <span>📅 ${fmtDay(p.date)} · ${storeName}</span>
            <div style="display: flex; gap: 4px; flex-wrap: wrap;">
              <button class="pastel-btn btn-sm" type="button" data-load-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="Cargar este changuito en la pantalla">📂 Ver</button>
              <button class="pastel-btn btn-sm" type="button" data-pdf-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="PDF">📄 PDF</button>
              <button class="pastel-btn btn-sm" type="button" data-csv-purchase="${esc(p.id)}" style="padding: 2px 6px; font-size: 10px;" title="CSV">📊 CSV</button>
              ${isLocal ? `<button class="chg-ico-btn" type="button" data-edit-purchase="\${esc(p.id)}" title="Editar">✏️</button>
              <button class="chg-ico-btn" type="button" data-del-purchase="\${esc(p.id)}" title="Eliminar">🗑️</button>` : ''}
            </div>
          </div>
          <div style="font-size: 0.78rem; color: var(--muted); margin-bottom: 6px;">
            📍 Modalidad: <strong>${deliveryText}</strong>
          </div>
          <div style="display: grid; gap: 4px; margin-top: 6px;">
            ${itemsHtml || '<span style="font-size:0.8rem;color:var(--muted);">Sin detalle de productos.</span>'}
            ${deliveryHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  function loadPurchaseIntoCart(purchase) {
    editingPurchaseId = purchase.id;
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

    if ($('#chgStore')) $('#chgStore').value = purchase.store || '';
    if ($('#chgDeliveryMode')) $('#chgDeliveryMode').value = purchase.deliveryMode || 'presencial';
    if ($('#chgDeliveryCostWrap')) $('#chgDeliveryCostWrap').hidden = purchase.deliveryMode !== 'envio';
    if ($('#chgDeliveryCost')) $('#chgDeliveryCost').value = purchase.deliveryCost ? formatAmountInput(String(purchase.deliveryCost).replace('.', ',')) : '';
    if ($('#chgDate')) $('#chgDate').value = purchase.date || todayISO();

    save();
    render();
  }

  \$('#chgForm').addEventListener('submit', submitItem);
  \$('#chgCancelEdit').addEventListener('click', () => { editingPurchaseId = null; resetForm(); });
  \$('#chgPdfBtn').addEventListener('click', () => exportPDF(null));

  \$('#chgCsvBtn')?.addEventListener('click', () => exportCSV(null));
  \$('#chgRegisterBtn').addEventListener('click', registerPurchase);
  \$('#chgDate').value = todayISO();

  \$('#chgToggleBtn').addEventListener('click', (e) => {
    const body = \$('#chgBody');
    body.hidden = !body.hidden;
    e.currentTarget.textContent = body.hidden ? '▼ Mostrar Changui' : '▲ Ocultar Changui';
  });

  \$('#chgClearBtn').addEventListener('click', () => {
    if (!state.items.length) return;
    if (!confirm('¿Vaciar todo el changuito?')) return;
    state.items = []; state.general = 0; editingPurchaseId = null; save(); resetForm(); render();
  });

  \$('#chgPromo').addEventListener('change', (e) => {
    const custom = e.target.value === 'custom';
    \$('#chgPromoCustomWrap').hidden = !custom;
    if (custom) \$('#chgPromoCustom').focus();
  });

  \$('#chgPrice').addEventListener('input', (e) => {
    const el = e.target;
    const start = el.selectionStart, prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
    updateKgPreview();
  });
  \$('#chgCur').addEventListener('change', updateKgPreview);

  \$('#chgDeliveryMode')?.addEventListener('change', (e) => {
    const isEnvio = e.target.value === 'envio';
    const wrap = \$('#chgDeliveryCostWrap');
    if (wrap) wrap.hidden = !isEnvio;
    renderCart();
    renderTotals();
  });

  \$('#chgDeliveryCost')?.addEventListener('input', (e) => {
    const el = e.target;
    const start = el.selectionStart, prevLen = el.value.length;
    el.value = formatAmountInput(el.value);
    const pos = Math.max(0, start + (el.value.length - prevLen));
    el.setSelectionRange(pos, pos);
    renderCart();
    renderTotals();
  });

  \$('#chgGeneral').addEventListener('input', (e) => {
    const n = parseFloat(String(e.target.value).replace(',', '.'));
    state.general = Math.min(100, Math.max(0, Number.isFinite(n) ? n : 0));
    save();
    renderTotals();
    root.querySelectorAll('[data-gen]').forEach((b) => b.classList.toggle('on', Number(b.dataset.gen) === state.general));
  });

  root.addEventListener('click', (e) => {
    const chip = e.target.closest('[data-icon]');
    if (chip) {
      const changed = selIcon !== chip.dataset.icon;
      selIcon = chip.dataset.icon;
      if (changed) kgMode = KG_KEYS.includes(selIcon);
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
      \$('#chgWeight').value = wchip.dataset.wv;
      \$('#chgWeightUnit').value = wchip.dataset.wu;
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

    if (e.target.closest('#chgHistoryModalBtn')) {
      renderHistoryModal();
      \$('#chgHistoryDialog')?.showModal();
      return;
    }
    if (e.target.closest('#chgCloseHistoryBtn')) {
      \$('#chgHistoryDialog')?.close();
      return;
    }
    if (e.target.id === 'chgHistoryDialog') {
      \$('#chgHistoryDialog').close();
      return;
    }

    const loadBtn = e.target.closest('[data-load-purchase]');
    if (loadBtn) {
      const purchase = findPurchase(loadBtn.dataset.loadPurchase);
      if (!purchase) { toast('No se encontró ese changuito.'); return; }
      if (!purchase.items || !purchase.items.length) { toast('Ese changuito no tiene productos guardados.'); return; }
      if (state.items.length && !confirm('Ya tenés productos en el changuito actual. ¿Reemplazarlos por este?')) return;
      loadPurchaseIntoCart(purchase);
      \$('#chgHistoryDialog')?.close();
      const body = \$('#chgBody');
      if (body && body.hidden) {
        body.hidden = false;
        const tbtn = \$('#chgToggleBtn');
        if (tbtn) tbtn.textContent = '▲ Ocultar Changui';
      }
      \$('#chgList')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      toast('Changuito cargado en pantalla con éxito. 🛒');
      return;
    }

    const pdfBtn = e.target.closest('[data-pdf-purchase]');
    if (pdfBtn) {
      const purchase = findPurchase(pdfBtn.dataset.pdfPurchase);
      if (purchase) exportPDF(purchase); else toast('No se encontró ese changuito.');
      return;
    }

    const csvBtn = e.target.closest('[data-csv-purchase]');
    if (csvBtn) {
      const purchase = findPurchase(csvBtn.dataset.csvPurchase);
      if (purchase) exportCSV(purchase); else toast('No se encontró ese changuito.');
      return;
    }

    const delBtn = e.target.closest('[data-del-purchase]');
    if (delBtn) {
      const id = delBtn.dataset.delPurchase;
      if (confirm('¿Eliminar este registro del historial? El gasto ya cargado en Mensuales no se borra.')) {
        state.purchases = state.purchases.filter((p) => p.id !== id);
        save();
        renderHistoryModal();
        renderInsight();
        toast('Eliminado del historial. El gasto en Mensuales sigue ahí.');
      }
      return;
    }

    const editBtn = e.target.closest('[data-edit-purchase]');
    if (editBtn) {
      const id = editBtn.dataset.editPurchase;
      const purchase = findLocalPurchase(id);
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
      return;
    }

    const cancelBtn = e.target.closest('[data-cancel-edit-purchase]');
    if (cancelBtn) { renderHistoryModal(); return; }

    const saveBtn = e.target.closest('[data-save-purchase]');
    if (saveBtn) {
      const id = saveBtn.dataset.savePurchase;
      const purchase = findLocalPurchase(id);
      if (purchase) {
        purchase.store = document.getElementById(`editStore_${id}`)?.value.trim() || '';
        purchase.date = document.getElementById(`editDate_${id}`)?.value || todayISO();
        save();
        renderHistoryModal();
        renderInsight();
        toast('Changuito actualizado.');
      }
      return;
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
  watch('userEmail', () => { load(); render(); enhanceTable(); });
  document.getElementById('monthPicker')?.addEventListener('change', refresh);

  (function injectDetailFx() {
    if (document.getElementById('chgDetailFx')) return;
    const st = document.createElement('style');
    st.id = 'chgDetailFx';
    st.textContent = `
      body{--chg-fx:234,91,142;--chg-fa:.35}
      body.dark-mode{--chg-fx:255,120,160;--chg-fa:.40}
      body.dark-blue-mode{--chg-fx:56,189,248;--chg-fa:.40}
      body.black-mode{--chg-fx:255,255,255;--chg-fa:.28}
      .chg-tog,.chg-d-edit,.chg-d-del,.chg-d-save,.chg-d-cancel{cursor:pointer;transition:transform .15s ease,box-shadow .2s ease,border-color .2s ease}
      .chg-tog:hover,.chg-d-save:hover,.chg-d-cancel:hover{transform:translateY(-1px) scale(1.05);border-color:rgba(var(--chg-fx),.85);box-shadow:0 6px 14px rgba(var(--chg-fx),var(--chg-fa))}
      .chg-d-edit:hover,.chg-d-del:hover{transform:scale(1.18);box-shadow:0 4px 10px rgba(var(--chg-fx),var(--chg-fa))}
      .chg-tog:active,.chg-d-edit:active,.chg-d-del:active,.chg-d-save:active,.chg-d-cancel:active{transform:scale(.96);box-shadow:none}
    `;
    document.head.appendChild(st);
  })();

  window.__changuiEnhance = enhanceTable;
  setupKgUI();
  load();
  renderIcons();
  applyKgUI();
  render();
  enhanceTable();
})();
