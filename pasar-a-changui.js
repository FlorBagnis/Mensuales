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
    @media (max-width:480px){
      .chg-move{padding:10px 12px}
      .chg-move-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(st);

  /* ---------- bloque dentro del modal "Editar gasto" ---------- */
  const box = document.createElement('div');
  box.id = 'chgMoveWrap';
  box.className = 'chg-move';
  box.hidden = true;
  box.innerHTML = `
    <label class="checkbox-label chg-move-toggle">
      <input id="chgMoveChk" type="checkbox">
      <span>🛒 Pasar este gasto a Changui</span>
    </label>
    <div id="chgMoveFields" hidden>
      <p class="chg-move-hint">Este gasto pasa a ser un producto de Changui. Sigue sumando en el mes, y lo ves en “Detalle” y en el Historial de Changui.</p>
      <div class="chg-move-grid">
        <label class="chg-move-full">Tipo de producto
          <select id="chgMoveIcon">
            <option value="" selected disabled>Elegí el tipo…</option>
            ${ICONS.map((i) => `<option value="${i[0]}">${i[1]} ${i[2]}</option>`).join('')}
          </select>
        </label>
        <label class="chg-move-full">Nombre del producto
          <input id="chgMoveName" type="text" maxlength="40" placeholder="Ej. Pollo entero">
        </label>
        <label class="chg-move-full">¿Dónde compraste? (opcional)
          <input id="chgMoveStore" type="text" maxlength="30" placeholder="Ej. Carrefour, Coto, verdulería">
        </label>
        <label>Se compra
          <select id="chgMoveMode">
            <option value="unit" selected>Por unidad</option>
            <option value="kg" disabled>Por kilo</option>
          </select>
        </label>
        <label id="chgMoveQtyWrap">Cantidad
          <input id="chgMoveQty" type="number" min="1" max="99" value="1">
        </label>
        <label id="chgMoveWtWrap" hidden>Peso comprado
          <div class="chg-move-weight">
            <input id="chgMoveWt" type="text" inputmode="decimal" placeholder="Ej. 1,5">
            <select id="chgMoveUnit"><option value="kg" selected>kg</option><option value="g">g</option></select>
          </div>
        </label>
      </div>
    </div>`;
  const recBox = form.querySelector('.recurring-box');
  if (recBox) recBox.before(box); else (form.querySelector('.modal-actions') || form.lastElementChild).before(box);

  const chk = box.querySelector('#chgMoveChk');
  const fields = box.querySelector('#chgMoveFields');
  const selIcon = box.querySelector('#chgMoveIcon');
  const nameIn = box.querySelector('#chgMoveName');
  const storeIn = box.querySelector('#chgMoveStore');
  const selMode = box.querySelector('#chgMoveMode');
  const qtyIn = box.querySelector('#chgMoveQty');
  const wtIn = box.querySelector('#chgMoveWt');
  const wtUnit = box.querySelector('#chgMoveUnit');

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
    let s = String(v || '').trim().replace(/\s/g, '');
    if (!s) return 0;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = parseFloat(s);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };

  function showRecurring(show) {
    if (recBox) recBox.style.display = show ? '' : 'none';
  }

  function syncMode() {
    const eligible = KG_KEYS.includes(selIcon.value);
    const kgOpt = selMode.querySelector('option[value="kg"]');
    if (kgOpt) kgOpt.disabled = !eligible;
    if (!eligible && selMode.value === 'kg') selMode.value = 'unit';
    const kg = selMode.value === 'kg';
    box.querySelector('#chgMoveQtyWrap').hidden = kg;
    box.querySelector('#chgMoveWtWrap').hidden = !kg;
  }

  function reset() {
    chk.checked = false;
    fields.hidden = true;
    selIcon.value = '';
    storeIn.value = '';
    selMode.value = 'unit';
    qtyIn.value = '1';
    wtIn.value = '';
    wtUnit.value = 'kg';
    syncMode();
    showRecurring(true);
  }

  /* ---------- se prepara cada vez que se abre el modal ---------- */
  function setup() {
    reset();
    const id = form.dataset.editingId;
    if (!id) { box.hidden = true; return; }          // gasto nuevo: no aplica

    const b = bridge();
    const exp = typeof b.updateExpense === 'function' ? findExp(currentMonth(), id) : null;
    const yaEsChangui = exp && (exp.fromChangui || /^changui\b/i.test(String(exp.description || '').trim()));
    const esRecurrente = exp && String(exp.id).startsWith('rec-');
    if (!exp || yaEsChangui || esRecurrente) { box.hidden = true; return; }

    nameIn.value = String(exp.description || '').slice(0, 40);
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
      // un gasto que pasa a Changui no se repite como recurrente
      const rec = $('expenseRecurring');
      if (rec) rec.checked = false;
      const opts = $('recurringOptions');
      if (opts) opts.classList.add('hidden');
    }
    showRecurring(!chk.checked);
  });

  selIcon.addEventListener('change', () => {
    syncMode();
    // la categoría del gasto acompaña al tipo de producto (la podés cambiar después)
    const info = ICONS.find((i) => i[0] === selIcon.value);
    const cat = $('expenseCategory');
    if (info && cat && [...cat.options].some((o) => o.value === info[3])) cat.value = info[3];
  });
  selMode.addEventListener('change', syncMode);

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

    const key = selIcon.value;
    if (!key) { alert('Elegí el tipo de producto de Changui.'); selIcon.focus(); return; }

    const amount = parseMoney($('expenseAmount') && $('expenseAmount').value);
    if (!(amount > 0)) { alert('El monto tiene que ser mayor a cero.'); return; }
    const currency = ($('expenseCurrency') && $('expenseCurrency').value) === 'USD' ? 'USD' : 'ARS';

    const byKg = KG_KEYS.includes(key) && selMode.value === 'kg';
    let qty = 1, kg = 0, price = round2(amount);
    if (byKg) {
      const w = parseWeight(wtIn.value);
      kg = Math.round((wtUnit.value === 'g' ? w / 1000 : w) * 1000) / 1000;
      if (!(kg > 0)) { alert('Ingresá el peso comprado.'); wtIn.focus(); return; }
      price = round2(amount / kg);
    } else {
      qty = Math.min(99, Math.max(1, parseInt(qtyIn.value, 10) || 1));
      price = round2(amount / qty);
    }

    const name = (nameIn.value.trim() || ($('expenseDescription') && $('expenseDescription').value.trim()) || 'Producto')
      .replace(/[()]/g, '').slice(0, 40);
    const item = { name, icon: key, cur: currency, price, qty, byKg, kg, promo: { type: 'none' }, paid: round2(amount) };

    // Se aplican los datos del modal y se marca como gasto de Changui
    const before = { date: exp.date, description: exp.description, category: exp.category, currency: exp.currency, fromChangui: exp.fromChangui };
    exp.date = ($('expenseDate') && $('expenseDate').value) || exp.date;
    const store = storeIn.value.trim().replace(/[()]/g, '').slice(0, 30);
    exp.description = `Changui${store ? ' en ' + store : ''} (${name})`;
    exp.category = ($('expenseCategory') && $('expenseCategory').value) || exp.category;
    exp.currency = currency;
    exp.fromChangui = true;

    let ok = false;
    try { ok = await b.updateExpense({ month, id, amount: round2(amount), detalle: [item] }); } catch (err) { ok = false; }
    if (!ok) {
      Object.assign(exp, before);
      if (before.fromChangui === undefined) delete exp.fromChangui;
      alert('No se pudo pasar el gasto a Changui. Probá de nuevo.');
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
