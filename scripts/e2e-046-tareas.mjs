/**
 * 046 — Self-test de COMPORTAMIENTO de tareas y «Hoy» contra la app viva.
 *
 * Uso: app corriendo con `TAREAS=on` (y BD migrada), luego
 *   node --env-file=.env scripts/e2e-046-tareas.mjs
 * Con `E2E_FLAG_OFF=1` comprueba en cambio que, con la bandera apagada, toda
 * la superficie responde 404 y la raíz sigue yendo a la Bandeja.
 *
 * Sale con código 1 si algún check falla.
 */

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
let cookie = "";
let failures = 0;

function check(name, ok, detail = "") {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
}

async function api(path, { method = "GET", body, redirect = "follow" } = {}) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    redirect,
    headers: {
      "content-type": "application/json",
      origin: BASE,
      ...(cookie ? { cookie } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const setCookie = res.headers.getSetCookie?.() ?? [];
  if (setCookie.length) cookie = setCookie.map((c) => c.split(";")[0]).join("; ");
  let json = null;
  try {
    json = await res.clone().json();
  } catch {
    // sin cuerpo JSON
  }
  return { res, json };
}

async function login() {
  const email = process.env.E2E_EMAIL ?? "e2e-046@example.com";
  const password = process.env.E2E_PASSWORD ?? "e2e-046-contrasena";
  let r = await api("/api/auth/sign-up/email", {
    method: "POST",
    body: { email, password, name: "Prueba 046" },
  });
  if (!r.res.ok) {
    r = await api("/api/auth/sign-in/email", { method: "POST", body: { email, password } });
  }
  check("sesión iniciada", r.res.ok, `${r.res.status}`);
}

function dayOffset(today, days) {
  const d = new Date(`${today}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

async function crearContacto(name) {
  const phone = `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const r = await api("/api/contacts", { method: "POST", body: { name, phone } });
  if (!r.res.ok) throw new Error(`no se pudo crear el contacto: ${r.res.status} ${JSON.stringify(r.json)}`);
  return r.json.contact;
}

async function flagOff() {
  const r1 = await api("/api/tareas");
  check("apagada: GET /api/tareas → 404", r1.res.status === 404, `${r1.res.status}`);
  const r2 = await api("/api/tareas", { method: "POST", body: {} });
  check("apagada: POST /api/tareas → 404", r2.res.status === 404, `${r2.res.status}`);
  const r3 = await api("/hoy");
  check("apagada: /hoy → 404", r3.res.status === 404, `${r3.res.status}`);
  const r4 = await api("/", { redirect: "manual" });
  const loc = r4.res.headers.get("location") ?? "";
  check("apagada: la raíz no lleva a /hoy", !loc.endsWith("/hoy"), loc);
}

async function flagOn() {
  const stamp = Date.now().toString(36);
  const pedro = await crearContacto(`Pedro ${stamp}`);
  const laura = await crearContacto(`Laura ${stamp}`);
  const olvidado = await crearContacto(`Olvidado ${stamp}`);

  let hoy = (await api("/api/tareas?vista=hoy")).json;
  check("GET hoy responde con día y zona", typeof hoy?.today === "string" && typeof hoy?.timezone === "string");
  const today = hoy.today;

  check(
    "un trato abierto sin tareas aparece en «Sin siguiente paso»",
    hoy.sinSiguientePaso.some((l) => l.contact.id === olvidado.id)
  );

  // H4 — crear: vencida (ayer), de hoy (con hora), de hoy (todo el día), futura.
  const crear = (body) => api("/api/tareas", { method: "POST", body });
  const vencida = await crear({ contactId: pedro.id, title: "Llamar a Pedro (ayer)", day: dayOffset(today, -1), time: "09:00" });
  check("crear tarea → 201", vencida.res.status === 201, `${vencida.res.status} ${JSON.stringify(vencida.json)}`);
  const deHoy = await crear({ contactId: pedro.id, title: "Segunda visita Pedro", type: "visita", day: today, time: "23:00" });
  const todoElDia = await crear({ contactId: laura.id, title: "Mandar ficha a Laura", type: "whatsapp", day: today });
  await crear({ contactId: laura.id, title: "Seguimiento Laura", day: dayOffset(today, 3) });

  const malo = await crear({ contactId: "ct_inexistente", title: "x", day: today });
  check("contacto ajeno o inexistente → 422", malo.res.status === 422, `${malo.res.status}`);
  const sinTitulo = await crear({ contactId: pedro.id, title: "  ", day: today });
  check("título vacío → 422", sinTitulo.res.status === 422, `${sinTitulo.res.status}`);

  // H5 — «Hoy»: orden Vencidas → Hoy → Sin siguiente paso.
  hoy = (await api("/api/tareas?vista=hoy")).json;
  const idsVencidas = hoy.vencidas.map((t) => t.id);
  const idsHoy = hoy.hoy.map((t) => t.id);
  check("la de ayer está en Vencidas", idsVencidas.includes(vencida.json.id));
  check("las de hoy están en Para hoy", idsHoy.includes(deHoy.json.id) && idsHoy.includes(todoElDia.json.id));
  check("la de dentro de 3 días no aparece en Hoy", hoy.hoy.every((t) => !t.title.startsWith("Seguimiento Laura")));
  check(
    "en Para hoy, la de todo el día va antes que la de hora",
    idsHoy.indexOf(todoElDia.json.id) < idsHoy.indexOf(deHoy.json.id)
  );
  check(
    "Pedro y Laura ya no están en «Sin siguiente paso»",
    !hoy.sinSiguientePaso.some((l) => l.contact.id === pedro.id || l.contact.id === laura.id)
  );

  // Contador del menú.
  let cont = (await api("/api/tareas?vista=contador")).json;
  check("el contador ve al menos 1 vencida y 2 de hoy", cont.vencidas >= 1 && cont.hoy >= 2, JSON.stringify(cont));
  const antes = cont;

  // Completar con un toque la sacan de la lista.
  const done = await api(`/api/tareas/${todoElDia.json.id}`, { method: "PATCH", body: { done: true } });
  check("completar → 200", done.res.ok, `${done.res.status}`);
  hoy = (await api("/api/tareas?vista=hoy")).json;
  check("la completada sale de Para hoy", !hoy.hoy.some((t) => t.id === todoElDia.json.id));
  cont = (await api("/api/tareas?vista=contador")).json;
  check("el contador baja al completar", cont.hoy === antes.hoy - 1, `${antes.hoy} → ${cont.hoy}`);

  // Reabrir la devuelve.
  await api(`/api/tareas/${todoElDia.json.id}`, { method: "PATCH", body: { done: false } });
  hoy = (await api("/api/tareas?vista=hoy")).json;
  check("reabrir la devuelve a Para hoy", hoy.hoy.some((t) => t.id === todoElDia.json.id));

  // Por contacto.
  const deLaura = (await api(`/api/tareas?vista=contacto&contactId=${laura.id}`)).json;
  check("las de Laura: 2 pendientes", deLaura.pendientes.length === 2, `${deLaura.pendientes.length}`);

  // Mover de día conserva la hora.
  const mov = await api(`/api/tareas/${deHoy.json.id}`, { method: "PATCH", body: { day: dayOffset(today, 1) } });
  check("mover de día → 200", mov.res.ok, `${mov.res.status}`);
  const dePedro = (await api(`/api/tareas?vista=contacto&contactId=${pedro.id}`)).json;
  const movida = dePedro.pendientes.find((t) => t.id === deHoy.json.id);
  const horaLocal = movida
    ? new Intl.DateTimeFormat("en-GB", { timeZone: hoy.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(movida.dueAt))
    : "";
  check("al mover de día se conserva la hora (23:00)", horaLocal === "23:00", horaLocal);

  // Borrar.
  const del = await api(`/api/tareas/${vencida.json.id}`, { method: "DELETE" });
  check("borrar → 204", del.res.status === 204, `${del.res.status}`);
  const del2 = await api(`/api/tareas/${vencida.json.id}`, { method: "DELETE" });
  check("borrar dos veces → 404", del2.res.status === 404, `${del2.res.status}`);

  // La raíz entra a «Hoy».
  const root = await api("/", { redirect: "manual" });
  const loc = root.res.headers.get("location") ?? "";
  check("la raíz entra a /hoy (o a la guía de inicio si falta un paso)", loc.endsWith("/hoy") || loc.endsWith("/onboarding"), loc);

  const page = await api("/hoy");
  check("la pantalla /hoy carga", page.res.ok, `${page.res.status}`);
}

await login();
if (process.env.E2E_FLAG_OFF === "1") await flagOff();
else await flagOn();

console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
