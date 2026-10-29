/**
 * 054 (fork) — Self-test de la gestión del equipo contra la app viva
 * (TAREAS o PROPIEDADES encendidos).
 *
 *   node --env-file=.env scripts/e2e-054-equipo.mjs
 *
 * Recorre: editar nombre/correo/rol, no dejar al equipo sin propietario,
 * contraseña temporal (la vieja deja de servir y la sesión abierta se cierra),
 * un miembro no puede administrar, quitar a alguien (sus tareas pendientes
 * pasan a quien lo quita y ya no puede entrar), no quitarse a sí mismo, y la
 * pantalla con sus acciones. Con `E2E_FLAG_OFF=1` comprueba el 404.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const pausa = (ms) => new Promise((r) => setTimeout(r, ms));

function cliente() {
  let cookie = "";
  return async function api(path, { method = "GET", body } = {}) {
    const res = await fetch(`${BASE}${path}`, {
      method,
      headers: { "content-type": "application/json", origin: BASE, ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const sc = res.headers.getSetCookie?.() ?? [];
    if (sc.length) cookie = sc.map((c) => c.split(";")[0]).join("; ");
    let json = null;
    try { json = await res.json(); } catch { /* sin JSON */ }
    return { status: res.status, json };
  };
}
async function entrar(api, cred) {
  // El limitador de Better Auth deja 3 intentos por 10 s en las rutas sensibles.
  await pausa(3600);
  return api("/api/auth/sign-in/email", { method: "POST", body: cred });
}

const dueno = cliente();
const r0 = await entrar(dueno, OWNER);
if (r0.status !== 200) {
  await pausa(3600);
  await dueno("/api/auth/sign-up/email", { method: "POST", body: { ...OWNER, name: "Prueba 054" } });
}

if (process.env.E2E_FLAG_OFF === "1") {
  const r = await dueno("/api/equipo/x", { method: "PATCH", body: { name: "x" } });
  check("apagado: PATCH /api/equipo/:id → 404", r.status === 404, `${r.status}`);
  process.exit(failures ? 1 : 0);
}

const lista = async () => (await dueno("/api/settings/team")).json.members;
const stamp = Date.now().toString(36);
const socio = { name: `Socio ${stamp}`, email: `socio-${stamp}@example.com`, password: "temporal-123" };
check("crear cuenta de equipo", (await dueno("/api/settings/team", { method: "POST", body: socio })).status === 201);
let miembros = await lista();
const yo = miembros.find((m) => m.email === OWNER.email);
let s = miembros.find((m) => m.email === socio.email);

// Editar.
let r = await dueno(`/api/equipo/${s.id}`, { method: "PATCH", body: { name: `Socia ${stamp}`, email: `socia-${stamp}@example.com` } });
miembros = await lista();
s = miembros.find((m) => m.id === s.id);
check("editar nombre y correo", r.status === 200 && s.name === `Socia ${stamp}` && s.email === `socia-${stamp}@example.com`, JSON.stringify(r));
r = await dueno(`/api/equipo/${s.id}`, { method: "PATCH", body: { email: OWNER.email } });
check("un correo que ya usa otra cuenta → 409", r.status === 409, `${r.status}`);

// Propietarios.
const otrosDuenos = miembros.filter((m) => m.role === "owner" && m.id !== yo.id);
if (otrosDuenos.length === 0) {
  r = await dueno(`/api/equipo/${yo.id}`, { method: "PATCH", body: { role: "member" } });
  check("el único propietario no puede bajarse a miembro → 409", r.status === 409 && r.json?.error?.code === "ultimo_propietario", JSON.stringify(r));
}
r = await dueno(`/api/equipo/${s.id}`, { method: "PATCH", body: { role: "owner" } });
check("hacer propietaria a la socia", r.status === 200 && (await lista()).find((m) => m.id === s.id).role === "owner");
r = await dueno(`/api/equipo/${s.id}`, { method: "PATCH", body: { role: "member" } });
check("…y volverla miembro", r.status === 200 && (await lista()).find((m) => m.id === s.id).role === "member");

// Un miembro no administra.
const socia = cliente();
r = await entrar(socia, { email: `socia-${stamp}@example.com`, password: socio.password });
check("la socia entra con su correo nuevo", r.status === 200, `${r.status}`);
r = await socia(`/api/equipo/${yo.id}`, { method: "PATCH", body: { name: "hackeo" } });
check("un miembro no puede editar a nadie → 403", r.status === 403, `${r.status}`);

// Contraseña temporal: cierra la sesión abierta y la vieja deja de servir.
r = await dueno(`/api/equipo/${s.id}/contrasena`, { method: "POST", body: { password: "nueva-clave-456" } });
check("poner contraseña temporal", r.status === 200, JSON.stringify(r));
r = await socia("/api/settings/team");
check("…cierra la sesión que la socia tenía abierta", r.status === 401, `${r.status}`);
r = await entrar(cliente(), { email: `socia-${stamp}@example.com`, password: socio.password });
check("…la contraseña vieja ya no sirve", r.status !== 200, `${r.status}`);
const socia2 = cliente();
r = await entrar(socia2, { email: `socia-${stamp}@example.com`, password: "nueva-clave-456" });
check("…y la nueva sí", r.status === 200, `${r.status}`);

// Quitar: sus tareas pendientes pasan a quien la quita.
const c = await dueno("/api/contacts", { method: "POST", body: { name: `Cliente ${stamp}`, phone: `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` } });
const hoy = (await dueno("/api/tareas?vista=hoy")).json;
const sociaUserId = await (async () => {
  // La socia crea una tarea para sí misma: así queda asignada a ella.
  await socia2("/api/tareas", { method: "POST", body: { contactId: c.json.contact.id, title: `Llamar ${stamp}`, type: "llamada", day: hoy.today, time: "23:00" } });
  const l = (await dueno(`/api/tareas?vista=contacto&contactId=${c.json.contact.id}`)).json.pendientes;
  return l.find((x) => x.title === `Llamar ${stamp}`)?.assignedUserId ?? null;
})();
check("la socia tiene una tarea pendiente a su nombre", !!sociaUserId);
r = await dueno(`/api/equipo/${yo.id}`, { method: "DELETE" });
check("no puede quitarse a sí mismo → 409", r.status === 409 && r.json?.error?.code === "a_si_mismo", JSON.stringify(r));
r = await dueno(`/api/equipo/${s.id}`, { method: "DELETE" });
check("quitar a la socia", r.status === 200 && r.json?.tareasReasignadas === 1, JSON.stringify(r));
check("…ya no aparece en el equipo", !(await lista()).some((m) => m.id === s.id));
const pend = (await dueno(`/api/tareas?vista=contacto&contactId=${c.json.contact.id}`)).json.pendientes;
check("…y su tarea pendiente pasó a quien la quitó", pend.length === 1 && pend[0].assignedUserId !== sociaUserId && pend[0].assignedUserId, JSON.stringify(pend.map((p) => p.assignedUserId)));
r = await socia2("/api/settings/team");
check("…su sesión ya no sirve", r.status === 401, `${r.status}`);
r = await entrar(cliente(), { email: `socia-${stamp}@example.com`, password: "nueva-clave-456" });
check("…y ya no puede entrar", r.status !== 200, `${r.status}`);
for (const p of pend) await dueno(`/api/tareas/${p.id}`, { method: "DELETE" });

// Pantalla.
const otro = { name: `Pantalla ${stamp}`, email: `pantalla-${stamp}@example.com`, password: "temporal-789" };
await dueno("/api/settings/team", { method: "POST", body: otro });
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const page = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })).newPage();
await pausa(3600);
await page.goto(`${BASE}/login`);
await page.fill("#email", OWNER.email);
await page.fill("#password", OWNER.password);
await page.click("button[type=submit]");
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 20_000 });
await page.goto(`${BASE}/settings/team`);
await page.getByRole("button", { name: `Quitar a ${otro.name} del equipo` }).click();
check("la pantalla pide confirmar antes de quitar (sin ventana del navegador)", await page.getByText(`¿Quitar a ${otro.name} del equipo?`).isVisible());
await page.getByRole("button", { name: /^Sí, quitar a/ }).click();
await page.getByRole("status").getByText(`${otro.name} ya no está en el equipo.`).waitFor({ timeout: 5000 });
const salio = await page.getByText(otro.email).waitFor({ state: "detached", timeout: 5000 }).then(() => true, () => false);
check("…y al confirmar avisa y lo saca de la lista", salio);
check("a uno mismo no se le ofrece «Quitar»", (await page.getByRole("button", { name: /Quitar a .* del equipo/ }).count()) === (await lista()).length - 1);
await browser.close();

console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
