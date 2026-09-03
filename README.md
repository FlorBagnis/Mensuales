# 💗 MENSUALES · Control de gastos

<img width="1504" height="877" alt="image" src="https://github.com/user-attachments/assets/52879245-6b81-48ec-9fbd-2569a2c0e07d" />

**MENSUALES** es una aplicación web para registrar, organizar y controlar los gastos personales mes a mes.

Permite crear una cuenta, guardar los gastos de forma segura y sincronizarlos automáticamente utilizando **Firebase Authentication** y **Cloud Firestore**.

<img width="1730" height="879" alt="image" src="https://github.com/user-attachments/assets/f5b57841-95dc-4c60-92a4-b2aaaee96093" />


---

## ✨ Funcionalidades

### 🔐 Cuenta de usuario

* Registro con email y contraseña.
* Inicio de sesión.
* Cierre de sesión.
* Cada usuario tiene sus propios datos.
* Los gastos no se comparten entre cuentas.

### 💰 Control mensual

* Selección del mes.
* Registro de presupuesto mensual.
* Cálculo automático del total gastado.
* Dinero disponible o presupuesto excedido.
* Comparación con el mes anterior.

### 🧾 Gestión de gastos

Cada gasto puede incluir:

* 📅 Fecha.
* 📝 Descripción.
* 🏷️ Categoría.
* 💵 Monto.

También permite:

* ✏️ Editar gastos.
* 🗑️ Eliminar gastos.
* ➕ Agregar nuevos gastos.

### 🔁 Gastos recurrentes

La aplicación permite configurar gastos que se repiten automáticamente.

Podés elegir:

* Cada cuántos meses se repite.
* Día del mes.
* Durante cuántos meses se mantiene la repetición.

Por ejemplo:

> Netflix → $15.000 → día 10 → repetir cada 1 mes → durante 12 meses.

Si se selecciona el día 31 y un determinado mes no tiene 31 días, se utiliza automáticamente el último día disponible.

### 📊 Estadísticas

MENSUALES muestra:

* Total gastado.
* Total del mes anterior.
* Diferencia entre meses.
* Porcentaje de aumento o disminución.
* Presupuesto disponible.
* Gastos agrupados por categoría.
* Historial de los últimos meses.
* Análisis automático de tendencias.

### 📄 Exportación a PDF

Permite generar un reporte PDF del mes seleccionado con:

* Resumen financiero.
* Gastos registrados.
* Categorías.
* Total mensual.
* Comparación con el mes anterior.
* Análisis de tendencia.

### 🧹 Empezar de cero

La aplicación incluye una opción para eliminar todos los datos de la cuenta sin eliminar la cuenta de acceso.

Se solicita una doble confirmación antes de realizar esta acción.

---

## 🛠️ Tecnologías utilizadas

* **HTML5**
* **CSS3**
* **JavaScript**
* **Firebase Authentication**
* **Cloud Firestore**
* **jsPDF**
* **Git**
* **GitHub Pages**

---

## 🔥 Firebase

MENSUALES utiliza Firebase para gestionar la autenticación y almacenar los datos.

La estructura de los datos está organizada por usuario:

```text
users
 └── UID
      └── months
           ├── 2026-08
           ├── 2026-09
           └── 2026-10
```

Cada mes contiene:

```text
budget
expenses[]
```

Cada gasto contiene información como:

```text
id
date
description
category
amount
```

Esto permite que cada usuario tenga su propio historial independiente.

---

## 🔒 Seguridad

La aplicación utiliza **Firebase Authentication** para identificar al usuario.

Los datos de cada usuario se almacenan bajo su propio `UID`.

Las reglas recomendadas de Firestore deben permitir que un usuario solamente pueda acceder a:

```text
/users/{su UID}/months/*
```

y no a los datos de otros usuarios.

> ⚠️ Nunca publiques contraseñas, claves privadas, tokens secretos ni credenciales administrativas de Firebase en el repositorio.

La configuración web pública de Firebase (`apiKey`, `authDomain`, `projectId`, etc.) puede aparecer en aplicaciones web Firebase, pero la seguridad real debe estar protegida mediante las reglas de Firestore y Authentication.

---

## 📁 Estructura del proyecto

```text
MENSUALES/
│
├── index.html
├── app.js
├── styles.css
└── README.md
```

### `index.html`

Contiene la estructura visual de la aplicación:

* Login.
* Registro.
* Panel principal.
* Selector de mes.
* Presupuesto.
* Tabla de gastos.
* Historial.
* Categorías.
* Análisis.
* Modal para agregar y editar gastos.

### `app.js`

Contiene la lógica principal:

* Firebase.
* Authentication.
* Firestore.
* Login y registro.
* Sincronización en tiempo real.
* Gestión de gastos.
* Edición y eliminación.
* Presupuestos.
* Gastos recurrentes.
* Historial.
* Estadísticas.
* Generación de PDF.

### `styles.css`

Contiene todo el diseño visual de MENSUALES.

---

## 🚀 Ejecutar el proyecto

Podés ejecutar el proyecto utilizando GitHub Pages o un servidor local.

Como `app.js` utiliza módulos JavaScript y Firebase, es recomendable abrir el proyecto mediante un servidor web y no directamente con `file://`.

Por ejemplo, utilizando **VS Code + Live Server**.

---

## 🌐 Publicar en GitHub Pages

1. Crear un repositorio en GitHub.
2. Subir:

```text
index.html
app.js
styles.css
README.md
```

3. Ir a:

```text
Settings
→ Pages
```

4. Seleccionar:

```text
Deploy from a branch
```

5. Elegir:

```text
main
/ (root)
```

6. Guardar.

GitHub generará la dirección pública de la aplicación.

---

## 🗄️ Configuración de Firebase

En Firebase se necesita habilitar:

### Authentication

Activar:

```text
Authentication
→ Sign-in method
→ Email/Password
```

### Firestore Database

Crear una base de datos de Cloud Firestore.

Luego configurar las reglas de seguridad para que cada usuario pueda acceder únicamente a sus propios datos.

---

## 💗 Categorías disponibles

Actualmente MENSUALES incluye:

* 🍔 Alimentos
* 🚗 Transporte
* 🏠 Hogar
* 💡 Servicios
* 🩷 Salud
* 👕 Ropa
* 🎬 Entretenimiento
* 📚 Educación
* 🐾 Mascotas
* 📦 Otros

---

## 🎯 Objetivo del proyecto

MENSUALES fue creado para ofrecer una forma sencilla y visual de llevar el control de los gastos personales.

La idea es poder saber rápidamente:

> **Cuánto tengo, cuánto gasté, en qué gasté y cómo estoy comparando con otros meses.**

---

## 🔮 Próximas mejoras

Algunas funcionalidades que podrían incorporarse en futuras versiones:

* 📈 Gráficos más avanzados.
* 🔔 Recordatorios de gastos.
* 💳 Control de tarjetas.
* 🏦 Cuentas bancarias.
* 📱 Mejoras para dispositivos móviles.
* 📊 Estadísticas anuales.
* 🔎 Búsqueda y filtros de gastos.
* 📥 Exportación a Excel.
* 🌙 Modo oscuro.
* 💱 Soporte para diferentes monedas.

---

---

## 🚀 Actualizaciones

### 🌸 Acceso directo a Gastos Próximos
Se integró un botón de acceso directo en la barra superior para navegar hacia la aplicación web compañera **[Gastos Próximos](https://gastos-proximos.vercel.app/)**. 

* **Navegación en un clic:** Pasá del balance mensual a tus pagos futuros y deudas pendientes sin cerrar tu sesión activa.
* **Diseño adaptado:** Botón personalizado en tono translúcido integrado a la paleta estética rosada de la aplicación.

<img width="1487" height="362" alt="image" src="https://github.com/user-attachments/assets/07899cb3-cb17-442d-abed-eab8c0b89985" />

---

# 💗 MENSUALES — Control de Presupuesto & Finanzas Personales

Aplicación web progresiva e intuitiva diseñada para el seguimiento mensual de gastos personales, presupuestos, proyecciones y análisis de hábitos financieros.

---

## 🚀 Novedades: Ecosistema Integrado con "Gastos Próximos" 🌸

Se integró **MENSUALES** con la aplicación complementaria **[Gastos Próximos](https://gastos-proximos.vercel.app/)** (agenda de vencimientos, pagos a realizar y deudas), creando un flujo financiero unificado bajo el mismo proyecto de Firebase[cite: 1].

### 🔗 Acceso Rápido entre Aplicaciones
* Se añadió un **botón directo de navegación en la cabecera** de ambas aplicaciones que permite alternar entre **MENSUALES** y **Gastos Próximos** al instante y en la misma pestaña, sin abrir ventanas adicionales ni perder contexto[cite: 1].

<img width="1569" height="699" alt="image" src="https://github.com/user-attachments/assets/f06b3276-3339-4ef1-8881-aeb1207cbd7e" />


---

## 🔄 Flujo de Sincronización Bidireccional en Tiempo Real

Ambas aplicaciones comparten la misma base de datos en **Cloud Firestore** y el mismo sistema de credenciales en **Firebase Authentication**[cite: 1]. Esto habilita una sincronización inteligente y automática:


## 👩‍💻 Proyecto

**MENSUALES · Control de gastos**

Desarrollado como proyecto web utilizando HTML, CSS, JavaScript y Firebase.

---

### 💗 MENSUALES

**Tus gastos, organizados.**

## 👩‍💻 Autora

**Florencia Bagnis**

- 💼 LinkedIn: https://www.linkedin.com/in/florencia-bagnis-5043aa152/
- 💻 Portfolio: https://florbagnis.github.io/Portfolio-FlorBagnis/
- 📧 Email: florenciasoledadbagnis@gmail.com

---

