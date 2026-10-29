/**
 * 057 (fork) — Self-test de Contactos y la página del contacto, en un
 * navegador real contra la app viva (TAREAS y PROPIEDADES encendidos).
 *
 *   node --env-file=.env scripts/e2e-057-contactos.mjs
 *
 * Lista: resumen bajo el título, búsqueda por zona, filtro por tipo de
 * cliente, orden por nombre, seleccionar dos → archivar → «Deshacer», mover
 * de etapa en lote. Página: datos, acciones, ficha, tareas e historia; en el
 * celular, las tareas primero. `E2E_FLAG_OFF=1`: la API da 404.
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
  check("apagado: GET /api/contactos → 404", (await api("/api/contactos")).status === 404);
  await browser.close();
  process.exit(failures ? 1 : 0);
}

// Datos: tres contactos con ficha distinta.
const stamp = Date.now().toString(36);
const tel = () => `5068${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;
const crear = async (name, perfil) => {
  const c = (await api("/api/contacts", { method: "POST", data: { name, phone: tel() } })).json.contact;
  if (perfil) await api(`/api/contacts/${c.id}/perfil`, { method: "PUT", data: perfil });
  return c;
};
const a = await crear(`Zeta Comprador ${stamp}`, { tiposCliente: ["comprador"], zonas: [`Lindora${stamp}`], presupuestoMaxCents: 45_000_000 });
const b = await crear(`Alfa Vendedora ${stamp}`, { tiposCliente: ["vendedor"] });
const c = await crear(`Mike Inversionista ${stamp}`, { tiposCliente: ["inversionista"] });
const hoy = (await api("/api/tareas?vista=hoy")).json.today;
await api("/api/tareas", { method: "POST", data: { contactId: a.id, title: `Llamar ${stamp}`, type: "llamada", day: hoy, time: "23:30" } });

await page.goto(`${BASE}/contacts`);
await page.locator("h1", { hasText: "Contactos" }).waitFor();
check("bajo el título va el resumen", /\d+ contactos?/.test(await page.locator("h1 + p").innerText()));
const filas = () => page.locator("main li").filter({ hasText: stamp });
await filas().first().waitFor({ timeout: 15_000 });
check("los tres contactos aparecen", (await filas().count()) === 3, `${await filas().count()}`);
const filaA = filas().filter({ hasText: "Zeta Comprador" });
check("la fila muestra qué busca (presupuesto y zona)", /US\$450,000/.test(await filaA.innerText()) && (await filaA.innerText()).includes(`Lindora${stamp}`));
check("…y su tarea pendiente", /1 pend\./.test(await filaA.innerText()));
check("los íconos tienen texto de ayuda", (await filaA.getByRole("link", { name: /Llamar a/ }).getAttribute("title")) === "Llamar");

// Buscar por zona, filtrar por tipo, ordenar.
const buscar = page.getByLabel("Buscar contacto");
await buscar.fill(`lindora${stamp}`);
await page.waitForTimeout(300);
check("buscar por zona encuentra al comprador", (await filas().count()) === 1 && (await filas().first().innerText()).includes("Zeta"));
await buscar.fill(stamp);
await page.getByRole("button", { name: /Filtros/ }).click();
await page.getByLabel("Tipo de cliente").selectOption("vendedor");
await page.waitForTimeout(300);
check("filtrar por tipo «Vendedor»", (await filas().count()) === 1 && (await filas().first().innerText()).includes("Alfa"));
await page.getByLabel("Tipo de cliente").selectOption("");
await page.getByLabel("Ordenar contactos").selectOption("nombre");
await page.waitForTimeout(300);
const orden = await filas().allInnerTexts();
check("ordenar por nombre (A–Z)", orden[0].includes("Alfa") && orden[2].includes("Zeta"), orden.map((t) => t.split("\n")[0]).join(" | "));

// Selección múltiple: archivar y deshacer.
await page.getByLabel(`Seleccionar a Alfa Vendedora ${stamp}`).check();
await page.getByLabel(`Seleccionar a Mike Inversionista ${stamp}`).check();
const barra = page.getByRole("region", { name: "Acciones con los seleccionados" });
check("al seleccionar aparece la barra con «2 seleccionados»", (await barra.innerText()).includes("2 seleccionados"));
await barra.getByRole("button", { name: "Archivar" }).click();
await page.getByRole("status").getByText("2 contactos archivados").waitFor({ timeout: 5000 });
await page.waitForTimeout(400);
check("archivar los saca de la lista", (await filas().count()) === 1);
await page.getByRole("status").getByRole("button", { name: "Deshacer" }).click();
await page.waitForTimeout(1200);
check("«Deshacer» los devuelve", (await filas().count()) === 3, `${await filas().count()}`);

// Mover de etapa en lote.
const etapas = (await api("/api/pipeline/stages")).json.stages.filter((s) => s.kind === "open");
const destino = etapas[1] ?? etapas[0];
await page.getByLabel(`Seleccionar a Alfa Vendedora ${stamp}`).check();
await page.getByLabel(`Seleccionar a Mike Inversionista ${stamp}`).check();
await barra.getByLabel("Mover a la etapa").selectOption(destino.id);
await page.getByRole("status").getByText(/pasaron a/).waitFor({ timeout: 10_000 });
const lista = (await api("/api/contactos")).json.contactos;
check(`mover dos a «${destino.name}» en lote`, [b.id, c.id].every((id) => lista.find((x) => x.id === id)?.lead?.stageId === destino.id));

// Página del contacto.
await filaA.getByRole("link", { name: /^Zeta Comprador/ }).click();
await page.waitForURL(new RegExp(`/contacts/${a.id}`));
await page.locator("h1", { hasText: `Zeta Comprador ${stamp}` }).waitFor();
check("la página abre con el nombre como título", true);
const main = page.locator("main");
const acciones = await Promise.all(["Escribir primero", "Llamar", "Archivar"].map((t) => main.locator("header").getByText(t, { exact: true }).count()));
check("trae las acciones: Escribir primero, Llamar, Archivar", acciones.every((n) => n > 0), JSON.stringify(acciones));
check("…su ficha de cliente", await main.getByText(/US\$450,000/).first().waitFor({ timeout: 10_000 }).then(() => true, () => false));
check("…sus tareas", (await main.innerText()).includes(`Llamar ${stamp}`));
check("…y su historia («Se creó el contacto»)", (await main.innerText()).includes("Se creó el contacto"));
check("en la página no se repite «Ver página completa»", (await main.getByText("Ver página completa").count()) === 0);

// Celular: tareas antes que la ficha.
const movil = await (await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, storageState: await ctx.storageState() })).newPage();
await movil.goto(`${BASE}/contacts/${a.id}`);
await movil.getByText(`Llamar ${stamp}`).waitFor({ timeout: 15_000 });
const yTarea = (await movil.getByText(`Llamar ${stamp}`).boundingBox())?.y ?? 1e9;
const yFicha = (await movil.getByText("US$450,000").first().boundingBox())?.y ?? 0;
check("en el celular las tareas van antes que la ficha", yTarea < yFicha, `${yTarea} vs ${yFicha}`);

// Limpieza.
const pend = (await api(`/api/tareas?vista=contacto&contactId=${a.id}`)).json.pendientes;
for (const t of pend) await api(`/api/tareas/${t.id}`, { method: "DELETE" });
await api("/api/contactos/lote", { method: "POST", data: { ids: [a.id, b.id, c.id], accion: "archivar" } });
await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
