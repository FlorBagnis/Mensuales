/* =========================================================
   PASAR UN GASTO A CHANGUI · extra para Mensuales
   - Al EDITAR un gasto del mes, lo convertís en producto de Changui
   - Al CREAR un gasto nuevo también podés marcarlo como Changui
   - Si le sacás "Changui" a la descripción, vuelve a aparecer la opción
   No toca app.js ni changui.js.
   Creado by Flor Bagnis 💗

   v2: sin bucles de refresco (ya no reescribe #userEmail ni el historial local en cada cambio),
       "Chango nuevo" no duplica un chango que ya está en el Historial,
       peso en gramos tipeado como kg (310 → 310 g) también acá.
========================================================= */
(() => {
  'use strict';

  const form = document.getElementById('expenseForm');
  const dialog = document.getElementById('expenseDialog');
  if (!form || !dialog) { console.warn('Pasar a Changui: no encontré #expenseForm o #expenseDialog'); return; }
  const $ = (id) => document.getElementById(id);
  console.log('Pasar a Changui: script cargado ✔');

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
    .chg-move-lbl{font-size:.8rem;font-weight:700;margin:0 0 6px}
    .chg-move-picked{display:flex;align-items:center;gap:10px;flex-wrap:wrap;font-weight:700;font-size:.9rem}
    .chg-move-chg{background:transparent;border:1px dashed var(--pink-700,#c43878);color:var(--pink-700,#c43878);
      border-radius:10px;padding:3px 10px;font-size:.72rem;font-weight:700;cursor:pointer}
    .chg-move-icons{display:grid;grid-template-columns:repeat(auto-fill,minmax(66px,1fr));gap:6px;
      max-height:210px;overflow-y:auto;padding:2px}
    .chg-move-ico{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
      padding:6px 2px;min-height:54px;border-radius:12px;cursor:pointer;color:inherit;font:inherit;
      border:1px solid var(--line,#f2cfdf);background:var(--card,transparent);transition:transform .15s,border-color .15s,background .15s}
    .chg-move-ico .e{font-size:1.25rem;line-height:1}
    .chg-move-ico .n{font-size:.58rem;line-height:1.1;text-align:center;word-break:break-word}
    .chg-move-ico:hover{transform:scale(1.06);border-color:var(--pink-700,#c43878)}
    .chg-move-ico.sel{border:2px solid var(--pink-700,#c43878);background:var(--pill-bg,rgba(251,196,212,.3));font-weight:700}
    @media (max-width:480px){
      .chg-move{padding:10px 12px}
      .chg-move-icons{grid-template-columns:repeat(auto-fill,minmax(60px,1fr))}
      .chg-move-grid{grid-template-columns:1fr}
    }
  `;
  document.head.appendChild(st);

  /* ---------- bloque dentro del modal "Editar gasto" / "Nuevo gasto" ---------- */
  const iconOpts = ICONS.map((i) => `<option value="${i[0]}">${i[1]} ${i[2]}</option>`).join('');
  const iconBtns = ICONS.map((i) =>
    `<button type="button" class="chg-move-ico" data-k="${i[0]}" title="${i[2]}"><span class="e">${i[1]}</span><span class="n">${i[2]}</span></button>`).join('');
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
    <p class="chg-move-hint" id="chgMoveNote" hidden></p>
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
  const note = box.querySelector('#chgMoveNote');
  const storeIn = box.querySelector('#chgMoveStore');
  const itemsBox = box.querySelector('#chgMoveItems');

  /* ---------- utilidades ---------- */
  const bridge = () => window.ChanguiBridge || {};
  const currentMonth = () => (bridge().getCurrentMonth && bridge().getCurrentMonth()) || ($('monthPicker') && $('monthPicker').value) || '';
  const monthExpenses = (month) => (bridge().getMonthExpenses && bridge().getMonthExpenses(month)) || [];
  const findExp = (month, id) => monthExpenses(month).find((x) => x.id === id);
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
  // En "g" se divide por 1000; en "kg", un número >= 100 se toma como gramos (310 → 0,31 kg). Igual que en Changui.
  const toKg = (w, unit) => (unit === 'g' || (unit === 'kg' && w >= 100) ? w / 1000 : w);
  const fmtInput = (v) => {
    let c = String(v == null ? '' : v).replace(/[^\d,]/g, '');
    const p = c.split(',');
    if (p.length > 2) c = p[0] + ',' + p.slice(1).join('');
    const [i, d] = c.split(',');
    const w = (i || '').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return d !== undefined ? `${w},${d.slice(0, 2)}` : w;
  };

  // Avisa a Changui y a app.js que algo cambió (sin reescribir #userEmail ni el historial local:
  // eso hacía que Changui se recargara en bucle y cerraba los editores).
  // El historial y los resúmenes de Changui se arman solos desde Gastos del mes.
  const syncLocal = (oldDesc, newDesc, date, detalle, amount, expId, isRemoved = false) => {
    try {
      // Si el gasto dejó de ser de Changui (o se borró), se saca de las compras guardadas
      if (isRemoved && typeof window.__changuiForget === 'function') {
        window.__changuiForget(expId, oldDesc, date);
      }
      if (typeof window.__changuiRefresh === 'function') window.__changuiRefresh();

      // Refrescar gráficos (#categoryChart) y análisis (#trendText) de app.js
      window.dispatchEvent(new CustomEvent('mensuales:refresh'));
      window.dispatchEvent(new CustomEvent('changui:refresh'));
      const mp = $('monthPicker');
      if (mp) mp.dispatchEvent(new Event('change', { bubbles: true }));
    } catch (err) {
      console.warn('Pasar a Changui: no se pudo sincronizar el historial/análisis', err);
    }
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

  // Adivina el ícono según el nombre del producto (se puede cambiar)
  const norm = (t) => String(t || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const GUESS = [
    ['snacks', /papas fritas|snack|galletita|chocolate|alfajor|golosina|helado/],
    ['verdura', /zanahoria|espinaca|zapallo|zapallito|lechuga|tomate|\bpapas?\b|cebolla|acelga|morron|calabaza|brocoli|\bajo\b|pepino|verdura|berenjena|choclo|rucula|puerro|remolacha|batata/],
    ['fruta', /manzana|banana|naranja|limon|\bperas?\b|frutilla|\buvas?\b|mandarina|durazno|anana|sandia|melon|kiwi|fruta|palta/],
    ['huevos', /huevo/],
    ['pollo', /pollo|pechuga|muslo/],
    ['carne', /carne|asado|bife|milanesa|picada|vacio|cerdo|chorizo|hamburguesa|matambre/],
    ['pescado', /pescado|merluza|atun|salmon|surubi|camaron/],
    ['queso', /queso|fiambre|jamon|salame|mortadela|muzzarella|mozzarella/],
    ['leche', /leche|yogur|crema|manteca|ricota/],
    ['pan', /\bpan\b|factura|medialuna|tostada|prepizza/],
    ['agua', /agua|bidon|soda/],
    ['bebidas', /gaseosa|cerveza|vino|jugo|bebida|fernet|energizante/],
    ['limpieza', /lavandina|detergente|limpieza|limpiador|esponja|desinfectante|suavizante|trapo/],
    ['higiene', /papel higienico|shampoo|champu|jabon|desodorante|pasta dental|cepillo|toallita|panal|higiene/],
    ['mascotas', /perro|gato|mascota|balanceado/],
    ['almacen', /arroz|fideos|harina|aceite|azucar|\bsal\b|yerba|cafe|lenteja|polenta|salsa|conserva|almacen|pure/]
  ];
  const guessIcon = (name) => { const n = norm(name); const g = GUESS.find((x) => x[1].test(n)); return g ? g[0] : ''; };

  // "Verdulería (Zanahoria, Espinaca, zapallitos)" -> lugar + un producto por cada nombre
  function parseDescription(desc) {
    const d = String(desc || '').replace(/^🔄\s*/, '').trim();
    const m = d.match(/^(.*?)\s*\(([^()]*)\)\s*$/);
    const store = m ? m[1].trim().slice(0, 30) : '';
    const list = m ? m[2] : d;
    const names = list.split(/[,;]/).map((x) => x.replace(/[()]/g, '').trim().slice(0, 40)).filter(Boolean);
    return { store, names };
  }

  function markIcon(r) {
    const v = r.querySelector('.mv-icon').value;
    const info = ICONS.find((i) => i[0] === v);
    r.querySelectorAll('.chg-move-ico').forEach((b) => b.classList.toggle('sel', b.dataset.k === v));
    r.querySelector('.chg-move-icons').hidden = !!info;
    r.querySelector('.chg-move-picked').hidden = !info;
    if (info) r.querySelector('.chg-move-pk').textContent = info[1] + ' ' + info[2];
  }

  function addRow(d = {}) {
    const r = document.createElement('div');
    r.className = 'chg-move-item';
    r.innerHTML = `
      <div class="chg-move-item-head"><strong class="chg-move-num"></strong><button type="button" class="chg-move-rm" title="Quitar este producto">✖</button></div>
      <div class="chg-move-grid">
        <div class="chg-move-full">
          <div class="chg-move-lbl">Elegí el producto</div>
          <div class="chg-move-picked" hidden><span class="chg-move-pk"></span><button type="button" class="chg-move-chg">Cambiar producto</button></div>
          <div class="chg-move-icons">${iconBtns}</div>
          <select class="mv-icon" hidden><option value="" disabled selected>Elegí el tipo…</option>${iconOpts}</select>
        </div>
        <label class="chg-move-full">Nombre del producto
          <input class="mv-name" type="text" maxlength="40" placeholder="Ej. Pollo entero">
        </label>
        <div class="chg-move-full"><button type="button" class="chg-move-split mv-split" hidden>✂️ Separar por comas en varios productos</button></div>
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
    markIcon(r);
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
    note.hidden = true;
    note.textContent = '';
    itemsBox.innerHTML = '';
    storeIn.value = '';
    showRecurring(true);
  }

  /* ---------- se prepara cada vez que se abre el modal ---------- */
  function setup() {
    reset();
    const id = form.dataset.editingId;
    const b = bridge();

    const unavailable = (msg) => {
      console.warn('Pasar a Changui:', msg);
      toggleLbl.hidden = true;
      note.textContent = '⚠️ ' + msg;
      note.hidden = false;
      box.hidden = false;
    };

    if (typeof b.updateExpense !== 'function' || typeof b.getMonthExpenses !== 'function') {
      unavailable('Pasar a Changui no está disponible: falta conectar ChanguiBridge (updateExpense / getMonthExpenses).');
      return;
    }

    // ----- GASTO NUEVO: se puede cargar directamente como Changui -----
    if (!id) {
      lbl.textContent = '🛒 Cargar este gasto como Changui';
      hint.textContent = 'Este gasto se guarda como un Changui con los productos que cargues acá. Suma en el mes y lo ves en «Detalle» y en el Historial de Changui. Podés cargar varios productos con «➕ Agregar otro producto».';
      addRow({});
      renumber();
      box.hidden = false;
      return;
    }

    // ----- GASTO EXISTENTE -----
    const exp = findExp(currentMonth(), id);
    if (exp && String(exp.id).startsWith('rec-')) { box.hidden = true; return; }   // las cuotas recurrentes no se pasan
    if (!exp) {
      unavailable('No encontré este gasto en el mes ' + currentMonth() + '.');
      return;
    }

    // Es Changui solo si la descripción empieza con «Changui» (igual que la tabla). Si se la sacaste, vuelve a aparecer el tilde.
    const esChangui = /^changui\b/i.test(String(exp.description || '').trim());
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
      hint.textContent = 'Este gasto pasa a ser un Changui con los productos que cargues acá. Sigue sumando en el mes, y lo ves en «Detalle» y en el Historial de Changui. Podés cargar varios productos con «➕ Agregar otro producto».';
      if (Array.isArray(exp.detalle) && exp.detalle.length) {
        // el gasto ya estuvo en Changui: se recuperan sus productos y el local
        const sm = String(exp.description || '').match(/^(.*?)\s*\(/);
        storeIn.value = sm ? sm[1].trim().slice(0, 30) : '';
        exp.detalle.forEach((it) => addRow({
          icon: it.icon, name: it.name, byKg: !!it.byKg, qty: it.qty, kg: it.kg,
          price: Number(it.paid) > 0 ? Number(it.paid) : 0, orig: it
        }));
      } else {
        const parsed = parseDescription(exp.description);
        if (parsed.store) storeIn.value = parsed.store;
        if (parsed.names.length) parsed.names.forEach((n) => addRow({ name: n, icon: guessIcon(n) }));
        else addRow({ name: String(exp.description || '').slice(0, 40) });
      }
    }
    renumber();
    box.hidden = false;
  }

  const runSetup = () => { try { setup(); } catch (e) { console.error('Pasar a Changui:', e); } };

  // Se detecta la apertura del modal (con showModal o show) mirando el atributo "open".
  // Se corre otra vez enseguida por si app.js completa el formulario un instante después de abrirlo.
  let wasOpen = dialog.open;
  new MutationObserver(() => {
    if (dialog.open && !wasOpen) {
      runSetup();
      setTimeout(() => { if (dialog.open && !chk.checked) runSetup(); }, 60);
    }
    wasOpen = dialog.open;
  }).observe(dialog, { attributes: true, attributeFilter: ['open'] });

  /* ---------- eventos del bloque ---------- */
  // ✅ RECUPERADO: muestra/oculta los campos de productos al tildar el checkbox
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
    try {
      ok = await b.updateExpense({
        month,
        id,
        amount: exp.amount,
        category: exp.category,
        description: exp.description,
        date: exp.date
      });
    } catch (err) { ok = false; }
    if (!ok) {
      exp.description = before.description;
      if (before.fromChangui !== undefined) exp.fromChangui = before.fromChangui;
      if (before.detalle !== undefined) exp.detalle = before.detalle;
      alert('No se pudo sacar el gasto de Changui. Probá de nuevo.');
      return;
    }

    // Quita la compra del análisis/historial de Changui y refresca gráficos de Mensuales
    syncLocal(before.description, exp.description, exp.date, [], exp.amount, id, true);
    dialog.close();
  });

  $('chgMoveAdd').addEventListener('click', () => {
    const r = addRow();
    renumber();
    r.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });

  itemsBox.addEventListener('change', (e) => {
    const r = e.target.closest('.chg-move-item');
    if (!r) return;
    syncRow(r);
    if (e.target.classList.contains('mv-icon')) markIcon(r);
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
    if (e.target.closest('.chg-move-chg')) {
      r.querySelector('.chg-move-icons').hidden = false;
      r.querySelector('.chg-move-picked').hidden = true;
      return;
    }
    const ico = e.target.closest('.chg-move-ico');
    if (ico) {
      const sel = r.querySelector('.mv-icon');
      sel.value = ico.dataset.k;
      sel.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
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
    if (!icon) { alert('Elegí el producto en cada renglón.'); q('.chg-move-icons').scrollIntoView({ block: 'center' }); return null; }

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
      kg = Math.round(toKg(w, q('.mv-unit').value) * 1000) / 1000;
      if (!(kg > 0)) { alert('Ingresá el peso comprado de «' + name + '».'); q('.mv-wt').focus(); return null; }
    } else {
      qty = Math.min(99, Math.max(1, parseInt(q('.mv-qty').value, 10) || 1));
    }
    const paid = multi ? round2(parseMoney(q('.mv-price').value)) : round2(amount);
    const price = paid > 0 ? round2(paid / (byKg ? kg : qty)) : 0;
    return { name, icon, cur: currency, price, qty, byKg, kg, promo: { type: 'none' }, paid };
  }

  /* ---------- gasto NUEVO: después del guardado normal, se le agregan los productos ---------- */
  function attachToNewExpense(info) {
    let tries = 0;
    const timer = setInterval(async () => {
      tries++;
      const months = [...new Set([info.month, currentMonth()].filter(Boolean))];
      let found = null, foundMonth = '';
      for (const mo of months) {
        const list = monthExpenses(mo);
        for (let i = list.length - 1; i >= 0; i--) {
          const x = list[i];
          if (x.description === info.desc && !x.detalle && Math.abs(Number(x.amount) - info.amount) < 0.01) {
            found = x; foundMonth = mo; break;
          }
        }
        if (found) break;
      }
      if (found) {
        clearInterval(timer);
        found.fromChangui = true;
        let ok = false;
        try {
          ok = await bridge().updateExpense({
            month: foundMonth,
            id: found.id,
            amount: round2(found.amount),
            category: found.category,
            description: found.description,
            date: found.date,
            detalle: info.items
          });
        } catch (err) { ok = false; }
        if (!ok) {
          delete found.fromChangui;
          alert('El gasto se guardó, pero no pude cargarle los productos de Changui. Editalo y probá de nuevo.');
        } else {
          // Sincroniza el gasto nuevo con el gráfico y el análisis de Changui
          syncLocal(found.description, found.description, found.date, info.items, round2(found.amount), found.id, false);
        }
      } else if (tries >= 25) {
        clearInterval(timer);
        console.warn('Pasar a Changui: no encontré el gasto nuevo para agregarle los productos.');
      }
    }, 200);
  }

  /* ---------- guardar ---------- */
  form.addEventListener('submit', async (e) => {
    if (box.hidden || !chk.checked) {                  // flujo normal de la app
      // si le sacaste «Changui» a la descripción, se limpian las marcas viejas (PDF, resúmenes)
      const id0 = form.dataset.editingId;
      const e0 = id0 ? findExp(currentMonth(), id0) : null;
      const d0 = String(($('expenseDescription') && $('expenseDescription').value) || '').trim();
      if (e0 && (e0.fromChangui || e0.detalle) && !/^changui\b/i.test(d0)) {
        const oldD = e0.description;
        delete e0.fromChangui;
        delete e0.detalle;
        syncLocal(oldD, d0, e0.date, [], e0.amount, id0, true);
      }
      return;
    }
    const stop = () => { e.preventDefault(); e.stopImmediatePropagation(); };

    const b = bridge();
    const id = form.dataset.editingId;
    const isNew = !id;
    const month = currentMonth();
    const exp = id ? findExp(month, id) : null;
    if (!isNew && (!exp || typeof b.updateExpense !== 'function')) { stop(); alert('No pude encontrar el gasto para pasarlo a Changui.'); return; }

    const amount = parseMoney($('expenseAmount') && $('expenseAmount').value);
    if (!(amount > 0)) { stop(); alert('El monto tiene que ser mayor a cero.'); return; }
    const currency = ($('expenseCurrency') && $('expenseCurrency').value) === 'USD' ? 'USD' : 'ARS';

    const rs = rows();
    if (!rs.length) { stop(); alert('Cargá al menos un producto.'); return; }
    const multi = rs.length > 1;
    const items = [];
    for (const r of rs) {
      const it = readRow(r, multi, amount, currency);
      if (!it) { stop(); return; }
      items.push(it);
    }

    if (multi) {
      const sum = round2(items.reduce((t, x) => t + Number(x.paid || 0), 0));
      const todosConPrecio = items.every((x) => Number(x.paid) > 0);
      const tol = 0.02 + 0.005 * items.length;   // tolera los centavos de redondeo
      if (sum > amount + tol || (todosConPrecio && Math.abs(sum - amount) > tol)) {
        stop();
        alert('La suma de los precios de los productos (' + sum.toLocaleString('es-AR', { minimumFractionDigits: 2 }) +
          ') no coincide con el monto del gasto (' + amount.toLocaleString('es-AR', { minimumFractionDigits: 2 }) +
          '). Ajustá los precios o dejá en blanco los que no sepas.');
        return;
      }
    }

    const store = storeIn.value.trim().replace(/[()]/g, '').slice(0, 30);
    const newDesc = `Changui${store ? ' en ' + store : ''} (${items.map((x) => x.name).join(', ')})`;

    // ----- GASTO NUEVO: se deja que la app lo guarde normal y después se le agregan los productos -----
    if (isNew) {
      const descEl = $('expenseDescription');
      if (descEl) descEl.value = newDesc;
      // mismo mes que usa app.js para guardar: «Imputar al mes» (o el mes de la fecha)
      const tm = ($('expenseTargetMonth') &&$('expenseTargetMonth').value) ||
        String(($('expenseDate') &&$('expenseDate').value) || '').slice(0, 7) || month;
      attachToNewExpense({ desc: newDesc, amount: round2(amount), items, month: tm });
      return;                                          // sigue el guardado normal de app.js
    }

    // ----- GASTO EXISTENTE: se aplican los datos del modal y se marca como gasto de Changui -----
    stop();
    const before = { date: exp.date, description: exp.description, category: exp.category, currency: exp.currency, fromChangui: exp.fromChangui };
    exp.date = ($('expenseDate') &&$('expenseDate').value) || exp.date;
    exp.description = newDesc;
    exp.category = ($('expenseCategory') &&$('expenseCategory').value) || exp.category;
    exp.currency = currency;
    exp.fromChangui = true;

    let ok = false;
    try {
      ok = await b.updateExpense({
        month,
        id,
        amount: round2(amount),
        category: exp.category,
        description: exp.description,
        date: exp.date,
        detalle: items
      });
    } catch (err) { ok = false; }
    if (!ok) {
      Object.assign(exp, before);
      if (before.fromChangui === undefined) delete exp.fromChangui;
      alert('No se pudo guardar. Probá de nuevo.');
      return;
    }
    syncLocal(before.description, exp.description, exp.date, items, round2(amount), id, false);
    dialog.close();
  }, true);   // captura: corre antes que el guardado normal de app.js

  /* ---------- Botones visibles en «Gastos del mes» ---------- */
  // Al abrir el modal desde estos botones, el bloque de Changui queda tildado y desplegado
  const openChecked = () => setTimeout(() => {
    if (box.hidden || toggleLbl.hidden || chk.checked) return;
    chk.checked = true;
    chk.dispatchEvent(new Event('change', { bubbles: true }));
    box.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, 15);

  // 1) 🛒 en cada fila de la tabla (ahora es un SVG que toma el color del tema, igual que ✏️ y ✖)
  const expTable = $('expenseTable');
  if (expTable) {
    const decorateRows = () => {
      expTable.querySelectorAll('tr').forEach((tr) => {
        if (tr.querySelector('.chg-mv-row')) return;
        const edit = tr.querySelector('.edit-btn:not(.chg-mv-row)');
        if (!edit) return;
        const id = edit.dataset.id;
        if (String(id).startsWith('rec-')) return;      // cuotas recurrentes: no aplica
        const exp = findExp(currentMonth(), id);
        const esChg = !!exp && /^changui\b/i.test(String(exp.description || '').trim());
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chg-mv-row pastel-btn btn-sm edit-btn cart-btn';
        b.title = esChg ? 'Editar productos de Changui' : 'Pasar a Changui';
        b.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><circle cx="9" cy="20" r="1.5"/><circle cx="18" cy="20" r="1.5"/><path d="M2 3h3l2.7 12.4a2 2 0 0 0 2 1.6h7.6a2 2 0 0 0 2-1.5L21 8H6"/></svg>';
        edit.before(b);
      });
    };
    new MutationObserver(decorateRows).observe(expTable, { childList: true });
    decorateRows();

    expTable.addEventListener('click', (e) => {
      const b = e.target.closest('.chg-mv-row');
      if (!b) return;
      const edit = b.closest('tr').querySelector('.edit-btn:not(.chg-mv-row)');
      if (!edit) return;
      edit.click();          // abre el modal de editar gasto (lo maneja app.js)
      openChecked();
    });
  }

  // 2) 🛒 «Nuevo gasto Changui» al lado de «+ Nuevo gasto»
  const addBtn = $('addExpenseBtn');
  if (addBtn && !$('chgMoveNewBtn')) {
    const nb = document.createElement('button');
    nb.id = 'chgMoveNewBtn';
    nb.type = 'button';
    nb.className = 'btn btn-outline';
    nb.textContent = '🛒 Nuevo gasto Changui';
    nb.addEventListener('click', () => { addBtn.click(); openChecked(); });
    addBtn.after(nb);
  }

  /* ---------- Historial de Changui: editar lugar y fecha de los gastos pasados ---------- */
  const esc = (v) => String(v).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const histBox = $('chgHistoryListContainer');
  const histDialog = $('chgHistoryDialog');

  const refreshHistory = () => {
    if (histDialog && histDialog.open) histDialog.close();
    const btn = $('chgHistoryModalBtn');
    if (btn) btn.click();             // vuelve a armar el historial con los datos nuevos
  };

  if (histBox) {
    // Agrega el ✏️ a las tarjetas que vienen de un gasto (las compras guardadas ya tienen el suyo)
    const decorate = () => {
      if (typeof bridge().updateExpense !== 'function') return;
      const month = currentMonth();
      histBox.querySelectorAll('.chg-history-card[data-purchase-id]').forEach((card) => {
        const id = card.dataset.purchaseId;
        const exp = findExp(month, id);
        if (!exp || !(exp.fromChangui || /^changui\b/i.test(String(exp.description || '')))) return;
        const group = card.querySelector('[data-pdf-purchase]') && card.querySelector('[data-pdf-purchase]').parentElement;
        if (!group) return;
        if (!card.querySelector('[data-edit-purchase], [data-mv-edit]')) {
          group.insertAdjacentHTML('beforeend', `<button class="chg-ico-btn" type="button" data-mv-edit="${esc(id)}" title="Editar">✏️</button>`);
        }
        if (!card.querySelector('[data-del-purchase], [data-mv-del], [title="Eliminar"], [title="Borrar"]')) {
          group.insertAdjacentHTML('beforeend', `<button class="chg-ico-btn" type="button" data-mv-del="${esc(id)}" title="Eliminar">🗑️</button>`);
        }
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
              <button class="btn btn-outline btn-sm" type="button" data-mv-products="${esc(id)}">🛒 Editar productos</button>
              <button class="btn btn-outline btn-sm" type="button" data-mv-cancel="1">Cancelar</button>
              <button class="pastel-btn btn-sm" type="button" data-mv-save="${esc(id)}">Guardar</button>
            </div>
          </div>`;
        return;
      }

      if (e.target.closest('[data-mv-cancel]')) { refreshHistory(); return; }

      // 🛒 Editar productos: abre el editor del gasto con los productos desplegados
      const prod = e.target.closest('[data-mv-products]');
      if (prod) {
        const editBtn = document.querySelector(`#expenseTable .edit-btn[data-id="${CSS.escape(prod.dataset.mvProducts)}"]`);
        if (!editBtn) { alert('No encuentro este gasto en «Gastos del mes». Sacá la búsqueda o el filtro de categoría y probá de nuevo.'); return; }
        if (histDialog && histDialog.open) histDialog.close();
        editBtn.click();
        openChecked();
        return;
      }

      // 🗑️ Eliminar: usa el mismo borrado (con confirmación) de «Gastos del mes»
      const del = e.target.closest('[data-mv-del]');
      if (del) {
        const delId = del.dataset.mvDel;
        const expToDel = findExp(currentMonth(), delId);
        const delBtn = document.querySelector(`#expenseTable .delete-btn[data-id="${CSS.escape(delId)}"]`);
        if (!delBtn) { alert('No encuentro este gasto en «Gastos del mes». Sacá la búsqueda o el filtro de categoría y probá de nuevo.'); return; }
        delBtn.click();
        setTimeout(() => {
          // Si efectivamente se borró de los gastos del mes, lo sacamos también del análisis de Changui
          if (!findExp(currentMonth(), delId) && expToDel) {
            syncLocal(expToDel.description, expToDel.description, expToDel.date, [], expToDel.amount, delId, true);
          }
          refreshHistory();
        }, 500);
        return;
      }

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
      try {
        ok = await bridge().updateExpense({
          month,
          id,
          amount: exp.amount,
          category: exp.category,
          description: exp.description,
          date: exp.date,
          detalle: exp.detalle
        });
      } catch (err) { ok = false; }
      if (!ok) {
        Object.assign(exp, before);
        alert('No se pudo guardar el cambio.');
        return;
      }
      syncLocal(before.description, exp.description, exp.date, exp.detalle, exp.amount, id, false);
      refreshHistory();
    });
  }

  /* ---------- 🛒 Chango nuevo: guarda el chango actual en el Historial y abre uno vacío ---------- */
  /* Nada se borra: el chango actual pasa al Historial (botón "📂 Ver" para volver a abrirlo).      */
  /* Si el chango ya estaba en el Historial (lo abriste con "📂 Ver"), NO se vuelve a guardar.      */
  /* "Vaciar" sigue siendo la opción para borrar todo sin guardar.                                   */
  const clearBtn = $('chgClearBtn');
  if (clearBtn && !$('chgNewBtn')) {
    const nb = document.createElement('button');
    nb.id = 'chgNewBtn';
    nb.type = 'button';
    nb.className = 'btn btn-outline btn-sm';
    nb.textContent = '🛒 Chango nuevo';
    nb.title = 'Guarda este chango en el Historial y abre uno nuevo en cero';

    const wrap = document.createElement('div');
    wrap.style.cssText = 'display:flex;align-items:center;gap:8px;flex-wrap:wrap;justify-content:flex-end;';
    clearBtn.before(wrap);
    wrap.appendChild(nb);
    wrap.appendChild(clearBtn);

    const say = (text) => {
      let t = document.getElementById('chgNewToast');
      if (!t) {
        t = document.createElement('div');
        t.id = 'chgNewToast';
        t.className = 'chg-toast';
        t.setAttribute('role', 'status');
        document.body.appendChild(t);
      }
      t.textContent = text;
      t.classList.add('show');
      clearTimeout(t._tm);
      t._tm = setTimeout(() => t.classList.remove('show'), 4500);
    };

    // Mismo cálculo que usa Changui para cada producto
    const paidOf = (it, general) => {
      const p = it.promo || { type: 'none' };
      const price = Number(it.price) || 0, qty = Number(it.qty) || 1;
      let paid;
      if (it.byKg) {
        const base = price * (Number(it.kg) || 0);
        paid = p.type === 'pct' ? base * (1 - p.value / 100) : base;
      } else if (p.type === 'pct') paid = price * qty * (1 - p.value / 100);
      else if (p.type === '2x1') paid = price * Math.ceil(qty / 2);
      else if (p.type === 'second') {
        const pairs = Math.floor(qty / 2);
        paid = price * (qty - pairs) + price * pairs * (1 - p.value / 100);
      } else paid = price * qty;
      return round2(paid * (1 - general / 100));
    };

    nb.addEventListener('click', () => {
      const emailEl = $('userEmail');
      const email = ((emailEl && emailEl.textContent) || '').trim().toLowerCase();
      const key = 'changui_v1_' + (email || 'anon');
      let st = null;
      try { st = JSON.parse(localStorage.getItem(key) || 'null'); } catch (err) { st = null; }

      if (!st || !Array.isArray(st.items) || !st.items.length) {
        say('Tu changuito ya está vacío: podés empezar uno nuevo. 🛒');
        return;
      }

      // ¿Es un chango que abriste desde el Historial?
      const lf = st.loadedFrom && typeof st.loadedFrom === 'object' ? st.loadedFrom : null;
      const yaRegistrado = !!(lf && !lf.draft && Array.isArray(lf.expIds) && lf.expIds.length);

      const pregunta = yaRegistrado
        ? 'Este chango ya está guardado en el Historial. ¿Empezar uno nuevo? Si cambiaste algo y no lo registraste, esos cambios se pierden.'
        : '¿Empezar un chango nuevo? El actual se guarda en el Historial (📜), no se borra nada.';
      if (!confirm(pregunta)) return;

      if (!Array.isArray(st.purchases)) st.purchases = [];

      if (!yaRegistrado) {
        const general = Math.min(100, Math.max(0, Number(st.general) || 0));
        const mode = ($('chgDeliveryMode') &&$('chgDeliveryMode').value) || 'presencial';
        const cost = mode === 'envio' ? parseMoney($('chgDeliveryCost') &&$('chgDeliveryCost').value) : 0;
        const hoy = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(new Date());

        // Si venía de un borrador, se actualiza ese borrador en vez de crear otro
        if (lf && lf.draft) st.purchases = st.purchases.filter((p) => p.id !== lf.id);

        st.purchases.unshift({
          id: Date.now().toString(36) + Math.random().toString(36).slice(2, 7),
          date: hoy,
          store: (($('chgStore') &&$('chgStore').value) || '').trim().replace(/[()]/g, '').slice(0, 30),
          deliveryMode: mode,
          deliveryCost: cost,
          draft: true,                    // guardado sin registrar en los gastos del mes
          expenses: [],
          items: st.items.map((it) => ({
            name: it.name, icon: it.icon, cur: it.cur, price: it.price, qty: it.qty,
            byKg: !!it.byKg, kg: it.kg || 0, promo: it.promo || { type: 'none' },
            paid: paidOf(it, general)
          }))
        });
      }
      st.items = [];
      st.general = 0;
      st.loadedFrom = null;               // el chango nuevo no está enlazado a ninguno anterior
      try { localStorage.setItem(key, JSON.stringify(st)); } catch (err) { say('No se pudo guardar el chango.'); return; }

      // limpiar la pantalla y los datos de compra
      const cancel = $('chgCancelEdit'); if (cancel) cancel.click();   // sale de cualquier edición y limpia el formulario
      const store = $('chgStore'); if (store) store.value = '';
      const dm = $('chgDeliveryMode'); if (dm) dm.value = 'presencial';
      const dw = $('chgDeliveryCostWrap'); if (dw) dw.hidden = true;
      const dc = $('chgDeliveryCost'); if (dc) dc.value = '';
      const gen = $('chgGeneral'); if (gen) gen.value = '';

      // avisarle a Changui que vuelva a leer sus datos (él ya escucha cambios en #userEmail)
      if (emailEl) emailEl.textContent = emailEl.textContent;
      else window.location.reload();

      const top = $('changui'); if (top) top.scrollIntoView({ behavior: 'smooth', block: 'start' });
      say(yaRegistrado
        ? 'Listo: chango nuevo en cero. El anterior ya estaba en el Historial. 🛒'
        : 'Listo: chango guardado en el Historial y chango nuevo en cero. 🛒');
    });
  }
})();

// Escucha el aviso de Changui para actualizar gráficos y análisis en tiempo real en app.js
window.addEventListener('mensuales:refresh', () => {
  if (typeof renderCategoryChart === 'function') renderCategoryChart();
  if (typeof renderTrendAnalysis === 'function') renderTrendAnalysis();
  if (typeof updateUI === 'function') updateUI();
});




/* =========================================================
   MARCA AUTOMÁTICA DE GASTOS DE CHANGUI (MES Y ANUAL)
   Revisa todos los meses del año y marca como "fromChangui" los gastos
   de Changui que tienen detalle, para que el Resumen Anual los cuente.
   v2: ya NO escribe en el historial local ni toca #userEmail
   (eso hacía que Changui se recargara en bucle).
========================================================= */
(() => {
  const $ = (id) => document.getElementById(id);

  function syncExistingMonthChanguis() {
    try {
      const b = window.ChanguiBridge || {};
      if (typeof b.getMonthExpenses !== 'function') return;

      const curMonth = (b.getCurrentMonth && b.getCurrentMonth()) || ($('monthPicker') &&$('monthPicker').value) || '';
      if (!curMonth) return;

      // Los 12 meses del año seleccionado (ej. 2026-01 a 2026-12) + el mes actual
      const year = curMonth.slice(0, 4) || String(new Date().getFullYear());
      const monthsToScan = new Set([curMonth]);
      for (let m = 1; m <= 12; m++) {
        monthsToScan.add(`${year}-${String(m).padStart(2, '0')}`);
      }

      monthsToScan.forEach((month) => {
        const list = b.getMonthExpenses(month) || [];
        list.forEach((exp) => {
          const desc = String(exp.description || '').trim();
          const esChg = exp.fromChangui || /^changui\b/i.test(desc);
          const detalle = Array.isArray(exp.detalle) ? exp.detalle : [];
          if (!esChg || !detalle.length) return;
          // Marca en memoria para el Resumen Anual de app.js
          if (!exp.fromChangui) exp.fromChangui = true;
        });
      });
    } catch (e) {
      console.warn('AutoSync Changui Anual:', e);
    }
  }

  // Se ejecuta cuando cambia la tabla de gastos
  const expTable = $('expenseTable');
  if (expTable) {
    let timer = null;
    new MutationObserver(() => {
      clearTimeout(timer);
      timer = setTimeout(syncExistingMonthChanguis, 300);
    }).observe(expTable, { childList: true });
  }

  // También justo antes de abrir el modal de "🌸 Resumen Anual"
  const openAnnualBtn = $('openAnnualBtn');
  if (openAnnualBtn) {
    openAnnualBtn.addEventListener('click', syncExistingMonthChanguis, true);
  }

  // Y una pasada inicial al cargar
  window.addEventListener('load', () => setTimeout(syncExistingMonthChanguis, 800));
})();
