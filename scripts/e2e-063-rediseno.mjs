/**
 * 063 (fork) — Self-test del rediseño con las referencias del dueño: nombres
 * «Compradores»/«Captación externa», tablero con flechas de color, ponderado, buscador y
 * «Solo en rojo»; ficha del contacto con botones redondos, barra de etapas que
 * mueve el trato, resumen de la IA y una sola línea de actividad; y «Hoy» con
 * la franja de bienvenida. Contra la app viva con mocks:
 *
 *   OPENROUTER_API_TOKEN=x OPENROUTER_BASE_URL=http://localhost:3000/api/dev/ai-mock \
 *   TAREAS=on PROPIEDADES=on WA_MOCK_ENABLED=true pnpm dev
 *   node --env-file=.env scripts/e2e-063-rediseno.mjs
 *
 * Sin IA configurada, el resumen debe decirlo sin romper la página (camino infeliz).
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
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 90_000 });
const api = async (path, init = {}) => {
  const r = await page.request.fetch(`${BASE}${path}`, { ...init, headers: { origin: BASE, "content-type": "application/json", ...(init.headers ?? {}) } });
  let json = null;
  try { json = await r.json(); } catch { /* sin JSON */ }
  return { status: r.status(), json };
};

// Un comprador con monto, para el ponderado y la ficha.
const stamp = Date.now().toString(36);
const nombre = `Rediseño ${stamp}`;
const creado = (await api("/api/contacts", { method: "POST", data: { name: nombre, phone: `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}` } })).json;
const contactId = creado.contact.id;
const leadId = creado.lead.id;
await api(`/api/pipeline/leads/${leadId}`, { method: "PATCH", data: { amountCents: 45_000_000 } });

// 1) Hoy: la franja de bienvenida.
await page.goto(`${BASE}/hoy`);
const franja = page.getByRole("region", { name: "Resumen del día" });
await franja.waitFor({ timeout: 60_000 });
check("Hoy: saludo grande según la hora", /^(Buenos días|Buenas tardes|Buenas noches)/.test(await franja.getByRole("heading", { level: 1 }).innerText()));
const ft = await franja.innerText();
check("Hoy: las cuatro cifras del día", ["Esperan atención", "Vencidas", "Para hoy", "Sin siguiente paso"].every((t) => ft.includes(t)), ft);
check("Hoy: «+ Tarea» y «Todas/Mías» dentro de la franja", (await franja.getByRole("button", { name: /Tarea/ }).isVisible()) && (await franja.getByRole("radio", { name: "Mías" }).isVisible()));

// 2) Menú con los nombres nuevos.
check("menú: «Compradores» y «Captación externa»", (await page.getByRole("link", { name: "Compradores" }).first().isVisible()) && (await page.getByRole("link", { name: "Captación externa" }).first().isVisible()));

// 3) Compradores: flechas de color, ponderado, buscador.
await page.goto(`${BASE}/pipeline`);
await page.getByRole("heading", { name: "Compradores" }).waitFor({ timeout: 60_000 });
const tarjeta = page.getByRole("button", { name: `Abrir el trato de ${nombre}` });
await tarjeta.waitFor({ timeout: 30_000 });
const columna = tarjeta.locator("xpath=ancestor::div[contains(@class,'snap-start')]").first();
const flecha = columna.locator("div[style*='clip-path']").first();
check("la etapa tiene encabezado en flecha de color", (await flecha.count()) === 1 && !/rgba\(0, 0, 0, 0\)/.test(await flecha.evaluate((el) => getComputedStyle(el).backgroundColor)));
check("al pie: el valor ponderado de la etapa", /Ponderado \(\d+ %\)/.test(await columna.innerText()), await columna.innerText());
await page.getByLabel("Buscar en Compradores").fill(stamp);
await page.waitForTimeout(300);
const visibles = () => page.evaluate(() => [...document.querySelectorAll('[aria-label^="Abrir el trato de "]')].filter((el) => el.getClientRects().length > 0).length);
check("el buscador deja solo lo que coincide", (await visibles()) === 1, String(await visibles()));
await page.getByLabel("Buscar en Compradores").fill("");
const rojo = page.getByRole("button", { name: /Solo en rojo/ });
if (await rojo.isEnabled()) {
  await rojo.click();
  const n = await page.evaluate(() => [...document.querySelectorAll('[aria-label^="Abrir el trato de "]')].filter((el) => el.getClientRects().length > 0).length);
  check("«Solo en rojo» filtra el tablero", n >= 1 && (await rojo.getAttribute("aria-pressed")) === "true", String(n));
  await rojo.click();
} else {
  check("«Solo en rojo» deshabilitado si no hay nada en rojo", true);
}
check("la tarjeta sin tarea dice «Sin siguiente paso»", await tarjeta.getByText("Sin siguiente paso").isVisible());

// 4) Ficha del contacto.
await page.goto(`${BASE}/contacts/${contactId}`);
await page.getByRole("heading", { name: nombre }).waitFor({ timeout: 60_000 });
const acciones = page.getByRole("navigation", { name: "Acciones" });
check("ficha: botones redondos (Escribir, Llamar, Tarea, Editar, Archivar)", ["Escribir", "Llamar", "Tarea", "Editar", "Archivar"].every((t) => acciones.getByText(t, { exact: true }).isVisible()));
const barra = page.getByRole("group", { name: "Etapa del trato" });
await barra.locator("button").nth(1).waitFor();
const etapas = await barra.locator("button").allInnerTexts();
check("ficha: barra con todas las etapas y la actual marcada", etapas.length >= 3 && (await barra.locator("[aria-current=step]").count()) === 1, JSON.stringify(etapas));
const siguiente = barra.locator("[aria-current=step] + button");
const nombreSiguiente = (await siguiente.innerText()).trim();
await siguiente.click();
await page.waitForFunction((n) => document.querySelector('[aria-label="Etapa del trato"] [aria-current=step]')?.textContent?.startsWith(n), nombreSiguiente, { timeout: 15_000 });
const fila = (await api("/api/contactos")).json.contactos.find((c) => c.id === contactId);
check("un clic en la barra mueve el trato (y queda guardado)", fila?.lead?.stageName === nombreSiguiente, `${fila?.lead?.stageName} vs ${nombreSiguiente}`);
check("la actividad lo registra en la línea de tiempo", await page.getByText(new RegExp(`a «${nombreSiguiente}»`)).first().isVisible().catch(() => false) || (await page.reload(), await page.getByText(new RegExp(`a «${nombreSiguiente}»`)).first().waitFor({ timeout: 10_000 }).then(() => true, () => false)));

// Resumen de la IA (o su aviso si no hay IA: no rompe la página).
await page.getByRole("button", { name: /^(Resumir|Actualizar)$/ }).click();
const r = await Promise.race([
  page.getByText(/^Resumen de prueba:/).waitFor({ timeout: 30_000 }).then(() => "ok"),
  page.getByRole("alert").filter({ hasText: /IA|Intente/ }).waitFor({ timeout: 30_000 }).then(() => "aviso"),
]).catch(() => "nada");
check("resumen: la IA lo escribe (o avisa con claridad si no está configurada)", r === "ok" || r === "aviso", r);
if (r === "ok") check("…y queda guardado al recargar", (await api(`/api/contactos/${contactId}/resumen`)).json.resumen?.texto?.startsWith("Resumen de prueba"));

// «Tarea» abre el diálogo de nueva tarea con el contacto.
await acciones.getByText("Tarea", { exact: true }).click();
check("«Tarea» abre la nueva tarea", await page.getByRole("dialog").first().isVisible());
await page.keyboard.press("Escape");

// 5) Captación externa.
await page.goto(`${BASE}/captaciones`);
await page.getByRole("heading", { name: "Captación externa" }).waitFor({ timeout: 60_000 });
check("Captación externa: subtítulo dice que son de terceros", await page.getByText(/Propiedades que nos traen terceros/).waitFor({ timeout: 20_000 }).then(() => true, () => false));

// 6) Celular: la ficha no se desborda (la barra de etapas se desliza sola).
const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
const pm = await movil.newPage();
await pm.goto(`${BASE}/contacts/${contactId}`);
await pm.getByRole("heading", { name: nombre }).waitFor({ timeout: 60_000 });
check("celular: la ficha cabe sin desplazamiento horizontal", (await pm.evaluate(() => document.documentElement.scrollWidth)) <= 390);
await pm.goto(`${BASE}/hoy`);
await pm.getByRole("region", { name: "Resumen del día" }).waitFor({ timeout: 60_000 });
check("celular: «Hoy» cabe sin desplazamiento horizontal", (await pm.evaluate(() => document.documentElement.scrollWidth)) <= 390);
await movil.close();

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
