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
  navigator.serviceWorker.register("./sw.js").catch(e => console.log("SW:", e));
}

let currentUser = null;
let unsubscribeMonths = null;
let authMode = "login";
let currentDolarBlue = 0;

let data = { months: {} };
let searchMensualesTerm = "";

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
   AUTENTICACIÓN Y FLORCITA DE CONTRASEÑA
========================================================= */

function setAuthMessage(message, success = false) {
  const msg = $("authMessage");
  if (!msg) return;
  msg.textContent = message;
  msg.classList.toggle("success", success);
}

function updateAuthInterface() {
  const isLogin = authMode === "login";
  const btn = $("authSubmitBtn");
  const switchBtn = $("authSwitchBtn");

  if (btn) {
    btn.disabled = false;
    btn.textContent = isLogin ? "Iniciar sesión" : "Crear cuenta";
  }
  if (switchBtn) {
    switchBtn.textContent = isLogin ? "¿No tenés una cuenta? Registrate" : "¿Ya tenés una cuenta? Iniciá sesión";
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

async function handleAuthSubmit(e) {
  if (e) e.preventDefault();
  const email = $("authEmail")?.value.trim() || "";
  const password = $("authPassword")?.value || "";

  if (!email || !password) {
    setAuthMessage("Completá email y contraseña.");
    return;
  }

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
    if (button) {
      button.disabled = false;
      button.textContent = authMode === "login" ? "Iniciar sesión" : "Crear cuenta";
    }
  }
}

document.addEventListener("submit", (e) => {
  if (e.target && e.target.id === "authForm") {
    handleAuthSubmit(e);
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;
  if (!user) {
    localStorage.removeItem('user_logged_in');
    stopAllSync();
    data = { months: {} };
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
  } catch (e) {
    console.error("Error sincronización:", e);
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
}


/* =========================================================
   RENDER DE DATOS Y RESUMEN
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
  previous.expenses.forEach(e => {
    if (e.currency !== "USD") prevARS += Number(e.amount || 0);
  });

  const diffARS = totalARS - prevARS;
  const percentageARS = prevARS ? Math.abs((diffARS / prevARS) * 100) : 0;

  if ($("budgetInput")) $("budgetInput").value = current.budget || "";
  if ($("totalSpent")) $("totalSpent").textContent = money(totalARS);
  if ($("previousSpent")) $("previousSpent").textContent = money(prevARS);
  if ($("budgetTotal")) $("budgetTotal").textContent = money(current.budget);
  if ($("previousMonthLabel")) $("previousMonthLabel").textContent = monthName(prevMonth);
  if ($("monthPill")) $("monthPill").textContent = shortMonthName(month);
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
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--muted);">No hay ingresos extra cargados este mes.</td></tr>`;
    if (totalBadge) totalBadge.textContent = "Total Extra: $0,00";
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
        <td class="amount" style="text-align: right;">+ ${amountText}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="pastel-btn btn-sm edit-extra-btn" data-id="${item.id}" type="button" title="Editar">✏️</button>
          <button class="btn btn-danger btn-sm delete-extra-btn" data-id="${item.id}" type="button" title="Eliminar">×</button>
        </td>
      </tr>
    `;
  }).join('');

  if (totalBadge) totalBadge.textContent = `Total Extra: ${money(totalSum)}`;

  tbody.querySelectorAll(".edit-extra-btn").forEach(btn => {
    btn.onclick = () => {
      const activeMonth = $("monthPicker")?.value || currentMonthValue();
      const item = data.months[activeMonth]?.extraIncomes.find(x => x.id === btn.dataset.id);
      if (!item) return;

      if ($("modalExtraDate")) $("modalExtraDate").value = item.date || `${activeMonth}-01`;
      if ($("modalExtraTargetMonth")) $("modalExtraTargetMonth").value = activeMonth;
      if ($("modalExtraCategory")) $("modalExtraCategory").value = item.category || "Sueldo";
      if ($("modalExtraDescription")) $("modalExtraDescription").value = item.description || "";
      if ($("modalExtraInput")) $("modalExtraInput").value = item.rawAmount !== undefined ? item.rawAmount : item.amount;
      if ($("modalExtraCurrency")) $("modalExtraCurrency").value = item.currency || "ARS";

      const extraRecurring = $("extraRecurring");
      const extraRecurringOptions = $("extraRecurringOptions");
      if (extraRecurring) extraRecurring.checked = false;
      extraRecurringOptions?.classList.add("hidden");

      if ($("extraDialog")) {
        $("extraDialog").dataset.editingExtraId = item.id;
        $("extraDialog").showModal();
      }
    };
  });

  tbody.querySelectorAll(".delete-extra-btn").forEach(btn => {
    btn.onclick = async () => {
      const month = $("monthPicker")?.value;
      const current = data.months[month];
      if (!current) return;
      const item = current.extraIncomes.find(x => x.id === btn.dataset.id);
      if (!item) return;
      if (item.isBase) {
        alert("El presupuesto base no se puede eliminar directamente, editalo con el lápiz.");
        return;
      }
      if (!confirm(`¿Eliminar el registro "${item.category}"?`)) return;
      current.extraIncomes = current.extraIncomes.filter(x => x.id !== btn.dataset.id);
      current.budget = current.extraIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      if ($("budgetInput")) $("budgetInput").value = current.budget;
      renderMensuales();
      await saveMonthToFirestore(month);
    };
  });
}

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

  if ($("emptyState")) $("emptyState").style.display = list.length ? "none" : "block";

  list.sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).forEach(e => {
    const row = document.createElement("tr");
    const curr = e.currency || "ARS";
    row.innerHTML = `
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="category">${escapeHtml(e.category)}</span></td>
      <td class="amount" style="text-align: right;">${money(e.amount, curr)}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="pastel-btn btn-sm edit-btn" data-id="${e.id}" type="button" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${e.id}" type="button" title="Eliminar">×</button>
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
      if ($("modalTitle")) $("modalTitle").textContent = "Editar gasto";
      $("expenseDialog")?.showModal();
    };
  });

  table.querySelectorAll(".delete-btn").forEach(btn => {
    btn.onclick = async () => {
      if (!confirm("¿Eliminar este gasto?")) return;
      const month = $("monthPicker")?.value;
      const monthData = data.months[month];
      if (!monthData) return;
      monthData.expenses = monthData.expenses.filter(x => x.id !== btn.dataset.id);
      renderMensuales();
      await saveMonthToFirestore(month);
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
    let ars = 0;
    cur.expenses.forEach(e => { if (e.currency !== "USD") ars += Number(e.amount || 0); });
    const res = Number(cur.budget || 0) - ars;
    const row = document.createElement("tr");
    row.innerHTML = `
      <td><b>${monthName(m)}</b></td>
      <td>${money(cur.budget)}</td>
      <td>${money(ars)}</td>
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
      <div style="margin-bottom: 8px;">
        <div style="display: flex; justify-content: space-between; font-size: 0.85rem; font-weight: 700; margin-bottom: 2px;">
          <span>${escapeHtml(cat)}</span>
          <b>${label}</b>
        </div>
        <div style="background: var(--pink-bg); height: 8px; border-radius: 6px; overflow: hidden;">
          <div style="width:${Math.min(100, (val / max) * 100)}%; background: var(--pink-500); height: 100%; border-radius: 6px;"></div>
        </div>
      </div>
    `;
  }).join("") : `<div style="text-align: center; color: var(--muted); padding: 15px;">No hay categorías registradas.</div>`;
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
  const maxExpenseText = highestExpense ? ` Tu mayor gasto fue "${highestExpense.description}" con ${money(highestExpense.amount, highestExpense.currency || "ARS")}.` : "";
  let text = `En ${monthName(month)}, registraste ${money(totalARS)}${totalUSD > 0 ? ` y ${money(totalUSD, "USD")}` : ""} en ${cur.expenses.length} gastos.${maxExpenseText}`;
  if (prevARS) {
    const pct = ((totalARS - prevARS) / prevARS) * 100;
    text += pct <= 0 ? ` Representa un ahorro del ${Math.abs(pct).toFixed(1)}% respecto al mes anterior.` : ` Representa un incremento del ${pct.toFixed(1)}% respecto al mes anterior.`;
  }
  trendEl.textContent = text;
}


/* =========================================================
   INICIALIZACIÓN DE EVENTOS Y RECURRENCIA COMPLETA
========================================================= */

function initApp() {
  if ($("monthPicker")) $("monthPicker").value = currentMonthValue();

  $("logoutBtn")?.addEventListener("click", async () => {
    if (!confirm("¿Querés cerrar sesión?")) return;
    try {
      localStorage.removeItem('user_logged_in');
      await signOut(auth);
    } catch (err) {
      alert("No se pudo cerrar la sesión.");
    }
  });

  $("monthPicker")?.addEventListener("change", () => renderMensuales());
  $("searchMensualesInput")?.addEventListener("input", e => { searchMensualesTerm = e.target.value; renderMensuales(); });
  $("filterCategorySelect")?.addEventListener("change", () => renderMensuales());

  // GASTOS RECURRENTES
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

  // INGRESOS EXTRA RECURRENTES (MISMA LÓGICA QUE GASTOS)
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

  // MODAL DINERO EXTRA
  $("openExtraModalBtn")?.addEventListener("click", () => {
    if ($("modalExtraInput")) $("modalExtraInput").value = "";
    if ($("modalExtraDescription")) $("modalExtraDescription").value = "";
    if ($("modalExtraCategory")) $("modalExtraCategory").value = "Sueldo";
    const today = new Date();
    if ($("modalExtraDate")) $("modalExtraDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if ($("modalExtraTargetMonth")) $("modalExtraTargetMonth").value = $("monthPicker")?.value || currentMonthValue();

    extraRecurringOptions?.classList.add("hidden");
    extraRecurringAmounts?.classList.add("hidden");
    if (extraRecurring) extraRecurring.checked = false;
    if (extraChangingAmount) extraChangingAmount.checked = false;

    if ($("extraDialog")) {
      delete $("extraDialog").dataset.editingExtraId;
      $("extraDialog").showModal();
    }
  });

  $("closeExtraDialog")?.addEventListener("click", () => $("extraDialog")?.close());

  $("submitExtraBtn")?.addEventListener("click", async () => {
    const rawVal = Number($("modalExtraInput")?.value || 0);
    if (rawVal <= 0) { alert("Ingresá un monto válido."); return; }
    const category = $("modalExtraCategory")?.value || "Otro";
    const description = $("modalExtraDescription")?.value.trim() || "";
    const currency = $("modalExtraCurrency")?.value || "ARS";
    const baseDateStr = $("modalExtraDate")?.value || new Date().toISOString().slice(0, 10);
    const targetMonth = $("modalExtraTargetMonth")?.value || baseDateStr.slice(0, 7);

    let finalVal = rawVal;
    if (currency === "USD" && currentDolarBlue > 0) finalVal = rawVal * currentDolarBlue;

    const editingId = $("extraDialog")?.dataset.editingExtraId;

    if (editingId) {
      const activeMonth = $("monthPicker")?.value || currentMonthValue();
      const current = data.months[activeMonth];
      if (current && Array.isArray(current.extraIncomes)) {
        const itemObj = current.extraIncomes.find(x => x.id === editingId);
        if (itemObj) {
          itemObj.date = baseDateStr;
          itemObj.category = itemObj.isBase ? "Presupuesto Base" : category;
          itemObj.description = description;
          itemObj.amount = finalVal;
          itemObj.rawAmount = rawVal;
          itemObj.currency = currency;
          current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          renderMensuales();
          await saveMonthToFirestore(activeMonth);
        }
      }
    } else {
      const isRecurring = extraRecurring?.checked;
      if (!isRecurring) {
        const current = ensureMonth(targetMonth);
        if (!Array.isArray(current.extraIncomes)) current.extraIncomes = [];
        current.extraIncomes.push({
          id: createId("extra"), date: baseDateStr, category, description, amount: finalVal, rawAmount: rawVal, currency
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
            id: createId("extra"), date: dateStr, category, description: finalDesc, amount: currentFinal, rawAmount: currentRaw, currency
          });
          monthData.budget = monthData.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
          await saveMonthToFirestore(monthKey);
        }
        if ($("monthPicker")) $("monthPicker").value = targetMonth;
        renderMensuales();
        alert(`✓ Ingreso repetido exitosamente durante ${count} período(s).`);
      }
    }
    $("extraDialog")?.close();
  });

  // GUARDAR PRESUPUESTO BASE
  $("saveBudgetBtn")?.addEventListener("click", async () => {
    const month = $("monthPicker")?.value;
    if (!month) return;
    const current = ensureMonth(month);
    const baseVal = Number($("budgetInput")?.value || 0);

    let baseEntry = current.extraIncomes.find(x => x.isBase === true);
    if (baseEntry) {
      baseEntry.amount = baseVal;
      baseEntry.rawAmount = baseVal;
    } else if (baseVal > 0) {
      current.extraIncomes.unshift({
        id: createId("base"), isBase: true, date: `${month}-01`, category: "Presupuesto Base", description: "Presupuesto inicial", amount: baseVal, rawAmount: baseVal, currency: "ARS"
      });
    }

    current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    renderMensuales();
    await saveMonthToFirestore(month);
    alert("Presupuesto guardado correctamente.");
  });

  // MODAL GASTOS
  $("addExpenseBtn")?.addEventListener("click", () => {
    $("expenseForm")?.reset();
    delete $("expenseForm").dataset.editingId;
    const today = new Date();
    if ($("expenseDate")) $("expenseDate").value = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    if ($("expenseTargetMonth")) $("expenseTargetMonth").value = $("monthPicker")?.value || currentMonthValue();
    if ($("modalTitle")) $("modalTitle").textContent = "Agregar gasto";
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
      for (const [mKey, mData] of Object.entries(data.months)) {
        const found = (mData.expenses || []).find(x => x.id === editingId);
        if (found) {
          found.date = baseDateStr; found.description = description; found.category = category; found.amount = baseAmount; found.currency = currency;
          await saveMonthToFirestore(mKey);
          break;
        }
      }
    } else {
      const isRecurring = expenseRecurring?.checked;
      if (!isRecurring) {
        ensureMonth(targetMonth).expenses.push({
          id: createId("expense"), date: baseDateStr, description, category, amount: baseAmount, currency
        });
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

          ensureMonth(monthKey).expenses.push({
            id: createId("expense"), date: dateStr, description: finalDescription, category, amount, currency
          });
          await saveMonthToFirestore(monthKey);
        }
      }
    }
    if ($("monthPicker")) $("monthPicker").value = targetMonth;
    renderMensuales();
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

  // BOTÓN OCULTAR MONTOS (BLUR GLOBAL EN TODA LA APP)
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

  // BOTONES COLAPSABLES
  function setupCollapsible(btnId, containerSelector, storageKey, label) {
    const btn = $(btnId);
    const container = document.querySelector(containerSelector) || $(containerSelector);
    if (!btn || !container) return;
    if (localStorage.getItem(storageKey) === "true") {
      container.classList.add("hidden");
      btn.textContent = `▼ Mostrar ${label}`;
    }
    btn.onclick = () => {
      const isHidden = container.classList.toggle("hidden");
      localStorage.setItem(storageKey, isHidden);
      btn.textContent = isHidden ? `▼ Mostrar ${label}` : `▲ Ocultar ${label}`;
    };
  }

  setupCollapsible("toggleToolbarBtn", "#toolbarContainer", "mensuales_toolbar_collapsed", "barra");
  setupCollapsible("toggleBudgetBtn", "#budgetContainer", "mensuales_budget_collapsed", "resumen");
  setupCollapsible("toggleTableBtn", ".table-wrap", "mensuales_table_collapsed", "tabla");
  setupCollapsible("toggleHistoryBtn", "#historyContainer", "mensuales_history_collapsed", "historial");
  setupCollapsible("toggleExtraHistoryBtn", "#extraHistoryContainer", "mensuales_extra_collapsed", "historial extra");

  // EXPORTAR CSV
  $("mensualesCsvBtn")?.addEventListener("click", () => {
    const month = $("monthPicker")?.value;
    const current = ensureMonth(month);
    const rows = [["Fecha", "Descripción", "Categoría", "Monto", "Moneda"]];
    current.expenses.forEach(e => rows.push([e.date, `"${(e.description || "").replace(/"/g, '""')}"`, e.category, e.amount, e.currency || "ARS"]));
    const content = "\uFEFF" + rows.map(r => r.join(";")).join("\n");
    const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `MENSUALES-${month}.csv`;
    link.click();
  });

  // EXPORTAR PDF
  $("pdfBtn")?.addEventListener("click", () => {
    if (!window.jspdf) { alert("No se pudo cargar jsPDF."); return; }
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF();
    pdf.text("Reporte de Gastos Mensuales", 15, 20);
    pdf.save(`MENSUALES-${$("monthPicker")?.value || currentMonthValue()}.pdf`);
  });
}


/* =========================================================
   DELEGACIÓN GLOBAL (TEMAS Y CONTRASEÑA)
========================================================= */

document.addEventListener('click', (e) => {
  const switchBtn = e.target.closest('#authSwitchBtn');
  if (switchBtn) {
    e.preventDefault();
    authMode = authMode === "login" ? "register" : "login";
    updateAuthInterface();
  }

  const passwordBtn = e.target.closest('#togglePasswordBtn');
  if (passwordBtn) {
    e.preventDefault();
    const passInput = document.getElementById('authPassword');
    if (passInput) {
      const isPass = passInput.type === 'password';
      passInput.type = isPass ? 'text' : 'password';
      passwordBtn.textContent = isPass ? '🌸' : '🔒';
    }
  }

  const themeBtn = e.target.closest('#toggleThemeBtn');
  if (themeBtn) {
    const isDark = document.body.classList.toggle("dark-mode");
    document.body.classList.remove("dark-blue-mode");
    localStorage.setItem("mensual_theme_mode", isDark ? "dark" : "light");
    themeBtn.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  }

  const blueThemeBtn = e.target.closest('#toggleBlueThemeBtn');
  if (blueThemeBtn) {
    const isBlue = document.body.classList.toggle("dark-blue-mode");
    document.body.classList.remove("dark-mode");
    localStorage.setItem("mensual_theme_mode", isBlue ? "blue" : "light");
    blueThemeBtn.textContent = isBlue ? "☀️ Modo claro" : "🔹 Modo Azul";
  }

  if (e.target.closest('#openAnnualBtn')) openAnnualModal();
  if (e.target.closest('#closeAnnualDialog') || e.target.closest('#closeAnnualCancelBtn')) $("annualDialog")?.close();
  if (e.target.closest('#annualPdfBtn')) {
    generateAnnualPDF();
  }
});

const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
if (savedTheme === "dark") document.body.classList.add("dark-mode");
else if (savedTheme === "blue") document.body.classList.add("dark-blue-mode");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}


/* =========================================================
   RESUMEN ANUAL Y PDF
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
    (monthData.expenses || []).forEach(e => {
      const amt = Number(e.amount || 0);
      if (e.currency === "USD") totalUSD += amt;
      else monthARS += amt, totalARS += amt;

      const cat = e.category || "Otros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
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
    <div class="annual-card-grid" style="margin-top: 10px;">
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
    alert("No se pudo cargar el generador de PDF.");
    return;
  }

  const annual = calculateAnnualData();
  const pdf = new jsPDFLib({ unit: "mm", format: "a4" });

  pdf.setFillColor(255, 174, 195);
  pdf.roundedRect(15, 15, 180, 26, 4, 4, "F");

  pdf.setTextColor(82, 22, 42);
  pdf.setFontSize(15);
  pdf.setFont("helvetica", "bold");
  pdf.text(`RESUMEN FINANCIERO ANUAL (${annual.currentYear})`, 21, 25);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Generado por Florencia Bagnis · Mensuales PWA ♡`, 21, 33);

  pdf.save(`Resumen-Anual-${annual.currentYear}.pdf`);
}
