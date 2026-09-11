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

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("./sw.js").catch(e => console.log("SW:", e));
  });
}

let currentUser = null;
let unsubscribeMonths = null;
let unsubscribeProximos = null;
let authMode = "login";
let currentDolarBlue = 0;

let data = { months: {} };
let searchMensualesTerm = "";
let proximosExpenses = [];
let gpCurrentFilter = "all";
let gpSearchTerm = "";

const $ = id => document.getElementById(id);


/* =========================================================
   UTILIDADES Y FORMATOS
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
   COTIZACIÓN DÓLAR BLUE
========================================================= */

async function fetchDolarBlue() {
  const badge = $("dolarBadge");
  if (!badge) return;
  try {
    const res = await fetch("https://dolarapi.com/v1/dolares/blue");
    const json = await res.json();
    if (json?.venta) {
      currentDolarBlue = Number(json.venta);
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
  const msg = $("authMessage");
  if (!msg) return;
  msg.textContent = message;
  msg.classList.toggle("success", success);
}

function updateAuthInterface() {
  const isLogin = authMode === "login";
  if ($("authSubmitBtn")) {
    $("authSubmitBtn").disabled = false;
    $("authSubmitBtn").textContent = isLogin ? "Iniciar sesión" : "Crear cuenta";
  }
  if ($("authSwitchBtn")) {
    $("authSwitchBtn").textContent = isLogin ? "¿No tenés una cuenta? Registrate" : "¿Ya tenés una cuenta? Iniciá sesión";
  }
  if ($("authPassword")) {
    $("authPassword").autocomplete = isLogin ? "current-password" : "new-password";
  }
  setAuthMessage("");
}

function firebaseErrorMessage(error) {
  const code = error?.code || "";
  const messages = {
    "auth/invalid-email": "El email no es válido.",
    "auth/missing-password": "Ingresá una contraseña.",
    "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
    "auth/email-already-in-use": "Ya existe una cuenta con ese email.",
    "auth/invalid-credential": "El email o la contraseña son incorrectos.",
    "auth/user-not-found": "No existe una cuenta con ese email.",
    "auth/wrong-password": "La contraseña es incorrecta.",
    "auth/too-many-requests": "Demasiados intentos. Esperá un momento.",
    "auth/network-request-failed": "No hay conexión con Firebase."
  };
  return messages[code] || `Error (${code || "desconocido"}). Volvé a intentar.`;
}

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    localStorage.removeItem('user_logged_in');
    stopAllSync();
    data = { months: {} };
    proximosExpenses = [];
    $("authSection")?.classList.remove("hidden");
    $("appContent")?.classList.add("hidden");
    if ($("userEmail")) $("userEmail").textContent = "";
    updateAuthInterface();
    return;
  }

  localStorage.setItem('user_logged_in', 'true');
  $("authSection")?.classList.add("hidden");
  $("appContent")?.classList.remove("hidden");
  if ($("userEmail")) $("userEmail").textContent = user.email || "";

  try {
    fetchDolarBlue();
    startMonthsSync();
    startProximosSync();
  } catch (e) {
    console.error("Error al iniciar sincronización:", e);
  }
});


/* =========================================================
   FIRESTORE: MENSUALES
========================================================= */

function ensureMonth(month) {
  if (!data.months[month]) {
    data.months[month] = { budget: 0, expenses: [], extraIncomes: [] };
  }
  if (!data.months[month].extraIncomes) {
    data.months[month].extraIncomes = [];
  }
  return data.months[month];
}

function startMonthsSync() {
  if (!currentUser) return;
  try {
    const col = collection(db, "users", currentUser.uid, "months");
    unsubscribeMonths = onSnapshot(col, snapshot => {
      const months = {};
      snapshot.forEach(docSnap => {
        const v = docSnap.data();
        months[docSnap.id] = {
          budget: Number(v.budget || 0),
          expenses: Array.isArray(v.expenses) ? v.expenses : [],
          extraIncomes: Array.isArray(v.extraIncomes) ? v.extraIncomes : []
        };
      });
      data.months = months;
      const currentM = $("monthPicker")?.value || currentMonthValue();
      ensureMonth(currentM);
      renderMensuales();
    }, err => console.error("Error sync meses:", err));
  } catch (e) {
    console.error("Excepción en startMonthsSync:", e);
  }
}

async function saveMonthToFirestore(month) {
  if (!currentUser) return;
  try {
    const docRef = doc(db, "users", currentUser.uid, "months", month);
    const m = ensureMonth(month);
    await setDoc(docRef, { 
      budget: Number(m.budget || 0), 
      expenses: m.expenses,
      extraIncomes: m.extraIncomes || []
    }, { merge: true });
  } catch (e) {
    console.error("Error guardando mes:", e);
  }
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
  const previous = data.months[prevMonth] || { budget: 0, expenses: [], extraIncomes: [] };

  if (Array.isArray(current.extraIncomes) && current.extraIncomes.length > 0) {
    current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
  }

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

  if ($("budgetInput")) $("budgetInput").value = current.budget || "";
  if ($("totalSpent")) {
    $("totalSpent").innerHTML = totalUSD > 0
      ? `${money(totalARS)}<br><small style="font-size:0.8em; color:var(--pink-700);">${money(totalUSD, "USD")}</small>`
      : money(totalARS);
  }

  if ($("previousSpent")) {
    $("previousSpent").innerHTML = prevUSD > 0
      ? `${money(prevARS)}<br><small style="font-size:0.8em; color:var(--pink-700);">${money(prevUSD, "USD")}</small>`
      : money(prevARS);
  }

  if ($("budgetTotal")) $("budgetTotal").textContent = money(current.budget);
  if ($("previousMonthLabel")) $("previousMonthLabel").textContent = monthName(prevMonth);
  if ($("monthPill")) $("monthPill").textContent = monthName(month);
  if ($("totalMonthName")) $("totalMonthName").textContent = shortMonthName(month).toUpperCase();

  if ($("expenseCount")) {
    $("expenseCount").textContent = `${current.expenses.length} ${current.expenses.length === 1 ? "gasto registrado" : "gastos registrados"}`;
  }

  const diffEl = $("difference");
  if (diffEl) {
    if (prevARS === 0) {
      diffEl.textContent = "—";
      if ($("differenceLabel")) $("differenceLabel").textContent = "Sin datos comparables";
      diffEl.className = "";
    } else {
      diffEl.textContent = `${diffARS <= 0 ? "- " : "+ "}${money(Math.abs(diffARS))}`;
      if ($("differenceLabel")) {
        $("differenceLabel").textContent = diffARS <= 0 ? `↓ ${percentageARS.toFixed(1)}% menos (ARS)` : `↑ ${percentageARS.toFixed(1)}% más (ARS)`;
      }
      diffEl.className = diffARS <= 0 ? "result-good" : "result-bad";
    }
  }

  if ($("budgetStatus")) {
    $("budgetStatus").textContent = current.budget
      ? totalARS <= current.budget ? `${money(current.budget - totalARS)} disponibles` : `${money(totalARS - current.budget)} excedido`
      : "Sin presupuesto";
    $("budgetStatus").className = totalARS <= current.budget || !current.budget ? "" : "result-bad";
  }

  renderMensualesExpensesTable(current.expenses);
  renderExtraIncomesTable(current.extraIncomes);
  renderHistory();
  renderCategories(current.expenses);
  renderTrend(month, totalARS, prevARS, totalUSD);
}

function renderExtraIncomesTable(extraIncomes) {
  const tbody = $("extraIncomeTableBody");
  const totalBadge = $("extraTotalSumDisplay");
  
  if (!tbody) return;

  if (!extraIncomes || extraIncomes.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted);">No hay ingresos ni presupuesto cargados este mes.</td></tr>`;
    if (totalBadge) {
      totalBadge.textContent = document.body.classList.contains("amounts-hidden") ? "Total Ingresos: ••••••" : "Total Ingresos: $0,00";
    }
    return;
  }

  let totalSum = 0;

  tbody.innerHTML = extraIncomes.map(item => {
    totalSum += Number(item.amount || 0);
    const curr = item.currency || "ARS";
    const amountText = curr === "USD" ? `${money(item.rawAmount, "USD")} (${money(item.amount)})` : money(item.amount);
    const isBase = item.isBase === true;
    return `
      <tr>
        <td><span class="category" style="${isBase ? 'background: var(--pink-700); color: white;' : ''}">${escapeHtml(item.category)}</span> ${item.description ? `— <strong>${escapeHtml(item.description)}</strong>` : ""}</td>
        <td>${formatDate(item.date)}</td>
        <td class="amount result-good" style="text-align: right;">+ ${amountText}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="edit-btn" data-id="${item.id}" type="button" title="Editar">✏️</button>
          <button class="delete-btn" data-id="${item.id}" type="button" title="Eliminar">×</button>
        </td>
      </tr>
    `;
  }).join('');

  if (totalBadge) {
    if (document.body.classList.contains("amounts-hidden")) {
      totalBadge.textContent = "Total Ingresos: ••••••";
    } else {
      totalBadge.textContent = `Total Ingresos: ${money(totalSum)}`;
    }
  }

  tbody.querySelectorAll(".edit-btn").forEach(btn => {
    btn.onclick = () => editExtraIncome(btn.dataset.id);
  });

  tbody.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = () => deleteExtraIncome(btn.dataset.id);
  });
}

function editExtraIncome(id) {
  const month = $("monthPicker")?.value;
  const current = data.months[month];
  if (!current || !Array.isArray(current.extraIncomes)) return;
  const item = current.extraIncomes.find(x => x.id === id);
  if (!item) return;

  if ($("modalExtraCategory")) $("modalExtraCategory").value = item.category || "Sueldo";
  if ($("modalExtraDescription")) $("modalExtraDescription").value = item.description || "";
  if ($("modalExtraInput")) $("modalExtraInput").value = item.rawAmount !== undefined ? item.rawAmount : item.amount;
  if ($("modalExtraCurrency")) $("modalExtraCurrency").value = item.currency || "ARS";
  if ($("modalExtraDate")) $("modalExtraDate").value = item.date || currentMonthValue() + "-01";

  if ($("extraDialog")) {
    $("extraDialog").dataset.editingExtraId = item.id;
    const titleEl = $("extraDialog").querySelector("h3");
    if (titleEl) titleEl.textContent = item.isBase ? "✏️ Editar Presupuesto Base" : "✏️ Editar Ingreso Extra";
    $("extraDialog").showModal();
  }
}

window.deleteExtraIncome = async function(id) {
  const month = $("monthPicker")?.value;
  const current = data.months[month];
  if (!current || !Array.isArray(current.extraIncomes)) return;

  const item = current.extraIncomes.find(x => x.id === id);
  if (!item) return;

  if (item.isBase) {
    alert("El presupuesto base no se puede eliminar, pero podés editarlo o ponerle $0.");
    return;
  }

  if (!confirm(`¿Eliminar el registro "${item.category}" por ${money(item.amount)}? Esto restará el monto del presupuesto del mes.`)) return;

  current.extraIncomes = current.extraIncomes.filter(x => x.id !== id);
  current.budget = current.extraIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);

  if ($("budgetInput")) $("budgetInput").value = current.budget;

  renderMensuales();
  await saveMonthToFirestore(month);
};

function renderMensualesExpensesTable(expenses) {
  const table = $("expenseTable");
  if (!table) return;
  table.innerHTML = "";

  let list = expenses.slice();

  if (searchMensualesTerm.trim() !== "") {
    const q = searchMensualesTerm.toLowerCase();
    list = list.filter(e => (e.description || "").toLowerCase().includes(q) || (e.category || "").toLowerCase().includes(q));
  }

  const categoryFilterValue = $("filterCategorySelect")?.value || "";
  if (categoryFilterValue.trim() !== "") {
    const targetCat = categoryFilterValue.trim().toLowerCase();
    list = list.filter(e => String(e.category || "").trim().toLowerCase() === targetCat);
  }

  let filteredARS = 0;
  let filteredUSD = 0;
  list.forEach(e => {
    if (e.currency === "USD") filteredUSD += Number(e.amount || 0);
    else filteredARS += Number(e.amount || 0);
  });

  if ($("tableTotal")) $("tableTotal").textContent = money(filteredARS);
  const tableUSD = $("tableTotalUSD");
  if (tableUSD) {
    tableUSD.style.display = filteredUSD > 0 ? "block" : "none";
    tableUSD.textContent = filteredUSD > 0 ? `+ ${money(filteredUSD, "USD")}` : "";
  }

  if ($("emptyState")) $("emptyState").style.display = list.length ? "none" : "grid";

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
      const activeMonth = $("monthPicker")?.value;
      const expense = data.months[activeMonth]?.expenses.find(x => x.id === btn.dataset.id);
      if (!expense) return;
      
      $("expenseDate").value = expense.date;
      if ($("expenseTargetMonth")) $("expenseTargetMonth").value = activeMonth;
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
      const month = $("monthPicker")?.value;
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

function renderHistory() {
  const table = $("historyTable");
  if (!table) return;
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
  const chart = $("categoryChart");
  if (!chart) return;
  const totals = {};
  expenses.forEach(e => {
    const curr = e.currency || "ARS";
    if (!totals[e.category]) totals[e.category] = { ARS: 0, USD: 0 };
    totals[e.category][curr] += Number(e.amount || 0);
  });
  const entries = Object.entries(totals).sort((a, b) => (b[1].ARS + b[1].USD) - (a[1].ARS + a[1].USD));
  const max = entries[0] ? Math.max(entries[0][1].ARS, entries[0][1].USD) : 1;

  chart.innerHTML = entries.length ? entries.map(([cat, vals]) => {
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
  const trendEl = $("trendText");
  if (!trendEl) return;
  const cur = data.months[month];
  if (!cur || !cur.expenses.length) {
    trendEl.textContent = "Agregá gastos para analizar tus hábitos.";
    return;
  }

  const highestExpense = [...cur.expenses].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const maxExpenseText = highestExpense 
    ? ` Tu mayor gasto registrado fue "${highestExpense.description}" con ${money(highestExpense.amount, highestExpense.currency || "ARS")}.`
    : "";

  const catTotals = {};
  cur.expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
  });
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];
  const topCatText = topCategory ? ` La categoría con mayor gasto fue ${topCategory[0]} (${money(topCategory[1])}).` : "";

  let text = `En ${monthName(month)}, registraste ${money(totalARS)}${totalUSD > 0 ? ` y ${money(totalUSD, "USD")}` : ""} en ${cur.expenses.length} gastos.${topCatText}${maxExpenseText}`;
  if (prevARS) {
    const pct = ((totalARS - prevARS) / prevARS) * 100;
    text += pct <= 0 ? ` Representa un ahorro del ${Math.abs(pct).toFixed(1)}% respecto al mes anterior.` : ` Representa un incremento del ${pct.toFixed(1)}% respecto al mes anterior.`;
  }
  trendEl.textContent = text;
}


/* =========================================================
   FIRESTORE: GASTOS PRÓXIMOS
========================================================= */

function startProximosSync() {
  if (!currentUser) return;
  try {
    const col = collection(db, "users", currentUser.uid, "proximos");
    unsubscribeProximos = onSnapshot(col, snapshot => {
      proximosExpenses = [];
      snapshot.forEach(d => proximosExpenses.push({ id: d.id, ...d.data() }));
      renderProximos();
    }, err => console.error("Error sync proximos:", err));
  } catch (e) {
    console.error("Excepción en startProximosSync:", e);
  }
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

  if ($("gpTotalPending")) {
    $("gpTotalPending").innerHTML = totalUSD > 0 ? `${money(totalARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(totalUSD, "USD")}</small>` : money(totalARS);
  }
  if ($("gpTotalDebts")) {
    $("gpTotalDebts").innerHTML = debtUSD > 0 ? `${money(debtARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(debtUSD, "USD")}</small>` : money(debtARS);
  }

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
  if ($("gpNextSevenDays")) {
    $("gpNextSevenDays").innerHTML = n7USD > 0 ? `${money(n7ARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(n7USD, "USD")}</small>` : money(n7ARS);
  }

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
  if ($("gpThisMonth")) {
    $("gpThisMonth").innerHTML = mUSD > 0 ? `${money(mARS)}<br><small style="color:var(--pink-700); font-size:0.8rem;">${money(mUSD, "USD")}</small>` : money(mARS);
  }

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
  if (!container) return;
  container.innerHTML = "";

  if ($("gpItemsCount")) $("gpItemsCount").textContent = `${list.length} registros`;
  if ($("gpEmptyState")) $("gpEmptyState").style.display = list.length === 0 ? "block" : "none";

  list.forEach(item => {
    const card = document.createElement("article");
    card.className = "gp-expense-card";
    
    const icon = getCategoryIcon(item.category);
    const catName = getCategoryName(item.category);
    const alert = getDueBadge(item.date, item.paid);
    const alertTag = alert ? `<span class="gp-tag" style="background:${alert.bg}; color:${alert.color};">${alert.text}</span>` : "";
    const statusTag = `<span class="gp-tag gp-status-${item.paid ? "paid" : item.type === "debt" ? "debt" : "pending"}">${item.paid ? "Pagado" : item.type === "debt" ? "Deuda" : "Pendiente"}</span>`;

    card.innerHTML = `
      <div class="gp-card-left">
        <div class="gp-card-icon">${icon}</div>
        <div class="gp-card-details">
          <h3>${escapeHtml(item.description)}</h3>
          <p>${catName} · Cantidad: ${item.quantity || 1} ${item.notes ? `· <i>${escapeHtml(item.notes)}</i>` : ""}</p>
          <div class="gp-tags-wrap">
            ${statusTag}
            ${alertTag}
          </div>
        </div>
      </div>

      <div class="gp-card-right">
        <div class="gp-card-date">Pagar <strong>${formatDate(item.date)}</strong></div>
        <div class="gp-card-amount">${item.amount !== null ? money(item.amount, item.currency || "ARS") : "A definir"}</div>
        <div class="gp-card-actions">
          <button class="gp-btn-action gp-btn-pay ${item.paid ? "is-paid" : ""}" data-id="${item.id}" title="${item.paid ? "Volver a pendiente" : "Marcar pagado y enviar a Mensuales"}">${item.paid ? "✖" : "✓"}</button>
          <button class="gp-btn-action gp-btn-edit" data-id="${item.id}" title="Editar">✏️</button>
          <button class="gp-btn-action gp-btn-delete" data-id="${item.id}" title="Eliminar">🗑️</button>
        </div>
      </div>
    `;
    container.appendChild(card);
  });

  container.querySelectorAll(".gp-btn-pay").forEach(btn => {
    btn.onclick = () => togglePayProximo(btn.dataset.id);
  });
  container.querySelectorAll(".gp-btn-edit").forEach(btn => {
    btn.onclick = () => editProximo(btn.dataset.id);
  });
  container.querySelectorAll(".gp-btn-delete").forEach(btn => {
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
    item.linkedMensualId = null;
    item.linkedMonthKey = null;
    
    await setDoc(doc(db, "users", currentUser.uid, "proximos", item.id), { 
      paid: false, 
      linkedMensualId: null, 
      linkedMonthKey: null 
    }, { merge: true });

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


/* =========================================================
   EXPORTAR CSV
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


/* =========================================================
   REPORTES PDF
========================================================= */

function getPdfThemeColors() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const isBlueMode = document.body.classList.contains("dark-blue-mode");

  if (isBlueMode) {
    return {
      pink: [76, 201, 240],
      dark: [255, 255, 255],
      light: [28, 37, 65],
      headerBg: [11, 19, 43],
      cardBorder: [58, 80, 107],
      lineDivider: [38, 55, 80],
      pageBg: [11, 19, 43],
      footerColor: [141, 153, 174]
    };
  } else if (isDarkMode) {
    return {
      pink: [255, 120, 160],
      dark: [240, 240, 240],
      light: [45, 35, 40],
      headerBg: [55, 30, 45],
      cardBorder: [80, 45, 60],
      lineDivider: [50, 35, 42],
      pageBg: [25, 20, 25],
      footerColor: [200, 130, 150]
    };
  } else {
    return {
      pink: [245, 107, 139],
      dark: [85, 21, 45],
      light: [255, 231, 236],
      headerBg: [255, 176, 194],
      cardBorder: [255, 197, 210],
      lineDivider: [245, 220, 227],
      pageBg: null,
      footerColor: [160, 110, 125]
    };
  }
}

function generateMensualesPDF() {
  if (!window.jspdf) {
    alert("No se pudo cargar el generador de PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const month = $("monthPicker")?.value || currentMonthValue();
  const current = ensureMonth(month);

  let totalARS = 0;
  let totalUSD = 0;

  current.expenses.forEach(e => {
    if (e.currency === "USD") {
      totalUSD += Number(e.amount || 0);
    } else {
      totalARS += Number(e.amount || 0);
    }
  });

  const previous = data.months[previousMonth(month)] || { expenses: [] };
  let previousTotalARS = 0;

  previous.expenses.forEach(e => {
    if (e.currency !== "USD") {
      previousTotalARS += Number(e.amount || 0);
    }
  });

  const diffARS = totalARS - previousTotalARS;
  const cardSpentText = totalUSD > 0 ? `${money(totalARS)} + ${money(totalUSD, "USD")}` : money(totalARS);
  
  const budgetText = money(current.budget);
  const diffText = `${diffARS <= 0 ? "- " : "+ "}${money(Math.abs(diffARS))}`;

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const theme = getPdfThemeColors();

  if (theme.pageBg) {
    pdf.setFillColor(...theme.pageBg);
    pdf.rect(0, 0, 210, 297, "F");
  }

  pdf.setFillColor(...theme.headerBg);
  pdf.roundedRect(15, 15, 180, 28, 4, 4, "F");

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(17);
  pdf.setFont("helvetica", "bold");
  pdf.text("CONTROL DE GASTOS MENSUALES", 21, 27);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Reporte · ${monthName(month)}`, 21, 34);

  const cards = [
    ["PRESUPUESTO", budgetText],
    ["TOTAL GASTADO", cardSpentText],
    ["MES ANTERIOR", money(previousTotalARS)],
    ["DIFERENCIA", diffText]
  ];

  cards.forEach((card, index) => {
    const x = 15 + index * 45;
    pdf.setDrawColor(...theme.cardBorder);
    pdf.roundedRect(x, 49, 41, 25, 3, 3, "S");

    pdf.setTextColor(...theme.pink);
    pdf.setFontSize(6.5);
    pdf.setFont("helvetica", "bold");
    pdf.text(card[0], x + 3, 57);

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(8.5);
    pdf.text(card[1], x + 3, 66);
  });

  let y = 84;

  pdf.setFillColor(...theme.pink);
  pdf.rect(15, y, 180, 8, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA", 18, y + 5);
  pdf.text("CONCEPTO / DESCRIPCIÓN", 45, y + 5);
  pdf.text("CATEGORÍA", 120, y + 5);
  pdf.text("MONTO", 165, y + 5);

  y += 8;
  pdf.setFont("helvetica", "normal");

  current.expenses
    .slice()
    .sort((a, b) => String(a.date || "").localeCompare(String(b.date || "")))
    .forEach(expense => {
      if (y > 270) {
        pdf.addPage();
        if (theme.pageBg) {
          pdf.setFillColor(...theme.pageBg);
          pdf.rect(0, 0, 210, 297, "F");
        }
        y = 20;
      }

      const curr = expense.currency || "ARS";
      const cleanDescription = String(expense.description || "").replace("🔄 ", "").trim();

      pdf.setTextColor(...theme.dark);
      pdf.setFontSize(7);
      pdf.text(formatDate(expense.date), 18, y + 5);
      pdf.text(cleanDescription.slice(0, 35), 45, y + 5);
      pdf.text(String(expense.category).slice(0, 18), 120, y + 5);
      pdf.text(money(expense.amount, curr), 165, y + 5);

      pdf.setDrawColor(...theme.lineDivider);
      pdf.line(15, y + 8, 195, y + 8);
      y += 10;
    });

  if (y > 250) {
    pdf.addPage();
    if (theme.pageBg) {
      pdf.setFillColor(...theme.pageBg);
      pdf.rect(0, 0, 210, 297, "F");
    }
    y = 20;
  }

  pdf.setFillColor(...theme.light);
  pdf.rect(15, y, 180, 10, "F");
  pdf.setTextColor(...theme.dark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text(`TOTAL GASTADO EN ${shortMonthName(month).toUpperCase()}`, 18, y + 6);
  pdf.text(cardSpentText, 160, y + 6);

  y += 18;

  if (y > 255) {
    pdf.addPage();
    if (theme.pageBg) {
      pdf.setFillColor(...theme.pageBg);
      pdf.rect(0, 0, 210, 297, "F");
    }
    y = 20;
  }

  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.setTextColor(...theme.dark);
  pdf.text("Análisis de tendencia", 15, y);

  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(8);

  const highestExpense = [...current.expenses].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  const catTotals = {};
  current.expenses.forEach(e => {
    catTotals[e.category] = (catTotals[e.category] || 0) + Number(e.amount || 0);
  });
  const topCategory = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0];

  let trendString = `En ${monthName(month)}, tu presupuesto fue de ${budgetText} y registraste ${cardSpentText} en ${current.expenses.length} gastos.`;
  if (topCategory) {
    trendString += ` La categoría con mayor gasto fue ${topCategory[0]} (${money(topCategory[1])}).`;
  }
  if (highestExpense) {
    const cleanHighDesc = String(highestExpense.description || "").replace("🔄 ", "").trim();
    trendString += ` El concepto en el que más gastaste fue "${cleanHighDesc}" (${money(highestExpense.amount, highestExpense.currency || "ARS")}).`;
  }

  const lines = pdf.splitTextToSize(trendString, 175);
  pdf.text(lines, 15, y + 6);

  pdf.setFontSize(7);
  pdf.setTextColor(...theme.footerColor);
  pdf.text("MENSUALES · Creado por Flor Bagnis", 15, 287);

  pdf.save(`MENSUALES-${month}.pdf`);
}

function generateProximosPDF() {
  if (!window.jspdf) {
    alert("No se pudo cargar la librería para generar el PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const theme = getPdfThemeColors();

  if (theme.pageBg) {
    pdf.setFillColor(...theme.pageBg);
    pdf.rect(0, 0, 210, 297, "F");
  }

  pdf.setFillColor(...theme.headerBg);
  pdf.roundedRect(15, 15, 180, 26, 4, 4, "F");

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(16);
  pdf.setFont("helvetica", "bold");
  pdf.text("AGENDA DE GASTOS PRÓXIMOS", 21, 26);

  const todayStr = new Date().toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "long",
    year: "numeric"
  });

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Reporte emitido el ${todayStr}`, 21, 33);

  const pendingItems = proximosExpenses.filter(e => !e.paid);

  let totalPendingARS = 0;
  let totalPendingUSD = 0;
  let debtsARS = 0;
  let debtsUSD = 0;

  pendingItems.forEach(e => {
    const amt = Number(e.amount || 0);
    if (e.currency === "USD") {
      totalPendingUSD += amt;
      if (e.type === "debt") debtsUSD += amt;
    } else {
      totalPendingARS += amt;
      if (e.type === "debt") debtsARS += amt;
    }
  });

  const strPending = totalPendingUSD > 0 ? `${money(totalPendingARS)} + ${money(totalPendingUSD, "USD")}` : money(totalPendingARS);
  const strDebts = debtsUSD > 0 ? `${money(debtsARS)} + ${money(debtsUSD, "USD")}` : money(debtsARS);

  const cards = [
    ["PENDIENTE TOTAL", strPending],
    ["DEUDAS", strDebts],
    ["ITEMS PENDIENTES", `${pendingItems.length}`]
  ];

  cards.forEach((card, index) => {
    const x = 15 + index * 60;
    pdf.setDrawColor(...theme.cardBorder);
    pdf.roundedRect(x, 46, 56, 22, 3, 3, "S");

    pdf.setTextColor(...theme.pink);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text(card[0], x + 4, 53);

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(9);
    pdf.text(card[1], x + 4, 62);
  });

  let y = 76;

  pdf.setFillColor(...theme.pink);
  pdf.rect(15, y, 180, 7, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text("FECHA", 18, y + 5);
  pdf.text("CONCEPTO / DETALLE", 42, y + 5);
  pdf.text("CATEGORÍA", 115, y + 5);
  pdf.text("ESTADO", 145, y + 5);
  pdf.text("MONTO", 170, y + 5);

  y += 7;
  pdf.setFont("helvetica", "normal");

  const sortedExpenses = [...proximosExpenses].sort((a, b) => new Date(a.date) - new Date(b.date));

  sortedExpenses.forEach(expense => {
    if (y > 270) {
      pdf.addPage();
      if (theme.pageBg) {
        pdf.setFillColor(...theme.pageBg);
        pdf.rect(0, 0, 210, 297, "F");
      }
      y = 20;
    }

    const state = expense.paid ? "Pagado" : expense.type === "debt" ? "Deuda" : "Pendiente";
    const curr = expense.currency || "ARS";
    const amountStr = expense.amount !== null ? money(expense.amount, curr) : "A definir";
    const cleanDesc = String(expense.description || "").replace("🔄 ", "").trim();

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(7);
    pdf.text(formatDate(expense.date), 18, y + 5);
    pdf.text(cleanDesc.slice(0, 38), 42, y + 5);
    pdf.text(getCategoryName(expense.category), 115, y + 5);
    pdf.text(state, 145, y + 5);
    pdf.text(amountStr, 170, y + 5);

    pdf.setDrawColor(...theme.lineDivider);
    pdf.line(15, y + 8, 195, y + 8);
    y += 9;
  });

  if (y > 255) {
    pdf.addPage();
    if (theme.pageBg) {
      pdf.setFillColor(...theme.pageBg);
      pdf.rect(0, 0, 210, 297, "F");
    }
    y = 20;
  }

  pdf.setFillColor(...theme.light);
  pdf.rect(15, y, 180, 9, "F");
  pdf.setTextColor(...theme.dark);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.text("TOTAL PENDIENTE DE PAGO", 18, y + 6);
  pdf.text(strPending, 150, y + 6);

  pdf.setFontSize(7);
  pdf.setTextColor(...theme.footerColor);
  pdf.text("Gastos Próximos · Creado por Flor Bagnis", 15, 287);

  pdf.save(`Gastos-Proximos-${new Date().toISOString().slice(0, 10)}.pdf`);
}


/* =========================================================
   INICIALIZACIÓN SEGURA DE EVENTOS
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
  if ($("monthPicker")) $("monthPicker").value = currentMonthValue();

  // Botón de contraseña (florcita / candado)
  const togglePasswordBtn = document.getElementById('togglePasswordBtn');
  const authPasswordInput = document.getElementById('authPassword');

  if (togglePasswordBtn && authPasswordInput) {
    togglePasswordBtn.addEventListener('click', (e) => {
      e.preventDefault();
      const isPassword = authPasswordInput.type === 'password';
      authPasswordInput.type = isPassword ? 'text' : 'password';
      togglePasswordBtn.textContent = isPassword ? '🌸' : '🔒';
    });
  }

  // GESTIÓN DE TEMA (Claro ☀️, Oscuro 🌙, Azul Oscuro 🔹)
  const toggleThemeBtn = $("toggleThemeBtn");
  const toggleBlueThemeBtn = $("toggleBlueThemeBtn");

  const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else if (savedTheme === "blue") {
    document.body.classList.add("dark-blue-mode");
  }

  toggleThemeBtn?.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark-mode");
    document.body.classList.remove("dark-blue-mode");
    localStorage.setItem("mensual_theme_mode", isDark ? "dark" : "light");
  });

  toggleBlueThemeBtn?.addEventListener("click", () => {
    const isBlue = document.body.classList.toggle("dark-blue-mode");
    document.body.classList.remove("dark-mode");
    localStorage.setItem("mensual_theme_mode", isBlue ? "blue" : "light");
  });

  $("authSwitchBtn")?.addEventListener("click", () => {
    authMode = authMode === "login" ? "register" : "login";
    updateAuthInterface();
  });

  $("authForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const email = $("authEmail")?.value.trim() || "";
    const password = $("authPassword")?.value || "";

    const button = $("authSubmitBtn");
    if (button) {
      button.disabled = true;
      button.textContent = authMode === "login" ? "Ingresando..." : "Creando cuenta...";
    }

    try {
      if (authMode === "register") {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (error) {
      console.error("Auth Error:", error);
      setAuthMessage(firebaseErrorMessage(error));
      if (button) button.disabled = false;
      updateAuthInterface();
    }
  });

  $("logoutBtn")?.addEventListener("click", async () => {
    if (!confirm("¿Querés cerrar sesión?")) return;
    try {
      localStorage.removeItem('user_logged_in');
      stopAllSync();
      await signOut(auth);
    } catch (err) {
      alert("No se pudo cerrar la sesión.");
    }
  });

  $("tabMensualesBtn")?.addEventListener("click", () => {
    $("tabMensualesBtn").className = "btn btn-pink";
    if ($("tabProximosBtn")) $("tabProximosBtn").className = "btn btn-outline";
    $("viewMensuales")?.classList.remove("hidden");
    $("viewProximos")?.classList.add("hidden");
  });

  $("tabProximosBtn")?.addEventListener("click", () => {
    $("tabProximosBtn").className = "btn btn-pink";
    if ($("tabMensualesBtn")) $("tabMensualesBtn").className = "btn btn-outline";
    $("viewProximos")?.classList.remove("hidden");
    $("viewMensuales")?.classList.add("hidden");
  });

  $("monthPicker")?.addEventListener("change", () => renderMensuales());
  
  $("searchMensualesInput")?.addEventListener("input", e => {
    searchMensualesTerm = e.target.value;
    renderMensuales();
  });

  $("filterCategorySelect")?.addEventListener("change", () => {
    renderMensuales();
  });

  // Gastos recurrentes
  const expenseRecurring = $("expenseRecurring");
  const recurringOptions = $("recurringOptions");
  const recurringChangingAmount = $("recurringChangingAmount");
  const recurringAmounts = $("recurringAmounts");
  const recurringDuration = $("recurringDuration");
  const recurringMonthsInput = $("recurringMonths");
  const recurringDay = $("recurringDay");

  expenseRecurring?.addEventListener("change", () => {
    recurringOptions?.classList.toggle("hidden", !expenseRecurring.checked);
    if (expenseRecurring.checked) updateRecurringInputs();
  });

  recurringChangingAmount?.addEventListener("change", () => {
    recurringAmounts?.classList.toggle("hidden", !recurringChangingAmount.checked);
    if (recurringChangingAmount.checked) updateRecurringInputs();
  });

  function updateRecurringInputs() {
    if (!recurringAmounts) return;
    recurringAmounts.innerHTML = "";
    if (!expenseRecurring?.checked || !recurringChangingAmount?.checked) return;

    const count = Number(recurringDuration?.value) || 6;
    const baseAmount = Number($("expenseAmount")?.value || 0);
    const interval = Number(recurringMonthsInput?.value) || 1;
    let baseDate = new Date(($("expenseDate")?.value || currentMonthValue() + "-01") + "T00:00:00");

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i * interval), Number(recurringDay?.value || 10));
      const mLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(d);

      const label = document.createElement("label");
      label.style.cssText = "display:grid; grid-template-columns: 1fr 120px; gap:8px; align-items:center; font-size:11px; margin-top:6px;";
      label.innerHTML = `
        <span>${mLabel.charAt(0).toUpperCase() + mLabel.slice(1)}</span>
        <input type="number" min="0" step="0.01" class="rec-amount-input" data-index="${i}" value="${baseAmount}" required style="padding:6px 8px; border:1px solid var(--line); border-radius:8px; font-size:12px;">
      `;
      recurringAmounts.appendChild(label);
    }
  }

  recurringDuration?.addEventListener("input", updateRecurringInputs);
  recurringMonthsInput?.addEventListener("input", updateRecurringInputs);
  recurringDay?.addEventListener("input", updateRecurringInputs);
  $("expenseAmount")?.addEventListener("input", () => {
    if (!recurringChangingAmount?.checked) return;
    const baseAmount = Number($("expenseAmount")?.value || 0);
    recurringAmounts?.querySelectorAll(".rec-amount-input").forEach(inp => {
      if (!inp.dataset.userEdited) inp.value = baseAmount;
    });
  });

  recurringAmounts?.addEventListener("input", e => {
    if (e.target.classList.contains("rec-amount-input")) {
      e.target.dataset.userEdited = "true";
    }
  });

  /* =========================================================
     GESTIÓN DE DINERO EXTRA / INGRESOS (CON FECHA Y FRECUENCIA)
  ========================================================= */

  const extraRecurring = $("extraRecurring");
  const extraRecurringOptions = $("extraRecurringOptions");
  const extraChangingAmount = $("extraChangingAmount");
  const extraRecurringAmounts = $("extraRecurringAmounts");
  const extraDuration = $("extraDuration");
  const extraMonthsInput = $("extraMonths");
  const extraDay = $("extraDay");

  extraRecurring?.addEventListener("change", () => {
    extraRecurringOptions?.classList.toggle("hidden", !extraRecurring.checked);
    if (extraRecurring.checked) updateExtraRecurringInputs();
  });

  extraChangingAmount?.addEventListener("change", () => {
    extraRecurringAmounts?.classList.toggle("hidden", !extraChangingAmount.checked);
    if (extraChangingAmount.checked) updateExtraRecurringInputs();
  });

  function updateExtraRecurringInputs() {
    if (!extraRecurringAmounts) return;
    extraRecurringAmounts.innerHTML = "";
    if (!extraRecurring?.checked || !extraChangingAmount?.checked) return;

    const count = Number(extraDuration?.value) || 6;
    const baseAmount = Number($("modalExtraInput")?.value || 0);
    const interval = Number(extraMonthsInput?.value) || 1;
    let baseDate = new Date(($("modalExtraDate")?.value || currentMonthValue() + "-01") + "T00:00:00");

    for (let i = 0; i < count; i++) {
      const d = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i * interval), Number(extraDay?.value || 10));
      const mLabel = new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric" }).format(d);

      const label = document.createElement("label");
      label.style.cssText = "display:grid; grid-template-columns: 1fr 120px; gap:8px; align-items:center; font-size:11px; margin-top:6px;";
      label.innerHTML = `
        <span>${mLabel.charAt(0).toUpperCase() + mLabel.slice(1)}</span>
        <input type="number" min="0" step="0.01" class="extra-rec-amount-input" data-index="${i}" value="${baseAmount}" required style="padding:6px 8px; border:1px solid var(--line); border-radius:8px; font-size:12px;">
      `;
      extraRecurringAmounts.appendChild(label);
    }
  }

  extraDuration?.addEventListener("input", updateExtraRecurringInputs);
  extraMonthsInput?.addEventListener("input", updateExtraRecurringInputs);
  extraDay?.addEventListener("input", updateExtraRecurringInputs);
  $("modalExtraInput")?.addEventListener("input", () => {
    if (!extraChangingAmount?.checked) return;
    const baseAmount = Number($("modalExtraInput")?.value || 0);
    extraRecurringAmounts?.querySelectorAll(".extra-rec-amount-input").forEach(inp => {
      if (!inp.dataset.userEdited) inp.value = baseAmount;
    });
  });

  extraRecurringAmounts?.addEventListener("input", e => {
    if (e.target.classList.contains("extra-rec-amount-input")) {
      e.target.dataset.userEdited = "true";
    }
  });

  $("openExtraModalBtn")?.addEventListener("click", () => {
    if ($("modalExtraInput")) $("modalExtraInput").value = "";
    if ($("modalExtraDescription")) $("modalExtraDescription").value = "";
    if ($("modalExtraCategory")) $("modalExtraCategory").value = "Sueldo";
    if ($("modalExtraDate")) {
      const today = new Date();
      $("modalExtraDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    extraRecurringOptions?.classList.add("hidden");
    extraRecurringAmounts?.classList.add("hidden");
    if (extraRecurring) extraRecurring.checked = false;
    if (extraChangingAmount) extraChangingAmount.checked = false;

    if ($("extraDialog")) {
      delete $("extraDialog").dataset.editingExtraId;
      const titleEl = $("extraDialog").querySelector("h3");
      if (titleEl) titleEl.textContent = "➕ Sumar Dinero Extra";
      $("extraDialog").showModal();
    }
  });

  $("closeExtraDialog")?.addEventListener("click", () => {
    $("extraDialog")?.close();
  });

  $("submitExtraBtn")?.addEventListener("click", async () => {
    const rawVal = Number($("modalExtraInput")?.value || 0);
    if (rawVal <= 0) {
      alert("Ingresá un monto válido para sumar.");
      return;
    }

    const category = $("modalExtraCategory")?.value || "Otro";
    const description = $("modalExtraDescription")?.value.trim() || "";
    const currency = $("modalExtraCurrency")?.value || "ARS";
    const baseDateStr = $("modalExtraDate")?.value || new Date().toISOString().slice(0, 10);
    const targetMonth = baseDateStr.slice(0, 7);

    let finalVal = rawVal;
    if (currency === "USD") {
      if (currentDolarBlue <= 0) {
        try {
          const res = await fetch("https://dolarapi.com/v1/dolares/blue");
          const json = await res.json();
          if (json?.venta) currentDolarBlue = Number(json.venta);
        } catch(e) {}
      }
      if (currentDolarBlue > 0) {
        finalVal = rawVal * currentDolarBlue;
      } else {
        const customRate = prompt("Ingresá a cuánto querés tomar el dólar:", "1200");
        if (!customRate) return;
        finalVal = rawVal * Number(customRate);
      }
    }

    const editingId = $("extraDialog")?.dataset.editingExtraId;

    if (editingId) {
      const month = $("monthPicker")?.value;
      const current = data.months[month];
      if (current && Array.isArray(current.extraIncomes)) {
        const index = current.extraIncomes.findIndex(x => x.id === editingId);
        if (index !== -1) {
          const wasBase = current.extraIncomes[index].isBase;
          current.extraIncomes[index] = {
            ...current.extraIncomes[index],
            date: baseDateStr,
            category: wasBase ? "Presupuesto Base" : category,
            description,
            amount: finalVal,
            rawAmount: rawVal,
            currency,
            isBase: wasBase
          };
          current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          if ($("budgetInput")) $("budgetInput").value = current.budget;
          renderMensuales();
          await saveMonthToFirestore(month);
        }
      }
    } else {
      const isRecurring = extraRecurring?.checked;

      if (!isRecurring) {
        const current = ensureMonth(targetMonth);
        if (!Array.isArray(current.extraIncomes)) current.extraIncomes = [];
        current.extraIncomes.push({
          id: createId("extra"),
          date: baseDateStr,
          category,
          description,
          amount: finalVal,
          rawAmount: rawVal,
          currency
        });
        current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
        await saveMonthToFirestore(targetMonth);
      } else {
        const count = Number(extraDuration?.value) || 6;
        const interval = Number(extraMonthsInput?.value) || 1;
        const dayNum = Number(extraDay?.value) || 10;
        const changing = extraChangingAmount?.checked;
        const customInputs = extraRecurringAmounts?.querySelectorAll(".extra-rec-amount-input");

        let baseDate = new Date(baseDateStr + "T00:00:00");

        for (let i = 0; i < count; i++) {
          const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i * interval), dayNum);
          const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
          const dateStr = `${monthKey}-${String(targetDate.getDate()).padStart(2, "0")}`;

          let currentRaw = rawVal;
          let currentFinal = finalVal;

          if (changing && customInputs && customInputs[i]) {
            currentRaw = Number(customInputs[i].value) || rawVal;
            currentFinal = currency === "USD" ? currentRaw * (currentDolarBlue > 0 ? currentDolarBlue : 1) : currentRaw;
          }

          const finalDesc = `🔄 ${description ? description + " " : ""}(Cuota ${i + 1}/${count})`.trim();
          const monthData = ensureMonth(monthKey);
          if (!Array.isArray(monthData.extraIncomes)) monthData.extraIncomes = [];

          monthData.extraIncomes.push({
            id: createId("extra"),
            date: dateStr,
            category,
            description: finalDesc,
            amount: currentFinal,
            rawAmount: currentRaw,
            currency
          });
          monthData.budget = monthData.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          await saveMonthToFirestore(monthKey);
        }
        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
        alert(`✓ Ingreso extra repetido exitosamente durante ${count} período(s).`);
      }
    }

    $("extraDialog")?.close();
  });

  $("saveBudgetBtn")?.addEventListener("click", async () => {
    const month = $("monthPicker")?.value;
    if (!month) return;
    const current = ensureMonth(month);
    const baseVal = Number($("budgetInput")?.value || 0);

    if (!Array.isArray(current.extraIncomes)) current.extraIncomes = [];
    
    let baseEntry = current.extraIncomes.find(x => x.isBase === true);
    if (baseEntry) {
      baseEntry.amount = baseVal;
      baseEntry.rawAmount = baseVal;
    } else if (baseVal > 0) {
      current.extraIncomes.unshift({
        id: createId("base"),
        isBase: true,
        date: new Date().toISOString().slice(0, 10),
        category: "Presupuesto Base",
        description: "Presupuesto inicial del mes",
        amount: baseVal,
        rawAmount: baseVal,
        currency: "ARS"
      });
    }

    current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    renderMensuales();
    await saveMonthToFirestore(month);
    alert("Presupuesto guardado correctamente.");
  });

  $("addExpenseBtn")?.addEventListener("click", () => {
    $("expenseForm")?.reset();
    if ($("expenseForm")) delete $("expenseForm").dataset.editingId;
    
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if ($("expenseDate")) $("expenseDate").value = todayStr;

    const currentActiveMonth = $("monthPicker")?.value || currentMonthValue();
    if ($("expenseTargetMonth")) $("expenseTargetMonth").value = currentActiveMonth;

    if ($("modalTitle")) $("modalTitle").textContent = "Agregar gasto";
    recurringOptions?.classList.add("hidden");
    recurringAmounts?.classList.add("hidden");
    $("expenseDialog")?.showModal();
  });

  $("closeDialog")?.addEventListener("click", () => $("expenseDialog")?.close());
  $("cancelDialog")?.addEventListener("click", () => $("expenseDialog")?.close());

  $("expenseForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const editingId = $("expenseForm").dataset.editingId;
    const baseDateStr = $("expenseDate").value;
    const targetMonth = $("expenseTargetMonth")?.value || baseDateStr.slice(0, 7);
    const description = $("expenseDescription").value.trim();
    const category = $("expenseCategory").value;
    const baseAmount = Number($("expenseAmount").value);
    const currency = $("expenseCurrency")?.value || "ARS";

    if (editingId) {
      let oldMonthKey = null;
      let expenseObj = null;
      for (const [mKey, mData] of Object.entries(data.months)) {
        const found = (mData.expenses || []).find(x => x.id === editingId);
        if (found) {
          oldMonthKey = mKey;
          expenseObj = found;
          break;
        }
      }

      if (expenseObj && oldMonthKey) {
        expenseObj.date = baseDateStr; 
        expenseObj.description = description; 
        expenseObj.category = category; 
        expenseObj.amount = baseAmount; 
        expenseObj.currency = currency;

        if (oldMonthKey !== targetMonth) {
          data.months[oldMonthKey].expenses = data.months[oldMonthKey].expenses.filter(x => x.id !== editingId);
          const newMonthData = ensureMonth(targetMonth);
          newMonthData.expenses.push(expenseObj);

          await saveMonthToFirestore(oldMonthKey);
          await saveMonthToFirestore(targetMonth);
        } else {
          await saveMonthToFirestore(targetMonth);
        }

        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
      } else {
        const monthData = ensureMonth(targetMonth);
        const exp = monthData.expenses.find(x => x.id === editingId);
        if (exp) {
          exp.date = baseDateStr; 
          exp.description = description; 
          exp.category = category; 
          exp.amount = baseAmount; 
          exp.currency = currency;
          if ($("monthPicker")) $("monthPicker").value = targetMonth;
          renderMensuales();
          await saveMonthToFirestore(targetMonth);
        }
      }
    } else {
      const isRecurring = expenseRecurring?.checked;

      if (!isRecurring) {
        const expense = { id: createId("expense"), date: baseDateStr, description, category, amount: baseAmount, currency };
        const monthData = ensureMonth(targetMonth);
        monthData.expenses.push(expense);
        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
        await saveMonthToFirestore(targetMonth);
      } else {
        const count = Number(recurringDuration?.value) || 6;
        const interval = Number(recurringMonthsInput?.value) || 1;
        const dayNum = Number(recurringDay?.value) || 10;
        const changing = recurringChangingAmount?.checked;
        const customInputs = recurringAmounts?.querySelectorAll(".rec-amount-input");

        let baseDate = new Date(baseDateStr + "T00:00:00");

        for (let i = 0; i < count; i++) {
          const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i * interval), dayNum);
          const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
          const dateStr = `${monthKey}-${String(targetDate.getDate()).padStart(2, "0")}`;

          let amount = baseAmount;
          if (changing && customInputs && customInputs[i]) {
            amount = Number(customInputs[i].value) || baseAmount;
          }

          const finalDescription = `🔄 ${description} (Cuota ${i + 1}/${count})`;

          const expense = { id: createId("expense"), date: dateStr, description: finalDescription, category, amount, currency };
          const monthData = ensureMonth(monthKey);
          monthData.expenses.push(expense);
          await saveMonthToFirestore(monthKey);
        }
        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
        alert(`✓ Gasto repetido exitosamente durante ${count} período(s).`);
      }
    }

    $("expenseDialog")?.close();
  });

  $("clearMonthBtn")?.addEventListener("click", async () => {
    const month = $("monthPicker")?.value;
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
    $("gpExpenseForm")?.reset();
    if ($("gpExpenseId")) $("gpExpenseId").value = "";
    if ($("gpDate")) {
      const today = new Date();
      $("gpDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    }
    if ($("gpModalTitle")) $("gpModalTitle").textContent = "Agregar registro pendiente";
    $("gpModal")?.showModal();
  });

  $("gpCloseModalBtn")?.addEventListener("click", () => $("gpModal")?.close());
  $("gpCancelBtn")?.addEventListener("click", () => $("gpModal")?.close());

  $("gpExpenseForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const id = $("gpExpenseId").value || createId("proximo");
    const type = document.querySelector('input[name="gpType"]:checked')?.value || "expense";
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
    $("gpModal")?.close();
  });

  $("mensualesCsvBtn")?.addEventListener("click", () => {
    const month = $("monthPicker")?.value;
    const current = ensureMonth(month);
    
    const rows = [
      [`"Presupuesto del mes"`, `"${current.budget}"`],
      [],
      ["Fecha", "Descripción", "Categoría", "Monto", "Moneda"]
    ];

    current.expenses.forEach(e => {
      rows.push([e.date, `"${(e.description || "").replace(/"/g, '""')}"`, e.category, e.amount, e.currency || "ARS"]);
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

  $("pdfBtn")?.addEventListener("click", generateMensualesPDF);
  $("gpPdfBtn")?.addEventListener("click", generateProximosPDF);

  const toggleAmountsBtn = $("toggleAmountsBtn");
  if (localStorage.getItem("mensuales_hide_amounts") === "true") {
    document.body.classList.add("amounts-hidden");
    if (toggleAmountsBtn) toggleAmountsBtn.textContent = "👁️ Mostrar montos";
  }

  toggleAmountsBtn?.addEventListener("click", () => {
    const hidden = document.body.classList.toggle("amounts-hidden");
    localStorage.setItem("mensuales_hide_amounts", hidden);
    toggleAmountsBtn.textContent = hidden ? "👁️ Mostrar montos" : "👁️ Ocultar montos";
    renderMensuales();
  });

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
  setupCollapsible("toggleExtraHistoryBtn", $("extraHistoryContainer"), "mensuales_extra_history_collapsed", "historial extra");
});


/* =========================================================
   RESUMEN ANUAL Y EXPORTACIÓN PDF
========================================================= */

function calculateAnnualData() {
  const currentYear = new Date().getFullYear().toString();
  let totalARS = 0;
  let totalUSD = 0;
  let monthsCount = 0;
  let highestMonth = { name: "—", amount: 0 };
  const categoryTotals = {};

  if (!data || !data.months) {
    return { currentYear, totalARS, totalUSD, monthsCount: 0, avgARS: 0, highestMonth, topCategory: ["—", 0] };
  }

  Object.entries(data.months).forEach(([monthKey, monthData]) => {
    if (!monthKey.startsWith(currentYear)) return;
    monthsCount++;
    
    let monthARS = 0;
    let monthUSD = 0;

    (monthData.expenses || []).forEach(e => {
      const amt = Number(e.amount || 0);
      if (e.currency === "USD") {
        monthUSD += amt;
        totalUSD += amt;
      } else {
        monthARS += amt;
        totalARS += amt;
      }

      const cat = e.category || "Otros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + (e.currency === "USD" ? amt * 1000 : amt);
    });

    if (monthARS > highestMonth.amount) {
      highestMonth = { name: monthName(monthKey), amount: monthARS };
    }
  });

  const avgARS = monthsCount > 0 ? totalARS / monthsCount : 0;
  const topCategory = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];

  return { currentYear, totalARS, totalUSD, monthsCount, avgARS, highestMonth, topCategory };
}

function openAnnualModal() {
  const annual = calculateAnnualData();
  const content = $("annualContent");
  if (!content) return;

  $("annualSubtitle").textContent = `Año ${annual.currentYear} · Basado en ${annual.monthsCount} meses registrados`;

  content.innerHTML = `
    <div class="annual-card-grid">
      <div class="annual-mini-card">
        <span>TOTAL GASTADO (ARS)</span>
        <strong>${money(annual.totalARS)}</strong>
      </div>
      <div class="annual-mini-card">
        <span>PROMEDIO MENSUAL</span>
        <strong>${money(annual.avgARS)}</strong>
      </div>
    </div>
    <div class="annual-card-grid">
      <div class="annual-mini-card">
        <span>MES MÁS ALTO</span>
        <strong>${annual.highestMonth.name}</strong>
      </div>
      <div class="annual-mini-card">
        <span>CATEGORÍA PRINCIPAL</span>
        <strong>${annual.topCategory[0]}</strong>
      </div>
    </div>
  `;

  $("annualDialog")?.showModal();
}

function generateAnnualPDF() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) {
    alert("No se pudo cargar el generador de PDF. Verificá tu conexión a internet o si hay algún bloqueador de publicidad activo.");
    return;
  }

  const annual = calculateAnnualData();
  const pdf = new jsPDFLib({ unit: "mm", format: "a4" });
  const theme = getPdfThemeColors();

  if (theme.pageBg) {
    pdf.setFillColor(...theme.pageBg);
    pdf.rect(0, 0, 210, 297, "F");
  }

  pdf.setFillColor(...theme.headerBg);
  pdf.roundedRect(15, 15, 180, 26, 4, 4, "F");

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(`RESUMEN FINANCIERO ANUAL (${annual.currentYear})`, 21, 25);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...theme.footerColor);
  pdf.text(`Generado por Flor Bagnis · Mensuales PWA`, 21, 33);

  const cardWidth = 87;
  const cardHeight = 24;
  let startY = 48;

  const cardsData = [
    { title: "TOTAL GASTADO (ARS)", value: money(annual.totalARS) },
    { title: "PROMEDIO MENSUAL", value: money(annual.avgARS) },
    { title: "MES MÁS ALTO", value: `${annual.highestMonth.name} (${money(annual.highestMonth.amount)})` },
    { title: "CATEGORÍA PRINCIPAL", value: annual.topCategory[0] }
  ];

  cardsData.forEach((card, index) => {
    const col = index % 2;
    const row = Math.floor(index / 2);
    const x = 15 + col * (cardWidth + 6);
    const y = startY + row * (cardHeight + 6);

    pdf.setFillColor(...theme.light);
    pdf.setDrawColor(...theme.cardBorder);
    pdf.roundedRect(x, y, cardWidth, cardHeight, 3, 3, "FD");

    pdf.setTextColor(...theme.footerColor);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text(card.title, x + 6, y + 8);

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(String(card.value), x + 6, y + 17);
  });

  let currentY = startY + 2 * (cardHeight + 6) + 5;

  if (annual.totalUSD > 0) {
    pdf.setFillColor(...theme.light);
    pdf.setDrawColor(...theme.cardBorder);
    pdf.roundedRect(15, currentY, 180, 18, 3, 3, "FD");

    pdf.setTextColor(...theme.footerColor);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("TOTAL GASTADO EN USD", 21, currentY + 6);

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(11);
    pdf.setFont("helvetica", "bold");
    pdf.text(money(annual.totalUSD, "USD"), 21, currentY + 13);

    currentY += 24;
  }

  pdf.setFillColor(...theme.light);
  pdf.setDrawColor(...theme.cardBorder);
  pdf.roundedRect(15, currentY, 180, 26, 3, 3, "FD");

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(9);
  pdf.setFont("helvetica", "bold");
  pdf.text("Análisis del período", 21, currentY + 7);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.setTextColor(...theme.dark);
  const summaryText = `Durante el año ${annual.currentYear}, registraste movimientos in ${annual.monthsCount} meses. Tu mes con mayor actividad financiera fue ${annual.highestMonth.name} y la categoría que acumuló más gastos resultó ser "${annual.topCategory[0]}".`;
  const splitSummary = pdf.splitTextToSize(summaryText, 168);
  pdf.text(splitSummary, 21, currentY + 14);

  pdf.setFontSize(7);
  pdf.setTextColor(...theme.footerColor);
  pdf.text("Resumen Anual · Creado por Flor Bagnis", 15, 287);

  pdf.save(`Resumen-Anual-${annual.currentYear}.pdf`);
}


/* =========================================================
   EVENTOS GLOBALES (DELEGACIÓN SEGURO)
========================================================= */
document.addEventListener('click', (e) => {
  if (e.target.closest('#openAnnualBtn')) {
    openAnnualModal();
  }

  if (e.target.closest('#closeAnnualDialog')) {
    $("annualDialog")?.close();
  }

  if (e.target.closest('#closeAnnualCancelBtn')) {
    $("annualDialog")?.close();
  }

  if (e.target.closest('#annualPdfBtn')) {
    generateAnnualPDF();
  }
});
