/**
 * 058 (fork) — Self-test del webhook de leads del sitio y los referidos,
 * contra la app viva (PROPIEDADES/TAREAS encendidos, WEB_LEADS_TOKEN en el .env).
 *
 *   node --env-file=.env scripts/e2e-058-web-leads.mjs
 *
 * Hace de knockknockcr.com: manda envíos con el formato EXACTO de hoy y con
 * lo nuevo (referidor, solicitud específica, vendedor, solo correo), y revisa
 * contacto, lead, ficha, interés en la propiedad, tarea, idempotencia,
 * referidor y la pantalla de Referidos. `E2E_FLAG_OFF=1`: el webhook da 404.
 */
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const TOKEN = process.env.WEB_LEADS_TOKEN ?? "";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const web = async (body, token = TOKEN, method = "POST") => {
  const r = await fetch(`${BASE}/api/webhooks/web/${encodeURIComponent(token)}`, {
    method,
    headers: { "content-type": "application/json" },
    body: method === "POST" ? JSON.stringify(body) : undefined,
  });
  let json = null;
  try { json = await r.json(); } catch { /* sin cuerpo */ }
  return { status: r.status, json };
};

if (!TOKEN) {
  console.log("✗ falta WEB_LEADS_TOKEN en el .env");
  process.exit(1);
}
if (process.env.E2E_FLAG_OFF === "1") {
  check("apagado: el webhook da 404 aunque la llave sea buena", (await web(null, TOKEN, "GET")).status === 404);
  process.exit(failures ? 1 : 0);
}

check("llave equivocada → 404", (await web(null, "otra-llave", "GET")).status === 404);
const g = await web(null, TOKEN, "GET");
check("GET con la llave → { ok: true } (prueba de conexión del sitio)", g.status === 200 && g.json?.ok === true, JSON.stringify(g));

// Sesión del CRM para mirar el resultado.
const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", OWNER.email);
await page.fill("#password", OWNER.password);
await page.click("button[type=submit]");
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 30_000 });
const api = async (path, init = {}) => {
  const r = await page.request.fetch(`${BASE}${path}`, { ...init, headers: { origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });
  let json = null;
  try { json = await r.json(); } catch { /* sin JSON */ }
  return { status: r.status(), json };
};

// Una propiedad del CRM enlazada a la del sitio por su URL.
const stamp = Date.now().toString(36);
const webId = randomUUID();
const prop = (await api("/api/propiedades", { method: "POST", data: { operation: "venta", type: "lote", priceCents: 12_000_000, currency: "USD", provincia: "Alajuela", canton: "Alajuela", zona: `La Guácima ${stamp}` } })).json;
await api(`/api/propiedades/${prop.id}`, { method: "PATCH", data: { urlExterna: `https://knockknockcr.com/property/${webId}` } });
const ficha = (await api(`/api/propiedades/${prop.id}`)).json.property;
const tel8 = `8${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

// 1) El formato exacto de hoy (sin referidor).
const id1 = randomUUID();
const hoy = {
  id: id1,
  name: `Ana Web ${stamp}`,
  phone: `+506 ${tel8.slice(0, 4)} ${tel8.slice(4)}`,
  email: `ana-${stamp}@example.com`,
  message: "¿Sigue disponible?",
  property: { id: webId, url: `https://knockknockcr.com/property/${webId}`, title: ficha.title },
  pageUrl: `https://knockknockcr.com/property/${webId}`,
};
let r = await web(hoy);
check("el envío de hoy entra → 200 { ok: true }", r.status === 200 && r.json?.ok === true, JSON.stringify(r));
const contactId = r.json?.contactId;
const contactos = (await api("/api/contactos")).json.contactos;
const c = contactos.find((x) => x.id === contactId);
check("crea el contacto con +506", c?.phone === `506${tel8}`, c?.phone);
check("…en el pipeline", !!c?.lead);
check("…con su correo en la ficha", c?.email === `ana-${stamp}@example.com`);
check("…interesado en la propiedad del CRM (encontrada por la URL)", c?.propiedades?.includes(ficha.code), JSON.stringify(c?.propiedades));
const tareas = (await api(`/api/tareas?vista=contacto&contactId=${contactId}`)).json.pendientes;
check("…con UNA tarea «Responder solicitud web — KK-…»", tareas.length === 1 && tareas[0].title === `Responder solicitud web — ${ficha.code} · ${ficha.title}`, JSON.stringify(tareas.map((t) => t.title)));
check("…asignada a un propietario", !!tareas[0]?.assignedUserId);
// 059 — Una hora para contestar: la tarea no nace vencida.
const minutos = (new Date(tareas[0]?.dueAt).getTime() - Date.now()) / 60_000;
check("059: la tarea vence en ~1 hora, no nace vencida", minutos > 50 && minutos <= 61, `${minutos.toFixed(1)} min`);
check("059: el origen dice «Sitio web»", c?.desdeWeb === true);
check("059: el mensaje no se amontona en las notas", !c?.notes?.includes("¿Sigue disponible?"), c?.notes);
const det = (await api(`/api/contactos/${contactId}`)).json;
check("059: la solicitud guarda el mensaje y la propiedad", det?.solicitudesWeb?.[0]?.mensaje === "¿Sigue disponible?" && det.solicitudesWeb[0].propiedad?.code === ficha.code, JSON.stringify(det?.solicitudesWeb));
check("059: y sale en la historia", det?.historial?.some((h) => h.tipo === "web"));
await page.goto(`${BASE}/contacts/${contactId}`);
await page.getByText("Del sitio web").waitFor({ timeout: 15_000 });
check("059: la página del contacto muestra la tarjeta «Del sitio web» con lo que escribió", await page.getByRole("list", { name: "Formularios del sitio web" }).getByText("¿Sigue disponible?").isVisible());

// 2) Reintento del mismo envío: nada se duplica.
r = await web(hoy);
check("reintento con el mismo id → ok, marcado duplicado", r.status === 200 && r.json?.duplicate === true);
check("…sin otra tarea", (await api(`/api/tareas?vista=contacto&contactId=${contactId}`)).json.pendientes.length === 1);

// 3) La misma persona vuelve por el enlace de un referidor.
const ref = { id: randomUUID(), code: `JP${stamp.slice(-4)}`, name: `Juan Pérez ${stamp}` };
r = await web({ ...hoy, id: randomUUID(), referrer: ref, message: "Me lo recomendó Juan" });
check("mismo teléfono → mismo contacto", r.json?.contactId === contactId);
check("…sin apilar otra tarea igual", (await api(`/api/tareas?vista=contacto&contactId=${contactId}`)).json.pendientes.length === 1);
const c2 = (await api("/api/contactos")).json.contactos.find((x) => x.id === contactId);
check("…y queda «Referido por» el referidor", c2?.referidor?.nombre === ref.name, JSON.stringify(c2?.referidor));

// 4) Solicitud específica: lo que busca va a la ficha.
const tel8b = `7${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
r = await web({ id: randomUUID(), kind: "specific_request", name: `Beto Busca ${stamp}`, phone: tel8b, email: `beto-${stamp}@example.com`, language: "en", preferences: { operation: "compra", types: ["casa"], zones: ["Escazú", "Santa Ana"], budgetMin: 300000, budgetMax: 450000, currency: "USD", bedrooms: 3, timeline: "en 2 meses" }, referrer: ref });
const beto = (await api(`/api/contacts/${r.json?.contactId}/perfil`)).json?.perfil;
check("solicitud específica → ficha con zonas, presupuesto y plazo", beto?.zonas?.join() === "Escazú,Santa Ana" && beto?.presupuestoMaxCents === 45_000_000 && beto?.plazo === "1_3_meses" && beto?.idioma === "en", JSON.stringify(beto));
check("…marcado como dato del sitio", beto?.fuentes?.presupuesto === "web");

// 5) Lo que editó una persona no lo pisa el sitio.
await api(`/api/contacts/${contactId}/perfil`, { method: "PUT", data: { email: `ana.real-${stamp}@example.com` } });
await web({ ...hoy, id: randomUUID(), email: `otro-${stamp}@example.com` });
check("el correo corregido a mano se respeta", (await api(`/api/contacts/${contactId}/perfil`)).json.perfil.email === `ana.real-${stamp}@example.com`);

// 6) Vendedor y 7) solo correo.
r = await web({ id: randomUUID(), kind: "seller", name: `Carla Vende ${stamp}`, phone: `6${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`, message: "Quiero vender mi casa en Belén" });
const carla = (await api("/api/contactos")).json.contactos.find((x) => x.id === r.json?.contactId);
check("formulario de vendedor → tipo «vendedor» y tarea «Contactar vendedor»", carla?.tiposCliente?.includes("vendedor") && (await api(`/api/tareas?vista=contacto&contactId=${carla.id}`)).json.pendientes[0]?.title === "Contactar vendedor (sitio web)");
r = await web({ id: randomUUID(), kind: "contact", name: `Solo Correo ${stamp}`, email: `solo-${stamp}@example.com`, message: "Info general" });
check("formulario solo con correo también entra", r.status === 200 && r.json?.ok === true, JSON.stringify(r));
r = await web({ id: randomUUID(), name: "Sin datos", message: "hola" });
check("sin teléfono ni correo → 422, sin crear nada", r.status === 422, JSON.stringify(r));

// Referidos.
const refs = (await api("/api/referidos")).json.referidos;
const juan = refs.find((x) => x.nombre === ref.name);
check("Referidos: Juan con 2 leads", juan?.leads === 2, JSON.stringify(juan));
await page.goto(`${BASE}/referidos`);
await page.locator("h1", { hasText: "Referidos" }).waitFor();
await page.getByRole("link", { name: ref.name }).click();
await page.waitForURL(/\/contacts\?referidor=/);
const filas = page.locator("main li").filter({ hasText: stamp });
await filas.first().waitFor({ timeout: 15_000 });
await page.waitForTimeout(600);
check("su enlace abre Contactos filtrado por él (2)", (await filas.count()) === 2, `${await filas.count()}`);

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
