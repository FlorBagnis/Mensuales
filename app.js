/* =========================================================
   MENSUALES & GASTOS PRÓXIMOS (SISTEMA UNIFICADO)
   FIREBASE FIRESTORE + TIEMPO REAL + MULTIMONEDA + PWA + CSV
========================================================= */

import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  writeBatch,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyBGGfMzmGfRH614IT5wwG2kZOtUDBd16ok",
  authDomain: "mensuales-8de3d.firebaseapp.com",
  projectId: "mensuales-8de3d",
  storageBucket: "mensuales-8de3d.firebasestorage.app",
  messagingSenderId: "248967622199",
  appId: "1:248967622199:web:86e53f1b115e974bb8d9b2"
};

const firebaseApp = initializeApp(firebaseConfig);
const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

// Service Worker (PWA)
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(e => console.log("SW:", e));
  });
}

// Variables Globales
let currentUser = null;
let unsubscribeMonths = null;
let unsubscribeProximos = null;
let authMode = "login";
let appReady = false;

// Datos de Mensuales
let data = { months: {} };
let searchMensualesTerm = "";

// Datos de Gastos Próximos
let proximosExpenses = [];
let gpCurrentFilter = "all";
let gpSearchTerm = "";

const $ = id => document.getElementById(id);


/* =========================================================
   FORMATOS DE MONEDA Y FECHAS
========================================================= */

function money(value, currency = "ARS") {
  const isUSD = currency === "USD";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: isUSD ? "USD" : "ARS",
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function currentMonthValue() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}`;
}

function monthName(month) {
  if (!month) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" })
    .format(new Date(year, monthNumber - 1, 1))
    .replace(/^./, c => c.toUpperCase());
}

function shortMonthName(month) {
  if (!month) return "";
  const [year, monthNumber] = month.split("-").map(Number);
  return new Intl.DateTimeFormat("es-AR", { month: "long" })
    .format(new Date(year, monthNumber - 1, 1))
    .replace(/^./, c => c.toUpperCase());
}

function addMonths(month, amount) {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year, monthNumber - 1 + amount, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function previousMonth(month) {
  return addMonths(month, -1);
}

function formatDate(date) {
  if (!date) return "—";
  const [year, month, day] = date.split("-");
  return `${day}/${month}/${year}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[c]));
}

function createId(prefix = "expense") {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}


/* =========================================================
   COTIZACIÓN DÓLAR BLUE EN VIVO
========================================================= */

async function fetchDolarBlue() {
  const badge = $("dolarBadge");
  if (!badge) return;
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue");
    const json = await res.json();
    if (json?.venta) {
      badge.textContent = `💵 Dólar Blue: $${json.venta}`;
    }
  } catch (err) {
    badge.textContent = `💵 Dólar Blue: no disponible`;
  }
}


/* =========================================================
   AUTENTICACIÓN
========================================================= */

function setAuthMessage(message, success = false) {
  $("authMessage").textContent = message;
  $("authMessage").classList.toggle("success", success);
}

function updateAuthInterface() {
  const isLogin = authMode === "login";
  $("authSubmitBtn").disabled = false;
  $("authSubmitBtn").textContent = isLogin ? "Iniciar sesión" : "Crear cuenta";
  $("authSwitchBtn").textContent = isLogin ? "¿No tenés una cuenta? Registrate" : "¿Ya tenés una cuenta? Iniciá sesión";
  $("authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  setAuthMessage("");
}

$("authSwitchBtn").addEventListener("click", () => {
  authMode = authMode === "login" ? "register" : "login";
  updateAuthInterface();
});

$("authForm").addEventListener("submit", async e => {
  e.preventDefault();
  const email = $("authEmail").value.trim();
  const password = $("authPassword").value;

  const button = $("authSubmitBtn");
  button.disabled = true;
  button.textContent = authMode === "login" ? "Ingresando..." : "Creando cuenta...";

  try {
    if (authMode === "register") {
      await createUserWithEmailAndPassword(auth, email, password);
    } else {
      await signInWithEmailAndPassword(auth, email, password);
    }
  } catch (error) {
    console.error("Auth Error:", error);
    setAuthMessage(error.message);
    button.disabled = false;
    updateAuthInterface();
  }
});

$("logoutBtn").addEventListener("click", async () => {
  if (!confirm("¿Querés cerrar sesión?")) return;
  try {
    stopAllSync();
    await signOut(auth);
  } catch (err) {
    alert("No se pudo cerrar la sesión.");
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    stopAllSync();
    data = { months: {} };
    proximosExpenses = [];
    appReady = false;
    $("authSection").classList.remove("hidden");
    $("appContent").classList.add("hidden");
    $("userEmail").textContent = "";
    updateAuthInterface();
    return;
  }

  $("authSection").classList.add("hidden");
  $("appContent").classList.remove("hidden");
  $("userEmail").textContent = user.email || "";

  fetchDolarBlue();
  startMonthsSync();
  startProximosSync();
});


/* =========================================================
   SISTEMA DE PESTAÑAS (TABS)
========================================================= */

const tabMensualesBtn = $("tabMensualesBtn");
const tabProximosBtn = $("tabProximosBtn");
const viewMensuales = $("viewMensuales");
const viewProximos = $("viewProximos");

tabMensualesBtn.addEventListener("click", () => {
  tabMensualesBtn.className = "btn btn-pink";
  tabProximosBtn.className = "btn btn-outline";
  viewMensuales.classList.remove("hidden");
  viewProximos.classList.add("hidden");
});

tabProximosBtn.addEventListener("click", () => {
  tabProximosBtn.className = "btn btn-pink";
  tabMensualesBtn.className = "btn btn-outline";
  viewProximos.classList.remove("hidden");
  viewMensuales.classList.add("hidden");
});


/* =========================================================
   FIRESTORE: MENSUALES
========================================================= */

function ensureMonth(month) {
  if (!data.months[month]) {
    data.months[month] = { budget: 0, expenses: [] };
  }
  return data.months[month];
}

function startMonthsSync() {
  if (!currentUser) return;
  const col = collection(db, "users", currentUser.uid, "months");
  unsubscribeMonths = onSnapshot(col, snapshot => {
    const months = {};
    snapshot.forEach(docSnap => {
      const v = docSnap.data();
      months[docSnap.id] = {
        budget: Number(v.budget || 0),
        expenses: Array.isArray(v.expenses) ? v.expenses : []
      };
    });
    data.months = months;
    const currentM = $("monthPicker")?.value || currentMonthValue();
    ensureMonth(currentM);
    renderMensuales();
  });
}

async function saveMonthToFirestore(month) {
  if (!currentUser) return;
  const docRef = doc(db, "users", currentUser.uid, "months", month);
  const m = ensureMonth(month);
  await setDoc(docRef, { budget: Number(m.budget || 0), expenses: m.expenses }, { merge: true });
}

function stopAllSync() {
  if (typeof unsubscribeMonths === "function") { unsubscribeMonths(); unsubscribeMonths = null; }
  if (typeof unsubscribeProximos === "function") { unsubscribeProximos(); unsubscribeProximos = null; }
}


/* =========================================================
   RENDER: MENSUALES
========================================================= */

function renderMensuales() {
  const month = $("monthPicker")?.value || currentMonthValue();
  const current = ensureMonth(month);
  const prevMonth = previousMonth(month);
  const previous = data.months[prevMonth] || { budget: 0, expenses: [] };

  let totalARS = 0;
  let totalUSD = 0;
  current.expenses.forEach(e => {
    if (e.currency === "USD") totalUSD += Number(e.amount || 0);
    else totalARS += Number(e.amount || 0);
  });

  let prevARS = 0;
  let prevUSD = 0;
  previous.expenses.forEach(e => {
    if (e.currency === "USD") prevUSD += Number(e.amount || 0);
    else prevARS += Number(e.amount || 0);
  });

  const diffARS = totalARS - prevARS;
  const percentageARS = prevARS ? Math.abs((diffARS / prevARS) * 100) : 0;

  $("budgetInput").value = current.budget || "";
  $("totalSpent").innerHTML = totalUSD > 0
    ? `${money(totalARS)}<br><small style="font-size:0.8em; color:var(--pink-700);">${money(totalUSD, "USD")}</small>`
    : money(totalARS);

  $("previousSpent").innerHTML = prevUSD > 0
    ? `${money(prevARS)}<br><small style="font-size:0.8em; color:var(--pink-700);">${money(prevUSD, "USD")}</small>`
    : money(prevARS);

  $("budgetTotal").textContent = money(current.budget);
  $("previousMonthLabel").textContent = monthName(prevMonth);
  $("monthPill").textContent = monthName(month);
  $("totalMonthName").textContent = shortMonthName(month).toUpperCase();

  $("tableTotal").textContent = money(totalARS);
  const tableUSD = $("tableTotalUSD");
  if (tableUSD) {
    tableUSD.style.display = totalUSD > 0 ? "block" : "none";
    tableUSD.textContent = totalUSD > 0 ? `+ ${money(totalUSD, "USD")}` : "";
  }

  $("expenseCount").textContent = `${current.expenses.length} ${current.expenses.length === 1 ? "gasto registrado" : "gastos registrados"}`;

  const diffEl = $("difference");
  if (prevARS === 0) {
    diffEl.textContent = "—";
    $("differenceLabel").textContent = "Sin datos comparables";
    diffEl.className = "";
  } else {
    diffEl.textContent = `${diffARS <= 0 ? "- " : "+ "}${money(Math.abs(diffARS))}`;
    $("differenceLabel").textContent = diffARS <= 0 ? `↓ ${percentageARS.toFixed(1)}% menos (ARS)` : `↑ ${percentageARS.toFixed(1)}% más (ARS)`;
    diffEl.className = diffARS <= 0 ? "result-good" : "result-bad";
  }

  $("budgetStatus").textContent = current.budget
    ? totalARS <= current.budget ? `${money(current.budget - totalARS)} disponibles` : `${money(totalARS - current.budget)} excedido`
    : "Sin presupuesto";
  $("budgetStatus").className = totalARS <= current.budget || !current.budget ? "" : "result-bad";

  renderMensualesExpensesTable(current.expenses);
  renderHistory();
  renderCategories(current.expenses);
  renderTrend(month, totalARS, prevARS, totalUSD);
}

function renderMensualesExpensesTable(expenses) {
  const table = $("expenseTable");
  table.innerHTML = "";

  let list = expenses.slice();
  if (searchMensualesTerm.trim() !== "") {
    const q = searchMensualesTerm.toLowerCase();
    list = list.filter(e => (e.description || "").toLowerCase().includes(q) || (e.category || "").toLowerCase().includes(q));
  }

  $("emptyState").style.display = list.length ? "none" : "grid";

  list.sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).forEach(e => {
    const row = document.createElement("tr");
    const curr = e.currency || "ARS";
    row.innerHTML = `
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="category">${escapeHtml(e.category)}</span></td>
      <td class="amount">${money(e.amount, curr)}</td>
      <td class="actions">
        <button class="edit-btn" data-id="${e.id}" type="button">✏️</button>
        <button class="delete-btn" data-id="${e.id}" type="button">×</button>
      </td>
    `;
    table.appendChild(row);
  });

  table.querySelectorAll(".edit-btn").forEach(btn => {
    btn.onclick = () => {
      const month = $("monthPicker").value;
      const expense = data.months[month]?.expenses.find(x => x.id === btn.dataset.id);
      if (!expense) return;
      $("expenseDate").value = expense.date;
      $("expenseDescription").value = expense.description;
      $("expenseCategory").value = expense.category;
      $("expenseAmount").value = expense.amount;
      $("expenseCurrency").value = expense.currency || "ARS";
      $("expenseForm").dataset.editingId = expense.id;
      $("modalTitle").textContent = "Editar gasto";
      $("expenseDialog").showModal();
    };
  });

  table.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar este gasto?")) return;
      const month = $("monthPicker").value;
      const monthData = data.months[month];
      if (!monthData) return;
      const id = btn.dataset.id;
      monthData.expenses = monthData.expenses.filter(x => x.id !== id);
      renderMensuales();
      await saveMonthToFirestore(month);
      if (id && id.startsWith("gp-")) {
        const pId = id.replace("gp-", "");
        await setDoc(doc(db, "users", currentUser.uid, "proximos", pId), { paid: false }, { merge: true });
      }
    };
  });
}

$("searchMensualesInput")?.addEventListener("input", e => {
  searchMensualesTerm = e.target.value;
  renderMensuales();
});


/* =========================================================
   HISTORIAL, CATEGORÍAS Y TENDENCIA
========================================================= */

function renderHistory() {
  const table = $("historyTable");
  table.innerHTML = "";
  const months = Object.keys(data.months).sort().reverse().slice(0, 6);
  if (!months.length) {
    table.innerHTML = `<tr><td colspan="4">Sin historial disponible.</td></tr>`;
    return;
  }
  months.forEach(m => {
    const cur = data.months[m];
    let ars = 0, usd = 0;
    cur.expenses.forEach(e => { if (e.currency === "USD") usd += Number(e.amount || 0); else ars += Number(e.amount || 0); });
    const res = Number(cur.budget || 0) - ars;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><b>${monthName(m)}</b></td>
      <td>${money(cur.budget)}</td>
      <td>${usd > 0 ? `${money(ars)} <br><small style="color:var(--pink-700);">${money(usd, "USD")}</small>` : money(ars)}</td>
      <td class="${res >= 0 ? "result-good" : "result-bad"}">${res >= 0 ? "+" : "-"}${money(Math.abs(res))}</td>
    `;
    table.appendChild(row);
  });
}

function renderCategories(expenses) {
  const totals = {};
  expenses.forEach(e => {
    const curr = e.currency || "ARS";
    if (!totals[e.category]) totals[e.category] = { ARS: 0, USD: 0 };
    totals[e.category][curr] += Number(e.amount || 0);
  });
  const entries = Object.entries(totals).sort((a, b) => (b[1].ARS + b[1].USD) - (a[1].ARS + a[1].USD));
  const max = entries[0] ? Math.max(entries[0][1].ARS, entries[0][1].USD) : 1;

  $("categoryChart").innerHTML = entries.length ? entries.map(([cat, vals]) => {
    const label = vals.USD > 0 && vals.ARS > 0 ? `${money(vals.ARS)} + ${money(vals.USD, "USD")}` : vals.USD > 0 ? money(vals.USD, "USD") : money(vals.ARS);
    const val = vals.ARS > 0 ? vals.ARS : vals.USD;
    return `
      <div class="bar-row">
        <div class="bar-label"><span>${escapeHtml(cat)}</span><b>${label}</b></div>
        <div class="bar-bg"><div class="bar-fill" style="width:${Math.min(100, (val / max) * 100)}%"></div></div>
      </div>
    `;
  }).join("") : `<div class="empty-state"><div>♡</div><span>No hay categorías registradas.</span></div>`;
}

function renderTrend(month, totalARS, prevARS, totalUSD) {
  const cur = data.months[month];
  if (!cur || !cur.expenses.length) {
    $("trendText").textContent = "Agregá gastos para analizar tus hábitos.";
    return;
  }
  let text = `En ${monthName(month)}, registraste ${money(totalARS)}${totalUSD > 0 ? ` y ${money(totalUSD, "USD")}` : ""} en ${cur.expenses.length} gastos.`;
  if (prevARS) {
    const pct = ((totalARS - prevARS) / prevARS) * 100;
    text += pct <= 0 ? ` Representa un ahorro del ${Math.abs(pct).toFixed(1)}% respecto al mes anterior.` : ` Representa un incremento del ${pct.toFixed(1)}% respecto al mes anterior.`;
  }
  $("trendText").textContent = text;
}


/* =========================================================
   FIRESTORE: GASTOS PRÓXIMOS
========================================================= */

function startProximosSync() {
  if (!currentUser) return;
  const col = collection(db, "users", currentUser.uid, "proximos");
  unsubscribeProximos = onSnapshot(col, snapshot => {
    proximosExpenses = [];
    snapshot.forEach(d => proximosExpenses.push({ id: d.id, ...d.data() }));
    renderProximos();
  });
}

function getCategoryIcon(cat) {
  const k = String(cat || "").toLowerCase();
  const map = {
    hogar: "🏠", servicios: "💡", comida: "🍔", mascotas: "🐾",
    deudas: "💸", salud: "💊", transporte: "🚗", otros: "📦",
    gimnasio: "💪", gym: "💪", agua: "💧"
  };
  return map[k] || "📦";
}

function getCategoryName(cat) {
  const k = String(cat || "").toLowerCase();
  const map = {
    hogar: "Hogar", servicios: "Servicios", comida: "Comida", mascotas: "Mascotas",
    deudas: "Deudas", salud: "Salud", transporte: "Transporte", otros: "Otros",
    gimnasio: "Gimnasio", gym: "Gimnasio", agua: "Agua"
  };
  return map[k] || "Otros";
}

function mapCategoryToMensuales(cat) {
  const k = String(cat || "").toLowerCase();
  const map = {
    comida: "Alimentos", transporte: "Transporte", hogar: "Hogar",
    servicios: "Servicios", salud: "Salud", mascotas: "Mascotas",
    deudas: "Otros", otros: "Otros", gimnasio: "Gimnasio",
    gym: "Gimnasio", agua: "Agua"
  };
  return map[k] || "Otros";
}

function getDueBadge(dateStr, isPaid) {
  if (isPaid || !dateStr) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  const target = new Date(`${dateStr}T00:00:00`);
  const diff = Math.round((target - today) / (1000 * 60 * 60 * 24));
  if (diff < 0) return { text: "⚠️ Vencido", color: "#d32f2f", bg: "#ffebee" };
  if (diff === 0) return { text: "⏰ Vence hoy", color: "#e65100", bg: "#fff3e0" };
  if (diff <= 2) return { text: "⚡ Próximo", color: "#c2185b", bg: "#fce4ec" };
  return null;
}

function renderProximos() {
  const pending = proximosExpenses.filter(e => !e.paid);
  let totalARS = 0, totalUSD = 0, debtARS = 0, debtUSD = 0;

  pending.forEach(e => {
    const a = Number(e.amount || 0);
    if (e.currency === "USD") { totalUSD += a; if (e.type === "debt") debtUSD += a; }
    else { totalARS += a; if (e.type === "debt") debtARS += a; }
  });

  $("gpTotalPending").innerHTML = totalUSD > 0 ? `${money(totalARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(totalUSD, "USD")}</small>` : money(totalARS);
  $("gpTotalDebts").innerHTML = debtUSD > 0 ? `${money(debtARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(debtUSD, "USD")}</small>` : money(debtARS);

  const today = new Date(); today.setHours(0,0,0,0);
  const next7 = new Date(today); next7.setDate(next7.getDate() + 7);
  let n7ARS = 0, n7USD = 0;
  pending.filter(e => {
    const d = new Date(`${e.date}T00:00:00`);
    return d >= today && d <= next7;
  }).forEach(e => {
    if (e.currency === "USD") n7USD += Number(e.amount || 0);
    else n7ARS += Number(e.amount || 0);
  });
  $("gpNextSevenDays").innerHTML = n7USD > 0 ? `${money(n7ARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(n7USD, "USD")}</small>` : money(n7ARS);

  const curM = today.getMonth();
  const curY = today.getFullYear();
  let mARS = 0, mUSD = 0;
  pending.filter(e => {
    const d = new Date(`${e.date}T00:00:00`);
    return d.getMonth() === curM && d.getFullYear() === curY;
  }).forEach(e => {
    if (e.currency === "USD") mUSD += Number(e.amount || 0);
    else mARS += Number(e.amount || 0);
  });
  $("gpThisMonth").innerHTML = mUSD > 0 ? `${money(mARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(mUSD, "USD")}</small>` : money(mARS);

  // Filtrado de lista
  let list = proximosExpenses.slice();
  if (gpCurrentFilter === "pending") list = list.filter(e => !e.paid);
  else if (gpCurrentFilter === "paid") list = list.filter(e => e.paid);
  else if (gpCurrentFilter === "debt") list = list.filter(e => e.type === "debt");

  if (gpSearchTerm.trim() !== "") {
    const q = gpSearchTerm.toLowerCase();
    list = list.filter(e => (e.description || "").toLowerCase().includes(q) || (e.notes || "").toLowerCase().includes(q) || getCategoryName(e.category).toLowerCase().includes(q));
  }

  list.sort((a, b) => new Date(a.date) - new Date(b.date));
  const container = $("gpExpensesList");
  container.innerHTML = "";

  $("gpItemsCount").textContent = `${list.length} registros`;
  $("gpEmptyState").style.display = list.length === 0 ? "block" : "none";

  list.forEach(item => {
    const card = document.createElement("article");
    card.className = "expense";
    card.style.cssText = "display:flex; justify-content:space-between; align-items:center; padding:12px; border-radius:12px; background:rgba(232,93,158,0.06); border:1px solid #f2cfdf;";
    
    const icon = getCategoryIcon(item.category);
    const catName = getCategoryName(item.category);
    const alert = getDueBadge(item.date, item.paid);
    const alertTag = alert ? `<span style="font-size:0.75rem; font-weight:bold; padding:2px 8px; border-radius:999px; background:${alert.bg}; color:${alert.color}; margin-left:6px;">${alert.text}</span>` : "";

    card.innerHTML = `
      <div style="display:flex; align-items:center; gap:12px;">
        <div style="font-size:1.8rem;">${icon}</div>
        <div>
          <h3 style="margin:0; font-size:1rem;">${escapeHtml(item.description)}</h3>
          <p style="margin:2px 0 0; font-size:0.8rem; color:#666;">${catName} · Cant: ${item.quantity || 1} ${item.notes ? `· <i>${escapeHtml(item.notes)}</i>` : ""}</p>
          <div style="margin-top:4px;">
            <span class="badge ${item.paid ? "paid" : item.type === "debt" ? "debt" : "pending"}">${item.paid ? "Pagado" : item.type === "debt" ? "Deuda" : "Pendiente"}</span>
            ${alertTag}
          </div>
        </div>
      </div>

      <div style="text-align:right;">
        <div style="font-size:0.8rem; color:#888;">Pagar <b>${formatDate(item.date)}</b></div>
        <div style="font-size:1.1rem; font-weight:bold; margin:4px 0;">${item.amount !== null ? money(item.amount, item.currency || "ARS") : "Pendiente"}</div>
        <div style="display:flex; gap:6px; justify-content:flex-end;">
          <button class="btn btn-sm ${item.paid ? "btn-outline" : "btn-pink"} gp-action-pay" data-id="${item.id}" title="${item.paid ? "Volver a pendiente" : "Marcar pagado y enviar a Mensuales"}">${item.paid ? "✖" : "✓"}</button>
          <button class="btn btn-sm btn-outline gp-action-edit" data-id="${item.id}">✏️</button>
          <button class="btn btn-sm btn-danger gp-action-del" data-id="${item.id}">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".gp-action-pay").forEach(btn => {
    btn.onclick = () => togglePayProximo(btn.dataset.id);
  });
  container.querySelectorAll(".gp-action-edit").forEach(btn => {
    btn.onclick = () => editProximo(btn.dataset.id);
  });
  container.querySelectorAll(".gp-action-del").forEach(btn => {
    btn.onclick = () => deleteProximo(btn.dataset.id);
  });
}

async function togglePayProximo(id) {
  const item = proximosExpenses.find(x => x.id === id);
  if (!item) return;

  if (!item.paid) {
    if (!item.amount || item.amount <= 0) {
      alert("Definí un monto antes de marcar como pagado.");
      return;
    }
    const payDate = item.date || new Date().toISOString().slice(0, 10);
    const monthKey = payDate.slice(0, 7);
    const mensualId = `gp-${item.id}`;

    item.paid = true;
    item.linkedMensualId = mensualId;
    item.linkedMonthKey = monthKey;

    await setDoc(doc(db, "users", currentUser.uid, "proximos", item.id), item, { merge: true });

    const monthRef = doc(db, "users", currentUser.uid, "months", monthKey);
    const snap = await getDoc(monthRef);
    let mData = snap.exists() ? snap.data() : { budget: 0, expenses: [] };
    if (!Array.isArray(mData.expenses)) mData.expenses = [];

    mData.expenses = mData.expenses.filter(x => x.id !== mensualId);
    mData.expenses.push({
      id: mensualId,
      date: payDate,
      description: item.description,
      category: mapCategoryToMensuales(item.category),
      amount: Number(item.amount),
      currency: item.currency || "ARS"
    });

    await setDoc(monthRef, mData, { merge: true });
    alert(`✓ Pago registrado e impactado en Gastos del Mes (${monthKey}).`);
  } else {
    const payDate = item.date || new Date().toISOString().slice(0, 10);
    const monthKey = item.linkedMonthKey || payDate.slice(0, 7);
    const mensualId = item.linkedMensualId || `gp-${item.id}`;

    item.paid = false;
    await setDoc(doc(db, "users", currentUser.uid, "proximos", item.id), { paid: false }, { merge: true });

    const monthRef = doc(db, "users", currentUser.uid, "months", monthKey);
    const snap = await getDoc(monthRef);
    if (snap.exists()) {
      let mData = snap.data();
      if (Array.isArray(mData.expenses)) {
        mData.expenses = mData.expenses.filter(x => x.id !== mensualId);
        await setDoc(monthRef, mData, { merge: true });
      }
    }
    alert("↩ Gasto vuelto a pendiente y quitado de la tabla mensual.");
  }
}

function editProximo(id) {
  const item = proximosExpenses.find(x => x.id === id);
  if (!item) return;
  $("gpExpenseId").value = item.id;
  $("gpDescription").value = item.description;
  $("gpCategory").value = item.category || "Hogar";
  $("gpAmount").value = item.amount !== null ? item.amount : "";
  $("gpCurrency").value = item.currency || "ARS";
  $("gpQuantity").value = item.quantity || 1;
  $("gpDate").value = item.date;
  $("gpNotes").value = item.notes || "";
  const r = document.querySelector(`input[name="gpType"][value="${item.type}"]`);
  if (r) r.checked = true;
  $("gpModalTitle").textContent = "Editar registro pendiente";
  $("gpModal").showModal();
}

async function deleteProximo(id) {
  if (!confirm("¿Eliminar este registro pendiente?")) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "proximos", id));
}

// Filtros Próximos
document.querySelectorAll(".gp-filter").forEach(b => {
  b.onclick = () => {
    document.querySelectorAll(".gp-filter").forEach(x => x.className = "btn btn-outline btn-sm gp-filter");
    b.className = "btn btn-pink btn-sm gp-filter";
    gpCurrentFilter = b.dataset.filter;
    renderProximos();
  };
});

$("gpSearchInput")?.addEventListener("input", e => {
  gpSearchTerm = e.target.value;
  renderProximos();
});

$("gpOpenModalBtn")?.addEventListener("click", () => {
  $("gpExpenseForm").reset();
  $("gpExpenseId").value = "";
  $("gpDate").value = new Date().toISOString().slice(0, 10);
  $("gpModalTitle").textContent = "Agregar registro pendiente";
  $("gpModal").showModal();
});

$("gpCloseModalBtn")?.addEventListener("click", () => $("gpModal").close());
$("gpCancelBtn")?.addEventListener("click", () => $("gpModal").close());

$("gpExpenseForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const id = $("gpExpenseId").value || createId("proximo");
  const type = document.querySelector('input[name="gpType"]:checked').value;
  const description = $("gpDescription").value.trim();
  const category = $("gpCategory").value;
  const amountVal = $("gpAmount").value;
  const currency = $("gpCurrency").value;
  const quantity = Number($("gpQuantity").value) || 1;
  const date = $("gpDate").value;
  const notes = $("gpNotes").value.trim();
  const amount = amountVal === "" ? null : Number(amountVal);

  const existing = proximosExpenses.find(x => x.id === id);
  const payload = {
    id, type, description, category, amount, currency, quantity, date, notes,
    paid: existing ? existing.paid : false,
    createdAt: existing ? existing.createdAt : new Date().toISOString()
  };

  await setDoc(doc(db, "users", currentUser.uid, "proximos", id), payload, { merge: true });
  $("gpModal").close();
});


/* =========================================================
   EXPORTAR CSV (MENSUALES & PRÓXIMOS)
========================================================= */

function downloadCSV(rows, filename) {
  const content = "\uFEFF" + rows.map(r => r.join(";")).join("\n");
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

$("mensualesCsvBtn")?.addEventListener("click", () => {
  const month = $("monthPicker").value;
  const current = ensureMonth(month);
  if (!current.expenses.length) { alert("No hay gastos registrados en este mes."); return; }
  const rows = [["Fecha", "Descripción", "Categoría", "Monto", "Moneda"]];
  current.expenses.forEach(e => {
    rows.push([e.date, `"${e.description.replace(/"/g, '""')}"`, e.category, e.amount, e.currency || "ARS"]);
  });
  downloadCSV(rows, `MENSUALES-${month}.csv`);
});

$("gpCsvBtn")?.addEventListener("click", () => {
  if (!proximosExpenses.length) { alert("No hay registros pendientes para exportar."); return; }
  const rows = [["Fecha", "Concepto", "Categoría", "Tipo", "Estado", "Monto", "Moneda", "Cantidad", "Notas"]];
  proximosExpenses.forEach(e => {
    rows.push([
      e.date, `"${(e.description || "").replace(/"/g, '""')}"`, getCategoryName(e.category),
      e.type === "debt" ? "Deuda" : "Gasto", e.paid ? "Pagado" : "Pendiente",
      e.amount !== null ? e.amount : "", e.currency || "ARS", e.quantity || 1, `"${(e.notes || "").replace(/"/g, '""')}"`
    ]);
  });
  downloadCSV(rows, `Gastos-Proximos-${new Date().toISOString().slice(0, 10)}.csv`);
});


/* =========================================================
   REPORTES PDF (MENSUALES & PRÓXIMOS)
========================================================= */

$("pdfBtn")?.addEventListener("click", () => {
  if (!window.jspdf) { alert("No se pudo cargar jsPDF."); return; }
  const { jsPDF } = window.jspdf;
  const month = $("monthPicker").value;
  const current = ensureMonth(month);

  let ars = 0, usd = 0;
  current.expenses.forEach(e => { if (e.currency === "USD") usd += Number(e.amount || 0); else ars += Number(e.amount || 0); });

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFillColor(255, 176, 194);
  pdf.roundedRect(15, 15, 180, 24, 4, 4, "F");
  pdf.setTextColor(85, 21, 45);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("CONTROL DE GASTOS MENSUALES", 20, 26);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Período: ${monthName(month)} · Emitido el ${new Date().toLocaleDateString("es-AR")}`, 20, 33);

  let y = 48;
  pdf.setFillColor(245, 107, 139);
  pdf.rect(15, y, 180, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA", 18, y + 5);
  pdf.text("CONCEPTO", 45, y + 5);
  pdf.text("CATEGORÍA", 120, y + 5);
  pdf.text("MONTO", 165, y + 5);

  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(51, 41, 52);

  current.expenses.forEach(e => {
    if (y > 275) { pdf.addPage(); y = 20; }
    pdf.text(formatDate(e.date), 18, y + 5);
    pdf.text(String(e.description).slice(0, 35), 45, y + 5);
    pdf.text(String(e.category).slice(0, 18), 120, y + 5);
    pdf.text(money(e.amount, e.currency || "ARS"), 165, y + 5);
    pdf.setDrawColor(245, 220, 227);
    pdf.line(15, y + 8, 195, y + 8);
    y += 9;
  });

  pdf.save(`MENSUALES-${month}.pdf`);
});

$("gpPdfBtn")?.addEventListener("click", () => {
  if (!window.jspdf) { alert("No se pudo cargar jsPDF."); return; }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.setFillColor(255, 227, 240);
  pdf.roundedRect(15, 15, 180, 24, 4, 4, "F");
  pdf.setTextColor(51, 41, 52);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("AGENDA DE GASTOS PRÓXIMOS", 20, 26);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Reporte emitido el ${new Date().toLocaleDateString("es-AR")}`, 20, 33);

  let y = 48;
  pdf.setFillColor(232, 93, 158);
  pdf.rect(15, y, 180, 7, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA", 18, y + 5);
  pdf.text("CONCEPTO", 42, y + 5);
  pdf.text("CATEGORÍA", 115, y + 5);
  pdf.text("ESTADO", 145, y + 5);
  pdf.text("MONTO", 170, y + 5);

  y += 7;
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(51, 41, 52);

  proximosExpenses.forEach(e => {
    if (y > 275) { pdf.addPage(); y = 20; }
    pdf.text(formatDate(e.date), 18, y + 5);
    pdf.text(String(e.description || "").slice(0, 36), 42, y + 5);
    pdf.text(getCategoryName(e.category), 115, y + 5);
    pdf.text(e.paid ? "Pagado" : "Pendiente", 145, y + 5);
    pdf.text(e.amount !== null ? money(e.amount, e.currency || "ARS") : "A definir", 170, y + 5);
    pdf.setDrawColor(245, 230, 238);
    pdf.line(15, y + 8, 195, y + 8);
    y += 9;
  });

  pdf.save(`Gastos-Proximos-${new Date().toISOString().slice(0, 10)}.pdf`);
});


/* =========================================================
   FORMULARIO MENSUALES (NUEVO / EDITAR GASTO)
========================================================= */

$("monthPicker")?.addEventListener("change", () => renderMensuales());

$("saveBudgetBtn")?.addEventListener("click", async () => {
  const month = $("monthPicker").value;
  if (!month) return;
  const current = ensureMonth(month);
  current.budget = Number($("budgetInput").value || 0);
  renderMensuales();
  await saveMonthToFirestore(month);
  alert("Presupuesto guardado correctamente.");
});

$("addExpenseBtn")?.addEventListener("click", () => {
  $("expenseForm").reset();
  delete $("expenseForm").dataset.editingId;
  $("expenseDate").value = new Date().toISOString().slice(0, 10);
  $("modalTitle").textContent = "Agregar gasto";
  $("expenseDialog").showModal();
});

$("closeDialog")?.addEventListener("click", () => $("expenseDialog").close());
$("cancelDialog")?.addEventListener("click", () => $("expenseDialog").close());

$("expenseForm")?.addEventListener("submit", async e => {
  e.preventDefault();
  const month = $("monthPicker").value;
  const editingId = $("expenseForm").dataset.editingId;
  const date = $("expenseDate").value;
  const description = $("expenseDescription").value.trim();
  const category = $("expenseCategory").value;
  const amount = Number($("expenseAmount").value);
  const currency = $("expenseCurrency").value || "ARS";

  if (editingId) {
    const monthData = ensureMonth(month);
    const exp = monthData.expenses.find(x => x.id === editingId);
    if (exp) {
      exp.date = date; exp.description = description; exp.category = category; exp.amount = amount; exp.currency = currency;
      renderMensuales();
      await saveMonthToFirestore(month);
    }
  } else {
    const expense = { id: createId("expense"), date, description, category, amount, currency };
    const monthData = ensureMonth(month);
    monthData.expenses.push(expense);
    renderMensuales();
    await saveMonthToFirestore(month);
  }

  $("expenseDialog").close();
});

$("clearMonthBtn")?.addEventListener("click", async () => {
  const month = $("monthPicker").value;
  if (!confirm(`¿Borrar todos los gastos de ${monthName(month)}?`)) return;
  await deleteDoc(doc(db, "users", currentUser.uid, "months", month));
  delete data.months[month];
  ensureMonth(month);
  renderMensuales();
});

$("newUserBtn")?.addEventListener("click", async () => {
  if (!confirm("⚠️ ¿Estás segura de reiniciar todo y borrar todos los meses?")) return;
  const snap = await getDocs(collection(db, "users", currentUser.uid, "months"));
  const batch = writeBatch(db);
  snap.forEach(d => batch.delete(d.ref));
  await batch.commit();
  data = { months: {} };
  renderMensuales();
});


/* =========================================================
   CONFIGURACIONES VISUALES Y MODO OSCURO
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  $("monthPicker").value = currentMonthValue();

  const toggleAmountsBtn = $("toggleAmountsBtn");
  if (localStorage.getItem("mensuales_hide_amounts") === "true") {
    document.body.classList.add("amounts-hidden");
    if (toggleAmountsBtn) toggleAmountsBtn.textContent = "👁️ Mostrar montos";
  }

  toggleAmountsBtn?.addEventListener("click", () => {
    const hidden = document.body.classList.toggle("amounts-hidden");
    localStorage.setItem("mensuales_hide_amounts", hidden);
    toggleAmountsBtn.textContent = hidden ? "👁️ Mostrar montos" : "👁️ Ocultar montos";
  });

  const toggleThemeBtn = $("toggleThemeBtn");
  if (localStorage.getItem("mensuales_theme") === "dark") {
    document.body.classList.add("dark-mode");
    if (toggleThemeBtn) toggleThemeBtn.textContent = "☀️ Modo claro";
  }

  toggleThemeBtn?.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    localStorage.setItem("mensuales_theme", isDark ? "dark" : "light");
    toggleThemeBtn.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  });

  // Colapsables
  function setupCollapsible(btnId, container, storageKey, label) {
    const btn = $(btnId);
    if (!btn || !container) return;
    if (localStorage.getItem(storageKey) === "true") {
      container.classList.add("collapsed");
      btn.textContent = `▼ Mostrar ${label}`;
    }
    btn.onclick = () => {
      const col = container.classList.toggle("collapsed");
      localStorage.setItem(storageKey, col);
      btn.textContent = col ? `▼ Mostrar ${label}` : `▲ Ocultar ${label}`;
    };
  }

  setupCollapsible("toggleToolbarBtn", $("toolbarContainer"), "mensuales_toolbar_collapsed", "barra");
  setupCollapsible("toggleBudgetBtn", $("budgetContainer"), "mensuales_budget_collapsed", "resumen");
  setupCollapsible("toggleTableBtn", document.querySelector(".table-container-collapsible"), "mensuales_table_collapsed", "tabla");
  setupCollapsible("toggleHistoryBtn", $("historyContainer"), "mensuales_history_collapsed", "historial");
});
