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
