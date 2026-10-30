/**
 * 060 (fork) — Self-test de colaboradores: quién trajo y quién vende cada
 * propiedad y el reparto de la comisión, contra la app viva (PROPIEDADES on).
 *
 *   node --env-file=.env scripts/e2e-060-colaboradores.mjs
 *
 * Registra una co-corredora desde la ficha, reparte 30/70 con alguien del
 * equipo, revisa montos y «queda para la agencia», los errores (más de 100 %),
 * «Partes iguales», su página de contacto («Colabora en»), los filtros de
 * Propiedades y Captaciones y la ficha en el celular.
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

const stamp = Date.now().toString(36);
const nombre = `Colab ${stamp}`;
const tel = `6${String(Math.floor(Math.random() * 1e7)).padStart(7, "0")}`;

// Una propiedad de $450,000 al 5 % → comisión $22,500.
const prop = (await api("/api/propiedades", { method: "POST", data: { operation: "venta", type: "casa", priceCents: 45_000_000, currency: "USD", provincia: "San José", canton: "Escazú", zona: `Colab ${stamp}` } })).json;
await api(`/api/propiedades/${prop.id}`, { method: "PATCH", data: { comisionBp: 500 } });

await page.goto(`${BASE}/propiedades/${prop.id}`);
const seccion = page.getByRole("region", { name: "Quién la trajo y quién la vende" });
await seccion.waitFor({ timeout: 20_000 });
check("la ficha tiene «Quién la trajo y quién la vende» con la comisión", (await seccion.innerText()).includes("$22,500"), await seccion.innerText());
check("sin nadie: la comisión completa es de la agencia", await seccion.getByText("la comisión completa es de la agencia").isVisible());

// Registrar a la co-corredora (no está en Contactos).
await seccion.getByRole("button", { name: "Colaborador externo" }).click();
await seccion.getByRole("button", { name: "No está: registrarlo" }).click();
await seccion.getByLabel("Nombre del colaborador").fill(nombre);
await seccion.getByLabel("Teléfono del colaborador").fill(tel);
await seccion.getByRole("button", { name: "Registrar y agregar" }).click();
const pctColab = seccion.getByLabel(`Porcentaje de ${nombre}`);
await pctColab.waitFor();
check("entra con el 100 % disponible", (await pctColab.inputValue()) === "100");
await pctColab.fill("30");
await seccion.getByLabel(`Papel de ${nombre}`).selectOption("capta");

// Alguien del equipo con el resto.
await seccion.getByRole("button", { name: "Del equipo" }).click();
const grupo = seccion.getByRole("group", { name: "Elegir del equipo" });
await grupo.getByRole("button").first().waitFor();
const miembro = (await grupo.getByRole("button").first().innerText()).trim();
await grupo.getByRole("button").first().click();
const pctEquipo = seccion.getByLabel(`Porcentaje de ${miembro}`);
check("el del equipo entra con lo que queda (70)", (await pctEquipo.inputValue()) === "70", await pctEquipo.inputValue());
const texto = await seccion.innerText();
check("montos: $6,750 y $15,750; agencia 0 %", texto.includes("$6,750") && texto.includes("$15,750") && texto.includes("0 %"), texto);

// Más de 100 %: no deja guardar.
await pctEquipo.fill("80");
check("si suma más de 100 % lo dice y no deja guardar", (await seccion.getByText(/no pueden pasar de 100 %/).isVisible()) && (await seccion.getByRole("button", { name: "Guardar reparto" }).isDisabled()));
await pctEquipo.fill("60");
check("lo no repartido queda para la agencia (10 % · $2,250)", (await seccion.innerText()).includes("10 %") && (await seccion.innerText()).includes("$2,250"));

await seccion.getByRole("button", { name: "Guardar reparto" }).click();
await seccion.getByText("Reparto guardado").waitFor({ timeout: 10_000 });
const guardado = (await api(`/api/propiedades/${prop.id}/colaboracion`)).json.participantes;
const colab = guardado.find((x) => x.nombre === nombre);
check("se guarda: colaboradora 30 % «la trajo» + equipo 60 %", colab?.porcentajeBp === 3000 && colab?.rol === "capta" && colab?.externo && guardado.find((x) => !x.externo)?.porcentajeBp === 6000, JSON.stringify(guardado));

// Partes iguales.
await seccion.getByRole("button", { name: "Partes iguales" }).click();
check("«Partes iguales» → 50 / 50", (await pctColab.inputValue()) === "50" && (await pctEquipo.inputValue()) === "50");
await page.reload();
await seccion.waitFor();
await seccion.getByLabel(`Porcentaje de ${nombre}`).waitFor();
check("sin guardar, al recargar sigue el reparto guardado (30)", (await seccion.getByLabel(`Porcentaje de ${nombre}`).inputValue()) === "30");

// API: errores.
check("API: más de 100 % → 422", (await api(`/api/propiedades/${prop.id}/colaboracion`, { method: "PUT", data: { participantes: [{ contactId: colab.contactId, rol: "capta", porcentajeBp: 10_001 }] } })).status === 422);
check("API: contacto de otra organización/inexistente → 422", (await api(`/api/propiedades/${prop.id}/colaboracion`, { method: "PUT", data: { participantes: [{ contactId: "ct_noexiste", rol: "capta", porcentajeBp: 1000 }] } })).status === 422);

// La colaboradora: marcada y con «Colabora en».
const perfil = (await api(`/api/contacts/${colab.contactId}/perfil`)).json.perfil;
check("queda marcada «colaborador» en su ficha", perfil?.tiposCliente?.includes("colaborador"), JSON.stringify(perfil?.tiposCliente));
const contactos = (await api("/api/contactos")).json.contactos;
const fila = contactos.find((x) => x.id === colab.contactId);
check("no se le crea trato de comprador en el Pipeline", fila && fila.lead === null, JSON.stringify(fila?.lead));
await page.goto(`${BASE}/contacts/${colab.contactId}`);
const colabora = page.getByRole("list", { name: "Propiedades donde colabora" });
await colabora.waitFor({ timeout: 15_000 });
const tc = await colabora.innerText();
check("su página muestra «Colabora en» con papel, 30 % y $6,750", tc.includes(prop.code) && tc.includes("La trajo") && tc.includes("30 %") && tc.includes("$6,750"), tc);

// Filtros.
const filtradas = (await api(`/api/propiedades?status=todas&colaborador=c:${colab.contactId}`)).json.properties;
check("Propiedades filtra por colaborador", filtradas.length === 1 && filtradas[0].id === prop.id, JSON.stringify(filtradas.map((p) => p.code)));
await page.goto(`${BASE}/propiedades`);
const sel = page.getByLabel("Colaborador");
const abrirFiltros = page.getByRole("button", { name: /Filtros/ });
if (!(await sel.isVisible().catch(() => false)) && (await abrirFiltros.count())) await abrirFiltros.first().click();
await sel.waitFor({ timeout: 10_000 });
check("el filtro de Propiedades lista a la colaboradora", (await sel.locator("option").allInnerTexts()).some((t) => t.includes(nombre)));

const capt = (await api("/api/captaciones", { method: "POST", data: { nombre: `Dueño ${stamp}`, telefono: `7${tel.slice(1)}`, operation: "venta", type: "lote", provincia: "Alajuela", canton: "Alajuela", priceCents: 10_000_000, currency: "USD" } })).json;
await api(`/api/propiedades/${capt.id}/colaboracion`, { method: "PUT", data: { participantes: [{ contactId: colab.contactId, rol: "ambos", porcentajeBp: 5000 }] } });
await page.goto(`${BASE}/captaciones`);
const tarjeta = page.getByRole("region", { name: "Contacto" }).getByRole("button", { name: new RegExp(capt.code) });
await tarjeta.waitFor({ timeout: 15_000 });
check("la tarjeta de Captaciones dice quién participa", (await tarjeta.innerText()).includes(`Colab 50 %`), await tarjeta.innerText());
await page.getByLabel("Colaborador").selectOption(`c:${colab.contactId}`);
const visibles = await page.getByRole("button", { name: /Abrir la captación KK-/ }).count();
check("filtrar Captaciones por ella deja solo las suyas", visibles === 1, String(visibles));

// Celular: la ficha no se desborda.
const movil = await browser.newContext({ viewport: { width: 380, height: 800 }, storageState: await ctx.storageState(), isMobile: true, hasTouch: true });
const pm = await movil.newPage();
await pm.goto(`${BASE}/propiedades/${prop.id}`);
await pm.getByRole("button", { name: /Interno/ }).click();
await pm.getByRole("region", { name: "Quién la trajo y quién la vende" }).getByLabel(`Porcentaje de ${nombre}`).waitFor({ timeout: 15_000 });
const ancho = await pm.evaluate(() => document.documentElement.scrollWidth);
check("celular: el reparto cabe sin desplazamiento horizontal", ancho <= 380, String(ancho));
await movil.close();

await browser.close();
console.log(failures === 0 ? "\nTodo en verde." : `\n${failures} check(s) fallaron.`);
process.exit(failures === 0 ? 0 : 1);
