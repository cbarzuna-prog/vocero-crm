/**
 * 056 (fork) — Self-test de los arreglos de la revisión de UX/accesibilidad,
 * en un navegador real contra la app viva (TAREAS/PROPIEDADES encendidos).
 *
 *   node --env-file=.env scripts/e2e-056-revision.mjs
 *
 * Escritorio: «Crear → Contacto» desde la barra lateral abre un diálogo de
 * verdad (ancho, aria-modal, foco en Nombre, Tab no se escapa, Esc cierra y
 * devuelve el foco), los obligatorios avisan debajo del campo, +506 por
 * defecto, y los botones del pie de la barra miden 36 px. Celular: el «+»
 * de la barra inferior abre el mismo diálogo.
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
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
await page.goto(`${BASE}/login`);
await page.fill("#email", OWNER.email);
await page.fill("#password", OWNER.password);
await page.click("button[type=submit]");
await page.waitForURL(/\/(hoy|onboarding|inbox)/, { timeout: 30_000 });
await page.goto(`${BASE}/contacts`);

// Abrir desde la barra lateral.
const crear = page.getByRole("button", { name: "Crear", exact: true });
await crear.click();
await page.getByRole("menuitem", { name: "Contacto" }).click();
const dlg = page.getByRole("dialog", { name: "Nuevo contacto" });
await dlg.waitFor();
const caja = await dlg.boundingBox();
check("el diálogo abre fuera de la barra, con ancho de verdad (≥ 400 px)", !!caja && caja.width >= 400, JSON.stringify(caja));
check("…es modal y tiene nombre propio", (await dlg.getAttribute("aria-modal")) === "true" && !!(await dlg.getAttribute("aria-labelledby")));
check("…el foco empieza en Nombre", await page.evaluate(() => document.activeElement?.id === "nc-nombre"));
const cancelar = await dlg.getByRole("button", { name: "Cancelar" }).boundingBox();
check("«Cancelar» se ve completo", !!cancelar && cancelar.x >= caja.x && cancelar.x + cancelar.width <= caja.x + caja.width + 1);

// Tab no se escapa.
for (let i = 0; i < 15; i++) await page.keyboard.press("Tab");
check("Tab no sale del diálogo", await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));
await page.keyboard.press("Shift+Tab");
check("Mayús+Tab tampoco", await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]')));

// Esc cierra y devuelve el foco a «Crear».
await page.keyboard.press("Escape");
await dlg.waitFor({ state: "detached" });
check("Esc cierra el diálogo", true);
check("…y el foco vuelve a «Crear»", await page.evaluate(() => document.activeElement?.textContent?.trim() === "Crear"));

// Obligatorios: el botón está activo y avisa debajo del campo.
await crear.click();
await page.getByRole("menuitem", { name: "Contacto" }).click();
await dlg.waitFor();
const boton = dlg.getByRole("button", { name: "Crear contacto" });
check("«Crear contacto» está activo aunque falten datos", await boton.isEnabled());
await boton.click();
check("sin nombre: lo dice debajo y lo marca inválido", (await dlg.getByText("Escriba el nombre.").isVisible()) && (await dlg.locator("#nc-nombre").getAttribute("aria-invalid")) === "true");
check("…y el foco va al campo que falta", await page.evaluate(() => document.activeElement?.id === "nc-nombre"));
check("los obligatorios están marcados", (await dlg.locator("#nc-nombre").getAttribute("aria-required")) === "true" && (await dlg.locator("#nc-tel").getAttribute("aria-required")) === "true");
const tel = dlg.locator("#nc-tel");
check("el teléfono es type=tel con inputmode y autocomplete", (await tel.getAttribute("type")) === "tel" && (await tel.getAttribute("inputmode")) === "tel" && !!(await tel.getAttribute("autocomplete")));
check("+506 viene elegido", (await dlg.getByLabel("Código de país").inputValue()) === "506");

const stamp = Date.now().toString(36);
const numero = `8${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
await dlg.locator("#nc-nombre").fill(`Ana Mora ${stamp}`);
await tel.fill(numero.slice(0, 6));
await boton.click();
check("un número de 6 dígitos avisa que en CR son 8", await dlg.getByText(/tiene 8 dígitos/).isVisible());
await tel.fill(`${numero.slice(0, 4)}-${numero.slice(4)}`);
await boton.click();
await dlg.waitFor({ state: "detached", timeout: 10_000 });
const r = await page.request.get(`${BASE}/api/contacts?q=${encodeURIComponent(`Ana Mora ${stamp}`)}`);
const c = (await r.json()).contacts[0];
check("crea el contacto con +506", c?.phone?.replace(/\D/g, "") === `506${numero}`, JSON.stringify(c?.phone));

// Pie de la barra lateral.
for (const name of [/Sonido de mensajes/, /^Tema:/, "Cerrar sesión"]) {
  const b = await page.getByRole("button", { name }).first().boundingBox();
  check(`botón del pie «${name}» mide ≥ 36 px`, !!b && b.height >= 36 && b.width >= 36, JSON.stringify(b));
}
const activo = page.locator('nav [aria-current="page"]').first();
check("la opción activa se distingue (marca naranja)", /253, 93, 8/.test(await activo.evaluate((el) => getComputedStyle(el).boxShadow)));

// Celular: el «+» abre el mismo diálogo.
const movil = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await page.context().storageState() })).newPage();
await movil.goto(`${BASE}/hoy`);
await movil.getByRole("button", { name: /Crear contacto, tarea o propiedad/ }).click();
await movil.getByRole("menuitem", { name: "Contacto" }).click();
const dm = movil.getByRole("dialog", { name: "Nuevo contacto" });
await dm.waitFor();
const bm = await dm.boundingBox();
check("en el celular sube como hoja a todo el ancho", !!bm && bm.width >= 380, JSON.stringify(bm));

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
