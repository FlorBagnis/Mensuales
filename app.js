/* ==========================================
MENSUALES
FIREBASE + FIRESTORE
========================================== */

/* ==========================================
FIREBASE
========================================== */

import {
initializeApp
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";

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
getDocs,
setDoc,
deleteDoc,
writeBatch,
onSnapshot
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

const firebaseConfig = {

apiKey:
"AIzaSyBGGfMzmGfRH614IT5wwG2kZOtUDBd16ok",

authDomain:
"mensuales-8de3d.firebaseapp.com",

projectId:
"mensuales-8de3d",

storageBucket:
"mensuales-8de3d.firebasestorage.app",

messagingSenderId:
"248967622199",

appId:
"1:248967622199:web:86e53f1b115e974bb8d9b2"

};

const firebaseApp =
initializeApp(
firebaseConfig
);

const auth =
getAuth(
firebaseApp
);

const db =
getFirestore(
firebaseApp
);

/* ==========================================
CONSTANTES
========================================== */

const STORAGE_KEY =
"mensuales_data_v1";

const $ =
id =>
document.getElementById(id);

let data = {
months: {}
};

let currentUser =
null;

let unsubscribeMonths =
null;

let authMode =
"login";

let appReady =
false;

/* ==========================================
DINERO
========================================== */

function money(value) {

return new Intl.NumberFormat(
"es-AR",
{
style: "currency",
currency: "ARS",
minimumFractionDigits: 2
}
).format(
Number(value || 0)
);

}

/* ==========================================
MESES
========================================== */

function monthName(month) {

const [
year,
monthNumber
] =
month
.split("-")
.map(Number);

return new Intl.DateTimeFormat(
"es-AR",
{
month: "long",
year: "numeric"
}
)
.format(
new Date(
year,
monthNumber - 1,
1
)
)
.replace(
/^./,
character =>
character.toUpperCase()
);

}

function shortMonthName(month) {

const [
year,
monthNumber
] =
month
.split("-")
.map(Number);

return new Intl.DateTimeFormat(
"es-AR",
{
month: "long"
}
)
.format(
new Date(
year,
monthNumber - 1,
1
)
)
.replace(
/^./,
character =>
character.toUpperCase()
);

}

function previousMonth(month) {

const [
year,
monthNumber
] =
month
.split("-")
.map(Number);

const date =
new Date(
year,
monthNumber - 2,
1
);

return `${date.getFullYear()}-${
    String(
      date.getMonth() + 1
    ).padStart(
      2,
      "0"
    )
  }`;

}

function currentMonthValue() {

const today =
new Date();

return `${today.getFullYear()}-${
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    )
  }`;

}

/* ==========================================
DATOS
========================================== */

function emptyMonth() {

return {

```
budget: 0,

expenses: []
```

};

}

function ensureMonth(month) {

if (!data.months[month]) {

```
data.months[month] =
  emptyMonth();
```

}

return data.months[month];

}

/* ==========================================
FIRESTORE
========================================== */

function monthsCollectionRef() {

if (!currentUser) {
return null;
}

return collection(
db,
"users",
currentUser.uid,
"months"
);

}

function monthDocumentRef(month) {

if (!currentUser) {
return null;
}

return doc(
db,
"users",
currentUser.uid,
"months",
month
);

}

async function saveMonthToFirestore(
month
) {

if (!currentUser) {
return;
}

const monthData =
ensureMonth(month);

await setDoc(
monthDocumentRef(month),
{
budget:
Number(
monthData.budget || 0
),

```
  expenses:
    monthData.expenses || []
}
```

);

}

async function deleteMonthFromFirestore(
month
) {

if (!currentUser) {
return;
}

await deleteDoc(
monthDocumentRef(month)
);

}

async function loadMonthsFromFirestore() {

if (!currentUser) {
return;
}

const snapshot =
await getDocs(
monthsCollectionRef()
);

const months = {};

snapshot.forEach(
documentSnapshot => {

```
  const value =
    documentSnapshot.data();


  months[
    documentSnapshot.id
  ] = {

    budget:
      Number(
        value.budget || 0
      ),

    expenses:
      Array.isArray(
        value.expenses
      )
        ? value.expenses
        : []

  };

}
```

);

data = {
months
};

}

/* ==========================================
MIGRACIÓN DEL LOCALSTORAGE
========================================== */

function loadOldLocalData() {

try {

```
const raw =
  localStorage.getItem(
    STORAGE_KEY
  );


if (!raw) {
  return null;
}


const parsed =
  JSON.parse(raw);


if (
  !parsed ||
  !parsed.months
) {

  return null;

}


return parsed;
```

} catch {

```
return null;
```

}

}

async function migrateLocalDataIfNecessary() {

if (!currentUser) {
return;
}

const oldData =
loadOldLocalData();

if (
!oldData ||
!Object.keys(
oldData.months || {}
).length
) {

```
return;
```

}

const existing =
await getDocs(
monthsCollectionRef()
);

/*
Si Firestore ya tiene datos,
no mezclamos automáticamente.
*/

if (!existing.empty) {

```
localStorage.removeItem(
  STORAGE_KEY
);

return;
```

}

const months =
Object.entries(
oldData.months
);

for (
const [
month,
monthData
]
of months
) {

```
await setDoc(
  monthDocumentRef(month),
  {

    budget:
      Number(
        monthData.budget || 0
      ),

    expenses:
      Array.isArray(
        monthData.expenses
      )
        ? monthData.expenses
        : []

  }
);
```

}

localStorage.removeItem(
STORAGE_KEY
);

}

/* ==========================================
SINCRONIZACIÓN EN TIEMPO REAL
========================================== */

function startRealtimeSync() {

stopRealtimeSync();

if (!currentUser) {
return;
}

unsubscribeMonths =
onSnapshot(

```
  monthsCollectionRef(),

  snapshot => {

    const months = {};


    snapshot.forEach(
      documentSnapshot => {

        const value =
          documentSnapshot.data();


        months[
          documentSnapshot.id
        ] = {

          budget:
            Number(
              value.budget || 0
            ),

          expenses:
            Array.isArray(
              value.expenses
            )
              ? value.expenses
              : []

        };

      }
    );


    data = {
      months
    };


    if (!appReady) {

      ensureMonth(
        $("monthPicker").value
      );

      appReady = true;

    }


    render();

  },

  error => {

    console.error(
      "Error sincronizando Firestore:",
      error
    );


    alert(
      "No se pudieron sincronizar los datos con Firebase. Revisá las reglas de Firestore."
    );

  }

);
```

}

function stopRealtimeSync() {

if (
typeof unsubscribeMonths ===
"function"
) {

```
unsubscribeMonths();

unsubscribeMonths =
  null;
```

}

}

/* ==========================================
AUTENTICACIÓN
========================================== */

function setAuthMessage(
message,
success = false
) {

$("authMessage")
.textContent =
message;

$("authMessage")
.classList.toggle(
"success",
success
);

}

function updateAuthInterface() {

const isLogin =
authMode ===
"login";

$("authSubmitBtn")
.textContent =
isLogin
? "Iniciar sesión"
: "Crear cuenta";

$("authSwitchBtn")
.textContent =
isLogin
? "¿No tenés una cuenta? Registrate"
: "¿Ya tenés una cuenta? Iniciá sesión";

$("authPassword")
.autocomplete =
isLogin
? "current-password"
: "new-password";

setAuthMessage(
""
);

}

function firebaseErrorMessage(
error
) {

const code =
error?.code || "";

const messages = {

```
"auth/invalid-email":
  "El email no es válido.",

"auth/missing-password":
  "Ingresá una contraseña.",

"auth/weak-password":
  "La contraseña debe tener al menos 6 caracteres.",

"auth/email-already-in-use":
  "Ya existe una cuenta con ese email.",

"auth/invalid-credential":
  "El email o la contraseña son incorrectos.",

"auth/user-not-found":
  "No existe una cuenta con ese email.",

"auth/wrong-password":
  "La contraseña es incorrecta.",

"auth/too-many-requests":
  "Hubo demasiados intentos. Esperá un momento y volvé a intentar.",

"auth/network-request-failed":
  "No hay conexión con Firebase. Revisá tu conexión a Internet."
```

};

return (
messages[code] ||
"Ocurrió un error. Volvé a intentar."
);

}

$("authSwitchBtn")
.addEventListener(
"click",
() => {

```
  authMode =
    authMode === "login"
      ? "register"
      : "login";


  updateAuthInterface();

}
```

);

$("authForm")
.addEventListener(
"submit",
async event => {

```
  event.preventDefault();


  const email =
    $("authEmail")
      .value
      .trim();


  const password =
    $("authPassword")
      .value;


  if (
    !email ||
    !password
  ) {

    setAuthMessage(
      "Completá email y contraseña."
    );

    return;

  }


  const button =
    $("authSubmitBtn");


  button.disabled =
    true;


  button.textContent =
    authMode === "login"
      ? "Ingresando..."
      : "Creando cuenta...";


  try {

    if (
      authMode ===
      "register"
    ) {

      await createUserWithEmailAndPassword(
        auth,
        email,
        password
      );

    } else {

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      );

    }

  } catch (error) {

    console.error(
      error
    );


    setAuthMessage(
      firebaseErrorMessage(
        error
      )
    );


    button.disabled =
      false;


    updateAuthInterface();

  }

}
```

);

$("logoutBtn")
.addEventListener(
"click",
async () => {

```
  const confirmed =
    confirm(
      "¿Querés cerrar sesión?"
    );


  if (!confirmed) {
    return;
  }


  try {

    await signOut(
      auth
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      "No se pudo cerrar la sesión."
    );

  }

}
```

);

/* ==========================================
ESTADO DE AUTENTICACIÓN
========================================== */

onAuthStateChanged(
auth,
async user => {

```
currentUser =
  user;


if (!user) {

  stopRealtimeSync();


  data = {
    months: {}
  };


  appReady =
    false;


  $("authSection")
    .classList.remove(
      "hidden"
    );


  $("appContent")
    .classList.add(
      "hidden"
    );


  return;

}


$("authSection")
  .classList.add(
    "hidden"
  );


$("appContent")
  .classList.remove(
    "hidden"
  );


$("userEmail")
  .textContent =
  user.email || "";


try {

  /*
    Primero intentamos migrar
    los datos antiguos.
  */

  await migrateLocalDataIfNecessary();


  /*
    Después cargamos Firestore.
  */

  await loadMonthsFromFirestore();


  const month =
    currentMonthValue();


  $("monthPicker")
    .value =
    month;


  ensureMonth(
    month
  );


  startRealtimeSync();


} catch (error) {

  console.error(
    "Error inicializando MENSUALES:",
    error
  );


  alert(
    "No se pudieron cargar tus datos desde Firebase. Revisá las reglas de Firestore."
  );

}
```

}
);

/* ==========================================
RENDER
========================================== */

function render() {

if (!currentUser) {
return;
}

const month =
$("monthPicker").value;

if (!month) {
return;
}

const current =
ensureMonth(month);

const prevMonth =
previousMonth(month);

const previous =
data.months[prevMonth]
|| emptyMonth();

const total =
current.expenses.reduce(
(
sum,
expense
) =>
sum +
Number(
expense.amount
),
0
);

const previousTotal =
previous.expenses.reduce(
(
sum,
expense
) =>
sum +
Number(
expense.amount
),
0
);

const difference =
total -
previousTotal;

const percentage =
previousTotal
? Math.abs(
difference /
previousTotal *
100
)
: 0;

$("budgetInput").value =
current.budget || "";

$("totalSpent")
.textContent =
money(total);

$("previousSpent")
.textContent =
money(previousTotal);

$("budgetTotal")
.textContent =
money(current.budget);

$("currentMonthLabel")
.textContent =
monthName(month);

$("previousMonthLabel")
.textContent =
monthName(prevMonth);

$("monthPill")
.textContent =
monthName(month);

$("totalMonthName")
.textContent =
shortMonthName(month)
.toUpperCase();

$("tableTotal")
.textContent =
money(total);

$("expenseCount")
.textContent =
`${current.expenses.length} ${
      current.expenses.length === 1
        ? "gasto registrado"
        : "gastos registrados"
    }`;

const differenceElement =
$("difference");

if (
previousTotal === 0
) {

```
differenceElement
  .textContent =
  "—";


$("differenceLabel")
  .textContent =
  "Sin datos comparables";


differenceElement
  .className = "";
```

} else {

```
differenceElement
  .textContent =
  `${
    difference <= 0
      ? "- "
      : "+ "
  }${
    money(
      Math.abs(
        difference
      )
    )
  }`;


$("differenceLabel")
  .textContent =
  difference <= 0
    ? `↓ ${
        percentage.toFixed(1)
      }% menos`
    : `↑ ${
        percentage.toFixed(1)
      }% más`;


differenceElement
  .className =
  difference <= 0
    ? "result-good"
    : "result-bad";
```

}

$("budgetStatus")
.textContent =
current.budget

```
  ? total <= current.budget

    ? `${money(
        current.budget -
        total
      )} disponibles`

    : `${money(
        total -
        current.budget
      )} excedido`

  : "Sin presupuesto";
```

$("budgetStatus")
.className =
total <= current.budget ||
!current.budget

```
  ? ""

  : "result-bad";
```

renderExpenses(
current.expenses
);

renderHistory();

renderCategories(
current.expenses
);

renderTrend(
month,
total,
previousTotal
);

}

/* ==========================================
GASTOS
========================================== */

function renderExpenses(
expenses
) {

const table =
$("expenseTable");

table.innerHTML = "";

$("emptyState")
.style.display =
expenses.length
? "none"
: "grid";

expenses
.slice()
.sort(
(a, b) =>
a.date.localeCompare(
b.date
)
)
.forEach(
expense => {

```
    const row =
      document.createElement(
        "tr"
      );


    row.innerHTML = `

      <td>
        ${formatDate(
          expense.date
        )}
      </td>

      <td>
        ${escapeHtml(
          expense.description
        )}
      </td>

      <td>

        <span class="category">

          ${escapeHtml(
            expense.category
          )}

        </span>

      </td>

      <td class="amount">

        ${money(
          expense.amount
        )}

      </td>

      <td class="actions">

        <button
          class="edit-btn"
          title="Editar gasto"
          data-id="${
            expense.id
          }"
        >
          ✏️
        </button>

        <button
          class="delete-btn"
          title="Eliminar gasto"
          data-id="${
            expense.id
          }"
        >
          ×
        </button>

      </td>

    `;


    table.appendChild(
      row
    );

  }
);
```

table
.querySelectorAll(
".edit-btn"
)
.forEach(
button => {

```
    button.addEventListener(
      "click",
      () => {

        const month =
          $("monthPicker")
            .value;


        const expense =
          data
            .months[month]
            ?.expenses
            .find(
              item =>
                item.id ===
                button.dataset.id
            );


        if (!expense) {
          return;
        }


        $("expenseDate")
          .value =
          expense.date;


        $("expenseDescription")
          .value =
          expense.description;


        $("expenseCategory")
          .value =
          expense.category;


        $("expenseAmount")
          .value =
          expense.amount;


        $("expenseForm")
          .dataset
          .editingId =
          expense.id;


        $("modalEyebrow")
          .textContent =
          "EDITAR REGISTRO";


        $("modalTitle")
          .textContent =
          "Editar gasto";


        $("submitExpenseBtn")
          .textContent =
          "Guardar cambios";


        $("expenseDialog")
          .showModal();

      }
    );

  }
);
```

table
.querySelectorAll(
".delete-btn"
)
.forEach(
button => {

```
    button.addEventListener(
      "click",
      async () => {

        const confirmed =
          confirm(
            "¿Querés eliminar este gasto?"
          );


        if (!confirmed) {
          return;
        }


        const month =
          $("monthPicker")
            .value;


        const monthData =
          data.months[month];


        if (!monthData) {
          return;
        }


        monthData.expenses =
          monthData.expenses.filter(
            expense =>
              expense.id !==
              button.dataset.id
          );


        try {

          await saveMonthToFirestore(
            month
          );

        } catch (error) {

          console.error(
            error
          );


          alert(
            "No se pudo eliminar el gasto."
          );

        }

      }
    );

  }
);
```

}

/* ==========================================
HISTORIAL
========================================== */

function renderHistory() {

const table =
$("historyTable");

table.innerHTML = "";

const months =
Object.keys(
data.months
)
.sort()
.reverse()
.slice(
0,
6
);

if (!months.length) {

```
table.innerHTML = `

  <tr>

    <td colspan="4">
      Todavía no hay historial.
    </td>

  </tr>

`;

return;
```

}

months.forEach(
month => {

```
  const current =
    data.months[month];


  const total =
    current.expenses.reduce(
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount
        ),
      0
    );


  const result =
    Number(
      current.budget || 0
    ) -
    total;


  const row =
    document.createElement(
      "tr"
    );


  row.innerHTML = `

    <td>

      <b>
        ${monthName(
          month
        )}
      </b>

    </td>

    <td>
      ${money(
        current.budget
      )}
    </td>

    <td>
      ${money(
        total
      )}
    </td>

    <td class="${
      result >= 0
        ? "result-good"
        : "result-bad"
    }">

      ${
        result >= 0
          ? "+"
          : "-"
      }

      ${money(
        Math.abs(result)
      )}

      ${
        result >= 0
          ? "a favor"
          : "excedido"
      }

    </td>

  `;


  table.appendChild(
    row
  );

}
```

);

}

/* ==========================================
CATEGORÍAS
========================================== */

function renderCategories(
expenses
) {

const totals = {};

expenses.forEach(
expense => {

```
  totals[
    expense.category
  ] =
    (
      totals[
        expense.category
      ] || 0
    )
    +
    Number(
      expense.amount
    );

}
```

);

const entries =
Object.entries(
totals
)
.sort(
(a, b) =>
b[1] - a[1]
);

const max =
entries[0]?.[1] || 1;

$("categoryChart")
.innerHTML =

```
entries.length

  ? entries
      .map(
        (
          [
            category,
            total
          ]
        ) => `

          <div
            class="bar-row"
          >

            <div
              class="bar-label"
            >

              <span>

                ${escapeHtml(
                  category
                )}

              </span>

              <b>

                ${money(
                  total
                )}

              </b>

            </div>


            <div
              class="bar-bg"
            >

              <div
                class="bar-fill"
                style="
                  width:${
                    (
                      total /
                      max
                    ) *
                    100
                  }%
                "
              ></div>

            </div>

          </div>

        `
      )
      .join("")

  : `

      <div class="empty-state">

        <div>
          ♡
        </div>

        <span>
          No hay categorías para mostrar.
        </span>

      </div>

    `;
```

}

/* ==========================================
ANÁLISIS
========================================== */

function renderTrend(
month,
total,
previousTotal
) {

const current =
data.months[month];

const categories = {};

current.expenses.forEach(
expense => {

```
  categories[
    expense.category
  ] =
    (
      categories[
        expense.category
      ] || 0
    )
    +
    Number(
      expense.amount
    );

}
```

);

const top =
Object.entries(
categories
)
.sort(
(a, b) =>
b[1] - a[1]
)[0];

if (
!current.expenses.length
) {

```
$("trendText")
  .textContent =
  "Agregá gastos para comenzar a analizar tus hábitos.";

return;
```

}

let text =
`En ${
      monthName(month)
    }, registraste ${
      money(total)
    } en ${
      current.expenses.length
    } ${
      current.expenses.length === 1
        ? "gasto"
        : "gastos"
    }.`;

if (previousTotal) {

```
const percentage =
  (
    (
      total -
      previousTotal
    )
    /
    previousTotal
  )
  *
  100;


if (
  percentage <= 0
) {

  text +=
    ` Eso representa un ahorro del ${
      Math.abs(
        percentage
      ).toFixed(1)
    }% respecto del mes anterior.`;

} else {

  text +=
    ` Eso representa un aumento del ${
      percentage.toFixed(1)
    }% respecto del mes anterior.`;

}
```

}

if (top) {

```
text +=
  ` La categoría con mayor gasto fue ${
    top[0]
  } (${
    money(top[1])
  }).`;
```

}

$("trendText")
.textContent =
text;

}

/* ==========================================
UTILIDADES
========================================== */

function formatDate(
date
) {

const [
year,
month,
day
] =
date.split("-");

return `${
    day
  }/${
    month
  }/${
    year
  }`;

}

function escapeHtml(
value
) {

return String(value)
.replace(
/[&<>"']/g,
character =>
({
"&": "&",
"<": "<",
">": ">",
'"': """,
"'": "'"
}[
character
])
);

}

/* ==========================================
MODAL
========================================== */

function resetExpenseModal() {

$("expenseForm")
.reset();

delete $("expenseForm")
.dataset
.editingId;

$("modalEyebrow")
.textContent =
"NUEVO REGISTRO";

$("modalTitle")
.textContent =
"Agregar gasto";

$("submitExpenseBtn")
.textContent =
"Guardar gasto";

}

/* ==========================================
CAMBIO DE MES
========================================== */

$("monthPicker")
.addEventListener(
"change",
render
);

/* ==========================================
PRESUPUESTO
========================================== */

$("saveBudgetBtn")
.addEventListener(
"click",
async () => {

```
  const month =
    $("monthPicker")
      .value;


  const current =
    ensureMonth(month);


  current.budget =
    Number(
      $("budgetInput")
        .value || 0
    );


  try {

    await saveMonthToFirestore(
      month
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      "No se pudo guardar el presupuesto."
    );

  }

}
```

);

/* ==========================================
NUEVO GASTO
========================================== */

$("addExpenseBtn")
.addEventListener(
"click",
() => {

```
  resetExpenseModal();


  const month =
    $("monthPicker")
      .value;


  const today =
    new Date();


  const year =
    today.getFullYear();


  const currentMonth =
    String(
      today.getMonth() + 1
    ).padStart(
      2,
      "0"
    );


  const currentDay =
    String(
      today.getDate()
    ).padStart(
      2,
      "0"
    );


  if (
    month ===
    `${year}-${currentMonth}`
  ) {

    $("expenseDate")
      .value =
      `${year}-${
        currentMonth
      }-${
        currentDay
      }`;

  } else {

    $("expenseDate")
      .value =
      `${month}-01`;

  }


  $("expenseDialog")
    .showModal();

}
```

);

/* ==========================================
CERRAR MODAL
========================================== */

$("closeDialog")
.addEventListener(
"click",
() => {

```
  resetExpenseModal();

  $("expenseDialog")
    .close();

}
```

);

$("cancelDialog")
.addEventListener(
"click",
() => {

```
  resetExpenseModal();

  $("expenseDialog")
    .close();

}
```

);

/* ==========================================
GUARDAR / EDITAR
========================================== */

$("expenseForm")
.addEventListener(
"submit",
async event => {

```
  event.preventDefault();


  const month =
    $("monthPicker")
      .value;


  const editingId =
    $("expenseForm")
      .dataset
      .editingId;



  /* EDITAR */

  if (editingId) {

    const monthData =
      ensureMonth(month);


    const expense =
      monthData.expenses.find(
        item =>
          item.id ===
          editingId
      );


    if (!expense) {
      return;
    }


    expense.date =
      $("expenseDate")
        .value;


    expense.description =
      $("expenseDescription")
        .value
        .trim();


    expense.category =
      $("expenseCategory")
        .value;


    expense.amount =
      Number(
        $("expenseAmount")
          .value
      );


    if (
      !expense.date ||
      !expense.description ||
      !expense.amount ||
      expense.amount <= 0
    ) {

      alert(
        "Completá todos los campos correctamente."
      );

      return;

    }


    try {

      await saveMonthToFirestore(
        month
      );


      resetExpenseModal();


      $("expenseDialog")
        .close();

    } catch (error) {

      console.error(
        error
      );


      alert(
        "No se pudieron guardar los cambios."
      );

    }


    return;

  }



  /* NUEVO */

  const expense = {

    id:
      crypto.randomUUID
        ? crypto.randomUUID()
        : String(
            Date.now()
          ),

    date:
      $("expenseDate")
        .value,

    description:
      $("expenseDescription")
        .value
        .trim(),

    category:
      $("expenseCategory")
        .value,

    amount:
      Number(
        $("expenseAmount")
          .value
      )

  };


  if (
    !expense.date ||
    !expense.description ||
    !expense.amount ||
    expense.amount <= 0
  ) {

    alert(
      "Completá todos los campos correctamente."
    );

    return;

  }


  ensureMonth(month)
    .expenses
    .push(
      expense
    );


  try {

    await saveMonthToFirestore(
      month
    );


    resetExpenseModal();


    $("expenseDialog")
      .close();

  } catch (error) {

    console.error(
      error
    );


    /*
      Si Firestore falla,
      revertimos el gasto local.
    */

    ensureMonth(month)
      .expenses =
      ensureMonth(month)
        .expenses
        .filter(
          item =>
            item.id !==
            expense.id
        );


    alert(
      "No se pudo guardar el gasto en Firebase."
    );

  }

}
```

);

/* ==========================================
BORRAR MES
========================================== */

$("clearMonthBtn")
.addEventListener(
"click",
async () => {

```
  const month =
    $("monthPicker")
      .value;


  const monthData =
    data.months[month];


  const hasData =
    monthData &&
    (
      monthData.expenses.length > 0
      ||
      Number(
        monthData.budget
      ) > 0
    );


  if (!hasData) {

    alert(
      `No hay datos guardados en ${
        monthName(month)
      }.`
    );

    return;

  }


  const confirmed =
    confirm(

      `¿Seguro que querés borrar TODO el registro de ${
        monthName(month)
      }?\n\n` +

      `Se eliminarán los gastos y el presupuesto de ese mes.\n\n` +

      `Esta acción no se puede deshacer.`

    );


  if (!confirmed) {
    return;
  }


  try {

    await deleteMonthFromFirestore(
      month
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      "No se pudo borrar el mes."
    );

    return;

  }


  delete data.months[month];


  render();

}
```

);

/* ==========================================
EMPEZAR DE CERO
========================================== */

$("newUserBtn")
.addEventListener(
"click",
async () => {

```
  const confirmed =
    confirm(

      "✨ EMPEZAR DE CERO\n\n" +

      "Esta opción va a borrar TODOS tus datos de MENSUALES de tu cuenta:\n\n" +

      "• Todos los gastos\n" +
      "• Todos los meses\n" +
      "• Todos los presupuestos\n" +
      "• Todo el historial\n\n" +

      "Tu cuenta seguirá existiendo.\n\n" +

      "¿Querés continuar?"

    );


  if (!confirmed) {
    return;
  }


  const secondConfirmation =
    confirm(

      "⚠️ ÚLTIMA CONFIRMACIÓN\n\n" +

      "Se eliminarán TODOS los datos de MENSUALES de esta cuenta.\n\n" +

      "La cuenta de acceso NO se eliminará.\n\n" +

      "Esta acción no se puede deshacer.\n\n" +

      "¿Estás segura de que querés empezar de cero?"

    );


  if (!secondConfirmation) {
    return;
  }


  try {

    const snapshot =
      await getDocs(
        monthsCollectionRef()
      );


    const batch =
      writeBatch(
        db
      );


    snapshot.forEach(
      documentSnapshot => {

        batch.delete(
          documentSnapshot.ref
        );

      }
    );


    await batch.commit();


    data = {
      months: {}
    };


    const month =
      currentMonthValue();


    $("monthPicker")
      .value =
      month;


    ensureMonth(
      month
    );


    render();


    alert(
      "✨ ¡Listo! MENSUALES está completamente limpio.\n\nTu cuenta sigue activa y ya podés comenzar un nuevo registro."
    );

  } catch (error) {

    console.error(
      error
    );


    alert(
      "No se pudieron borrar todos los datos. Volvé a intentar."
    );

  }

}
```

);

/* ==========================================
PDF
========================================== */

$("pdfBtn")
.addEventListener(
"click",
() => {

```
  if (
    !window.jspdf
  ) {

    alert(
      "No se pudo cargar el generador de PDF."
    );

    return;

  }


  const {
    jsPDF
  } =
    window.jspdf;


  const month =
    $("monthPicker")
      .value;


  const current =
    ensureMonth(month);


  const total =
    current.expenses.reduce(
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount
        ),
      0
    );


  const previous =
    data.months[
      previousMonth(month)
    ]
    || {
      expenses: []
    };


  const previousTotal =
    previous.expenses.reduce(
      (
        sum,
        expense
      ) =>
        sum +
        Number(
          expense.amount
        ),
      0
    );


  const difference =
    total -
    previousTotal;


  const doc =
    new jsPDF({
      unit: "mm",
      format: "a4"
    });


  const pink =
    [
      245,
      107,
      139
    ];


  const dark =
    [
      85,
      21,
      45
    ];


  const light =
    [
      255,
      231,
      236
    ];



  /* CABECERA */

  doc.setFillColor(
    255,
    176,
    194
  );


  doc.roundedRect(
    15,
    15,
    180,
    28,
    4,
    4,
    "F"
  );


  doc.setTextColor(
    ...dark
  );


  doc.setFontSize(
    17
  );


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.text(
    "CONTROL DE GASTOS MENSUALES",
    21,
    27
  );


  doc.setFontSize(
    8
  );


  doc.setFont(
    "helvetica",
    "normal"
  );


  doc.text(
    `Reporte · ${
      monthName(month)
    }`,
    21,
    34
  );



  /* TARJETAS */

  const cards = [

    [
      "TOTAL GASTADO",
      money(total)
    ],

    [
      "MES ANTERIOR",
      money(previousTotal)
    ],

    [
      "DIFERENCIA",
      `${
        difference <= 0
          ? "- "
          : "+ "
      }${
        money(
          Math.abs(
            difference
          )
        )
      }`
    ]

  ];


  cards.forEach(
    (
      card,
      index
    ) => {

      const x =
        15 +
        index *
        60;


      doc.setDrawColor(
        255,
        197,
        210
      );


      doc.roundedRect(
        x,
        49,
        56,
        25,
        3,
        3,
        "S"
      );


      doc.setTextColor(
        ...pink
      );


      doc.setFontSize(
        7
      );


      doc.setFont(
        "helvetica",
        "bold"
      );


      doc.text(
        card[0],
        x + 4,
        57
      );


      doc.setTextColor(
        ...dark
      );


      doc.setFontSize(
        12
      );


      doc.text(
        card[1],
        x + 4,
        66
      );

    }
  );



  /* TABLA */

  let y = 84;


  doc.setFillColor(
    ...pink
  );


  doc.rect(
    15,
    y,
    180,
    8,
    "F"
  );


  doc.setTextColor(
    255,
    255,
    255
  );


  doc.setFontSize(
    7
  );


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.text(
    "FECHA",
    18,
    y + 5
  );


  doc.text(
    "CONCEPTO / DESCRIPCIÓN",
    45,
    y + 5
  );


  doc.text(
    "CATEGORÍA",
    125,
    y + 5
  );


  doc.text(
    "MONTO ($)",
    168,
    y + 5
  );


  y += 8;


  doc.setFont(
    "helvetica",
    "normal"
  );


  current.expenses
    .slice()
    .sort(
      (a, b) =>
        a.date.localeCompare(
          b.date
        )
    )
    .forEach(
      expense => {

        if (
          y > 275
        ) {

          doc.addPage();

          y = 20;

        }


        doc.setTextColor(
          ...dark
        );


        doc.setFontSize(
          7
        );


        doc.text(
          formatDate(
            expense.date
          ),
          18,
          y + 5
        );


        doc.text(
          String(
            expense.description
          ).slice(
            0,
            35
          ),
          45,
          y + 5
        );


        doc.text(
          String(
            expense.category
          ).slice(
            0,
            18
          ),
          125,
          y + 5
        );


        doc.text(
          money(
            expense.amount
          ),
          168,
          y + 5
        );


        doc.setDrawColor(
          245,
          220,
          227
        );


        doc.line(
          15,
          y + 8,
          195,
          y + 8
        );


        y += 10;

      }
    );



  /* TOTAL */

  doc.setFillColor(
    ...light
  );


  doc.rect(
    15,
    y,
    180,
    10,
    "F"
  );


  doc.setTextColor(
    ...dark
  );


  doc.setFont(
    "helvetica",
    "bold"
  );


  doc.text(
    `TOTAL GASTADO EN ${
      shortMonthName(
        month
      ).toUpperCase()
    }`,
    18,
    y + 6
  );


  doc.text(
    money(total),
    168,
    y + 6
  );


  y += 20;



  /* ANÁLISIS */

  doc.setFontSize(
    10
  );


  doc.text(
    "Análisis de tendencia",
    15,
    y
  );


  doc.setFont(
    "helvetica",
    "normal"
  );


  doc.setFontSize(
    8
  );


  const trend =
    $("trendText")
      .textContent;


  const lines =
    doc.splitTextToSize(
      trend,
      175
    );


  doc.text(
    lines,
    15,
    y + 7
  );



  /* PIE */

  doc.setFontSize(
    7
  );


  doc.setTextColor(
    160,
    110,
    125
  );


  doc.text(
    "MENSUALES · Reporte generado automáticamente",
    15,
    287
  );


  doc.save(
    `MENSUALES-${month}.pdf`
  );

}
```

);

/* ==========================================
INICIO
========================================== */

(function init() {

$("monthPicker")
.value =
currentMonthValue();

updateAuthInterface();

})();
