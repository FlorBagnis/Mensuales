/* =========================================================
   MENSUALES & GASTOS PRÓXIMOS (SISTEMA UNIFICADO)
   FIREBASE FIRESTORE + TIEMPO REAL + MULTIMONEDA + PWA + CSV
========================================================= */

// Función global colgada de window para que el HTML la detecte con el onchange
window.cambiarOrden = function() {
  const selectOrden = $("ordenarPor");
  if (selectOrden) {
    localStorage.setItem('criterioOrden', selectOrden.value);
    // Vuelve a renderizar la vista de mensuales para aplicar el orden nuevo
    if (typeof renderMensuales === 'function') {
      renderMensuales();
    }
  }
}

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

// Mes actual en hora de Argentina (cambia a las 00:00 AR)
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

// ==========================================
// RECUPERACIÓN DE CONTRASEÑA
// ==========================================
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

      if (error.code === 'auth/user-not-found') {
        errorMsg = "No existe ninguna cuenta registrada con ese correo.";
      } else if (error.code === 'auth/invalid-email') {
        errorMsg = "El formato del correo electrónico no es válido.";
      } else if (error.code === 'auth/too-many-requests') {
        errorMsg = "Demasiados intentos. Esperá unos minutos antes de volver a probar.";
      }

      setAuthMessage(errorMsg);
    }
  }
});

onAuthStateChanged(auth, async user => {
  currentUser = user;

  const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
  document.body.classList.remove("dark-mode", "dark-blue-mode", "black-mode");
  if (savedTheme === "dark") {
    document.body.classList.add("dark-mode");
  } else if (savedTheme === "blue") {
    document.body.classList.add("dark-blue-mode");
  } else if (savedTheme === "black") {
    document.body.classList.add("black-mode");
  }

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

/* ---------- Mantener la posición al actualizar / editar / eliminar ---------- */
function captureScroll() {
  const items = new Set();
  document.querySelectorAll("table").forEach(t => {
    let p = t.parentElement;
    while (p && p !== document.body && p !== document.documentElement) {
      if (p.scrollTop > 0 || p.scrollLeft > 0) items.add(p);
      p = p.parentElement;
    }
  });
  return {
    x: window.scrollX,
    y: window.scrollY,
    items: [...items].map(el => [el, el.scrollTop, el.scrollLeft])
  };
}

function restoreScroll(s) {
  if (!s) return;
  const apply = () => {
    s.items.forEach(([el, top, left]) => {
      el.style.scrollBehavior = "auto";
      el.scrollTop = top;
      el.scrollLeft = left;
      el.style.scrollBehavior = "";
    });
    window.scrollTo({ left: s.x, top: s.y, behavior: "instant" });
  };
  apply();
  requestAnimationFrame(apply);
  setTimeout(apply, 90);   // por si algún módulo (Changui) termina de armar filas recién después
}

// Al abrir cualquier modal se guarda dónde estabas; al cerrarlo se vuelve ahí
let dialogScrollState = null;
const originalShowModal = HTMLDialogElement.prototype.showModal;
HTMLDialogElement.prototype.showModal = function (...args) {
  dialogScrollState = captureScroll();
  return originalShowModal.apply(this, args);
};
document.addEventListener("close", () => restoreScroll(dialogScrollState), true);

function renderMensuales() {
  const scrollState = captureScroll();
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

  // 1. Desglose bimonetario en la tarjeta TOTAL GASTADO
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

  // 2. Estado de presupuesto contemplando ARS y USD convertidos
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

  // 3. Verificador de alertas pasando valores numéricos directos
  checkFinancialAlerts(totalARS, totalUSD, current.budget, currentDolarBlue);

  // Changui arma su solapa de detalle YA (no 40 ms después), así la tabla
  // tiene su altura final y el scroll vuelve exactamente a donde estabas
  if (typeof window.__changuiEnhance === "function") {
    try { window.__changuiEnhance(); } catch (e) { console.error("Changui:", e); }
  }

  // Quedarte exactamente donde estabas (editar, eliminar, guardar, sincronizar)
  restoreScroll(scrollState);
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
      const vuelveAPocki = item.fromPocki && item.pockiGoalId && window.PockiApi;
      const pregunta = vuelveAPocki
        ? `¿Eliminar este retiro? ${money(item.rawAmount ?? item.amount, item.currency || "ARS")} vuelven a tu meta en Pocki.`
        : `¿Eliminar el registro "${item.category}"?`;
      if (!confirm(pregunta)) return;
       current.extraIncomes = current.extraIncomes.filter(x => x.id !== btn.dataset.id);
      current.budget = current.extraIncomes.reduce((sum, i) => sum + Number(i.amount || 0), 0);
      if ($("budgetInput")) $("budgetInput").value = formatCurrencyInput(String(current.budget).replace(".", ","));
      renderMensuales();
      await saveMonthToFirestore(month);
       if (vuelveAPocki) {
        window.PockiApi.refund(item.pockiGoalId, Number(item.rawAmount ?? item.amount ?? 0));
      }
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

  // --- ORDENAMIENTO DINÁMICO Y PERSISTENCIA (localStorage) ---
  const selectOrden = $("ordenarPor");
  const criterio = selectOrden ? selectOrden.value : (localStorage.getItem('criterioOrden') || 'recientes');
  if (selectOrden && !localStorage.getItem('criterioOrden')) {
    selectOrden.value = criterio;
  }

  if (criterio === 'mayor-precio') {
    list.sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0));
  } else if (criterio === 'menor-precio') {
    list.sort((a, b) => Number(a.amount || 0) - Number(b.amount || 0));
  } else if (criterio === 'tipo') {
    list.sort((a, b) => String(a.category || "").localeCompare(String(b.category || "")));
  } else if (criterio === 'recientes') {
    list.sort((a, b) => new Date(b.date || "") - new Date(a.date || ""));
  } else if (criterio === 'antiguas') {
    list.sort((a, b) => new Date(a.date || "") - new Date(b.date || ""));
  }
  // -----------------------------------------------------------

  list.forEach((e, idx) => {
    const row = document.createElement("tr");
    const curr = e.currency || "ARS";
    if (idx % 2 === 1) row.className = "row-alt";

    // Si el gasto trae el envío adentro (compra de Changui), se avisa en la misma fila
    const envioItem = Array.isArray(e.detalle)
      ? e.detalle.find(x => x && (x.isDelivery || /^env[ií]o a domicilio$/i.test(String(x.name || "").trim())))
      : null;
    const envioHtml = envioItem && Number(envioItem.paid) > 0
      ? `<div style="font-size:.72em;opacity:.75;font-weight:600;">📦 incluye envío ${money(envioItem.paid, envioItem.cur || "ARS")}</div>`
      : "";

    row.innerHTML = `
      <td>${formatDate(e.date)}</td>
      <td>${escapeHtml(e.description)}</td>
      <td><span class="category">${escapeHtml(e.category)}</span></td>
      <td class="amount" style="text-align: right;">${money(e.amount, curr)}${envioHtml}</td>
      <td style="text-align: right; white-space: nowrap;">
        <button class="pastel-btn btn-sm edit-btn" data-id="${e.id}" type="button" title="Editar">✏️</button>
        <button class="btn btn-danger btn-sm delete-btn" data-id="${e.id}" type="button" title="Eliminar">×</button>
      </td>
    `;
    table.appendChild(row);
  });

  // Guardar la preferencia en localStorage cuando cambie el select
  if (selectOrden && !selectOrden.onchange) {
    selectOrden.onchange = () => {
      localStorage.setItem('criterioOrden', selectOrden.value);
      if (typeof renderMensuales === 'function') {
        renderMensuales();
      }
    };
  }

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
      // Al editar, empezar con la recurrencia destildada
      const recChk = $("expenseRecurring");
      if (recChk) recChk.checked = false;
      $("recurringOptions")?.classList.add("hidden");
      $("recurringAmounts")?.classList.add("hidden");
      const recChg = $("recurringChangingAmount");
      if (recChg) recChg.checked = false;
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

  // Autoformato de miles y decimales en vivo en los 3 campos clave
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
  $("expenseAmount")?.addEventListener("input", () => {
    if (!recurringChangingAmount?.checked) return;
    const baseAmount = parseCurrency($("expenseAmount")?.value);
    recurringAmounts?.querySelectorAll(".rec-amount-input").forEach(inp => {
      if (!inp.dataset.userEdited) inp.value = baseAmount;
    });
  });

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
    const baseAmount = parseCurrency($("modalExtraInput")?.value);
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
    const baseAmount = parseCurrency($("modalExtraInput")?.value);
    extraRecurringAmounts?.querySelectorAll(".extra-rec-amount-input").forEach(inp => {
      if (!inp.dataset.userEdited) inp.value = baseAmount;
    });
  });

  // MODAL DINERO EXTRA
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
    const form = $("expenseForm");
    form?.reset();
    if (form) delete form.dataset.editingId;
    if ($("expenseDate")) $("expenseDate").value = hoyAR().iso;
    if ($("expenseTargetMonth")) $("expenseTargetMonth").value = $("monthPicker")?.value || currentMonthValue();
    if ($("modalTitle")) $("modalTitle").textContent = "Agregar gasto";

    // Ocultar opciones de recurrencia al abrir
    recurringOptions?.classList.add("hidden");
    recurringAmounts?.classList.add("hidden");
    if (expenseRecurring) expenseRecurring.checked = false;
    if (recurringChangingAmount) recurringChangingAmount.checked = false;

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
    const baseAmount = parseCurrency($("expenseAmount").value);
    const currency = $("expenseCurrency")?.value || "ARS";
    const isRecurring = expenseRecurring?.checked;

    // Crea las cuotas futuras + el registro en users/{uid}/recurrentes.
    // Si "existing" viene informado (se está editando un gasto), ese gasto pasa a ser la
    // primera cuota y NO se vuelve a crear: solo se generan las siguientes.
    async function crearSerieRecurrente(existing) {
      const count = Number(recurringDuration?.value) || 6;
      const interval = Number(recurringMonthsInput?.value) || 1;
      const dayNum = Number(recurringDay?.value) || 10;
      const changing = recurringChangingAmount?.checked;
      const customInputs = recurringAmounts?.querySelectorAll(".rec-amount-input");
      const baseDate = new Date(baseDateStr + "T00:00:00");

      // Los gastos usan el id "rec-{recId}-{mes}", igual que recPagar(),
      // así que si después se marca pagado en la solapa, reemplaza la cuota en vez de duplicarla.
      const recId = createId("rec");
      let primerPago = existing
        ? { monthKey: existing.monthKey, fecha: existing.fecha, monto: existing.monto, mensualId: existing.id }
        : null;

      for (let i = existing ? 1 : 0; i < count; i++) {
        const targetDate = new Date(baseDate.getFullYear(), baseDate.getMonth() + (i * interval), dayNum);
        const monthKey = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, "0")}`;
        const dateStr = `${monthKey}-${String(targetDate.getDate()).padStart(2, "0")}`;

        let amount = baseAmount;
        if (changing && customInputs && customInputs[i]) {
          amount = Number(customInputs[i].value) || baseAmount;
        }
        const finalDescription = `🔄 ${description} (Cuota ${i + 1}/${count})`;
        const mensualId = `rec-${recId}-${monthKey}`;

        ensureMonth(monthKey).expenses.push({
          id: mensualId, date: dateStr, description: finalDescription, category, amount, currency
        });
        await saveMonthToFirestore(monthKey);

        if (i === 0) primerPago = { monthKey, fecha: dateStr, monto: amount, mensualId };
      }

      // Registro en la colección de recurrentes (solo con sesión iniciada)
      if (currentUser && primerPago) {
        try {
          await setDoc(doc(db, "users", currentUser.uid, "recurrentes", recId), {
            id: recId,
            descripcion: description,
            categoria: category,
            diaVence: dayNum,
            monto: baseAmount,
            currency: currency,
            avisar: $("expenseSendEmailAlert")?.checked !== false,
            activo: true,
            pagos: {
              [primerPago.monthKey]: {
                fecha: primerPago.fecha,
                monto: primerPago.monto,
                mensualId: primerPago.mensualId
              }
            },
            createdAt: new Date().toISOString()
          });
        } catch (err) {
          console.error("Error guardando recurrente:", err);
          alert("El gasto se guardó, pero no se pudo crear el recurrente para los avisos.");
        }
      }
    }

    if (editingId) {
      for (const [mKey, mData] of Object.entries(data.months)) {
        const found = (mData.expenses || []).find(x => x.id === editingId);
        if (found) {
          found.date = baseDateStr; found.description = description; found.category = category; found.amount = baseAmount; found.currency = currency;
          await saveMonthToFirestore(mKey);

          // Editando + "Repetir" tildado: el gasto editado pasa a ser la primera cuota
          if (isRecurring) {
            if (String(found.id).startsWith("rec-")) {
              alert("Este gasto ya forma parte de un recurrente, no se vuelve a repetir.");
            } else {
              await crearSerieRecurrente({ id: found.id, monthKey: mKey, fecha: baseDateStr, monto: baseAmount });
            }
          }
          break;
        }
      }
    } else {
      if (!isRecurring) {
        ensureMonth(targetMonth).expenses.push({
          id: createId("expense"), date: baseDateStr, description, category, amount: baseAmount, currency
        });
        await saveMonthToFirestore(targetMonth);
      } else {
        await crearSerieRecurrente(null);
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
    if (!confirm("¿Estás segura de reiniciar todo y borrar todos los meses?")) return;
    const snap = await getDocs(collection(db, "users", currentUser.uid, "months"));
    const batch = writeBatch(db);
    snap.forEach(d => batch.delete(d.ref));
    await batch.commit();
    data = { months: {} };
    renderMensuales();
  });

  // BOTÓN OCULTAR MONTOS
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
  setupCollapsible("toggleTableBtn", "#tableContentWrapper", "mensuales_table_collapsed", "tabla");
  setupCollapsible("toggleHistoryBtn", "#historyContainer", "mensuales_history_collapsed", "historial");
  setupCollapsible("toggleExtraHistoryBtn", "#extraHistoryContainer", "mensuales_extra_collapsed", "historial extra");
  setupCollapsible("toggleCategoryBtn", "#categoryContainer", "mensuales_cat_collapsed", "gráfico");

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

  // 📂 INICIALIZAR IMPORTAR CSV
  initCsvImport();

  // EXPORTAR PDF
  $("pdfBtn")?.addEventListener("click", generateMensualesPDF);
}


/* =========================================================
   FUNCIÓN DE IMPORTAR CSV
========================================================= */
function initCsvImport() {
  const importCsvBtn = $("importCsvBtn");
  const csvFileInput = $("csvFileInput");

  importCsvBtn?.addEventListener("click", () => {
    csvFileInput?.click();
  });

  csvFileInput?.addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const text = event.target.result;
        const lines = text.split(/\r\n|\n/);

        if (lines.length <= 1) {
          alert("El archivo CSV está vacío o no tiene formato válido.");
          return;
        }

        const header = lines[0];
        const separator = header.includes(";") ? ";" : ",";

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

            const rawAmount = cols[3]?.trim().replace(/[^0-9,.-]/g, "").replace(",", ".") || "0";
            const amount = Number(rawAmount);
            const currency = cols[4]?.trim().toUpperCase() || "ARS";

            if (amount > 0) {
              currentData.expenses.push({
                id: createId("expense"),
                date,
                description: description || "Gasto importado",
                category,
                amount,
                currency
              });
              importedCount++;
            }
          }
        }

        if (importedCount > 0) {
          renderMensuales();
          await saveMonthToFirestore(activeMonth);
          alert(`¡Éxito! Se importaron ${importedCount} gastos correctamente.`);
        } else {
          alert("No se pudieron leer registros válidos. Verificá que el archivo coincida con el formato de exportación.");
        }
      } catch (err) {
        console.error("Error al procesar el CSV:", err);
        alert("Hubo un error al leer el archivo CSV.");
      } finally {
        csvFileInput.value = "";
      }
    };

    reader.readAsText(file, "UTF-8");
  });
}

/* =========================================================
   DELEGACIÓN GLOBAL (TEMAS Y CONTRASEÑA) - LIMPIO Y FUNCIONAL
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
    document.body.classList.remove("dark-blue-mode", "black-mode");
    localStorage.setItem("mensual_theme_mode", isDark ? "dark" : "light");
    themeBtn.textContent = isDark ? "☀️ Modo claro" : "🌙 Modo oscuro";
    const blueBtn = $("toggleBlueThemeBtn");
    if (blueBtn) blueBtn.textContent = "💙 Modo Azul";
    const blackBtn = $("btnBlackMode");
    if (blackBtn) blackBtn.textContent = "🖤 Modo Black";
  }

  const blueThemeBtn = e.target.closest('#toggleBlueThemeBtn');
  if (blueThemeBtn) {
    const isBlue = document.body.classList.toggle("dark-blue-mode");
    document.body.classList.remove("dark-mode", "black-mode");
    localStorage.setItem("mensual_theme_mode", isBlue ? "blue" : "light");
    blueThemeBtn.textContent = isBlue ? "☀️ Modo claro" : "💙 Modo Azul";
    const darkBtn = $("toggleThemeBtn");
    if (darkBtn) darkBtn.textContent = "🌙 Modo oscuro";
    const blackBtn = $("btnBlackMode");
    if (blackBtn) blackBtn.textContent = "🖤 Modo Black";
  }

  const blackThemeBtn = e.target.closest('#btnBlackMode');
  if (blackThemeBtn) {
    const isBlack = document.body.classList.toggle("black-mode");
    document.body.classList.remove("dark-mode", "dark-blue-mode");
    localStorage.setItem("mensual_theme_mode", isBlack ? "black" : "light");
    blackThemeBtn.textContent = "🖤 Modo Black";
    const darkBtn = $("toggleThemeBtn");
    if (darkBtn) darkBtn.textContent = "🌙 Modo oscuro";
    const blueBtn = $("toggleBlueThemeBtn");
    if (blueBtn) blueBtn.textContent = "💙 Modo Azul";
  }

  if (e.target.closest('#openAnnualBtn')) openAnnualModal();
  if (e.target.closest('#closeAnnualDialog') || e.target.closest('#closeAnnualCancelBtn')) $("annualDialog")?.close();
  if (e.target.closest('#annualPdfBtn')) {
    generateAnnualPDF();
  }
});

const savedTheme = localStorage.getItem("mensual_theme_mode") || "light";
if (savedTheme === "dark") {
  document.body.classList.add("dark-mode");
  const darkBtn = $("toggleThemeBtn");
  if (darkBtn) darkBtn.textContent = "☀️ Modo claro";
} else if (savedTheme === "blue") {
  document.body.classList.add("dark-blue-mode");
  const blueBtn = $("toggleBlueThemeBtn");
  if (blueBtn) blueBtn.textContent = "☀️ Modo claro";
} else if (savedTheme === "black") {
  document.body.classList.add("black-mode");
  const blackBtn = $("btnBlackMode");
  if (blackBtn) blackBtn.textContent = "🖤 Modo Black";
}


// ACTIVAR LA APLICACIÓN Y BOTONES
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", initApp);
} else {
  initApp();
}

/* =========================================================
   SELECTOR DE COLORES PARA PDF
========================================================= */
function getPdfThemeColors() {
  const isDarkMode = document.body.classList.contains("dark-mode");
  const isBlueMode = document.body.classList.contains("dark-blue-mode");
  const isBlackMode = document.body.classList.contains("black-mode");

  if (isBlackMode) {
    return {
      pink: [255, 255, 255],
      dark: [241, 245, 249],
      light: [18, 18, 18],
      headerBg: [10, 10, 10],
      cardBorder: [40, 40, 40],
      lineDivider: [30, 30, 30],
      pageBg: [0, 0, 0],
      footerColor: [150, 150, 150]
    };
  } else if (isBlueMode) {
    return {
      pink: [56, 189, 248],
      dark: [241, 245, 249],
      light: [15, 28, 63],
      headerBg: [7, 13, 30],
      cardBorder: [30, 53, 109],
      lineDivider: [20, 36, 75],
      pageBg: [7, 13, 30],
      footerColor: [143, 165, 202]
    };
  } else if (isDarkMode) {
    return {
      pink: [255, 120, 160],
      dark: [253, 242, 246],
      light: [45, 20, 34],
      headerBg: [30, 15, 23],
      cardBorder: [74, 33, 56],
      lineDivider: [50, 22, 38],
      pageBg: [30, 15, 23],
      footerColor: [184, 146, 164]
    };
  } else {
    return {
      pink: [234, 91, 142],
      dark: [82, 22, 42],
      light: [253, 232, 238],
      headerBg: [255, 174, 195],
      cardBorder: [246, 214, 223],
      lineDivider: [246, 214, 223],
      pageBg: null,
      footerColor: [125, 80, 98]
    };
  }
}

/* Dibuja la sección "GASTOS RECURRENTES" en el PDF. Devuelve la nueva posición Y. */
function recDibujarEnPDF(pdf, theme, y) {
  const hoy = hoyAR();
  const activos = (typeof recItems !== "undefined" ? recItems : []).filter(r => r.activo !== false);
  if (!activos.length) return y;

  const nuevaPagina = () => {
    pdf.addPage();
    if (theme.pageBg) {
      pdf.setFillColor(...theme.pageBg);
      pdf.rect(0, 0, 210, 297, "F");
    }
    return 20;
  };
  // jsPDF (helvetica) no soporta emojis: se quitan del texto
  const limpiar = s => String(s || "").replace(/[^\x20-\x7E\u00C0-\u00FF]/g, "").trim();

  if (y > 235) y = nuevaPagina();

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("GASTOS RECURRENTES", 15, y);
  y += 4;

  const isBlack = document.body.classList.contains("black-mode");
  const dibujarHeader = () => {
    if (isBlack) pdf.setFillColor(30, 30, 30);
    else pdf.setFillColor(...theme.pink);
    pdf.rect(15, y, 180, 8, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "bold");
    pdf.text("NOMBRE", 18, y + 5);
    pdf.text("GRUPO", 75, y + 5);
    pdf.text("DIA", 105, y + 5);
    pdf.text("MONTO", 118, y + 5);
    pdf.text("ESTADO", 158, y + 5);
    y += 8;
  };
  dibujarHeader();
  pdf.setFont("helvetica", "normal");

  const orden = [...activos].sort((a, b) => {
    const ea = recEstado(a, hoy), eb = recEstado(b, hoy);
    if (ea.pagado !== eb.pagado) return ea.pagado ? 1 : -1;
    return (ea.dias ?? 0) - (eb.dias ?? 0);
  });

  orden.forEach(rec => {
    if (y > 270) {
      y = nuevaPagina();
      dibujarHeader();
      pdf.setFont("helvetica", "normal");
    }
    const est = recEstado(rec, hoy);
    const pago = rec.pagos && rec.pagos[hoy.mes];
    const monto = pago && pago.monto ? pago.monto : rec.monto;
    const montoTxt = monto ? recMoney(monto, rec.currency) : "A definir";

    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(7);
    pdf.text(limpiar(rec.descripcion).slice(0, 30), 18, y + 5);
    pdf.text(recGrupoDe(rec), 75, y + 5);
    pdf.text(String(recDiaEfectivo(rec.diaVence, hoy)), 105, y + 5);
    pdf.text(montoTxt, 118, y + 5);
    pdf.text(limpiar(est.texto).slice(0, 24), 158, y + 5);

    pdf.setDrawColor(...theme.lineDivider);
    pdf.line(15, y + 8, 195, y + 8);
    y += 10;
  });

  return y;
}

function generateMensualesPDF() {
  if (!window.jspdf) {
    alert("No se pudo cargar el generador de PDF.");
    return;
  }

  const { jsPDF } = window.jspdf;
  const month = $("monthPicker")?.value || currentMonthValue();
  const current = ensureMonth(month);

  // Helpers para el detalle de Changui (kilos / unidades)
  const nf3 = new Intl.NumberFormat("es-AR", { maximumFractionDigits: 3 });
  const kgLabel = (kg) => {
    kg = Number(kg) || 0;
    return kg < 1 ? `${Math.round(kg * 1000)} g` : `${nf3.format(kg)} kg`;
  };
  // jsPDF (helvetica) no soporta emojis: se quitan del texto
  const limpiarTxt = (s) => String(s || "").replace(/[^\x20-\x7E\u00C0-\u00FF]/g, "").replace(/\s+/g, " ").trim();

  let totalARS = 0;
  let totalUSD = 0;
  current.expenses.forEach(e => {
    if (e.currency === "USD") totalUSD += Number(e.amount || 0);
    else totalARS += Number(e.amount || 0);
  });

  const previous = data.months[previousMonth(month)] || { expenses: [] };
  let previousTotalARS = 0;
  previous.expenses.forEach(e => {
    if (e.currency !== "USD") previousTotalARS += Number(e.amount || 0);
  });

  const diffARS = totalARS - previousTotalARS;
  const cardSpentText = totalUSD > 0 ? `${money(totalARS)} + ${money(totalUSD, "USD")}` : money(totalARS);

  const presupuestoActual = Number(current.budget || 0);
  const presupuestoText = money(presupuestoActual);

  // --- LÓGICA DE ALERTA MULTIMONEDA PARA PDF ---
  const usdEnARS = totalUSD > 0 && currentDolarBlue > 0 ? totalUSD * currentDolarBlue : 0;
  const totalGeneralARS = totalARS + usdEnARS;

  const excedidoSoloPesos = presupuestoActual > 0 && totalARS > presupuestoActual;
  const excedidoConDolares = presupuestoActual > 0 && totalGeneralARS > presupuestoActual;
  const hayExceso = presupuestoActual > 0 && (excedidoSoloPesos || excedidoConDolares || totalUSD > 0);

  let mensajeAlertaPDF = "";
  if (hayExceso) {
    if (excedidoSoloPesos && totalUSD > 0) {
      const exceso = totalARS - presupuestoActual;
      mensajeAlertaPDF = `Atencion: Exceso de ${money(exceso)} en pesos y gastos por ${money(totalUSD, "USD")}.`;
    } else if (excedidoSoloPesos) {
      const exceso = totalARS - presupuestoActual;
      mensajeAlertaPDF = `Atencion: Exceso de gastos de ${money(exceso)} sobre el presupuesto.`;
    } else if (excedidoConDolares && currentDolarBlue > 0) {
      const exceso = totalGeneralARS - presupuestoActual;
      mensajeAlertaPDF = `Atencion (Dolar Blue): Exceso equivalente a ${money(exceso)} (USD: ${money(totalUSD, "USD")}).`;
    } else if (totalUSD > 0) {
      mensajeAlertaPDF = `Atencion: Gastos por ${money(totalUSD, "USD")} no cubiertos en el presupuesto en pesos.`;
    }
  }

  const diffText = `${diffARS <= 0 ? "- " : "+ "}${money(Math.abs(diffARS))}`;

  const pdf = new jsPDF({ unit: "mm", format: "a4" });
  const theme = getPdfThemeColors();

  const nuevaPagina = () => {
    pdf.addPage();
    if (theme.pageBg) {
      pdf.setFillColor(...theme.pageBg);
      pdf.rect(0, 0, 210, 297, "F");
    }
    return 20;
  };

  if (theme.pageBg) {
    pdf.setFillColor(...theme.pageBg);
    pdf.rect(0, 0, 210, 297, "F");
  }

  pdf.setFillColor(...theme.headerBg);
  pdf.roundedRect(15, 15, 180, 28, 4, 4, "F");

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(17);
  pdf.setFont("helvetica", "bold");
  pdf.text("CONTROL DE GASTOS MENSUALES", 21, 25);

  pdf.setFontSize(8);
  pdf.setFont("helvetica", "normal");
  pdf.text(`Reporte - ${monthName(month)}`, 21, 31);

  // Cartel de alerta visible en el encabezado del PDF
  if (hayExceso && mensajeAlertaPDF) {
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "bold");

    const isDark = document.body.classList.contains("dark-mode") ||
                   document.body.classList.contains("dark-blue-mode") ||
                   document.body.classList.contains("black-mode");
    if (isDark) {
      pdf.setTextColor(255, 255, 255);
    } else {
      pdf.setTextColor(185, 28, 28);
    }

    pdf.text(mensajeAlertaPDF, 21, 38);
  }

  const cards = [
    ["PRESUPUESTO", presupuestoText],
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
    pdf.setFontSize(7.5);
    pdf.setFont("helvetica", "normal");
    pdf.text(card[1], x + 3, 65);
  });

  let y = 84;

  const isBlackMode = document.body.classList.contains("black-mode");
  if (isBlackMode) {
    pdf.setFillColor(30, 30, 30);
  } else {
    pdf.setFillColor(...theme.pink);
  }

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

  current.expenses.slice().sort((a, b) => String(a.date || "").localeCompare(String(b.date || ""))).forEach(expense => {
    if (y > 230) y = nuevaPagina();

    const curr = expense.currency || "ARS";
    const detalle = Array.isArray(expense.detalle) ? expense.detalle : [];
    const tieneDetalle = detalle.length > 0;

    let cleanDescription = String(expense.description || "").replace("🔄 ", "").trim();
    // Si hay detalle, la lista de productos va debajo: la descripción queda corta
    if (tieneDetalle) {
      cleanDescription = cleanDescription.replace(/\s*\([^()]*\)\s*$/, "").trim() || cleanDescription;
    }

    // Fila principal del gasto
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...theme.dark);
    pdf.setFontSize(7);
    pdf.text(formatDate(expense.date), 18, y + 5);
    pdf.text(limpiarTxt(cleanDescription).slice(0, 35), 45, y + 5);
    pdf.text(String(expense.category).slice(0, 18), 120, y + 5);
    pdf.text(money(expense.amount, curr), 165, y + 5);

    if (!tieneDetalle) {
      pdf.setDrawColor(...theme.lineDivider);
      pdf.line(15, y + 8, 195, y + 8);
      y += 10;
      return;
    }

    // Detalle de productos: cantidad (kg / unidades), precio y subtotal
    let sy = y + 9.5;
    detalle.forEach(it => {
      if (sy > 272) {
        y = nuevaPagina();
        sy = y + 5;
      }
      const icur = it.cur || curr;
      const paid = Number(it.paid) || 0;
      const units = it.byKg ? (Number(it.kg) || 1) : (Number(it.qty) || 1);
      const cantTxt = it.byKg ? kgLabel(it.kg) : `${Number(it.qty) || 1} u`;

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(6.5);
      pdf.setTextColor(...theme.footerColor);
      pdf.text("- " + (limpiarTxt(it.name) || "Producto").slice(0, 38), 50, sy);
      pdf.text(cantTxt, 120, sy);
      if (paid > 0) {
        pdf.text(money(paid / units, icur) + (it.byKg ? " /kg" : ""), 138, sy);
        pdf.text(money(paid, icur), 165, sy);
      } else {
        pdf.text("Sin precio", 138, sy);
        pdf.text("-", 165, sy);
      }
      sy += 4.5;
    });

    pdf.setDrawColor(...theme.lineDivider);
    pdf.line(15, sy - 2, 195, sy - 2);
    y = sy + 1;
  });

  // Sección de gastos recurrentes en el PDF
  y = recDibujarEnPDF(pdf, theme, y + 8);

  y += 12;
  if (y > 220) y = nuevaPagina() + 5;

  const categoryTotals = {};
  current.expenses.forEach(e => {
    const cat = e.category || "Otros";
    const amt = Number(e.amount || 0);
    categoryTotals[cat] = (categoryTotals[cat] || 0) + amt;
  });
  const topCat = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])[0] || ["—", 0];

  let highestExpenseText = "";
  const highestExpense = [...current.expenses].sort((a, b) => Number(b.amount || 0) - Number(a.amount || 0))[0];
  if (highestExpense) {
    const cleanDesc = String(highestExpense.description || "").replace("🔄 ", "").replace("/", " - ").trim();
    highestExpenseText = ` Asimismo, tu gasto más elevado individualmente correspondió a "${cleanDesc}" por un monto de ${money(highestExpense.amount, highestExpense.currency || "ARS")}.`;
  }

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(10);
  pdf.setFont("helvetica", "bold");
  pdf.text("RESUMEN Y TENDENCIA DEL PERÍODO", 15, y);

  y += 6;

  pdf.setFillColor(...theme.light);
  pdf.setDrawColor(...theme.cardBorder);
  pdf.roundedRect(15, y, 180, 34, 3, 3, "FD");

  pdf.setTextColor(...theme.pink);
  pdf.setFontSize(7);
  pdf.setFont("helvetica", "bold");
  pdf.text("ANÁLISIS DE HÁBITOS FINANCIEROS", 21, y + 7);

  pdf.setTextColor(...theme.dark);
  pdf.setFontSize(7.5);
  pdf.setFont("helvetica", "normal");

  let trendSummary = `Durante ${monthName(month)}, registraste un total de ${current.expenses.length} movimientos. La categoría que mayor presupuesto demandó fue "${topCat[0]}" con un acumulado de ${money(topCat[1])}.${highestExpenseText}`;

  const splitTrend = pdf.splitTextToSize(trendSummary, 165);
  pdf.text(splitTrend, 21, y + 14);

  // Pie de página en todas las hojas
  const totalPages = pdf.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    pdf.setPage(i);
    pdf.setFontSize(7);
    pdf.setFont("helvetica", "normal");
    pdf.setTextColor(...theme.footerColor);
    pdf.text("MENSUALES - Creado por Flor Bagnis", 15, 287);
    pdf.text(`${i} / ${totalPages}`, 195, 287, { align: "right" });
  }

  pdf.save(`MENSUALES-${month}.pdf`);
}

function calculateAnnualData() {
  const currentYear = String(hoyAR().y);
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
      if (e.currency === "USD") {
        totalUSD += amt;
      } else {
        monthARS += amt;
        totalARS += amt;
      }

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
  pdf.text(`Generado por Flor Bagnis - Mensuales PWA`, 21, 33);

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
    pdf.setFontSize(10);
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
  const summaryText = `Durante el año ${annual.currentYear}, registraste movimientos en ${annual.monthsCount} meses. Tu mes con mayor actividad financiera fue ${annual.highestMonth.name} y la categoría que acumuló más gastos resultó ser "${annual.topCategory[0]}".`;
  const splitSummary = pdf.splitTextToSize(summaryText, 168);
  pdf.text(splitSummary, 21, currentY + 14);

  pdf.setFontSize(7);
  pdf.setTextColor(...theme.footerColor);
  pdf.text("Resumen Anual - Creado por Flor Bagnis", 15, 287);

  pdf.save(`Resumen-Anual-${annual.currentYear}.pdf`);
}


/* =========================================================
   SISTEMA DE ALERTAS DE PRESUPUESTO
========================================================= */
function checkFinancialAlerts(totalARS, totalUSD, presupuesto, cotizacionBlue) {
  let alertaPresupuestoContainer = document.getElementById("alertaPresupuesto");
  if (!alertaPresupuestoContainer) {
    alertaPresupuestoContainer = document.createElement("div");
    alertaPresupuestoContainer.id = "alertaPresupuesto";
    alertaPresupuestoContainer.className = "budget-alert-banner hidden";
    const hero = document.querySelector("header.hero") || document.querySelector("main");
    if (hero) hero.insertAdjacentElement("afterend", alertaPresupuestoContainer);
  }

  // Se remueve cualquier color en línea para que mande el CSS según el tema
  alertaPresupuestoContainer.style.color = "";

  const usdEnARS = totalUSD > 0 && cotizacionBlue > 0 ? totalUSD * cotizacionBlue : 0;
  const totalGeneralARS = totalARS + usdEnARS;

  const excedidoSoloPesos = presupuesto > 0 && totalARS > presupuesto;
  const excedidoConDolares = presupuesto > 0 && totalGeneralARS > presupuesto;

  if (presupuesto > 0 && (excedidoSoloPesos || excedidoConDolares || totalUSD > 0)) {
    let mensaje = "";

    if (excedidoSoloPesos && totalUSD > 0) {
      const excesoARS = totalARS - presupuesto;
      mensaje = `<strong>¡Atención! Te excediste del presupuesto en pesos</strong> por <strong>${money(excesoARS)}</strong> y además tenés gastos por <strong>${money(totalUSD, "USD")}</strong>.`;
    } else if (excedidoSoloPesos) {
      const excesoARS = totalARS - presupuesto;
      mensaje = `<strong>¡Atención! Te excediste del presupuesto mensual</strong> por <strong>${money(excesoARS)}</strong>.`;
    } else if (excedidoConDolares && cotizacionBlue > 0) {
      const excesoConvertido = totalGeneralARS - presupuesto;
      mensaje = `<strong>¡Atención! Considerando la cotización Blue, superaste el presupuesto</strong> por un equivalente a <strong>${money(excesoConvertido)}</strong> (gastos en USD: <strong>${money(totalUSD, "USD")}</strong>).`;
    } else if (totalUSD > 0 && totalARS <= presupuesto) {
      mensaje = `<strong>Atención:</strong> Tenés gastos por <strong>${money(totalUSD, "USD")}</strong> no cubiertos en el presupuesto en pesos.`;
    }

    if (mensaje) {
      alertaPresupuestoContainer.innerHTML = `
        <span style="font-size: 1.2rem; margin-right: 6px;">⚠️</span>
        <div style="display: inline;">${mensaje}</div>
      `;
      alertaPresupuestoContainer.classList.remove("hidden");
      return;
    }
  }

  alertaPresupuestoContainer.classList.add("hidden");
}


/* =========================================================
   GASTOS RECURRENTES (suscripciones, servicios, impuestos...)
   Colección compartida entre las dos apps: users/{uid}/recurrentes
   Cada documento:
   { descripcion, categoria, diaVence, monto, currency, avisar, activo,
     pagos: { "2026-10": { fecha, monto, mensualId } } }
========================================================= */

const REC_GRUPOS = ["Internet", "Suscripciones", "Servicios", "Impuestos", "Alquiler", "Otros"];
const REC_ICONOS = { Internet: "🌐", Suscripciones: "📱", Servicios: "💡", Impuestos: "🏛️", Alquiler: "🏠", Otros: "📦" };
const REC_DIAS_POR_VENCER = 3;
const REC_KW_INTERNET = /\b(internet|wifi|fibertel|flow|telecentro|iplan)\b/;
const REC_KW_IMPUESTOS = /\b(impuestos?|monotributo|arba|afip|agip|abl|patente|inmobiliario|ganancias|iva|rentas)\b/;

let recItems = [];
let recUnsub = null;
let recTimer = null;


/* ---------- Lógica de fechas y estados ---------- */

function recNormalizar(s) {
  return String(s ?? "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
}

function recEsc(s) {
  return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));
}

function recGrupoDe(rec) {
  const cat = String(rec.categoria || "").trim();
  if (cat === "Internet" || cat === "Impuestos") return cat;
  const desc = recNormalizar(rec.descripcion);
  if (REC_KW_INTERNET.test(desc)) return "Internet";
  if (REC_KW_IMPUESTOS.test(desc)) return "Impuestos";
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
  if (pago) {
    const f = pago.fecha ? ` el ${pago.fecha.slice(8, 10)}/${pago.fecha.slice(5, 7)}` : "";
    return { clase: "paid", texto: `✅ Pagado${f}`, dias: null, pagado: true };
  }
  const dias = recDiasMensual(rec.diaVence, hoy);
  if (dias < 0) return { clase: "late", texto: `⚠️ Vencido hace ${-dias} ${dias === -1 ? "día" : "días"}`, dias, pagado: false };
  if (dias === 0) return { clase: "soon", texto: "🌸 Vence hoy", dias, pagado: false };
  if (dias === 1) return { clase: "soon", texto: "🌸 Vence mañana", dias, pagado: false };
  if (dias <= REC_DIAS_POR_VENCER) return { clase: "soon", texto: `🌸 Vence en ${dias} días`, dias, pagado: false };
  return { clase: "wait", texto: `⏳ Vence el ${recDiaEfectivo(rec.diaVence, hoy)}`, dias, pagado: false };
}

function recMoney(value, currency = "ARS") {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: currency === "USD" ? "USD" : "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2
  }).format(Number(value || 0));
}

function recParse(val) {
  if (val === null || val === undefined || String(val).trim() === "") return null;
  const n = parseFloat(String(val).replace(/\./g, "").replace(",", "."));
  return isNaN(n) ? null : n;
}


/* ---------- Firestore ---------- */

function recPayload(rec) {
  return {
    descripcion: String(rec.descripcion || "").trim(),
    categoria: rec.categoria || "Otros",
    diaVence: Number(rec.diaVence) || 1,
    monto: rec.monto === null || rec.monto === undefined || isNaN(rec.monto) ? null : Number(rec.monto),
    currency: rec.currency || "ARS",
    avisar: rec.avisar !== false,
    activo: rec.activo !== false,
    pagos: rec.pagos || {},
    createdAt: rec.createdAt || new Date().toISOString()
  };
}

async function recGuardar(rec) {
  if (!currentUser) return;
  await setDoc(doc(db, "users", currentUser.uid, "recurrentes", rec.id), recPayload(rec));
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

    // Lo suma como gasto en MENSUALES
    const monthRef = doc(db, "users", currentUser.uid, "months", hoy.mes);
    const snap = await getDoc(monthRef);
    let monthData = { budget: 0, expenses: [] };
    if (snap.exists()) {
      monthData = snap.data();
      if (!Array.isArray(monthData.expenses)) monthData.expenses = [];
    }
    monthData.expenses = monthData.expenses.filter(e => e.id !== mensualId);
    monthData.expenses.push({
      id: mensualId,
      date: hoy.iso,
      description: rec.descripcion,
      category: recCategoriaMensual(rec),
      amount: Number(monto),
      currency: rec.currency || "ARS"
    });
    await setDoc(monthRef, monthData, { merge: true });
  } catch (err) {
    console.error("Error al registrar pago recurrente:", err);
    alert("No se pudo registrar el pago. Revisá tu conexión e intentá de nuevo.");
  }
}

async function recDeshacerPago(id) {
  const rec = recItems.find(r => r.id === id);
  if (!rec || !currentUser) return;
  const hoy = hoyAR();
  const pago = rec.pagos && rec.pagos[hoy.mes];
  if (!pago) return;
  if (!confirm(`¿Volver "${rec.descripcion}" a pendiente y quitarlo de MENSUALES?`)) return;

  const pagos = { ...rec.pagos };
  delete pagos[hoy.mes];
  const mensualId = pago.mensualId || `rec-${rec.id}-${hoy.mes}`;

  try {
    await recGuardar({ ...rec, pagos });
    const monthRef = doc(db, "users", currentUser.uid, "months", hoy.mes);
    const snap = await getDoc(monthRef);
    if (snap.exists()) {
      const monthData = snap.data();
      if (Array.isArray(monthData.expenses)) {
        monthData.expenses = monthData.expenses.filter(e => e.id !== mensualId);
        await setDoc(monthRef, monthData, { merge: true });
      }
    }
  } catch (err) {
    console.error("Error al deshacer pago recurrente:", err);
    alert("No se pudo deshacer el pago.");
  }
}

async function recEliminar(id) {
  const rec = recItems.find(r => r.id === id);
  if (!rec || !currentUser) return;
  if (!confirm(`¿Eliminar el recurrente "${rec.descripcion}"? Los pagos ya cargados en MENSUALES no se borran.`)) return;
  try {
    await deleteDoc(doc(db, "users", currentUser.uid, "recurrentes", id));
  } catch (err) {
    console.error(err);
    alert("No se pudo eliminar.");
  }
}


/* ---------- Interfaz ---------- */

function recAbrirDialog(rec = null) {
  const dlg = document.getElementById("recDialog");
  if (!dlg) return;
  document.getElementById("recFId").value = rec ? rec.id : "";
  document.getElementById("recFDesc").value = rec ? rec.descripcion || "" : "";
  document.getElementById("recFGrupo").value = rec ? recGrupoDe(rec) : "Suscripciones";
  document.getElementById("recFDia").value = rec ? rec.diaVence : hoyAR().d;
  document.getElementById("recFMonto").value = rec && rec.monto ? formatCurrencyInput(String(rec.monto).replace(".", ",")) : "";
  document.getElementById("recFMoneda").value = rec ? rec.currency || "ARS" : "ARS";
  document.getElementById("recFAvisar").checked = rec ? rec.avisar !== false : true;
  document.getElementById("recDialogTitle").textContent = rec ? "Editar recurrente" : "Agregar recurrente";
  dlg.showModal();
}

async function recSubmitForm(e) {
  e.preventDefault();
  const id = document.getElementById("recFId").value;
  const descripcion = document.getElementById("recFDesc").value.trim();
  const dia = Number(document.getElementById("recFDia").value);
  if (!descripcion) { alert("Escribí un nombre (ej: Netflix, Fibertel, Monotributo)."); return; }
  if (!dia || dia < 1 || dia > 31) { alert("El día de vencimiento tiene que estar entre 1 y 31."); return; }

  const existente = id ? recItems.find(r => r.id === id) : null;
  const rec = {
    id: id || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `rec-${Date.now()}-${Math.random().toString(36).slice(2)}`),
    descripcion,
    categoria: document.getElementById("recFGrupo").value,
    diaVence: dia,
    monto: recParse(document.getElementById("recFMonto").value),
    currency: document.getElementById("recFMoneda").value,
    avisar: document.getElementById("recFAvisar").checked,
    activo: true,
    pagos: existente ? existente.pagos || {} : {},
    createdAt: existente ? existente.createdAt : new Date().toISOString()
  };

  try {
    await recGuardar(rec);
    document.getElementById("recDialog").close();
  } catch (err) {
    console.error(err);
    alert("No se pudo guardar el recurrente.");
  }
}

function recItemHTML(rec, hoy) {
  const est = recEstado(rec, hoy);
  const pago = rec.pagos && rec.pagos[hoy.mes];
  const montoMostrado = pago && pago.monto ? pago.monto : rec.monto;
  const montoTxt = montoMostrado ? recMoney(montoMostrado, rec.currency) : "Monto a definir";
  const mail = rec.avisar === false ? "" : " · 📧";
  return `
    <div class="rec-item">
      <div class="rec-info">
        <span class="rec-name">${recEsc(rec.descripcion)}</span>
        <span class="rec-meta">Día ${recDiaEfectivo(rec.diaVence, hoy)} · <span class="rec-amount">${montoTxt}</span>${mail}</span>
      </div>
      <span class="rec-badge ${est.clase}">${est.texto}</span>
      <div class="rec-actions">
        ${est.pagado
          ? `<button type="button" class="rec-icon" data-act="unpay" data-id="${rec.id}" title="Deshacer pago">↩</button>`
          : `<button type="button" class="rec-icon pay" data-act="pay" data-id="${rec.id}" title="Marcar como pagado">✓</button>`}
        <button type="button" class="rec-icon" data-act="edit" data-id="${rec.id}" title="Editar">✏️</button>
        <button type="button" class="rec-icon" data-act="delete" data-id="${rec.id}" title="Eliminar">🗑️</button>
      </div>
    </div>`;
}

function recRender() {
  const lista = document.getElementById("recList");
  if (!lista) return;
  const scrollState = captureScroll();
  const hoy = hoyAR();
  const activos = recItems.filter(r => r.activo !== false);

  // Cartel de aviso
  const pendientes = activos.filter(r => !recEstado(r, hoy).pagado);
  let vencidos = 0, porVencer = 0;
  pendientes.forEach(r => {
    const d = recEstado(r, hoy).dias;
    if (d < 0) vencidos++;
    else if (d <= REC_DIAS_POR_VENCER) porVencer++;
  });
  const partes = [];
  if (vencidos) partes.push(`⚠️ ${vencidos} ${vencidos === 1 ? "vencido" : "vencidos"}`);
  if (porVencer) partes.push(`🌸 ${porVencer} por vencer (${REC_DIAS_POR_VENCER} días)`);
  const banner = document.getElementById("recBanner");
  if (banner) {
    banner.textContent = partes.join(" · ");
    banner.style.display = partes.length ? "block" : "none";
    banner.className = "rec-banner" + (vencidos ? " late" : " soon");
  }

  // Resumen
  let faltaARS = 0, faltaUSD = 0;
  pendientes.forEach(r => {
    if (!r.monto) return;
    if (r.currency === "USD") faltaUSD += Number(r.monto);
    else faltaARS += Number(r.monto);
  });
  const resumen = document.getElementById("recResumen");
  if (resumen) {
    if (!activos.length) {
      resumen.textContent = "";
    } else {
      const falta = [faltaARS > 0 ? recMoney(faltaARS) : "", faltaUSD > 0 ? recMoney(faltaUSD, "USD") : ""].filter(Boolean).join(" + ") || "$0";
      resumen.innerHTML = `Pagados: <b>${activos.length - pendientes.length} de ${activos.length}</b> · Falta pagar: <b class="rec-amount">${falta}</b>`;
    }
  }

  // Lista agrupada
  if (!activos.length) {
    lista.innerHTML = `<div class="rec-empty">Todavía no cargaste recurrentes.<br>Agregá Netflix, Fibertel, el alquiler, el monotributo… y te aviso antes de que venzan.</div>`;
    restoreScroll(scrollState);
    return;
  }

  let html = "";
  REC_GRUPOS.forEach(g => {
    const items = activos.filter(r => recGrupoDe(r) === g);
    if (!items.length) return;
    items.sort((a, b) => {
      const ea = recEstado(a, hoy), eb = recEstado(b, hoy);
      if (ea.pagado !== eb.pagado) return ea.pagado ? 1 : -1;
      return (ea.dias ?? 0) - (eb.dias ?? 0);
    });
    html += `<div class="rec-group"><h4>${REC_ICONOS[g]} ${g}</h4>${items.map(r => recItemHTML(r, hoy)).join("")}</div>`;
  });
  lista.innerHTML = html;
  restoreScroll(scrollState);
}

function recMontarUI() {
  if (document.getElementById("recSection")) return;

  const style = document.createElement("style");
  style.id = "recStyles";
  style.textContent = `
    .rec-panel{margin:1.5rem 0;padding:20px;border-radius:20px;border:1px solid rgba(128,128,128,.25);background:rgba(128,128,128,.06);color:inherit;box-sizing:border-box}
    .rec-head{display:flex;justify-content:space-between;align-items:flex-start;gap:10px;flex-wrap:wrap;margin-bottom:10px}
    .rec-head h2{margin:0;font-size:1.15rem}
    .rec-head p{margin:2px 0 0;font-size:.8rem;opacity:.75}
    .rec-head-btns{display:flex;gap:8px;flex-wrap:wrap}
    .rec-btn{background:#fbc4d4;color:#5a2337;border:1px solid #f29cb5;border-radius:12px;padding:9px 16px;font-weight:700;font-size:13px;cursor:pointer}
    .rec-btn.ghost{background:transparent;color:inherit;border:1px solid rgba(128,128,128,.4)}
    .rec-banner{display:none;margin:8px 0;padding:10px 14px;border-radius:12px;font-weight:700;font-size:.9rem}
    .rec-banner.late{background:rgba(220,50,60,.15);color:#d32f2f}
    .rec-banner.soon{background:rgba(240,140,30,.18);color:#c26a00}
    .rec-resumen{font-size:.85rem;margin:6px 0 10px;opacity:.9}
    .rec-group h4{margin:14px 0 6px;font-size:.85rem;letter-spacing:.3px;opacity:.85}
    .rec-item{display:grid;grid-template-columns:1fr auto auto;gap:10px;align-items:center;padding:10px 12px;margin-bottom:6px;border-radius:14px;border:1px solid rgba(128,128,128,.2);background:rgba(128,128,128,.07)}
    .rec-info{display:flex;flex-direction:column;min-width:0}
    .rec-name{font-weight:700;overflow:hidden;text-overflow:ellipsis}
    .rec-meta{font-size:.78rem;opacity:.75}
    .rec-badge{font-size:.75rem;font-weight:700;padding:4px 10px;border-radius:999px;white-space:nowrap}
    .rec-badge.paid{background:rgba(34,160,90,.15);color:#1f8a4c}
    .rec-badge.soon{background:rgba(240,140,30,.18);color:#c26a00}
    .rec-badge.late{background:rgba(220,50,60,.15);color:#d32f2f}
    .rec-badge.wait{background:rgba(128,128,128,.15)}
    body:is(.dark-mode,.dark-blue-mode,.black-mode) .rec-badge.paid{color:#6fdc9a}
    body:is(.dark-mode,.dark-blue-mode,.black-mode) .rec-badge.soon,body:is(.dark-mode,.dark-blue-mode,.black-mode) .rec-banner.soon{color:#ffb454}
    body:is(.dark-mode,.dark-blue-mode,.black-mode) .rec-badge.late,body:is(.dark-mode,.dark-blue-mode,.black-mode) .rec-banner.late{color:#ff8a8f}
    .rec-actions{display:flex;gap:4px}
    .rec-icon{width:32px;height:32px;border-radius:50%;border:1px solid rgba(128,128,128,.3);background:transparent;color:inherit;cursor:pointer;font-size:14px;display:grid;place-items:center;padding:0}
    .rec-icon.pay{background:rgba(34,160,90,.18);border-color:rgba(34,160,90,.5)}
    .rec-btn,.rec-icon{transition:background .2s,color .2s,border-color .2s,transform .15s,box-shadow .2s}
    .rec-btn:hover{background:#f29cb5;border-color:#ea5b8e;transform:translateY(-2px);box-shadow:0 6px 14px rgba(234,91,142,.3)}
    .rec-btn.ghost:hover{background:#fbc4d4;color:#5a2337;border-color:#f29cb5}
    .rec-btn:active,.rec-icon:active{transform:translateY(0) scale(.97)}
    .rec-icon:hover{background:#fbc4d4;border-color:#f29cb5;transform:scale(1.12);box-shadow:0 3px 8px rgba(234,91,142,.3)}
    .rec-icon.pay:hover{background:rgba(34,160,90,.35);border-color:rgba(34,160,90,.8)}
    .rec-item{transition:border-color .2s,background .2s}
    .rec-item:hover{border-color:#f29cb5;background:rgba(251,196,212,.18)}
    .rec-empty{text-align:center;padding:20px 10px;opacity:.75;font-size:.9rem}
    .rec-collapsed .rec-body{display:none}
    body.amounts-hidden .rec-amount{filter:blur(6px);user-select:none}
    @media (max-width:600px){.rec-item{grid-template-columns:1fr auto}.rec-badge{grid-column:1;justify-self:start}.rec-actions{grid-row:1;grid-column:2}}
    .rec-dialog{--rec-bg:#fff;--rec-fg:#333;--rec-line:#e5d3da;border:1px solid var(--rec-line);border-radius:22px;padding:24px;max-width:420px;width:92%;background:var(--rec-bg);color:var(--rec-fg)}
    body.dark-mode .rec-dialog{--rec-bg:#2a161d;--rec-fg:#ffb6c1;--rec-line:#4e2b37}
    body.dark-blue-mode .rec-dialog{--rec-bg:#0f1c3f;--rec-fg:#f1f5f9;--rec-line:#1e3a8a}
    body.black-mode .rec-dialog{--rec-bg:#121212;--rec-fg:#fff;--rec-line:#333}
    .rec-dialog::backdrop{background:rgba(0,0,0,.45);backdrop-filter:blur(6px)}
    .rec-dialog h3{margin:0 0 14px}
    .rec-dialog label{display:grid;gap:5px;font-size:.78rem;font-weight:700;margin-bottom:12px}
    .rec-dialog input[type=text],.rec-dialog input[type=number],.rec-dialog select{width:100%;box-sizing:border-box;padding:10px 12px;border-radius:10px;border:1px solid var(--rec-line);background:transparent;color:var(--rec-fg);font:inherit;font-size:.9rem}
    .rec-dialog select option{color:#333}
    .rec-row{display:grid;grid-template-columns:1fr 110px;gap:10px}
    .rec-check{display:flex!important;grid-template-columns:none!important;align-items:center;gap:8px!important;font-weight:600!important}
    .rec-check input{width:auto}
    .rec-dialog-actions{display:flex;justify-content:flex-end;gap:8px;margin-top:6px}
  `;
  document.head.appendChild(style);

  const section = document.createElement("section");
  section.id = "recSection";
  section.className = "rec-panel";
  section.innerHTML = `
    <div class="rec-head">
      <div>
        <h2>🔁 Gastos recurrentes</h2>
        <p>Suscripciones, servicios, impuestos y todo lo que se paga todos los meses. Te avisamos por mail antes de que venzan.</p>
      </div>
      <div class="rec-head-btns">
        <button type="button" class="rec-btn" id="recAddBtn">＋ Agregar recurrente</button>
        <button type="button" class="rec-btn ghost" id="recToggleBtn">▲ Ocultar</button>
      </div>
    </div>
    <div class="rec-body">
      <div id="recBanner" class="rec-banner"></div>
      <div id="recResumen" class="rec-resumen"></div>
      <div id="recList"></div>
    </div>
    <dialog id="recDialog" class="rec-dialog">
      <form id="recForm">
        <h3 id="recDialogTitle">Agregar recurrente</h3>
        <input type="hidden" id="recFId">
        <label>Nombre
          <input type="text" id="recFDesc" placeholder="Ej: Netflix, Fibertel, Monotributo" maxlength="80" required>
        </label>
        <label>Grupo
          <select id="recFGrupo">${REC_GRUPOS.map(g => `<option value="${g}">${REC_ICONOS[g]} ${g}</option>`).join("")}</select>
        </label>
        <div class="rec-row">
          <label>Monto (opcional)
            <input type="text" id="recFMonto" inputmode="decimal" placeholder="0,00">
          </label>
          <label>Moneda
            <select id="recFMoneda"><option value="ARS">ARS ($)</option><option value="USD">USD (u$s)</option></select>
          </label>
        </div>
        <label>Día del mes en que vence
          <input type="number" id="recFDia" min="1" max="31" value="10">
        </label>
        <label class="rec-check"><input type="checkbox" id="recFAvisar" checked> 📧 Avisarme por mail antes de que venza</label>
        <div class="rec-dialog-actions">
          <button type="button" class="rec-btn ghost" id="recCancelBtn">Cancelar</button>
          <button type="submit" class="rec-btn">Guardar</button>
        </div>
      </form>
    </dialog>
  `;

  // Ubicación: en Mensuales antes de "Gastos del mes"; en Próximos después del resumen
  const tabla = document.getElementById("tableContentWrapper");
  const panelGastos = tabla ? tabla.closest(".panel") : null;
  const resumenGrid = document.querySelector(".summary-grid");
  if (panelGastos && panelGastos.parentNode) {
    panelGastos.parentNode.insertBefore(section, panelGastos);
  } else if (resumenGrid) {
    resumenGrid.insertAdjacentElement("afterend", section);
  } else {
    (document.getElementById("appContent") || document.body).appendChild(section);
  }

  // Eventos
  document.getElementById("recAddBtn").addEventListener("click", () => recAbrirDialog());
  document.getElementById("recCancelBtn").addEventListener("click", () => document.getElementById("recDialog").close());
  document.getElementById("recForm").addEventListener("submit", recSubmitForm);
  document.getElementById("recFMonto").addEventListener("input", e => {
    const start = e.target.selectionStart;
    const prevLen = e.target.value.length;
    e.target.value = formatCurrencyInput(e.target.value);
    const pos = Math.max(0, start + (e.target.value.length - prevLen));
    e.target.setSelectionRange(pos, pos);
  });
  document.getElementById("recList").addEventListener("click", e => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;
    const id = btn.dataset.id;
    if (btn.dataset.act === "pay") recPagar(id);
    if (btn.dataset.act === "unpay") recDeshacerPago(id);
    if (btn.dataset.act === "edit") recAbrirDialog(recItems.find(r => r.id === id));
    if (btn.dataset.act === "delete") recEliminar(id);
  });

  // Ocultar / mostrar (recuerda la elección)
  const toggleBtn = document.getElementById("recToggleBtn");
  let colapsado = false;
  try { colapsado = localStorage.getItem("recurrentes_collapsed") === "true"; } catch (e) {}
  const aplicarColapso = () => {
    section.classList.toggle("rec-collapsed", colapsado);
    toggleBtn.textContent = colapsado ? "▼ Mostrar" : "▲ Ocultar";
  };
  aplicarColapso();
  toggleBtn.addEventListener("click", () => {
    colapsado = !colapsado;
    try { localStorage.setItem("recurrentes_collapsed", colapsado); } catch (e) {}
    aplicarColapso();
  });

  // Que los estados cambien solos a las 00:00 hora argentina
  if (!recTimer) recTimer = setInterval(recRender, 60000);
}

function startRecurrentes() {
  stopRecurrentes();
  if (!currentUser) return;
  recMontarUI();
  recUnsub = onSnapshot(
    collection(db, "users", currentUser.uid, "recurrentes"),
    snapshot => {
      recItems = [];
      snapshot.forEach(d => recItems.push({ id: d.id, ...d.data() }));
      recRender();
    },
    err => console.error("Error al sincronizar recurrentes:", err)
  );
}

function stopRecurrentes() {
  if (typeof recUnsub === "function") { recUnsub(); recUnsub = null; }
  recItems = [];
  recRender();
}


/* =========================================================
   PUENTE CON POCKI (metas de ahorro)
========================================================= */
window.PockiBridge = {
  getDolar: () => currentDolarBlue,

  // Misma paleta que usan los PDF de Mensuales
  getPdfTheme: () => getPdfThemeColors(),

  // Sobrante mensual sin contar los retiros de Pocki
  getMonthlySurplusARS: () => {
    const vals = [];
    Object.keys(data.months).sort().reverse().slice(0, 6).forEach(k => {
      const m = data.months[k];
      const gastado = (m.expenses || []).reduce((s, e) => e.currency === "USD" ? s : s + Number(e.amount || 0), 0);
      const retiros = (m.extraIncomes || []).filter(x => x.fromPocki).reduce((s, x) => s + Number(x.amount || 0), 0);
      const presupuesto = Number(m.budget || 0) - retiros;
      if (presupuesto > 0 && gastado > 0) vals.push(presupuesto - gastado);
    });
    return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : null;
  },

  // Retiro de una meta -> ingreso "Ahorro" en el presupuesto del mes actual
  addWithdrawal: async ({ amount, currency, description, goalId }) => {
    if (!currentUser || !(amount > 0)) return false;
    const isUSD = currency === "USD";
    if (isUSD && !(currentDolarBlue > 0)) return false;

    const hoy = hoyAR();
    const month = ensureMonth(hoy.mes);

    if (month.extraIncomes.length === 0 && Number(month.budget) > 0) {
      month.extraIncomes.push({
        id: createId("base"), isBase: true, date: `${hoy.mes}-01`, category: "Presupuesto Base",
        description: "Presupuesto inicial", amount: Number(month.budget), rawAmount: Number(month.budget), currency: "ARS"
      });
    }

    const id = createId("pocki");
    month.extraIncomes.push({
      id,
      fromPocki: true,
      pockiGoalId: goalId,
      date: hoy.iso,
      category: "Ahorro",
      description,
      amount: isUSD ? amount * currentDolarBlue : amount,
      rawAmount: amount,
      currency: isUSD ? "USD" : "ARS"
    });
    month.budget = month.extraIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);

    renderMensuales();
    await saveMonthToFirestore(hoy.mes);
    return { id, month: hoy.mes };
  },

  // Editar el monto de un retiro desde el Historial de Pocki
  updateWithdrawal: async ({ month, id, amount }) => {
    const m = data.months[month];
    const item = m && Array.isArray(m.extraIncomes) ? m.extraIncomes.find(x => x.id === id) : null;
    if (!item || !(amount > 0)) return false;
    const rate = item.currency === "USD" && Number(item.rawAmount) > 0 ? Number(item.amount) / Number(item.rawAmount) : 1;
    item.rawAmount = amount;
    item.amount = amount * rate;
    m.budget = m.extraIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    renderMensuales();
    await saveMonthToFirestore(month);
    return true;
  },

  // Eliminar un retiro desde el Historial de Pocki
  removeWithdrawal: async ({ month, id }) => {
    const m = data.months[month];
    if (!m || !Array.isArray(m.extraIncomes)) return false;
    m.extraIncomes = m.extraIncomes.filter(x => x.id !== id);
    m.budget = m.extraIncomes.reduce((s, i) => s + Number(i.amount || 0), 0);
    renderMensuales();
    await saveMonthToFirestore(month);
    return true;
  }
};


/* =========================================================
   PUENTE CON CHANGUI (Calculá tu compra)
========================================================= */
window.ChanguiBridge = {
  getDolar: () => currentDolarBlue,

  getPdfTheme: () => getPdfThemeColors(),

  // Ahora también actualiza descripción, categoría y fecha (antes solo monto y detalle)
  updateExpense: async ({ month, id, amount, detalle, description, category, date }) => {
    const m = data.months[month];
    const exp = m && (m.expenses || []).find(x => x.id === id);
    if (!exp) return false;
    if (amount !== undefined) exp.amount = Number(amount);
    if (detalle) exp.detalle = detalle;
    if (description !== undefined) exp.description = description;
    if (category !== undefined) exp.category = category;
    if (date !== undefined) exp.date = date;
    renderMensuales();
    await saveMonthToFirestore(month);
    return true;
  },

  // Borra uno o varios gastos del mes (lo usa Changui para unir el envío con su compra
  // y para reemplazar una compra abierta desde el Historial)
  removeExpenses: async ({ month, ids }) => {
    const m = data.months[month];
    if (!m || !Array.isArray(m.expenses) || !Array.isArray(ids) || !ids.length) return false;
    const borrar = new Set(ids);
    m.expenses = m.expenses.filter(x => !borrar.has(x.id));
    renderMensuales();
    await saveMonthToFirestore(month);
    return true;
  },

  getCurrentMonth: () => {
    return $("monthPicker")?.value || currentMonthValue();
  },

  getMonthExpenses: (mes) => {
    const monthData = data.months[mes];
    return monthData ? (monthData.expenses || []) : [];
  },

  // Ahora devuelve los ids de los gastos creados (un array es "verdadero", no rompe los if (!res))
  addExpenses: async ({ date, expenses }) => {
    if (!currentUser) return false;
    try {
      const monthKey = date.slice(0, 7);
      const monthData = ensureMonth(monthKey);

      if (!Array.isArray(monthData.expenses)) {
        monthData.expenses = [];
      }

      const ids = [];
      expenses.forEach(exp => {
        const id = createId("expense");
        ids.push(id);
        monthData.expenses.push({
          id,
          date: date,
          description: exp.description,
          category: exp.category,
          amount: Number(exp.amount),
          currency: exp.currency || "ARS",
          fromChangui: true,
          ...(exp.detalle ? { detalle: exp.detalle } : {})
        });
      });

      renderMensuales();
      await saveMonthToFirestore(monthKey);
      return ids;
    } catch (err) {
      console.error("Error al registrar gastos desde Changui:", err);
      return false;
    }
  }
};

// Botón global para refrescar la app
document.getElementById('globalRefreshBtn')?.addEventListener('click', () => {
  window.location.reload();
});

// ... Sobre mi :

const aboutBtn = document.getElementById("aboutBtn");
const aboutDialog = document.getElementById("aboutDialog");
const closeAboutBtn = document.getElementById("closeAboutBtn");

if (aboutBtn && aboutDialog) {
  aboutBtn.onclick = () => aboutDialog.showModal();
}

if (closeAboutBtn && aboutDialog) {
  closeAboutBtn.onclick = () => aboutDialog.close();
}
