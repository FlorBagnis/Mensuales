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
    $('#chgCount').textContent = n ? `(${n})` : '';
    $('#chgList').innerHTML = n
      ? state.items.map(itemHTML).join('')
      : '<li class="chg-empty"><div>🛒</div><strong>Tu changuito está vacío</strong><br><span>Elegí un ícono, cargá el precio y sumalo.</span></li>';
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

    const stores = {};
    state.purchases.forEach((p) => {
      const storeName = p.store ? p.store.trim() : 'Sin especificar';
      let storeTotal = 0;
      (p.items || []).forEach((it) => { storeTotal += toARS(Number(it.paid || 0), it.cur); });
      if (p.deliveryCost) storeTotal += toARS(Number(p.deliveryCost), 'ARS');
      stores[storeName] = (stores[storeName] || 0) + storeTotal;
    });
    const topStore = Object.entries(stores).sort((a, c) => c[1] - a[1])[0];
    if (topStore && topStore[1] > 0 && topStore[0] !== 'Sin especificar') {
      pills.push(`🏪 El supermercado donde más plata dejaste es <strong>${esc(topStore[0])}</strong> (${money(topStore[1], 'ARS')} acumulados).`);
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

  /* ---------- Historial de Changuitos (Modal con Edición) ---------- */
  function renderHistoryModal() {
    const container = $('#chgHistoryListContainer');
    if (!container) return;

    if (!state.purchases || state.purchases.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 24px; color: var(--muted);">🛒 Todavía no guardaste ningún changuito.</div>`;
      return;
    }

    container.innerHTML = state.purchases.map(p => {
      const storeName = p.store ? `Supermercado: <strong>${esc(p.store)}</strong>` : 'Compra general';
      const modeText = p.deliveryMode === 'envio' ? `📦 Envío ($${p.deliveryCost || 0})` : '🛍️ Presencial';
      
      const itemsHtml = (p.items || []).map(it => `
        <div style="display: flex; justify-content: space-between; font-size: 0.82rem; padding: 4px 0; border-bottom: 1px dashed var(--chg-line);">
          <span>${iconOf(it.icon).e} ${esc(it.name)} (${it.qty || 1}x)</span>
          <b>${money(it.paid, it.cur)}</b>
        </div>
      `).join('');

      return `
        <div class="chg-history-card" data-purchase-id="${p.id}" style="border: 1px solid var(--chg-line); border-radius: 16px; padding: 14px; background: var(--bg, transparent); margin-bottom: 8px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; font-size: 0.85rem;">
            <span>📅 ${fmtDay(p.date)} · ${storeName} (${modeText})</span>
            <div style="display: flex; gap: 4px;">
              <button class="pastel-btn btn-sm" type="button" data-edit-purchase="${p.id}" style="padding: 2px 8px; font-size: 11px;">✏️ Editar</button>
              <button class="btn btn-danger btn-sm" type="button" data-del-purchase="${p.id}" style="padding: 2px 8px; font-size: 11px;">Eliminar</button>
            </div>
          </div>
          <div style="display: grid; gap: 2px; margin-top: 6px;">
            ${itemsHtml}
          </div>
        </div>
      `;
    }).join('');
  }

  document.addEventListener('click', (e) => {
    if (e.target.closest('#chgHistoryModalBtn')) {
      renderHistoryModal();
      $('#chgHistoryDialog')?.showModal();
    }
    if (e.target.closest('#chgCloseHistoryBtn') || e.target.closest('#chgHistoryDialog')) {
      if (e.target.id === 'chgHistoryDialog') $('#chgHistoryDialog').close();
    }

    // Botón de Borrar
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

    // Botón de Editar registro del historial
    const editBtn = e.target.closest('[data-edit-purchase]');
    if (editBtn) {
      const id = editBtn.dataset.editPurchase;
      const purchase = state.purchases.find(p => p.id === id);
      if (!purchase) return;

      const card = editBtn.closest('.chg-history-card');
      if (!card) return;

      card.innerHTML = `
        <div style="display: grid; gap: 8px; font-size: 0.85rem;">
          <strong>✏️ Editando changuito</strong>
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

    // Cancelar edición
    const cancelBtn = e.target.closest('[data-cancel-edit-purchase]');
    if (cancelBtn) {
      renderHistoryModal();
    }

    // Guardar cambios de la edición
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
        toast('Changuito actualizado con éxito.');
      }
    }
  });

  /* ---------- Eventos generales ---------- */
  $('#chgForm').addEventListener('submit', submitItem);
  $('#chgCancelEdit').addEventListener('click', resetForm);
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
