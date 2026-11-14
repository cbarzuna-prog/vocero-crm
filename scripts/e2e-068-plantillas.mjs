/**
 * 068 (fork · Hiyou) — Self-test del motor de plantillas, contra una
 * instancia NUEVA (base vacía: el registro solo se abre para la primera
 * organización, como en el sandbox con datos inventados):
 *
 *   createdb vocero_068 && DATABASE_URL=…/vocero_068 pnpm db:migrate
 *   DATABASE_URL=…/vocero_068 PLANTILLAS=on PLANTILLAS_DEMO=on TAREAS=on WA_MOCK_ENABLED=true pnpm start
 *   node scripts/e2e-068-plantillas.mjs
 *
 * Escenarios por fase (se extiende con cada fase de tasks.md).
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const DUENA = { email: process.env.E2E_068_EMAIL ?? "duena@bruma.test", password: "bruma-contrasena-1", name: "Dueña Bruma" };
const SHOTS = process.env.E2E_SHOTS ?? "";
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};
const foto = async (page, nombre) => SHOTS && page.screenshot({ path: `${SHOTS}/${nombre}.png` });

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();

// Primera cuenta = la dueña del negocio nuevo (si ya existe, entra).
const alta = await page.request.post(`${BASE}/api/auth/sign-up/email`, { headers: { origin: BASE }, data: DUENA });
if (alta.status() !== 200) {
  await page.goto(`${BASE}/login`);
  await page.fill("#email", DUENA.email);
  await page.fill("#password", DUENA.password);
  await page.click("button[type=submit]");
  await page.waitForLoadState("networkidle");
}

// ---------- Fase 3 · Setup ----------
await page.goto(`${BASE}/`);
await page.waitForURL(/\/bienvenida/, { timeout: 60_000 });
check("setup: un negocio sin plantilla entra directo a /bienvenida", page.url().includes("/bienvenida"));
await page.getByRole("heading", { name: "¿Qué tipo de negocio tiene?" }).waitFor({ timeout: 30_000 });
const tipos = page.getByRole("radiogroup", { name: "Tipo de negocio" });
check("setup: ofrece General y Estudio Bruma (demo)", (await tipos.getByRole("radio").count()) === 2 && (await tipos.getByText("Inventado, para probar").isVisible()));
await tipos.getByRole("radio", { name: /Estudio Bruma/ }).click();
check("setup: la elegida queda marcada", (await tipos.getByRole("radio", { name: /Estudio Bruma/ }).getAttribute("aria-checked")) === "true");
await foto(page, "068-paso1");
await page.getByRole("button", { name: /^Seguir/ }).click();
await page.getByRole("heading", { name: "Pongámosle su marca" }).waitFor({ timeout: 30_000 });
check("setup: al seguir se aplica la plantilla (paso 2)", true);

// Retomar: recargar a mitad deja en el paso 2.
await page.reload();
check("setup: si se recarga, retoma en el paso 2", await page.getByRole("heading", { name: "Pongámosle su marca" }).waitFor({ timeout: 30_000 }).then(() => true, () => false));
await page.getByLabel("Nombre del negocio").fill("Estudio Bruma");
await page.getByRole("button", { name: "Ciruela" }).click();
await page.getByLabel("Moneda de sus precios").selectOption("CRC");
const preview = page.getByLabel("Vista previa");
check("setup: la vista previa usa el vocabulario de la plantilla («Reservas»)", (await preview.innerText()).includes("Reservas"));
await foto(page, "068-paso2");
await page.getByRole("button", { name: /^Seguir/ }).click();
await page.getByRole("heading", { name: "Conecte su WhatsApp" }).waitFor({ timeout: 30_000 });
const listo = page.getByRole("region", { name: "Su CRM ya está listo" });
const tl = await listo.innerText();
check("setup: el resumen dice lo que se configuró", ["Consulta → Cita agendada → Confirmada", "Servicios", "7 de ejemplo", "Ámbar a los 5 min"].every((t) => tl.includes(t)), tl);
await foto(page, "068-paso3");
const marca = (await (await page.request.get(`${BASE}/api/settings/branding`)).json()).branding;
check("setup: guardó nombre, color y colones", marca.name === "Estudio Bruma" && marca.accent === "#5f5470" && marca.currency === "CRC", JSON.stringify(marca));
await page.getByRole("button", { name: "Entrar a mi CRM" }).click();
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 60_000 });
check("setup: al terminar entra al CRM y no vuelve al setup", !page.url().includes("/bienvenida"), page.url());
const menu = page.getByRole("navigation").first();
check("menú: el embudo se llama como en la plantilla («Reservas»)", await page.getByRole("link", { name: "Reservas" }).first().isVisible().catch(() => false));
const board = await (await page.request.get(`${BASE}/api/pipeline/board`)).json();
check("embudo: tiene las etapas de Bruma", board.stages.map((s) => s.name).join("|") === "Consulta|Cita agendada|Confirmada|Atendido|Perdido", board.stages.map((s) => s.name).join("|"));
void menu;
check("menú: sin agente conectado, no muestra Agente ni Laboratorio", !(await page.getByRole("link", { name: "Laboratorio" }).count()) && !(await page.getByRole("link", { name: "Agente", exact: true }).count()));
await page.goto(`${BASE}/pipeline`);
await page.getByRole("heading", { name: "Reservas" }).waitFor({ timeout: 30_000 }).catch(() => null);
check("embudo: el título usa el vocabulario («Reservas», no «Compradores»)", await page.getByRole("heading", { name: "Reservas" }).isVisible().catch(() => false));
const buscador = page.getByLabel("Buscar en Reservas");
check("embudo: el buscador no habla de inmuebles (sin «KK-»)", !((await buscador.getAttribute("placeholder").catch(() => "KK-")) ?? "KK-").includes("KK-"));
check("embudo: no dice «tratos»", !(await page.locator("main").first().innerText()).includes("tratos"));

// ---------- Fase 4 · Ficha según el giro ----------
const api = async (path, init = {}) => {
  const r = await page.request.fetch(`${BASE}${path}`, { ...init, headers: { origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });
  let json = null;
  try { json = await r.json(); } catch { /* sin JSON */ }
  return { status: r.status(), json };
};
const stamp = Date.now().toString(36);
const nuevo = (await api("/api/contacts", { method: "POST", data: { name: `Clienta ${stamp}`, phone: `5067${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` } })).json;
const cid = nuevo.contact.id;
await page.goto(`${BASE}/contacts/${cid}`);
const ficha = page.getByRole("region", { name: "Ficha del negocio" });
check("ficha: muestra los datos de la plantilla", await ficha.waitFor({ timeout: 60_000 }).then(() => true, () => false));
const tf = await ficha.innerText();
const orden = await page.evaluate(() => {
  const f = document.querySelector('[aria-label="Ficha del negocio"]'), d = document.querySelector('[aria-label="Datos de contacto"]');
  return f && d ? !!(f.compareDocumentPosition(d) & Node.DOCUMENT_POSITION_FOLLOWING) : null;
});
check("ficha: los datos del giro van antes que los datos de contacto", orden === true, String(orden));
check("ficha: agrupados por momento (primer contacto / durante la venta / más datos)", ["Al primer contacto", "Durante la venta", "Más datos"].every((t) => tf.includes(t)), tf);
check("ficha: con los campos de Bruma", ["Servicio que busca", "Profesional preferido", "Cada cuánto viene"].every((t) => tf.includes(t)), tf);
await ficha.getByLabel("Servicio que busca").selectOption("Corte y barba");
await page.waitForTimeout(600);
const fv = (await api(`/api/contactos/${cid}/ficha-valores`)).json;
check("ficha: un dato se guarda al elegirlo", fv.valores.servicio_interes?.valor === "Corte y barba" && fv.valores.servicio_interes?.fuente === "manual", JSON.stringify(fv.valores));
check("ficha: un valor fuera de la lista se rechaza con motivo", (await api(`/api/contactos/${cid}/ficha-valores`, { method: "PUT", data: { campo: "servicio_interes", valor: "Tatuaje" } })).status === 422);
check("ficha: un dato que no existe en la plantilla se rechaza", (await api(`/api/contactos/${cid}/ficha-valores`, { method: "PUT", data: { campo: "alergias", valor: "x" } })).status === 422);
await ficha.getByRole("button", { name: /Más datos/ }).click();
await ficha.getByLabel("Cómo le gusta").fill("Degradado bajo, sin gel");
await ficha.getByLabel("Cómo le gusta").blur();
await page.waitForTimeout(600);
check("ficha: los «Más datos» se abren y guardan", (await api(`/api/contactos/${cid}/ficha-valores`)).json.valores.preferencias?.valor === "Degradado bajo, sin gel");

// ---------- Fase 5 · Criterio de etapa ----------
const criterio = page.getByRole("region", { name: "Para pasar a Cita agendada" });
check("criterio: la ficha dice qué falta para la siguiente etapa", await criterio.waitFor({ timeout: 30_000 }).then(() => true, () => false));
const tc0 = await criterio.innerText();
check("criterio: el servicio ya está (listo) y falta la cita", /Servicio que busca\s*\(listo\)/.test(tc0) && /cita por venir\s*\(falta\)/.test(tc0), tc0);
check("criterio: sin cumplir todo, no ofrece mover", (await criterio.getByRole("button").count()) === 0);
const crit0 = (await api(`/api/contactos/${cid}/criterio`)).json.criterio;
check("criterio: la API calcula lo mismo", crit0.etapaActual.nombre === "Consulta" && crit0.siguiente.cumple === false, JSON.stringify(crit0));

const citas = page.getByRole("region", { name: "Citas" });
check("registros: la ficha tiene la tarjeta de citas", await citas.waitFor({ timeout: 30_000 }).then(() => true, () => false));
await citas.getByRole("button", { name: /Nueva/ }).click();
const dlg = page.getByRole("dialog");
const manana = new Date(Date.now() + 86_400_000);
const local = `${manana.getFullYear()}-${String(manana.getMonth() + 1).padStart(2, "0")}-${String(manana.getDate()).padStart(2, "0")}T10:30`;
await dlg.getByLabel("Fecha y hora").fill(local);
await dlg.getByLabel("Servicio").selectOption("Corte");
await dlg.getByLabel("Profesional").selectOption("Andrea");
await dlg.getByRole("button", { name: "Guardar" }).click();
await dlg.waitFor({ state: "detached", timeout: 15_000 });
await citas.getByText("Corte", { exact: true }).waitFor({ timeout: 15_000 });
const regs = (await api(`/api/contactos/${cid}/registros`)).json.registros;
check("registros: la cita se crea con el precio del catálogo (₡7 000)", regs.length === 1 && regs[0].importeCents === 700_000 && regs[0].moneda === "CRC" && regs[0].estado === "agendada", JSON.stringify(regs));
check("registros: la tarjeta muestra precio y profesional", /₡7[\s.,]?000/.test(await citas.innerText()) && (await citas.innerText()).includes("Andrea"), await citas.innerText());
const pasar = criterio.getByRole("button", { name: "Pasar a Cita agendada" });
check("criterio: con la cita agendada, todo queda listo y ofrece pasar", await pasar.waitFor({ timeout: 15_000 }).then(() => true, () => false), await criterio.innerText().catch(() => ""));
await pasar.click();
await page.getByRole("region", { name: "Para pasar a Confirmada" }).waitFor({ timeout: 15_000 }).catch(() => null);
const b2 = await (await page.request.get(`${BASE}/api/pipeline/board`)).json();
const etapaDe = (bd) => bd.stages.find((s) => s.id === bd.leads.find((l) => l.contactId === cid || l.contact?.id === cid)?.stageId)?.name;
check("criterio: «Pasar a…» mueve el trato (y nunca lo mueve solo)", etapaDe(b2) === "Cita agendada", etapaDe(b2));
const conf = page.getByRole("region", { name: "Para pasar a Confirmada" });
check("criterio: ahora pide que la cita esté confirmada (no salta solo)", /Cita confirmada\s*\(falta\)/.test(await conf.innerText().catch(() => "")) && (await conf.getByRole("button").count()) === 0, await conf.innerText().catch(() => ""));
await citas.getByLabel(/Estado de Corte/).selectOption("confirmada");
check("criterio: al confirmar la cita, ofrece «Pasar a Confirmada»", await conf.getByRole("button", { name: "Pasar a Confirmada" }).waitFor({ timeout: 15_000 }).then(() => true, () => false));
await citas.getByLabel(/Estado de Corte/).selectOption("atendida");
await page.waitForTimeout(600);
check("registros: el estado se cambia en la tarjeta", (await api(`/api/contactos/${cid}/registros`)).json.registros[0].estado === "atendida");
check("registros: un tipo que no existe se rechaza", (await api(`/api/contactos/${cid}/registros`, { method: "POST", data: { tipo: "vehiculo" } })).status === 422);
await foto(page, "068-ficha");

// Celular: el setup cabe sin desplazamiento horizontal.
const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
const pm = await movil.newPage();
await pm.goto(`${BASE}/bienvenida`);
await pm.getByRole("heading", { name: "Conecte su WhatsApp" }).waitFor({ timeout: 30_000 });
check("celular: el setup cabe sin desplazamiento horizontal", (await pm.evaluate(() => document.documentElement.scrollWidth)) <= 390);
await movil.close();

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
