# 💗 MENSUALES & Gastos Próximos · Control de Gastos

<p align="center">
  <img width="1528" height="877" alt="image" src="https://github.com/user-attachments/assets/2a8f7688-da56-4acf-ab05-3417c841c709" />
</p>

> **MENSUALES** es una Progressive Web App (PWA) bimonetaria diseñada para registrar, organizar y proyectar finanzas personales mes a mes con sincronización en la nube en tiempo real e integración directa con **[Gastos Próximos](https://gastos-proximos.vercel.app/)**.

<p align="center">
  <a href="https://gastosmensuales-two.vercel.app/">
    <img src="https://img.shields.io/badge/Ver_Demo-Abrir_Herramienta-ff69b4?style=for-the-badge&logo=vercel&logoColor=white" alt="Ver Demo" />
  </a>
</p>

---

## ✨ Características Principales

* 💰 **Control Presupuestario Mensual:** Registro de presupuesto base, control de dinero disponible, cálculo de excesos en tiempo real y comparativa porcentual con el mes anterior.
* 💵 **Arquitectura Bimonetaria (ARS / USD):** Registro y balances independientes en Pesos y Dólares con consulta de cotización en vivo del **Dólar Blue** (`dolarapi.com`).
* 🔁 **Gastos e Ingresos Recurrentes:** Automatización de cobros o pagos con intervalo de meses, día específico y soporte de cuotas variables.
* ➕ **Gestión de Dinero Extra:** Módulo flotante para registrar ingresos imprevistos con conversión opcional de USD a ARS.
* 🏷️ **Categorización Jerárquica:** Selector estructurado mediante `<optgroup>` dividido en *Hogar y Servicios*, *Diario y Personal* y *Negocio y Finanzas*.
* 🛒 **Changui · Calculá tu compra:** Armado de un changuito con promos (porcentajes, 2x1, 2da unidad al 50% / 70%), descuento general, envío a domicilio y precios en ARS o USD. La compra se registra en los gastos del mes con un clic, separada por rubro o como un único gasto. Incluye historial de changuitos con edición, y exportación a **PDF** y **CSV**.
* 🐷 **Pocki · Ahorrando ando:** Metas de ahorro en ARS o USD. Calcula en cuánto tiempo se alcanza cada meta según el sobrante mensual real del historial (o el ahorro mensual que elijas), con avisos al estar cerca de cumplirla, historial de movimientos por meta (sumar, retirar, editar y eliminar) y reporte **PDF** con gráfico de lo ahorrado vs. lo que falta.
* 🎨 **Sistema Multi-Tema:** Selección fluida con persistencia local (`localStorage`) entre:
  - 🌸 **Modo Claro / Pastel**
  - 🌙 **Modo Oscuro (Dark Pink)**
  - 💙 **Modo Azul Profundo**
  - 🖤 **Modo Black (OLED)**
* 👁️ **Modo Privacidad:** Censura instantánea de montos en pantalla con un solo clic.
* 📄 **Exportación Inteligente:** Descarga de reportes mensuales y anuales en **PDF** (con paleta de colores sincronizada al tema activo) y exportación/importación en **CSV**.
* ⬆️ **Navegación cómoda:** Flecha flotante para volver al inicio y efecto de luz en los botones, ambos adaptados a cada tema.
* 📱 **PWA & Offline:** Instalable en dispositivos móviles y escritorio con soporte de Service Worker.

---

## 🌸 Ecosistema Integrado con "Gastos Próximos"

Ambas plataformas operan bajo el mismo proyecto de **Firebase (Auth & Firestore)**, permitiendo un flujo de trabajo continuo:

* 🔗 **Navegación en un clic:** Barra superior sincronizada para alternar entre el balance mensual y los vencimientos/deudas pendientes sin perder sesión.
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

> 💡 Los módulos **Changui** y **Pocki** guardan sus datos (changuitos, historial de compras y metas de ahorro) por usuario en el `localStorage` del dispositivo. Las compras de Changui y los retiros de Pocki se reflejan además en los gastos y el presupuesto del mes dentro de Firestore.

---

## 📝 Historial de Actualizaciones (Changelog)

### 🛒 Changui, Pocki y mejoras de interfaz (14/10/2026)

**🐛 Correcciones**
* Corregido el layout roto de la página: faltaban los cierres de `<header>`, de la sección de Pocki y del contenedor de Changui, lo que corría todo el contenido hacia la derecha.
* Corregido el solapamiento de los campos *Fecha* y *Cargar como* en el formulario "Registrar la compra en tus gastos" de Changui, con columnas más anchas y mayor espaciado.
* Los nombres de productos y locales se escapan antes de mostrarse en el análisis comparativo de Changui.

**🛒 Changui**
* El PDF del changuito activo ahora aplica el descuento general y suma los totales en pesos y en dólares por separado.
* Nuevo botón **CSV** para exportar el changuito activo, con el descuento general aplicado.
* Nuevo botón ✏️ en el historial para editar el local y la fecha de cada changuito guardado.
* Botones del modal de historial más compactos.

**🐷 Pocki**
* El PDF incluye un nuevo **gráfico de barras por meta** que muestra lo ahorrado y lo que falta, con el porcentaje de avance.

**🎨 Interfaz**
* Íconos de acción (✏️ editar, 🗑️ eliminar, ✕) flotantes y sin recuadro en toda la app y en los 4 temas.
* Nueva **flecha para volver arriba**, con colores propios para el modo claro, oscuro, azul y black.
* **Efecto de luz** al pasar el mouse por los botones, con un brillo debajo y una línea de luz en el borde inferior, cuyo color cambia con el tema activo.

### 🏷️ Categorías y Usabilidad (19/09/2026)

* Reorganización semántica del selector de categorías agrupado en 3 áreas clave:
  * **Hogar y Servicios:** Alquiler, Hogar, Agua, Servicios y Suscripciones.
  * **Diario y Personal:** Alimentos, Transporte, Salud, Ropa, Gimnasio, Personal, Mascotas, Educación y Entretenimiento.
  * **Negocio y Finanzas:** Local, Mercadería, Cuotas, Deudas y Otros.
* Recuperación de contraseña integrada con `sendPasswordResetEmail` y credenciales compartidas entre ambas apps.
* Corrección de contraste en modales `<dialog>` nativos para el Modo Black (`#121212`) y Modo Azul.

### 📊 Alertas y Resumen Anual (10/09/2026)

* **Banner de Alerta de Presupuesto:** Detección automática en tiempo real de excedentes presupuestarios con diseño adaptado a cada tema.
* **Resumen Anual:** Modal y reporte PDF con cálculo de acumulados, promedio mensual y categoría más demandada.
* **Modo Azul y Modo Black:** Soporte completo de 4 modos visuales con persistencia en `localStorage`.

### 💱 Bimonetario y Sincronización (07/09/2026)

* Desglose independiente de totales en ARS y USD.
* Sincronización automática de estados de pago entre Gastos Próximos y Mensuales.

---

¿Te sirvió? Dejale una ⭐ al repo.

---

## 📄 Licencia

Distribuido bajo licencia MIT. Ver el archivo `LICENSE`.

## 👩‍💻 Autora

**Florencia Bagnis**

* 💼 [LinkedIn](https://www.linkedin.com/in/florencia-bagnis)
* 💻 [Portfolio](https://florbagnis.github.io/Portfolio-FlorBagnis/)
* 📧 [florenciasoledadbagnis@gmail.com](mailto:florenciasoledadbagnis@gmail.com)

<br>

> 🌸 Proyecto personal desarrollado para el control de presupuestos y previsión de **gastos mensuales**, enfocado en **JavaScript moderno**, persistencia de datos en tiempo real con **Firebase**, diseño de interfaces limpias con **HTML5/CSS3** y una experiencia de usuario totalmente **responsive**.
