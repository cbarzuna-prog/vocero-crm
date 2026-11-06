/**
 * 062 (fork) — Self-test del semáforo de atención contra la app viva
 * (TAREAS/PROPIEDADES encendidos, base de datos local en DATABASE_URL).
 *
 *   node --env-file=.env scripts/e2e-062-atencion.mjs
 *
 * Ajustes → Tiempos de atención (sugeridos por etapa, guardar), un lead
 * nuevo que se pone rojo pasados 15 minutos (el reloj se adelanta en la base),
 * la tarjeta roja en el Pipeline y la fila en Contactos, «Esperan atención»
 * en Hoy, una tarea a futuro que lo deja al día, un mensaje sin responder que
 * manda sobre todo y la respuesta que lo apaga, y una captación en rojo.
 * El horario se abre a toda hora durante la prueba y se restaura al final.
 */
import { chromium } from "playwright";
import postgres from "postgres";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const sql = postgres(process.env.DATABASE_URL, { max: 2, onnotice: () => {} });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", OWNER.email);
await page.fill("#password", OWNER.password);
await page.click("button[type=submit]");
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 60_000 });
const api = async (path, init = {}) => {
  const r = await page.request.fetch(`${BASE}${path}`, { ...init, headers: { origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });
  let json = null;
  try { json = await r.json(); } catch { /* sin JSON */ }
  return { status: r.status(), json };
};

// 1) Ajustes: tiempos sugeridos por el nombre de cada etapa.
await page.goto(`${BASE}/settings/atencion`);
await page.getByRole("heading", { name: "Tiempos de atención" }).waitFor({ timeout: 20_000 });
check("Ajustes tiene «Tiempos de atención» en el menú", await page.getByRole("link", { name: "Tiempos de atención" }).isVisible());
const original = (await api("/api/atencion/config")).json;
const abiertas = original.etapas.filter((e) => e.kind === "open");
const primera = abiertas[0];
check("cada etapa abierta trae su tiempo sugerido", abiertas.length > 0 && abiertas.every((e) => e.tiempo?.accion && e.tiempo.rojoMin > e.tiempo.ambarMin), JSON.stringify(abiertas.map((e) => e.name)));
check("en pantalla: qué hacer, ámbar y rojo por etapa", await page.getByLabel(`Qué hacer en ${primera.name}`, { exact: true }).isVisible() && await page.getByLabel(`Rojo en ${primera.name}`, { exact: true }).isVisible());

// Abrir el horario a toda hora (la prueba corre a cualquier hora) y fijar la primera etapa en 5/15 min.
const cfgPrueba = {
  ...original.config,
  horario: { dias: [0, 1, 2, 3, 4, 5, 6], desde: "00:00", hasta: "23:59" },
  etapas: { ...original.config.etapas, [primera.id]: { ambarMin: 5, rojoMin: 15, accion: "Llamar ya" } },
};
check("guardar la configuración", (await api("/api/atencion/config", { method: "PUT", data: cfgPrueba })).status === 200);
check("rojo menor que ámbar → 422", (await api("/api/atencion/config", { method: "PUT", data: { ...cfgPrueba, mensaje: { ambarMin: 60, rojoMin: 10 } } })).status === 422);

// Guardar desde la pantalla también funciona.
await page.reload();
await page.getByLabel(`Qué hacer en ${primera.name}`, { exact: true }).fill("Llamar ya, de verdad");
await page.getByRole("button", { name: "Guardar" }).click();
await page.getByText("Guardado").waitFor({ timeout: 10_000 });
check("se guarda desde la pantalla", (await api("/api/atencion/config")).json.config.etapas[primera.id].accion === "Llamar ya, de verdad");

try {
  // 2) Un lead nuevo, con el reloj adelantado 30 minutos.
  const stamp = Date.now().toString(36);
  const nombre = `Atención ${stamp}`;
  const tel = `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
  const creado = await api("/api/contacts", { method: "POST", data: { name: nombre, phone: tel } });
  const contactId = creado.json?.contact?.id ?? creado.json?.id;
  const fila = (await api("/api/contactos")).json.contactos.find((c) => c.id === contactId);
  const leadId = fila?.lead?.id;
  check("el contacto entra al Pipeline en la primera etapa", !!leadId && fila.lead.stageId === primera.id, JSON.stringify(fila?.lead));
  let a = (await api("/api/atencion")).json;
  check("recién llegado: sin color", a.leads[leadId]?.nivel === "ok", JSON.stringify(a.leads[leadId]));
  await sql`update lead set created_at = now() - interval '30 minutes' where id = ${leadId}`;
  await sql`update lead_stage_event set occurred_at = now() - interval '30 minutes' where lead_id = ${leadId}`;
  a = (await api("/api/atencion")).json;
  check("a los 30 min: rojo, con la acción de la etapa", a.leads[leadId]?.nivel === "rojo" && a.leads[leadId]?.accion === "Llamar ya, de verdad" && a.leads[leadId]?.minutos >= 29, JSON.stringify(a.leads[leadId]));
  check("…y encabeza «pendientes»", a.pendientes.some((p) => p.id === leadId && p.nivel === "rojo"));

  // Pipeline: la tarjeta completa en rojo.
  await page.goto(`${BASE}/pipeline`);
  const tarjeta = page.getByRole("button", { name: `Abrir el trato de ${nombre}` });
  await tarjeta.waitFor({ timeout: 20_000 });
  await page.waitForFunction((n) => {
    const el = document.querySelector(`[aria-label="Abrir el trato de ${n}"] > div`);
    return el && getComputedStyle(el).backgroundColor !== "rgb(255, 255, 255)";
  }, nombre, { timeout: 15_000 }).catch(() => {});
  const fondo = await tarjeta.locator("> div").evaluate((el) => getComputedStyle(el).backgroundColor);
  check("Pipeline: la tarjeta se pinta de rojo", fondo !== "rgb(255, 255, 255)" && fondo !== "rgba(0, 0, 0, 0)", fondo);
  check("…y dice qué hacer y cuánto lleva", /Llamar ya, de verdad/.test(await tarjeta.innerText()) && /\d+ min/.test(await tarjeta.innerText()), await tarjeta.innerText());

  // Contactos y Hoy.
  await page.goto(`${BASE}/contacts`);
  const filaUi = page.locator("main li").filter({ hasText: nombre });
  await filaUi.getByText("Llamar ya, de verdad").waitFor({ timeout: 15_000 });
  check("Contactos: la fila muestra la espera", true);
  await page.goto(`${BASE}/hoy`);
  const esperan = page.getByRole("region", { name: /Esperan atención/ });
  await esperan.waitFor({ timeout: 15_000 });
  // (La base de pruebas acumula tratos viejos en rojo: arriba van los que más esperan.)
check("Hoy: «Esperan atención» lista lo rojo primero", (await esperan.getByRole("link").count()) > 0 && /en rojo/.test(await esperan.innerText()));

  // 3) Una tarea a futuro: al día.
  const manana = new Date(Date.now() + 86_400_000);
  const dia = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}`;
  const tarea = (await api("/api/tareas", { method: "POST", data: { contactId, title: `Visita ${stamp}`, type: "visita", day: dia, time: "10:00" } })).json;
  a = (await api("/api/atencion")).json;
  check("con una tarea a futuro: al día, y dice cuál", a.leads[leadId]?.nivel === "ok" && a.leads[leadId]?.motivo === "agendado" && a.leads[leadId]?.accion === `Visita ${stamp}`, JSON.stringify(a.leads[leadId]));
  const tareaId = tarea?.task?.id ?? tarea?.id;
  if (tareaId) await sql`update task set due_at = now() - interval '40 minutes' where id = ${tareaId}`;
  a = (await api("/api/atencion")).json;
  check("si la tarea se vence: el reloj corre desde el vencimiento", a.leads[leadId]?.motivo === "tarea_vencida" && a.leads[leadId]?.nivel === "rojo", JSON.stringify(a.leads[leadId]));
  if (tareaId) await sql`update task set due_at = now() + interval '1 day' where id = ${tareaId}`;

  // 4) Mensaje sin responder: manda aunque haya tarea a futuro.
  const convId = `cv_e2e${stamp}`;
  const org = (await sql`select organization_id from contact where id = ${contactId}`)[0].organization_id;
  await sql`insert into conversation (id, organization_id, contact_id) values (${convId}, ${org}, ${contactId})`;
  await sql`insert into message (id, organization_id, conversation_id, direction, text, created_at) values (${`msg_e2e${stamp}a`}, ${org}, ${convId}, 'in', 'Hola, ¿sigue disponible?', now() - interval '70 minutes')`;
  a = (await api("/api/atencion")).json;
  check("mensaje sin responder hace 70 min: rojo «Responder su mensaje»", a.leads[leadId]?.motivo === "mensaje" && a.leads[leadId]?.nivel === "rojo" && a.leads[leadId]?.accion === "Responder su mensaje", JSON.stringify(a.leads[leadId]));
  await sql`insert into message (id, organization_id, conversation_id, direction, text, origin) values (${`msg_e2e${stamp}b`}, ${org}, ${convId}, 'out', 'Sí, claro', 'ai')`;
  a = (await api("/api/atencion")).json;
  check("al responder (aunque sea el agente) vuelve a estar al día", a.leads[leadId]?.nivel === "ok", JSON.stringify(a.leads[leadId]));

  // 5) Una captación en «Contacto» con más de 4 h sin contacto: roja.
  const capt = (await api("/api/captaciones", { method: "POST", data: { nombre: `Dueño ${stamp}`, telefono: `7${tel.slice(-7)}`, operation: "venta", type: "casa", provincia: "San José", canton: "Escazú" } })).json;
  await sql`update property set captacion_desde = now() - interval '5 hours' where id = ${capt.id}`;
  a = (await api("/api/atencion")).json;
  check("captación sin contacto 5 h: roja con su acción", a.captaciones[capt.id]?.nivel === "rojo" && /dueño/.test(a.captaciones[capt.id]?.accion), JSON.stringify(a.captaciones[capt.id]));
  await page.goto(`${BASE}/captaciones`);
  const tc = page.getByRole("button", { name: new RegExp(`Abrir la captación ${capt.code}`) });
  await tc.getByText(/dueño/).waitFor({ timeout: 15_000 });
  check("Captaciones: la tarjeta muestra la espera", true);

  // Celular: el Pipeline también lo marca.
  const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
  const pm = await movil.newPage();
  await sql`delete from message where conversation_id = ${convId} and direction = 'out'`;
  await pm.goto(`${BASE}/pipeline`);
  await pm.getByRole("tab", { name: new RegExp(primera.name) }).click();
  await pm.getByText("Responder su mensaje").first().waitFor({ timeout: 15_000 });
  check("celular: la fila del Pipeline dice «Responder su mensaje»", true);
  await movil.close();
} finally {
  // Restaurar la configuración que había.
  await api("/api/atencion/config", { method: "PUT", data: { ...original.config, etapas: original.config.etapas } });
  await sql.end();
}

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
