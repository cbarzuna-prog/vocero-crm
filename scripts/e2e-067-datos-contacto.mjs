/**
 * 067 (fork) — «Datos de contacto» en la ficha: teléfono y correo visibles
 * (repetidos a propósito), y se agregan o corrigen desde «Editar».
 *
 *   TAREAS=on PROPIEDADES=on WA_MOCK_ENABLED=true pnpm start
 *   node --env-file=.env scripts/e2e-067-datos-contacto.mjs
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

const stamp = Date.now().toString(36);
const nombre = `Datos ${stamp}`;
const tel = `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const creado = (await api("/api/contacts", { method: "POST", data: { name: nombre, phone: tel } })).json;
const id = creado.contact.id;

await page.goto(`${BASE}/contacts/${id}`);
await page.getByRole("heading", { name: nombre }).waitFor({ timeout: 60_000 });
const datos = page.getByRole("region", { name: "Datos de contacto" });
await datos.waitFor({ timeout: 30_000 });
const t1 = await datos.innerText();
check("la ficha tiene «Datos de contacto» con el teléfono", t1.replace(/\D/g, "").includes(tel.slice(-4)), t1);
check("sin correo: lo dice y ofrece agregarlo", /Sin correo — agréguelo/.test(t1), t1);
check("WhatsApp y llamar a un toque", (await datos.getByRole("link", { name: "WhatsApp" }).getAttribute("href"))?.endsWith(tel) && (await datos.locator('a[href^="tel:"]').count()) === 1);

// Agregar el correo y cambiar el teléfono desde «Editar».
await datos.getByRole("button", { name: "Sin correo — agréguelo" }).click();
const dlg = page.getByRole("dialog");
await dlg.getByLabel("Correo").fill(`datos-${stamp}@ejemplo.com`);
await dlg.getByLabel("Teléfono").fill("123");
await dlg.getByRole("button", { name: "Guardar" }).click();
check("un teléfono inválido se rechaza con un motivo claro", await dlg.getByRole("alert").filter({ hasText: /teléfono no parece válido/ }).waitFor({ timeout: 10_000 }).then(() => true, () => false));
const ocho = `8${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
await dlg.getByLabel("Teléfono").fill(`${ocho.slice(0, 4)} ${ocho.slice(4)}`);
await dlg.getByRole("button", { name: "Guardar" }).click();
await dlg.waitFor({ state: "detached", timeout: 15_000 });
await datos.getByText(`datos-${stamp}@ejemplo.com`).waitFor({ timeout: 15_000 });
const fila = (await api("/api/contactos")).json.contactos.find((c) => c.id === id);
check("el teléfono de 8 dígitos se guarda con el 506", fila?.phone === `506${ocho}`, fila?.phone);
check("el correo queda en la ficha", fila?.email === `datos-${stamp}@ejemplo.com`, fila?.email);
check("el encabezado y la ficha muestran el mismo teléfono", (await page.locator("main").first().innerText()).slice(0, 300).replace(/\D/g, "").includes(ocho) && (await datos.innerText()).replace(/\D/g, "").includes(ocho));

// Celular: la tarjeta cabe.
const movil = await browser.newContext({ viewport: { width: 390, height: 844 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
const pm = await movil.newPage();
await pm.goto(`${BASE}/contacts/${id}`);
await pm.getByRole("region", { name: "Datos de contacto" }).waitFor({ timeout: 60_000 });
check("celular: sin desplazamiento horizontal", (await pm.evaluate(() => document.documentElement.scrollWidth)) <= 390);
await movil.close();

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
