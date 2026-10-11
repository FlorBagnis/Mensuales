/* =========================================================
   /api/avisos  ·  Mail diario con los recurrentes por vencer
   Lo ejecuta Vercel Cron todos los días (ver vercel.json).
   Revisa a TODOS los usuarios de Firebase y manda un solo mail
   a cada usuario (a SU email, con SUS recurrentes) con lo que está vencido o vence en 3 días o menos.
========================================================= */

const admin = require("firebase-admin");
const nodemailer = require("nodemailer");

const DIAS_POR_VENCER = 3;
const pad = n => String(n).padStart(2, "0");

function hoyAR(now = new Date()) {
  const [y, m, d] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
    .format(now).split("-").map(Number);
  return { y, m, d, date: new Date(y, m - 1, d), mes: `${y}-${pad(m)}` };
}

function diaEfectivo(diaVence, hoy) {
  const ultimo = new Date(hoy.y, hoy.m, 0).getDate();
  return Math.min(Math.max(Number(diaVence) || 1, 1), ultimo);
}

function diasMensual(diaVence, hoy) {
  const venc = new Date(hoy.y, hoy.m - 1, diaEfectivo(diaVence, hoy));
  return Math.round((venc - hoy.date) / 86400000);
}

const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" }[c]));

function money(v, cur) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency", currency: cur === "USD" ? "USD" : "ARS",
    minimumFractionDigits: 0, maximumFractionDigits: 2
  }).format(Number(v || 0));
}

function textoDias(d) {
  if (d < 0) return `vencido hace ${-d} ${d === -1 ? "día" : "días"}`;
  if (d === 0) return "vence HOY";
  if (d === 1) return "vence mañana";
  return `vence en ${d} días`;
}

function armarMail(items, hoy) {
  const vencidos = items.filter(i => i.dias < 0).length;
  const porVencer = items.length - vencidos;
  const partes = [];
  if (vencidos) partes.push(`${vencidos} vencido${vencidos === 1 ? "" : "s"}`);
  if (porVencer) partes.push(`${porVencer} por vencer`);
  const asunto = `🌸 Recordatorio de pagos: ${partes.join(" · ")}`;

  const filas = items.map(i => {
    const color = i.dias < 0 ? "#d32f2f" : "#c26a00";
    const monto = i.monto ? money(i.monto, i.currency) : "monto a definir";
    return `<tr>
      <td style="padding:8px 10px;border-bottom:1px solid #f3dce5"><b>${esc(i.descripcion)}</b><br><span style="color:#888;font-size:12px">${esc(i.categoria || "")}</span></td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3dce5;color:${color};font-weight:700">${textoDias(i.dias)}</td>
      <td style="padding:8px 10px;border-bottom:1px solid #f3dce5;text-align:right">${monto}</td>
    </tr>`;
  }).join("");

  const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#333">
    <h2 style="color:#c43878;margin-bottom:4px">🌸 Tenés pagos por atender</h2>
    <p style="margin-top:0;color:#777">Resumen al ${pad(hoy.d)}/${pad(hoy.m)}/${hoy.y}</p>
    <table style="width:100%;border-collapse:collapse;font-size:14px">${filas}</table>
    <p style="margin-top:18px;font-size:13px;color:#777">Cuando pagues, marcalo con ✓ en la app y deja de avisarte.<br>
    <a href="https://gastosmensuales-two.vercel.app/">Abrir Mensuales</a> · <a href="https://gastos-proximos.vercel.app/">Abrir Próximos</a></p>
  </div>`;
  return { asunto, html };
}

module.exports = async (req, res) => {
  const secret = process.env.CRON_SECRET;
  if (!secret) return res.status(500).json({ error: "Falta la variable CRON_SECRET" });
  if (req.headers.authorization !== `Bearer ${secret}` && req.query.key !== secret) {
    return res.status(401).json({ error: "No autorizado" });
  }

  try {
    if (!admin.apps.length) {
      admin.initializeApp({ credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) });
    }
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const hoy = hoyAR();
    const prueba = req.query.test === "1"; // ?test=1 → manda todo lo pendiente, aunque falte para vencer
    const db = admin.firestore();

    const resultado = [];
    const fallidos = [];
    const pendientesDeEnvio = [];

    // 1) Armar el aviso de cada usuario (cada uno recibe SOLO lo suyo)
    let pageToken;
    do {
      const page = await admin.auth().listUsers(1000, pageToken);
      for (const u of page.users) {
        if (!u.email) continue;
        // Si la persona apagó los avisos por mail, no le mandamos nada
        const cfg = await db.collection("users").doc(u.uid).collection("config").doc("avisos").get();
        if (cfg.exists && cfg.data().mail === false) continue;
        const snap = await db.collection("users").doc(u.uid).collection("recurrentes").get();
        const items = [];
        snap.forEach(d => {
          const r = d.data();
          if (r.activo === false || r.avisar === false) return;
          if (r.pagos && r.pagos[hoy.mes]) return; // ya pagado este mes
          const dias = diasMensual(r.diaVence, hoy);
          if (prueba || dias <= DIAS_POR_VENCER) items.push({ ...r, dias });
        });
        if (!items.length) continue;
        items.sort((a, b) => a.dias - b.dias);
        pendientesDeEnvio.push({ email: u.email, items });
      }
      pageToken = page.pageToken;
    } while (pageToken);

    // 2) Enviar de a 10 mails en paralelo
    for (let i = 0; i < pendientesDeEnvio.length; i += 10) {
      const lote = pendientesDeEnvio.slice(i, i + 10);
      await Promise.all(lote.map(async ({ email, items }) => {
        try {
          const { asunto, html } = armarMail(items, hoy);
          await transporter.sendMail({
            from: `"Mensuales 🌸" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: asunto,
            html
          });
          resultado.push({ usuario: email, avisos: items.length });
        } catch (err) {
          console.error("Falló el mail a", email, err.message);
          fallidos.push({ usuario: email, error: err.message });
        }
      }));
    }

    return res.status(200).json({ ok: true, fecha: `${hoy.y}-${pad(hoy.m)}-${pad(hoy.d)}`, enviados: resultado.length, fallidos: fallidos.length, detalle: resultado, errores: fallidos });
  } catch (err) {
    console.error("Error en /api/avisos:", err);
    return res.status(500).json({ error: String(err && err.message ? err.message : err) });
  }
};

