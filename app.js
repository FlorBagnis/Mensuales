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
  onAuthStateChanged,
  sendPasswordResetEmail
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

/* Hoy en Argentina. El día cambia a las 00:00 hora argentina. */
function hoyAR(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .format(now).split("-").map(Number);
  const pad = n => String(n).padStart(2, "0");
  return { y, m, d, date: new Date(y, m - 1, d), iso: `${y}-${pad(m)}-${pad(d)}`, mes: `${y}-${pad(m)}` };
}

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

function formatCurrencyInput(val) {
  let clean = String(val ?? "").replace(/[^\d,]/g, "");
  const parts = clean.split(",");
  if (parts.length > 2) {
    clean = parts[0] + "," + parts.slice(1).join("");
  }
  const [integerPart, decimalPart] = clean.split(",");
  const formattedInt = (integerPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  if (decimalPart !== undefined) {
    return `${formattedInt},${decimalPart.slice(0, 2)}`;
  }
  return formattedInt;
}

function parseCurrency(val) {
  if (val === null || val === undefined || val === "") return 0;
  const cleanNumber = String(val).replace(/\./g, "").replace(",", ".");
  return parseFloat(cleanNumber) || 0;
}

function money(value, currency = "ARS") {
  const isUSD = currency === "USD";
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: isUSD ? "USD" : "ARS",
    minimumFractionDigits: 2
  }).format(Number(value || 0));
}

function currentMonthValue() {
  return hoyAR().mes;
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

document.addEventListener("click", async (e) => {
  if (e.target && e.target.id === "forgotPasswordBtn") {
    const authEmailInput = document.getElementById("authEmail");
    const email = authEmailInput?.value.trim();

    if (!email) {
      setAuthMessage("Ingresá tu correo en el campo de arriba para enviarte el enlace.");
      authEmailInput?.focus();
      return;
    }

    try {
      await sendPasswordResetEmail(auth, email);
      setAuthMessage(`¡Listo! Te enviamos un correo a ${email} para restablecer tu contraseña.`, true);
    } catch (error) {
      console.error("Error al enviar email de recuperación:", error);
      let errorMsg = "No se pudo enviar el correo de recuperación.";
      if (error.code === 'auth/user-not-found') errorMsg = "No existe ninguna cuenta registrada con ese correo.";
      else if (error.code === 'auth/invalid-email') errorMsg = "El formato del correo electrónico no es válido.";
      else if (error.code === 'auth/too-many-requests') errorMsg = "Demasiados intentos. Esperá unos minutos.";
      setAuthMessage(errorMsg);
    }
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;

  const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
  document.body.classList.remove("dark-mode", "dark-blue-mode", "black-mode");
  if (savedTheme === "dark") document.body.classList.add("dark-mode");
  else if (savedTheme === "blue") document.body.classList.add("dark-blue-mode");
  else if (savedTheme === "black") document.body.classList.add("black-mode");

  if (!user) {
    localStorage.removeItem('user_logged_in');
    stopAllSync();
    stopRecurrentes();
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
    startRecurrentes();
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

  if ($("budgetInput")) $("budgetInput").value = current.budget ? formatCurrencyInput(String(current.budget).replace(".", ",")) : "";

  const totalSpentEl = $("totalSpent");
  if (totalSpentEl) {
    if (totalUSD > 0) {
      totalSpentEl.innerHTML = `
        ${money(totalARS)}
        <div style="font-size: 0.72em; color: var(--accent-color, #e05283); font-weight: 700; margin-top: 2px;">
          + ${money(totalUSD, "USD")}
        </div>
      `;
    } else {
      totalSpentEl.textContent = money(totalARS);
    }
  }

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

  const usdEquivalenteARS = totalUSD > 0 && currentDolarBlue > 0 ? totalUSD * currentDolarBlue : 0;
  const gastoTotalGlobalARS = totalARS + usdEquivalenteARS;

  if ($("budgetStatus")) {
    if (!current.budget) {
      $("budgetStatus").textContent = "Sin presupuesto";
      $("budgetStatus").className = "";
    } else if (gastoTotalGlobalARS <= current.budget) {
      $("budgetStatus").textContent = `${money(current.budget - gastoTotalGlobalARS)} disponibles`;
      $("budgetStatus").className = "";
    } else {
      const exceso = gastoTotalGlobalARS - current.budget;
      $("budgetStatus").textContent = `${money(exceso)} excedido`;
      $("budgetStatus").className = "result-bad";
    }
  }

  renderMensualesExpensesTable(current.expenses);
  renderExtraIncomesTable(current.extraIncomes);
  renderHistory();
  renderCategories(current.expenses);
  renderTrend(month, totalARS, prevARS, totalUSD);
  checkFinancialAlerts(totalARS, totalUSD, current.budget, currentDolarBlue);
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

      const extraVal = item.rawAmount !== undefined ? item.rawAmount : item.amount;
      if ($("modalExtraInput")) $("modalExtraInput").value = formatCurrencyInput(String(extraVal).replace(".", ","));
      if ($("modalExtraCurrency")) $("modalExtraCurrency").value = item.currency || "ARS";

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
      if ($("budgetInput")) $("budgetInput").value = formatCurrencyInput(String(current.budget).replace(".", ","));
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
      $("expenseAmount").value = formatCurrencyInput(String(expense.amount).replace(".", ","));
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

  ["budgetInput", "expenseAmount", "modalExtraInput"].forEach(id => {
    const input = $(id);
    if (!input) return;
    input.addEventListener("input", (e) => {
      const start = e.target.selectionStart;
      const prevLen = e.target.value.length;
      e.target.value = formatCurrencyInput(e.target.value);
      const newLen = e.target.value.length;
      const pos = Math.max(0, start + (newLen - prevLen));
      e.target.setSelectionRange(pos, pos);
    });
  });

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

  // GASTOS RECURRENTES DESDE MODAL
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
    const baseAmount = parseCurrency($("expenseAmount")?.value);
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

  // INGRESOS EXTRA RECURRENTES
  const extraRecurring = $("extraRecurring");
  const extraRecurringOptions = $("extraRecurringOptions");
  const extraChangingAmount = $("extraChangingAmount");
  const extraRecurringAmounts = $("extraRecurringAmounts");
  const extraDuration = $("extraDuration");
  const extraMonthsInput = $("extraMonths");
  const extraDay = $("extraDay");

  extraRecurring?.addEventListener("change", () => {
    extraRecurringOptions?.classList.toggle("hidden", !extraRecurring.checked);
  });

  extraChangingAmount?.addEventListener("change", () => {
    extraRecurringAmounts?.classList.toggle("hidden", !extraChangingAmount.checked);
  });

  $("openExtraModalBtn")?.addEventListener("click", () => {
    if ($("modalExtraInput")) $("modalExtraInput").value = "";
    if ($("modalExtraDescription")) $("modalExtraDescription").value = "";
    if ($("modalExtraCategory")) $("modalExtraCategory").value = "Sueldo";
    if ($("modalExtraDate")) $("modalExtraDate").value = hoyAR().iso;
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
  $("closeExtraCancelBtn")?.addEventListener("click", () => $("extraDialog")?.close());

  $("submitExtraBtn")?.addEventListener("click", async () => {
    const rawVal = parseCurrency($("modalExtraInput")?.value);
    if (rawVal <= 0) { alert("Ingresá un monto válido."); return; }
    const category = $("modalExtraCategory")?.value || "Otro";
    const description = $("modalExtraDescription")?.value.trim() || "";
    const currency = $("modalExtraCurrency")?.value || "ARS";
    const baseDateStr = $("modalExtraDate")?.value || hoyAR().iso;
    const targetMonth = $("modalExtraTargetMonth")?.value || baseDateStr.slice(0, 7);

    let finalVal = rawVal;
    if (currency === "USD" && currentDolarBlue > 0) finalVal = rawVal * currentDolarBlue;

    const current = ensureMonth(targetMonth);
    if (!Array.isArray(current.extraIncomes)) current.extraIncomes = [];
    current.extraIncomes.push({
      id: createId("extra"), date: baseDateStr, category, description, amount: finalVal, rawAmount: rawVal, currency
    });
    current.budget = current.extraIncomes.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    if ($("monthPicker")) $("monthPicker").value = targetMonth;
    renderMensuales();
    await saveMonthToFirestore(targetMonth);
    $("extraDialog")?.close();
  });

  $("saveBudgetBtn")?.addEventListener("click", async () => {
    const month = $("monthPicker")?.value;
    if (!month) return;
    const current = ensureMonth(month);
    const baseVal = parseCurrency($("budgetInput")?.value);

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
    if ($("expenseDate")) $("expenseDate").value = hoyAR().iso;
    if ($("expenseTargetMonth")) $("expenseTargetMonth").value = $("monthPicker")?.value || currentMonthValue();
    if ($("modalTitle")) $("modalTitle").textContent = "Agregar gasto";

    const recurringOptions = $("recurringOptions");
    if (recurringOptions) recurringOptions.classList.add("hidden");
    const expenseRecurring = $("expenseRecurring");
    if (expenseRecurring) expenseRecurring.checked = false;

    $("expenseDialog")?.showModal();
  });

  $("closeDialog")?.addEventListener("click", () => $("expenseDialog")?.close());
  $("cancelDialog")?.addEventListener("click", () => $("expenseDialog")?.close());

  // SUBMIT DE GASTOS UNIFICADO CON RECURRENTES
  $("expenseForm")?.addEventListener("submit", async e => {
    e.preventDefault();
    const editingId = $("expenseForm").dataset.editingId;
    const baseDateStr = $("expenseDate").value;
    const targetMonth = $("expenseTargetMonth")?.value || baseDateStr.slice(0, 7);
    const description = $("expenseDescription").value.trim();
    const category = $("expenseCategory").value;
    const baseAmount = parseCurrency($("expenseAmount").value);
    const currency = $("expenseCurrency")?.value || "ARS";

    const isRecurringChecked = expenseRecurring?.checked;
    const sendEmailAlert = $("expenseSendEmailAlert")?.checked !== false;

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
      if (!isRecurringChecked) {
        ensureMonth(targetMonth).expenses.push({
          id: createId("expense"), date: baseDateStr, description, category, amount: baseAmount, currency
        });
        await saveMonthToFirestore(targetMonth);
      } else {
        const mensualId = createId("expense");
        ensureMonth(targetMonth).expenses.push({
          id: mensualId, date: baseDateStr, description, category, amount: baseAmount, currency
        });
        await saveMonthToFirestore(targetMonth);

        if (currentUser) {
          const recId = createId("rec");
          const diaVence = Number(baseDateStr.split("-")[2]) || 10;
          const recData = {
            id: recId,
            descripcion: description,
            categoria: category,
            diaVence: diaVence,
            monto: baseAmount,
            currency: currency,
            avisar: sendEmailAlert,
            activo: true,
            pagos: {
              [targetMonth]: {
                fecha: baseDateStr,
                monto: baseAmount,
                mensualId: mensualId
              }
            },
            createdAt: new Date().toISOString()
          };
          await setDoc(doc(db, "users", currentUser.uid, "recurrentes", recId), recData);
        }
      }
    }

    if ($("monthPicker")) $("monthPicker").value = targetMonth;
    renderMensuales();

    const dialog = $("expenseDialog");
    if (dialog && typeof dialog.close === "function") {
      dialog.close();
    }
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
  setupCollapsible("toggleTableBtn", "#tableContentWrapper", "mensuales_table_collapsed", "tabla");
  setupCollapsible("toggleHistoryBtn", "#historyContainer", "mensuales_history_collapsed", "historial");
  setupCollapsible("toggleExtraHistoryBtn", "#extraHistoryContainer", "mensuales_extra_collapsed", "historial extra");
  setupCollapsible("toggleCategoryBtn", "#categoryContainer", "mensuales_cat_collapsed", "gráfico");

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

  initCsvImport();
  $("pdfBtn")?.addEventListener("click", generateMensualesPDF);
}

function initCsvImport() {
  const importCsvBtn = $("importCsvBtn");
  const csvFileInput = $("csvFileInput");

  importCsvBtn?.addEventListener("click", () => csvFileInput?.click());

  csvFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/);
        if (lines.length <= 1) { alert("El archivo CSV está vacío."); return; }

        const separator = lines[0].includes(";") ? ";" : ",";
        const activeMonth = $("monthPicker")?.value || currentMonthValue();
        const currentData = ensureMonth(activeMonth);
        let importedCount = 0;

        for (let i = 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line) continue;
          const cols = line.split(separator);
          if (cols.length >= 4) {
            const date = cols[0]?.trim() || `${activeMonth}-01`;
            const description = (cols[1] || "").replace(/^["']|["']$/g, "").trim();
            const category = (cols[2] || "").replace(/^["']|["']$/g, "").trim() || "Otros";
            const amount = Number(cols[3]?.trim().replace(/[^0-9,.-]/g, "").replace(",", ".") || "0");
            const currency = cols[4]?.trim().toUpperCase() || "ARS";

            if (amount > 0) {
              currentData.expenses.push({ id: createId("expense"), date, description, category, amount, currency });
              importedCount++;
            }
          }
        }

        if (importedCount > 0) {
          renderMensuales();
          await saveMonthToFirestore(activeMonth);
          alert(`¡Éxito! Se importaron ${importedCount} gastos.`);
        } else {
          alert("No se pudieron leer registros válidos.");
        }
      } catch (err) {
        alert("Hubo un error al leer el CSV.");
      } finally {
        csvFileInput.value = "";
      }
    };
    reader.readAsText(file, "UTF-8");
  });
}

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
    document.body.classList.remove("dark-blue-mode", "black-mode");
    localStorage.setItem("mensual_theme_mode", isDark ? "dark" : "light");
    themeBtn.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
  }

  const blueThemeBtn = e.target.closest('#toggleBlueThemeBtn');
  if (blueThemeBtn) {
    const isBlue = document.body.classList.toggle("dark-blue-mode");
    document.body.classList.remove("dark-mode", "black-mode");
    localStorage.setItem("mensual_theme_mode", isBlue ? "blue" : "light");
    blueThemeBtn.textContent = isBlue ? "☀️ Modo claro" : "💙 Modo Azul";
  }

  const blackThemeBtn = e.target.closest('#btnBlackMode');
  if (blackThemeBtn) {
    const isBlack = document.body.classList.toggle("black-mode");
    document.body.classList.remove("dark-mode", "dark-blue-mode");
    localStorage.setItem("mensual_theme_mode", isBlack ? "black" : "light");
  }

  if (e.target.closest('#openAnnualBtn')) openAnnualModal();
  if (e.target.closest('#closeAnnualDialog') || e.target.closest('#closeAnnualCancelBtn')) $("annualDialog")?.close();
  if (e.target.closest('#annualPdfBtn')) generateAnnualPDF();
});

const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
if (savedTheme === "dark") document.body.classList.add("dark-mode");
else if (savedTheme === "blue") document.body.classList.add("dark-blue-mode");
else if (savedTheme === "black") document.body.classList.add("black-mode");

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

function getPdfThemeColors() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const isBlueMode = document.body.classList.contains("dark-blue-mode");
  const isBlackMode = document.body.classList.contains("black-mode");

  if (isBlackMode) {
    return { pink: [255, 255, 255], dark: [241, 245, 249], light: [18, 18, 18], headerBg: [10, 10, 10], cardBorder: [40, 40, 40], lineDivider: [30, 30, 30], pageBg: [0, 0, 0], footerColor: [150, 150, 150] };
  } else if (isBlueMode) {
    return { pink: [56, 189, 248], dark: [241, 245, 249], light: [15, 28, 63], headerBg: [7, 13, 30], cardBorder: [30, 53, 109], lineDivider: [20, 36, 75], pageBg: [7, 13, 30], footerColor: [143, 165, 202] };
  } else if (isDarkMode) {
    return { pink: [255, 120, 160], dark: [253, 242, 246], light: [45, 20, 34], headerBg: [30, 15, 23], cardBorder: [74, 33, 56], lineDivider: [50, 22, 38], pageBg: [30, 15, 23], footerColor: [184, 146, 164] };
  } else {
    return { pink: [234, 91, 142], dark: [82, 22, 42], light: [253, 232, 238], headerBg: [255, 174, 195], cardBorder: [246, 214, 223], lineDivider: [246, 214, 223], pageBg: null, footerColor: [125, 80, 98] };
  }
}

function generateMensualesPDF() {
  if (!window.jspdf) { alert("No se pudo cargar el PDF."); return; }
  const { jsPDF } = window.jspdf;
  const month = $("monthPicker")?.value || currentMonthValue();
  const current = ensureMonth(month);
  let totalARS = 0, totalUSD = 0;
  current.expenses.forEach(e => { if (e.currency === "USD") totalUSD += Number(e.amount || 0); else totalARS += Number(e.amount || 0); });
  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  pdf.save(`MENSUALES-${month}.pdf`);
}

function calculateAnnualData() {
  const currentYear = String(hoyAR().y);
  let totalARS = 0, totalUSD = 0, monthsCount = 0;
  let highestMonth = { name: "—", amount: 0 };
  const categoryTotals = {};
  if (!data || !data.months) return { currentYear, totalARS, totalUSD, monthsCount: 0, avgARS: 0, highestMonth, topCategory: ["—", 0] };
  Object.entries(data.months).forEach(([monthKey, monthData]) => {
    if (!monthKey.startsWith(currentYear)) return;
    monthsCount++;
    let monthARS = 0;
    (monthData.expenses || []).forEach(e => {
      const amt = Number(e.amount || 0);
      if (e.currency === "USD") totalUSD += amt;
      else { monthARS += amt; totalARS += amt; }
      const cat = e.category || "Otros";
      categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
    });
    if (monthARS > highestMonth.amount) highestMonth = { name: monthName(monthKey), amount: monthARS };
  });
  return { currentYear, totalARS, totalUSD, monthsCount, avgARS: monthsCount > 0 ? totalARS / monthsCount : 0, highestMonth, topCategory: Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0] };
}

function openAnnualModal() {
  const annual = calculateAnnualData();
  const content = $("annualContent");
  if (!content) return;
  $("annualSubtitle").textContent = `Año ${annual.currentYear} · Basado en ${annual.monthsCount} meses`;
  content.innerHTML = `
    <div class="annual-card-grid">
      <div class="annual-mini-card"><span>TOTAL GASTADO (ARS)</span><strong>${money(annual.totalARS)}</strong></div>
      <div class="annual-mini-card"><span>PROMEDIO MENSUAL</span><strong>${money(annual.avgARS)}</strong></div>
    </div>
  `;
  $("annualDialog")?.showModal();
}

function generateAnnualPDF() {
  const jsPDFLib = window.jspdf?.jsPDF || window.jsPDF;
  if (!jsPDFLib) return;
  const annual = calculateAnnualData();
  const pdf = new jsPDFLib({ unit: "mm", format: "a4" });
  pdf.save(`Resumen-Anual-${annual.currentYear}.pdf`);
}

function checkFinancialAlerts(totalARS, totalUSD, presupuesto, cotizacionBlue) {
  let alertaPresupuestoContainer = document.getElementById("alertaPresupuesto");
  if (!alertaPresupuestoContainer) {
    alertaPresupuestoContainer = document.createElement("div");
    alertaPresupuestoContainer.id = "alertaPresupuesto";
    alertaPresupuestoContainer.className = "budget-alert-banner hidden";
    const hero = document.querySelector("header.hero") || document.querySelector("main");
    if (hero) hero.insertAdjacentElement("afterend", alertaPresupuestoContainer);
  }
  alertaPresupuestoContainer.style.color = "";
  const usdEnARS = totalUSD > 0 && cotizacionBlue > 0 ? totalUSD * cotizacionBlue : 0;
  const totalGeneralARS = totalARS + usdEnARS;
  if (presupuesto > 0 && (totalARS > presupuesto || totalGeneralARS > presupuesto)) {
    alertaPresupuestoContainer.innerHTML = `<span style="font-size: 1.2rem; margin-right: 6px;">⚠️</span><div><strong>¡Atención! Te excediste del presupuesto.</strong></div>`;
    alertaPresupuestoContainer.classList.remove("hidden");
    return;
  }
  alertaPresupuestoContainer.classList.add("hidden");
}

/* =========================================================
   GASTOS RECURRENTES (SISTEMA INDEPENDIENTE Y VISUAL)
========================================================= */
const REC_GRUPOS = ["Internet", "Suscripciones", "Servicios", "Impuestos", "Alquiler", "Otros"];
const REC_ICONOS = { Internet: "🌐", Suscripciones: "📱", Servicios: "💡", Impuestos: "🏛️", Alquiler: "🏠", Otros: "📦" };
const REC_DIAS_POR_VENCER = 3;
let recItems = [];
let recUnsub = null;
let recTimer = null;

function recNormalizar(s) { return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim(); }
function recEsc(s) { return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c])); }
function recGrupoDe(rec) {
  const cat = String(rec.categoria || "").trim();
  if (cat === "Internet" || cat === "Impuestos") return cat;
  return REC_GRUPOS.includes(cat) ? cat : "Otros";
}
function recCategoriaMensual(rec) {
  const map = { Internet: "Servicios", Suscripciones: "Suscripciones", Servicios: "Servicios", Impuestos: "Otros", Alquiler: "Alquiler", Otros: "Otros" };
  return map[recGrupoDe(rec)] || "Otros";
}
function recDiaEfectivo(diaVence, hoy) {
  const ultimo = new Date(hoy.y, hoy.m, 0).getDate();
  return Math.min(Math.max(Number(diaVence) || 1, 1), ultimo);
}
function recDiasMensual(diaVence, hoy) {
  const venc = new Date(hoy.y, hoy.m - 1, recDiaEfectivo(diaVence, hoy));
  return Math.round((venc - hoy.date) / 86400000);
}
function recEstado(rec, hoy) {
  const pago = rec.pagos && rec.pagos[hoy.mes];
  if (pago) return { clase: "paid", texto: `✅ Pagado`, pagado: true };
  const dias = recDiasMensual(rec.diaVence, hoy);
  if (dias < 0) return { clase: "late", texto: `⚠️ Vencido`, pagado: false };
  if (dias <= REC_DIAS_POR_VENCER) return { clase: "soon", texto: `🌸 Vence en ${dias}d`, pagado: false };
  return { clase: "wait", texto: `⏳ Vence el ${recDiaEfectivo(rec.diaVence, hoy)}`, pagado: false };
}
function recMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", { style: "currency", currency: currency === "USD" ? "USD" : "ARS" }).format(Number(value || 0));
}
function recParse(val) {
  if (!val) return null;
  const n = parseFloat(String(val).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}

async function recGuardar(rec) {
  if (!currentUser) return;
  await setDoc(doc(db, "users", currentUser.uid, "recurrentes", rec.id), {
    descripcion: String(rec.descripcion || "").trim(),
    categoria: rec.categoria || "Otros",
    diaVence: Number(rec.diaVence) || 1,
    monto: rec.monto ? Number(rec.monto) : null,
    currency: rec.currency || "ARS",
    avisar: rec.avisar !== false,
    activo: true,
    pagos: rec.pagos || {},
    createdAt: rec.createdAt || new Date().toISOString()
  });
}

async function recPagar(id) {
  const rec = recItems.find(r => r.id === id);
  if (!rec || !currentUser) return;
  const hoy = hoyAR();
  let monto = rec.monto;
  if (!monto || monto <= 0) {
    const txt = prompt(`¿Cuánto pagaste de "${rec.descripcion}"?`, "");
    if (txt === null) return;
    monto = recParse(txt);
    if (!monto || monto <= 0) { alert("Ingresá un monto válido."); return; }
  }
  const mensualId = `rec-${rec.id}-${hoy.mes}`;
  const pagos = { ...(rec.pagos || {}), [hoy.mes]: { fecha: hoy.iso, monto, mensualId } };
  try {
    await recGuardar({ ...rec, pagos });
    const monthRef = doc(db, "users", currentUser.uid, "months", hoy.mes);
    const snap = await getDoc(monthRef);
    let monthData = { budget: 0, expenses: [] };
    if (snap.exists()) { monthData = snap.data(); if (!Array.isArray(monthData.expenses)) monthData.expenses = []; }
    monthData.expenses = monthData.expenses.filter(e => e.id !== mensualId);
    monthData.expenses.push({ id: mensualId, date: hoy.iso, description: rec.descripcion, category: recCategoriaMensual(rec), amount: Number(monto), currency: rec.currency || "ARS" });
    await setDoc(monthRef, monthData, { merge: true });
  } catch (err) { alert("No se pudo registrar el pago."); }
}

async function recDeshacerPago(id) {
  const rec = recItems.find(r => r.id === id);
  if (!rec || !currentUser) return;
  const hoy = hoyAR();
  const pagos = { ...rec.pagos };
  delete pagos[hoy.mes];
  try {
    await recGuardar({ ...rec, pagos });
    const monthRef = doc(db, "users", currentUser.uid, "months", hoy.mes);
    const snap = await getDoc(monthRef);
    if (snap.exists()) {
      const monthData = snap.data();
      if (Array.isArray(monthData.expenses)) {
        monthData.expenses = monthData.expenses.filter(e => e.id !== `rec-${rec.id}-${hoy.mes}`);
        await setDoc(monthRef, monthData, { merge: true });
      }
    }
  } catch (err) { alert("No se pudo deshacer."); }
}

function recRender() {
  const lista = document.getElementById("recList");
  if (!lista) return;
  const hoy = hoyAR();
  const activos = recItems.filter(r => r.activo !== false);
  if (!activos.length) {
    lista.innerHTML = `<div class="rec-empty">Todavía no cargaste recurrentes.</div>`;
    return;
  }
  let html = "";
  REC_GRUPOS.forEach(g => {
    const items = activos.filter(r => recGrupoDe(r) === g);
    if (!items.length) return;
    html += `<div class="rec-group"><h4>${REC_ICONOS[g]} ${g}</h4>${items.map(r => {
      const est = recEstado(r, hoy);
      return `<div class="rec-item"><span>${recEsc(r.descripcion)}</span> <span class="rec-badge ${est.clase}">${est.texto}</span></div>`;
    }).join("")}</div>`;
  });
  lista.innerHTML = html;
}

function recMontarUI() {
  if (document.getElementById("recSection")) return;
  const section = document.createElement("section");
  section.id = "recSection";
  section.className = "rec-panel";
  section.innerHTML = `<div class="rec-head"><h2>🔁 Gastos recurrentes</h2></div><div id="recList"></div>`;
  const tabla = document.getElementById("tableContentWrapper");
  const panelGastos = tabla ? tabla.closest(".panel") : null;
  if (panelGastos && panelGastos.parentNode) panelGastos.parentNode.insertBefore(section, panelGastos);
}

function startRecurrentes() {
  if (!currentUser) return;
  recMontarUI();
  recUnsub = onSnapshot(collection(db, "users", currentUser.uid, "recurrentes"), snapshot => {
    recItems = [];
    snapshot.forEach(d => recItems.push({ id: d.id, ...d.data() }));
    recRender();
  });
}

function stopRecurrentes() {
  if (typeof recUnsub === "function") { recUnsub(); recUnsub = null; }
  recItems = [];
}
