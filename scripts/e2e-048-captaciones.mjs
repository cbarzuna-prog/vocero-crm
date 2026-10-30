/**
 * 048 (fork) — Self-test del tablero de Captaciones (pipeline de vendedores)
 * contra la app viva (PROPIEDADES/TAREAS encendidos).
 *
 *   node --env-file=.env scripts/e2e-048-captaciones.mjs
 *
 * Crea una captación desde la pantalla con un dueño nuevo, la mueve con el
 * detalle y arrastrando, firma la exclusiva (6 meses y tarea de renovación 15
 * días antes), cambia el vencimiento desde la ficha, la publica (entra al
 * inventario), pierde otra con motivo, revisa el alquiler (1 mes de renta) y la
 * vista del celular. `E2E_FLAG_OFF=1`: pantalla y API dan 404.
 */
import { chromium } from "playwright";

const BASE = process.env.APP_BASE_URL ?? "http://localhost:3000";
const OWNER = { email: process.env.E2E_EMAIL ?? "e2e-046@example.com", password: process.env.E2E_PASSWORD ?? "e2e-046-contrasena" };
let failures = 0;
const check = (name, ok, detail = "") => {
  console.log(`${ok ? "✓" : "✗"} ${name}${!ok && detail ? ` — ${detail}` : ""}`);
  if (!ok) failures++;
};

const browser = await chromium.launch(process.env.CHROME_PATH ? { executablePath: process.env.CHROME_PATH } : {});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
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

if (process.env.E2E_FLAG_OFF === "1") {
  check("apagado: /api/captaciones da 404", (await api("/api/captaciones")).status === 404);
  const r = await page.goto(`${BASE}/captaciones`);
  check("apagado: la pantalla da 404", r?.status() === 404);
  await browser.close();
  process.exit(failures ? 1 : 0);
}

const stamp = Date.now().toString(36);
const hoy = new Date();
const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const tel = `8${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const nombre = `Dueña ${stamp}`;

await page.goto(`${BASE}/captaciones`);
await page.locator("h1", { hasText: "Captaciones" }).waitFor();
check("el menú tiene «Captaciones»", await page.getByRole("link", { name: "Captaciones" }).first().isVisible());

// 1) Nueva captación desde la pantalla, con un dueño nuevo.
await page.getByRole("button", { name: "Nueva captación" }).first().click();
const dlg = page.getByRole("dialog", { name: "Nueva captación" });
await dlg.getByRole("button", { name: "Crear captación" }).click();
check("sin dueño no se crea y lo dice", await dlg.getByText("Busque al dueño o regístrelo como contacto nuevo").isVisible());
await dlg.getByRole("button", { name: "Es alguien nuevo" }).click();
await dlg.getByLabel("Nombre del dueño").fill(nombre);
await dlg.getByLabel("Teléfono del dueño").fill(tel);
await dlg.getByRole("radio", { name: "Casa" }).click();
await dlg.locator("#capt-precio").fill("450000");
await dlg.locator("#capt-zona").fill(`Valle ${stamp}`);
check("muestra la comisión por defecto (5 %)", await dlg.getByText("comisión 5 %").isVisible());
await dlg.getByRole("button", { name: "Crear captación" }).click();
await dlg.waitFor({ state: "detached" });
const contacto = page.getByRole("region", { name: "Contacto" });
const tarjeta = contacto.getByRole("button", { name: /Abrir la captación KK-/ }).filter({ hasText: nombre });
await tarjeta.waitFor({ timeout: 15_000 });
check("la tarjeta aparece en «Contacto» con el dueño", await tarjeta.isVisible());
check("…con lo que pide y la comisión estimada", (await tarjeta.innerText()).includes("$450,000") && (await tarjeta.innerText()).includes("comisión $22,500"), await tarjeta.innerText());

let caps = (await api("/api/captaciones")).json.captaciones;
const c1 = caps.find((x) => x.dueno?.name === nombre);
check("API: propiedad en captación, 5 %", c1?.status === "captacion" && c1?.comisionBp === 500 && c1?.etapa === "contacto", JSON.stringify(c1));
const perfil = (await api(`/api/contacts/${c1.dueno.id}/perfil`)).json.perfil;
check("el dueño queda marcado «vendedor» en su ficha", perfil?.tiposCliente?.includes("vendedor"), JSON.stringify(perfil?.tiposCliente));
check("teléfono de 8 dígitos guardado con +506", c1.dueno.phone === `506${tel}`, c1.dueno.phone);

// 2) Mover con el detalle (teclado / celular).
await tarjeta.click();
const det = page.getByRole("dialog", { name: new RegExp(c1.code) });
await det.getByRole("button", { name: "Valoración" }).click();
await det.waitFor({ state: "detached" });
await page.getByRole("region", { name: "Valoración" }).getByText(nombre).waitFor({ timeout: 10_000 });
check("«Mover a» la pasa a Valoración", true);

// 3) Arrastrar a Propuesta.
const origen = page.getByRole("region", { name: "Valoración" }).getByRole("button", { name: new RegExp(c1.code) });
const destino = page.getByRole("region", { name: "Propuesta" });
const a = await origen.boundingBox();
const b = await destino.boundingBox();
await page.mouse.move(a.x + a.width / 2, a.y + a.height / 2);
await page.mouse.down();
await page.mouse.move(a.x + a.width / 2 + 20, a.y + a.height / 2, { steps: 4 });
await page.mouse.move(b.x + b.width / 2, b.y + 120, { steps: 12 });
const guardado = page.waitForResponse((r) => r.url().includes(`/api/captaciones/${c1.id}`) && r.request().method() === "PATCH");
await page.mouse.up();
await guardado;
await destino.getByText(nombre).waitFor({ timeout: 10_000 });
caps = (await api("/api/captaciones")).json.captaciones;
check("arrastrando la pasa a Propuesta (y se guarda)", caps.find((x) => x.id === c1.id)?.etapa === "propuesta");

// 4) Firmar la exclusiva: 6 meses por defecto, comisión editable.
await destino.getByRole("button", { name: new RegExp(c1.code) }).click();
await page.getByRole("dialog", { name: new RegExp(c1.code) }).getByRole("button", { name: "Exclusiva firmada" }).click();
const firmar = page.getByRole("dialog", { name: "Exclusiva firmada" });
await firmar.waitFor();
const venceUi = await firmar.getByLabel("Vence el").inputValue();
const seis = new Date(hoy.getFullYear(), hoy.getMonth() + 6, Math.min(hoy.getDate(), new Date(hoy.getFullYear(), hoy.getMonth() + 7, 0).getDate()));
check("propone vencimiento a 6 meses", venceUi === iso(seis), venceUi);
await firmar.getByLabel("Comisión sobre la venta (%)").fill("4.5");
const firmado = page.waitForResponse((r) => r.url().includes(`/api/captaciones/${c1.id}`) && r.request().method() === "PATCH");
await firmar.getByRole("button", { name: "Guardar" }).click();
await firmado;
await page.getByRole("region", { name: "Exclusiva firmada" }).getByText(nombre).waitFor({ timeout: 10_000 });
const ficha = (await api(`/api/propiedades/${c1.id}`)).json.property;
check("firmada: exclusiva, fecha de firma, vencimiento y 4.5 %", ficha.exclusiva && ficha.captadaAt === iso(hoy) && ficha.exclusivaVence === venceUi && ficha.comisionBp === 450, JSON.stringify({ e: ficha.exclusiva, c: ficha.captadaAt, v: ficha.exclusivaVence, bp: ficha.comisionBp }));
const tareas = async () => (await api(`/api/tareas?vista=contacto&contactId=${c1.dueno.id}`)).json.pendientes.filter((t) => t.title.startsWith("Renovar exclusiva"));
let ren = await tareas();
const aviso = new Date(Date.parse(`${venceUi}T12:00:00`) - 15 * 86_400_000);
check("crea UNA tarea «Renovar exclusiva» 15 días antes", ren.length === 1 && iso(new Date(ren[0].dueAt)) === iso(aviso) && ren[0].property?.id === c1.id, JSON.stringify(ren));
const badge = page.getByRole("region", { name: "Exclusiva firmada" }).getByText(/^Vence /).first();
check("la tarjeta muestra el vencimiento", await badge.waitFor({ timeout: 10_000 }).then(() => true, () => false));

// 5) Cambiar el vencimiento desde la ficha mueve la tarea (no crea otra).
const nuevoVence = iso(new Date(hoy.getFullYear(), hoy.getMonth() + 3, 10));
await api(`/api/propiedades/${c1.id}`, { method: "PATCH", data: { exclusivaVence: nuevoVence } });
ren = await tareas();
check("cambiar el vencimiento mueve la tarea", ren.length === 1 && iso(new Date(ren[0].dueAt)) === iso(new Date(Date.parse(`${nuevoVence}T12:00:00`) - 15 * 86_400_000)), JSON.stringify(ren.map((t) => t.dueAt)));
// Volver a firmar (renovar) no duplica la tarea.
await api(`/api/captaciones/${c1.id}`, { method: "PATCH", data: { etapa: "firmada", firmadaEl: iso(hoy), exclusivaVence: venceUi } });
check("renovar no duplica la tarea", (await tareas()).length === 1);

// 6) Publicar: entra al inventario.
await api(`/api/captaciones/${c1.id}`, { method: "PATCH", data: { etapa: "publicada" } });
check("publicada: la propiedad queda «disponible»", (await api(`/api/propiedades/${c1.id}`)).json.property.status === "disponible");

// 7) Otra que no se capta: pide motivo.
const c2 = (await api("/api/captaciones", { method: "POST", data: { nombre: `Otro ${stamp}`, telefono: `7${tel.slice(1)}`, operation: "alquiler", type: "apartamento", provincia: "San José", canton: "Escazú", priceCents: 150_000, currency: "USD" } })).json;
check("alquiler: sin porcentaje (1 mes de renta)", (await api("/api/captaciones")).json.captaciones.find((x) => x.id === c2.id)?.comisionBp === null);
await page.reload();
const tAlq = page.getByRole("region", { name: "Contacto" }).getByRole("button", { name: new RegExp(c2.code) });
await tAlq.waitFor();
check("alquiler: la tarjeta estima 1 mes de renta", (await tAlq.innerText()).includes("comisión $1,500"), await tAlq.innerText());
await tAlq.click();
await page.getByRole("dialog", { name: new RegExp(c2.code) }).getByRole("button", { name: "No se captó" }).click();
const perd = page.getByRole("dialog", { name: "¿Por qué no se captó?" });
check("no se captó: «Guardar» espera el motivo", await perd.getByRole("button", { name: "Guardar" }).isDisabled());
await perd.getByText("Firmó con otra agencia").click();
await perd.getByRole("button", { name: "Guardar" }).click();
await page.getByRole("region", { name: "No se captó" }).getByRole("button", { name: "Ver las que no se captaron" }).click();
await page.getByRole("region", { name: "No se captó" }).getByRole("button", { name: new RegExp(c2.code) }).getByText("Firmó con otra agencia").waitFor({ timeout: 10_000 });
check("…queda en «No se captó» con su motivo y la propiedad retirada", (await api(`/api/propiedades/${c2.id}`)).json.property.status === "retirada");
check("API: perderla sin motivo → 422", (await api(`/api/captaciones/${c2.id}`, { method: "PATCH", data: { etapa: "perdida" } })).status === 422);

const sinDesliz = await page.evaluate(() => {
  const r = document.querySelector('section[aria-label="Publicada"]')?.getBoundingClientRect();
  return r ? r.right <= window.innerWidth : false;
});
await page.getByRole("region", { name: "No se captó" }).getByRole("button", { name: "Plegar" }).click();
check("escritorio: las cinco etapas vivas caben sin deslizar (1440 px)", await page.evaluate(() => {
  const r = document.querySelector('section[aria-label="Publicada"]')?.getBoundingClientRect();
  return r ? r.right <= window.innerWidth : false;
}) || sinDesliz);

// 8) Celular: una etapa a la vez.
const movil = await browser.newContext({ viewport: { width: 380, height: 800 }, storageState: await ctx.storageState(), hasTouch: true, isMobile: true });
const pm = await movil.newPage();
await pm.goto(`${BASE}/captaciones`);
await pm.getByRole("tab", { name: /Publicada/ }).click();
await pm.getByRole("tabpanel").getByText(nombre).waitFor({ timeout: 10_000 });
check("celular: pestañas por etapa y la tarjeta en «Publicada»", true);
const ancho = await pm.evaluate(() => document.documentElement.scrollWidth);
check("celular: sin desplazamiento horizontal de la página", ancho <= 380, String(ancho));
await movil.close();

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
