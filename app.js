/* ==========================================
   MENSUALES
   CONTROL DE GASTOS
========================================== */


const STORAGE_KEY =
  "mensuales_data_v1";


const $ = (id) =>
  document.getElementById(id);



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
   NOMBRE DEL MES
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



/* ==========================================
   MES ANTERIOR
========================================== */

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



/* ==========================================
   DATOS
========================================== */

function loadData() {

  try {

    return JSON.parse(
      localStorage.getItem(
        STORAGE_KEY
      )
    ) || {
      months: {}
    };

  } catch {

    return {
      months: {}
    };

  }

}


let data =
  loadData();



function ensureMonth(month) {

  if (!data.months[month]) {

    data.months[month] = {

      budget: 0,

      expenses: []

    };

  }


  return data.months[month];

}



function saveData() {

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

}



/* ==========================================
   RENDER
========================================== */

function render() {

  const month =
    $("monthPicker").value;


  const current =
    ensureMonth(month);


  const prevMonth =
    previousMonth(month);


  const previous =
    data.months[prevMonth]
    || {
      budget: 0,
      expenses: []
    };


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

    differenceElement
      .textContent =
      "—";


    $("differenceLabel")
      .textContent =
      "Sin datos comparables";


    differenceElement
      .className = "";

  } else {

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

  }


  $("budgetStatus")
    .textContent =
    current.budget

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


  $("budgetStatus")
    .className =
    total <= current.budget ||
    !current.budget

      ? ""

      : "result-bad";


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



  /* EDITAR */

  table
    .querySelectorAll(
      ".edit-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

            const month =
              $("monthPicker")
                .value;


            const expense =
              data
                .months[month]
                .expenses
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



  /* BORRAR */

  table
    .querySelectorAll(
      ".delete-btn"
    )
    .forEach(
      button => {

        button.addEventListener(
          "click",
          () => {

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


            data
              .months[month]
              .expenses =
              data
                .months[month]
                .expenses
                .filter(
                  expense =>
                    expense.id !==
                    button.dataset.id
                );


            saveData();


            render();

          }
        );

      }
    );

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

    table.innerHTML = `

      <tr>

        <td colspan="4">
          Todavía no hay historial.
        </td>

      </tr>

    `;

    return;

  }


  months.forEach(
    month => {

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

    $("trendText")
      .textContent =
      "Agregá gastos para comenzar a analizar tus hábitos.";

    return;

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

  }



  if (top) {

    text +=
      ` La categoría con mayor gasto fue ${
        top[0]
      } (${
        money(top[1])
      }).`;

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
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#039;"
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
    () => {

      const month =
        $("monthPicker")
          .value;


      ensureMonth(month)
        .budget =
        Number(
          $("budgetInput")
            .value || 0
        );


      saveData();


      render();

    }
  );



/* ==========================================
   NUEVO GASTO
========================================== */

$("addExpenseBtn")
  .addEventListener(
    "click",
    () => {

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
  );



/* ==========================================
   CERRAR MODAL
========================================== */

$("closeDialog")
  .addEventListener(
    "click",
    () => {

      resetExpenseModal();

      $("expenseDialog")
        .close();

    }
  );


$("cancelDialog")
  .addEventListener(
    "click",
    () => {

      resetExpenseModal();

      $("expenseDialog")
        .close();

    }
  );



/* ==========================================
   GUARDAR / EDITAR
========================================== */

$("expenseForm")
  .addEventListener(
    "submit",
    event => {

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

        const expense =
          data
            .months[month]
            .expenses
            .find(
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


        saveData();


        resetExpenseModal();


        $("expenseDialog")
          .close();


        render();


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


      saveData();


      resetExpenseModal();


      $("expenseDialog")
        .close();


      render();

    }
  );



/* ==========================================
   BORRAR MES
========================================== */

$("clearMonthBtn")
  .addEventListener(
    "click",
    () => {

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


      delete data.months[month];


      saveData();


      ensureMonth(month);


      render();

    }
  );



/* ==========================================
   EMPEZAR DE CERO
========================================== */

$("newUserBtn")
  .addEventListener(
    "click",
    () => {

      const confirmed =
        confirm(

          "✨ EMPEZAR DE CERO\n\n" +

          "Esta opción va a borrar TODOS los datos de MENSUALES de este navegador:\n\n" +

          "• Todos los gastos\n" +
          "• Todos los meses\n" +
          "• Todos los presupuestos\n" +
          "• Todo el historial\n\n" +

          "La aplicación quedará completamente limpia para un nuevo usuario.\n\n" +

          "¿Querés continuar?"

        );


      if (!confirmed) {
        return;
      }


      const secondConfirmation =
        confirm(

          "⚠️ ÚLTIMA CONFIRMACIÓN\n\n" +

          "Se eliminarán TODOS los datos guardados en MENSUALES.\n\n" +

          "Esta acción no se puede deshacer.\n\n" +

          "¿Estás segura de que querés empezar de cero?"

        );


      if (!secondConfirmation) {
        return;
      }


      /* Borrar almacenamiento */

      localStorage.removeItem(
        STORAGE_KEY
      );


      /* Crear nueva base */

      data = {
        months: {}
      };


      /* Obtener mes actual */

      const today =
        new Date();


      const currentMonth =
        `${today.getFullYear()}-${
          String(
            today.getMonth() + 1
          ).padStart(
            2,
            "0"
          )
        }`;


      $("monthPicker")
        .value =
        currentMonth;


      /* Crear mes vacío */

      ensureMonth(
        currentMonth
      );


      saveData();


      /* Actualizar pantalla */

      render();


      alert(
        "✨ ¡Listo! MENSUALES está completamente limpio.\n\nYa podés comenzar un nuevo registro."
      );

    }
  );



/* ==========================================
   PDF
========================================== */

$("pdfBtn")
  .addEventListener(
    "click",
    () => {

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
  );



/* ==========================================
   INICIO
========================================== */

(function init() {

  const today =
    new Date();


  const month =
    `${today.getFullYear()}-${
      String(
        today.getMonth() + 1
      ).padStart(
        2,
        "0"
      )
    }`;


  $("monthPicker")
    .value =
    month;


  ensureMonth(
    month
  );


  saveData();


  render();

})();
