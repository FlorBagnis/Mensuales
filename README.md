# 💗 MENSUALES & Gastos Próximos · Control de Gastos

<p align="center">
  <img width="100%" alt="Preview Mensuales" src="https://github.com/user-attachments/assets/52879245-6b81-48ec-9fbd-2569a2c0e07d" />
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
