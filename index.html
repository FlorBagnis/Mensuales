<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">

  <title>MENSUALES · Control de gastos</title>

  <link rel="stylesheet" href="styles.css">

  <script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>
</head>

<body>

<main class="app">

  <!-- LOGIN -->

  <section id="authSection" class="auth-section">

    <div class="auth-card">

      <div class="auth-logo">♡</div>

      <p class="eyebrow">MENSUALES</p>

      <h1>Controlá tus gastos</h1>

      <p class="auth-subtitle">
        Ingresá a tu cuenta para guardar y sincronizar tus gastos.
      </p>

      <form id="authForm">

        <label>
          Email
          <input
            id="authEmail"
            type="email"
            placeholder="tu@email.com"
            autocomplete="email"
            required
          >
        </label>

        <label>
          Contraseña
          <input
            id="authPassword"
            type="password"
            placeholder="••••••••"
            autocomplete="current-password"
            minlength="6"
            required
          >
        </label>

        <button
          id="authSubmitBtn"
          type="submit"
          class="btn btn-pink auth-submit"
        >
          Iniciar sesión
        </button>

      </form>

      <p id="authMessage" class="auth-message"></p>

      <button
        id="authSwitchBtn"
        type="button"
        class="auth-switch"
      >
        ¿No tenés una cuenta? Registrate
      </button>

    </div>

  </section>


  <!-- APLICACIÓN -->

  <section id="appContent" class="hidden">

    <header class="hero">

      <div>

        <p class="eyebrow">MENSUALES</p>

        <h1>Controlá tus gastos</h1>

        <p class="subtitle">
          Organizá tus gastos y llevá el control de tu presupuesto.
        </p>

      </div>

      <div class="header-actions">

        <span id="userEmail" class="user-email"></span>

        <button
          id="logoutBtn"
          class="btn btn-dark"
          type="button"
        >
          Cerrar sesión
        </button>

      </div>

    </header>


    <!-- TOOLBAR -->

    <section class="toolbar">

      <div class="field">

        <label for="monthPicker">MES</label>

        <input
          id="monthPicker"
          type="month"
        >

      </div>


      <div class="field">

        <label for="budgetInput">PRESUPUESTO</label>

        <div class="money-input">

          <span>$</span>

          <input
            id="budgetInput"
            type="number"
            min="0"
            step="0.01"
            placeholder="0"
          >

        </div>

      </div>


      <button
        id="saveBudgetBtn"
        class="btn btn-pink"
        type="button"
      >
        Guardar presupuesto
      </button>


      <button
        id="addExpenseBtn"
        class="btn btn-dark"
        type="button"
      >
        + Nuevo gasto
      </button>


      <button
        id="pdfBtn"
        class="btn btn-outline"
        type="button"
      >
        📄 PDF
      </button>


      <button
        id="clearMonthBtn"
        class="btn btn-danger"
        type="button"
      >
        Borrar mes
      </button>


      <button
        id="newUserBtn"
        class="btn btn-outline"
        type="button"
      >
        ✨ Empezar de cero
      </button>

    </section>


    <!-- RESUMEN -->

    <section class="summary-grid">

      <article class="summary-card">

        <span>TOTAL GASTADO</span>

        <strong id="totalSpent">$0,00</strong>

        <small id="expenseCount">
          0 gastos registrados
        </small>

      </article>


      <article class="summary-card">

        <span>MES ANTERIOR</span>

        <strong id="previousSpent">$0,00</strong>

        <small id="previousMonthLabel">—</small>

      </article>


      <article class="summary-card">

        <span>DIFERENCIA</span>

        <strong id="difference">—</strong>

        <small id="differenceLabel">
          Sin datos comparables
        </small>

      </article>


      <article class="summary-card">

        <span>PRESUPUESTO</span>

        <strong id="budgetTotal">$0,00</strong>

        <small id="budgetStatus">
          Sin presupuesto
        </small>

      </article>

    </section>


    <!-- GASTOS -->

    <section class="panel">

      <div class="section-heading">

        <div>

          <h2>Gastos del mes</h2>

          <p>
            Todos tus gastos registrados en este período.
          </p>

        </div>

        <span id="monthPill" class="month-pill">—</span>

      </div>


      <div id="emptyState" class="empty-state">

        <div>♡</div>

        <strong>Todavía no hay gastos</strong>

        <span>
          Agregá tu primer gasto del mes.
        </span>

      </div>


      <div class="table-wrap">

        <table>

          <thead>

            <tr>

              <th>Fecha</th>
              <th>Descripción</th>
              <th>Categoría</th>
              <th>Monto</th>
              <th>Acciones</th>

            </tr>

          </thead>

          <tbody id="expenseTable"></tbody>

        </table>

      </div>


      <div class="table-total">

        <span>
          TOTAL ·
          <span id="totalMonthName">—</span>
        </span>

        <strong id="tableTotal">$0,00</strong>

      </div>

    </section>


    <!-- DOS COLUMNAS -->

    <section class="two-columns">

      <section class="panel">

        <div class="section-heading">

          <div>

            <h2>Historial</h2>

            <p>
              Resumen de tus últimos meses.
            </p>

          </div>

        </div>


        <div class="table-wrap">

          <table>

            <thead>

              <tr>

                <th>Mes</th>
                <th>Presupuesto</th>
                <th>Gastado</th>
                <th>Resultado</th>

              </tr>

            </thead>

            <tbody id="historyTable"></tbody>

          </table>

        </div>

      </section>


      <section class="panel">

        <div class="section-heading">

          <div>

            <h2>Gastos por categoría</h2>

            <p>
              Distribución de tus gastos.
            </p>

          </div>

        </div>


        <div
          id="categoryChart"
          class="category-chart"
        ></div>

      </section>

    </section>


    <!-- TENDENCIA -->

    <section class="trend-box">

      <h2>📊 Análisis de tendencia</h2>

      <p id="trendText">
        Agregá gastos para comenzar a analizar tus hábitos.
      </p>

    </section>


    <footer>
      MENSUALES · Tus gastos, organizados.
    </footer>

  </section>

</main>


<!-- MODAL GASTO -->

<dialog id="expenseDialog">

  <form id="expenseForm" class="modal">

    <button
      id="closeDialog"
      type="button"
      class="close"
      aria-label="Cerrar"
    >
      ×
    </button>


    <div>

      <p id="modalEyebrow" class="eyebrow">
        NUEVO REGISTRO
      </p>

      <h2 id="modalTitle">
        Agregar gasto
      </h2>

    </div>


    <label>

      Fecha

      <input
        id="expenseDate"
        type="date"
        required
      >

    </label>


    <label>

      Descripción

      <input
        id="expenseDescription"
        type="text"
        placeholder="Ej. Supermercado"
        maxlength="100"
        required
      >

    </label>


    <label>

      Categoría

      <select
        id="expenseCategory"
        required
      >

        <option value="">
          Seleccioná una categoría
        </option>

        <option value="Alimentos">Alimentos</option>
        <option value="Transporte">Transporte</option>
        <option value="Hogar">Hogar</option>
        <option value="Servicios">Servicios</option>
        <option value="Salud">Salud</option>
        <option value="Ropa">Ropa</option>
        <option value="Entretenimiento">Entretenimiento</option>
        <option value="Educación">Educación</option>
        <option value="Mascotas">Mascotas</option>
        <option value="Otros">Otros</option>

      </select>

    </label>


    <label>

      Monto

      <input
        id="expenseAmount"
        type="number"
        min="0.01"
        step="0.01"
        placeholder="0"
        required
      >

    </label>


    <!-- RECURRENCIA -->

    <div class="recurring-box">

      <label class="checkbox-label">

        <input
          id="expenseRecurring"
          type="checkbox"
        >

        <span>
          🔁 Repetir este gasto
        </span>

      </label>


      <div
        id="recurringOptions"
        class="recurring-options hidden"
      >

        <div class="recurring-grid">

          <label>

            Repetir cada

            <div class="inline-input">

              <input
                id="recurringMonths"
                type="number"
                min="1"
                max="60"
                value="1"
              >

              <span>mes(es)</span>

            </div>

          </label>


          <label>

            Día del mes

            <input
              id="recurringDay"
              type="number"
              min="1"
              max="31"
              value="10"
            >

          </label>


          <label>

            Durante

            <div class="inline-input">

              <input
                id="recurringDuration"
                type="number"
                min="1"
                max="60"
                value="6"
              >

              <span>mes(es)</span>

            </div>

          </label>

        </div>


        <p class="recurring-help">
          El gasto se cargará automáticamente en los meses siguientes.
          Si elegís el día 31 y un mes no tiene 31, se utilizará el último
          día disponible de ese mes.
        </p>

      </div>

    </div>


    <div class="modal-actions">

      <button
        id="cancelDialog"
        type="button"
        class="btn btn-outline"
      >
        Cancelar
      </button>


      <button
        id="submitExpenseBtn"
        type="submit"
        class="btn btn-pink"
      >
        Guardar gasto
      </button>

    </div>

  </form>

</dialog>


<script
  type="module"
  src="app.js"
></script>

</body>
</html>
