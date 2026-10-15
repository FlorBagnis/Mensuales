/* =========================================================
   PASAR UN GASTO A CHANGUI · extra para Mensuales
   Al editar un gasto del mes, lo convertís en producto de Changui
   (huevos, pollo, verduras, etc.). No toca app.js ni changui.js.
   Creado by Flor Bagnis 💗
========================================================= */
(() => {
  'use strict';

  const form = document.getElementById('expenseForm');
  const dialog = document.getElementById('expenseDialog');
  if (!form || !dialog) return;
  const $ = (id) => document.getElementById(id);

  // Mismos tipos de producto que Changui: [clave, emoji, nombre, categoría del gasto]
  const ICONS = [
    ['leche', '🥛', 'Lácteos', 'Alimentos'], ['agua', '💧', 'Agua', 'Alimentos'],
    ['bebidas', '🥤', 'Bebidas', 'Alimentos'], ['carne', '🥩', 'Carne', 'Alimentos'],
    ['pescado', '🐟', 'Pescado', 'Alimentos'], ['pollo', '🍗', 'Pollo', 'Alimentos'],
    ['queso', '🧀', 'Queso y fiambre', 'Alimentos'], ['pan', '🍞', 'Panadería', 'Alimentos'],
    ['verdura', '🥦', 'Verduras', 'Alimentos'], ['fruta', '🍎', 'Frutas', 'Alimentos'],
    ['huevos', '🥚', 'Huevos', 'Alimentos'], ['almacen', '🍝', 'Almacén', 'Alimentos'],
    ['snacks', '🍫', 'Snacks y dulces', 'Alimentos'], ['limpieza', '🧴', 'Limpieza', 'Hogar'],
    ['higiene', '🧻', 'Higiene', 'Personal'], ['mascotas', '🐶', 'Mascotas', 'Mascotas'],
    ['bebes', '🍼', 'Bebés y niños', 'Hogar'], ['electro', '🔌', 'Electro', 'Hogar'],
    ['tecnologia', '💻', 'Tecnología', 'Hogar'], ['ferreteria', '🔨', 'Ferretería y arreglos', 'Hogar'],
    ['zapatillas', '👟', 'Calzado e indumentaria', 'Personal'], ['farmacia', '💊', 'Farmacia y salud', 'Salud'],
    ['regalos', '🎁', 'Regalos', 'Varios'], ['libreria', '📚', 'Librería y oficina', 'Varios'],
    ['jardin', '🌸', 'Jardín y plantas', 'Hogar'], ['decoracion', '🛋️', 'Decoración y hogar', 'Hogar'],
    ['vehiculo', '🚗', 'Vehículo / Auto', 'Varios'], ['otros', '🛒', 'Otros', 'Varios']
  ];
  // Rubros que se pueden comprar por kilo (igual que en Changui)
  const KG_KEYS = ['verdura', 'fruta', 'queso', 'carne', 'pollo', 'pescado'];

  /* ---------- estilos: usan las variables de cada modo (claro, oscuro, azul, black) ---------- */
  const st = document.createElement('style');
  st.id = 'chgMoveStyles';
  st.textContent = `
    .chg-move{display:block;margin:2px 0;padding:12px 14px;border-radius:16px;box-sizing:border-box;
      border:1px dashed var(--line,#f2cfdf);background:var(--pill-bg,rgba(251,196,212,.18))}
    .chg-move[hidden],.chg-move [hidden]{display:none!important}
    #expenseDialog .chg-move .chg-move-toggle{font-weight:700;color:var(--pink-700,#c43878);cursor:pointer;margin:0}
    .chg-move-hint{margin:8px 0 10px;font-size:.78rem;line-height:1.35;color:var(--muted,#8b7d86)}
    .chg-move-grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px 12px}
    .chg-move-grid>label{display:grid;gap:6px;min-width:0;margin:0}
    .chg-move-full{grid-column:1/-1}
    .chg-move-weight{display:grid;grid-template-columns:minmax(0,1fr) 84px;gap:6px}
    .chg-move-grid input,.chg-move-grid select{width:100%;min-width:0;box-sizing:border-box}
    .chg-move-store{display:grid;gap:6px;margin:10px 0 0}
    .chg-move-item{margin-top:10px;padding:10px 12px;border-radius:14px;box-sizing:border-box;
      border:1px solid var(--line,#f2cfdf);background:var(--card,transparent)}
    .chg-move-item-head{display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;
      font-size:.8rem;color:var(--pink-700,#c43878)}
    .chg-move-rm{background:transparent;border:none;cursor:pointer;font-size:14px;color:inherit;padding:2px 6px;border-radius:6px}
    .chg-move-add,.chg-move-split{background:transparent;border:1px dashed var(--pink-700,#c43878);
      color:var(--pink-700,#c43878);border-radius:12px;font-weight:700;cursor:pointer}
    .chg-move-add{margin-top:10px;width:100%;padding:9px 14px;font-size:.82rem}
    .chg-move-split{padding:5px 10px;font-size:.72rem}
    .chg-move-add:hover,.chg-move-split:hover,.chg-move-rm:hover{transform:scale(1.04)}
    @media (max-width:480px){
      .chg-move{padding:10px 12px}
      .chg-move-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(st);

  /* ---------- bloque dentro del modal "Editar gasto" ---------- */
  const iconOpts = ICONS.map((i) => `<option value="${i[0]}">${i[1]} ${i[2]}</option>`).join('');
  const box = document.createElement('div');
  box.id = 'chgMoveWrap';
  box.className = 'chg-move';
  box.hidden = true;
  box.innerHTML = `
    <label class="checkbox-label chg-move-toggle">
      <input id="chgMoveChk" type="checkbox">
      <span id="chgMoveLbl">🛒 Pasar este gasto a Changui</span>
    </label>
    <button type="button" id="chgMoveBack" class="chg-move-add" hidden>↩️ Sacar de Changui (volver a gasto normal)</button>
    <div id="chgMoveFields" hidden>
      <p class="chg-move-hint" id="chgMoveHint"></p>
      <label class="chg-move-store">¿Dónde compraste? (opcional)
        <input id="chgMoveStore" type="text" maxlength="30" placeholder="Ej. Carrefour, Coto, verdulería">
      </label>
      <div id="chgMoveItems"></div>
      <button type="button" id="chgMoveAdd" class="chg-move-add">➕ Agregar otro producto</button>
    </div>`;
  const recBox = form.querySelector('.recurring-box');
  if (recBox) recBox.before(box); else (form.querySelector('.modal-actions') || form.lastElementChild).before(box);

  const chk = box.querySelector('#chgMoveChk');
  const toggleLbl = box.querySelector('.chg-move-toggle');
  const back = box.querySelector('#chgMoveBack');
  const fields = box.querySelector('#chgMoveFields');
  const lbl = box.querySelector('#chgMoveLbl');
  const hint = box.querySelector('#chgMoveHint');
  const storeIn = box.querySelector('#chgMoveStore');
  const itemsBox = box.querySelector('#chgMoveItems');

  /* ---------- utilidades ---------- */
  const bridge = () => window.ChanguiBridge || {};
  const currentMonth = () => (bridge().getCurrentMonth && bridge().getCurrentMonth()) || ($('monthPicker') && $('monthPicker').value) || '';
  const findExp = (month, id) => ((bridge().getMonthExpenses && bridge().getMonthExpenses(month)) || []).find((x) => x.id === id);
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const parseMoney = (v) => {
    const n = parseFloat(String(v == null ? '' : v).replace(/\./g, '').replace(',', '.'));
    return Number.isFinite(n) ? n : 0;
  };
  // Peso: acepta 0,5 · 0.5 · 1,25 · 1.500
  const parseWeight = (v) => {
    let t = String(v || '').trim().replace(/\s/g, '');
    if (!t) return 0;
    if (t.includes(',')) t = t.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(t)) t = t.replace(/\./g, '');
    const n = parseFloat(t);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  const fmtInput = (v) => {
    let c = String(v == null ? '' : v).replace(/[^\d,]/g, '');
    const p = c.split(',');
    if (p.length > 2) c = p[0] + ',' + p.slice(1).join('');
    const [i, d] = c.split(',');
    const w = (i || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return d !== undefined ? `${w},${d.slice(0, 2)}` : w;
  };
  const showRecurring = (show) => { if (recBox) recBox.style.display = show ? '' : 'none'; };

  /* ---------- renglones de productos ---------- */
  const rows = () => [...itemsBox.children];
  const SNAP = ['.mv-icon', '.mv-name', '.mv-mode', '.mv-qty', '.mv-wt', '.mv-unit', '.mv-price'];
  const snap = (r) => SNAP.map((q) => r.querySelector(q).value).join('|');

  function syncRow(r) {
    const eligible = KG_KEYS.includes(r.querySelector('.mv-icon').value);
    const mode = r.querySelector('.mv-mode');
    mode.querySelector('option[value="kg"]').disabled = !eligible;
    if (!eligible && mode.value === 'kg') mode.value = 'unit';
    const kg = mode.value === 'kg';
    r.querySelector('.mv-qtywrap').hidden = kg;
    r.querySelector('.mv-wtwrap').hidden = !kg;
    r.querySelector('.mv-split').hidden = !r.querySelector('.mv-name').value.includes(',');
  }

  function renumber() {
    const rs = rows();
    const multi = rs.length > 1;
    rs.forEach((r, i) => {
      r.querySelector('.chg-move-num').textContent = 'Producto ' + (i + 1);
      r.querySelector('.chg-move-rm').hidden = !multi;
      r.querySelector('.mv-pricewrap').hidden = !multi;   // con un solo producto, el precio es el monto del gasto
    });
  }

  function addRow(d = {}) {
    const r = document.createElement('div');
    r.className = 'chg-move-item';
    r.innerHTML = `
      <div class="chg-move-item-head"><strong class="chg-move-num"></strong><button type="button" class="chg-move-rm" title="Quitar este producto">✖</button></div>
      <div class="chg-move-grid">
        <label class="chg-move-full">Tipo de producto
          <select class="mv-icon"><option value="" disabled selected>Elegí el tipo…</option>${iconOpts}</select>
        </label>
        <label class="chg-move-full">Nombre del producto
          <input class="mv-name" type="text" maxlength="40" placeholder="Ej. Pollo entero">
        </label>
        <div class="chg-move-full"><button type="button" class="chg-move-split" hidden>✂️ Separar por comas en varios productos</button></div>
        <label>Se compra
          <select class="mv-mode"><option value="unit" selected>Por unidad</option><option value="kg">Por kilo</option></select>
        </label>
        <label class="mv-qtywrap">Cantidad
          <input class="mv-qty" type="number" min="1" max="99" value="1">
        </label>
        <label class="mv-wtwrap" hidden>Peso comprado
          <div class="chg-move-weight">
            <input class="mv-wt" type="text" inputmode="decimal" placeholder="Ej. 1,5">
            <select class="mv-unit"><option value="kg" selected>kg</option><option value="g">g</option></select>
          </div>
        </label>
        <label class="chg-move-full mv-pricewrap" hidden>Precio pagado (opcional)
          <input class="mv-price" type="text" inputmode="decimal" placeholder="0,00">
        </label>
      </div>`;
    itemsBox.appendChild(r);
    const q = (s) => r.querySelector(s);
    q('.mv-icon').value = ICONS.some((i) => i[0] === d.icon) ? d.icon : '';
    q('.mv-name').value = d.name || '';
    syncRow(r);
    if (d.byKg) { q('.mv-mode').value = 'kg'; syncRow(r); }
    if (d.byKg && Number(d.kg) > 0) {
      const grams = Number(d.kg) < 1;
      q('.mv-unit').value = grams ? 'g' : 'kg';
      q('.mv-wt').value = String(grams ? Math.round(d.kg * 1000) : d.kg).replace('.', ',');
    } else if (d.qty) {
      q('.mv-qty').value = String(d.qty);
    }
    if (Number(d.price) > 0) q('.mv-price').value = fmtInput(String(d.price).replace('.', ','));
    r._orig = d.orig || null;
    r._snap = snap(r);
    return r;
  }

  function reset() {
    chk.checked = false;
    toggleLbl.hidden = false;
    back.hidden = true;
    fields.hidden = true;
    itemsBox.innerHTML = '';
    storeIn.value = '';
    showRecurring(true);
  }

  /* ---------- se prepara cada vez que se abre el modal ---------- */
  function setup() {
    reset();
    const id = form.dataset.editingId;
    if (!id) { box.hidden = true; return; }          // gasto nuevo: no aplica

    const b = bridge();
    const exp = typeof b.updateExpense === 'function' ? findExp(currentMonth(), id) : null;
    if (!exp || String(exp.id).startsWith('rec-')) { box.hidden = true; return; }

    const esChangui = exp.fromChangui || /^changui\b/i.test(String(exp.description || '').trim());
    const tieneDetalle = Array.isArray(exp.detalle) && exp.detalle.length > 0;
    if (esChangui && !tieneDetalle) {      // Changui viejo sin lista de productos: solo se puede sacar de Changui
      toggleLbl.hidden = true;
      back.hidden = false;
      box.hidden = false;
      return;
    }
    back.hidden = !esChangui;

    if (esChangui) {
      lbl.textContent = '🛒 Editar los productos de este Changui';
      hint.textContent = 'Podés cambiar, quitar o agregar productos. El total del gasto es el «Monto» de arriba.';
      const m = String(exp.description || '').match(/^changui\s+en\s+([^(]*?)\s*(\(|$)/i);
      storeIn.value = m ? m[1] : '';
      exp.detalle.forEach((it) => addRow({
        icon: it.icon, name: it.name, byKg: !!it.byKg, qty: it.qty, kg: it.kg,
        price: Number(it.paid) > 0 ? Number(it.paid) : 0, orig: it
      }));
    } else {
      lbl.textContent = '🛒 Pasar este gasto a Changui';
      hint.textContent = 'Este gasto pasa a ser un Changui con los productos que cargues acá. Sigue sumando en el mes, y lo ves en «Detalle» y en el Historial de Changui.';
      addRow({ name: String(exp.description || '').slice(0, 40) });
    }
    renumber();
    box.hidden = false;
  }

  const origShow = HTMLDialogElement.prototype.showModal;
  HTMLDialogElement.prototype.showModal = function (...args) {
    const r = origShow.apply(this, args);
    if (this === dialog) { try { setup(); } catch (e) { console.error('Pasar a Changui:', e); } }
    return r;
  };

  /* ---------- eventos del bloque ---------- */
  chk.addEventListener('change', () => {
    fields.hidden = !chk.checked;
    if (chk.checked) {
      // un gasto de Changui no se repite como recurrente
      const rec = $('expenseRecurring');
      if (rec) rec.checked = false;
      const opts = $('recurringOptions');
      if (opts) opts.classList.add('hidden');
    }
    showRecurring(!chk.checked);
  });

  back.addEventListener('click', async () => {
    const b = bridge();
    const id = form.dataset.editingId;
    const month = currentMonth();
    const exp = id ? findExp(month, id) : null;
    if (!exp || typeof b.updateExpense !== 'function') return;
    if (!confirm('¿Sacar este gasto de Changui? Vuelve a ser un gasto normal, con el mismo monto, y después lo podés pasar de nuevo.')) return;

    const before = { description: exp.description, fromChangui: exp.fromChangui, detalle: exp.detalle };
    const desc = String(exp.description || '');
    const m = desc.match(/\(([^()]*)\)\s*$/);
    exp.description = (m && m[1].trim()) || desc.replace(/^changui\s*(en\s+)?/i, '').trim() || 'Gasto';
    delete exp.fromChangui;
    delete exp.detalle;

    let ok = false;
    try { ok = await b.updateExpense({ month, id, amount: exp.amount }); } catch (err) { ok = false; }
    if (!ok) {
      exp.description = before.description;
      if (before.fromChangui !== undefined) exp.fromChangui = before.fromChangui;
      if (before.detalle !== undefined) exp.detalle = before.detalle;
      alert('No se pudo sacar el gasto de Changui. Probá de nuevo.');
      return;
    }
    dialog.close();
  });

  $('chgMoveAdd').addEventListener('click', () => {
    const r = addRow();
    renumber();
    r.querySelector('.mv-icon').focus();
  });

  itemsBox.addEventListener('change', (e) => {
    const r = e.target.closest('.chg-move-item');
    if (!r) return;
    syncRow(r);
    if (e.target.classList.contains('mv-icon') && r === itemsBox.firstElementChild) {
      // la categoría del gasto acompaña al primer producto (la podés cambiar después)
      const info = ICONS.find((i) => i[0] === e.target.value);
      const cat = $('expenseCategory');
      if (info && cat && [...cat.options].some((o) => o.value === info[3])) cat.value = info[3];
    }
  });

  itemsBox.addEventListener('input', (e) => {
    const r = e.target.closest('.chg-move-item');
    if (!r) return;
    if (e.target.classList.contains('mv-price')) {
      const el = e.target, start = el.selectionStart, prev = el.value.length;
      el.value = fmtInput(el.value);
      const pos = Math.max(0, start + (el.value.length - prev));
      el.setSelectionRange(pos, pos);
    }
    if (e.target.classList.contains('mv-name')) syncRow(r);
  });

  itemsBox.addEventListener('click', (e) => {
    const r = e.target.closest('.chg-move-item');
    if (!r) return;
    if (e.target.closest('.chg-move-rm')) {
      r.remove();
      renumber();
      return;
    }
    if (e.target.closest('.chg-move-split')) {
      const names = r.querySelector('.mv-name').value.split(',').map((x) => x.trim()).filter(Boolean);
      if (names.length < 2) return;
      r.querySelector('.mv-name').value = names[0];
      r.querySelector('.mv-price').value = '';
      r._orig = null;
      syncRow(r);
      names.slice(1).forEach((n) => addRow({ name: n }));
      renumber();
    }
  });

  /* ---------- lee un renglón y arma el producto de Changui ---------- */
  function readRow(r, multi, amount, currency) {
    const q = (s) => r.querySelector(s);
    const icon = q('.mv-icon').value;
    if (!icon) { alert('Elegí el tipo de producto en cada renglón.'); q('.mv-icon').focus(); return null; }

    // Si no tocó nada de un producto que ya existía, se conserva tal cual (con su promo y precio)
    if (r._orig && snap(r) === r._snap && (multi || Math.abs(Number(r._orig.paid) - amount) < 0.005)) {
      return Object.assign({}, r._orig, { cur: currency });
    }

    const label = (ICONS.find((i) => i[0] === icon) || [])[2] || 'Producto';
    const name = (q('.mv-name').value.trim() || label).replace(/[()]/g, '').slice(0, 40);
    const byKg = KG_KEYS.includes(icon) && q('.mv-mode').value === 'kg';
    let qty = 1, kg = 0;
    if (byKg) {
      const w = parseWeight(q('.mv-wt').value);
      kg = Math.round((q('.mv-unit').value === 'g' ? w / 1000 : w) * 1000) / 1000;
      if (!(kg > 0)) { alert('Ingresá el peso comprado de «' + name + '».'); q('.mv-wt').focus(); return null; }
    } else {
      qty = Math.min(99, Math.max(1, parseInt(q('.mv-qty').value, 10) || 1));
    }
    const paid = multi ? round2(parseMoney(q('.mv-price').value)) : round2(amount);
    const price = paid > 0 ? round2(paid / (byKg ? kg : qty)) : 0;
    return { name, icon, cur: currency, price, qty, byKg, kg, promo: { type: 'none' }, paid };
  }

  /* ---------- guardar: el gasto pasa a ser un gasto de Changui ---------- */
  form.addEventListener('submit', async (e) => {
    if (box.hidden || !chk.checked) return;           // flujo normal de la app
    e.preventDefault();
    e.stopImmediatePropagation();

    const b = bridge();
    const id = form.dataset.editingId;
    const month = currentMonth();
    const exp = id ? findExp(month, id) : null;
    if (!exp || typeof b.updateExpense !== 'function') { alert('No pude encontrar el gasto para pasarlo a Changui.'); return; }

    const amount = parseMoney($('expenseAmount') && $('expenseAmount').value);
    if (!(amount > 0)) { alert('El monto tiene que ser mayor a cero.'); return; }
    const currency = ($('expenseCurrency') && $('expenseCurrency').value) === 'USD' ? 'USD' : 'ARS';

    const rs = rows();
    if (!rs.length) { alert('Cargá al menos un producto.'); return; }
    const multi = rs.length > 1;
    const items = [];
    for (const r of rs) {
      const it = readRow(r, multi, amount, currency);
      if (!it) return;
      items.push(it);
    }

    if (multi) {
      const sum = round2(items.reduce((t, x) => t + Number(x.paid || 0), 0));
      const todosConPrecio = items.every((x) => Number(x.paid) > 0);
      const tol = 0.02 + 0.005 * items.length;   // tolera los centavos de redondeo
      if (sum > amount + tol || (todosConPrecio && Math.abs(sum - amount) > tol)) {
        alert('La suma de los precios de los productos (' + sum.toLocaleString('es-AR', { minimumFractionDigits: 2 }) +
          ') no coincide con el monto del gasto (' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }) +
          '). Ajustá los precios o dejá en blanco los que no sepas.');
        return;
      }
    }

    // Se aplican los datos del modal y se marca como gasto de Changui
    const store = storeIn.value.trim().replace(/[()]/g, '').slice(0, 30);
    const before = { date: exp.date, description: exp.description, category: exp.category, currency: exp.currency, fromChangui: exp.fromChangui };
    exp.date = ($('expenseDate') && $('expenseDate').value) || exp.date;
    exp.description = `Changui${store ? ' en ' + store : ''} (${items.map((x) => x.name).join(', ')})`;
    exp.category = ($('expenseCategory') && $('expenseCategory').value) || exp.category;
    exp.currency = currency;
    exp.fromChangui = true;

    let ok = false;
    try { ok = await b.updateExpense({ month, id, amount: round2(amount), detalle: items }); } catch (err) { ok = false; }
    if (!ok) {
      Object.assign(exp, before);
      if (before.fromChangui === undefined) delete exp.fromChangui;
      alert('No se pudo guardar. Probá de nuevo.');
      return;
    }
    dialog.close();
  }, true);   // captura: corre antes que el guardado normal de app.js

  /* ---------- Historial de Changui: editar lugar y fecha de los gastos pasados ---------- */
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const histBox = $('chgHistoryListContainer');
  const histDialog = $('chgHistoryDialog');

  const refreshHistory = () => {
    if (histDialog && histDialog.open) histDialog.close();
    const btn = $('chgHistoryModalBtn');
    if (btn) btn.click();            // vuelve a armar el historial con los datos nuevos
  };

  if (histBox) {
    // Agrega el ✏️ a las tarjetas que vienen de un gasto (las compras guardadas ya tienen el suyo)
    const decorate = () => {
      if (typeof bridge().updateExpense !== 'function') return;
      const month = currentMonth();
      histBox.querySelectorAll('.chg-history-card[data-purchase-id]').forEach((card) => {
        if (card.querySelector('[data-edit-purchase], [data-mv-edit]')) return;
        const id = card.dataset.purchaseId;
        const exp = findExp(month, id);
        if (!exp || !(exp.fromChangui || /^changui\b/i.test(String(exp.description || '')))) return;
        const group = card.querySelector('[data-pdf-purchase]') && card.querySelector('[data-pdf-purchase]').parentElement;
        if (group) group.insertAdjacentHTML('beforeend', `<button class="chg-ico-btn" type="button" data-mv-edit="${esc(id)}" title="Editar">✏️</button>`);
      });
    };
    new MutationObserver(decorate).observe(histBox, { childList: true });
    decorate();

    const fieldCss = 'padding:6px;border-radius:8px;border:1px solid var(--chg-line,var(--line,#f2cfdf));background:transparent;color:inherit;width:100%;box-sizing:border-box;';

    document.addEventListener('click', async (e) => {
      const edit = e.target.closest('[data-mv-edit]');
      if (edit) {
        const id = edit.dataset.mvEdit;
        const exp = findExp(currentMonth(), id);
        const card = edit.closest('.chg-history-card');
        if (!exp || !card) return;
        const m = String(exp.description || '').match(/^changui\s+en\s+([^(]*?)\s*(\(|$)/i);
        card.innerHTML = `
          <div style="display:grid;gap:8px;font-size:.85rem;">
            <strong>✏️ Editando datos del changuito</strong>
            <label style="display:grid;gap:2px;font-size:.75rem;">Supermercado / Local:
              <input class="mv-store" type="text" maxlength="30" value="${esc(m ? m[1] : '')}" style="${fieldCss}">
            </label>
            <label style="display:grid;gap:2px;font-size:.75rem;">Fecha:
              <input class="mv-date" type="date" value="${esc(exp.date || '')}" style="${fieldCss}">
            </label>
            <div style="display:flex;justify-content:flex-end;gap:6px;flex-wrap:wrap;margin-top:4px;">
              <button class="btn btn-outline btn-sm" type="button" data-mv-cancel="1">Cancelar</button>
              <button class="pastel-btn btn-sm" type="button" data-mv-save="${esc(id)}">Guardar</button>
            </div>
          </div>`;
        return;
      }

      if (e.target.closest('[data-mv-cancel]')) { refreshHistory(); return; }

      const save = e.target.closest('[data-mv-save]');
      if (!save) return;
      const card = save.closest('.chg-history-card');
      const id = save.dataset.mvSave;
      const month = currentMonth();
      const exp = findExp(month, id);
      if (!exp || !card) return;

      const newStore = card.querySelector('.mv-store').value.trim().replace(/[()]/g, '').slice(0, 30);
      const newDate = card.querySelector('.mv-date').value || exp.date;
      const before = { date: exp.date, description: exp.description };

      exp.date = newDate;
      const parts = String(exp.description || '').match(/^changui(?:\s+en\s+[^(]*?)?\s*(\([^()]*\))?\s*$/i);
      if (parts) exp.description = `Changui${newStore ? ' en ' + newStore : ''}${parts[1] ? ' ' + parts[1] : ''}`;

      let ok = false;
      try { ok = await bridge().updateExpense({ month, id, amount: exp.amount, detalle: exp.detalle }); } catch (err) { ok = false; }
      if (!ok) {
        Object.assign(exp, before);
        alert('No se pudo guardar el cambio.');
        return;
      }
      refreshHistory();
    });
  }
})();
