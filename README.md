# 💗 MENSUALES & Gastos Próximos · Control de Gastos

<p align="center">
  <img width="1528" height="877" alt="image" src="https://github.com/user-attachments/assets/2a8f7688-da56-4acf-ab05-3417c841c709" />
</p>

> **MENSUALES** es una Progressive Web App (PWA) bimonetaria diseñada para registrar, organizar y proyectar finanzas personales mes a mes con sincronización en la nube en tiempo real e integración directa con **[Gastos Próximos](https://gastos-proximos.vercel.app/)**.

---

## ✨ Características Principales

* 💰 **Control Presupuestario Mensual:** Registro de presupuesto base, control de dinero disponible, cálculo de excesos en tiempo real y comparativa porcentual con el mes anterior.
* 💵 **Arquitectura Bimonetaria (ARS / USD):** Registro y balances independientes en Pesos y Dólares con consulta de cotización en vivo del **Dólar Blue** (`dolarapi.com`).
* 🔁 **Gastos e Ingresos Recurrentes:** Automatización de cobros o pagos con intervalo de meses, día específico y soporte de cuotas variables.
* ➕ **Gestión de Dinero Extra:** Módulo flotante para registrar ingresos imprevistos con conversión opcional de USD a ARS.
* 🏷️ **Categorización Jerárquica:** Selector estructurado mediante `<optgroup>` dividido en *Hogar y Servicios*, *Diario y Personal* y *Negocio y Finanzas*.
* 🎨 **Sistema Multi-Tema:** Selección fluida con persistencia local (`localStorage`) entre:
  - 🌸 **Modo Claro / Pastel**
  - 🌙 **Modo Oscuro (Dark Pink)**
  - 💙 **Modo Azul Profundo**
  - 🖤 **Modo Black (OLED)**
* 👁️ **Modo Privacidad:** Censura instantánea de montos en pantalla con un solo clic.
* 📄 **Exportación Inteligente:** Descarga de reportes mensuales y anuales en **PDF** (con paleta de colores sincronizada al tema activo) y exportación/importación en **CSV**.
* 📱 **PWA & Offline:** Instalable en dispositivos móviles y escritorio con soporte de Service Worker.

---

## 🌸 Ecosistema Integrado con "Gastos Próximos"

Ambas plataformas operan bajo el mismo proyecto de **Firebase (Auth & Firestore)**, permitiendo un flujo de trabajo continuo[cite: 1]:

* 🔗 **Navegación en un clic:** Barra superior sincronizada para alternar entre el balance mensual y los vencimientos/deudas pendientes sin perder sesión[cite: 1].
* 🔄 **Sincronización Bidireccional:** Al marcar un gasto como pagado en *Gastos Próximos*, se transfiere automáticamente al mes correspondiente de *MENSUALES* conservando categoría, descripción y moneda.

<p align="center">
  <img width="100%" alt="Integración Ecosistema" src="https://github.com/user-attachments/assets/f06b3276-3339-4ef1-8881-aeb1207cbd7e" />
</p>

---

## 🛠️ Tecnologías Utilizadas

* **Frontend:** HTML5 semántico, CSS3 moderno (Variables CSS, Flexbox, Grid), JavaScript (Vanilla ES6+).
* **Backend as a Service (BaaS):** Firebase v12 (Authentication & Cloud Firestore en tiempo real).
* **Librerías & APIs:** jsPDF (v2.5.1), DolarAPI (Cotización Blue en tiempo real).
* **Entorno & Deploy:** Git, GitHub Pages, Vercel.

---

### 🎯 Objetivo del proyecto

El objetivo principal es consolidar conceptos fundamentales de **desarrollo frontend**, **lógica de negocio** y **persistencia de datos en la nube**, aplicando habilidades técnicas que resultan clave en roles como:

* **Technical Support Specialist**
* **Technical Support Analyst**
* **Customer Support / Customer Experience**
* **Product Operations / Operations Support**

El proyecto busca profundizar en cómo interactúan una interfaz intuitiva, el manejo reactivo del estado en el cliente con **JavaScript**, y la sincronización/almacenamiento en tiempo real mediante **Firebase**, garantizando una experiencia de usuario fluida, privada y libre de fricciones operativas.

---

## 🗄️ Estructura de Datos en Firestore

Los registros se encuentran aislados por usuario bajo su propio identificador único (`UID`):

```text
users/
└── {UID}/
    ├── months/
    │   └── {YYYY-MM}/              <- Documento mensual
    │       ├── budget: number
    │       ├── extraIncomes: array
    │       └── expenses: array
    │
    └── proximos/                   <- Colección Gastos Próximos
        └── {itemId}/
            ├── description: string
            ├── amount: number
            ├── currency: "ARS" | "USD"
            ├── category: string
            └── paid: boolean

```

📝 Historial de Actualizaciones (Changelog)
🏷️ Categorías y Usabilidad (19/09/2026)
Reorganización semántica del selector de categorías agrupado en 3 áreas clave:

Hogar y Servicios: Alquiler, Hogar, Agua, Servicios y Suscripciones.

Diario y Personal: Alimentos, Transporte, Salud, Ropa, Gimnasio, Personal, Mascotas, Educación y Entretenimiento.

Negocio y Finanzas: Local, Mercadería, Cuotas, Deudas y Otros.

Recuperación de contraseña integrada con sendPasswordResetEmail y credenciales compartidas entre ambas apps.

Corrección de contraste en modales <dialog> nativos para el Modo Black (#121212) y Modo Azul.

📊 Alertas y Resumen Anual (10/09/2026)
Banner de Alerta de Presupuesto: Detección automática en tiempo real de excedentes presupuestarios con diseño adaptado a cada tema.

Resumen Anual: Modal y reporte PDF con cálculo de acumulados, promedio mensual y categoría más demandada.

Modo Azul y Modo Black: Soporte completo de 4 modos visuales con persistencia en localStorage.

💱 Bimonetario y Sincronización (07/09/2026)
Desglose independiente de totales en ARS y USD.

Sincronización automática de estados de pago entre Gastos Próximos y Mensuales.

---

👩‍💻 Autora

**Florencia Bagnis**

* 💼 [LinkedIn](https://www.linkedin.com/in/florencia-bagnis)
* 💻 [Portfolio](https://florbagnis.github.io/Portfolio-FlorBagnis/)
* 📧 [florenciasoledadbagnis@gmail.com](mailto:florenciasoledadbagnis@gmail.com)

<br>

  > 🌸 Proyecto personal desarrollado para el control de presupuestos y previsión de **gastos mensuales**, enfocado en **JavaScript moderno**, persistencia de datos en tiempo real con **Firebase**, diseño de interfaces limpias con **HTML5/CSS3** y una experiencia de usuario totalmente **responsive**.
